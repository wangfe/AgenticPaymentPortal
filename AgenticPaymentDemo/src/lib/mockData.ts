import { nanoid } from "nanoid";
import type {
  AgentIdentity,
  AuditEvent,
  DisputeCase,
  EvidenceItem,
  IntentReceipt,
  Mandate,
  PaymentFailure,
  RepairAction,
} from "@/lib/domain";

const iso = (d: Date) => d.toISOString();

const agentA: AgentIdentity = {
  agentId: "agt_checkout_copilot",
  vendor: "AcmeAI",
  version: "1.8.2",
  runtime: "server",
  keyId: "key_live_7f2a",
};

const agentB: AgentIdentity = {
  agentId: "agt_travel_booking",
  vendor: "TripBrain",
  version: "0.9.5",
  runtime: "browser",
  keyId: "key_live_19c1",
};

export const mandates: Mandate[] = [
  {
    id: "mdt_01HZYD3TQ3",
    principal: { type: "consumer", id: "cus_8321", displayName: "Ava Chen" },
    agent: agentA,
    scope: {
      maxAmountMinor: 30000,
      currency: "USD",
      frequency: "daily",
      expiresAt: iso(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
      merchantAllowlist: ["mrc_rocketshop"],
      categoryAllowlist: ["digital"],
      countryAllowlist: ["US", "CA"],
      paymentMethodAllowlist: ["card", "wallet"],
    },
    riskThresholds: {
      stepUpIfNewDevice: true,
      stepUpIfNewShippingAddress: true,
      stepUpIfAmountOverMinor: 15000,
    },
    version: 3,
    updatedAt: iso(new Date(Date.now() - 1000 * 60 * 60 * 8)),
    updatedBy: "risk-admin@merchant.com",
  },
  {
    id: "mdt_01HZYD9K2M",
    principal: { type: "business", id: "biz_441", displayName: "Northwind LLC" },
    agent: agentB,
    scope: {
      maxAmountMinor: 200000,
      currency: "EUR",
      frequency: "weekly",
      expiresAt: iso(new Date(Date.now() + 1000 * 60 * 60 * 24 * 90)),
      merchantAllowlist: ["mrc_flyfast"],
      categoryAllowlist: ["travel"],
      countryAllowlist: ["DE", "FR", "IT", "ES"],
      paymentMethodAllowlist: ["card"],
    },
    riskThresholds: {
      stepUpIfNewDevice: true,
      stepUpIfNewShippingAddress: false,
      stepUpIfAmountOverMinor: 120000,
    },
    version: 1,
    updatedAt: iso(new Date(Date.now() - 1000 * 60 * 60 * 48)),
    updatedBy: "finance@northwind.com",
  },
];

export const intentReceipts: IntentReceipt[] = [
  {
    id: "ir_01HZYF1K8G",
    mandateId: mandates[0].id,
    createdAt: iso(new Date(Date.now() - 1000 * 60 * 22)),
    summary: {
      orderId: "ord_92341",
      items: [
        { name: "Pro plan (monthly)", qty: 1 },
        { name: "Add-on: extra seats", qty: 2 },
      ],
      amount: { amount: 1899, currency: "USD" },
      shippingCountry: "US",
    },
    decisionSummary:
      "Agent executed subscription renewal within mandate. Step-up not required (amount below threshold; known device).",
    fieldsHashed: ["orderId", "amount", "mandateId"],
  },
  {
    id: "ir_01HZYF9Q1P",
    mandateId: mandates[1].id,
    createdAt: iso(new Date(Date.now() - 1000 * 60 * 90)),
    summary: {
      orderId: "ord_88102",
      items: [{ name: "Flight ticket", qty: 1 }],
      amount: { amount: 132400, currency: "EUR" },
      shippingCountry: "DE",
    },
    decisionSummary:
      "Agent attempted payment within mandate scope; step-up required due to amount threshold; user did not approve in time.",
    fieldsHashed: ["orderId", "amount", "mandateId", "shippingCountry"],
  },
];

export const paymentFailures: PaymentFailure[] = [
  {
    id: "pf_1001",
    createdAt: iso(new Date(Date.now() - 1000 * 60 * 18)),
    actorType: "agent",
    agent: agentA,
    mandateId: mandates[0].id,
    intentReceiptId: intentReceipts[0].id,
    stepUp: { id: "su_771", status: "not_required" },
    merchant: { id: "mrc_rocketshop", name: "RocketShop" },
    customer: { id: "cus_8321", email: "ava.chen@example.com", segment: "returning" },
    order: { id: "ord_92341", country: "US", category: "digital" },
    money: { amount: 1899, currency: "USD" },
    channel: "card",
    scheme: "visa",
    issuerCountry: "US",
    decline: {
      type: "issuer",
      code: "51",
      message: "Insufficient funds",
    },
    status: "open",
    priority: "p1",
  },
  {
    id: "pf_1002",
    createdAt: iso(new Date(Date.now() - 1000 * 60 * 62)),
    actorType: "agent",
    agent: agentB,
    mandateId: mandates[1].id,
    intentReceiptId: intentReceipts[1].id,
    stepUp: {
      id: "su_889",
      status: "pending",
      method: "push",
      requestedAt: iso(new Date(Date.now() - 1000 * 60 * 80)),
    },
    merchant: { id: "mrc_flyfast", name: "FlyFast" },
    customer: { id: "cus_2211", email: "payables@northwind.com", segment: "vip" },
    order: { id: "ord_88102", country: "DE", category: "travel" },
    money: { amount: 132400, currency: "EUR" },
    channel: "card",
    scheme: "mastercard",
    issuerCountry: "DE",
    decline: {
      type: "mandate",
      code: "STEP_UP_REQUIRED",
      message: "Step-up approval required (amount threshold)",
    },
    status: "in_review",
    priority: "p0",
  },
  {
    id: "pf_1003",
    createdAt: iso(new Date(Date.now() - 1000 * 60 * 240)),
    actorType: "human",
    merchant: { id: "mrc_rocketshop", name: "RocketShop" },
    customer: { id: "cus_512", email: "leo@acme.com", segment: "new" },
    order: { id: "ord_71011", country: "CA", category: "digital" },
    money: { amount: 4999, currency: "USD" },
    channel: "card",
    scheme: "amex",
    issuerCountry: "CA",
    decline: {
      type: "3ds",
      code: "AUTHENTICATION_FAILED",
      message: "3DS authentication failed",
    },
    status: "open",
    priority: "p2",
  },
];

export const repairActionsByFailureId: Record<string, RepairAction[]> = {
  pf_1001: [
    {
      id: "ra_1",
      label: "Send payment update link (wallet / bank transfer)",
      risk: "low",
      requiresApproval: false,
      expectedUpliftPct: 12,
      expectedCostDeltaPct: 0,
      rationale: "Issuer code 51: recovery is best via alternative method or delayed retry. Low risk.",
    },
    {
      id: "ra_2",
      label: "Schedule smart retry (T+12h, 1 attempt)",
      risk: "medium",
      requiresApproval: true,
      expectedUpliftPct: 9,
      expectedCostDeltaPct: 3,
      rationale: "Delayed retry often succeeds after balance refresh; keep attempt count low to avoid fees.",
    },
    {
      id: "ra_3",
      label: "Escalate to support ticket (VIP queue)",
      risk: "low",
      requiresApproval: false,
      expectedUpliftPct: 5,
      expectedCostDeltaPct: 1,
      rationale: "Human follow-up can confirm intent and capture alternate payment details.",
    },
  ],
  pf_1002: [
    {
      id: "ra_4",
      label: "Trigger step-up again (push) + 15 min deadline",
      risk: "low",
      requiresApproval: false,
      expectedUpliftPct: 25,
      expectedCostDeltaPct: 0,
      rationale: "Mandate requires step-up for amount; resend approval request with clear timebox.",
    },
    {
      id: "ra_5",
      label: "Downgrade to partial payment (split invoice)",
      risk: "medium",
      requiresApproval: true,
      expectedUpliftPct: 14,
      expectedCostDeltaPct: 1,
      rationale: "If policy allows, splitting keeps within threshold and reduces step-up friction.",
    },
    {
      id: "ra_6",
      label: "Escalate to enterprise approval workflow",
      risk: "low",
      requiresApproval: false,
      expectedUpliftPct: 18,
      expectedCostDeltaPct: 0,
      rationale: "B2B principal: enterprise approver can complete step-up quickly.",
    },
  ],
  pf_1003: [
    {
      id: "ra_7",
      label: "Retry with 3DS required (friction-based)",
      risk: "medium",
      requiresApproval: true,
      expectedUpliftPct: 11,
      expectedCostDeltaPct: 2,
      rationale: "3DS failed; attempt again with improved UX guidance and fallback option.",
    },
    {
      id: "ra_8",
      label: "Offer wallet payment (Apple Pay / Google Pay)",
      risk: "low",
      requiresApproval: false,
      expectedUpliftPct: 8,
      expectedCostDeltaPct: 0,
      rationale: "Wallet reduces authentication friction and often bypasses issuer challenge.",
    },
  ],
};

export const disputeCases: DisputeCase[] = [
  {
    id: "dc_2001",
    createdAt: iso(new Date(Date.now() - 1000 * 60 * 60 * 5)),
    dueAt: iso(new Date(Date.now() + 1000 * 60 * 60 * 24 * 4)),
    status: "needs_review",
    actorType: "agent",
    agent: agentA,
    mandateId: mandates[0].id,
    intentReceiptId: intentReceipts[0].id,
    stepUp: { id: "su_771", status: "not_required" },
    merchant: { id: "mrc_rocketshop", name: "RocketShop" },
    customer: { id: "cus_8321", email: "ava.chen@example.com", country: "US" },
    order: { id: "ord_92341", category: "digital", shippingCountry: "US" },
    money: { amount: 1899, currency: "USD" },
    reasonCode: "10.4",
    reasonCategory: "fraud",
  },
  {
    id: "dc_2002",
    createdAt: iso(new Date(Date.now() - 1000 * 60 * 60 * 30)),
    dueAt: iso(new Date(Date.now() + 1000 * 60 * 60 * 24 * 1)),
    status: "open",
    actorType: "human",
    merchant: { id: "mrc_flyfast", name: "FlyFast" },
    customer: { id: "cus_900", email: "marta@example.com", country: "ES" },
    order: { id: "ord_99210", category: "travel", shippingCountry: "ES" },
    money: { amount: 59900, currency: "EUR" },
    reasonCode: "13.1",
    reasonCategory: "not_received",
  },
];

export const evidenceByDisputeId: Record<string, EvidenceItem[]> = {
  dc_2001: [
    {
      id: "ev_1",
      kind: "mandate",
      title: "Delegated mandate (mdt_01HZYD3TQ3) v3",
      source: "Mandate Store",
      timestamp: iso(new Date(Date.now() - 1000 * 60 * 60 * 8)),
      hash: "0x9f3a...",
      notes: "Shows scope, thresholds, and approver history.",
    },
    {
      id: "ev_2",
      kind: "intent_receipt",
      title: "Intent receipt (ir_01HZYF1K8G)",
      source: "Intent Receipt Service",
      timestamp: iso(new Date(Date.now() - 1000 * 60 * 22)),
      hash: "0x1caa...",
      notes: "Non-repudiation receipt with hashed fields.",
    },
    {
      id: "ev_3",
      kind: "digital_delivery",
      title: "Digital access logs (successful login + usage)",
      source: "Product Analytics",
      timestamp: iso(new Date(Date.now() - 1000 * 60 * 12)),
      notes: "Customer accessed paid features after charge.",
    },
    {
      id: "ev_4",
      kind: "agent_tool_log",
      title: "Agent tool-call audit log",
      source: "Audit Trail",
      timestamp: iso(new Date(Date.now() - 1000 * 60 * 22)),
      notes: "Shows which systems were called and responses.",
    },
    {
      id: "ev_5",
      kind: "order",
      title: "Order record + invoice",
      source: "OMS",
      timestamp: iso(new Date(Date.now() - 1000 * 60 * 23)),
    },
  ],
  dc_2002: [
    {
      id: "ev_6",
      kind: "order",
      title: "Booking confirmation",
      source: "OMS",
      timestamp: iso(new Date(Date.now() - 1000 * 60 * 60 * 30)),
    },
    {
      id: "ev_7",
      kind: "shipping",
      title: "Carrier tracking (delivered)",
      source: "Logistics Provider",
      timestamp: iso(new Date(Date.now() - 1000 * 60 * 60 * 10)),
    },
    {
      id: "ev_8",
      kind: "support",
      title: "Support chat transcript",
      source: "Intercom",
      timestamp: iso(new Date(Date.now() - 1000 * 60 * 60 * 8)),
    },
  ],
};

export const auditByEntityId: Record<string, AuditEvent[]> = {
  pf_1001: [
    {
      id: nanoid(),
      at: iso(new Date(Date.now() - 1000 * 60 * 18)),
      actor: { type: "agent", displayName: "AcmeAI / agt_checkout_copilot", agent: agentA },
      kind: "INGESTED",
      summary: "Failure ingested from PSP webhook (issuer decline 51).",
    },
    {
      id: nanoid(),
      at: iso(new Date(Date.now() - 1000 * 60 * 17)),
      actor: { type: "agent", displayName: "Repair Supervisor" },
      kind: "RECOMMENDED",
      summary: "Generated 3 candidate repair actions with expected uplift and risk.",
    },
  ],
  dc_2001: [
    {
      id: nanoid(),
      at: iso(new Date(Date.now() - 1000 * 60 * 60 * 5)),
      actor: { type: "agent", displayName: "Dispute Agent", agent: agentA },
      kind: "INGESTED",
      summary: "Dispute case created (reason 10.4 fraud).",
    },
    {
      id: nanoid(),
      at: iso(new Date(Date.now() - 1000 * 60 * 50)),
      actor: { type: "agent", displayName: "Dispute Agent" },
      kind: "EVIDENCE_GENERATED",
      summary: "Evidence pack draft generated (mandate + intent receipt included).",
    },
  ],
};
