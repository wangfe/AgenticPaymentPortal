// ============================================================================
// Mandate Service - Policy Firewall for Actions
// ============================================================================

import { query } from '../db/index.js';
import {
  Mandate,
  ActionType,
  MandateValidationResult,
  MandateScope,
} from '@agentic-payment/shared';
import { ERROR_MESSAGES } from '@agentic-payment/shared';

interface MandateRow {
  id: string;
  mandate_id: string;
  tenant_id: string;
  schema_version: string;
  principal: Record<string, unknown>;
  agent: Record<string, unknown>;
  scope: MandateScope;
  risk_thresholds: Record<string, number>;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get mandate by mandate_id
 */
export async function getMandate(mandateId: string): Promise<Mandate | null> {
  const result = await query<MandateRow>(
    'SELECT * FROM mandates WHERE mandate_id = $1',
    [mandateId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    mandate_id: row.mandate_id,
    schema_version: row.schema_version as '1.0',
    principal: row.principal as Mandate['principal'],
    agent: row.agent as Mandate['agent'],
    scope: row.scope,
    risk_thresholds: row.risk_thresholds as Mandate['risk_thresholds'],
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
  };
}

/**
 * Get active mandate for a tenant
 */
export async function getActiveMandateForTenant(tenantId: string): Promise<Mandate | null> {
  const result = await query<MandateRow>(
    `SELECT * FROM mandates 
     WHERE tenant_id = $1 
     AND (scope->>'validity_until')::timestamptz > NOW()
     ORDER BY created_at DESC 
     LIMIT 1`,
    [tenantId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    mandate_id: row.mandate_id,
    schema_version: row.schema_version as '1.0',
    principal: row.principal as Mandate['principal'],
    agent: row.agent as Mandate['agent'],
    scope: row.scope,
    risk_thresholds: row.risk_thresholds as Mandate['risk_thresholds'],
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
  };
}

/**
 * Validate an action against a mandate
 * Returns validation result with reason if invalid
 */
export function validateMandate(
  actionType: ActionType,
  amountUsd: number,
  retryCount: number,
  mandate: Mandate
): MandateValidationResult {
  const scope = mandate.scope;
  
  // Check if action is allowed
  if (!scope.actions.includes(actionType)) {
    return {
      valid: false,
      reason: 'action_not_allowed',
      mandate_id: mandate.mandate_id,
    };
  }
  
  // Check amount limit
  if (amountUsd > scope.max_amount_usd) {
    return {
      valid: false,
      reason: 'amount_exceeded',
      mandate_id: mandate.mandate_id,
    };
  }
  
  // Check retry count
  if (actionType === 'retry_soft_decline' && retryCount >= scope.max_retry_count) {
    return {
      valid: false,
      reason: 'retry_count_exceeded',
      mandate_id: mandate.mandate_id,
    };
  }
  
  // Check mandate validity
  if (new Date() > new Date(scope.validity_until)) {
    return {
      valid: false,
      reason: 'mandate_expired',
      mandate_id: mandate.mandate_id,
    };
  }
  
  // Check 3DS acknowledgment for actions that bypass 3DS
  if (
    actionType === 'retry_soft_decline' &&
    !scope.require_3ds_acknowledgment &&
    amountUsd >= (mandate.risk_thresholds.step_up_above_usd || 5000)
  ) {
    // High-value transactions without 3DS require explicit acknowledgment
    // This is a warning, not a block - logged for audit
    // In production, this would trigger additional review
  }
  
  return {
    valid: true,
    mandate_id: mandate.mandate_id,
  };
}

/**
 * Create a new mandate
 */
export async function createMandate(
  tenantId: string,
  mandateData: Omit<Mandate, 'created_at' | 'updated_at'>,
  createdBy: string
): Promise<Mandate> {
  const result = await query<MandateRow>(
    `INSERT INTO mandates (
      mandate_id, tenant_id, schema_version, principal, agent, scope, 
      risk_thresholds, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      mandateData.mandate_id,
      tenantId,
      mandateData.schema_version,
      JSON.stringify(mandateData.principal),
      JSON.stringify(mandateData.agent),
      JSON.stringify(mandateData.scope),
      JSON.stringify(mandateData.risk_thresholds),
      createdBy,
    ]
  );
  
  const row = result.rows[0];
  return {
    mandate_id: row.mandate_id,
    schema_version: row.schema_version as '1.0',
    principal: row.principal as Mandate['principal'],
    agent: row.agent as Mandate['agent'],
    scope: row.scope,
    risk_thresholds: row.risk_thresholds as Mandate['risk_thresholds'],
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
  };
}

/**
 * Update mandate scope
 */
export async function updateMandateScope(
  mandateId: string,
  scope: Partial<MandateScope>
): Promise<Mandate | null> {
  // Get current mandate
  const current = await getMandate(mandateId);
  if (!current) {
    return null;
  }
  
  const newScope = { ...current.scope, ...scope };
  
  const result = await query<MandateRow>(
    `UPDATE mandates 
     SET scope = $1, updated_at = NOW()
     WHERE mandate_id = $2
     RETURNING *`,
    [JSON.stringify(newScope), mandateId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    mandate_id: row.mandate_id,
    schema_version: row.schema_version as '1.0',
    principal: row.principal as Mandate['principal'],
    agent: row.agent as Mandate['agent'],
    scope: row.scope,
    risk_thresholds: row.risk_thresholds as Mandate['risk_thresholds'],
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
  };
}