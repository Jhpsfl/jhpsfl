import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdmin } from '@/lib/supabase';
import { logEmail, buildReplyHtml } from '@/lib/email';
import { randomUUID } from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clerk_user_id, to_email, to_name, subject, body: emailBody, lead_id } = body;

  if (!clerk_user_id || !to_email || !subject || !emailBody) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase.from('admin_users').select('id').eq('clerk_user_id', clerk_user_id).single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const thread_id = randomUUID();
  const customerName = to_name || to_email.split('@')[0];
  const html = buildReplyHtml(customerName, emailBody, subject);

  let resendMessageId: string | undefined;
  try {
    const { data, error } = await resend.emails.send({
      from: 'JHPS Florida <info@jhpsfl.com>',
      to: [to_email],
      subject,
      html,
    });
    if (error) return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    resendMessageId = data?.id;
  } catch {
    return NextResponse.json({ error: 'Email service error' }, { status: 500 });
  }

  const logged = await logEmail({
    thread_id,
    lead_id: lead_id || null,
    direction: 'outbound',
    from_email: 'info@jhpsfl.com',
    to_email,
    subject,
    body_html: html,
    body_text: emailBody,
    resend_message_id: resendMessageId,
  });

  return NextResponse.json({ success: true, thread_id, message_id: logged?.id, resend_id: resendMessageId });
}
