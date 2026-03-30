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

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = await verifyAdmin(userId);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const section = searchParams.get('section');

  if (section === 'errors') {
    const page = parseInt(searchParams.get('page') || '0');
    const { data, error } = await supabase
      .from('yelp_error_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * 20, (page + 1) * 20 - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  if (section === 'triggers') {
    const status = searchParams.get('status') || 'all';
    let query = supabase
      .from('yelp_triggers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  if (section === 'delivery') {
    const { data, error } = await supabase
      .from('yelp_delivery_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  if (section === 'rate_limits') {
    const { data, error } = await supabase.from('yelp_rate_limits').select('*').limit(1).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Default: combined health + stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    { data: health },
    { data: rateLimits },
    { count: triggersToday },
    { count: triggersWeek },
    { count: errorsToday },
    { data: deadLetters },
    { data: recentTriggers },
  ] = await Promise.all([
    supabase.from('yelp_agent_health').select('*').order('heartbeat_at', { ascending: false }).limit(1).single(),
    supabase.from('yelp_rate_limits').select('*').limit(1).single(),
    supabase.from('yelp_triggers').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    supabase.from('yelp_triggers').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
    supabase.from('yelp_error_log').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    supabase.from('yelp_error_log').select('*').eq('error_type', 'dead_letter').eq('resolved', false).order('created_at', { ascending: false }).limit(20),
    supabase.from('yelp_triggers').select('id, trigger_type, customer_name, status, created_at, processed_at, retry_count')
      .in('status', ['pending', 'processing', 'failed']).order('created_at', { ascending: false }).limit(30),
  ]);

  const isAlive = health?.heartbeat_at
    ? (Date.now() - new Date(health.heartbeat_at).getTime()) < 90000
    : false;

  return NextResponse.json({
    health: health || null,
    is_alive: isAlive,
    rate_limits: rateLimits || null,
    stats: {
      triggers_today: triggersToday || 0,
      triggers_week: triggersWeek || 0,
      errors_today: errorsToday || 0,
    },
    dead_letters: deadLetters || [],
    queue: recentTriggers || [],
  });
}

// POST — admin actions
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = await verifyAdmin(userId);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createSupabaseAdmin();
  const { action, payload } = await req.json();

  if (action === 'resolve_error') {
    const { id } = payload || {};
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await supabase.from('yelp_error_log').update({ resolved: true }).eq('id', id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'clear_resolved') {
    await supabase.from('yelp_error_log').delete().eq('resolved', true);
    return NextResponse.json({ ok: true });
  }

  if (action === 'resolve_dead_letter') {
    const { id } = payload || {};
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await supabase.from('yelp_error_log').update({ resolved: true }).eq('id', id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
