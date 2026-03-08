import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Resend } from 'resend';
import { createSupabaseAdmin } from '@/lib/supabase';
import { logEmail, buildReplyHtml } from '@/lib/email';
import { randomUUID } from 'crypto';

const getResend = () => new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    to_email,
    to_name,
    subject,
    body: emailBody,
    body_html: richHtml,
    lead_id,
    draft_id,
    cc_emails,
    bcc_emails,
    attachments,
  } = body;

  if (!to_email || !subject || (!emailBody && !richHtml)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase.from('admin_users').select('id').eq('clerk_user_id', userId).single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const thread_id = randomUUID();
  const customerName = to_name || to_email.split('@')[0];

  // If rich HTML is provided, wrap it in the branded template; otherwise use plain text
  const html = richHtml
    ? buildRichHtml(customerName, richHtml, subject)
    : buildReplyHtml(customerName, emailBody, subject);

  // Build Resend attachments from S3 URLs if provided
  const resendAttachments: Array<{ filename: string; path: string }> = [];
  if (attachments?.length) {
    for (const att of attachments as Array<{ filename: string; s3_url: string }>) {
      resendAttachments.push({ filename: att.filename, path: att.s3_url });
    }
  }

  let resendMessageId: string | undefined;
  try {
    const r = getResend();
    const sendParams: Parameters<typeof r.emails.send>[0] = {
      from: 'JHPS Florida <info@jhpsfl.com>',
      to: [to_email],
      subject,
      html,
    };
    if (cc_emails?.length) sendParams.cc = cc_emails;
    if (bcc_emails?.length) sendParams.bcc = bcc_emails;
    if (resendAttachments.length) sendParams.attachments = resendAttachments;

    const { data, error } = await r.emails.send(sendParams);
    if (error) return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    resendMessageId = data?.id;
  } catch {
    return NextResponse.json({ error: 'Email service error' }, { status: 500 });
  }

  // If this was a draft being sent, delete the draft first
  if (draft_id) {
    await supabase.from('email_messages').delete().eq('id', draft_id).eq('is_draft', true);
  }

  const logged = await logEmail({
    thread_id,
    lead_id: lead_id || null,
    direction: 'outbound',
    from_email: 'info@jhpsfl.com',
    to_email,
    subject,
    body_html: html,
    body_text: emailBody || stripHtml(richHtml || ''),
    resend_message_id: resendMessageId,
    folder: 'sent',
    has_attachments: resendAttachments.length > 0,
    cc_emails: cc_emails || [],
    bcc_emails: bcc_emails || [],
  });

  // If there are file attachments, log them
  if (attachments?.length && logged) {
    for (const att of attachments as Array<{ filename: string; content_type: string; size_bytes: number; s3_key: string; s3_url: string }>) {
      await supabase.from('email_attachments').insert({
        message_id: logged.id,
        filename: att.filename,
        content_type: att.content_type || 'application/octet-stream',
        size_bytes: att.size_bytes || 0,
        s3_key: att.s3_key,
        s3_url: att.s3_url,
      });
    }
  }

  return NextResponse.json({ success: true, thread_id, message_id: logged?.id, resend_id: resendMessageId });
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

function buildRichHtml(toName: string, richBody: string, originalSubject: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${originalSubject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
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
          <tr>
            <td style="background:#ffffff;padding:32px;">
              <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">
                Hi ${toName},
              </p>
              <div style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.7;">
                ${richBody}
              </div>
              <p style="margin:24px 0 0;color:#333;font-size:15px;line-height:1.6;">
                Best regards,<br>
                <strong style="color:#2E7D32;">Jenkins Home &amp; Property Solutions</strong>
              </p>
            </td>
          </tr>
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
