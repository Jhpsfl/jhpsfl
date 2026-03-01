import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clerkUserId = searchParams.get('clerk_user_id');
  const folder = searchParams.get('folder'); // inbox, sent, starred, drafts, trash, spam

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Build thread query with folder filtering
  const { threads, folderCounts } = await buildThreadQuery(supabase, folder);
  return NextResponse.json({ threads, folderCounts });
}

async function buildThreadQuery(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  folder: string | null
) {
  // Get all non-draft messages (or drafts if folder=drafts)
  let query = supabase
    .from('email_messages')
    .select('*')
    .order('created_at', { ascending: false });

  // Don't show trashed messages unless viewing trash
  if (folder === 'trash') {
    query = query.eq('folder', 'trash');
  } else if (folder === 'drafts') {
    query = query.eq('is_draft', true).neq('folder', 'trash');
  } else if (folder === 'starred') {
    query = query.eq('starred', true).neq('folder', 'trash');
  } else if (folder === 'sent') {
    query = query.eq('direction', 'outbound').eq('is_draft', false).neq('folder', 'trash');
  } else if (folder === 'spam') {
    query = query.eq('folder', 'spam');
  } else {
    // Default: inbox — show all non-draft, non-trash/spam messages
    query = query.eq('is_draft', false).not('folder', 'in', '("trash","spam")');
  }

  const isInbox = !folder || folder === 'inbox';

  const { data: messages, error } = await query;
  if (error) {
    console.error('Thread query error:', error.message);
    return { threads: [], folderCounts: {} };
  }

  // Get folder counts from ALL messages
  const { data: allMessages } = await supabase
    .from('email_messages')
    .select('folder, is_draft, starred, read, direction');

  const folderCounts: Record<string, number> = {
    inbox: 0,
    sent: 0,
    starred: 0,
    drafts: 0,
    trash: 0,
    spam: 0,
  };

  if (allMessages) {
    for (const msg of allMessages) {
      if (msg.is_draft && msg.folder !== 'trash') folderCounts.drafts++;
      if (msg.starred && msg.folder !== 'trash') folderCounts.starred++;
      if (msg.folder === 'trash') folderCounts.trash++;
      if (msg.folder === 'spam') folderCounts.spam++;
      // Unread inbox count
      if (!msg.read && msg.folder === 'inbox' && !msg.is_draft) folderCounts.inbox++;
      if (msg.direction === 'outbound' && !msg.is_draft && msg.folder !== 'trash') folderCounts.sent++;
    }
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
    starred: boolean;
    has_attachments: boolean;
    lead_id: string | null;
    created_at: string;
    customer_name?: string;
    has_inbound: boolean;
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
        starred: !!msg.starred,
        has_attachments: !!msg.has_attachments,
        lead_id: msg.lead_id,
        created_at: msg.created_at,
        has_inbound: msg.direction === 'inbound',
      });
    }

    const thread = threadMap.get(msg.thread_id)!;
    thread.message_count++;
    if (!msg.read) thread.unread_count++;
    if (msg.starred) thread.starred = true;
    if (msg.has_attachments) thread.has_attachments = true;
    if (msg.direction === 'inbound') thread.has_inbound = true;
  }

  // For inbox, only show threads that have received at least one inbound message
  if (isInbox) {
    for (const [threadId, thread] of threadMap) {
      if (!thread.has_inbound) {
        threadMap.delete(threadId);
      }
    }
  }

  // Get customer names from video_leads
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

  // Also resolve by email
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

  // Also try email_contacts for name resolution
  const stillNoName = [...threadMap.values()].filter(t => !t.customer_name);
  if (stillNoName.length > 0) {
    const emails = [...new Set(stillNoName.map(t => t.to_email))];
    const { data: contacts } = await supabase
      .from('email_contacts')
      .select('email, name')
      .in('email', emails);
    if (contacts) {
      const contactMap = new Map(contacts.map(c => [c.email, c.name]));
      for (const thread of stillNoName) {
        if (contactMap.has(thread.to_email)) {
          thread.customer_name = contactMap.get(thread.to_email) || undefined;
        }
      }
    }
  }

  const threads = [...threadMap.values()].sort(
    (a, b) => new Date(b.latest_message).getTime() - new Date(a.latest_message).getTime()
  );

  return { threads, folderCounts };
}

// PATCH: Update thread properties (star, folder, read)
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clerkUserId = searchParams.get('clerk_user_id');
  if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase.from('admin_users').select('id').eq('clerk_user_id', clerkUserId).single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { thread_ids, action, value } = body as {
    thread_ids: string[];
    action: 'star' | 'unstar' | 'trash' | 'restore' | 'spam' | 'mark_read' | 'mark_unread' | 'move';
    value?: string;
  };

  if (!thread_ids?.length || !action) {
    return NextResponse.json({ error: 'Missing thread_ids or action' }, { status: 400 });
  }

  let updateObj: Record<string, unknown> = {};
  switch (action) {
    case 'star':
      updateObj = { starred: true };
      break;
    case 'unstar':
      updateObj = { starred: false };
      break;
    case 'trash':
      updateObj = { folder: 'trash' };
      break;
    case 'restore':
      // Restore: move back to inbox for inbound, sent for outbound
      // We'll just set to inbox; the UI can handle this
      updateObj = { folder: 'inbox' };
      break;
    case 'spam':
      updateObj = { folder: 'spam' };
      break;
    case 'mark_read':
      updateObj = { read: true };
      break;
    case 'mark_unread':
      updateObj = { read: false };
      break;
    case 'move':
      if (value) updateObj = { folder: value };
      break;
  }

  const { error } = await supabase
    .from('email_messages')
    .update(updateObj)
    .in('thread_id', thread_ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: thread_ids.length });
}

// DELETE: Permanent delete (only from trash)
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clerkUserId = searchParams.get('clerk_user_id');
  if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase.from('admin_users').select('id').eq('clerk_user_id', clerkUserId).single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { thread_ids, permanent } = body as { thread_ids: string[]; permanent?: boolean };
  if (!thread_ids?.length) return NextResponse.json({ error: 'No thread_ids provided' }, { status: 400 });

  if (permanent) {
    // Hard delete — only allowed for already-trashed items
    const { error } = await supabase.from('email_messages').delete().in('thread_id', thread_ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Soft delete — move to trash
    const { error } = await supabase.from('email_messages').update({ folder: 'trash' }).in('thread_id', thread_ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: thread_ids.length });
}
