-- Agent-originated sales, captured on the agent portal and reviewed by QA before any
-- submission to Momentum.
--
-- Deliberately separate from `drafts` and `submissions`: those belong to the existing
-- direct-entry flow and are left untouched. A row here only becomes a `submissions` row
-- once QA actually submits it.
--
-- Lifecycle:
--   agent_draft       agent still capturing
--   awaiting_consent  consent link issued to the customer
--   consented         customer ticked the consent statements
--   submitted         QA sent it to Momentum and got a salesTransactionId
--   rejected          QA rejected it
--   cancelled         withdrawn by the agent

CREATE TABLE IF NOT EXISTS agent_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id VARCHAR(50) NOT NULL DEFAULT 'momentum',

  status VARCHAR(30) NOT NULL DEFAULT 'agent_draft'
    CHECK (status IN ('agent_draft', 'awaiting_consent', 'consented', 'submitted', 'rejected', 'cancelled')),

  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- The in-progress Momentum payload, same shape the submit wizard uses.
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Snapshot of the plan card the agent showed, so the price the customer saw is stored
  -- next to the offer code that will be submitted and the two can be reconciled.
  selected_plan JSONB,

  -- Denormalised for the QA queue, so listing does not need to dig through the payload.
  customer_name VARCHAR(300),
  customer_email VARCHAR(320),
  service_address TEXT,
  transaction_reference VARCHAR(60),

  -- Consent link. Only a SHA-256 hash of the token is stored: a database leak must not
  -- hand someone a working consent URL.
  consent_token_hash VARCHAR(64) UNIQUE,
  consent_token_expires_at TIMESTAMPTZ,
  consent_sent_at TIMESTAMPTZ,

  -- What the customer actually agreed to, with the evidence.
  consent JSONB,
  consented_at TIMESTAMPTZ,
  consent_ip VARCHAR(100),
  consent_user_agent TEXT,

  -- QA outcome.
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  sales_transaction_id VARCHAR(255),
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sales_queue
  ON agent_sales (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_sales_created_by
  ON agent_sales (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_sales_token
  ON agent_sales (consent_token_hash) WHERE consent_token_hash IS NOT NULL;
