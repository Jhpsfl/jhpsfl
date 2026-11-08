import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { createHash } from 'crypto';
import { Currency, deleteStoredCard, ensureSquareCustomer, locationId, squareClient, storeCardOnFile } from '@/lib/square';
import { billingEmail, emailFirstPaymentReceipt, staffEmail } from '@/lib/recurring-billing';
import { balanceCents, checkCharge, loadInvoice, settleInvoice } from '@/lib/invoice-payment';
import { STATEMENT_NAME, authorizationText, longDate, usd } from '@/lib/recurring-text';

export const dynamic = 'force-dynamic';

const usdText = (cents: number) => usd(cents / 100);

/**
 * One card entry: pays whatever is due at signing, if anything, and saves the card for monthly billing.
 * No login. The server decides the amount from the invoice, never the browser.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const token = typeof b.token === 'string' ? b.token.slice(0, 80) : '';
  const cardToken = typeof b.cardToken === 'string' ? b.cardToken : '';
  if (!token || !cardToken) return NextResponse.json({ error: 'Please enter your card details.' }, { status: 400 });
  if (b.agreed !== true) return NextResponse.json({ error: 'Check the box to authorize automatic billing.' }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { data: sub } = await supabase.from('subscriptions').select('*, customers(id, name, email, phone)').eq('card_token', token).maybeSingle();
  if (!sub || sub.status === 'cancelled') return NextResponse.json({ error: 'This link is no longer active. Please contact us.' }, { status: 404 });

  let squareCustomerId: string;
  try {
    squareCustomerId = await ensureSquareCustomer(sub.customer_id, sub.customers?.name, sub.customers?.email, sub.customers?.phone);
  } catch (e) {
    console.error('PAY_CARD_CUSTOMER', e);
    return NextResponse.json({ error: "We couldn't process that card. Please try again." }, { status: 500 });
  }

  // ── Pay what's due at signing, if anything ──
  const invoice = sub.due_invoice ? await loadInvoice(supabase, sub.due_invoice) : null;
  const dueCents = invoice && !['paid', 'cancelled', 'void'].includes(invoice.status) ? balanceCents(invoice) : 0;
  // The customer must be paying the amount they were shown.
  if (Number(b.dueCents || 0) !== dueCents) return NextResponse.json({ error: 'The amount due changed. Refresh this page to see it.' }, { status: 409 });
  let storeSource = cardToken;
  if (invoice && dueCents > 0) {
    const problem = checkCharge(invoice, dueCents);
    if (problem) return NextResponse.json({ error: problem }, { status: 409 });
    let paymentId: string | undefined;
    let receiptUrl: string | null = null;
    try {
      const paid = await squareClient.payments.create({
        sourceId: cardToken,
        // Same card token => same key, so a double-submit can't charge twice.
        idempotencyKey: createHash('sha256').update(`${cardToken}|${dueCents}`).digest('hex').slice(0, 45),
        amountMoney: { amount: BigInt(dueCents), currency: Currency.Usd },
        locationId, customerId: squareCustomerId, autocomplete: true,
        note: `NexaVision Group: ${invoice.invoice_number}`.slice(0, 500),
      });
      if (paid.payment?.status !== 'COMPLETED') throw new Error(`Payment status ${paid.payment?.status}`);
      paymentId = paid.payment.id;
      receiptUrl = paid.payment.receiptUrl || null;
    } catch (e) {
      console.error('PAY_CARD_CHARGE', e instanceof Error ? e.message.slice(0, 300) : e);
      return NextResponse.json({ error: 'Your card was declined, so nothing was charged. Check the details or try a different card.' }, { status: 400 });
    }

    await settleInvoice(supabase, invoice, dueCents, invoice.customer_id ? {} : { customer_id: sub.customer_id });
    await supabase.from('payments').insert({
      brand: 'nexa', customer_id: sub.customer_id, subscription_id: sub.id, amount: dueCents / 100, status: 'completed',
      square_payment_id: paymentId, square_receipt_url: receiptUrl, payment_method: 'card', notes: `Signing payment: ${invoice.invoice_number}`, paid_at: new Date().toISOString(),
    });
    const { data: lines } = await supabase.from('invoices').select('line_items').eq('id', invoice.id).maybeSingle();
    await emailFirstPaymentReceipt(sub, dueCents, paymentId!, lines?.line_items?.[0]?.description || sub.plan_name);
    await billingEmail(sub, staffEmail(sub), `Paid: ${sub.customers?.name || sub.plan_name} (${usdText(dueCents)})`, `<p><b>${sub.customers?.name || sub.plan_name}</b> paid ${usdText(dueCents)} on ${invoice.invoice_number}.</p>`);
    storeSource = paymentId!;
  }

  let card;
  try {
    card = await storeCardOnFile(squareCustomerId, storeSource);
  } catch (e) {
    console.error('PAY_CARD_STORE', e instanceof Error ? e.message.slice(0, 300) : e);
    if (dueCents > 0) {
      // Their payment went through. Say so plainly, and ask only for the part that's left.
      await billingEmail(sub, staffEmail(sub), `Card not saved: ${sub.customers?.name || sub.plan_name}`, `<p>Their ${usdText(dueCents)} payment went through, but the card didn't save for monthly billing. They were asked to enter it once more.</p>`);
      return NextResponse.json({ error: `Your payment of ${usdText(dueCents)} went through. We couldn't save the card for monthly billing, so please enter it once more. You won't be charged again today.`, paidCents: dueCents }, { status: 400 });
    }
    return NextResponse.json({ error: "We couldn't save that card. Check the details or try a different card." }, { status: 400 });
  }

  const { count } = await supabase.from('stored_cards').select('id', { count: 'exact', head: true }).eq('customer_id', sub.customer_id);
  await supabase.from('stored_cards').insert({
    customer_id: sub.customer_id, square_card_id: card.cardId, brand: card.brand || null, last4: card.last4 || null,
    exp_month: card.expMonth || null, exp_year: card.expYear || null, is_default: (count || 0) === 0,
  });

  // A new card restarts billing that stopped because the old one kept failing.
  let status = sub.status;
  if (sub.status === 'awaiting_card') status = sub.next_billing_date ? 'active' : 'ready';
  if (sub.status === 'past_due') status = 'active';
  const firstTime = !sub.square_card_id;
  const now = new Date().toISOString();
  await supabase.from('subscriptions').update({
    square_card_id: card.cardId, card_brand: card.brand || null, card_last4: card.last4 || null, status,
    card_authorized_at: now,
    card_auth: {
      at: now, text: authorizationText(sub, dueCents), paid_today_cents: dueCents,
      ip: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      user_agent: (req.headers.get('user-agent') || '').slice(0, 300),
    },
    ...(sub.status === 'past_due' ? { failed_attempts: 0, retry_on: null, last_error: null } : {}),
  }).eq('id', sub.id);

  if (sub.square_card_id) {
    await deleteStoredCard(sub.square_card_id).catch((e) => console.error('CARD_DISABLE', e));
    await supabase.from('stored_cards').delete().eq('square_card_id', sub.square_card_id);
  }

  const name = sub.customers?.name || sub.plan_name;
  await billingEmail(sub, staffEmail(sub), `Card ${firstTime ? 'saved' : 'updated'}: ${name}`,
    `<p><b>${name}</b> ${firstTime ? 'saved' : 'updated'} their card (ending ${card.last4 || ''}) for automatic billing.</p><p>${sub.next_billing_date ? `Next charge: ${longDate(sub.next_billing_date)}.` : 'No charge date is set yet. Set the first charge date on their proposal when monthly service starts.'}</p>`);
  await billingEmail(sub, sub.customers?.email, 'Your card is saved for automatic billing',
    `<p>Your card ending in ${card.last4 || ''} is saved. ${sub.next_billing_date ? `Your next charge is on ${longDate(sub.next_billing_date)}.` : "Nothing was charged today, and we'll email you the first charge date before it happens."}</p><p>Charges appear on your card statement as ${STATEMENT_NAME}. To stop automatic billing, just reply to this email.</p>`);

  return NextResponse.json({ saved: true, last4: card.last4 || '', paidCents: dueCents });
}
