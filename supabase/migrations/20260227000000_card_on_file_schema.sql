-- ============================================================
-- Card-on-File & Recurring Billing Schema
-- Run via Supabase SQL editor
-- ============================================================

-- 1. Add square_customer_id to customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS square_customer_id text;

-- 2. Create stored_cards table
CREATE TABLE IF NOT EXISTS stored_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  square_card_id text NOT NULL,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stored_cards ENABLE ROW LEVEL SECURITY;

-- Service-role only (API routes use service key)
CREATE POLICY "Service role full access on stored_cards"
  ON stored_cards
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_stored_cards_customer ON stored_cards(customer_id);

-- 3. Add billing_mode to subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_mode text DEFAULT 'manual'
    CHECK (billing_mode IN ('manual', 'auto'));

-- 4. Add subscription_id to payments (link recurring charges)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;

-- 5. Create billing_log table
CREATE TABLE IF NOT EXISTS billing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  amount numeric(10,2),
  status text NOT NULL CHECK (status IN ('success', 'failed', 'no_card', 'skipped')),
  square_payment_id text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE billing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on billing_log"
  ON billing_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_billing_log_subscription ON billing_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_log_created ON billing_log(created_at DESC);
