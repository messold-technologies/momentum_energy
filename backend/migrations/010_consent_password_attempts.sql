-- The consent page is now gated by a password the customer derives from their own
-- details: postcode followed by the two-digit day of their date of birth.
--
-- That is a small secret -- four of its six digits are the postcode, which is often
-- guessable from context, leaving about 31 possibilities for the day. IP rate limiting
-- alone does not cover an attacker with more than one address, so failures are counted
-- against the sale itself and the link locks after too many.
--
-- A locked link is reopened by the agent issuing a new one, which resets the count.

ALTER TABLE agent_sales
  ADD COLUMN IF NOT EXISTS consent_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE agent_sales
  ADD COLUMN IF NOT EXISTS consent_locked_at TIMESTAMPTZ;
