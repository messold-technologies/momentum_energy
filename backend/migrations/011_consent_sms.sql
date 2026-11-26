-- Texting the consent link to the customer, through Twilio.
--
-- Recorded per sale so there is an answer to "did the customer actually get it?", and
-- so the count can be capped: each send costs money and the agent portal is reachable
-- by anyone holding a channel password.
--
-- The number is stored masked. The full number is already in the payload; a second
-- copy in a column that gets selected into lists and logs is a liability, and a masked
-- one answers the only question an agent asks here -- which number did this go to.

ALTER TABLE agent_sales
  ADD COLUMN IF NOT EXISTS consent_sms_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE agent_sales
  ADD COLUMN IF NOT EXISTS consent_sms_sent_at TIMESTAMPTZ;

ALTER TABLE agent_sales
  ADD COLUMN IF NOT EXISTS consent_sms_to TEXT;

-- Twilio's message sid and the status it reported when queued, for chasing a delivery.
ALTER TABLE agent_sales
  ADD COLUMN IF NOT EXISTS consent_sms_sid TEXT;

ALTER TABLE agent_sales
  ADD COLUMN IF NOT EXISTS consent_sms_status TEXT;
