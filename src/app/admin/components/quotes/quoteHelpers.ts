// Re-export shared helpers from invoice system
export { formatCurrency, formatDate, timeAgo, createLineItemId } from "../invoices/invoiceHelpers";
export { SERVICE_PRESETS } from "../invoices/invoiceHelpers";

// ─── Quote-specific helpers ───

export function generateQuoteNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `QTE-${y}${m}-${rand}`;
}

export function getDefaultExpirationDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

export const FINANCING_MESSAGE =
  "This project is eligible for flexible payment options including deposits and installment plans. Contact us to discuss a payment schedule that works for you.";
