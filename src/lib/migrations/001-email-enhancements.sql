-- ═══════════════════════════════════════════════════════════════
-- Email System Enhancement Migration
-- Adds: folders, starring, contacts, attachments, drafts
-- ═══════════════════════════════════════════════════════════════

-- 1. Add new columns to email_messages
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS folder text DEFAULT 'inbox';
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS cc_emails text[] DEFAULT '{}';
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS bcc_emails text[] DEFAULT '{}';

-- Set folder for existing messages based on direction
UPDATE email_messages SET folder = 'sent' WHERE direction = 'outbound' AND folder = 'inbox';

-- 2. Create email_contacts table
CREATE TABLE IF NOT EXISTS email_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  category text DEFAULT 'other',  -- vendor, customer, supplier, contractor, other
  notes text,
  starred boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON email_contacts FOR ALL USING (true) WITH CHECK (true);

-- Unique constraint on email to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS email_contacts_email_unique ON email_contacts (lower(email));

-- 3. Create email_attachments table
CREATE TABLE IF NOT EXISTS email_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid REFERENCES email_messages(id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text DEFAULT 'application/octet-stream',
  size_bytes bigint DEFAULT 0,
  s3_key text NOT NULL,
  s3_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON email_attachments FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookup by message_id
CREATE INDEX IF NOT EXISTS email_attachments_message_id_idx ON email_attachments (message_id);

-- 4. Indexes for folder-based queries
CREATE INDEX IF NOT EXISTS email_messages_folder_idx ON email_messages (folder);
CREATE INDEX IF NOT EXISTS email_messages_starred_idx ON email_messages (starred) WHERE starred = true;
CREATE INDEX IF NOT EXISTS email_messages_is_draft_idx ON email_messages (is_draft) WHERE is_draft = true;

-- 5. Update the get_email_threads RPC to include folder filtering
CREATE OR REPLACE FUNCTION get_email_threads(p_folder text DEFAULT NULL)
RETURNS TABLE (
  thread_id text,
  subject text,
  to_email text,
  from_email text,
  latest_message timestamptz,
  latest_body_preview text,
  latest_direction text,
  message_count bigint,
  unread_count bigint,
  starred boolean,
  has_attachments boolean,
  lead_id uuid,
  created_at timestamptz,
  customer_name text
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH thread_data AS (
    SELECT
      em.thread_id,
      em.subject,
      CASE WHEN em.direction = 'outbound' THEN em.to_email ELSE em.from_email END AS contact_email,
      CASE WHEN em.direction = 'outbound' THEN em.from_email ELSE em.to_email END AS self_email,
      em.created_at,
      em.direction,
      COALESCE(em.body_text, LEFT(REGEXP_REPLACE(COALESCE(em.body_html, ''), '<[^>]+>', '', 'g'), 120)) AS body_preview,
      em.read,
      em.starred,
      em.has_attachments,
      em.lead_id,
      em.folder,
      ROW_NUMBER() OVER (PARTITION BY em.thread_id ORDER BY em.created_at DESC) AS rn
    FROM email_messages em
    WHERE em.is_draft = false
      AND (p_folder IS NULL OR em.folder = p_folder OR (p_folder = 'starred' AND em.starred = true))
      AND em.folder != 'trash'
  )
  SELECT
    td.thread_id,
    td.subject,
    td.contact_email AS to_email,
    td.self_email AS from_email,
    td.created_at AS latest_message,
    LEFT(td.body_preview, 120) AS latest_body_preview,
    td.direction AS latest_direction,
    COUNT(*) OVER (PARTITION BY td.thread_id) AS message_count,
    COUNT(*) FILTER (WHERE NOT td.read) OVER (PARTITION BY td.thread_id) AS unread_count,
    BOOL_OR(td.starred) OVER (PARTITION BY td.thread_id) AS starred,
    BOOL_OR(td.has_attachments) OVER (PARTITION BY td.thread_id) AS has_attachments,
    td.lead_id,
    MIN(td.created_at) OVER (PARTITION BY td.thread_id) AS created_at,
    vl.name AS customer_name
  FROM thread_data td
  LEFT JOIN video_leads vl ON td.lead_id = vl.id
  WHERE td.rn = 1
  ORDER BY td.created_at DESC;
END;
$$;
