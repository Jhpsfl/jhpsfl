-- Automatic monthly billing for NexaVision customers, and safer charging for everyone.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'jhps',
  ADD COLUMN IF NOT EXISTS external_order_id text,
  ADD COLUMN IF NOT EXISTS card_token text,
  ADD COLUMN IF NOT EXISTS square_card_id text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS card_authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS card_auth jsonb,
  ADD COLUMN IF NOT EXISTS return_url text,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS plan_note text,
  ADD COLUMN IF NOT EXISTS billing_day integer,
  ADD COLUMN IF NOT EXISTS extra_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_note text,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_on date,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS reminded_for date,
  ADD COLUMN IF NOT EXISTS charge_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_external_order_id_key ON subscriptions(external_order_id) WHERE external_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_card_token_key ON subscriptions(card_token) WHERE card_token IS NOT NULL;

-- Lets a charge be claimed before it runs, so one billing date can never charge twice.
ALTER TABLE billing_log ADD COLUMN IF NOT EXISTS charge_key text;
CREATE UNIQUE INDEX IF NOT EXISTS billing_log_charge_key_key ON billing_log(charge_key) WHERE charge_key IS NOT NULL;

ALTER TABLE billing_log DROP CONSTRAINT IF EXISTS billing_log_status_check;
ALTER TABLE billing_log ADD CONSTRAINT billing_log_status_check CHECK (status IN ('pending', 'success', 'failed', 'no_card', 'skipped'));

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('active', 'paused', 'cancelled', 'canceled', 'awaiting_card', 'ready', 'past_due', 'on_hold'));

-- The month a usage amount covers, so an automated re-run can't bill the same month twice.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS extra_period text,
  ADD COLUMN IF NOT EXISTS last_billed_period text;

-- Charges over the limit wait for approval of that exact amount on that exact date.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS charge_limit numeric(10,2) NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS approved_cents integer,
  ADD COLUMN IF NOT EXISTS approved_for date,
  ADD COLUMN IF NOT EXISTS approval_alerted_for text;

-- The invoice for what's due at signing, paid on the same card form that saves the card.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS due_invoice text;
