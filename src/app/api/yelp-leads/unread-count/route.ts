import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdmin();

  // Count conversations where the latest message is from customer and is newer than last_admin_read_at
  const { data: conversations } = await supabase
    .from('yelp_conversations')
    .select('id, messages, last_admin_read_at')
    .in('status', ['ai_active', 'needs_attention', 'taken_over']);

  let unread = 0;
  for (const conv of conversations || []) {
    const msgs = conv.messages || [];
    if (msgs.length === 0) continue;
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg.role === 'customer') {
      if (!conv.last_admin_read_at || new Date(lastMsg.ts) > new Date(conv.last_admin_read_at)) {
        unread++;
      }
    }
  }

  return NextResponse.json({ count: unread });
}
