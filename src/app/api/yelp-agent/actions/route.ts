import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

async function verifyAdmin(clerkUserId: string) {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from('admin_users')
    .select('id, role')
    .eq('clerk_user_id', clerkUserId)
    .single();
  return data as { id: string; role: string } | null;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = await verifyAdmin(userId);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createSupabaseAdmin();
  const { action, payload } = await req.json() as { action: string; payload?: Record<string, unknown> };

  if (action === 'reset_circuit') {
    await supabase.from('yelp_agent_commands').insert({
      command: 'reset_circuit',
      status: 'pending',
    });
    return NextResponse.json({ ok: true, message: 'Circuit reset command queued' });
  }

  if (action === 'retry_failed') {
    const { data } = await supabase
      .from('yelp_triggers')
      .update({ status: 'pending', retry_count: 0 })
      .eq('status', 'failed')
      .select('id');
    return NextResponse.json({ ok: true, retried: data?.length || 0 });
  }

  if (action === 'clear_stale') {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('yelp_triggers')
      .update({ status: 'expired' })
      .eq('status', 'processing')
      .lt('processed_at', fiveMinAgo)
      .select('id');
    return NextResponse.json({ ok: true, cleared: data?.length || 0 });
  }

  if (action === 'clear_browser') {
    await supabase.from('yelp_agent_commands').insert({
      command: 'clear_browser',
      status: 'pending',
    });
    return NextResponse.json({ ok: true, message: 'Clear browser command queued' });
  }

  if (action === 'retry_trigger') {
    const triggerId = (payload as { triggerId?: string })?.triggerId;
    if (!triggerId) return NextResponse.json({ error: 'triggerId required' }, { status: 400 });
    await supabase.from('yelp_triggers').update({ status: 'pending', retry_count: 0 }).eq('id', triggerId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'cancel_trigger') {
    const triggerId = (payload as { triggerId?: string })?.triggerId;
    if (!triggerId) return NextResponse.json({ error: 'triggerId required' }, { status: 400 });
    await supabase.from('yelp_triggers').update({ status: 'expired' }).eq('id', triggerId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'clear_queue') {
    const { data } = await supabase
      .from('yelp_triggers')
      .update({ status: 'expired' })
      .in('status', ['pending', 'processing', 'failed'])
      .select('id');
    return NextResponse.json({ ok: true, message: `Cleared ${data?.length || 0} trigger(s) from queue` });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
