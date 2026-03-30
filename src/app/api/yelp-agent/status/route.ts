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

// GET — Admin reads agent status
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = await verifyAdmin(userId);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createSupabaseAdmin();

  const [{ data: health }, { data: errors }, { data: queue }] = await Promise.all([
    supabase.from('yelp_agent_health').select('*').order('heartbeat_at', { ascending: false }).limit(1).single(),
    supabase.from('yelp_error_log').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(20),
    supabase.from('yelp_triggers').select('id, trigger_type, customer_name, status, created_at, processed_at, retry_count')
      .in('status', ['pending', 'processing', 'failed']).order('created_at', { ascending: false }).limit(50),
  ]);

  const isAlive = health?.heartbeat_at
    ? (Date.now() - new Date(health.heartbeat_at).getTime()) < 90000
    : false;

  return NextResponse.json({
    health: health || null,
    is_alive: isAlive,
    errors: errors || [],
    queue: queue || [],
  });
}

// POST — Agent sends heartbeat
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.AGENT_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const body = await req.json();

  // Delete old heartbeats and insert new
  await supabase.from('yelp_agent_health').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabase.from('yelp_agent_health').insert(body);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
