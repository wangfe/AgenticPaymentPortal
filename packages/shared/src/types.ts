// ============================================================================
// Core Domain Types - Agentic Payment System
// ============================================================================

// ----------------------------------------------------------------------------
// Tenant & Identity
// ----------------------------------------------------------------------------

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  context_readiness: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Principal {
  type: 'merchant' | 'customer' | 'system';
  id: string;
}

export interface Agent {
  type: 'system' | 'user';
  id: string;
}

// ----------------------------------------------------------------------------
// Payment Events (PSP-agnostic)
// ----------------------------------------------------------------------------

export type PSPType = 'stripe' | 'adyen' | 'cybersource' | 'braintree';

export type PaymentStatus = 'succeeded' | 'failed' | 'pending' | 'canceled';

export interface NormalizedPaymentEvent {
  id: string;                    // Internal UUID
  event_id: string;              // PSP event ID (idempotency key)
  tenant_id: string;
  payment_intent_id: string;
  customer_id?: string;
  amount: number;                // In cents
  currency: string;              // ISO 4217
  status: PaymentStatus;
  decline_code?: string;
  failure_reason?: string;
  failure_message?: string;
  psp: PSPType;
  psp_account_id?: string;
  raw_event: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: Date;
  processed_at?: Date;
}

// ----------------------------------------------------------------------------
// Failure Classification
// ----------------------------------------------------------------------------

export type FailureType = 
  | 'insufficient_funds'
  | 'card_expired'
  | 'card_declined'
  | 'bank_decline'
  | 'risk_blocked'
  | '3ds_failed'
  | '3ds_required'
  | 'invalid_card'
  | 'lost_card'
  | 'stolen_card'
  | 'generic_decline'
  | 'unknown';

export type FailureCategory = 'soft' | 'hard' | 'risk' | '3ds';

export interface FailureClassification {
  payment_event_id: string;
  failure_type: FailureType;
  failure_category: FailureCategory;
  confidence: number;           // 0.0 - 1.0
  reasoning: string;
  source: 'rules' | 'llm' | 'hybrid';
  context_used: string[];
  created_at: Date;
}

// ----------------------------------------------------------------------------
// Mandate (Authorization Layer)
// ----------------------------------------------------------------------------

export interface MandateScope {
  actions: ActionType[];
  max_retry_count: number;
  max_amount_usd: number;
  require_3ds_acknowledgment: boolean;
  validity_until: Date;
}

export interface RiskThresholds {
  step_up_above_usd: number;
}

export interface Mandate {
  mandate_id: string;
  schema_version: '1.0';
  principal: Principal;
  agent: Agent;
  scope: MandateScope;
  risk_thresholds: RiskThresholds;
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

// ----------------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------------

export type ActionType = 
  | 'retry_soft_decline'
  | 'retry_with_delay'
  | 'send_outreach'
  | 'trigger_3ds'
  | 'reroute_psp'
  | 'escalate'
  | 'update_payment_method'
  | 'cancel_subscription';

export type ActionStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'rolled_back';

export type AutonomyMode = 'auto' | 'approve' | 'manual';

export interface Action {
  id: string;
  tenant_id: string;
  payment_event_id: string;
  mandate_id: string;
  action_type: ActionType;
  status: ActionStatus;
  autonomy_mode: AutonomyMode;
  params: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  reasoning: string;
  confidence: number;
  trace_id: string;
  created_at: Date;
  executed_at?: Date;
  completed_at?: Date;
}

// ----------------------------------------------------------------------------
// Playbook Engine
// ----------------------------------------------------------------------------

export interface PlaybookRuleCondition {
  failure_types?: FailureType[];
  failure_categories?: FailureCategory[];
  retry_count_max?: number;
  retry_count_min?: number;
  amount_max?: number;
  amount_min?: number;
  payroll_day_proximity_min?: number;  // 0.0 - 1.0
  customer_segment?: string[];
  countries?: string[];
}

export interface PlaybookRuleAction {
  type: ActionType;
  params: Record<string, unknown>;
}

export interface PlaybookRule {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  conditions: PlaybookRuleCondition;
  action: PlaybookRuleAction;
  autonomy_mode: AutonomyMode;
  created_at: Date;
  updated_at: Date;
}

export interface PlaybookEvaluation {
  payment_event_id: string;
  matched_rules: PlaybookRule[];
  selected_rule?: PlaybookRule;
  action?: Action;
  no_match_reason?: string;
  evaluated_at: Date;
}

// ----------------------------------------------------------------------------
// Payment Failure History
// ----------------------------------------------------------------------------

export interface PaymentFailureHistory {
  id: string;
  tenant_id: string;
  payment_intent_id: string;
  original_payment_event_id: string;
  retry_count: number;
  last_action_type?: ActionType;
  last_action_outcome?: 'success' | 'failure' | 'pending';
  total_amount_recovered?: number;
  created_at: Date;
  updated_at: Date;
}

// ----------------------------------------------------------------------------
// Audit Log
// ----------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  payment_intent_id?: string;
  action_id?: string;
  action_type?: ActionType;
  trace_id: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  rationale?: string;
  previous_hash: string;
  current_hash: string;
  created_at: Date;
}

// ----------------------------------------------------------------------------
// Context Connectors
// ----------------------------------------------------------------------------

export type ConnectorType = 'shopify' | 'salesforce' | 'hubspot' | 'zendesk' | 'stripe';

export interface ConnectorConfig {
  id: string;
  tenant_id: string;
  connector_type: ConnectorType;
  enabled: boolean;
  config: Record<string, unknown>;
  last_sync_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface EnrichedContext {
  payment_event_id: string;
  tenant_id: string;
  order_data?: Record<string, unknown>;
  customer_data?: Record<string, unknown>;
  support_data?: Record<string, unknown>;
  enrichment_sources: ConnectorType[];
  enrichment_errors?: string[];
  enriched_at: Date;
}

// ----------------------------------------------------------------------------
// Circuit Breaker
// ----------------------------------------------------------------------------

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerStatus {
  tenant_id: string;
  action_type: ActionType;
  state: CircuitState;
  failure_count: number;
  success_count: number;
  last_failure_at?: Date;
  last_state_change_at: Date;
  threshold_percentage: number;
  threshold_window_minutes: number;
}

// ----------------------------------------------------------------------------
// Human-in-the-Loop (HITL)
// ----------------------------------------------------------------------------

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ApprovalRequest {
  id: string;
  tenant_id: string;
  action_id: string;
  requested_by: string;
  requested_at: Date;
  status: ApprovalStatus;
  reviewed_by?: string;
  reviewed_at?: Date;
  review_notes?: string;
  expires_at: Date;
}

// ----------------------------------------------------------------------------
// Metrics & Observability
// ----------------------------------------------------------------------------

export interface PipelineMetrics {
  webhook_received_count: number;
  webhook_processed_count: number;
  webhook_failed_count: number;
  classification_count: number;
  classification_llm_fallback_count: number;
  action_executed_count: number;
  action_failed_count: number;
  recovery_success_count: number;
  recovery_amount_cents: number;
  mean_time_to_repair_ms: number;
}

export interface BusinessMetrics {
  at_risk_mrr_cents: number;
  recovered_mrr_cents: number;
  recovery_rate_percentage: number;
  mean_time_to_repair_hours: number;
  dollars_recovered_cents: number;
}