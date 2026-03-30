import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { sendPushToAllAdmins } from '@/lib/pushNotify';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const alerts: string[] = [];

  // Check heartbeat
  const { data: health } = await supabase
    .from('yelp_agent_health')
    .select('*')
    .order('heartbeat_at', { ascending: false })
    .limit(1)
    .single();

  if (!health?.heartbeat_at) {
    alerts.push('No heartbeat data found');
  } else {
    const ageMs = Date.now() - new Date(health.heartbeat_at).getTime();
    if (ageMs > 10 * 60 * 1000) {
      await sendPushToAllAdmins({
        title: 'Yelp Agent DOWN',
        body: `No heartbeat for ${Math.round(ageMs / 60000)} minutes`,
        url: '/admin?tab=yelp_leads',
        tag: 'yelp-agent-down',
      });
      alerts.push(`Agent DOWN: no heartbeat for ${Math.round(ageMs / 60000)}min`);
    } else if (ageMs > 3 * 60 * 1000) {
      alerts.push(`Agent warning: heartbeat ${Math.round(ageMs / 60000)}min ago`);
    }

    // Memory warning
    if (health.memory_mb && health.memory_mb > 500) {
      alerts.push(`High memory: ${health.memory_mb}MB`);
    }

    // Error count warning
    if (health.errors_today && health.errors_today > 10) {
      alerts.push(`High error count: ${health.errors_today} today`);
    }
  }

  // Check for repeated errors (3+ same type in 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentErrors } = await supabase
    .from('yelp_error_log')
    .select('error_type')
    .gte('created_at', oneHourAgo);

  if (recentErrors) {
    const counts: Record<string, number> = {};
    for (const err of recentErrors) {
      counts[err.error_type] = (counts[err.error_type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(counts)) {
      if (count >= 3) {
        alerts.push(`Repeated error: "${type}" ${count} times in 1h`);
      }
    }
  }

  return NextResponse.json({ ok: true, alerts, health: health || null });
}
