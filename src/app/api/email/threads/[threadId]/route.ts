import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
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

  // Get all messages in thread
  const { data: messages, error } = await supabase
    .from('email_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark all unread messages in this thread as read
  await supabase
    .from('email_messages')
    .update({ read: true })
    .eq('thread_id', threadId)
    .eq('read', false);

  // Get lead info if available
  const leadId = messages?.[0]?.lead_id;
  let lead = null;
  if (leadId) {
    const { data: leadData } = await supabase
      .from('video_leads')
      .select('id, name, email, phone, address, city, state')
      .eq('id', leadId)
      .single();
    lead = leadData;
  }

  return NextResponse.json({ messages: messages || [], lead });
}
