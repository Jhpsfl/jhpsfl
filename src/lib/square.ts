import { SquareClient, SquareEnvironment, Currency } from 'square';
import { createSupabaseAdmin } from '@/lib/supabase';

export { Currency };

export const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN?.trim()!,
  environment: SquareEnvironment.Production,
});

export const locationId = process.env.SQUARE_LOCATION_ID?.trim()!;

/**
 * Get-or-create a Square Customer linked to a Supabase customer row.
 * Returns the Square customer ID.
 */
export async function ensureSquareCustomer(
  supabaseCustomerId: string,
  name?: string | null,
  email?: string | null,
  phone?: string | null,
): Promise<string> {
  const supabase = createSupabaseAdmin();

  // Check if we already have a Square customer ID
  const { data: customer } = await supabase
    .from('customers')
    .select('square_customer_id')
    .eq('id', supabaseCustomerId)
    .single();

  if (customer?.square_customer_id) {
    return customer.square_customer_id;
  }

  // Create a new Square Customer
  const result = await squareClient.customers.create({
    idempotencyKey: crypto.randomUUID(),
    givenName: name?.split(' ')[0] || undefined,
    familyName: name?.split(' ').slice(1).join(' ') || undefined,
    emailAddress: email || undefined,
    phoneNumber: phone || undefined,
    referenceId: supabaseCustomerId,
  });

  const squareCustomerId = result.customer?.id;
  if (!squareCustomerId) {
    throw new Error('Square customer creation returned no ID');
  }

  // Save to Supabase
  await supabase
    .from('customers')
    .update({ square_customer_id: squareCustomerId })
    .eq('id', supabaseCustomerId);

  return squareCustomerId;
}

/**
 * Store a card on file for a Square customer.
 * sourceId can be a card nonce/token from the Web Payments SDK.
 */
export async function storeCardOnFile(
  squareCustomerId: string,
  sourceId: string,
): Promise<{ cardId: string; brand: string | undefined; last4: string | undefined; expMonth: number | undefined; expYear: number | undefined }> {
  const result = await squareClient.cards.create({
    idempotencyKey: crypto.randomUUID(),
    sourceId,
    card: {
      customerId: squareCustomerId,
    },
  });

  const card = result.card;
  if (!card?.id) {
    throw new Error('Card creation returned no ID');
  }

  return {
    cardId: card.id,
    brand: card.cardBrand,
    last4: card.last4,
    expMonth: card.expMonth != null ? Number(card.expMonth) : undefined,
    expYear: card.expYear != null ? Number(card.expYear) : undefined,
  };
}

/**
 * Charge a stored card (card-on-file).
 */
export async function chargeStoredCard(
  squareCardId: string,
  amountCents: number,
  squareCustomerId: string,
  note?: string,
  buyerEmail?: string,
): Promise<{ paymentId: string; receiptUrl: string | null; status: string }> {
  const result = await squareClient.payments.create({
    sourceId: squareCardId,
    idempotencyKey: crypto.randomUUID(),
    amountMoney: { amount: BigInt(amountCents), currency: Currency.Usd },
    locationId,
    customerId: squareCustomerId,
    note: note?.slice(0, 500) || 'JHPS Recurring Payment',
    buyerEmailAddress: buyerEmail || undefined,
    autocomplete: true,
  });

  const payment = result.payment;
  if (!payment?.id) {
    throw new Error('Payment creation returned no ID');
  }

  return {
    paymentId: payment.id,
    receiptUrl: payment.receiptUrl || null,
    status: payment.status || 'UNKNOWN',
  };
}

/**
 * Disable (delete) a stored card on Square.
 */
export async function deleteStoredCard(squareCardId: string): Promise<void> {
  await squareClient.cards.disable({ cardId: squareCardId });
}

/**
 * Advance a billing date by the given frequency.
 */
export function advanceBillingDate(
  currentDate: string | Date,
  frequency: string,
): string {
  const d = new Date(currentDate);

  switch (frequency.toLowerCase()) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'biweekly':
    case 'bi-weekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
    case 'annual':
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      // Default to monthly
      d.setMonth(d.getMonth() + 1);
  }

  return d.toISOString().split('T')[0];
}
