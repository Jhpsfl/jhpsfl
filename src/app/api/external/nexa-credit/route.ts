import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { createSupabaseAdmin } from '@/lib/supabase';
import { verifyClientSignature } from '@/lib/nexa-hmac';
import { chargeStoredCard, deleteStoredCard, nexaLocationId } from '@/lib/square';
import { billingEmail, cardUrl, staffEmail } from '@/lib/recurring-billing';
import { CREDIT_SERVICE, STATEMENT_NAME, usd } from '@/lib/recurring-text';

/**
 * Prepaid AI credit for client apps running the Nexa AI module.
 *
 * A client app saves ONE card (the same /pay/card page as monthly billing) and
 * then charges it whenever its admins add credit. Each client signs with its
 * own key (app_secrets NEXA_CREDIT_KEY:<client>) and can only reach its own
 * wallet: the wallet id is built from the client name here, never sent by it.
 *
 * Headers: X-Nexa-Client, X-Nexa-Timestamp, X-Nexa-Signature (HMAC over the raw body).
 * POST { action: ensure | status | charge | remove_card, ... }
 *
 * The wallet is a subscriptions row with billing_mode 'manual' and no billing
 * date, so the daily billing run never touches it.
 */

const SELECT = '*, customers(id, name, email, phone, square_customer_id)';
const s = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const MIN = 10;
const MAX = 500;
const DAY_CAP = 1500; // most a wallet can charge in 24 hours, whatever the app asks
// Where the card page may send people back to. Add a client's admin host when it gets the module.
const RETURN_HOSTS = ['https://rounlimited.com/', 'https://www.rounlimited.com/', 'https://nexavisiongroup.com/'];

function view(sub: any, history: any[] = []) {
  return {
    status: sub.status,
    card: sub.square_card_id ? { brand: sub.card_brand, last4: sub.card_last4, saved_at: sub.card_authorized_at } : null,
    card_url: cardUrl(sub),
    limits: { min: MIN, max: MAX, day_cap: DAY_CAP },
    history: history.map((h) => ({ at: h.created_at, amount: Number(h.amount), status: h.status })),
  };
}

function definite(err: unknown) {
  const e = err as { statusCode?: number; errors?: { code?: string }[]; message?: string };
  const status = Number(e?.statusCode);
  const codes = (e?.errors || []).map((x) => x.code).filter(Boolean).join(', ');
  // A 4xx means Square refused it. Anything else means we can't know whether money moved.
  return { refused: status >= 400 && status < 500 && status !== 408 && status !== 429, message: (codes || e?.message || 'Unknown error').slice(0, 300) };
}

export async function POST(req: Request) {
  const raw = await req.text();
  const client = (req.headers.get('x-nexa-client') || '').toLowerCase();
  if (!(await verifyClientSignature(client, raw, req.headers.get('x-nexa-timestamp'), req.headers.get('x-nexa-signature')))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let b: any;
  try { b = JSON.parse(raw); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  const walletId = `aic-${client}`;
  const supabase = createSupabaseAdmin();
  const load = async () => (await supabase.from('subscriptions').select(SELECT).eq('external_order_id', walletId).maybeSingle()).data;
  const recent = async (subId: string) =>
    (await supabase.from('billing_log').select('created_at, amount, status').eq('subscription_id', subId).order('created_at', { ascending: false }).limit(20)).data || [];

  try {
    if (b.action === 'ensure') {
      const found = await load();
      const returnUrl = s(b.return_url, 300);
      const okReturn = RETURN_HOSTS.some((h) => returnUrl.startsWith(h)) ? returnUrl : null;
      if (found && found.status !== 'cancelled') {
        if (okReturn && found.return_url !== okReturn) await supabase.from('subscriptions').update({ return_url: okReturn }).eq('id', found.id);
        return NextResponse.json(view(found, await recent(found.id)));
      }
      const name = s(b.customer?.name, 120);
      const email = s(b.customer?.email, 160).toLowerCase();
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'customer name and email are required' }, { status: 400 });
      let customerId: string;
      const { data: cust } = await supabase.from('customers').select('id').eq('email', email).limit(1).maybeSingle();
      if (cust) customerId = cust.id;
      else {
        const { data: created, error } = await supabase.from('customers').insert({ brand: 'nexa', name, email, company_name: s(b.customer?.company, 160) || null }).select('id').single();
        if (error) throw new Error(error.message);
        customerId = created.id;
      }
      const fresh = {
        customer_id: customerId, brand: 'nexa', card_token: randomBytes(24).toString('base64url'),
        plan_name: `AI credit for ${s(b.customer?.company, 120) || name}`, service_type: CREDIT_SERVICE, frequency: 'monthly', amount: 0,
        status: 'awaiting_card', billing_mode: 'manual', next_billing_date: null, reference: walletId, return_url: okReturn,
        square_card_id: null, card_brand: null, card_last4: null, cancelled_at: null,
      };
      if (found) {
        // A wallet whose card was removed: start it again with a fresh card link.
        await supabase.from('subscriptions').update(fresh).eq('id', found.id);
      } else {
        const { error } = await supabase.from('subscriptions').insert({ ...fresh, external_order_id: walletId });
        if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
      }
      const now = await load();
      return NextResponse.json(view(now, await recent(now.id)), { status: 201 });
    }

    const sub = await load();
    if (!sub || sub.status === 'cancelled') return NextResponse.json({ error: 'No card is set up yet.', no_wallet: true }, { status: 404 });

    if (b.action === 'status') return NextResponse.json(view(sub, await recent(sub.id)));

    if (b.action === 'remove_card') {
      if (sub.square_card_id) {
        await deleteStoredCard(sub.square_card_id).catch((e) => console.error('CREDIT_CARD_DISABLE', e));
        await supabase.from('stored_cards').delete().eq('square_card_id', sub.square_card_id);
      }
      await supabase.from('subscriptions').update({ status: 'cancelled', square_card_id: null, card_brand: null, card_last4: null, cancelled_at: new Date().toISOString() }).eq('id', sub.id);
      await billingEmail(sub, sub.customers?.email, 'Your card was removed', `<p>The card saved for AI credit was removed. It won't be charged again.</p>`);
      return NextResponse.json({ removed: true });
    }

    if (b.action === 'charge') {
      const cents = Math.round(Number(b.amount) * 100);
      const chargeId = s(b.charge_id, 80);
      if (!/^[A-Za-z0-9:_-]{8,80}$/.test(chargeId)) return NextResponse.json({ error: 'charge_id required' }, { status: 400 });
      if (!(cents >= MIN * 100 && cents <= MAX * 100)) return NextResponse.json({ error: `Add between ${usd(MIN)} and ${usd(MAX)} at a time.` }, { status: 400 });
      if (!sub.square_card_id) return NextResponse.json({ error: 'There is no card on file yet.', no_card: true }, { status: 409 });
      if (sub.status === 'on_hold') return NextResponse.json({ error: 'An earlier charge is being checked. Adding credit is paused until that is settled.', on_hold: true }, { status: 409 });

      const key = `credit:${sub.id}:${chargeId}`;
      const amount = cents / 100;
      // Same charge_id sent again (a retry): answer with what happened the first time. Never charge twice.
      const { data: earlier } = await supabase.from('billing_log').select('status, square_payment_id, amount').eq('charge_key', key).maybeSingle();
      if (earlier) {
        if (earlier.status === 'success') return NextResponse.json({ paid: true, repeat: true, amount: Number(earlier.amount), payment_id: earlier.square_payment_id });
        if (earlier.status === 'failed') return NextResponse.json({ error: 'That card was declined. Nothing was charged.', declined: true }, { status: 402 });
        return NextResponse.json({ error: 'That charge is still being checked. Nothing more was charged.', unknown: true }, { status: 409 });
      }
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: day } = await supabase.from('billing_log').select('amount, status').eq('subscription_id', sub.id).gte('created_at', since).in('status', ['success', 'pending']);
      const spent = (day || []).reduce((t, r) => t + Number(r.amount || 0), 0);
      if (spent + amount > DAY_CAP) return NextResponse.json({ error: `That is over the ${usd(DAY_CAP)} a day limit for adding credit. Try a smaller amount or wait until tomorrow.`, capped: true }, { status: 409 });

      const { data: claim, error: claimErr } = await supabase.from('billing_log')
        .insert({ subscription_id: sub.id, customer_id: sub.customer_id, amount, status: 'pending', charge_key: key }).select('id').single();
      if (claimErr) return NextResponse.json({ error: 'That charge is already running. Nothing more was charged.', unknown: true }, { status: 409 });

      const note = `NexaVision Group: ${sub.plan_name} (${b.auto === true ? 'automatic top-up' : 'top-up'})`;
      let pay;
      try {
        pay = await chargeStoredCard(sub.square_card_id, cents, sub.customers?.square_customer_id || '', note, undefined, createHash('sha256').update(key).digest('hex').slice(0, 45), nexaLocationId);
      } catch (err) {
        const d = definite(err);
        if (!d.refused) {
          await supabase.from('subscriptions').update({ status: 'on_hold', last_error: `Square didn't confirm a ${usd(amount)} credit top-up: ${d.message}`.slice(0, 300) }).eq('id', sub.id);
          await billingEmail(sub, staffEmail(sub), `Check an AI credit charge: ${sub.customers?.name || sub.plan_name}`,
            `<p>Square didn't confirm a ${usd(amount)} AI credit top-up for <b>${sub.customers?.name || sub.plan_name}</b>, so no credit was added and top-ups are paused.</p><p>Look in Square for the payment. If it went through, add the credit by hand; then set this wallet's status back to "ready" (subscriptions, reference ${walletId}).</p><p>Reason: ${d.message}</p>`);
          return NextResponse.json({ error: "We couldn't confirm that charge, so no credit was added. We are checking it.", unknown: true }, { status: 502 });
        }
        await supabase.from('billing_log').update({ status: 'failed', error_message: d.message }).eq('id', claim.id);
        return NextResponse.json({ error: 'That card was declined. Nothing was charged.', declined: true }, { status: 402 });
      }

      // The money has moved. From here a problem must never cause another charge.
      await supabase.from('billing_log').update({ status: 'success', square_payment_id: pay.paymentId }).eq('id', claim.id);
      await supabase.from('payments').insert({
        brand: 'nexa', customer_id: sub.customer_id, subscription_id: sub.id, amount, status: 'completed',
        square_payment_id: pay.paymentId, square_receipt_url: pay.receiptUrl, payment_method: 'card', notes: note, paid_at: new Date().toISOString(),
      });
      await supabase.from('subscriptions').update({ charge_count: (sub.charge_count || 0) + 1 }).eq('id', sub.id);
      const by = s(b.by, 160);
      await billingEmail(sub, sub.customers?.email, `Receipt: ${usd(amount)} AI credit`,
        `<p>${usd(amount)} of AI credit was added${b.auto === true ? ' automatically (automatic top-up is on)' : by ? ` by ${by}` : ''}.</p><p>Charged to the card ending in ${sub.card_last4 || ''}. It appears on the statement as ${STATEMENT_NAME}.</p>${pay.receiptUrl ? `<p><a href="${pay.receiptUrl}">View the card receipt</a></p>` : ''}`).catch((e) => console.error('CREDIT_RECEIPT', e));
      await billingEmail(sub, staffEmail(sub), `AI credit: ${usd(amount)} from ${sub.customers?.name || sub.plan_name}`,
        `<p><b>${sub.customers?.name || sub.plan_name}</b> added ${usd(amount)} of AI credit${b.auto === true ? ' (automatic top-up)' : ''}.</p>`).catch((e) => console.error('CREDIT_STAFF', e));
      return NextResponse.json({ paid: true, amount, payment_id: pay.paymentId, receipt_url: pay.receiptUrl });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    console.error('NEXA_CREDIT', e);
    return NextResponse.json({ error: 'That could not be done. Try again.' }, { status: 500 });
  }
}
