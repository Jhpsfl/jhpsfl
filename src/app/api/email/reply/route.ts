import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdmin } from '@/lib/supabase';
import { logEmail, buildReplyHtml } from '@/lib/email';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clerk_user_id, thread_id, to_email, to_name, subject, reply_body, lead_id } = body;

  if (!clerk_user_id || !thread_id || !to_email || !reply_body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify admin
  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', clerk_user_id)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Build branded HTML
  const customerName = to_name || to_email.split('@')[0];
  const replySubject = subject?.startsWith('Re:') ? subject : `Re: ${subject || 'Your inquiry'}`;
  const html = buildReplyHtml(customerName, reply_body, subject || 'Your inquiry');

  // Send via Resend
  let resendMessageId: string | undefined;
  try {
    const { data, error } = await resend.emails.send({
      from: 'JHPS Florida <info@jhpsfl.com>',
      to: [to_email],
      subject: replySubject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    resendMessageId = data?.id;
  } catch (err) {
    console.error('Resend exception:', err);
    return NextResponse.json({ error: 'Email service error' }, { status: 500 });
  }

  // Log to email_messages
  const logged = await logEmail({
    thread_id,
    lead_id: lead_id || null,
    direction: 'outbound',
    from_email: 'info@jhpsfl.com',
    to_email,
    subject: replySubject,
    body_html: html,
    body_text: reply_body,
    resend_message_id: resendMessageId,
  });

  return NextResponse.json({
    success: true,
    message_id: logged?.id,
    resend_id: resendMessageId,
  });
}
