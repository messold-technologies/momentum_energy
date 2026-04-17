-- Company-scoped storage for drafts + submissions.
-- Existing rows are backfilled to Momentum to keep behavior unchanged.

ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);

UPDATE drafts
SET company_id = 'momentum'
WHERE company_id IS NULL;

ALTER TABLE drafts
  ALTER COLUMN company_id SET DEFAULT 'momentum';

ALTER TABLE drafts
  ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_drafts_user_company_updated_at
  ON drafts(user_id, company_id, updated_at DESC);

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);

UPDATE submissions
SET company_id = 'momentum'
WHERE company_id IS NULL;

ALTER TABLE submissions
  ALTER COLUMN company_id SET DEFAULT 'momentum';

ALTER TABLE submissions
  ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_user_company_created_at
  ON submissions(user_id, company_id, created_at DESC);

