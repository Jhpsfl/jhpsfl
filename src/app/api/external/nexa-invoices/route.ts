import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { verifyNexaSignature } from '@/lib/nexa-hmac';
import { sendInvoiceEmail, shortenUrl } from '@/lib/invoice-email';
import { randomInt, randomUUID } from 'crypto';

/**
 * Server-to-server: the Nexa admin (nexavisiongroup.com/admin/invoices) lists every
 * Nexa-branded invoice here. Paid ones are hidden from the JHPS admin, so this is
 * where they live. POST lets the Nexa admin create / email / cancel Nexa invoices;
 * payment still happens on jhpsfl.com/pay (Nexa-skinned).
 *
 * Auth: same HMAC as /api/external/nexa-order. GET signs the message "nexa-invoices";
 * POST signs the raw JSON body.
 */

const PAY_BASE = 'https://jhpsfl.com/pay';

export async function GET(req: Request) {
  const ok = await verifyNexaSignature('nexa-invoices', req.headers.get('x-nexa-timestamp'), req.headers.get('x-nexa-signature'));
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdmin();
  const [{ data: invoices, error }, { data: payments }, { data: customers }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, customer_id, invoice_number, status, created_at, due_date, paid_date, line_items, subtotal, tax_rate, tax_amount, surcharge_amount, total, amount_paid, notes, external_source, external_order_id, no_email, customers(name, email, phone, company_name)')
      .eq('brand', 'nexa')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('payments')
      .select('amount, payment_method, paid_at, notes, square_receipt_url, stripe_payment_id, square_payment_id')
      .eq('brand', 'nexa')
      .eq('status', 'completed')
      .order('paid_at', { ascending: false })
      .limit(1000),
    supabase.from('customers').select('id, name, email, phone, company_name, brand').order('created_at', { ascending: false }).limit(2000),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Payments carry the invoice number in their note ("… INV#<number>")
  const byInvoice = new Map<string, NonNullable<typeof payments>>();
  for (const p of payments || []) {
    const m = (p.notes || '').match(/INV#([A-Z]{3}-\d{4}-[A-Z0-9]+)/);
    if (!m) continue;
    const list = byInvoice.get(m[1]) || [];
    list.push(p);
    byInvoice.set(m[1], list);
  }

  const data = (invoices || []).map((inv) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (inv as any).customers as { name?: string; email?: string; phone?: string; company_name?: string } | null;
    const paid = inv.status === 'paid';
    return {
      invoice_number: inv.invoice_number,
      status: inv.status,
      created_at: inv.created_at,
      due_date: inv.due_date,
      paid_date: inv.paid_date,
      customer: { name: c?.name || null, email: c?.email || null, phone: c?.phone || null, company: c?.company_name || null },
      line_items: inv.line_items || [],
      subtotal: Number(inv.subtotal || 0),
      tax_rate: Number(inv.tax_rate || 0),
      tax_amount: Number(inv.tax_amount || 0),
      surcharge_amount: Number(inv.surcharge_amount || 0),
      total: Number(inv.total || 0),
      amount_paid: Number(inv.amount_paid || 0),
      notes: inv.notes || null,
      source: inv.external_source || 'manual',
      order_id: inv.external_order_id || null,
      no_email: !!inv.no_email,
      pay_url: paid ? null : `${PAY_BASE}?invoice=${encodeURIComponent(inv.invoice_number)}&brand=nexa`,
      payments: (byInvoice.get(inv.invoice_number) || []).map((p) => ({
        amount: Number(p.amount || 0),
        method: p.payment_method || null,
        paid_at: p.paid_at,
        processor: p.stripe_payment_id ? 'stripe' : p.square_payment_id ? 'square' : null,
        receipt_url: p.square_receipt_url || null,
      })),
    };
  });

  // Customer picker: phone-only customers, plus JHPS customers who have bought from Nexa
  const nexaBuyers = new Set((invoices || []).map((i) => i.customer_id).filter(Boolean));
  const pick = (customers || [])
    .filter((c) => c.brand === 'nexa' || nexaBuyers.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, company: c.company_name }));

  return NextResponse.json({ invoices: data, customers: pick });
}

// ─── Writes ──────────────────────────────────────────────────────────────

type Item = { description: string; quantity: number; unit_price: number };
type CreateBody = {
  action: 'create';
  // Omit (or link_only) for a link-only invoice: the customer fills in their info on the pay page,
  // and the payment creates + links their customer record (brand nexa).
  customer?: { id?: string; name?: string; email?: string; phone?: string; company?: string } | null;
  link_only?: boolean;
  items: Item[];
  tax_rate?: number;
  surcharge?: boolean;
  due_date?: string | null;
  notes?: string;
  no_email?: boolean;
  send?: boolean;
};
type Body = CreateBody | { action: 'send' | 'delete' | 'link'; invoice_number: string };

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cents = (n: unknown) => Math.round(Number(n) * 100);
type Supabase = ReturnType<typeof createSupabaseAdmin>;

function invoiceNumber() {
  const d = new Date();
  return `INV-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${randomInt(1000, 10000)}`;
}

function payUrl(num: string, c: { name?: string | null; email?: string | null; phone?: string | null } | null) {
  const q = new URLSearchParams({ invoice: num, brand: 'nexa' });
  if (c?.name) q.set('name', c.name);
  if (c?.email) q.set('email', c.email);
  if (c?.phone) q.set('phone', c.phone);
  return `${PAY_BASE}?${q.toString()}`;
}

async function loadNexaInvoice(supabase: Supabase, num: string) {
  const { data } = await supabase
    .from('invoices')
    .select('*, customers(name, email, phone, company_name, customer_type)')
    .eq('invoice_number', num)
    .eq('brand', 'nexa')
    .maybeSingle();
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function emailIt(supabase: Supabase, inv: any, link: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cust = inv.customers;
  if (inv.no_email) return { ok: false, error: 'This invoice is set to "No emails". Copy the link and text it.' };
  if (!cust?.email) return { ok: false, error: 'This customer has no email address.' };
  const r = await sendInvoiceEmail(supabase, inv, cust, link);
  if (!r.ok) return { ok: false, error: r.error };
  await supabase
    .from('invoices')
    .update({ status: inv.status === 'draft' ? 'sent' : inv.status, sent_at: new Date().toISOString(), payment_link: link })
    .eq('id', inv.id);
  return { ok: true };
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await verifyNexaSignature(raw, req.headers.get('x-nexa-timestamp'), req.headers.get('x-nexa-signature')))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let b: Body;
  try {
    b = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }
  const supabase = createSupabaseAdmin();

  if (b.action === 'create') return create(supabase, b);

  const num = str(b.invoice_number, 40);
  const inv = num ? await loadNexaInvoice(supabase, num) : null;
  if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  if (b.action === 'delete') {
    if (inv.status === 'paid' || Number(inv.amount_paid || 0) > 0) {
      return NextResponse.json({ error: 'This invoice has payments, so it cannot be deleted.' }, { status: 400 });
    }
    const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (inv.status === 'paid') return NextResponse.json({ error: 'Invoice is already paid.' }, { status: 400 });
  const link = await shortenUrl(payUrl(inv.invoice_number, inv.customers), `Payment: ${inv.invoice_number}`, supabase);

  if (b.action === 'link') return NextResponse.json({ ok: true, short_url: link });

  if (b.action === 'send') {
    const r = await emailIt(supabase, inv, link);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, short_url: link, emailed: true });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

async function create(supabase: Supabase, b: CreateBody) {
  // ─── Items + money (integer cents, recomputed here; same math as the JHPS invoice form) ───
  const items = (Array.isArray(b.items) ? b.items : [])
    .map((i) => ({
      description: str(i.description, 300),
      quantity: Math.max(1, Math.min(999, Math.round(Number(i.quantity) || 1))),
      unitCents: cents(i.unit_price),
    }))
    .filter((i) => i.description && i.unitCents > 0 && i.unitCents < 10_000_000);
  if (!items.length) return NextResponse.json({ error: 'Add at least one item with a price.' }, { status: 400 });
  const taxRate = Math.max(0, Math.min(20, Number(b.tax_rate) || 0));
  const subtotalCents = items.reduce((s, i) => s + i.unitCents * i.quantity, 0);
  const surchargeCents = b.surcharge ? Math.round(subtotalCents * 0.04) : 0;
  const taxCents = Math.round((subtotalCents + surchargeCents) * (taxRate / 100));
  const totalCents = subtotalCents + surchargeCents + taxCents;
  const lineItems = items.map((i) => ({
    id: randomUUID(),
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unitCents / 100,
    amount: (i.unitCents * i.quantity) / 100,
  }));

  // ─── Customer: existing id, else match by email/phone, else create as a Nexa customer ───
  const c = b.customer || {};
  let customerId: string | null = null;
  if (b.link_only || !b.customer) {
    customerId = null;
  } else if (c.id) {
    const { data } = await supabase.from('customers').select('id').eq('id', str(c.id, 40)).maybeSingle();
    customerId = data?.id || null;
    if (!customerId) return NextResponse.json({ error: 'Customer not found' }, { status: 400 });
  } else {
    const name = str(c.name, 120);
    const email = str(c.email, 200).toLowerCase();
    const phone = str(c.phone, 40);
    if (!name && !email && !phone) return NextResponse.json({ error: 'Pick a customer or enter a name.' }, { status: 400 });
    if (email) {
      const { data } = await supabase.from('customers').select('id').ilike('email', email).limit(1).maybeSingle();
      customerId = data?.id || null;
    }
    if (!customerId && phone) {
      const { data } = await supabase.from('customers').select('id').eq('phone', phone).limit(1).maybeSingle();
      customerId = data?.id || null;
    }
    if (!customerId) {
      const { data, error } = await supabase
        .from('customers')
        .insert({ brand: 'nexa', name: name || null, email: email || null, phone: phone || null, company_name: str(c.company, 160) || null })
        .select('id')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      customerId = data.id;
    }
  }

  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(b.due_date || '')) ? b.due_date : null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const num = invoiceNumber();
    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        customer_id: customerId,
        invoice_number: num,
        status: 'sent',
        brand: 'nexa',
        amount: totalCents / 100,
        subtotal: subtotalCents / 100,
        tax_rate: taxRate,
        tax_amount: taxCents / 100,
        surcharge: !!b.surcharge,
        surcharge_amount: surchargeCents / 100,
        total: totalCents / 100,
        amount_paid: 0,
        due_date: dueDate,
        notes: str(b.notes, 2000) || null,
        line_items: lineItems,
        no_email: !!b.no_email,
      })
      .select('*, customers(name, email, phone, company_name, customer_type)')
      .single();
    if (error) {
      if (error.code === '23505') continue; // invoice number taken — try another
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const link = await shortenUrl(payUrl(num, inv.customers), `Payment: ${num}`, supabase);
    await supabase.from('invoices').update({ payment_link: link }).eq('id', inv.id);
    let emailed = false;
    let emailError: string | null = null;
    if (b.send && !b.no_email) {
      const r = await emailIt(supabase, inv, link);
      emailed = r.ok;
      if (!r.ok) emailError = r.error;
    }
    return NextResponse.json(
      { ok: true, invoice_number: num, total: totalCents / 100, short_url: link, emailed, email_error: emailError },
      { status: 201 }
    );
  }
  return NextResponse.json({ error: 'Could not allocate an invoice number' }, { status: 500 });
}
