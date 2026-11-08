import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { deleteStoredCard, ensureSquareCustomer, storeCardOnFile } from '@/lib/square';
import { billingEmail, staffEmail } from '@/lib/recurring-billing';
import { STATEMENT_NAME, authorizationText, longDate } from '@/lib/recurring-text';

export const dynamic = 'force-dynamic';

/** The customer saves or replaces their card from the link they were given. No login, no charge. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const token = typeof b.token === 'string' ? b.token.slice(0, 80) : '';
  const cardToken = typeof b.cardToken === 'string' ? b.cardToken : '';
  if (!token || !cardToken) return NextResponse.json({ error: 'Please enter your card details.' }, { status: 400 });
  if (b.agreed !== true) return NextResponse.json({ error: 'Check the box to authorize automatic billing.' }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { data: sub } = await supabase.from('subscriptions').select('*, customers(id, name, email, phone)').eq('card_token', token).maybeSingle();
  if (!sub || sub.status === 'cancelled') return NextResponse.json({ error: 'This link is no longer active. Please contact us.' }, { status: 404 });

  let card;
  try {
    const squareCustomerId = await ensureSquareCustomer(sub.customer_id, sub.customers?.name, sub.customers?.email, sub.customers?.phone);
    card = await storeCardOnFile(squareCustomerId, cardToken);
  } catch (e) {
    console.error('PAY_CARD_STORE', e);
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
      at: now, text: authorizationText(sub),
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

  return NextResponse.json({ saved: true, last4: card.last4 || '' });
}
