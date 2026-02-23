-- ============================================================
-- JHPS Phase 5a: Video Quote Lead Engine Tables
-- Run this in Supabase SQL Editor or via CLI
-- ============================================================

-- ─── video_leads: Core lead intake table ───
CREATE TABLE IF NOT EXISTS video_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact info (collected without auth)
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,

  -- Property info
  address TEXT NOT NULL,
  city TEXT DEFAULT 'Deltona',
  state TEXT DEFAULT 'FL',
  zip TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  -- Service details
  property_type TEXT NOT NULL DEFAULT 'residential' CHECK (property_type IN ('residential', 'commercial')),
  service_requested TEXT NOT NULL,
  modifier_data JSONB DEFAULT '{}',
  customer_notes TEXT,

  -- Lot data (Phase 6 calculator)
  lot_size_sqft INTEGER,

  -- Identity stitching (linked after quote acceptance)
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Workflow
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'quoted', 'accepted', 'converted', 'declined', 'expired')),
  admin_notes TEXT,
  assigned_to TEXT, -- clerk_user_id of admin reviewing

  -- Conversion tracking
  converted_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── lead_media: Videos and photos attached to leads ───
CREATE TABLE IF NOT EXISTS lead_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES video_leads(id) ON DELETE CASCADE,

  -- File info
  media_type TEXT NOT NULL CHECK (media_type IN ('video', 'photo')),
  storage_path TEXT NOT NULL,        -- B2 object key
  thumbnail_path TEXT,               -- B2 thumbnail key
  original_filename TEXT,
  content_type TEXT,
  file_size_bytes INTEGER DEFAULT 0,
  duration_seconds INTEGER,          -- Video only

  -- Context
  capture_context TEXT,              -- Which shot list item (e.g. 'front_yard_wide', 'palm_height')
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── lead_quotes: Admin-generated quotes for leads ───
CREATE TABLE IF NOT EXISTS lead_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES video_leads(id) ON DELETE CASCADE,

  -- Quote author
  quoted_by TEXT NOT NULL,           -- Admin clerk_user_id

  -- Pricing
  line_items JSONB DEFAULT '[]',     -- Array of {service, description, quantity, unit_price}
  subtotal NUMERIC(10, 2),
  total_low NUMERIC(10, 2),          -- Confidence range low
  total_high NUMERIC(10, 2),         -- Confidence range high

  -- Communication
  notes_to_customer TEXT,
  internal_notes TEXT,

  -- Validity
  valid_until DATE,

  -- Workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_video_leads_status ON video_leads(status);
CREATE INDEX IF NOT EXISTS idx_video_leads_email ON video_leads(email);
CREATE INDEX IF NOT EXISTS idx_video_leads_customer_id ON video_leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_video_leads_created ON video_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_media_lead_id ON lead_media(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_quotes_lead_id ON lead_quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_quotes_status ON lead_quotes(status);

-- ─── Auto-update timestamps trigger ───
CREATE OR REPLACE FUNCTION update_video_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS video_leads_updated_at ON video_leads;
CREATE TRIGGER video_leads_updated_at
  BEFORE UPDATE ON video_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_video_leads_updated_at();

-- ─── RLS Policies ───
ALTER TABLE video_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_quotes ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used in API routes)
-- No public access policies needed since all access goes through API routes
