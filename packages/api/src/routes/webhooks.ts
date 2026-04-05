// ============================================================================
// Stripe Webhook Handler - Payment Event Ingestion
// ============================================================================

import { FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../db/index.js';
import {
  NormalizedPaymentEvent,
  PaymentStatus,
  PSPType,
  StripeWebhookEventSchema,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from '@agentic-payment/shared';

interface WebhookRouteParams {
  tenant_id: string;
}

interface PaymentEventRow {
  id: string;
  event_id: string;
  tenant_id: string;
  payment_intent_id: string;
}

/**
 * Handle Stripe webhook events
 * POST /webhooks/stripe/:tenant_id
 */
export async function handleStripeWebhook(
  request: FastifyRequest<{ Params: WebhookRouteParams }>,
  reply: FastifyReply
): Promise<void> {
  const traceId = uuidv4();
  const tenantId = request.params.tenant_id;
  
  try {
    // Get raw body for signature verification
    const rawBody = request.rawBody || JSON.stringify(request.body);
    const signature = request.headers['stripe-signature'] as string;
    
    // Verify webhook signature (in production)
    // const stripe = getStripeClient(tenantId);
    // const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    
    // Parse and validate event
    const parseResult = StripeWebhookEventSchema.safeParse(request.body);
    
    if (!parseResult.success) {
      request.log.error({ traceId, error: parseResult.error }, 'Invalid webhook payload');
      reply.status(HTTP_STATUS.BAD_REQUEST).send({
        error: ERROR_MESSAGES.WEBHOOK_PARSE_ERROR,
        trace_id: traceId,
      });
      return;
    }
    
    const stripeEvent = parseResult.data;
    const eventId = stripeEvent.id;
    
    request.log.info({ traceId, eventId, type: stripeEvent.type }, 'Received Stripe webhook');
    
    // Check for duplicate event (idempotency)
    const existingEvent = await query<PaymentEventRow>(
      'SELECT id FROM payment_events WHERE tenant_id = $1 AND event_id = $2',
      [tenantId, eventId]
    );
    
    if (existingEvent.rows.length > 0) {
      request.log.info({ traceId, eventId }, 'Duplicate event, already processed');
      reply.status(HTTP_STATUS.OK).send({
        received: true,
        event_id: eventId,
        trace_id: traceId,
        duplicate: true,
      });
      return;
    }
    
    // Only process payment failure events for now
    if (!stripeEvent.type.startsWith('payment_intent.')) {
      reply.status(HTTP_STATUS.OK).send({
        received: true,
        event_id: eventId,
        trace_id: traceId,
        skipped: true,
        reason: 'Event type not processed',
      });
      return;
    }
    
    // Normalize the event
    const normalizedEvent = normalizeStripeEvent(stripeEvent, tenantId);
    
    // Save to database
    await savePaymentEvent(normalizedEvent);
    
    // Queue for async processing (would add to BullMQ here)
    // await queueForProcessing(normalizedEvent, traceId);
    
    // Immediate ACK - processing happens async
    reply.status(HTTP_STATUS.OK).send({
      received: true,
      event_id: eventId,
      trace_id: traceId,
    });
    
  } catch (error) {
    request.log.error({ traceId, error }, 'Webhook processing error');
    reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: 'Webhook processing failed',
      trace_id: traceId,
    });
  }
}

/**
 * Normalize Stripe event to our internal format
 */
function normalizeStripeEvent(
  stripeEvent: { id: string; type: string; data: { object: Record<string, unknown> }; created: number },
  tenantId: string
): NormalizedPaymentEvent {
  const paymentIntent = stripeEvent.data.object as Record<string, unknown>;
  const lastPaymentError = paymentIntent.last_payment_error as Record<string, unknown> | undefined;
  
  // Extract status
  let status: PaymentStatus = 'pending';
  if (stripeEvent.type === 'payment_intent.succeeded') {
    status = 'succeeded';
  } else if (stripeEvent.type === 'payment_intent.payment_failed') {
    status = 'failed';
  } else if (stripeEvent.type === 'payment_intent.canceled') {
    status = 'canceled';
  }
  
  // Extract decline code
  const declineCode = lastPaymentError?.decline_code as string | undefined;
  const failureReason = lastPaymentError?.code as string | undefined;
  const failureMessage = lastPaymentError?.message as string | undefined;
  
  return {
    id: uuidv4(),
    event_id: stripeEvent.id,
    tenant_id: tenantId,
    payment_intent_id: paymentIntent.id as string,
    customer_id: paymentIntent.customer as string | undefined,
    amount: paymentIntent.amount as number,
    currency: (paymentIntent.currency as string).toUpperCase(),
    status,
    decline_code: declineCode,
    failure_reason: failureReason,
    failure_message: failureMessage,
    psp: 'stripe' as PSPType,
    raw_event: paymentIntent,
    metadata: paymentIntent.metadata as Record<string, unknown> | undefined,
    created_at: new Date(stripeEvent.created * 1000),
  };
}

/**
 * Save payment event to database
 */
async function savePaymentEvent(event: NormalizedPaymentEvent): Promise<void> {
  await query(
    `INSERT INTO payment_events (
      id, event_id, tenant_id, payment_intent_id, customer_id,
      amount_cents, currency, status, decline_code, failure_reason,
      failure_message, psp, raw_event, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      event.id,
      event.event_id,
      event.tenant_id,
      event.payment_intent_id,
      event.customer_id,
      event.amount,
      event.currency,
      event.status,
      event.decline_code,
      event.failure_reason,
      event.failure_message,
      event.psp,
      JSON.stringify(event.raw_event),
      JSON.stringify(event.metadata || {}),
      event.created_at,
    ]
  );
}

/**
 * Get Stripe client for tenant (would fetch API key from secure storage)
 */
function getStripeClient(tenantId: string): Stripe {
  // In production, fetch API key from encrypted storage
  const apiKey = process.env.STRIPE_API_KEY || 'sk_test_placeholder';
  return new Stripe(apiKey, { apiVersion: '2024-12-18.acacia' });
}