import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdmin } from '@/lib/supabase';
import { logEmail, buildReplyHtml } from '@/lib/email';

const getResend = () => new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    clerk_user_id,
    thread_id,
    to_email,
    to_name,
    subject,
    reply_body,
    reply_html,
    lead_id,
    attachments,
  } = body;

  if (!clerk_user_id || !thread_id || !to_email || (!reply_body && !reply_html)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', clerk_user_id)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const customerName = to_name || to_email.split('@')[0];
  const replySubject = subject?.startsWith('Re:') ? subject : `Re: ${subject || 'Your inquiry'}`;

  // Use rich HTML if provided, otherwise plain text
  const plainText = reply_body || stripHtml(reply_html || '');
  const html = reply_html
    ? buildRichReplyHtml(customerName, reply_html, subject || 'Your inquiry')
    : buildReplyHtml(customerName, reply_body, subject || 'Your inquiry');

  // Build Resend attachments from S3 URLs
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
      subject: replySubject,
      html,
    };
    if (resendAttachments.length) sendParams.attachments = resendAttachments;

    const { data, error } = await r.emails.send(sendParams);
    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
    resendMessageId = data?.id;
  } catch (err) {
    console.error('Resend exception:', err);
    return NextResponse.json({ error: 'Email service error' }, { status: 500 });
  }

  const logged = await logEmail({
    thread_id,
    lead_id: lead_id || null,
    direction: 'outbound',
    from_email: 'info@jhpsfl.com',
    to_email,
    subject: replySubject,
    body_html: html,
    body_text: plainText,
    resend_message_id: resendMessageId,
    folder: 'sent',
    has_attachments: resendAttachments.length > 0,
  });

  // Log attachments
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

  return NextResponse.json({
    success: true,
    message_id: logged?.id,
    resend_id: resendMessageId,
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

function buildRichReplyHtml(toName: string, richBody: string, originalSubject: string): string {
  return buildReplyHtml(toName, '', originalSubject).replace(
    /(<div style="[^"]*">)\s*(<\/div>)/,
    `$1${richBody}$2`
  ) || buildReplyHtml(toName, stripHtml(richBody), originalSubject);
}
