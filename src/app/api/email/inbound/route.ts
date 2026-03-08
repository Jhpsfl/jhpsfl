import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { Resend } from 'resend';
import { logEmail } from '@/lib/email';
import { createSupabaseAdmin } from '@/lib/supabase';
import { sendPushToAllAdmins } from '@/lib/pushNotify';

const getResend = () => new Resend(process.env.RESEND_API_KEY);

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
      headers: { Authorization: `Bearer ${process.env.RESEND_FULL_KEY || process.env.RESEND_API_KEY}` },
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
    // Resend stores a bare UUID (e.g. "550e8400-...") as resend_message_id,
    // but inbound In-Reply-To headers use SMTP format: "<uuid@resend.dev>"
    // After stripping angle brackets we get "uuid@resend.dev", so extract the UUID part
    const resendUuid = in_reply_to.includes('@') ? in_reply_to.split('@')[0] : in_reply_to;

    // Try matching the UUID portion first, then fall back to the full value
    const { data: original } = await supabase
      .from('email_messages')
      .select('thread_id, lead_id')
      .eq('resend_message_id', resendUuid)
      .single();
    if (original) {
      threadId = original.thread_id;
      leadId = original.lead_id;
    } else {
      // Fallback: try matching the full In-Reply-To value as-is
      const { data: fallback } = await supabase
        .from('email_messages')
        .select('thread_id, lead_id')
        .eq('resend_message_id', in_reply_to)
        .single();
      if (fallback) {
        threadId = fallback.thread_id;
        leadId = fallback.lead_id;
      }
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

  // Detect Yelp emails early so we can file them into the yelp folder
  const isYelp = from_email.endsWith('@yelp.com') || from_email.endsWith('@messaging.yelp.com');

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
    folder: isYelp ? 'yelp' : undefined,
  });

  // Send push notification to all admins
  await sendPushToAllAdmins({
    title: '✉️ New Email',
    body: `From: ${from_email}`,
    url: '/admin?tab=messages',
  });

  // ─── YELP AI AGENT TRIGGER ───────────────────────────────────────────────
  if (isYelp) {
    try {
      const text = body_text || '';
      const html = body_html || '';
      const combined = text + html;

      // Extract lead ID from URL: /leads/LEAD_ID or /leads_center/.../leads/LEAD_ID
      const leadMatch = combined.match(/\/leads\/([A-Za-z0-9_-]{10,})/);
      // Extract thread ID from URL: /thread/THREAD_ID
      const threadMatch = combined.match(/\/thread\/([A-Za-z0-9_-]{10,})/);

      // Extract customer name from various Yelp subject formats:
      // "RE: Message from NAME for Jenkins..." | "New Reply Message from NAME" | "Message from NAME"
      const nameFromSubject = subjectStr.match(/Message from (.+?) for/i)?.[1]
        || subjectStr.match(/Message from (.+?)$/i)?.[1];
      // Or from new lead body: "NAME requested a quote"
      const nameFromBody = text.match(/^(\w[\w\s.]+?) requested a quote/)?.[1];
      const customerName = (nameFromSubject || nameFromBody || '').trim() || null;

      // Extract service from body: "new SERVICETYPE request" or "requested a quote...for a SERVICETYPE"
      const serviceMatch = text.match(/new (.+?) request\./i) || text.match(/for a (.+?)\./i);

      // Skip non-actionable Yelp emails (logins, account changes, ads, confirmations)
      const isNearbyJob = subjectStr.includes('New job near you');
      const isAccountEmail = subjectStr.includes('Confirm Your Email')
        || subjectStr.includes('Invitation from')
        || subjectStr.includes('Password')
        || subjectStr.includes('New login')
        || subjectStr.includes('access has changed');
      if (isNearbyJob || isAccountEmail) {
        console.log(`Yelp non-actionable email — skipping trigger: ${subjectStr}`);
      } else {
        const isNewLead = subjectStr.includes('new lead on Yelp');
        const triggerType = isNewLead ? 'new_lead' : 'customer_reply';

        await supabase.from('yelp_triggers').insert({
          trigger_type: triggerType,
          lead_id: leadMatch?.[1] || null,
          thread_id: threadMatch?.[1] || null,
          customer_name: customerName,
          service: serviceMatch?.[1] || null,
          email_subject: subjectStr,
          email_body_text: text.substring(0, 2000),
        });
        console.log(`Yelp trigger created: ${triggerType} lead=${leadMatch?.[1]} thread=${threadMatch?.[1]}`);
      }
    } catch (err) {
      console.error('Yelp trigger insert failed (non-fatal):', err);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Forward a copy to Gmail so it's readable from any device
  const forwardTo = process.env.EMAIL_FORWARD_TO || 'FRLawnCareFL@gmail.com';
  try {
    await getResend().emails.send({
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
