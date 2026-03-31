-- Add is_admin flag to users and backfill configured admins
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark specific admin emails as admins
UPDATE users
SET is_admin = true
WHERE lower(email) IN (
  'mudit.gupta@utilityhub.com.au',
  'aseem.gupta@utilityhub.com.au',
  'bipasha.roy@messold.com'
);

