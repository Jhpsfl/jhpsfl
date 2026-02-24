import { createSupabaseAdmin } from './supabase';

// ── Types ──────────────────────────────────────────────────────
export interface EmailMessage {
  id: string;
  thread_id: string;
  lead_id: string | null;
  direction: 'outbound' | 'inbound';
  from_email: string;
  to_email: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  resend_message_id: string | null;
  read: boolean;
  created_at: string;
}

export interface EmailThread {
  thread_id: string;
  subject: string;
  to_email: string;
  from_email: string;
  latest_message: string;
  latest_body_preview: string;
  latest_direction: 'outbound' | 'inbound';
  message_count: number;
  unread_count: number;
  lead_id: string | null;
  created_at: string;
  customer_name?: string;
}

export interface SmsMessage {
  id: string;
  thread_id: string;
  lead_id: string | null;
  direction: 'outbound' | 'inbound';
  from_phone: string;
  to_phone: string;
  body: string;
  provider_message_id: string | null;
  provider_status: string | null;
  read: boolean;
  created_at: string;
}

// ── Log an email to Supabase ──────────────────────────────────
export async function logEmail(params: {
  thread_id?: string;
  lead_id?: string | null;
  direction: 'outbound' | 'inbound';
  from_email: string;
  to_email: string;
  subject: string;
  body_html?: string;
  body_text?: string;
  resend_message_id?: string;
}): Promise<EmailMessage | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('email_messages')
    .insert({
      thread_id: params.thread_id || undefined,
      lead_id: params.lead_id || null,
      direction: params.direction,
      from_email: params.from_email,
      to_email: params.to_email,
      subject: params.subject,
      body_html: params.body_html || null,
      body_text: params.body_text || null,
      resend_message_id: params.resend_message_id || null,
      read: params.direction === 'outbound',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to log email:', error);
    return null;
  }
  return data as EmailMessage;
}

// ── Log an SMS to Supabase (placeholder — call this once you have a provider) ──
export async function logSms(params: {
  thread_id?: string;
  lead_id?: string | null;
  direction: 'outbound' | 'inbound';
  from_phone: string;
  to_phone: string;
  body: string;
  provider_message_id?: string;
  provider_status?: string;
}): Promise<SmsMessage | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('sms_messages')
    .insert({
      thread_id: params.thread_id || undefined,
      lead_id: params.lead_id || null,
      direction: params.direction,
      from_phone: params.from_phone,
      to_phone: params.to_phone,
      body: params.body,
      provider_message_id: params.provider_message_id || null,
      provider_status: params.provider_status || null,
      read: params.direction === 'outbound',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to log SMS:', error);
    return null;
  }
  return data as SmsMessage;
}

// ── Branded HTML Reply Template ───────────────────────────────
export function buildReplyHtml(toName: string, replyBody: string, originalSubject: string): string {
  const formattedBody = replyBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Re: ${originalSubject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:28px 32px;border-radius:12px 12px 0 0;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                Jenkins Home &amp; Property Solutions
              </h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
                Central Florida&rsquo;s Trusted Property Services
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;">
              <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">
                Hi ${toName},
              </p>
              <div style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.7;">
                ${formattedBody}
              </div>
              <p style="margin:24px 0 0;color:#333;font-size:15px;line-height:1.6;">
                Best regards,<br>
                <strong style="color:#2E7D32;">Jenkins Home &amp; Property Solutions</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;padding:20px 32px;border-radius:0 0 12px 12px;border-top:1px solid #eee;">
              <p style="margin:0 0 4px;color:#888;font-size:12px;">
                📞 <a href="tel:4076869817" style="color:#2E7D32;text-decoration:none;">(407) 686-9817</a>
                &nbsp;&middot;&nbsp;
                ✉️ <a href="mailto:info@jhpsfl.com" style="color:#2E7D32;text-decoration:none;">info@jhpsfl.com</a>
              </p>
              <p style="margin:0;color:#aaa;font-size:11px;">
                Serving Deltona, Orlando, Sanford, DeLand, Daytona Beach &amp; all of Central Florida
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
