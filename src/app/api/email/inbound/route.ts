import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { Resend } from 'resend';
import { logEmail } from '@/lib/email';
import { createSupabaseAdmin } from '@/lib/supabase';

const resend = new Resend(process.env.RESEND_API_KEY);

// Extract plain email address from "Display Name <email@x.com>" format
function parseEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : raw.toLowerCase().trim();
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify Resend webhook signature (svix-based)
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
    }

    try {
      const wh = new Webhook(secret);
      wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only handle inbound received events
  if (event.type !== 'email.received') {
    return NextResponse.json({ success: true, skipped: true });
  }

  const { email_id, from, to, subject } = event.data as {
    email_id: string;
    from: string;
    to: string | string[];
    subject: string;
  };

  // Fetch full email body from Resend
  let body_html: string | null = null;
  let body_text: string | null = null;
  let in_reply_to: string | null = null;

  try {
    const resp = await fetch(`https://api.resend.com/emails/receiving/${email_id}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (resp.ok) {
      const full = await resp.json();
      body_html = full.html || null;
      body_text = full.text || null;
      // Check In-Reply-To header for thread matching
      const headers = full.headers || {};
      in_reply_to = headers['in-reply-to'] || headers['In-Reply-To'] || null;
      // Strip angle brackets from message-id references
      if (in_reply_to) in_reply_to = in_reply_to.replace(/[<>]/g, '').trim();
    }
  } catch (err) {
    console.error('Failed to fetch full email from Resend:', err);
  }

  const from_email = parseEmail(typeof from === 'string' ? from : String(from));
  const to_email = parseEmail(
    typeof to === 'string' ? to : Array.isArray(to) ? to[0] : 'info@jhpsfl.com'
  );
  const subjectStr = subject || '(no subject)';

  const supabase = createSupabaseAdmin();

  // Try to find existing thread via In-Reply-To
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

  // Fallback: match by sender email + subject keywords
  if (!threadId) {
    const cleanSubject = subjectStr.replace(/^(Re:|Fwd?:)\s*/gi, '').trim();
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

  // Store in DB
  const logged = await logEmail({
    thread_id: threadId,
    lead_id: leadId,
    direction: 'inbound',
    from_email,
    to_email,
    subject: subjectStr,
    body_html: body_html ?? undefined,
    body_text: body_text ?? undefined,
  });

  // Forward a copy to Gmail so it's readable from any device
  const forwardTo = process.env.EMAIL_FORWARD_TO || 'FRLawnCareFL@gmail.com';
  try {
    await resend.emails.send({
      from: 'JHPS Inbox <info@jhpsfl.com>',
      to: [forwardTo],
      subject: `[Inbound] ${subjectStr}`,
      html: body_html
        ? `<p style="color:#888;font-size:12px;margin-bottom:16px">Forwarded from: ${from}<br>To: ${to_email}</p>${body_html}`
        : `<p style="color:#888;font-size:12px;margin-bottom:16px">From: ${from}</p><pre>${body_text || ''}</pre>`,
      text: `From: ${from}\n\n${body_text || ''}`,
      replyTo: from_email,
    });
  } catch (err) {
    console.error('Forward to Gmail failed (non-fatal):', err);
  }

  return NextResponse.json({
    success: true,
    message_id: logged?.id,
    thread_id: logged?.thread_id,
    matched_existing_thread: !!threadId,
  });
}
