# Agentic Payment System

An autonomous payment repair and dispute resolution system that automatically recovers failed payments through intelligent retry strategies, customer outreach, and human-in-the-loop escalation.

## Overview

This system implements an **Agentic Payment Repair Pipeline** that:

1. **Ingests** payment failure webhooks from payment service providers (Stripe, etc.)
2. **Classifies** failures using rules-based and LLM-enhanced analysis
3. **Determines** appropriate recovery actions via configurable playbooks
4. **Executes** actions within merchant-defined mandate boundaries
5. **Tracks** all decisions in an immutable audit log

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Agentic Payment System                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Stripe    │    │   Webhook   │    │  Context    │    │  Playbook   │  │
│  │   Webhook   │───▶│  Ingestion  │───▶│ Enrichment  │───▶│   Engine    │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                   │         │
│                                                                   ▼         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Audit     │    │   Action    │    │  Mandate    │    │ Classifier  │  │
│  │    Log      │◀───│  Executor   │◀───│   Layer     │◀───│   Service   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
AgenticPayment/
├── packages/
│   ├── shared/           # Shared types, schemas, and constants
│   │   └── src/
│   │       ├── types.ts      # TypeScript type definitions
│   │       ├── schemas.ts    # Zod validation schemas
│   │       └── constants.ts  # System constants and mappings
│   │
│   ├── api/              # Fastify REST API server
│   │   └── src/
│   │       ├── index.ts          # Main server entry point
│   │       ├── db/
│   │       │   ├── schema.sql    # PostgreSQL database schema
│   │       │   └── index.ts      # Database connection pool
│   │       ├── routes/
│   │       │   └── webhooks.ts   # Stripe webhook handler
│   │       └── services/
│   │           ├── mandate.ts    # Mandate validation service
│   │           ├── classifier.ts # Failure classification service
│   │           └── playbook.ts   # Playbook rule engine
│   │
│   ├── workers/          # BullMQ background workers (planned)
│   └── temporal/         # Temporal workflows (planned)
│
├── AgenticPaymentDemo/   # React frontend dashboard
├── docker-compose.yml    # Local development infrastructure
├── turbo.json           # Turborepo build configuration
└── package.json         # Root workspace configuration
```

## Key Components

### 1. Mandate Layer (Policy Firewall)

The mandate layer acts as a policy firewall that validates every action before execution:

- **Action Allowlist**: Only permitted actions can be executed
- **Amount Limits**: Maximum transaction amounts per action type
- **Retry Limits**: Maximum retry attempts per payment
- **Validity Period**: Mandates have expiration dates
- **3DS Requirements**: Optional 3D Secure acknowledgment for high-value transactions

### 2. Classifier Service

Maps payment failure codes to internal failure types:

- **Soft Declines**: Temporary failures (insufficient funds, bank unavailable)
- **Hard Declines**: Permanent failures (lost card, stolen card, expired card)
- **Risk Blocks**: Fraud detection triggers

### 3. Playbook Engine

Rule-based action selection with priority ordering:

- Match failure types to recovery strategies
- Consider retry history and amount thresholds
- Support for payroll proximity logic
- Configurable autonomy modes (auto, approve, manual)

### 4. Audit Log

Immutable, hash-chained audit trail:

- Every decision is logged with full context
- Hash chain ensures tamper detection
- Append-only design for compliance

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker-compose up -d

# Run database migrations
pnpm --filter @agentic-payment/api db:migrate

# Start development servers
pnpm dev
```

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=agentic_payment
DB_USER=agentic
DB_PASSWORD=agentic_dev_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Stripe
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug
```

## API Endpoints

### Webhooks

```
POST /api/v1/webhooks/stripe/:tenant_id
```

Receives Stripe payment webhooks and queues for processing.

### Repairs

```
GET /api/v1/repairs           # List repair queue
GET /api/v1/repairs/:id       # Get repair details
```

### Actions

```
POST /api/v1/actions/:id/approve   # Approve pending action
POST /api/v1/actions/:id/reject    # Reject pending action
```

### Configuration

```
GET /api/v1/mandates    # List mandates
GET /api/v1/playbooks   # List playbook rules
```

### Metrics

```
GET /api/v1/metrics     # Get recovery metrics
```

Returns:
- At-risk MRR (sum of failed payment amounts)
- Recovered MRR
- Recovery rate percentage
- Total failures and recovery counts

## Database Schema

Key tables:

| Table | Purpose |
|-------|---------|
| `tenants` | Multi-tenant configuration |
| `payment_events` | PSP webhook events (idempotent) |
| `failure_classifications` | AI/rule-based failure analysis |
| `mandates` | Merchant authorization policies |
| `playbook_rules` | Action selection rules |
| `actions` | Executed recovery actions |
| `audit_log` | Immutable decision trail |
| `circuit_breaker_status` | Failure rate tracking |

## Failure Types

| Type | Category | Description |
|------|----------|-------------|
| `insufficient_funds` | soft | Card has insufficient funds |
| `bank_decline` | soft | Bank temporarily declined |
| `card_declined` | soft | Generic card decline |
| `card_expired` | hard | Card has expired |
| `lost_card` | hard | Card reported lost |
| `stolen_card` | hard | Card reported stolen |
| `invalid_card` | hard | Invalid card details |
| `risk_blocked` | risk | Blocked by fraud detection |

## Action Types

| Action | Description | Autonomy |
|--------|-------------|----------|
| `retry_soft_decline` | Retry payment with delay | auto/approve |
| `send_outreach` | Send customer notification | approve/manual |
| `escalate` | Escalate to human agent | manual |
| `create_ticket` | Create support ticket | auto |

## Autonomy Modes

- **auto**: Execute immediately without human approval
- **approve**: Queue for human approval before execution
- **manual**: Requires human to manually trigger execution

## Circuit Breaker

The system implements a circuit breaker pattern:

- Tracks failure rates per action type
- Opens circuit when failure rate exceeds threshold (default 20%)
- Prevents cascading failures
- Auto-recovers after timeout period

## Security

- Webhook signature verification
- Rate limiting on API endpoints
- Helmet security headers
- CORS configuration
- Append-only audit log
- Hash chain for tamper detection

## Development

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

### Lint

```bash
pnpm lint
```

## Roadmap

- [ ] BullMQ workers for async processing
- [ ] Temporal workflows for durable execution
- [ ] LLM integration for ambiguous classifications
- [ ] Multi-PSP support (Adyen, Braintree)
- [ ] Customer outreach templates
- [ ] Real-time dashboard updates
- [ ] Advanced analytics and reporting

## Documentation

- [Agentic Payment System Concept](./Agentic%20Payment%20System%20for%20Merchants%20-%20Polished%20Concept%20(EN).md)
- [MVP Roadmap](./Payment%20Repair%20%26%20Dispute%20Autonomy%20MVP%20Roadmap%20(EN).md)

## License

MIT