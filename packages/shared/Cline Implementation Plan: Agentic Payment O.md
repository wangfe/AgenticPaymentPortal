# Implementation Plan: Agentic Payment Operations

Based on the CEO review (`ceo-review-20260405.md`), here's a comprehensive implementation plan for the **12-week delivery timeline**.

---

## 📋 Executive Summary

| Aspect | Decision |
|--------|----------|
| **Scope** | MVF (W1-W4) + Payment Repair (W5-W12). Disputes deferred to month 4+ |
| **Team** | 2-3 people |
| **Tech Stack** | Node.js/TypeScript + Fastify + Postgres + BullMQ + Temporal |
| **Deployment** | Fly.io for pilot, AWS for enterprise customers |
| **First Customer** | Subscription SaaS with Stripe + one context source |

---

## 🏗️ Architecture Overview

### Tech Stack Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Agentic Payment System                    │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React/TypeScript) - existing demo in AgenticPaymentDemo/  │
├─────────────────────────────────────────────────────────────┤
│  API Layer: Fastify (Node.js/TypeScript)                     │
│  ├── Webhook endpoints (Stripe)                              │
│  ├── REST API for UI                                         │
│  └── WebSocket for real-time updates                         │
├─────────────────────────────────────────────────────────────┤
│  Queue Layer:                                                │
│  ├── BullMQ: transient work (webhook ingestion, enrichment) │
│  └── Temporal: durable action execution (retries, rollback) │
├─────────────────────────────────────────────────────────────┤
│  Data Layer: PostgreSQL                                      │
│  ├── Events, Mandates, Audit Log, Failure History           │
│  └── tenant_id on all tables (single-tenant now, multi-tenant ready) │
├─────────────────────────────────────────────────────────────┤
│  Connectors: Stripe API, Email/SMS, CRM/OMS (Shopify/Salesforce) │
└─────────────────────────────────────────────────────────────┘
```

### BullMQ vs Temporal Division

| BullMQ (Transient) | Temporal (Durable) |
|--------------------|-------------------|
| Webhook ingestion queue | Retry workflows with delayed scheduling |
| Context enrichment jobs | Rollback on terminal failure |
| Notification sends | Any action running >seconds |
| 10s timeout per connector | Mandate expiration handling |

---

## 📅 Week-by-Week Implementation Plan

### Phase 1: MVF (W1-W4) — 9 Engineer-Days

#### W1-W2: Core Infrastructure

**Backend Setup:**
1. Initialize monorepo structure:
   ```
   /packages
   /api          # Fastify backend
   /shared       # Shared types, schemas
   /workers      # BullMQ workers
   /temporal     # Temporal workflows
   /web          # Frontend (existing AgenticPaymentDemo)
   ```

2. **Normalized Payment Event Schema** (PSP-agnostic):
   ```typescript
   interface NormalizedPaymentEvent {
     event_id: string;           // PSP event ID (idempotency key)
     tenant_id: string;
     payment_intent_id: string;
     amount: number;
     currency: string;
     status: 'failed' | 'succeeded' | 'pending';
     decline_code?: string;
     failure_reason?: string;
     psa: 'stripe' | 'adyen' | 'cybersource';
     raw_event: JSON;            // Original PSP payload
     created_at: Date;
   }
   ```

3. **Stripe Webhook Endpoint**:
   - POST `/webhooks/stripe/:tenant_id`
   - Idempotent by PSP event ID
   - Immediate ACK (200), async processing
   - Signature verification

4. **PostgreSQL Schema**:
   ```sql
   CREATE TABLE payment_events (
     id UUID PRIMARY KEY,
     tenant_id UUID NOT NULL,
     event_id VARCHAR(255) UNIQUE NOT NULL,
     payment_intent_id VARCHAR(255),
     amount_cents INTEGER,
     currency VARCHAR(3),
     status VARCHAR(20),
     decline_code VARCHAR(50),
     raw_event JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   
   CREATE TABLE audit_log (
     id UUID PRIMARY KEY,
     tenant_id UUID NOT NULL,
     payment_intent_id VARCHAR(255),
     action_type VARCHAR(50),
     trace_id UUID,
     input JSONB,
     output JSONB,
     rationale TEXT,
     previous_hash VARCHAR(64),
     current_hash VARCHAR(64),
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   -- Revoke UPDATE/DELETE on audit_log for app role
   ```

5. **Audit Log with Hash Chain**:
   - Append-only table
   - Each entry includes `previous_hash` and computes `current_hash`
   - DB role: `app_write` has INSERT only, no UPDATE/DELETE

**Deliverables:**
- [ ] Monorepo with TypeScript + Fastify setup
- [ ] PostgreSQL schema with tenant_id columns
- [ ] Stripe webhook endpoint (idempotent)
- [ ] Audit log table with hash chain
- [ ] Docker Compose for local dev (Postgres + Redis)

#### W3-W4: Mandate Layer + Queue Infrastructure

1. **Mandate Data Model**:
   ```typescript
   interface Mandate {
     mandate_id: string;
     schema_version: '1.0';
     principal: { type: 'merchant'; id: string };
     agent: { type: 'system'; id: string };
     scope: {
       actions: string[];
       max_retry_count: number;
       max_amount_usd: number;
       require_3ds_acknowledgment: boolean;
       validity_until: Date;
     };
     risk_thresholds: {
       step_up_above_usd: number;
     };
   }
   ```

2. **Policy Firewall** (blocks actions exceeding mandate scope):
   ```typescript
   function validateMandate(action: Action, mandate: Mandate): ValidationResult {
     if (!mandate.scope.actions.includes(action.type)) return { valid: false, reason: 'action_not_allowed' };
     if (action.amount > mandate.scope.max_amount_usd) return { valid: false, reason: 'amount_exceeded' };
     if (new Date() > mandate.scope.validity_until) return { valid: false, reason: 'mandate_expired' };
     return { valid: true };
   }
   ```

3. **BullMQ Setup**:
   - Redis connection
   - Queue: `webhook-ingestion`, `context-enrichment`
   - Workers with 10s timeout per connector

4. **Temporal Setup** (local dev):
   - Temporal server via Docker
   - One no-op workflow to verify infra
   - Activity stubs for Stripe API

5. **CI/CD Pipeline**:
   - GitHub Actions workflow
   - Lint, test, build
   - Deploy to Fly.io on main branch

**Deliverables:**
- [ ] Mandate schema + policy firewall
- [ ] BullMQ queues + workers
- [ ] Temporal setup with no-op workflow
- [ ] CI/CD to Fly.io
- [ ] `payment_failure_history` table

**MVF Acceptance Gate:**
> Can ingest a Stripe test webhook, persist to Postgres with audit log entry, check against a stub mandate, and return a logged outcome. No classification yet.

---

### Phase 2: Payment Repair (W5-W12)

#### W5-W6: Classification Engine

1. **Failure Classifier v1**:
   - **Rule Engine**: Known Stripe decline codes → root cause mapping
     ```
     decline_code | root_cause
     -------------|------------------
     51           | insufficient_funds
     65           | card_expired
     95          | bank_decline
     2000        | generic_decline
     ```
   - **LLM Integration**: Ambiguous cases → confidence score
     - Input: decline_code + context
     - Output: `{ root_cause, confidence, reasoning }`
     - Confidence < 0.60 → escalate to human queue

2. **LLM Fallback**: On failure → rules-only, lower confidence

3. **Repair Queue UI v0**:
   - Read-only list of failures
   - Filters: status, root_cause, date range
   - Basic detail view

**Deliverables:**
- [ ] Rule engine for known decline codes
- [ ] LLM classifier for ambiguous cases
- [ ] Confidence floor (< 0.60 → human queue)
- [ ] Repair queue UI (read-only)

#### W7-W8: Playbook Engine + Auto-Execution

1. **Playbook Engine v1**:
   ```typescript
   interface PlaybookRule {
     id: string;
     conditions: {
       failure_type: string[];
       retry_count_max: number;
       payroll_day_proximity_min?: number;
     };
     action: {
       type: 'retry' | 'outreach' | 'escalate';
       params: Record<string, any>;
     };
     priority: number;
   }
   ```

2. **Playbook Miss Handling**: No matching rule → escalate to human queue (never silent drop)

3. **Mandate v1**: Action toggles + amount/frequency thresholds in UI

4. **Circuit Breaker**:
   - Define threshold: failure rate > 20% in 10-min window
   - "Degraded" = all actions route to human queue
   - Auto-recover when rate drops below threshold

5. **Auto-Retry for Safe Actions**:
   - Specific decline codes (insufficient_funds, card_expired)
   - Small amounts (< $100)
   - Max retry count from mandate

6. **Test Requirements** (before auto-execution goes live):
   - [ ] Mandate policy firewall: 100% coverage on scope violations
   - [ ] Playbook engine: property-based tests (never crashes, never silent miss)
   - [ ] Action idempotency: same webhook 3x → exactly one action
   - [ ] Classifier confidence floor: < 0.60 always escalates

**Deliverables:**
- [ ] Playbook engine with IF/THEN rules
- [ ] Circuit breaker implementation
- [ ] Auto-retry for safe actions
- [ ] 100% test coverage on mandate firewall

#### W9-W10: Context Connectors + HITL UI

1. **Context Connector v1**: Shopify or Salesforce (depends on first customer)

2. **HITL Approval UI**:
   - Single/bulk approvals
   - Mandate badge display
   - Agent reasoning panel
   - Action timeline

3. **Outcome Tracking**:
   - Execution success/failure
   - Re-queue rules for failures
   - Writeback to `payment_failure_history`

4. **Idempotency Integration Tests**

**Deliverables:**
- [ ] One context connector (Shopify or Salesforce)
- [ ] HITL approval UI
- [ ] Outcome tracking
- [ ] Idempotency tests passing

#### W11-W12: Pilot Readiness

1. **Audit Export**: CSV/JSON export for compliance

2. **Permission Matrix**: RBAC for multi-user scenarios

3. **Metrics Dashboards**:
   - At-risk MRR
   - Recovery rate delta vs. baseline
   - Mean time to repair (MTR)
   - Dollars recovered

4. **Pilot Runbook**:
   - Alert thresholds
   - Circuit breaker manual override
   - Rollback procedure

5. **First Pilot Merchant**: 2-4 weeks of data collection

**Deliverables:**
- [ ] Audit export functionality
- [ ] Permission matrix
- [ ] Metrics dashboards
- [ ] Pilot runbook
- [ ] First pilot merchant onboarded

---

## 🧪 Test Requirements (Before W7)

| Test | Requirement |
|------|-------------|
| Mandate policy firewall | 100% coverage on scope violation combinations |
| Playbook engine | Property-based: random input → valid action or human escalation |
| Action idempotency | Same webhook 3x → exactly one action executed |
| Classifier confidence | Confidence < 0.60 → always escalates |

---

## 🛡️ Security & Threat Model

| Threat | Mitigation |
|--------|------------|
| Prompt injection via webhook fields | Structured JSON schema wrapping; strict LLM output validation |
| Tenant API key exposure | Key fetched per Temporal activity; never logged; key ID only in logs |
| Audit log tampering | Append-only Postgres table + hash chain |

---

## 📊 Success Criteria (First Pilot)

| Metric | Target |
|--------|--------|
| Recovery rate on soft declines | ≥ 65% (vs. ~40% manual baseline) |
| Mean time to repair | ≤ 6 hours (vs. 3-5 day manual baseline) |
| Actions outside mandate scope | Zero (verified via audit log) |
| Audit log completeness | 100% of actions |
| Mandate coverage | ≥ 1 per action type |

---

## 🚀 Open Items Before Build Start

1. **Circuit breaker thresholds**: Define failure rate % + time window + "degraded" behavior before W7
2. **First CRM/OMS**: Shopify, Salesforce, or HubSpot — depends on first customer's stack
3. **Mandate standard**: `schema_version: "1.0"` field added; revisit x402 compatibility in month 6

---

## 📁 Recommended Project Structure

```
AgenticPayment/
├── packages/
│   ├── api/                    # Fastify backend
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── webhooks.ts
│   │   │   │   ├── repairs.ts
│   │   │   │   └── mandates.ts
│   │   │   ├── services/
│   │   │   │   ├── classifier.ts
│   │   │   │   ├── playbook.ts
│   │   │   │   └── mandate.ts
│   │   │   └── db/
│   │   │       ├── schema.sql
│   │   │       └── migrations/
│   │   └── package.json
│   ├── workers/                # BullMQ workers
│   │   ├── src/
│   │   │   ├── ingestion.worker.ts
│   │   │   └── enrichment.worker.ts
│   │   └── package.json
│   ├── temporal/               # Temporal workflows
│   │   ├── src/
│   │   │   ├── workflows/
│   │   │   │   └── repair.workflow.ts
│   │   │   └── activities/
│   │   │       ├── stripe.activity.ts
│   │   │       └── outreach.activity.ts
│   │   └── package.json
│   ├── shared/                 # Shared types/schemas
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   └── schemas.ts
│   │   └── package.json
│   └── web/                    # Frontend (move AgenticPaymentDemo here)
├── docker-compose.yml
├── package.json (workspaces)
└── .github/
    └── workflows/
        └── deploy.yml
```

---

## Next Steps

Would you like me to:

1. **Create the detailed PRD** for any specific week (e.g., W1-W2 in full detail)?
2. **Generate the database schema** SQL files?
3. **Set up the monorepo structure** with the initial package configuration?
4. **Create the CI/CD pipeline** GitHub Actions workflow?

If this plan looks good, **toggle to Act mode** and I can start implementing the foundation.