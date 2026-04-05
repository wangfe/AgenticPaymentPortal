// ============================================================================
// Database Connection - Agentic Payment System
// ============================================================================

import pg from 'pg';
import { Pool, PoolClient, QueryResult } from 'pg';

const { Pool: PgPool } = pg;

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'agentic_payment',
  user: process.env.DB_USER || 'agentic',
  password: process.env.DB_PASSWORD || 'agentic_dev_password',
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Singleton pool instance
let pool: Pool | null = null;

/**
 * Get the database pool instance
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new PgPool(DB_CONFIG);
    
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }
  return pool;
}

/**
 * Execute a query with the pool
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(sql, params);
}

/**
 * Execute a query within a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the database pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Re-export types
export type { Pool, PoolClient, QueryResult };