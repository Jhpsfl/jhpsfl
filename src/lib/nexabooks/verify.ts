// NexaBooks connector: checks that a request to this app's sales adapter really came from NexaBooks.
// Server-only. No dependencies beyond Node's crypto. Copy into the admin app unchanged.
import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_AGE_SECONDS = 300;

/**
 * NexaBooks signs each adapter request with this business's connector secret:
 *   X-NexaBooks-Timestamp: <unix seconds>
 *   X-NexaBooks-Signature: base64url(HMAC-SHA256(secret, "<timestamp>.<what>"))
 * where <what> is the adapter name plus its sorted query string, e.g. "sales?from=2026-11-01&to=2026-11-14".
 */
export function verifyNexaBooksRequest(headers: Headers, what: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const ts = headers.get('x-nexabooks-timestamp') ?? '';
  const sig = headers.get('x-nexabooks-signature') ?? '';
  if (!/^\d{9,11}$/.test(ts) || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_AGE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${ts}.${what}`).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The exact string NexaBooks signs for an adapter call. Query keys are sorted so both sides agree. */
export function adapterSigningString(adapter: string, params: URLSearchParams): string {
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const qs = new URLSearchParams(sorted).toString();
  return qs ? `${adapter}?${qs}` : adapter;
}

// ── The common sales format every adapter returns ────────────────────────
// All money is integer cents. Dates are the business's own calendar days (YYYY-MM-DD).

export type SalesSource = 'pos' | 'online' | 'phone' | 'delivery_app' | 'other';

export type SalesDay = {
  date: string;
  source: SalesSource;
  /** Name of the delivery app or channel when it matters, e.g. "DoorDash". */
  channel?: string;
  orders: number;
  /** Everything customers were charged: sales after discounts, plus tax, tips and service charges. */
  total_cents: number;
  tax_cents: number;
  /** Tax split by the name the point-of-sale gives it, when available. Sums to tax_cents. */
  taxes?: { name: string; cents: number }[];
  tip_cents: number;
  discount_cents: number;
  service_charge_cents: number;
  /** Money given back to customers on this day. */
  refund_cents: number;
  /** How the total was paid. card = through the card processor; other = anything else (app, gift card, house account). */
  tenders: { card_cents: number; cash_cents: number; other_cents: number };
};

export type SalesResponse = { version: 1; currency: 'USD'; timezone: string; from: string; to: string; days: SalesDay[] };

export type Payout = {
  id: string;
  processor: string; // e.g. "square"
  status: 'paid' | 'sent' | 'pending' | 'failed';
  /** The day the money is due in the bank. */
  arrival_date: string;
  /** What lands in the bank. */
  net_cents: number;
  /** Card payments in this payout, before fees. */
  gross_cents: number;
  fee_cents: number;
  refund_cents: number;
  /** Anything else in the payout (disputes, adjustments). net = gross - fee - refund + other. */
  other_cents: number;
};

export type PayoutsResponse = { version: 1; currency: 'USD'; from: string; to: string; payouts: Payout[] };

// ── Jobs (optional; contractors) ─────────────────────────────────────────
// GET <adapter-base>/jobs  (signed like the others; no date range: every job that is open,
// or was finished in the last 400 days). NexaBooks uses it for job costing and the
// work-in-progress report. Costs come from bank transactions the owner tags to a job in NexaBooks.

export type Job = {
  /** The job's permanent id in the admin app. */
  id: string;
  name: string;
  customer?: string;
  status: 'bidding' | 'open' | 'done' | 'cancelled';
  /** Agreed price including approved change orders. */
  contract_cents: number;
  /** What the estimate expects the job to cost, when known. Drives percent complete. */
  estimated_cost_cents?: number;
  /** Billed to date (invoices issued, not drafts). */
  invoiced_cents: number;
  /** Collected to date. */
  paid_cents: number;
  /** Held back by the customer until completion, if any. */
  retainage_held_cents?: number;
  started_on?: string;
  finished_on?: string;
  /** Link to the job in the admin app. */
  url?: string;
};

export type JobsResponse = { version: 1; currency: 'USD'; jobs: Job[] };
