import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

/**
 * SMS API — Placeholder Routes
 * 
 * When you get a Twilio / Vonage / MessageBird API:
 * 1. Add SMS_PROVIDER_SID, SMS_PROVIDER_AUTH_TOKEN, SMS_FROM_NUMBER to Vercel env
 * 2. Uncomment the send logic in POST handler below
 * 3. Set up inbound webhook from provider → POST /api/sms/inbound
 * 4. The AdminInbox Messages tab already reads from sms_messages table
 */

// GET /api/sms/threads — list SMS threads
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clerkUserId = searchParams.get('clerk_user_id');

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  // Verify admin
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get all SMS messages grouped by thread
  const { data: messages, error } = await supabase
    .from('sms_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group into threads
  const threadMap = new Map<string, {
    thread_id: string;
    to_phone: string;
    from_phone: string;
    latest_body: string;
    latest_direction: string;
    message_count: number;
    unread_count: number;
    lead_id: string | null;
    created_at: string;
    customer_name?: string;
  }>();

  for (const msg of messages || []) {
    if (!threadMap.has(msg.thread_id)) {
      threadMap.set(msg.thread_id, {
        thread_id: msg.thread_id,
        to_phone: msg.direction === 'outbound' ? msg.to_phone : msg.from_phone,
        from_phone: msg.direction === 'outbound' ? msg.from_phone : msg.to_phone,
        latest_body: msg.body?.substring(0, 120) || '',
        latest_direction: msg.direction,
        message_count: 0,
        unread_count: 0,
        lead_id: msg.lead_id,
        created_at: msg.created_at,
      });
    }
    const thread = threadMap.get(msg.thread_id)!;
    thread.message_count++;
    if (!msg.read) thread.unread_count++;
  }

  // Resolve customer names
  const leadIds = [...new Set([...threadMap.values()].map(t => t.lead_id).filter(Boolean))] as string[];
  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from('video_leads')
      .select('id, name')
      .in('id', leadIds);
    const nameMap = new Map((leads || []).map(l => [l.id, l.name]));
    for (const thread of threadMap.values()) {
      if (thread.lead_id && nameMap.has(thread.lead_id)) {
        thread.customer_name = nameMap.get(thread.lead_id) || undefined;
      }
    }
  }

  const threads = [...threadMap.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return NextResponse.json({ threads });
}

// POST /api/sms/threads — send SMS reply
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clerk_user_id, thread_id, to_phone, message_body, lead_id } = body;

  if (!clerk_user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  if (!to_phone || !message_body) {
    return NextResponse.json({ error: 'Missing to_phone or message_body' }, { status: 400 });
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  TODO: Uncomment when you have a SMS provider API key       ║
  // ║                                                              ║
  // ║  Example with Twilio:                                        ║
  // ║  const twilio = require('twilio')(SID, TOKEN);               ║
  // ║  const msg = await twilio.messages.create({                  ║
  // ║    body: message_body,                                       ║
  // ║    from: process.env.SMS_FROM_NUMBER,                        ║
  // ║    to: to_phone,                                             ║
  // ║  });                                                         ║
  // ║  providerMessageId = msg.sid;                                ║
  // ╚══════════════════════════════════════════════════════════════╝

  return NextResponse.json({
    error: 'SMS sending not configured yet. Add SMS provider API credentials to enable.',
    configured: false,
  }, { status: 501 });

  // Once configured, log to sms_messages:
  // await logSms({
  //   thread_id,
  //   lead_id: lead_id || null,
  //   direction: 'outbound',
  //   from_phone: process.env.SMS_FROM_NUMBER!,
  //   to_phone,
  //   body: message_body,
  //   provider_message_id: providerMessageId,
  //   provider_status: 'sent',
  // });
}
