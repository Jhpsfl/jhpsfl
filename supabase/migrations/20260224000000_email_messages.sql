-- ═══════════════════════════════════════════════════════════════
-- JHPS Messaging System — Email + SMS (placeholder) Tables
-- ═══════════════════════════════════════════════════════════════

-- ─── Email Messages ───
CREATE TABLE email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES video_leads(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  from_email text NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body_html text,
  body_text text,
  resend_message_id text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX idx_email_messages_to ON email_messages(to_email);
CREATE INDEX idx_email_messages_created ON email_messages(created_at DESC);
CREATE INDEX idx_email_messages_direction ON email_messages(direction);
CREATE INDEX idx_email_messages_unread ON email_messages(read) WHERE read = false;
CREATE INDEX idx_email_messages_lead ON email_messages(lead_id) WHERE lead_id IS NOT NULL;

ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;


-- ─── SMS Messages (placeholder for future phone messaging API) ───
-- Ready for Twilio / Vonage / MessageBird / etc.
-- The admin Messages tab will query this alongside email_messages.
CREATE TABLE sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES video_leads(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  from_phone text NOT NULL,
  to_phone text NOT NULL,
  body text NOT NULL,
  provider_message_id text,        -- Twilio SID, Vonage ID, etc.
  provider_status text,            -- queued, sent, delivered, failed, received
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sms_messages_thread ON sms_messages(thread_id);
CREATE INDEX idx_sms_messages_to ON sms_messages(to_phone);
CREATE INDEX idx_sms_messages_created ON sms_messages(created_at DESC);
CREATE INDEX idx_sms_messages_unread ON sms_messages(read) WHERE read = false;
CREATE INDEX idx_sms_messages_lead ON sms_messages(lead_id) WHERE lead_id IS NOT NULL;

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
