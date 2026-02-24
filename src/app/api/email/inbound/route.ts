import { NextRequest, NextResponse } from 'next/server';
import { logEmail } from '@/lib/email';
import { createSupabaseAdmin } from '@/lib/supabase';

/**
 * Inbound Email Webhook
 * 
 * Wire this up later via:
 *   Option A: Cloudflare Email Routing on reply.jhpsfl.com → worker POSTs here
 *   Option B: Zoho filter → parser service → POST here
 * 
 * Expected payload:
 * {
 *   from_email: string,
 *   to_email: string,       // reply@mail.jhpsfl.com or info@jhpsfl.com
 *   subject: string,
 *   body_text: string,
 *   body_html?: string,
 *   in_reply_to?: string,   // Resend message ID from original email
 * }
 */
export async function POST(req: NextRequest) {
  // Optional: verify webhook secret
  const webhookSecret = req.headers.get('x-webhook-secret');
  if (process.env.EMAIL_WEBHOOK_SECRET && webhookSecret !== process.env.EMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { from_email, to_email, subject, body_text, body_html, in_reply_to } = body;

  if (!from_email || !subject) {
    return NextResponse.json({ error: 'Missing from_email or subject' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  // Try to find existing thread by matching the in_reply_to resend_message_id
  let threadId: string | undefined;
  let leadId: string | null = null;

  if (in_reply_to) {
    const { data: original } = await supabase
      .from('email_messages')
      .select('thread_id, lead_id')
      .eq('resend_message_id', in_reply_to)
      .single();

    if (original) {
      threadId = original.thread_id;
      leadId = original.lead_id;
    }
  }

  // If no thread found via in_reply_to, try matching by from_email + subject
  if (!threadId) {
    const cleanSubject = subject.replace(/^(Re:|Fwd?:)\s*/gi, '').trim();
    const { data: match } = await supabase
      .from('email_messages')
      .select('thread_id, lead_id')
      .eq('to_email', from_email)
      .ilike('subject', `%${cleanSubject}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (match) {
      threadId = match.thread_id;
      leadId = match.lead_id;
    }
  }

  // Log inbound message
  const logged = await logEmail({
    thread_id: threadId,
    lead_id: leadId,
    direction: 'inbound',
    from_email,
    to_email: to_email || 'info@jhpsfl.com',
    subject,
    body_html: body_html || null,
    body_text: body_text || null,
  });

  return NextResponse.json({
    success: true,
    message_id: logged?.id,
    thread_id: logged?.thread_id,
    matched_existing_thread: !!threadId,
  });
}
