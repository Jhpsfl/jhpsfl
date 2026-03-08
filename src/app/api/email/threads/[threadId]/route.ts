import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const { searchParams } = new URL(req.url);
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  // Verify admin
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', userId)
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

  // Get attachments for all messages in this thread
  const messageIds = (messages || []).map(m => m.id);
  let attachmentsByMessage: Record<string, Array<{ id: string; message_id: string; filename: string; content_type: string; size_bytes: number; s3_key: string; s3_url: string; created_at: string }>> = {};

  if (messageIds.length > 0) {
    const { data: attachments } = await supabase
      .from('email_attachments')
      .select('*')
      .in('message_id', messageIds);

    if (attachments) {
      for (const att of attachments) {
        if (!attachmentsByMessage[att.message_id]) {
          attachmentsByMessage[att.message_id] = [];
        }
        attachmentsByMessage[att.message_id].push(att);
      }
    }
  }

  // Attach attachments to their messages
  const messagesWithAttachments = (messages || []).map(m => ({
    ...m,
    attachments: attachmentsByMessage[m.id] || [],
  }));

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

  return NextResponse.json({ messages: messagesWithAttachments, lead });
}
