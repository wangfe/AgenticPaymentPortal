# Agentic Payment System — Project Roadmap (MVP: Payment Repair + Dispute Autonomy)

> Goal: Deliver two shippable closed loops in ~90 days (rolling weekly): **Payment Repair** and **Dispute Autonomy**, on top of a shared, enterprise-grade agent control plane foundation (auditable, controllable, gradual delegation).

## 0. Roadmap at a glance (12-week cadence)

- **W1–W2: Core integrations + read-only insights** (make the system “see” problems)
- **W3–W6: Recommendation mode (human-in-the-loop)** (make the system “recommend well”)
- **W7–W10: Limited auto-execution (low-risk actions)** (make the system “do work”)
- **W11–W12: Closed-loop hardening + scale readiness** (metrics, replay, gradual rollout, operability)

Two product tracks run in parallel, but the shared foundation should be built once and reused across both.

---

## 1. Shared MVP assumptions, boundaries, and KPIs

### 1.1 Shared boundaries (avoid autonomy incidents)

- Start in **recommendation mode**: recommendations + explanations + one-click execute/approve
- Auto-execution only for **low-risk actions** (each action has its own kill switch)
- End-to-end required: **structured mandates/policy thresholds**, **audit logs**, **replay/sandbox**, **circuit breakers / graceful degradation**
- For **AI agents paying autonomously**, additionally required:
  - **Agent Identity** traceability (who is acting on behalf of whom)
  - **Intent Receipt** per autonomous payment (usable as dispute evidence)
  - **Step-up** support (threshold-triggered verification/approval)

### 1.2 Shared data assumptions (minimum viable inputs)

- PSP/gateway events: payment_intent/charge/authorization, decline codes / dispute codes, 3DS results
- Order/customer context: order id, amount, currency, country, category, customer segment, purchase/failure history
- Ops systems: email/SMS/push, ticketing (optional)
- Dispute extra: delivery evidence, support conversations, login/device data (optional)
- **Agentic additions (recommended from Day 1)**:
  - `agent_id` / `agent_vendor` / `agent_version` (or equivalent)
  - `mandate_id` (delegated mandate) + change history
  - `intent_receipt_id` + step-up records

### 1.3 North Star metrics and stage metrics

**Payment Repair**
- NSM: *Recovered successful amount / recoverable failed amount*
- Core metrics:
  - auth success uplift (segmented by country / scheme / method)
  - mean time-to-repair (TTR)
  - reduction in manual tickets
  - “extra costs” from retries (fees, risk triggers) kept under control

**Dispute Autonomy**
- NSM: *net dispute loss rate reduction* or *win-rate improvement*
- Core metrics:
  - minutes of human time per dispute case down
  - overdue rate near zero (SLA)
  - evidence pack quality score (internal/external outcome proxy)
  - win-rate up, losses down

**Foundation metrics (shared)**
- recommendation adoption rate; auto-execution share (by action)
- replay pass rate; mis-execution rate (must be extremely low)
- audit coverage (100%)

---

## 2. Payment Repair MVP roadmap

### 2.1 Closed-loop definition (minimum loop)

**Input**: failure event + context → **Decision**: choose repair action → **Execution**: tool calls → **Outcome**: success/cost/side effects → **Learning**: persist action→outcome as policy signals/features.

### 2.2 Primary users and journey

- Users: payments ops, growth/revenue owners, support leads
- Journey:
  1) failures enter a “repair queue”
  2) agent provides attribution + top 3 actions (expected value/risk)
  3) one-click execute/approve (bulk supported)
  4) track outcomes and learn: success rate, costs, false positives

### 2.3 Capability breakdown (must-have → optional)

**A0. Agentic-payment failure modes (NEW, must-have)**
- Detect and differentiate flows where the initiator is an agent vs a human (async, batchy, frequent micro-payments, cross-merchant patterns)
- Extend failure attribution to include:
  - mandate exceeded/expired, step-up incomplete, agent identity verification failure, rate-limit triggers
- Write repair actions back to the intent receipt (to preserve future dispute evidence)

**A. Attribution and explainability (must-have)**
- Standardize failure reasons: gateway decline / issuer decline / 3DS fail / insufficient funds / suspected fraud / configuration
- Evidence-backed attribution: cite fields, historical comparisons, similar cases
- Rationale: why action A is recommended and action B is not

**B. Playbooks (must-have)**
- Structured rules + parameters (not prompts):
  - when to retry (interval, attempts, backoff, time windows)
  - when to trigger 3DS
  - when to reroute/switch processor (if available)
  - when to adjust payment parameters (descriptor/metadata/MCC—careful)
  - when to outreach for alternate payment methods

**C. Executable actions (start low-risk)**
- Low-risk (prioritize for automation):
  - send payment update link / prompt alternate method
  - create ticket and notify customer
  - generate a retry plan and request approval
- Medium-risk (default to approvals):
  - auto-retry (small amounts / certain decline codes)
  - trigger/escalate 3DS
- High-risk (later):
  - reroute to different PSP/acquirer
  - change risk thresholds

**D. Monitoring and learning (must-have)**
- Action Outcome logging: per action results, latency, costs, side effects
- Dimension dashboards: country / scheme / method / decline code / channel

### 2.4 12-week delivery plan (by week)

**W1–W2: Read-only ingestion + failure taxonomy**
- Deliver:
  - ingest PSP webhooks (at least one: Stripe or your current PSP)
  - decline code mapping (unified taxonomy)
  - **agentic schema fields** (agent_id/mandate_id/intent_receipt_id/step-up status)
  - repair queue v0 (read-only list + filters)
- Acceptance: stable visibility into failures; segmented views; can distinguish agent-initiated vs human-initiated

**W3–W4: Recommendation v1 (top-3 actions + explanations)**
- Deliver:
  - attribution engine v1 (templates + evidence citations)
  - playbook engine v1 (structured policies)
  - recommendation cards: action, rationale, expected value/risk, required permissions
- Acceptance: ops can act from recommendation cards; explanations are auditable

**W5–W6: Human-in-the-loop execution (approvals + connectors)**
- Deliver:
  - one-click execution for low-risk actions: notifications/tickets/payment update links
  - approval workflows: single/bulk approvals, permissions
  - outcome tracking: execution success/failure, re-queue rules
- Acceptance: working closed loop “recommend → execute → outcome” with full logs

**W7–W8: Limited automation (small-scope auto-retries)**
- Deliver:
  - mandate v1: action toggles + amount/frequency thresholds
  - auto-retry policies (specific decline codes + small amounts + gradual rollout)
  - circuit breakers: anomaly spikes / rising failure rates auto-disable
- Acceptance: controlled automation share; mis-execution rate meets thresholds

**W9–W10: Action expansion + policy replay**
- Deliver:
  - replay system: simulate policy changes on historical data
  - finer segmentation policies: by country/scheme/customer tiers
  - more actions (still conservative): 3DS triggers (if feasible) and improved alternate-method prompts
- Acceptance: offline evaluation of success uplift vs cost changes

**W11–W12: Operability + external pilot**
- Deliver:
  - enterprise audit export, permission matrix
  - metrics dashboards and automated weekly reports
  - pilot runbook (alerts, circuit breakers, rollback)
- Acceptance: at least one pilot merchant runs 2–4 weeks and yields publishable ROI evidence

### 2.5 Dependencies and risks

- Dependencies: PSP API permissions, webhook reliability, order data quality
- Risks: excessive retries increasing costs or triggering risk controls; untrusted recommendations
- Mitigations: action tiering + mandates + gradual rollout + replay + circuit breakers

---

## 3. Dispute Autonomy MVP roadmap

### 3.1 Closed-loop definition (minimum loop)

**Input**: dispute event + case context → **Collect**: evidence gathering → **Generate**: evidence pack/narrative → **Submit/Remind**: deadline tracking → **Outcome**: win/loss + reason → **Learning**: improve templates and evidence diagnostics.

### 3.2 Primary users and journey

- Users: risk ops, support leads, legal/compliance, payments ops
- Journey:
  1) disputes enter a “case queue” (with deadlines)
  2) agent classifies (fraud / not received / not as described / subscription cancel, etc.)
  3) auto-collect evidence + generate evidence pack (scheme/country templates)
  4) human review → one-click submit (auto-submit later)
  5) outcome writeback + continuous improvement

### 3.3 Capability breakdown (must-have → optional)

**A. Case classification and deadline management (must-have)**
- Dispute taxonomy: map reason codes into operational categories
- SLA: reminders, escalation, overdue protection (near deadline: submit minimum viable pack or escalate)

**B. Evidence Graph + connectors (must-have)**
- Evidence sources: orders, invoices, logistics, digital delivery logs, support comms, account login, IP/device
- **Agentic first-class evidence (must-have)**: mandate content + versions, intent receipts, step-up/approval records, agent tool-call audit logs
- Evidence index: source, timestamp, tamper-evident digest (hash optional)

**C. Evidence Pack Generator (must-have)**
- Template-driven output:
  - cover letter (case narrative)
  - timeline
  - attachment index
  - attachments (PDF/screenshots/log summaries)
- Multi-language/multi-format (at least English first; expand later)

**D. Submission and tracking (optional / phased)**
- Early: generate pack + reminders; humans submit in PSP/acquirer dashboard
- Later: semi/fully automated submission (depends on PSP/acquirer APIs and risk tolerance)

### 3.4 12-week delivery plan (by week)

**W1–W2: Dispute ingestion + case queue v0**
- Deliver:
  - ingest dispute events (at least one PSP)
  - case queue: reason, amount, due date, status
  - reason code → case category mapping
- Acceptance: no missed cases, correct due dates, filterable by category

**W3–W4: Evidence connectors v1 + minimal evidence pack**
- Deliver:
  - evidence connectors: pick 2 to start (orders/invoices/logistics)
  - **agentic evidence connector v0**: import mandate / intent receipt / step-up records (even via file/DB initially)
  - evidence pack v1: cover letter + timeline + attachment index
  - audit: each evidence item references source fields
- Acceptance: time-to-pack reduced from 30–60 minutes to 10–15 minutes; agent-initiated cases include “authorization and intent” evidence

**W5–W6: Template system + quality controls**
- Deliver:
  - category-specific templates
  - missing-evidence diagnostics: what’s missing, where to get it, suggested remediation
  - review UI: red-flag warnings; sensitive-data redaction (optional)
- Acceptance: stable evidence pack quality; batch generation works

**W7–W8: SLA automation + escalation + ops dashboards**
- Deliver:
  - near-deadline reminders, escalation, overdue protection policies
  - dashboards: volume, win rate (if history), overdue rate, handling time
- Acceptance: overdue rate near zero; team manages capacity via dashboards

**W9–W10: Semi-auto submission (optional) + outcome loop**
- Deliver:
  - if supported: submission API; otherwise step-by-step “submission instructions”
  - outcome writeback: win/loss, reasons, missing-evidence labels
  - learning: feed loss reasons into templates and evidence diagnostics
- Acceptance: evidence → outcome → improvement closed loop works

**W11–W12: Scale readiness (multi-PSP, multi-region, multi-team)**
- Deliver:
  - multi-merchant/team RBAC + isolation (if multi-tenant is needed)
  - audit exports and retention policies
  - pilot runbook
- Acceptance: at least one pilot runs 2–4 weeks and shows measurable savings and/or win-rate improvement

### 3.5 Dependencies and risks

- Dependencies: access to logistics/delivery/support systems; PSP reason codes and submission requirements
- Risks: incomplete evidence leading to losses; generated narratives not meeting scheme requirements
- Mitigations: templates + missing-evidence diagnostics + human review enabled by default; evidence citations to source fields

---

## 4. Shared foundation for both MVPs (platform roadmap)

### 4.1 Console
- Unified queue experience (failures + disputes): filters, prioritization, bulk actions
- Case detail page: context, recommendations, evidence, action history, audit

### 4.2 Playbook Builder (policy/mandate configuration)
- Structured policies: conditions → actions → constraints → escalation
- Action-level modes: recommend / approve / auto
- Versioning + replay

### 4.3 Mandates (structured authorization)
- Dimensions: amount caps, frequency, time windows, region, customer tiers, risk thresholds
- Integrated with RBAC: who can delegate authority and who can approve

### 4.4 Audit + explainability
- Record for every recommendation/execution: inputs, outputs, rationale summary, tool calls and responses, rollback points
- Export for internal control/compliance/customer audits

### 4.5 Connector system (tooling)
- PSPs: Stripe/Adyen/Cybersource (choose based on your current stack)
- Notifications: email/SMS/push
- Ticketing: Zendesk/Jira/Intercom (optional)
- Evidence sources: OMS, logistics, support, risk, login/device logs

---

## 5. Team and engineering split (minimum viable “strong” team)

- PM (1): define closed loops, KPIs, drive pilots
- Tech Lead (1): architecture and quality gates
- Backend (2–3): ingestion, policy/mandates, connectors, audit
- Frontend (1–2): console, approvals, dashboards
- Data/ML (0.5–1): attribution features, replay, metrics (can start lightweight)
- Compliance (0.2): audit/retention/permission boundaries

Suggested squads:
- Squad A: Payment Repair loop
- Squad B: Dispute Autonomy loop
- Platform: shared foundation (initially TL + 1 backend can dual-hat; later make it dedicated)

---

## 6. Definition of Done (DoD)

**Pilot-ready DoD (shared)**
- Every critical action has: mandate gate, audit logs, circuit breakers, replay
- Queue closed loop: enter → recommend → (approve/execute) → outcome → review
- At least 1 pilot merchant:
  - Payment Repair: provable success-rate uplift or recovered amount uplift (control group or replay acceptable)
  - Dispute Autonomy: provable time savings + overdue rate near zero (win-rate uplift as bonus)

---

## 7. Next steps (answer these 6 questions and I can convert this into a PRD-grade, schedulable milestone plan)

1) Who is your primary PSP/gateway today? (Stripe / Cybersource / Adyen / multiple)
2) In Payment Repair MVP, which 2–3 actions do you want to automate first?
3) For disputes, which evidence sources can you integrate today? (orders/logistics/support/login/device/risk)
4) What’s the approximate scale of pilot merchants? (monthly txn count / GMV)
5) Do you need multi-tenant SaaS from day one, or start single-tenant / per-customer deployment?
6) Any explicit compliance/audit requirements (SOC2/ISO/PCI boundary constraints)?
