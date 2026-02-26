-- Allow invoices without a customer (link-only invoices)
-- The customer will be linked when the recipient pays via the payment link
ALTER TABLE invoices ALTER COLUMN customer_id DROP NOT NULL;
