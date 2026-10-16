import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { verifyNexaSignature } from '@/lib/nexa-hmac';

/**
 * Server-to-server: the Nexa admin (nexavisiongroup.com/admin/invoices) lists every
 * Nexa-branded invoice here. Paid ones are hidden from the JHPS admin, so this is
 * where they live. Read-only.
 *
 * Auth: same HMAC as /api/external/nexa-order, message = "nexa-invoices".
 */

const PAY_BASE = 'https://jhpsfl.com/pay';

export async function GET(req: Request) {
  const ok = await verifyNexaSignature('nexa-invoices', req.headers.get('x-nexa-timestamp'), req.headers.get('x-nexa-signature'));
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdmin();
  const [{ data: invoices, error }, { data: payments }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, status, created_at, due_date, paid_date, line_items, subtotal, tax_rate, tax_amount, surcharge_amount, total, amount_paid, notes, external_source, external_order_id, no_email, customers(name, email, phone, company_name)')
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

  return NextResponse.json({ invoices: data });
}
