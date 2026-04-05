// ============================================================================
// Agentic Payment API Server
// ============================================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { handleStripeWebhook } from './routes/webhooks.js';
import { closePool } from './db/index.js';
import { HTTP_STATUS } from '@agentic-payment/shared';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Create Fastify instance
const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' 
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
  // Trust proxy for rate limiting behind load balancer
  trustProxy: true,
});

// Register plugins
async function registerPlugins() {
  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // CORS
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return request.ip;
    },
  });
}

// Health check
app.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Ready check (includes database)
app.get('/ready', async (request, reply) => {
  try {
    // Simple database check
    const { query } = await import('./db/index.js');
    await query('SELECT 1');
    return { status: 'ready', timestamp: new Date().toISOString() };
  } catch (error) {
    reply.status(HTTP_STATUS.SERVICE_UNAVAILABLE);
    return { status: 'not_ready', error: 'Database unavailable' };
  }
});

// Webhook routes (no rate limit for webhooks)
app.register(async (instance) => {
  // Stripe webhook endpoint
  instance.post('/webhooks/stripe/:tenant_id', handleStripeWebhook);
}, { prefix: '/api/v1' });

// API routes
app.register(async (instance) => {
  // Get repair queue
  instance.get('/repairs', async (request, reply) => {
    const { query } = await import('../db/index.js');
    const result = await query(`
      SELECT 
        pe.id,
        pe.payment_intent_id,
        pe.amount_cents,
        pe.currency,
        pe.status,
        pe.decline_code,
        pe.created_at,
        fc.failure_type,
        fc.failure_category,
        fc.confidence,
        fc.reasoning,
        a.action_type,
        a.status as action_status
      FROM payment_events pe
      LEFT JOIN failure_classifications fc ON fc.payment_event_id = pe.id
      LEFT JOIN actions a ON a.payment_event_id = pe.id
      WHERE pe.status = 'failed'
      ORDER BY pe.created_at DESC
      LIMIT 50
    `);
    return { repairs: result.rows };
  });

  // Get single repair
  instance.get('/repairs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { query } = await import('../db/index.js');
    
    const eventResult = await query(`
      SELECT * FROM payment_events WHERE id = $1
    `, [id]);
    
    if (eventResult.rows.length === 0) {
      reply.status(HTTP_STATUS.NOT_FOUND);
      return { error: 'Payment event not found' };
    }
    
    const classificationResult = await query(`
      SELECT * FROM failure_classifications WHERE payment_event_id = $1
    `, [id]);
    
    const actionsResult = await query(`
      SELECT * FROM actions WHERE payment_event_id = $1 ORDER BY created_at DESC
    `, [id]);
    
    return {
      event: eventResult.rows[0],
      classification: classificationResult.rows[0] || null,
      actions: actionsResult.rows,
    };
  });

  // Get mandates
  instance.get('/mandates', async (request, reply) => {
    const { query } = await import('../db/index.js');
    const result = await query(`
      SELECT * FROM mandates ORDER BY created_at DESC
    `);
    return { mandates: result.rows };
  });

  // Get playbook rules
  instance.get('/playbooks', async (request, reply) => {
    const { query } = await import('../db/index.js');
    const result = await query(`
      SELECT * FROM playbook_rules ORDER BY priority DESC
    `);
    return { rules: result.rows };
  });

  // Get metrics
  instance.get('/metrics', async (request, reply) => {
    const { query } = await import('../db/index.js');
    
    // At-risk MRR (sum of failed payment amounts in last 30 days)
    const atRiskResult = await query(`
      SELECT COALESCE(SUM(amount_cents), 0) as at_risk_cents
      FROM payment_events
      WHERE status = 'failed'
      AND created_at > NOW() - INTERVAL '30 days'
    `);
    
    // Recovery stats
    const recoveryResult = await query(`
      SELECT 
        COUNT(CASE WHEN a.status = 'succeeded' THEN 1 END) as recovered_count,
        COALESCE(SUM(CASE WHEN a.status = 'succeeded' THEN pe.amount_cents ELSE 0 END), 0) as recovered_cents
      FROM actions a
      JOIN payment_events pe ON pe.id = a.payment_event_id
      WHERE a.action_type = 'retry_soft_decline'
      AND a.created_at > NOW() - INTERVAL '30 days'
    `);
    
    // Total failures
    const failuresResult = await query(`
      SELECT COUNT(*) as total_failures
      FROM payment_events
      WHERE status = 'failed'
      AND created_at > NOW() - INTERVAL '30 days'
    `);
    
    const atRiskCents = Number(atRiskResult.rows[0]?.at_risk_cents || 0);
    const recoveredCents = Number(recoveryResult.rows[0]?.recovered_cents || 0);
    const totalFailures = Number(failuresResult.rows[0]?.total_failures || 0);
    const recoveredCount = Number(recoveryResult.rows[0]?.recovered_count || 0);
    
    const recoveryRate = totalFailures > 0 
      ? Math.round((recoveredCount / totalFailures) * 100) 
      : 0;
    
    return {
      at_risk_mrr_cents: atRiskCents,
      recovered_mrr_cents: recoveredCents,
      recovery_rate_percentage: recoveryRate,
      total_failures: totalFailures,
      recovered_count: recoveredCount,
    };
  });

  // Approve action
  instance.post('/actions/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { query } = await import('../db/index.js');
    
    const result = await query(`
      UPDATE actions 
      SET status = 'approved', updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      reply.status(HTTP_STATUS.NOT_FOUND);
      return { error: 'Action not found or already processed' };
    }
    
    return { action: result.rows[0] };
  });

  // Reject action
  instance.post('/actions/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { reason?: string };
    const { query } = await import('../db/index.js');
    
    const result = await query(`
      UPDATE actions 
      SET status = 'rejected', error = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `, [id, body.reason || 'Rejected by user']);
    
    if (result.rows.length === 0) {
      reply.status(HTTP_STATUS.NOT_FOUND);
      return { error: 'Action not found or already processed' };
    }
    
    return { action: result.rows[0] };
  });
}, { prefix: '/api/v1' });

// Start server
async function start() {
  try {
    await registerPlugins();
    
    // Start listening
    await app.listen({ port: PORT, host: HOST });
    
    app.log.info(`Server listening on ${HOST}:${PORT}`);
    app.log.info(`Health check: http://${HOST}:${PORT}/health`);
    app.log.info(`API endpoint: http://${HOST}:${PORT}/api/v1`);
    
  } catch (error) {
    app.log.error(error, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    await app.close();
    await closePool();
    app.log.info('Server closed');
    process.exit(0);
  } catch (error) {
    app.log.error(error, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
start();

export default app;