// ============================================================================
// Constants - Agentic Payment System
// ============================================================================

// ----------------------------------------------------------------------------
// Stripe Decline Code Mapping
// ----------------------------------------------------------------------------

/**
 * Maps Stripe decline codes to our internal failure types
 * @see https://stripe.com/docs/declines/codes
 */
export const STRIPE_DECLINE_CODE_MAP: Record<string, {
  failure_type: import('./types').FailureType;
  failure_category: import('./types').FailureCategory;
  description: string;
}> = {
  // Soft declines - retry may succeed
  'insufficient_funds': {
    failure_type: 'insufficient_funds',
    failure_category: 'soft',
    description: 'Card has insufficient funds for this transaction',
  },
  'card_declined': {
    failure_type: 'card_declined',
    failure_category: 'soft',
    description: 'Generic card decline - may be temporary',
  },
  'do_not_honor': {
    failure_type: 'bank_decline',
    failure_category: 'soft',
    description: 'Bank declined without specific reason',
  },
  'generic_decline': {
    failure_type: 'generic_decline',
    failure_category: 'soft',
    description: 'Generic decline from the card network',
  },
  'lost_card': {
    failure_type: 'lost_card',
    failure_category: 'hard',
    description: 'Card reported as lost',
  },
  'stolen_card': {
    failure_type: 'stolen_card',
    failure_category: 'hard',
    description: 'Card reported as stolen',
  },
  'expired_card': {
    failure_type: 'card_expired',
    failure_category: 'hard',
    description: 'Card has expired',
  },
  'incorrect_cvc': {
    failure_type: 'invalid_card',
    failure_category: 'hard',
    description: 'CVC/CVV does not match',
  },
  'incorrect_number': {
    failure_type: 'invalid_card',
    failure_category: 'hard',
    description: 'Card number is incorrect',
  },
  'processing_error': {
    failure_type: 'generic_decline',
    failure_category: 'soft',
    description: 'Temporary processing error',
  },
  'issuer_not_available': {
    failure_type: 'bank_decline',
    failure_category: 'soft',
    description: 'Card issuer temporarily unavailable',
  },
  'try_again_later': {
    failure_type: 'bank_decline',
    failure_category: 'soft',
    description: 'Temporary decline - try again later',
  },
  'approve_with_id': {
    failure_type: 'bank_decline',
    failure_category: 'soft',
    description: 'Requires approval - may succeed on retry',
  },
  'card_velocity_exceeded': {
    failure_type: 'bank_decline',
    failure_category: 'soft',
    description: 'Card usage limit exceeded',
  },
  'restricted_card': {
    failure_type: 'card_declined',
    failure_category: 'hard',
    description: 'Card has restrictions',
  },
  'withdrawal_count_limit_exceeded': {
    failure_type: 'bank_decline',
    failure_category: 'soft',
    description: 'Withdrawal limit exceeded',
  },
  'service_not_allowed': {
    failure_type: 'bank_decline',
    failure_category: 'hard',
    description: 'Service not allowed for this card',
  },
  'transaction_not_allowed': {
    failure_type: 'bank_decline',
    failure_category: 'hard',
    description: 'Transaction type not allowed',
  },
  'fraudulent': {
    failure_type: 'risk_blocked',
    failure_category: 'risk',
    description: 'Blocked due to fraud detection',
  },
  'risk_blocked': {
    failure_type: 'risk_blocked',
    failure_category: 'risk',
    description: 'Blocked by risk rules',
  },
  'blocked': {
    failure_type: 'risk_blocked',
    failure_category: 'risk',
    description: 'Transaction blocked',
  },
};

// Default for unknown decline codes
export const UNKNOWN_DECLINE = {
  failure_type: 'unknown' as const,
  failure_category: 'soft' as const,
  description: 'Unknown decline reason',
};

// ----------------------------------------------------------------------------
// Confidence Thresholds
// ----------------------------------------------------------------------------

/** Minimum confidence to proceed with auto-execution */
export const CONFIDENCE_FLOOR_AUTO = 0.80;

/** Minimum confidence to proceed without human escalation */
export const CONFIDENCE_FLOOR_PROCEED = 0.60;

/** Confidence threshold for LLM fallback to rules-only */
export const CONFIDENCE_FLOOR_LLM = 0.50;

// ----------------------------------------------------------------------------
// Circuit Breaker Defaults
// ----------------------------------------------------------------------------

/** Failure rate percentage that triggers circuit open */
export const CIRCUIT_BREAKER_THRESHOLD_PERCENT = 20;

/** Time window in minutes for calculating failure rate */
export const CIRCUIT_BREAKER_WINDOW_MINUTES = 10;

/** Minimum sample size before circuit can trip */
export const CIRCUIT_BREAKER_MIN_SAMPLES = 10;

/** Time in seconds before attempting half-open state */
export const CIRCUIT_BREAKER_RESET_TIMEOUT_SECONDS = 60;

// ----------------------------------------------------------------------------
// Timeout Constants
// ----------------------------------------------------------------------------

/** Timeout for context enrichment in milliseconds */
export const CONTEXT_ENRICHMENT_TIMEOUT_MS = 30000;

/** Per-connector timeout in milliseconds */
export const CONNECTOR_TIMEOUT_MS = 10000;

/** Webhook ACK timeout - must respond within this time */
export const WEBHOOK_ACK_TIMEOUT_MS = 5000;

// ----------------------------------------------------------------------------
// Retry Constants
// ----------------------------------------------------------------------------

/** Default maximum retry attempts */
export const DEFAULT_MAX_RETRY_COUNT = 5;

/** Default delay between retries in milliseconds */
export const DEFAULT_RETRY_DELAY_MS = 3600000; // 1 hour

/** Maximum retry delay cap in milliseconds */
export const MAX_RETRY_DELAY_MS = 86400000; // 24 hours

/** Backoff multiplier for retry delays */
export const RETRY_BACKOFF_MULTIPLIER = 2;

// ----------------------------------------------------------------------------
// Queue Names
// ----------------------------------------------------------------------------

export const QUEUE_NAMES = {
  WEBHOOK_INGESTION: 'webhook-ingestion',
  CONTEXT_ENRICHMENT: 'context-enrichment',
  ACTION_EXECUTION: 'action-execution',
  NOTIFICATION: 'notification',
} as const;

// ----------------------------------------------------------------------------
// Temporal Workflow/Activity Names
// ----------------------------------------------------------------------------

export const WORKFLOW_NAMES = {
  PAYMENT_REPAIR: 'payment-repair-workflow',
  ACTION_EXECUTE: 'action-execute-workflow',
  RETRY_WITH_DELAY: 'retry-with-delay-workflow',
} as const;

export const ACTIVITY_NAMES = {
  STRIPE_RETRY: 'stripe-retry-activity',
  STRIPE_GET_PAYMENT_INTENT: 'stripe-get-payment-intent-activity',
  SEND_OUTREACH_EMAIL: 'send-outreach-email-activity',
  CREATE_TICKET: 'create-ticket-activity',
} as const;

// ----------------------------------------------------------------------------
// Audit Log
// ----------------------------------------------------------------------------

/** Hash algorithm for audit log chain */
export const AUDIT_HASH_ALGORITHM = 'sha256';

/** Initial hash for first audit entry */
export const AUDIT_GENESIS_HASH = '0'.repeat(64);

// ----------------------------------------------------------------------------
// Mandate Defaults
// ----------------------------------------------------------------------------

export const DEFAULT_MANDATE_SCOPE = {
  actions: ['retry_soft_decline', 'send_outreach', 'escalate'] as const,
  max_retry_count: 5,
  max_amount_usd: 10000,
  require_3ds_acknowledgment: false,
};

export const DEFAULT_RISK_THRESHOLDS = {
  step_up_above_usd: 5000,
};

// ----------------------------------------------------------------------------
// HTTP Status Codes
// ----------------------------------------------------------------------------

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ----------------------------------------------------------------------------
// Error Messages
// ----------------------------------------------------------------------------

export const ERROR_MESSAGES = {
  WEBHOOK_SIGNATURE_INVALID: 'Invalid webhook signature',
  WEBHOOK_PARSE_ERROR: 'Failed to parse webhook payload',
  TENANT_NOT_FOUND: 'Tenant not found',
  MANDATE_NOT_FOUND: 'Mandate not found',
  MANDATE_EXPIRED: 'Mandate has expired',
  MANDATE_ACTION_NOT_ALLOWED: 'Action not allowed by mandate',
  MANDATE_AMOUNT_EXCEEDED: 'Amount exceeds mandate limit',
  MANDATE_RETRY_COUNT_EXCEEDED: 'Retry count exceeds mandate limit',
  PLAYBOOK_NO_MATCH: 'No matching playbook rule found',
  CLASSIFICATION_FAILED: 'Failed to classify failure',
  CONTEXT_ENRICHMENT_TIMEOUT: 'Context enrichment timed out',
  ACTION_EXECUTION_FAILED: 'Action execution failed',
  CIRCUIT_BREAKER_OPEN: 'Circuit breaker is open',
  DUPLICATE_EVENT: 'Duplicate event already processed',
} as const;