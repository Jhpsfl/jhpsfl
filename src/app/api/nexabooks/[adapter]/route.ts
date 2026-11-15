// NexaBooks sales adapter. Read-only. Only NexaBooks can call it: every request is signed with this
// business's connector secret (see src/lib/nexabooks/verify.ts). No Clerk session is needed or used.
//   GET /api/nexabooks/sales?from=YYYY-MM-DD&to=YYYY-MM-DD     daily sales by channel (Square, Stripe, recorded by hand)
//   GET /api/nexabooks/payouts?from=YYYY-MM-DD&to=YYYY-MM-DD   Square and Stripe payouts with fees
import { NextRequest, NextResponse } from 'next/server';
import { buildPayouts, buildSales, TZ } from '@/lib/nexabooks/sales';
import { adapterSigningString, verifyNexaBooksRequest, type PayoutsResponse, type SalesResponse } from '@/lib/nexabooks/verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS: Record<string, number> = { sales: 93, payouts: 35 };

export async function GET(req: NextRequest, ctx: { params: Promise<{ adapter: string }> }) {
  const { adapter } = await ctx.params;
  if (!(adapter in MAX_DAYS)) return NextResponse.json({ error: 'unknown adapter' }, { status: 404 });
  const params = req.nextUrl.searchParams;
  if (!verifyNexaBooksRequest(req.headers, adapterSigningString(adapter, params), process.env.NEXABOOKS_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const from = params.get('from') ?? '', to = params.get('to') ?? '';
  if (!DAY.test(from) || !DAY.test(to) || from > to) return NextResponse.json({ error: 'from and to must be YYYY-MM-DD' }, { status: 400 });
  const span = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (!Number.isFinite(span) || span > MAX_DAYS[adapter]) return NextResponse.json({ error: `ask for at most ${MAX_DAYS[adapter]} days at a time` }, { status: 400 });

  try {
    if (adapter === 'sales') {
      const body: SalesResponse = { version: 1, currency: 'USD', timezone: TZ, from, to, days: await buildSales(from, to) };
      return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
    }
    const body: PayoutsResponse = { version: 1, currency: 'USD', from, to, payouts: await buildPayouts(from, to) };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[nexabooks adapter]', adapter, e);
    return NextResponse.json({ error: 'adapter failed' }, { status: 502 });
  }
}
