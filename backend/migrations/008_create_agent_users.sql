-- Agent accounts for the agent portal.
--
-- Deliberately a SEPARATE table from `users`, not a flag on it. Agents sign themselves
-- up, so if their rows lived in `users` they could take the same credentials to
-- /api/auth/login and receive a staff token -- which reaches /api/transactions,
-- /api/submissions and /api/drafts. A separate table makes that escalation impossible
-- rather than relying on a check in the staff login remembering to exclude them.

CREATE TABLE IF NOT EXISTS agent_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  password_hash VARCHAR(255) NOT NULL,

  -- Signup is open, so this is the lever for cutting off an agent without deleting
  -- their sales history.
  is_active BOOLEAN NOT NULL DEFAULT true,

  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_users_email ON agent_users (lower(email));

-- Sales created through the agent portal belong to an agent_user, not a staff user.
ALTER TABLE agent_sales
  ADD COLUMN IF NOT EXISTS agent_user_id UUID REFERENCES agent_users(id) ON DELETE SET NULL;

-- created_by stays for sales a staff member captured directly, but is no longer required.
ALTER TABLE agent_sales
  ALTER COLUMN created_by DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_sales_agent_user
  ON agent_sales (agent_user_id, created_at DESC);
