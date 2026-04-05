export type Money = {
  amount: number; // minor units
  currency: string;
};

export type ActorType = "human" | "agent";

export type AgentIdentity = {
  agentId: string;
  vendor: string;
  version: string;
  runtime: "browser" | "server" | "mobile";
  keyId: string;
};

export type StepUpRecord = {
  id: string;
  status: "not_required" | "pending" | "approved" | "rejected";
  method?: "push" | "sms" | "biometric" | "enterprise_approval";
  requestedAt?: string; // ISO
  resolvedAt?: string; // ISO
  approver?: string;
};

export type Mandate = {
  id: string;
  principal: {
    type: "consumer" | "business";
    id: string;
    displayName: string;
  };
  agent: AgentIdentity;
  scope: {
    maxAmountMinor: number;
    currency: string;
    frequency: "one_time" | "daily" | "weekly" | "monthly";
    expiresAt: string; // ISO
    merchantAllowlist: string[];
    categoryAllowlist: string[];
    countryAllowlist: string[];
    paymentMethodAllowlist: string[];
  };
  riskThresholds: {
    stepUpIfNewDevice: boolean;
    stepUpIfNewShippingAddress: boolean;
    stepUpIfAmountOverMinor: number;
  };
  version: number;
  updatedAt: string; // ISO
  updatedBy: string;
};

export type IntentReceipt = {
  id: string;
  mandateId: string;
  createdAt: string;
  summary: {
    orderId: string;
    items: { name: string; qty: number }[];
    amount: Money;
    shippingCountry?: string;
  };
  decisionSummary: string;
  fieldsHashed: string[];
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: {
    type: ActorType;
    displayName: string;
    agent?: AgentIdentity;
  };
  kind:
    | "INGESTED"
    | "RECOMMENDED"
    | "APPROVED"
    | "EXECUTED"
    | "ROLLED_BACK"
    | "EVIDENCE_GENERATED"
    | "SUBMISSION_REQUESTED";
  summary: string;
  details?: Record<string, unknown>;
};

export type PaymentFailure = {
  id: string;
  createdAt: string;
  actorType: ActorType;
  agent?: AgentIdentity;
  mandateId?: string;
  intentReceiptId?: string;
  stepUp?: StepUpRecord;

  merchant: { id: string; name: string };
  customer: { id: string; email: string; segment: "new" | "returning" | "vip" };
  order: { id: string; country: string; category: string };
  money: Money;

  channel: "card" | "wallet" | "bank_transfer";
  scheme?: "visa" | "mastercard" | "amex";
  issuerCountry?: string;

  decline: {
    type: "gateway" | "issuer" | "3ds" | "risk" | "configuration" | "mandate";
    code: string;
    message: string;
  };

  status: "open" | "in_review" | "fixed" | "abandoned";
  priority: "p0" | "p1" | "p2";
};

export type RepairAction = {
  id: string;
  label: string;
  risk: "low" | "medium" | "high";
  requiresApproval: boolean;
  expectedUpliftPct: number;
  expectedCostDeltaPct: number;
  rationale: string;
};

export type DisputeCase = {
  id: string;
  createdAt: string;
  dueAt: string;
  status: "open" | "needs_review" | "submitted" | "won" | "lost";
  actorType: ActorType;
  agent?: AgentIdentity;
  mandateId?: string;
  intentReceiptId?: string;
  stepUp?: StepUpRecord;

  merchant: { id: string; name: string };
  customer: { id: string; email: string; country: string };
  order: { id: string; category: string; shippingCountry: string };
  money: Money;

  reasonCode: string;
  reasonCategory:
    | "fraud"
    | "not_received"
    | "not_as_described"
    | "subscription_canceled"
    | "duplicate"
    | "other";
};

export type EvidenceItem = {
  id: string;
  kind:
    | "order"
    | "invoice"
    | "shipping"
    | "digital_delivery"
    | "support"
    | "login"
    | "device"
    | "risk"
    | "mandate"
    | "intent_receipt"
    | "step_up"
    | "agent_tool_log";
  title: string;
  source: string;
  timestamp: string;
  hash?: string;
  notes?: string;
};
