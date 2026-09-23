import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side invoice payment rules (hardening, 2026-09-23).
 *
 * The browser only ever says which invoice it is paying and how much it
 * wants to pay. The server decides whether that is allowed:
 *  - a paid or cancelled invoice cannot be paid again
 *  - a payment can never exceed the balance still owed
 *  - an invoice is only marked "paid" once amount_paid reaches the total;
 *    anything less is "partial" (deposits and installments stay correct)
 */

export type PayableInvoice = {
  id: string;
  invoice_number: string;
  total: number;
  amount_paid: number;
  status: string;
  customer_id: string | null;
  brand: string | null;
};

const cents = (n: number) => Math.round((Number(n) || 0) * 100);

export async function loadInvoice(supabase: SupabaseClient, invoiceNumber: string): Promise<PayableInvoice | null> {
  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, amount_paid, status, customer_id, brand')
    .eq('invoice_number', invoiceNumber)
    .limit(1)
    .maybeSingle();
  return (data as PayableInvoice) || null;
}

export function balanceCents(inv: PayableInvoice) {
  return Math.max(0, cents(inv.total) - cents(inv.amount_paid));
}

/** Returns an error message if this charge must not happen, else null. */
export function checkCharge(inv: PayableInvoice, amountCents: number): string | null {
  if (['paid', 'cancelled', 'void'].includes(inv.status)) return 'This invoice has already been paid or is no longer open.';
  const balance = balanceCents(inv);
  if (balance <= 0) return 'This invoice has no balance due.';
  if (amountCents > balance + 1) return `Payment is more than the balance due ($${(balance / 100).toFixed(2)}).`;
  if (amountCents < 50) return 'Payment amount is too small.';
  return null;
}

/**
 * Apply a completed payment to the invoice. Accumulates amount_paid and
 * only flips to "paid" when the total is covered.
 */
export async function settleInvoice(
  supabase: SupabaseClient,
  inv: PayableInvoice,
  paidCents: number,
  extra: Record<string, unknown> = {}
): Promise<{ fullyPaid: boolean; amountPaid: number }> {
  // Re-read to accumulate against the latest value.
  const fresh = (await loadInvoice(supabase, inv.invoice_number)) || inv;
  const newPaidCents = cents(fresh.amount_paid) + paidCents;
  const fullyPaid = newPaidCents >= cents(fresh.total) - 1;
  const update: Record<string, unknown> = {
    amount_paid: newPaidCents / 100,
    status: fullyPaid ? 'paid' : 'partial',
    ...extra,
  };
  if (fullyPaid) update.paid_date = new Date().toISOString().split('T')[0];
  await supabase.from('invoices').update(update).eq('id', fresh.id);
  return { fullyPaid, amountPaid: newPaidCents / 100 };
}
