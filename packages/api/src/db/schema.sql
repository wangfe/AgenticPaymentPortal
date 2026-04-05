-- ============================================================================
-- Agentic Payment System - Database Schema
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Tenants
-- ----------------------------------------------------------------------------

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    context_readiness BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Payment Events (PSP-agnostic)
-- ----------------------------------------------------------------------------

CREATE TABLE payment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    payment_intent_id VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL,
    decline_code VARCHAR(50),
    failure_reason VARCHAR(255),
    failure_message TEXT,
    psp VARCHAR(50) NOT NULL,
    psp_account_id VARCHAR(255),
    raw_event JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    -- Idempotency: one row per PSP event
    CONSTRAINT unique_psp_event UNIQUE (tenant_id, event_id)
);

CREATE INDEX idx_payment_events_tenant ON payment_events(tenant_id);
CREATE INDEX idx_payment_events_payment_intent ON payment_events(payment_intent_id);
CREATE INDEX idx_payment_events_status ON payment_events(status);
CREATE INDEX idx_payment_events_created_at ON payment_events(created_at DESC);

-- ----------------------------------------------------------------------------
-- Payment Failure History
-- ----------------------------------------------------------------------------

CREATE TABLE payment_failure_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    payment_intent_id VARCHAR(255) NOT NULL,
    original_payment_event_id UUID NOT NULL REFERENCES payment_events(id),
    retry_count INTEGER DEFAULT 0,
    last_action_type VARCHAR(50),
    last_action_outcome VARCHAR(20),
    total_amount_recovered_cents INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_failure_history UNIQUE (tenant_id, payment_intent_id)
);

CREATE INDEX idx_failure_history_tenant ON payment_failure_history(tenant_id);
CREATE INDEX idx_failure_history_payment_intent ON payment_failure_history(payment_intent_id);

-- ----------------------------------------------------------------------------
-- Mandates
-- ----------------------------------------------------------------------------

CREATE TABLE mandates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mandate_id VARCHAR(100) UNIQUE NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    schema_version VARCHAR(10) NOT NULL DEFAULT '1.0',
    principal JSONB NOT NULL,
    agent JSONB NOT NULL,
    scope JSONB NOT NULL,
    risk_thresholds JSONB NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mandates_tenant ON mandates(tenant_id);
CREATE INDEX idx_mandates_mandate_id ON mandates(mandate_id);

-- ----------------------------------------------------------------------------
-- Failure Classifications
-- ----------------------------------------------------------------------------

CREATE TABLE failure_classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_event_id UUID NOT NULL REFERENCES payment_events(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    failure_type VARCHAR(50) NOT NULL,
    failure_category VARCHAR(20) NOT NULL,
    confidence DECIMAL(3,2) NOT NULL,
    reasoning TEXT NOT NULL,
    source VARCHAR(20) NOT NULL,
    context_used JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_classification UNIQUE (payment_event_id)
);

CREATE INDEX idx_classifications_tenant ON failure_classifications(tenant_id);
CREATE INDEX idx_classifications_failure_type ON failure_classifications(failure_type);
CREATE INDEX idx_classifications_failure_category ON failure_classifications(failure_category);

-- ----------------------------------------------------------------------------
-- Actions
-- ----------------------------------------------------------------------------

CREATE TABLE actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    payment_event_id UUID NOT NULL REFERENCES payment_events(id),
    mandate_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    autonomy_mode VARCHAR(20) NOT NULL DEFAULT 'approve',
    params JSONB DEFAULT '{}',
    result JSONB,
    error TEXT,
    reasoning TEXT NOT NULL,
    confidence DECIMAL(3,2) NOT NULL,
    trace_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_actions_tenant ON actions(tenant_id);
CREATE INDEX idx_actions_payment_event ON actions(payment_event_id);
CREATE INDEX idx_actions_status ON actions(status);
CREATE INDEX idx_actions_trace_id ON actions(trace_id);
CREATE INDEX idx_actions_created_at ON actions(created_at DESC);

-- ----------------------------------------------------------------------------
-- Playbook Rules
-- ----------------------------------------------------------------------------

CREATE TABLE playbook_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    priority INTEGER NOT NULL DEFAULT 100,
    enabled BOOLEAN DEFAULT true,
    conditions JSONB NOT NULL,
    action JSONB NOT NULL,
    autonomy_mode VARCHAR(20) NOT NULL DEFAULT 'approve',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_playbook_rules_tenant ON playbook_rules(tenant_id);
CREATE INDEX idx_playbook_rules_priority ON playbook_rules(priority);
CREATE INDEX idx_playbook_rules_enabled ON playbook_rules(enabled);

-- ----------------------------------------------------------------------------
-- Audit Log (Append-only with hash chain)
-- ----------------------------------------------------------------------------

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    payment_intent_id VARCHAR(255),
    action_id UUID,
    action_type VARCHAR(50),
    trace_id UUID NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    rationale TEXT,
    previous_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Append-only: no UPDATE or DELETE allowed
-- This is enforced via database role permissions (see below)

CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_payment_intent ON audit_log(payment_intent_id);
CREATE INDEX idx_audit_log_trace_id ON audit_log(trace_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ----------------------------------------------------------------------------
-- Approval Requests (HITL)
-- ----------------------------------------------------------------------------

CREATE TABLE approval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    action_id UUID NOT NULL REFERENCES actions(id),
    requested_by VARCHAR(255) NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_approval_requests_tenant ON approval_requests(tenant_id);
CREATE INDEX idx_approval_requests_action ON approval_requests(action_id);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);

-- ----------------------------------------------------------------------------
-- Circuit Breaker Status
-- ----------------------------------------------------------------------------

CREATE TABLE circuit_breaker_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    action_type VARCHAR(50) NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'closed',
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    last_state_change_at TIMESTAMPTZ DEFAULT NOW(),
    threshold_percentage DECIMAL(5,2) DEFAULT 20.00,
    threshold_window_minutes INTEGER DEFAULT 10,
    
    CONSTRAINT unique_circuit_breaker UNIQUE (tenant_id, action_type)
);

CREATE INDEX idx_circuit_breaker_tenant ON circuit_breaker_status(tenant_id);

-- ----------------------------------------------------------------------------
-- Connector Configs
-- ----------------------------------------------------------------------------

CREATE TABLE connector_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    connector_type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB NOT NULL,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_connector UNIQUE (tenant_id, connector_type)
);

CREATE INDEX idx_connector_configs_tenant ON connector_configs(tenant_id);

-- ----------------------------------------------------------------------------
-- Enriched Context Cache
-- ----------------------------------------------------------------------------

CREATE TABLE enriched_context_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_event_id UUID NOT NULL REFERENCES payment_events(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_data JSONB,
    customer_data JSONB,
    support_data JSONB,
    enrichment_sources JSONB DEFAULT '[]',
    enrichment_errors JSONB DEFAULT '[]',
    enriched_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    CONSTRAINT unique_enriched_context UNIQUE (payment_event_id)
);

CREATE INDEX idx_enriched_context_tenant ON enriched_context_cache(tenant_id);
CREATE INDEX idx_enriched_context_expires ON enriched_context_cache(expires_at);

-- ----------------------------------------------------------------------------
-- Database Roles for Security
-- ----------------------------------------------------------------------------

-- Application role with restricted permissions
-- CREATE ROLE app_write WITH LOGIN PASSWORD 'secure_password_here';

-- Grant INSERT only on audit_log (append-only)
-- GRANT INSERT ON audit_log TO app_write;
-- REVOKE UPDATE, DELETE ON audit_log FROM app_write;

-- Grant SELECT, INSERT, UPDATE on other tables
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_write;

-- ----------------------------------------------------------------------------
-- Initial Seed Data
-- ----------------------------------------------------------------------------

-- Insert default tenant for development
INSERT INTO tenants (id, name, slug, context_readiness)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Development Tenant',
    'dev-tenant',
    true
);

-- Insert default mandate
INSERT INTO mandates (id, mandate_id, tenant_id, schema_version, principal, agent, scope, risk_thresholds, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'M-2024-DEV',
    '00000000-0000-0000-0000-000000000001',
    '1.0',
    '{"type": "merchant", "id": "dev-tenant"}',
    '{"type": "system", "id": "payment-repair-v1"}',
    '{"actions": ["retry_soft_decline", "send_outreach", "escalate"], "max_retry_count": 5, "max_amount_usd": 10000, "require_3ds_acknowledgment": false, "validity_until": "2027-12-31T23:59:59Z"}',
    '{"step_up_above_usd": 5000}',
    'system'
);

-- Insert default playbook rules
INSERT INTO playbook_rules (tenant_id, name, priority, conditions, action, autonomy_mode)
VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    'Retry insufficient funds',
    100,
    '{"failure_types": ["insufficient_funds"], "retry_count_max": 3}',
    '{"type": "retry_soft_decline", "params": {"delay_hours": 24}}',
    'auto'
),
(
    '00000000-0000-0000-0000-000000000001',
    'Escalate lost/stolen cards',
    50,
    '{"failure_types": ["lost_card", "stolen_card"]}',
    '{"type": "escalate", "params": {"reason": "Card reported lost or stolen"}}',
    'manual'
),
(
    '00000000-0000-0000-0000-000000000001',
    'Send outreach for expired cards',
    80,
    '{"failure_types": ["card_expired"]}',
    '{"type": "send_outreach", "params": {"template": "card_expired"}}',
    'approve'
);