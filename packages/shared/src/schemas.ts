// ============================================================================
// Zod Schemas for Validation - Agentic Payment System
// ============================================================================

import { z } from 'zod';

// ----------------------------------------------------------------------------
// Base Schemas
// ----------------------------------------------------------------------------

export const PSPTypeSchema = z.enum(['stripe', 'adyen', 'cybersource', 'braintree']);
export const PaymentStatusSchema = z.enum(['succeeded', 'failed', 'pending', 'canceled']);

export const FailureTypeSchema = z.enum([
  'insufficient_funds',
  'card_expired',
  'card_declined',
  'bank_decline',
  'risk_blocked',
  '3ds_failed',
  '3ds_required',
  'invalid_card',
  'lost_card',
  'stolen_card',
  'generic_decline',
  'unknown',
]);

export const FailureCategorySchema = z.enum(['soft', 'hard', 'risk', '3ds']);

export const ActionTypeSchema = z.enum([
  'retry_soft_decline',
  'retry_with_delay',
  'send_outreach',
  'trigger_3ds',
  'reroute_psp',
  'escalate',
  'update_payment_method',
  'cancel_subscription',
]);

export const ActionStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'executing',
  'succeeded',
  'failed',
  'rolled_back',
]);

export const AutonomyModeSchema = z.enum(['auto', 'approve', 'manual']);

// ----------------------------------------------------------------------------
// Payment Event Schemas
// ----------------------------------------------------------------------------

export const NormalizedPaymentEventSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().min(1),
  tenant_id: z.string().uuid(),
  payment_intent_id: z.string().min(1),
  customer_id: z.string().optional(),
  amount: z.number().int().positive(),
  currency: z.string().length(3),
  status: PaymentStatusSchema,
  decline_code: z.string().optional(),
  failure_reason: z.string().optional(),
  failure_message: z.string().optional(),
  psp: PSPTypeSchema,
  psp_account_id: z.string().optional(),
  raw_event: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.coerce.date(),
  processed_at: z.coerce.date().optional(),
});

export const NormalizedPaymentEventInsertSchema = NormalizedPaymentEventSchema.omit({
  id: true,
  created_at: true,
  processed_at: true,
});

// ----------------------------------------------------------------------------
// Mandate Schemas
// ----------------------------------------------------------------------------

export const PrincipalSchema = z.object({
  type: z.enum(['merchant', 'customer', 'system']),
  id: z.string().min(1),
});

export const AgentSchema = z.object({
  type: z.enum(['system', 'user']),
  id: z.string().min(1),
});

export const MandateScopeSchema = z.object({
  actions: z.array(ActionTypeSchema).min(1),
  max_retry_count: z.number().int().min(0).max(10),
  max_amount_usd: z.number().positive(),
  require_3ds_acknowledgment: z.boolean(),
  validity_until: z.coerce.date(),
});

export const RiskThresholdsSchema = z.object({
  step_up_above_usd: z.number().positive(),
});

export const MandateSchema = z.object({
  mandate_id: z.string().min(1),
  schema_version: z.literal('1.0'),
  principal: PrincipalSchema,
  agent: AgentSchema,
  scope: MandateScopeSchema,
  risk_thresholds: RiskThresholdsSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  created_by: z.string().min(1),
});

export const MandateCreateSchema = MandateSchema.omit({
  created_at: true,
  updated_at: true,
});

// ----------------------------------------------------------------------------
// Failure Classification Schemas
// ----------------------------------------------------------------------------

export const FailureClassificationSchema = z.object({
  payment_event_id: z.string().uuid(),
  failure_type: FailureTypeSchema,
  failure_category: FailureCategorySchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  source: z.enum(['rules', 'llm', 'hybrid']),
  context_used: z.array(z.string()),
  created_at: z.coerce.date(),
});

// ----------------------------------------------------------------------------
// Action Schemas
// ----------------------------------------------------------------------------

export const ActionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  payment_event_id: z.string().uuid(),
  mandate_id: z.string().min(1),
  action_type: ActionTypeSchema,
  status: ActionStatusSchema,
  autonomy_mode: AutonomyModeSchema,
  params: z.record(z.unknown()),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  reasoning: z.string().min(1),
  confidence: z.number().min(0).max(1),
  trace_id: z.string().uuid(),
  created_at: z.coerce.date(),
  executed_at: z.coerce.date().optional(),
  completed_at: z.coerce.date().optional(),
});

export const ActionCreateSchema = ActionSchema.omit({
  id: true,
  created_at: true,
  executed_at: true,
  completed_at: true,
});

// ----------------------------------------------------------------------------
// Playbook Schemas
// ----------------------------------------------------------------------------

export const PlaybookRuleConditionSchema = z.object({
  failure_types: z.array(FailureTypeSchema).optional(),
  failure_categories: z.array(FailureCategorySchema).optional(),
  retry_count_max: z.number().int().min(0).optional(),
  retry_count_min: z.number().int().min(0).optional(),
  amount_max: z.number().int().positive().optional(),
  amount_min: z.number().int().nonnegative().optional(),
  payroll_day_proximity_min: z.number().min(0).max(1).optional(),
  customer_segment: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
});

export const PlaybookRuleActionSchema = z.object({
  type: ActionTypeSchema,
  params: z.record(z.unknown()),
});

export const PlaybookRuleSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().min(1),
  enabled: z.boolean(),
  conditions: PlaybookRuleConditionSchema,
  action: PlaybookRuleActionSchema,
  autonomy_mode: AutonomyModeSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const PlaybookRuleCreateSchema = PlaybookRuleSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// ----------------------------------------------------------------------------
// Audit Log Schemas
// ----------------------------------------------------------------------------

export const AuditLogEntrySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  payment_intent_id: z.string().optional(),
  action_id: z.string().uuid().optional(),
  action_type: ActionTypeSchema.optional(),
  trace_id: z.string().uuid(),
  input: z.record(z.unknown()),
  output: z.record(z.unknown()).optional(),
  rationale: z.string().optional(),
  previous_hash: z.string().length(64),
  current_hash: z.string().length(64),
  created_at: z.coerce.date(),
});

// ----------------------------------------------------------------------------
// Stripe Webhook Schemas
// ----------------------------------------------------------------------------

export const StripeWebhookEventSchema = z.object({
  id: z.string().min(1),
  object: z.literal('event'),
  type: z.string().min(1),
  data: z.object({
    object: z.record(z.unknown()),
  }),
  created: z.number(),
  livemode: z.boolean(),
});

// ----------------------------------------------------------------------------
// API Request/Response Schemas
// ----------------------------------------------------------------------------

export const WebhookAckResponseSchema = z.object({
  received: z.literal(true),
  event_id: z.string(),
  trace_id: z.string().uuid(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  trace_id: z.string().uuid().optional(),
});

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

export const RepairQueueQuerySchema = PaginationQuerySchema.extend({
  status: ActionStatusSchema.optional(),
  failure_type: FailureTypeSchema.optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
});

// ----------------------------------------------------------------------------
// Mandate Validation Result
// ----------------------------------------------------------------------------

export const MandateValidationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.enum([
    'action_not_allowed',
    'amount_exceeded',
    'mandate_expired',
    'retry_count_exceeded',
    '3ds_acknowledgment_required',
  ]).optional(),
  mandate_id: z.string(),
});

// ----------------------------------------------------------------------------
// Circuit Breaker Schemas
// ----------------------------------------------------------------------------

export const CircuitStateSchema = z.enum(['closed', 'open', 'half_open']);

export const CircuitBreakerStatusSchema = z.object({
  tenant_id: z.string().uuid(),
  action_type: ActionTypeSchema,
  state: CircuitStateSchema,
  failure_count: z.number().int().min(0),
  success_count: z.number().int().min(0),
  last_failure_at: z.coerce.date().optional(),
  last_state_change_at: z.coerce.date(),
  threshold_percentage: z.number().min(0).max(100),
  threshold_window_minutes: z.number().int().min(1),
});