-- Customer type: residential (default) or commercial
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type text NOT NULL DEFAULT 'residential'
  CHECK (customer_type IN ('residential', 'commercial'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name text;

-- Per-invoice verification overrides
-- Example: { "allow_upload": true, "verification_mode": "document", "document_types": ["loa", "business_license"] }
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS verification_settings jsonb DEFAULT '{}'::jsonb;
