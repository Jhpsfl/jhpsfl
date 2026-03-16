/**
 * Payment Processor Toggle
 * ─────────────────────────────────────────────────────────────
 * Controls which payment processor is active across the system.
 * 
 * Set NEXT_PUBLIC_PAYMENT_PROCESSOR env var to switch:
 *   - "stripe"  → Stripe (default) — cards, bank, Cash App, etc.
 *   - "square"  → Square (legacy) — cards only
 * 
 * Both processors share the same Supabase records, receipt
 * emails, and admin dashboard. Only the payment SDK and
 * server-side charge logic changes.
 * ─────────────────────────────────────────────────────────────
 */

export type PaymentProcessor = 'stripe' | 'square';

/** Active processor — reads from env at build time (client + server) */
export const PAYMENT_PROCESSOR: PaymentProcessor =
  (process.env.NEXT_PUBLIC_PAYMENT_PROCESSOR as PaymentProcessor) || 'stripe';

/** Check helpers */
export const isStripe = () => PAYMENT_PROCESSOR === 'stripe';
export const isSquare = () => PAYMENT_PROCESSOR === 'square';

/** Display name for trust badges / UI copy */
export const processorDisplayName = (): string =>
  PAYMENT_PROCESSOR === 'stripe' ? 'Stripe' : 'Square';
