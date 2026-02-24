import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clerkUserId = searchParams.get('clerk_user_id');

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify admin
  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get all threads with latest message, unread count, and customer name from video_leads
  const { data: threads, error } = await supabase.rpc('get_email_threads');

  if (error) {
    // Fallback: manual query if RPC doesn't exist yet
    console.error('RPC get_email_threads not found, using fallback query:', error.message);
    return await fallbackThreadQuery(supabase);
  }

  return NextResponse.json({ threads: threads || [] });
}

async function fallbackThreadQuery(supabase: ReturnType<typeof createSupabaseAdmin>) {
  // Get all unique threads with their latest message
  const { data: messages, error } = await supabase
    .from('email_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by thread_id
  const threadMap = new Map<string, {
    thread_id: string;
    subject: string;
    to_email: string;
    from_email: string;
    latest_message: string;
    latest_body_preview: string;
    latest_direction: string;
    message_count: number;
    unread_count: number;
    lead_id: string | null;
    created_at: string;
    customer_name?: string;
  }>();

  for (const msg of messages || []) {
    if (!threadMap.has(msg.thread_id)) {
      const plainText = msg.body_text || (msg.body_html || '').replace(/<[^>]+>/g, '');
      threadMap.set(msg.thread_id, {
        thread_id: msg.thread_id,
        subject: msg.subject,
        to_email: msg.direction === 'outbound' ? msg.to_email : msg.from_email,
        from_email: msg.direction === 'outbound' ? msg.from_email : msg.to_email,
        latest_message: msg.created_at,
        latest_body_preview: plainText.substring(0, 120),
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

  // Get customer names from video_leads for threads that have lead_ids
  const leadIds = [...new Set([...threadMap.values()].map(t => t.lead_id).filter(Boolean))] as string[];
  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from('video_leads')
      .select('id, name')
      .in('id', leadIds);

    const leadNameMap = new Map((leads || []).map(l => [l.id, l.name]));
    for (const thread of threadMap.values()) {
      if (thread.lead_id && leadNameMap.has(thread.lead_id)) {
        thread.customer_name = leadNameMap.get(thread.lead_id) || undefined;
      }
    }
  }

  // Also try to resolve customer name from the to_email in video_leads
  const threadsWithoutNames = [...threadMap.values()].filter(t => !t.customer_name);
  if (threadsWithoutNames.length > 0) {
    const emails = [...new Set(threadsWithoutNames.map(t => t.to_email))];
    const { data: leadsByEmail } = await supabase
      .from('video_leads')
      .select('id, name, email')
      .in('email', emails);

    const emailNameMap = new Map((leadsByEmail || []).map(l => [l.email, l.name]));
    for (const thread of threadsWithoutNames) {
      if (emailNameMap.has(thread.to_email)) {
        thread.customer_name = emailNameMap.get(thread.to_email) || undefined;
      }
    }
  }

  const threads = [...threadMap.values()].sort(
    (a, b) => new Date(b.latest_message).getTime() - new Date(a.latest_message).getTime()
  );

  return NextResponse.json({ threads });
}
