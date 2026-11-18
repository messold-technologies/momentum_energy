-- The agent portal is entered with a shared password rather than per-agent credentials,
-- so every agent sale belongs to this one account.
--
-- Trade-off this records: there is no per-agent identity. Who actually took a sale is
-- whatever the agent typed into portalMeta.agentName, which is self-reported. If
-- per-agent attribution is wanted later, agent_users already supports it -- give agents
-- their own rows and drop this one.
--
-- The password hash column is filled with a value that cannot match any bcrypt
-- comparison, because this row is never authenticated against: the shared password is
-- checked in config, not here.

INSERT INTO agent_users (id, email, name, password_hash, is_active)
VALUES (
  '00000000-0000-0000-0000-00000000a9e7',
  'agent-portal@utilityhub.local',
  'Agent Portal',
  'x-not-a-bcrypt-hash-x',
  true
)
ON CONFLICT (email) DO NOTHING;
