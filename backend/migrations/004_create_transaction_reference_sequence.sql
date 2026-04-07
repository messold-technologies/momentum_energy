-- Global sequence for transaction references like UHM1300, UHM1301, ...
-- NOTE: Uses a Postgres sequence for atomic increment across all users/sessions.

CREATE SEQUENCE IF NOT EXISTS transaction_reference_seq
  START WITH 1300
  INCREMENT BY 1
  MINVALUE 1300;

