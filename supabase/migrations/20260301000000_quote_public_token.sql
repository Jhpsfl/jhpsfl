-- Add public_token to quotes for shareable estimate links
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_public_token ON quotes(public_token);

-- Backfill existing quotes
UPDATE quotes SET public_token = gen_random_uuid() WHERE public_token IS NULL;
