/**
 * Stripe Server-Side Client
 * ─────────────────────────────────────────────────────────────
 * Mirrors src/lib/square.ts — provides payment, customer,
 * and card-on-file operations via Stripe.
 * ─────────────────────────────────────────────────────────────
 */

import Stripe from 'stripe';
import { createSupabaseAdmin } from '@/lib/supabase';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Create a PaymentIntent for the Stripe Payment Element.
 * Returns clientSecret for the frontend to confirm payment.
 */
export async function createPaymentIntent(opts: {
  amountCents: number;
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  metadata?: Record<string, string>;
  description?: string;
  stripeCustomerId?: string;
  setupFutureUsage?: boolean;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const params: Stripe.PaymentIntentCreateParams = {
    amount: opts.amountCents,
    currency: opts.currency || 'usd',
    // Enable all the payment methods you want:
    // Cards, US bank (ACH), Cash App, Amazon Pay, Link
    automatic_payment_methods: { enabled: true },
    description: opts.description || 'JHPS Payment',
    metadata: opts.metadata || {},
    receipt_email: opts.customerEmail || undefined,
  };

  if (opts.stripeCustomerId) {
    params.customer = opts.stripeCustomerId;
  }

  if (opts.setupFutureUsage) {
    params.setup_future_usage = 'off_session';
  }

  const intent = await stripe.paymentIntents.create(params);

  if (!intent.client_secret) {
    throw new Error('Stripe PaymentIntent created without client_secret');
  }

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  };
}

/**
 * Retrieve a PaymentIntent (to get final status, payment method details, etc.)
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['payment_method', 'latest_charge'],
  });
}

/**
 * Get-or-create a Stripe Customer linked to a Supabase customer row.
 * Returns the Stripe customer ID.
 */
export async function ensureStripeCustomer(
  supabaseCustomerId: string,
  name?: string | null,
  email?: string | null,
  phone?: string | null,
): Promise<string> {
  const supabase = createSupabaseAdmin();

  // Check if we already have a Stripe customer ID
  const { data: customer } = await supabase
    .from('customers')
    .select('stripe_customer_id')
    .eq('id', supabaseCustomerId)
    .single();

  if (customer?.stripe_customer_id) {
    return customer.stripe_customer_id;
  }

  // Create a new Stripe Customer
  const stripeCustomer = await stripe.customers.create({
    name: name || undefined,
    email: email || undefined,
    phone: phone || undefined,
    metadata: { supabase_customer_id: supabaseCustomerId },
  });

  // Save to Supabase
  await supabase
    .from('customers')
    .update({ stripe_customer_id: stripeCustomer.id })
    .eq('id', supabaseCustomerId);

  return stripeCustomer.id;
}

/**
 * Charge a stored payment method (card-on-file / saved bank).
 */
export async function chargeStoredPaymentMethod(
  stripePaymentMethodId: string,
  amountCents: number,
  stripeCustomerId: string,
  note?: string,
  buyerEmail?: string,
): Promise<{ paymentId: string; receiptUrl: string | null; status: string }> {
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: stripeCustomerId,
    payment_method: stripePaymentMethodId,
    off_session: true,
    confirm: true,
    description: note?.slice(0, 500) || 'JHPS Recurring Payment',
    receipt_email: buyerEmail || undefined,
  });

  return {
    paymentId: intent.id,
    receiptUrl: (intent.latest_charge as Stripe.Charge)?.receipt_url || null,
    status: intent.status === 'succeeded' ? 'COMPLETED' : intent.status.toUpperCase(),
  };
}

/**
 * List payment methods (cards, bank accounts) for a Stripe customer.
 */
export async function listPaymentMethods(
  stripeCustomerId: string,
): Promise<Stripe.PaymentMethod[]> {
  const methods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
  });
  return methods.data;
}

/**
 * Detach (remove) a payment method from a customer.
 */
export async function detachPaymentMethod(paymentMethodId: string): Promise<void> {
  await stripe.paymentMethods.detach(paymentMethodId);
}

/**
 * Get human-readable payment method description from a PaymentIntent.
 */
export function describePaymentMethod(pi: Stripe.PaymentIntent): string {
  const pm = pi.payment_method as Stripe.PaymentMethod | null;
  if (!pm) return 'Unknown';

  switch (pm.type) {
    case 'card': {
      const card = pm.card;
      if (!card) return 'Card';
      const brand = (card.brand || 'Card').charAt(0).toUpperCase() + (card.brand || 'card').slice(1);
      return `${brand} ending in ${card.last4 || '????'}`;
    }
    case 'us_bank_account': {
      const bank = pm.us_bank_account;
      if (!bank) return 'Bank Account';
      return `${bank.bank_name || 'Bank'} ••${bank.last4 || '??'}`;
    }
    case 'cashapp':
      return 'Cash App Pay';
    case 'amazon_pay':
      return 'Amazon Pay';
    case 'link':
      return 'Link';
    default:
      return pm.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
