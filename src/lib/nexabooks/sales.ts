// NexaBooks sales adapter for JHPS: turns what JHPS was paid through Square and Stripe, plus payments
// recorded by hand in the admin, into the common format NexaBooks reads. Read-only: it only lists
// payments, refunds and payouts; it never creates or changes anything.
//
// Sales come from the processors themselves (the payments table misses a charge when no customer row
// could be matched), and the payments table says which brand and flow each charge belongs to.
// NexaVision-branded charges (brand 'nexa') are collected by JHPS's Square and Stripe accounts (the
// JHPS pay bridge) and land in JHPS's payouts, and NexaVision's own NexaBooks has no adapter, so they
// are booked here, in their own channels ("Square · NexaVision", "Stripe · NexaVision"), so the owner
// can see them apart and the card deposits reconcile.
import { createSupabaseAdmin } from '@/lib/supabase';
import type { Payout, SalesDay, SalesSource } from './verify';

export const TZ = 'America/New_York';
const SQUARE_VERSION = '2025-01-23';

/** The business's calendar day for a moment in time. */
const etDay = (iso: string | number | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));

/** UTC instants that safely cover whole Eastern days from..to (a day of padding each side; rows are re-bucketed by etDay). */
function utcWindow(from: string, to: string, padBefore = 1, padAfter = 2): [Date, Date] {
  const start = new Date(`${from}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - padBefore);
  const end = new Date(`${to}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + padAfter);
  return [start, end];
}

const cents = (dollars: number | string | null | undefined) => Math.round(Number(dollars ?? 0) * 100);

// ── Processor API access (plain REST, read-only) ─────────────────────────

const squareToken = () => process.env.SQUARE_ACCESS_TOKEN?.trim();
const stripeKey = () => process.env.STRIPE_SECRET_KEY?.trim();
const jhpsLocation = () => process.env.SQUARE_LOCATION_ID?.trim();

async function square<T>(path: string): Promise<T> {
  const r = await fetch(`https://connect.squareup.com${path}`, {
    headers: { Authorization: `Bearer ${squareToken()}`, 'Square-Version': SQUARE_VERSION, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Square ${path.split('?')[0]} ${r.status}`);
  return r.json() as Promise<T>;
}

async function stripe<T>(path: string): Promise<T> {
  const r = await fetch(`https://api.stripe.com${path}`, { headers: { Authorization: `Bearer ${stripeKey()}` }, cache: 'no-store' });
  if (!r.ok) throw new Error(`Stripe ${path.split('?')[0]} ${r.status}`);
  return r.json() as Promise<T>;
}

/** Every page of a Square list call. */
async function squareAll<T>(path: string, key: string): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  do {
    const sep = path.includes('?') ? '&' : '?';
    const page = await square<Record<string, unknown>>(cursor ? `${path}${sep}cursor=${encodeURIComponent(cursor)}` : path);
    out.push(...((page[key] as T[] | undefined) ?? []));
    cursor = page.cursor as string | undefined;
  } while (cursor);
  return out;
}

/** Every page of a Stripe list call. */
async function stripeAll<T extends { id: string }>(path: string): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  for (;;) {
    const sep = path.includes('?') ? '&' : '?';
    const page = await stripe<{ data: T[]; has_more: boolean }>(`${path}${sep}limit=100${after ? `&starting_after=${after}` : ''}`);
    out.push(...page.data);
    if (!page.has_more || !page.data.length) return out;
    after = page.data[page.data.length - 1].id;
  }
}

type Money = { amount?: number | null } | null | undefined;
type SquarePayment = {
  id: string; created_at: string; status: string; note?: string;
  total_money?: Money; amount_money?: Money; tip_money?: Money;
  card_details?: { entry_method?: string };
};
type SquareRefund = { id: string; created_at: string; status: string; amount_money?: Money; payment_id?: string };
type StripeCharge = {
  id: string; created: number; amount: number; status: string; paid: boolean;
  payment_intent: string | null; metadata?: Record<string, string>;
};
type StripeRefund = { id: string; created: number; amount: number; status: string; charge: string | null; payment_intent: string | null };

// ── What the admin knows about each charge ──────────────────────────────

type DbPayment = {
  amount: number | string; brand: string | null; payment_method: string | null; status: string;
  square_payment_id: string | null; stripe_payment_id: string | null; subscription_id: string | null;
  paid_at: string | null; created_at: string;
};

async function loadDbPayments(start: Date, end: Date): Promise<DbPayment[]> {
  const supabase = createSupabaseAdmin();
  const out: DbPayment[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('payments')
      .select('amount, brand, payment_method, status, square_payment_id, stripe_payment_id, subscription_id, paid_at, created_at')
      .gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
      .order('created_at').range(offset, offset + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as DbPayment[]));
    if (!data || data.length < 1000) return out;
  }
}

/** Brand of each invoice number, for Stripe charges the payments table didn't record. */
async function invoiceBrands(numbers: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!numbers.length) return map;
  const { data } = await createSupabaseAdmin().from('invoices').select('invoice_number, brand').in('invoice_number', numbers);
  for (const r of data ?? []) map.set(r.invoice_number as string, (r.brand as string) || 'jhps');
  return map;
}

// ── Sales ────────────────────────────────────────────────────────────────

type Charge = { date: string; source: SalesSource; channel: string; total: number; tip: number; card: number; cash: number; other: number };
type Refund = { date: string; source: SalesSource; channel: string; amount: number };

const HAND_CHANNEL = 'Recorded by hand';

export async function buildSales(from: string, to: string): Promise<SalesDay[]> {
  const [start, end] = utcWindow(from, to);
  const inRange = (d: string) => d >= from && d <= to;

  // Refunds can follow their charge by weeks, so look further back for the charge they belong to.
  const [dbStart] = utcWindow(from, to, 120);
  const db = await loadDbPayments(dbStart, end);
  const bySquare = new Map(db.filter(p => p.square_payment_id).map(p => [p.square_payment_id!, p]));
  const byStripe = new Map(db.filter(p => p.stripe_payment_id).map(p => [p.stripe_payment_id!, p]));

  const charges: Charge[] = [];
  const refunds: Refund[] = [];
  const ch = (base: string, nexa: boolean) => (nexa ? `${base} · NexaVision` : base);

  // Square: JHPS's location, where both brands' charges are taken. (NexaVision's own location has its own payout account.)
  if (squareToken() && jhpsLocation()) {
    const loc = encodeURIComponent(jhpsLocation()!);
    const qs = `location_id=${loc}&begin_time=${encodeURIComponent(start.toISOString())}&end_time=${encodeURIComponent(end.toISOString())}&limit=100`;
    const payments = await squareAll<SquarePayment>(`/v2/payments?${qs}`, 'payments');
    const sqSource = (p: SquarePayment, row?: DbPayment): SalesSource =>
      row ? (row.subscription_id ? 'other' : 'online') : p.card_details?.entry_method === 'ON_FILE' ? 'other' : 'online';
    const paymentInfo = new Map<string, { nexa: boolean; source: SalesSource }>();
    for (const p of payments) {
      const row = bySquare.get(p.id);
      const nexa = row ? row.brand === 'nexa' : /nexavision/i.test(p.note ?? '');
      paymentInfo.set(p.id, { nexa, source: sqSource(p, row) });
      if (p.status !== 'COMPLETED') continue;
      const date = etDay(p.created_at);
      if (!inRange(date)) continue;
      const total = p.total_money?.amount ?? p.amount_money?.amount ?? 0;
      charges.push({ date, source: sqSource(p, row), channel: ch('Square', nexa), total, tip: p.tip_money?.amount ?? 0, card: total, cash: 0, other: 0 });
    }
    const sqRefunds = await squareAll<SquareRefund>(`/v2/refunds?${qs}`, 'refunds');
    for (const r of sqRefunds) {
      if (r.status !== 'COMPLETED') continue;
      const date = etDay(r.created_at);
      if (!inRange(date)) continue;
      const known = r.payment_id ? paymentInfo.get(r.payment_id) : undefined;
      const row = r.payment_id ? bySquare.get(r.payment_id) : undefined;
      const nexa = known?.nexa ?? row?.brand === 'nexa';
      refunds.push({ date, source: known?.source ?? (row?.subscription_id ? 'other' : 'online'), channel: ch('Square', nexa), amount: r.amount_money?.amount ?? 0 });
    }
  }

  // Stripe: only the pay page charges through Stripe, so its sales are online.
  if (stripeKey()) {
    const range = `created[gte]=${Math.floor(start.getTime() / 1000)}&created[lt]=${Math.floor(end.getTime() / 1000)}`;
    const list = await stripeAll<StripeCharge>(`/v1/charges?${range}`);
    const unknownInvoices = list.filter(c => !(c.payment_intent && byStripe.has(c.payment_intent)) && c.metadata?.invoiceNumber).map(c => c.metadata!.invoiceNumber);
    const invBrand = await invoiceBrands([...new Set(unknownInvoices)]);
    const isNexa = (pi: string | null, meta?: Record<string, string>) => {
      const row = pi ? byStripe.get(pi) : undefined;
      if (row) return row.brand === 'nexa';
      return !!meta?.invoiceNumber && invBrand.get(meta.invoiceNumber) === 'nexa';
    };
    for (const c of list) {
      if (c.status !== 'succeeded' || !c.paid) continue;
      const date = etDay(c.created * 1000);
      if (!inRange(date)) continue;
      charges.push({ date, source: 'online', channel: ch('Stripe', isNexa(c.payment_intent, c.metadata)), total: c.amount, tip: 0, card: c.amount, cash: 0, other: 0 });
    }
    const stRefunds = await stripeAll<StripeRefund>(`/v1/refunds?${range}`);
    const chargeMeta = new Map(list.map(c => [c.id, c.metadata]));
    for (const r of stRefunds) {
      if (r.status !== 'succeeded') continue;
      const date = etDay(r.created * 1000);
      if (!inRange(date)) continue;
      refunds.push({ date, source: 'online', channel: ch('Stripe', isNexa(r.payment_intent, r.charge ? chargeMeta.get(r.charge) : undefined)), amount: r.amount });
    }
  }

  // Payments recorded by hand in the admin (cash, check, Zelle...). Card payments recorded by hand are
  // left out: a card is taken through Square or Stripe, which are already counted above.
  for (const p of db) {
    if (p.status !== 'completed' || p.square_payment_id || p.stripe_payment_id) continue;
    const method = (p.payment_method ?? '').toLowerCase();
    if (method === 'card' || method === 'test') continue;
    const date = etDay(p.paid_at ?? p.created_at);
    if (!inRange(date)) continue;
    const total = cents(p.amount);
    if (total <= 0) continue;
    const cash = method === 'cash' ? total : 0;
    charges.push({ date, source: 'other', channel: ch(HAND_CHANNEL, p.brand === 'nexa'), total, tip: 0, card: 0, cash, other: total - cash });
  }

  // One SalesDay per day per channel.
  const days = new Map<string, SalesDay>();
  const dayFor = (date: string, source: SalesSource, channel: string) => {
    const key = `${date}|${source}|${channel}`;
    let d = days.get(key);
    if (!d) {
      d = { date, source, channel, orders: 0, total_cents: 0, tax_cents: 0, tip_cents: 0, discount_cents: 0, service_charge_cents: 0, refund_cents: 0,
        tenders: { card_cents: 0, cash_cents: 0, other_cents: 0 } };
      days.set(key, d);
    }
    return d;
  };
  for (const c of charges) {
    const d = dayFor(c.date, c.source, c.channel);
    d.orders++;
    d.total_cents += c.total;
    d.tip_cents += c.tip;
    d.tenders.card_cents += c.card;
    d.tenders.cash_cents += c.cash;
    d.tenders.other_cents += c.other;
  }
  for (const r of refunds) dayFor(r.date, r.source, r.channel).refund_cents += r.amount;

  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source) || (a.channel ?? '').localeCompare(b.channel ?? ''));
}

// ── Payouts ──────────────────────────────────────────────────────────────

type SquarePayout = { id: string; status: string; arrival_date?: string; created_at: string; amount_money: { amount: number } };
type SquarePayoutEntry = { type: string; gross_amount_money?: Money; fee_amount_money?: Money; net_amount_money?: Money };

const SQ_STATUS: Record<string, Payout['status']> = { PAID: 'paid', SENT: 'sent', FAILED: 'failed', INITIATED: 'pending' };

async function squarePayouts(from: string, to: string): Promise<Payout[]> {
  if (!squareToken() || !jhpsLocation()) return [];
  const [start, end] = utcWindow(from, to, 7, 2);
  const qs = `location_id=${encodeURIComponent(jhpsLocation()!)}&begin_time=${encodeURIComponent(start.toISOString())}&end_time=${encodeURIComponent(end.toISOString())}&limit=100`;
  const all = await squareAll<SquarePayout>(`/v2/payouts?${qs}`, 'payouts');
  const wanted = all.filter(p => { const d = p.arrival_date ?? p.created_at.slice(0, 10); return d >= from && d <= to; });

  const summarize = async (p: SquarePayout): Promise<Payout> => {
    let gross = 0, fee = 0, refund = 0;
    const entries = await squareAll<SquarePayoutEntry>(`/v2/payouts/${encodeURIComponent(p.id)}/payout-entries?limit=100`, 'payout_entries');
    for (const e of entries) {
      const g = e.gross_amount_money?.amount ?? 0, f = Math.abs(e.fee_amount_money?.amount ?? 0), n = e.net_amount_money?.amount ?? 0;
      if (e.type === 'CHARGE') { gross += g; fee += f; }
      else if (e.type === 'REFUND') { refund += Math.abs(g); fee += f; }
      else if (e.type === 'FEE') fee += Math.abs(n);
    }
    const net = p.amount_money.amount;
    // Whatever the entries don't explain (adjustments, disputes, holds) is "other", so the parts always add up to the deposit.
    const other = net - (gross - fee - refund);
    return { id: p.id, processor: 'square', status: SQ_STATUS[p.status] ?? 'pending', arrival_date: p.arrival_date ?? p.created_at.slice(0, 10),
      net_cents: net, gross_cents: gross, fee_cents: fee, refund_cents: refund, other_cents: other };
  };
  const out: Payout[] = [];
  for (let i = 0; i < wanted.length; i += 5) out.push(...await Promise.all(wanted.slice(i, i + 5).map(summarize)));
  return out;
}

type StripePayout = { id: string; status: string; arrival_date: number; created: number; amount: number; automatic: boolean; balance_transaction: string | null };
type StripeBT = { id: string; type: string; created: number; amount: number; fee: number; net: number; source: string | null };

const ST_STATUS: Record<string, Payout['status']> = { paid: 'paid', in_transit: 'sent', pending: 'pending', failed: 'failed', canceled: 'failed' };

type Tally = { gross: number; fee: number; refund: number };
const emptyTally = (): Tally => ({ gross: 0, fee: 0, refund: 0 });

/** Adds one balance transaction to a payout's tally. Anything that isn't a charge, refund or fee ends up in "other" as the remainder. */
function tallyBT(t: Tally, bt: StripeBT) {
  switch (bt.type) {
    case 'charge': case 'payment':
      t.gross += bt.amount; t.fee += bt.fee; break;
    case 'refund': case 'payment_refund':
      t.refund += -bt.amount; t.fee += bt.fee; break;
    case 'stripe_fee': case 'tax_fee':
      t.fee += -bt.amount; break;
    default:
      break;
  }
}

async function stripePayouts(from: string, to: string): Promise<Payout[]> {
  if (!stripeKey()) return [];
  const [start, end] = utcWindow(from, to, 0, 1);
  const arrival = `arrival_date[gte]=${Math.floor(start.getTime() / 1000)}&arrival_date[lt]=${Math.floor(end.getTime() / 1000)}`;
  const payouts = (await stripeAll<StripePayout>(`/v1/payouts?${arrival}`))
    .filter(p => { const d = new Date(p.arrival_date * 1000).toISOString().slice(0, 10); return d >= from && d <= to; });
  if (!payouts.length) return [];

  const tallies = new Map<string, Tally>();

  // Automatic payouts: Stripe lists exactly which balance transactions each one carried.
  for (const p of payouts.filter(x => x.automatic)) {
    const t = emptyTally();
    for (const bt of await stripeAll<StripeBT>(`/v1/balance_transactions?payout=${encodeURIComponent(p.id)}`)) {
      if (bt.type === 'payout') { if (bt.source === p.id) t.fee += bt.fee; continue; }
      tallyBT(t, bt);
    }
    tallies.set(p.id, t);
  }

  // Manual (instant) payouts can't be filtered that way, and the owner picks the amount, so a payout can
  // take part of a charge and leave the rest for the next one. Walk the balance history in order and let
  // each payout take what it withdrew from the oldest money first, splitting a charge when needed.
  const manual = payouts.filter(x => !x.automatic);
  if (manual.length) {
    const first = Math.min(...manual.map(p => p.created));
    const last = Math.max(...manual.map(p => p.created));
    const history = (await stripeAll<StripeBT>(`/v1/balance_transactions?created[gte]=${first - 120 * 86400}&created[lte]=${last + 60}`))
      .filter(bt => bt.type !== 'advance' && bt.type !== 'advance_funding') // an instant payout's advance and its funding cancel out
      .sort((a, b) => a.created - b.created || (a.type === 'payout' ? 1 : 0) - (b.type === 'payout' ? 1 : 0));
    const wanted = new Set(manual.map(p => p.id));

    type Item = Tally & { net: number; left: number; gGiven: number; rGiven: number };
    let queue: Item[] = [];
    let started = false; // money before the first payout we can see was paid out by an earlier one
    for (const bt of history) {
      if (bt.type !== 'payout') {
        if (!started) continue;
        const t = emptyTally();
        tallyBT(t, bt);
        queue.push({ ...t, net: bt.net, left: bt.net, gGiven: 0, rGiven: 0 });
        continue;
      }
      if (!started) { started = true; if (!(bt.source && wanted.has(bt.source))) continue; }
      // What this payout withdrew from the balance (the deposit plus its own fee).
      let need = -bt.net;
      const t: Tally = { gross: 0, fee: bt.fee, refund: 0 };
      // Money going out (refunds, fees) is settled first; it adds to what the incoming money must cover.
      for (const it of queue) if (it.left < 0) { t.gross += it.gross; t.fee += it.fee; t.refund += it.refund; need -= it.left; it.left = 0; }
      for (const it of queue) {
        if (need <= 0) break;
        if (it.left <= 0) continue;
        const take = Math.min(it.left, need);
        // The last piece of a charge gets whatever earlier pieces didn't, so the pieces add up exactly.
        const g = take === it.left ? it.gross - it.gGiven : Math.round(it.gross * take / it.net);
        const r = take === it.left ? it.refund - it.rGiven : Math.round(it.refund * take / it.net);
        t.gross += g; t.refund += r; t.fee += g - r - take; // keeps gross - fee - refund equal to what was taken
        it.gGiven += g; it.rGiven += r;
        it.left -= take; need -= take;
      }
      queue = queue.filter(it => it.left !== 0);
      if (bt.source && wanted.has(bt.source)) tallies.set(bt.source, t);
    }
  }

  return payouts.map(p => {
    const t = tallies.get(p.id) ?? emptyTally();
    const net = p.amount;
    return { id: p.id, processor: 'stripe', status: ST_STATUS[p.status] ?? 'pending', arrival_date: new Date(p.arrival_date * 1000).toISOString().slice(0, 10),
      net_cents: net, gross_cents: t.gross, fee_cents: t.fee, refund_cents: t.refund, other_cents: net - (t.gross - t.fee - t.refund) };
  });
}

export async function buildPayouts(from: string, to: string): Promise<Payout[]> {
  const [sq, st] = await Promise.all([squarePayouts(from, to), stripePayouts(from, to)]);
  return [...sq, ...st].sort((a, b) => a.arrival_date.localeCompare(b.arrival_date) || a.id.localeCompare(b.id));
}
