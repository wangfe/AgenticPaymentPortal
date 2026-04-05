// ============================================================================
// Failure Classifier Service - Maps decline codes to failure types
// ============================================================================

import { query } from '../db/index.js';
import {
  FailureType,
  FailureCategory,
  FailureClassification,
  NormalizedPaymentEvent,
  STRIPE_DECLINE_CODE_MAP,
  UNKNOWN_DECLINE,
  CONFIDENCE_FLOOR_PROCEED,
} from '@agentic-payment/shared';
import { v4 as uuidv4 } from 'uuid';

interface ClassificationRow {
  id: string;
  payment_event_id: string;
  tenant_id: string;
  failure_type: string;
  failure_category: string;
  confidence: number;
  reasoning: string;
  source: string;
  context_used: string[];
  created_at: Date;
}

/**
 * Classify a payment failure using rules engine
 * Returns classification with confidence score
 */
export function classifyFailureRuleBased(
  event: NormalizedPaymentEvent
): FailureClassification {
  const declineCode = event.decline_code?.toLowerCase() || '';
  
  // Look up decline code in our mapping
  const mapping = STRIPE_DECLINE_CODE_MAP[declineCode] || UNKNOWN_DECLINE;
  
  // Build reasoning
  const reasoning = buildReasoning(event, mapping);
  
  // Determine confidence based on specificity
  let confidence = 0.85; // Base confidence for known codes
  
  // Lower confidence for generic declines
  if (mapping.failure_type === 'generic_decline' || mapping.failure_type === 'unknown') {
    confidence = 0.60;
  }
  
  // Higher confidence for specific bank messages
  if (event.failure_message && event.failure_message.length > 10) {
    confidence = Math.min(confidence + 0.05, 0.95);
  }
  
  return {
    payment_event_id: event.id,
    failure_type: mapping.failure_type,
    failure_category: mapping.failure_category,
    confidence,
    reasoning,
    source: 'rules',
    context_used: ['psp_event'],
    created_at: new Date(),
  };
}

/**
 * Classify with LLM fallback for ambiguous cases
 * Currently returns rules-based classification
 * TODO: Integrate LLM for ambiguous decline codes
 */
export async function classifyFailure(
  event: NormalizedPaymentEvent,
  enrichedContext?: Record<string, unknown>
): Promise<FailureClassification> {
  // Start with rules-based classification
  const ruleClassification = classifyFailureRuleBased(event);
  
  // If confidence is high enough, use rules result
  if (ruleClassification.confidence >= CONFIDENCE_FLOOR_PROCEED) {
    return ruleClassification;
  }
  
  // For low confidence, we would call LLM here
  // For now, escalate to human review
  return {
    ...ruleClassification,
    reasoning: `${ruleClassification.reasoning} [LOW_CONFIDENCE: Requires human review]`,
    source: 'rules',
  };
}

/**
 * Build human-readable reasoning for classification
 */
function buildReasoning(
  event: NormalizedPaymentEvent,
  mapping: { failure_type: FailureType; failure_category: FailureCategory; description: string }
): string {
  const parts: string[] = [];
  
  parts.push(`PSP: ${event.psp.toUpperCase()}`);
  parts.push(`Decline code: ${event.decline_code || 'unknown'}`);
  parts.push(`Classification: ${mapping.failure_type} (${mapping.failure_category})`);
  parts.push(`Description: ${mapping.description}`);
  
  if (event.failure_message) {
    parts.push(`Bank message: "${event.failure_message}"`);
  }
  
  parts.push(`Amount: ${event.currency} ${(event.amount / 100).toFixed(2)}`);
  
  return parts.join(' | ');
}

/**
 * Save classification to database
 */
export async function saveClassification(
  classification: FailureClassification,
  tenantId: string
): Promise<void> {
  await query(
    `INSERT INTO failure_classifications (
      payment_event_id, tenant_id, failure_type, failure_category,
      confidence, reasoning, source, context_used
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (payment_event_id) DO NOTHING`,
    [
      classification.payment_event_id,
      tenantId,
      classification.failure_type,
      classification.failure_category,
      classification.confidence,
      classification.reasoning,
      classification.source,
      JSON.stringify(classification.context_used),
    ]
  );
}

/**
 * Get classification for a payment event
 */
export async function getClassification(
  paymentEventId: string
): Promise<FailureClassification | null> {
  const result = await query<ClassificationRow>(
    'SELECT * FROM failure_classifications WHERE payment_event_id = $1',
    [paymentEventId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    payment_event_id: row.payment_event_id,
    failure_type: row.failure_type as FailureType,
    failure_category: row.failure_category as FailureCategory,
    confidence: row.confidence,
    reasoning: row.reasoning,
    source: row.source as 'rules' | 'llm' | 'hybrid',
    context_used: row.context_used,
    created_at: row.created_at,
  };
}

/**
 * Check if classification requires human escalation
 */
export function requiresHumanEscalation(classification: FailureClassification): boolean {
  return classification.confidence < CONFIDENCE_FLOOR_PROCEED;
}

/**
 * Get failure type from Stripe event
 */
export function extractStripeDeclineCode(event: Record<string, unknown>): string | undefined {
  // Stripe payment_intent.payment_failed event
  const paymentIntent = event.data?.object as Record<string, unknown>;
  return paymentIntent?.last_payment_error?.decline_code as string | undefined;
}