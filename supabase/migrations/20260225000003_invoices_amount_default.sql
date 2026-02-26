-- Make legacy `amount` column safe: add DEFAULT 0 so inserts without it never fail.
-- The new invoice system uses subtotal/total; amount is kept for backwards compat.
ALTER TABLE invoices ALTER COLUMN amount SET DEFAULT 0;
