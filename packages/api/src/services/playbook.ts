// ============================================================================
// Playbook Engine Service - Rule-based action selection
// ============================================================================

import { query } from '../db/index.js';
import {
  PlaybookRule,
  PlaybookEvaluation,
  FailureClassification,
  NormalizedPaymentEvent,
  ActionType,
  AutonomyMode,
  PaymentFailureHistory,
} from '@agentic-payment/shared';
import { ERROR_MESSAGES } from '@agentic-payment/shared';

interface PlaybookRuleRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  conditions: Record<string, unknown>;
  action: Record<string, unknown>;
  autonomy_mode: string;
  created_at: Date;
  updated_at: Date;
}

interface FailureHistoryRow {
  id: string;
  tenant_id: string;
  payment_intent_id: string;
  original_payment_event_id: string;
  retry_count: number;
  last_action_type: string;
  last_action_outcome: string;
  total_amount_recovered_cents: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get all enabled playbook rules for a tenant, sorted by priority
 */
export async function getPlaybookRules(tenantId: string): Promise<PlaybookRule[]> {
  const result = await query<PlaybookRuleRow>(
    `SELECT * FROM playbook_rules 
     WHERE tenant_id = $1 AND enabled = true
     ORDER BY priority DESC`,
    [tenantId]
  );
  
  return result.rows.map(row => ({
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    description: row.description,
    priority: row.priority,
    enabled: row.enabled,
    conditions: row.conditions as PlaybookRule['conditions'],
    action: row.action as PlaybookRule['action'],
    autonomy_mode: row.autonomy_mode as AutonomyMode,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Get or create failure history for a payment intent
 */
export async function getFailureHistory(
  tenantId: string,
  paymentIntentId: string,
  originalPaymentEventId: string
): Promise<PaymentFailureHistory> {
  const result = await query<FailureHistoryRow>(
    `SELECT * FROM payment_failure_history 
     WHERE tenant_id = $1 AND payment_intent_id = $2`,
    [tenantId, paymentIntentId]
  );
  
  if (result.rows.length > 0) {
    const row = result.rows[0];
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      payment_intent_id: row.payment_intent_id,
      original_payment_event_id: row.original_payment_event_id,
      retry_count: row.retry_count,
      last_action_type: row.last_action_type as ActionType,
      last_action_outcome: row.last_action_outcome as 'success' | 'failure' | 'pending',
      total_amount_recovered: row.total_amount_recovered_cents,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
  
  // Create new failure history
  const insertResult = await query<FailureHistoryRow>(
    `INSERT INTO payment_failure_history (
      tenant_id, payment_intent_id, original_payment_event_id, retry_count
    ) VALUES ($1, $2, $3, 0)
    RETURNING *`,
    [tenantId, paymentIntentId, originalPaymentEventId]
  );
  
  const row = insertResult.rows[0];
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    payment_intent_id: row.payment_intent_id,
    original_payment_event_id: row.original_payment_event_id,
    retry_count: row.retry_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Increment retry count for a payment intent
 */
export async function incrementRetryCount(
  tenantId: string,
  paymentIntentId: string,
  actionType: ActionType,
  outcome: 'success' | 'failure' | 'pending'
): Promise<void> {
  await query(
    `UPDATE payment_failure_history 
     SET retry_count = retry_count + 1,
         last_action_type = $3,
         last_action_outcome = $4,
         updated_at = NOW()
     WHERE tenant_id = $1 AND payment_intent_id = $2`,
    [tenantId, paymentIntentId, actionType, outcome]
  );
}

/**
 * Check if a rule matches the given conditions
 */
function ruleMatches(
  rule: PlaybookRule,
  classification: FailureClassification,
  event: NormalizedPaymentEvent,
  history: PaymentFailureHistory
): boolean {
  const conditions = rule.conditions;
  
  // Check failure types
  if (conditions.failure_types && conditions.failure_types.length > 0) {
    if (!conditions.failure_types.includes(classification.failure_type)) {
      return false;
    }
  }
  
  // Check failure categories
  if (conditions.failure_categories && conditions.failure_categories.length > 0) {
    if (!conditions.failure_categories.includes(classification.failure_category)) {
      return false;
    }
  }
  
  // Check retry count max
  if (conditions.retry_count_max !== undefined) {
    if (history.retry_count > conditions.retry_count_max) {
      return false;
    }
  }
  
  // Check retry count min
  if (conditions.retry_count_min !== undefined) {
    if (history.retry_count < conditions.retry_count_min) {
      return false;
    }
  }
  
  // Check amount max (in cents)
  if (conditions.amount_max !== undefined) {
    if (event.amount > conditions.amount_max) {
      return false;
    }
  }
  
  // Check amount min (in cents)
  if (conditions.amount_min !== undefined) {
    if (event.amount < conditions.amount_min) {
      return false;
    }
  }
  
  // Check payroll day proximity (simplified - would need actual calculation)
  if (conditions.payroll_day_proximity_min !== undefined) {
    const proximity = calculatePayrollProximity();
    if (proximity < conditions.payroll_day_proximity_min) {
      return false;
    }
  }
  
  // Check countries
  if (conditions.countries && conditions.countries.length > 0) {
    // Would need to get country from customer data
    // For now, skip this check
  }
  
  // Check customer segment
  if (conditions.customer_segment && conditions.customer_segment.length > 0) {
    // Would need to get segment from customer data
    // For now, skip this check
  }
  
  return true;
}

/**
 * Calculate proximity to typical payroll days (1st and 15th)
 * Returns 0.0 - 1.0 where 1.0 is on payroll day
 */
function calculatePayrollProximity(): number {
  const now = new Date();
  const dayOfMonth = now.getDate();
  
  // Check proximity to 1st or 15th
  const distTo1st = Math.min(dayOfMonth, 32 - dayOfMonth);
  const distTo15th = Math.abs(dayOfMonth - 15);
  
  const minDist = Math.min(distTo1st, distTo15th);
  
  // 0 days = 1.0, 7+ days = 0.0
  return Math.max(0, 1 - minDist / 7);
}

/**
 * Evaluate playbook rules and select action
 */
export async function evaluatePlaybook(
  tenantId: string,
  event: NormalizedPaymentEvent,
  classification: FailureClassification
): Promise<PlaybookEvaluation> {
  // Get playbook rules
  const rules = await getPlaybookRules(tenantId);
  
  // Get failure history
  const history = await getFailureHistory(tenantId, event.payment_intent_id, event.id);
  
  // Find matching rules
  const matchedRules: PlaybookRule[] = [];
  
  for (const rule of rules) {
    if (ruleMatches(rule, classification, event, history)) {
      matchedRules.push(rule);
    }
  }
  
  // No matching rule - escalate to human
  if (matchedRules.length === 0) {
    return {
      payment_event_id: event.id,
      matched_rules: [],
      no_match_reason: ERROR_MESSAGES.PLAYBOOK_NO_MATCH,
      evaluated_at: new Date(),
    };
  }
  
  // Select highest priority rule (already sorted by priority DESC)
  const selectedRule = matchedRules[0];
  
  return {
    payment_event_id: event.id,
    matched_rules: matchedRules,
    selected_rule: selectedRule,
    evaluated_at: new Date(),
  };
}

/**
 * Create a new playbook rule
 */
export async function createPlaybookRule(
  tenantId: string,
  rule: Omit<PlaybookRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>
): Promise<PlaybookRule> {
  const result = await query<PlaybookRuleRow>(
    `INSERT INTO playbook_rules (
      tenant_id, name, description, priority, enabled, conditions, action, autonomy_mode
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      tenantId,
      rule.name,
      rule.description || null,
      rule.priority,
      rule.enabled,
      JSON.stringify(rule.conditions),
      JSON.stringify(rule.action),
      rule.autonomy_mode,
    ]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    description: row.description,
    priority: row.priority,
    enabled: row.enabled,
    conditions: row.conditions as PlaybookRule['conditions'],
    action: row.action as PlaybookRule['action'],
    autonomy_mode: row.autonomy_mode as AutonomyMode,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Update a playbook rule
 */
export async function updatePlaybookRule(
  ruleId: string,
  updates: Partial<Omit<PlaybookRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>
): Promise<PlaybookRule | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;
  
  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.priority !== undefined) {
    setClauses.push(`priority = $${paramIndex++}`);
    values.push(updates.priority);
  }
  if (updates.enabled !== undefined) {
    setClauses.push(`enabled = $${paramIndex++}`);
    values.push(updates.enabled);
  }
  if (updates.conditions !== undefined) {
    setClauses.push(`conditions = $${paramIndex++}`);
    values.push(JSON.stringify(updates.conditions));
  }
  if (updates.action !== undefined) {
    setClauses.push(`action = $${paramIndex++}`);
    values.push(JSON.stringify(updates.action));
  }
  if (updates.autonomy_mode !== undefined) {
    setClauses.push(`autonomy_mode = $${paramIndex++}`);
    values.push(updates.autonomy_mode);
  }
  
  setClauses.push(`updated_at = NOW()`);
  values.push(ruleId);
  
  const result = await query<PlaybookRuleRow>(
    `UPDATE playbook_rules SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    description: row.description,
    priority: row.priority,
    enabled: row.enabled,
    conditions: row.conditions as PlaybookRule['conditions'],
    action: row.action as PlaybookRule['action'],
    autonomy_mode: row.autonomy_mode as AutonomyMode,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}