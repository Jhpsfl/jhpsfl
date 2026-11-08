import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { chargeSubscription, remindStaff } from '@/lib/recurring-billing';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SELECT = '*, customers(id, name, email, phone, square_customer_id)';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const today = new Date().toISOString().split('T')[0];
  const results = { processed: 0, succeeded: 0, failed: 0, no_card: 0, on_hold: 0, needs_approval: 0, skipped: 0, reminded: 0 };

  const { data: due, error } = await supabase
    .from('subscriptions')
    .select(SELECT)
    .eq('billing_mode', 'auto')
    .eq('status', 'active')
    .lte('next_billing_date', today)
    .or(`retry_on.is.null,retry_on.lte.${today}`);
  if (error) {
    console.error('CRON_QUERY_ERROR:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  for (const sub of due || []) {
    results.processed++;
    const r = await chargeSubscription(supabase, sub);
    if (r.outcome === 'success') results.succeeded++;
    else if (r.outcome === 'failed') results.failed++;
    else if (r.outcome === 'no_card') results.no_card++;
    else if (r.outcome === 'on_hold') results.on_hold++;
    else if (r.outcome === 'needs_approval') results.needs_approval++;
    else results.skipped++;
  }

  // Heads-up 3 days out, in case that month's usage amount hasn't arrived.
  const soon = new Date(Date.now() + 3 * 864e5).toISOString().split('T')[0];
  const { data: upcoming } = await supabase
    .from('subscriptions')
    .select(SELECT)
    .eq('brand', 'nexa')
    .eq('billing_mode', 'auto')
    .eq('status', 'active')
    .gt('next_billing_date', today)
    .lte('next_billing_date', soon);
  for (const sub of upcoming || []) {
    if (sub.reminded_for === sub.next_billing_date) continue;
    await remindStaff(supabase, sub);
    results.reminded++;
  }

  return NextResponse.json(results);
}
