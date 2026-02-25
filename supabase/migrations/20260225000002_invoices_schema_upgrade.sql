-- Add missing columns to invoices table for full invoice system
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_link TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Migrate existing amount → subtotal/total for any existing rows
UPDATE invoices SET subtotal = amount, total = amount WHERE subtotal = 0 AND amount > 0;

-- Alter paid_date from DATE to TIMESTAMPTZ
ALTER TABLE invoices ALTER COLUMN paid_date TYPE TIMESTAMPTZ USING paid_date::TIMESTAMPTZ;

-- Add missing index
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);
