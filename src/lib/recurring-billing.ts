import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { advanceBillingDate, chargeStoredCard } from '@/lib/square';
import { brandMail } from '@/lib/brand-mail';
import { getBrand } from '@/lib/brand-config';
import { generateReceiptPDF, getReceiptFilename, generateReceiptNumber } from '@/lib/receipt-generator';
import type { ReceiptData } from '@/lib/receipt-generator';
import { STATEMENT_NAME, longDate, usd } from '@/lib/recurring-text';

export const MAX_ATTEMPTS = 3;
export const PAY_HOST = 'https://pay.nexavisiongroup.com';
const today = () => new Date().toISOString().split('T')[0];
const addDays = (d: string, n: number) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 864e5).toISOString().split('T')[0];

export const cardUrl = (sub: { card_token?: string | null }) => `${PAY_HOST}/pay/card?t=${sub.card_token}`;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Plain, branded customer or staff email. Never throws: a mail problem must not undo billing. */
export async function billingEmail(sub: any, to: string | undefined | null, subject: string, html: string, attachments?: { filename: string; content: string }[]) {
  if (!to) return;
  try {
    const brand = getBrand(sub.brand);
    const { resend, from } = brandMail(brand);
    const { error } = await resend.emails.send({
      from, to: [to], replyTo: brand.email, subject, attachments,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#10211f;max-width:560px;margin:0 auto;padding:12px"><p style="font-size:18px;font-weight:700;margin:0 0 16px">${esc(brand.name)}</p>${html}<p style="margin:24px 0 0;color:#51625f;font-size:14px">${esc(brand.name)} · ${esc(brand.email)}</p></div>`,
    });
    if (error) console.error('BILLING_EMAIL_ERROR', error);
  } catch (e) {
    console.error('BILLING_EMAIL_ERROR', e);
  }
}
export const staffEmail = (sub: any) => getBrand(sub.brand).email;
const button = (href: string, label: string) => `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#0f5c55;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:9px">${label}</a></p>`;
const hi = (sub: any) => `<p>Hi ${esc((sub.customers?.name || '').split(' ')[0] || 'there')},</p>`;

export const chargeTotal = (sub: any) => Math.round((Number(sub.amount) + Number(sub.extra_amount || 0)) * 100);

/** True when this exact charge is over the customer's limit and hasn't been approved. Approval covers one amount on one date. */
export function needsApproval(sub: any) {
  if (sub.brand !== 'nexa') return false;
  const cents = chargeTotal(sub);
  if (cents <= Math.round(Number(sub.charge_limit ?? 2000) * 100)) return false;
  return !(Number(sub.approved_cents) === cents && sub.approved_for === sub.next_billing_date);
}

/** Tells staff once per amount and date. The customer hears nothing until it's approved. */
export async function alertApproval(supabase: SupabaseClient, sub: any) {
  const mark = `${sub.next_billing_date}:${chargeTotal(sub)}`;
  if (!sub.next_billing_date || sub.approval_alerted_for === mark) return;
  await supabase.from('subscriptions').update({ approval_alerted_for: mark }).eq('id', sub.id);
  const extra = Number(sub.extra_amount || 0);
  await billingEmail(sub, staffEmail(sub), `Approval needed: ${usd(chargeTotal(sub) / 100)} for ${sub.customers?.name || sub.plan_name}`,
    `<p><b>${esc(sub.customers?.name)}</b>'s next charge is <b>${usd(chargeTotal(sub) / 100)}</b>, over their ${usd(Number(sub.charge_limit ?? 2000))} limit. It won't charge until you approve it.</p><p>Monthly price ${usd(Number(sub.amount))}.${extra > 0 ? ` Added: ${usd(extra)} (${esc(sub.extra_note)}).` : ''} Charge date: ${longDate(sub.next_billing_date)}.</p><p>Approve or change it on the billing panel of their proposal${sub.reference ? ` ${esc(sub.reference)}` : ''}.</p>`);
}

function classify(err: unknown): { definite: boolean; card: boolean; message: string } {
  const e = err as { statusCode?: number; errors?: { code?: string; category?: string }[]; message?: string };
  const status = Number(e?.statusCode);
  const codes = (e?.errors || []).map((x) => x.code).filter(Boolean).join(', ');
  // A 4xx means Square refused it. Anything else (timeout, 5xx) means we can't know whether money moved.
  const definite = status >= 400 && status < 500 && status !== 408 && status !== 429;
  const card = (e?.errors || []).some((x) => x.category === 'PAYMENT_METHOD_ERROR');
  return { definite, card, message: (codes || e?.message || 'Unknown error').slice(0, 300) };
}

function nextDate(sub: any) {
  return advanceBillingDate(sub.next_billing_date || today(), sub.frequency, sub.billing_day || undefined);
}

export type ChargeOutcome = { outcome: 'success' | 'failed' | 'no_card' | 'on_hold' | 'skipped' | 'needs_approval'; message?: string; paymentId?: string; nextBillingDate?: string };

/** Charges one due subscription once. Claims the charge first so a billing date can never charge twice. */
export async function chargeSubscription(supabase: SupabaseClient, sub: any): Promise<ChargeOutcome> {
  if (needsApproval(sub)) {
    await alertApproval(supabase, sub);
    return { outcome: 'needs_approval', message: `${usd(chargeTotal(sub) / 100)} is over the limit and needs approval.` };
  }
  let cardId: string | null = sub.square_card_id || null;
  if (!cardId) {
    const { data: card } = await supabase.from('stored_cards').select('square_card_id').eq('customer_id', sub.customer_id).eq('is_default', true).maybeSingle();
    cardId = card?.square_card_id || null;
  }
  const cents = chargeTotal(sub);
  const amount = cents / 100;
  if (!cardId) {
    await supabase.from('billing_log').insert({ subscription_id: sub.id, customer_id: sub.customer_id, amount, status: 'no_card', error_message: 'No stored card on file' });
    return { outcome: 'no_card', message: 'No stored card on file for this customer' };
  }

  const key = `${sub.id}:${sub.next_billing_date || today()}:${sub.failed_attempts || 0}`;
  const { data: claim, error: claimErr } = await supabase.from('billing_log')
    .insert({ subscription_id: sub.id, customer_id: sub.customer_id, amount, status: 'pending', charge_key: key })
    .select('id').single();
  if (claimErr) {
    if (claimErr.code !== '23505') return { outcome: 'skipped', message: claimErr.message };
    return await settleEarlierClaim(supabase, sub, key);
  }

  const brand = getBrand(sub.brand);
  const note = `${brand.name}: ${sub.plan_name}${sub.reference ? ` (${sub.reference})` : ''}`;
  let pay;
  try {
    pay = await chargeStoredCard(cardId, cents, sub.customers?.square_customer_id || '', note, sub.customers?.email || undefined, createHash('sha256').update(key).digest('hex').slice(0, 45));
  } catch (err) {
    const c = classify(err);
    if (!c.definite) {
      await hold(supabase, sub, `Square didn't confirm the ${usd(amount)} charge: ${c.message}`);
      return { outcome: 'on_hold', message: c.message };
    }
    await supabase.from('billing_log').update({ status: 'failed', error_message: c.message }).eq('id', claim.id);
    await recordFailure(supabase, sub, amount, c.message, c.card);
    return { outcome: 'failed', message: c.message };
  }

  // The money has moved. From here a problem must never cause another charge.
  await supabase.from('billing_log').update({ status: 'success', square_payment_id: pay.paymentId }).eq('id', claim.id);
  await supabase.from('payments').insert({
    brand: sub.brand === 'nexa' ? 'nexa' : 'jhps', customer_id: sub.customer_id, subscription_id: sub.id, amount, status: 'completed',
    square_payment_id: pay.paymentId, square_receipt_url: pay.receiptUrl, payment_method: 'card', notes: `Auto-billing: ${note}`, paid_at: new Date().toISOString(),
  });
  const next = await markCharged(supabase, sub);
  await sendReceipt(sub, cents, pay.paymentId);
  return { outcome: 'success', paymentId: pay.paymentId, nextBillingDate: next };
}

/** Moves to the next date and clears what was just billed. Remembers the usage month so it can't bill twice. */
export function chargedPatch(sub: any) {
  return {
    next_billing_date: nextDate(sub), extra_amount: 0, extra_note: null, extra_period: null, approved_cents: null, approved_for: null,
    ...(sub.extra_period ? { last_billed_period: sub.extra_period } : {}),
    failed_attempts: 0, retry_on: null, last_error: null, charge_count: (sub.charge_count || 0) + 1,
  };
}

async function markCharged(supabase: SupabaseClient, sub: any) {
  const patch = chargedPatch(sub);
  await supabase.from('subscriptions').update(patch).eq('id', sub.id);
  return patch.next_billing_date;
}

/** The same charge was claimed before: finish its bookkeeping, and never charge again. */
async function settleEarlierClaim(supabase: SupabaseClient, sub: any, key: string): Promise<ChargeOutcome> {
  const { data: row } = await supabase.from('billing_log').select('status').eq('charge_key', key).maybeSingle();
  if (row?.status === 'success') {
    const next = await markCharged(supabase, sub);
    return { outcome: 'skipped', message: 'Already charged', nextBillingDate: next };
  }
  if (row?.status === 'failed') {
    await recordFailure(supabase, sub, chargeTotal(sub) / 100, sub.last_error || 'Earlier attempt failed', false);
    return { outcome: 'skipped', message: 'Earlier attempt had failed' };
  }
  await hold(supabase, sub, 'An earlier charge never finished, so we stopped to avoid charging twice.');
  return { outcome: 'on_hold', message: 'Earlier charge unconfirmed' };
}

async function hold(supabase: SupabaseClient, sub: any, why: string) {
  await supabase.from('subscriptions').update({ status: 'on_hold', last_error: why.slice(0, 300) }).eq('id', sub.id);
  await billingEmail(sub, staffEmail(sub), `Check billing: ${sub.customers?.name || sub.plan_name}`,
    `<p><b>Automatic billing stopped for ${esc(sub.customers?.name)}.</b></p><p>${esc(why)}</p><p>Look in Square to see whether the charge went through, then record the answer on the proposal's billing panel. It won't charge again until you do.</p>`);
}

async function recordFailure(supabase: SupabaseClient, sub: any, amount: number, message: string, cardProblem: boolean) {
  const attempts = (sub.failed_attempts || 0) + 1;
  const giveUp = attempts >= MAX_ATTEMPTS;
  const retry = giveUp ? null : addDays(today(), attempts === 1 ? 3 : 4);
  await supabase.from('subscriptions').update({ failed_attempts: attempts, retry_on: retry, last_error: message.slice(0, 300), ...(giveUp ? { status: 'past_due' } : {}) }).eq('id', sub.id);

  const name = sub.customers?.name || sub.plan_name;
  await billingEmail(sub, staffEmail(sub), `${giveUp ? 'Billing stopped' : 'Card failed'}: ${name} (${usd(amount)})`,
    `<p><b>${esc(name)}</b>: the ${usd(amount)} charge failed (attempt ${attempts} of ${MAX_ATTEMPTS}).</p><p>Reason from Square: ${esc(message)}</p><p>${giveUp ? 'We stopped trying. Billing restarts when they update their card, or when you resume it.' : `We'll try again on ${longDate(retry!)}.`}</p>`);
  if (cardProblem && sub.card_token) {
    await billingEmail(sub, sub.customers?.email, `Your card didn't go through: ${getBrand(sub.brand).name}`,
      `${hi(sub)}<p>We tried to charge ${usd(amount)} for ${esc(sub.plan_name)}, and your card was declined.</p><p>${giveUp ? 'We have stopped trying, so please update your card to keep your service running.' : `We'll try again on ${longDate(retry!)}. If your card has changed, update it here first.`}</p>${button(cardUrl(sub), 'Update your card')}`);
  }
}

async function sendReceipt(sub: any, cents: number, paymentId: string) {
  const email = sub.customers?.email;
  if (!email) return;
  try {
    const brand = getBrand(sub.brand);
    const baseCents = Math.round(Number(sub.amount) * 100);
    const extraCents = cents - baseCents;
    const lineItems = [{ name: sub.plan_name, quantity: 1, unitPrice: baseCents, totalPrice: baseCents }];
    if (extraCents > 0) lineItems.push({ name: sub.extra_note || 'Additional charges', quantity: 1, unitPrice: extraCents, totalPrice: extraCents });
    const receiptNum = generateReceiptNumber();
    const data: ReceiptData = {
      paymentId, receiptNumber: receiptNum, paymentDate: new Date(), customerName: sub.customers?.name || 'Valued Customer', customerEmail: email,
      lineItems, subtotal: cents, taxAmount: 0, totalAmount: cents, paymentStatus: 'COMPLETED', brandKey: brand.key,
    };
    const pdf = await generateReceiptPDF(data);
    const lines = lineItems.map((l) => `<li>${esc(l.name)}: ${usd(l.totalPrice / 100)}</li>`).join('');
    await billingEmail(sub, email, `Payment Confirmation: ${usd(cents / 100)} - ${brand.name}`,
      `${hi(sub)}<p>Your automatic payment of <b>${usd(cents / 100)}</b> went through.</p><ul>${lines}</ul><p>Receipt #${receiptNum} is attached.${sub.brand === 'nexa' ? ` This charge appears on your card statement as ${STATEMENT_NAME}.` : ''}</p>`,
      [{ filename: getReceiptFilename(data), content: pdf.toString('base64') }]);
  } catch (e) {
    console.error('BILLING_RECEIPT_ERROR', e);
  }
}

/** Tells the customer what the next charge will be. Sent before any new or different amount. */
export async function emailUpcomingCharge(sub: any) {
  if (!sub.next_billing_date) return;
  const extra = Number(sub.extra_amount || 0);
  const list = `<ul><li>${esc(sub.plan_name)}: ${usd(Number(sub.amount))}</li>${extra > 0 ? `<li>${esc(sub.extra_note || 'Additional charges')}: ${usd(extra)}</li>` : ''}</ul>`;
  await billingEmail(sub, sub.customers?.email, `Your next charge: ${usd(chargeTotal(sub) / 100)} on ${longDate(sub.next_billing_date)}`,
    `${hi(sub)}<p>Your card ending in ${esc(sub.card_last4 || '')} will be charged <b>${usd(chargeTotal(sub) / 100)}</b> on <b>${longDate(sub.next_billing_date)}</b>.</p>${list}<p>Questions? Just reply to this email.</p>`);
}

/** Heads-up to staff 3 days before a charge, in case that month's usage amount hasn't arrived. */
export async function remindStaff(supabase: SupabaseClient, sub: any) {
  await supabase.from('subscriptions').update({ reminded_for: sub.next_billing_date }).eq('id', sub.id);
  const extra = Number(sub.extra_amount || 0);
  await billingEmail(sub, staffEmail(sub), `Charging on ${longDate(sub.next_billing_date)}: ${sub.customers?.name || sub.plan_name} (${usd(chargeTotal(sub) / 100)})`,
    `<p><b>${esc(sub.customers?.name)}</b> will be charged <b>${usd(chargeTotal(sub) / 100)}</b> on ${longDate(sub.next_billing_date)}.</p><p>Monthly price ${usd(Number(sub.amount))}. ${extra > 0 ? `Added this month: ${usd(extra)} (${esc(sub.extra_note)}).` : 'Nothing added this month.'} This will be charge number ${(sub.charge_count || 0) + 1}.</p>${sub.plan_note ? `<p>Their plan: ${esc(sub.plan_note)}</p>` : ''}`);
}
