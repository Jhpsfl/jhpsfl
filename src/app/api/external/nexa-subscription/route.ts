import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createSupabaseAdmin } from '@/lib/supabase';
import { verifyNexaSignature } from '@/lib/nexa-hmac';
import { advanceBillingDate, deleteStoredCard } from '@/lib/square';
import { alertApproval, billingEmail, cardUrl, chargedPatch, chargeTotal, emailUpcomingCharge, needsApproval } from '@/lib/recurring-billing';

/**
 * Server-to-server: nexavisiongroup.com manages a customer's automatic billing.
 * Same HMAC as nexa-order. Idempotent per order_id (the signed proposal's id).
 * POST { action: ensure | update | approve | pause | resume | cancel | resolve, order_id, ... }
 * GET  ?order_id=… returns status and charge history. Signature is over the order_id.
 */

const SELECT = '*, customers(id, name, email, phone, square_customer_id)';
const s = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const today = () => new Date().toISOString().split('T')[0];
const money = (v: unknown) => Math.round(Number(v) * 100) / 100;
const MAX_CHARGE = 25000;

function view(sub: any, history: any[] = []) {
  return {
    status: sub.status, amount: Number(sub.amount), extra_amount: Number(sub.extra_amount || 0), extra_note: sub.extra_note, extra_period: sub.extra_period,
    last_billed_period: sub.last_billed_period, next_billing_date: sub.next_billing_date, retry_on: sub.retry_on, failed_attempts: sub.failed_attempts, last_error: sub.last_error,
    card_brand: sub.card_brand, card_last4: sub.card_last4, card_authorized_at: sub.card_authorized_at, charge_count: sub.charge_count,
    plan_note: sub.plan_note, card_url: cardUrl(sub), charge_limit: Number(sub.charge_limit ?? 2000), needs_approval: needsApproval(sub),
    history: history.map((h) => ({ at: h.created_at, amount: Number(h.amount), status: h.status, error: h.status === 'failed' ? h.error_message : null })),
  };
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await verifyNexaSignature(raw, req.headers.get('x-nexa-timestamp'), req.headers.get('x-nexa-signature')))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let b: any;
  try { b = JSON.parse(raw); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  const orderId = s(b.order_id, 40);
  if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  const supabase = createSupabaseAdmin();

  const load = async () => (await supabase.from('subscriptions').select(SELECT).eq('external_order_id', orderId).maybeSingle()).data;
  const save = async (patch: Record<string, unknown>) => {
    const { data, error } = await supabase.from('subscriptions').update(patch).eq('external_order_id', orderId).select(SELECT).single();
    if (error) throw new Error(error.message);
    return data;
  };

  try {
    if (b.action === 'diag_receipt') { // TEMPORARY
      const { generateReceiptPDF } = await import('@/lib/receipt-generator');
      try {
        const pdf = await generateReceiptPDF({ paymentId: 'diagnostic', receiptNumber: 'R-DIAG', paymentDate: new Date(), customerName: 'T', customerEmail: 'a@b.c', lineItems: [{ name: 'n', quantity: 1, unitPrice: 100, totalPrice: 100 }], subtotal: 100, taxAmount: 0, totalAmount: 100, paymentStatus: 'COMPLETED', brandKey: 'nexa' } as any);
        return NextResponse.json({ ok: true, bytes: pdf.length });
      } catch (e) {
        return NextResponse.json({ ok: false, error: e instanceof Error ? (e.message + ' :: ' + (e.stack || '')).slice(0, 900) : String(e) });
      }
    }

    if (b.action === 'ensure') {
      const found = await load();
      const dueInvoice = s(b.due_invoice, 40) || null;
      if (found) {
        // The signing payment's invoice can be created after the billing record.
        if (dueInvoice && found.due_invoice !== dueInvoice) return NextResponse.json(view(await save({ due_invoice: dueInvoice })));
        return NextResponse.json(view(found));
      }
      const name = s(b.customer?.name, 120);
      const email = s(b.customer?.email, 160).toLowerCase();
      const amount = money(b.amount);
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'customer name and email are required' }, { status: 400 });
      if (!(amount >= 1 && amount <= MAX_CHARGE)) return NextResponse.json({ error: 'invalid amount' }, { status: 400 });

      let customerId: string | null = null;
      const { data: cust } = await supabase.from('customers').select('id').eq('email', email).limit(1).maybeSingle();
      if (cust) customerId = cust.id;
      else {
        const { data: created, error } = await supabase.from('customers').insert({ brand: 'nexa', name, email, phone: s(b.customer?.phone, 40) || null, company_name: s(b.customer?.company, 160) || null }).select('id').single();
        if (error) throw new Error(error.message);
        customerId = created.id;
      }
      const returnUrl = s(b.return_url, 300);
      const { error } = await supabase.from('subscriptions').insert({
        customer_id: customerId, brand: 'nexa', external_order_id: orderId, card_token: randomBytes(24).toString('base64url'),
        plan_name: s(b.plan_name, 160) || 'Monthly service', service_type: 'Managed Digital Operations', frequency: 'monthly', amount,
        due_invoice: dueInvoice, status: 'awaiting_card', billing_mode: 'auto', next_billing_date: null, reference: s(b.reference, 40) || null, plan_note: s(b.plan_note, 1500) || null,
        return_url: returnUrl.startsWith('https://nexavisiongroup.com/') ? returnUrl : null,
      });
      // Two calls at once: the other one won, which is fine.
      if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
      return NextResponse.json(view(await load()), { status: 201 });
    }

    const sub = await load();
    if (!sub) return NextResponse.json({ error: 'not found' }, { status: 404 });
    if (sub.status === 'cancelled') return NextResponse.json({ error: 'Automatic billing was cancelled for this customer.' }, { status: 409 });

    if (b.action === 'update') {
      const patch: Record<string, unknown> = {};
      if ('amount' in b) {
        const a = money(b.amount);
        if (!(a >= 1 && a <= MAX_CHARGE)) return NextResponse.json({ error: 'The monthly price must be between $1 and $25,000.' }, { status: 400 });
        patch.amount = a;
      }
      if ('extra_amount' in b) {
        const x = money(b.extra_amount || 0);
        const period = s(b.period, 7);
        if (!(x >= 0 && x <= MAX_CHARGE)) return NextResponse.json({ error: 'The added amount must be between $0 and $25,000.' }, { status: 400 });
        if (x > 0 && !s(b.extra_note, 160)) return NextResponse.json({ error: 'Say what the added amount is for. The customer sees it.' }, { status: 400 });
        if (period && !/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: 'period must look like 2026-12.' }, { status: 400 });
        // A re-run for a month that was already charged must not bill it again.
        if (period && sub.last_billed_period && period <= sub.last_billed_period) return NextResponse.json({ error: `${period} was already billed.`, already_billed: true }, { status: 409 });
        patch.extra_amount = x;
        patch.extra_note = x > 0 ? s(b.extra_note, 160) : null;
        patch.extra_period = x > 0 ? period || null : null;
      }
      if ('next_billing_date' in b) {
        if (!isDate(b.next_billing_date) || b.next_billing_date < today()) return NextResponse.json({ error: 'Pick today or a later date.' }, { status: 400 });
        patch.next_billing_date = b.next_billing_date;
        patch.billing_day = Number(b.next_billing_date.slice(8, 10));
        patch.retry_on = null;
        if (sub.status === 'ready') patch.status = 'active';
      }
      if (!Object.keys(patch).length) return NextResponse.json(view(sub));
      const updated = await save(patch);
      // Same numbers sent again (a re-run) don't email the customer twice.
      const changed = Number(updated.amount) !== Number(sub.amount) || Number(updated.extra_amount) !== Number(sub.extra_amount) || updated.next_billing_date !== sub.next_billing_date || updated.status !== sub.status;
      const live = updated.square_card_id && updated.next_billing_date && updated.status === 'active';
      if (live && needsApproval(updated)) await alertApproval(supabase, updated);
      else if (changed && live && b.notify !== false) await emailUpcomingCharge(updated);
      return NextResponse.json(view(updated));
    }

    if (b.action === 'approve') {
      // Approves the amount the approver was looking at, so a later change needs its own approval.
      if (Number(b.total_cents) !== chargeTotal(sub)) return NextResponse.json({ error: 'The amount changed. Check the new total and approve again.' }, { status: 409 });
      if (!sub.next_billing_date) return NextResponse.json({ error: 'Set a charge date first.' }, { status: 409 });
      const updated = await save({ approved_cents: chargeTotal(sub), approved_for: sub.next_billing_date });
      if (updated.square_card_id && updated.status === 'active') await emailUpcomingCharge(updated);
      return NextResponse.json(view(updated));
    }

    if (b.action === 'pause') {
      if (!['active', 'ready', 'past_due'].includes(sub.status)) return NextResponse.json({ error: 'Nothing to pause.' }, { status: 409 });
      const updated = await save({ status: 'paused' });
      await billingEmail(updated, updated.customers?.email, 'Automatic billing paused', `<p>Automatic billing on your card is paused. We won't charge it until it's turned back on, and we'll email you first.</p>`);
      return NextResponse.json(view(updated));
    }

    if (b.action === 'resume') {
      if (!['paused', 'past_due'].includes(sub.status)) return NextResponse.json({ error: 'Nothing to resume.' }, { status: 409 });
      if (!sub.square_card_id) return NextResponse.json({ error: 'There is no card on file yet.' }, { status: 409 });
      let next = sub.next_billing_date as string | null;
      // Never back-bill for the time it was paused.
      while (sub.status === 'paused' && next && next < today()) next = advanceBillingDate(next, sub.frequency, sub.billing_day || undefined);
      const updated = await save({ status: next ? 'active' : 'ready', next_billing_date: next, failed_attempts: 0, retry_on: null, last_error: null });
      if (updated.status === 'active') await emailUpcomingCharge(updated);
      return NextResponse.json(view(updated));
    }

    if (b.action === 'resolve') {
      if (sub.status !== 'on_hold') return NextResponse.json({ error: 'This billing is not on hold.' }, { status: 409 });
      const key = `${sub.id}:${sub.next_billing_date || today()}:${sub.failed_attempts || 0}`;
      if (b.charged === true) {
        await supabase.from('billing_log').update({ status: 'success', error_message: 'Confirmed by staff in Square' }).eq('charge_key', key);
        return NextResponse.json(view(await save({ status: 'active', ...chargedPatch(sub) })));
      }
      await supabase.from('billing_log').update({ status: 'failed', error_message: 'Confirmed not charged by staff' }).eq('charge_key', key);
      // A new attempt number makes a new charge key, so the next run may charge.
      return NextResponse.json(view(await save({ status: 'active', failed_attempts: (sub.failed_attempts || 0) + 1, last_error: null })));
    }

    if (b.action === 'cancel') {
      if (sub.square_card_id) {
        await deleteStoredCard(sub.square_card_id).catch((e) => console.error('CARD_DISABLE', e));
        await supabase.from('stored_cards').delete().eq('square_card_id', sub.square_card_id);
      }
      const updated = await save({ status: 'cancelled', billing_mode: 'manual', square_card_id: null, cancelled_at: new Date().toISOString(), retry_on: null });
      await billingEmail(updated, updated.customers?.email, 'Automatic billing cancelled', `<p>Automatic billing is off and your card has been removed. We won't charge it again.</p>`);
      return NextResponse.json(view(updated));
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    console.error('NEXA_SUBSCRIPTION', e);
    return NextResponse.json({ error: 'Billing could not be updated. Try again.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const orderId = s(new URL(req.url).searchParams.get('order_id'), 40);
  if (!orderId || !(await verifyNexaSignature(orderId, req.headers.get('x-nexa-timestamp'), req.headers.get('x-nexa-signature')))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const supabase = createSupabaseAdmin();
  const { data: sub } = await supabase.from('subscriptions').select('*').eq('external_order_id', orderId).maybeSingle();
  if (!sub) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { data: history } = await supabase.from('billing_log').select('created_at, amount, status, error_message').eq('subscription_id', sub.id).order('created_at', { ascending: false }).limit(24);
  return NextResponse.json(view(sub, history || []));
}
