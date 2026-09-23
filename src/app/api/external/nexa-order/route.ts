import { NextResponse } from 'next/server';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { createSupabaseAdmin } from '@/lib/supabase';

/**
 * Server-to-server: the Nexa Pro store (nexavisiongroup.com/nexaphone) creates
 * a Nexa-branded invoice here and sends the buyer to the pay page.
 *
 * Auth: HMAC-SHA256 over `${timestamp}.${rawBody}` with NEXA_ORDER_SECRET (env or app_secrets),
 * sent as X-Nexa-Timestamp + X-Nexa-Signature: sha256=<hex>. 5-minute window.
 * Idempotent per order_id (unique invoices.external_order_id).
 * All money is recomputed here in integer cents; the caller's totals are ignored.
 */

const RETURN_ORIGIN = 'https://nexavisiongroup.com';
const PAY_BASE = 'https://jhpsfl.com/pay';

type InItem = { description: string; quantity: number; unit_price: number };
type InBody = {
  order_id: string;
  customer: { name: string; email: string; phone?: string; company?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; zip?: string } };
  items: InItem[];
  notes?: string;
  return_url?: string;
};

const s = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cents = (n: number) => Math.round(Number(n) * 100);

// Secret: Vercel env if set, otherwise the service-role-only app_secrets table
// (the live JHPS Vercel account's API token isn't available to set env vars).
let cached: { v: string; at: number } | null = null;
async function orderSecret(): Promise<string | null> {
  if (process.env.NEXA_ORDER_SECRET) return process.env.NEXA_ORDER_SECRET;
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.v;
  const { data } = await createSupabaseAdmin().from('app_secrets').select('value').eq('key', 'NEXA_ORDER_SECRET').maybeSingle();
  if (!data?.value) return null;
  cached = { v: data.value, at: Date.now() };
  return cached.v;
}

async function verify(raw: string, ts: string | null, sig: string | null) {
  const secret = await orderSecret();
  if (!secret || !ts || !sig) return false;
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;
  const want = Buffer.from('sha256=' + createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex'));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

function invoiceNumber() {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const d = new Date();
  const ym = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const bytes = randomBytes(8);
  let r = '';
  for (let i = 0; i < 8; i++) r += a[bytes[i] % a.length];
  return `NXP-${ym}-${r}`;
}

function payUrl(num: string, c: InBody['customer']) {
  const q = new URLSearchParams({ invoice: num, brand: 'nexa' });
  if (c.name) q.set('name', c.name);
  if (c.email) q.set('email', c.email);
  if (c.phone) q.set('phone', c.phone);
  if (c.address?.line1) q.set('address', c.address.line1);
  if (c.address?.city) q.set('city', c.address.city);
  if (c.address?.zip) q.set('zip', c.address.zip);
  return `${PAY_BASE}?${q.toString()}`;
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await verify(raw, req.headers.get('x-nexa-timestamp'), req.headers.get('x-nexa-signature')))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let b: InBody;
  try {
    b = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const orderId = s(b.order_id, 40);
  const name = s(b.customer?.name, 120);
  const email = s(b.customer?.email, 160).toLowerCase();
  if (!orderId || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'order_id, customer name and email are required' }, { status: 400 });
  }
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 40) {
    return NextResponse.json({ error: 'items required' }, { status: 400 });
  }
  const returnUrl = s(b.return_url, 300);
  if (returnUrl && !returnUrl.startsWith(RETURN_ORIGIN + '/')) {
    return NextResponse.json({ error: 'return_url not allowed' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  // Idempotent: the same Nexa order always maps to the same invoice.
  const { data: existing } = await supabase
    .from('invoices')
    .select('invoice_number, total, status')
    .eq('external_order_id', orderId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ invoice_number: existing.invoice_number, total: existing.total, status: existing.status, pay_url: payUrl(existing.invoice_number, b.customer) });
  }

  const lineItems = [];
  let subtotalCents = 0;
  for (const it of b.items) {
    const qty = Math.floor(Number(it.quantity));
    const unit = cents(it.unit_price);
    const desc = s(it.description, 200);
    if (!desc || !(qty >= 1 && qty <= 99) || !(unit >= 0 && unit <= 1_000_000)) {
      return NextResponse.json({ error: 'invalid item' }, { status: 400 });
    }
    subtotalCents += unit * qty;
    lineItems.push({ id: randomBytes(6).toString('hex'), description: desc, quantity: qty, unit_price: unit / 100, amount: (unit * qty) / 100 });
  }
  const taxRate = Number(process.env.NEXA_TAX_RATE || 0); // percent; set once the accountant confirms
  const taxCents = Math.round(subtotalCents * (taxRate / 100));
  const totalCents = subtotalCents + taxCents;
  if (totalCents < 50) return NextResponse.json({ error: 'total too small' }, { status: 400 });

  // Customer: reuse by email, else create.
  let customerId: string | null = null;
  const { data: cust } = await supabase.from('customers').select('id').eq('email', email).limit(1).maybeSingle();
  if (cust) customerId = cust.id;
  else {
    const a = b.customer.address || {};
    const { data: created } = await supabase
      .from('customers')
      .insert({
        name,
        email,
        phone: s(b.customer.phone, 40) || null,
        company_name: s(b.customer.company, 160) || null,
        address: [s(a.line1), s(a.line2)].filter(Boolean).join(', ') || null,
        city: s(a.city, 80) || null,
        zip: s(a.zip, 12) || null,
      })
      .select('id')
      .single();
    customerId = created?.id || null;
  }

  const due = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];
  for (let attempt = 0; attempt < 4; attempt++) {
    const num = invoiceNumber();
    const url = payUrl(num, b.customer);
    const { error } = await supabase.from('invoices').insert({
      customer_id: customerId,
      invoice_number: num,
      due_date: due,
      line_items: lineItems,
      subtotal: subtotalCents / 100,
      tax_rate: taxRate,
      tax_amount: taxCents / 100,
      surcharge: false,
      surcharge_amount: 0,
      total: totalCents / 100,
      amount: totalCents / 100,
      amount_paid: 0,
      status: 'sent',
      brand: 'nexa',
      notes: [`Nexa Pro order ${orderId}`, s(b.notes, 800)].filter(Boolean).join('\n'),
      payment_link: url,
      sent_at: new Date().toISOString(),
      external_source: 'nexa',
      external_order_id: orderId,
      return_url: returnUrl || null,
    });
    if (!error) {
      return NextResponse.json({ invoice_number: num, total: totalCents / 100, status: 'sent', pay_url: url }, { status: 201 });
    }
    // Unique clash on invoice_number: retry with a new number. Clash on the order id: a concurrent call won.
    if (!/duplicate key/i.test(error.message)) {
      console.error('NEXA_ORDER_INSERT', error);
      return NextResponse.json({ error: 'could not create invoice' }, { status: 500 });
    }
    const { data: raced } = await supabase.from('invoices').select('invoice_number, total, status').eq('external_order_id', orderId).maybeSingle();
    if (raced) return NextResponse.json({ invoice_number: raced.invoice_number, total: raced.total, status: raced.status, pay_url: payUrl(raced.invoice_number, b.customer) });
  }
  return NextResponse.json({ error: 'could not allocate invoice number' }, { status: 500 });
}

/** Status lookup for the Nexa admin: GET ?order_id=… with the same HMAC over `${ts}.${order_id}`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = s(url.searchParams.get('order_id'), 40);
  if (!orderId || !(await verify(orderId, req.headers.get('x-nexa-timestamp'), req.headers.get('x-nexa-signature')))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number, total, amount_paid, status, paid_date')
    .eq('external_order_id', orderId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(data);
}
