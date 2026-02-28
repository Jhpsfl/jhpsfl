/**
 * Financing Agreement — Types & Text Generator
 * Generates legal agreement text from quote data and payment terms.
 */

// ─── Types ───

export interface AgreementData {
  id: string;
  quote_id: string;
  customer_id: string | null;
  token: string;
  status: "pending" | "viewed" | "signed" | "expired" | "voided";

  signer_name: string | null;
  signer_email: string | null;
  signer_phone: string | null;
  signer_address: string | null;

  agreement_text: string;
  payment_schedule: PaymentScheduleSnapshot[] | null;
  quote_snapshot: QuoteSnapshot | null;

  signature_url: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;

  id_front_url: string | null;
  id_back_url: string | null;
  id_type: string | null;

  signed_pdf_url: string | null;

  viewed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentScheduleSnapshot {
  label: string;
  amount: number;
  due_date: string | null;
}

export interface QuoteSnapshot {
  quote_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  line_items: { description: string; quantity: number; unit_price: number; amount: number }[];
  subtotal: number;
  tax_amount: number;
  total: number;
  payment_terms_type: string;
  deposit_amount: number;
  notes: string | null;
}

// ─── Agreement Text Builder ───

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export function generateAgreementText(snapshot: QuoteSnapshot, schedule: PaymentScheduleSnapshot[]): string {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const lineItemsSummary = snapshot.line_items
    .map(li => `  • ${li.description} (${li.quantity} × ${formatCurrency(li.unit_price)}) — ${formatCurrency(li.amount)}`)
    .join("\n");

  const scheduleSummary = schedule
    .map(s => `  • ${s.label}: ${formatCurrency(s.amount)}${s.due_date ? ` — due ${formatDateLong(s.due_date)}` : " — due upon signing"}`)
    .join("\n");

  const isInstallment = snapshot.payment_terms_type === "deposit_installments";
  const title = isInstallment ? "INSTALLMENT PAYMENT AGREEMENT" : "PAYMENT AGREEMENT";

  return `${title}

Jenkins Home & Property Solutions, LLC
Central Florida • (407) 686-9817 • Info@jhpsfl.com

Date: ${today}

═══════════════════════════════════════════════════════

This Payment Agreement ("Agreement") is entered into between Jenkins Home & Property Solutions, LLC ("Company") and the undersigned customer ("Customer").

1. SCOPE OF WORK

The Company agrees to perform the following services:

${lineItemsSummary}

  Subtotal: ${formatCurrency(snapshot.subtotal)}${snapshot.tax_amount > 0 ? `\n  Tax: ${formatCurrency(snapshot.tax_amount)}` : ""}
  TOTAL PROJECT COST: ${formatCurrency(snapshot.total)}

  Reference: Estimate ${snapshot.quote_number}

2. PAYMENT SCHEDULE

Customer agrees to make payments as follows:

${scheduleSummary}

  TOTAL: ${formatCurrency(snapshot.total)}

3. DEPOSIT

The deposit of ${formatCurrency(snapshot.deposit_amount)} is due upon execution of this Agreement. The deposit is NON-REFUNDABLE and will be applied toward the total project cost. Work will not commence until the deposit has been received and cleared.

4. PAYMENT TERMS

a) All payments are due on or before the scheduled due dates listed above.
b) Payments may be made via credit/debit card, cash, check, Zelle, or Venmo.
c) A late fee of Fifty Dollars ($50.00) will be assessed on any payment not received within seven (7) calendar days of its due date. In addition, interest of 1.5% per month (18% APR) will accrue on any unpaid balance beginning on the eighth (8th) day after the due date.
${isInstallment ? `d) If any installment payment is more than fourteen (14) calendar days past due, the entire remaining balance shall become immediately due and payable in full ("Acceleration Clause").
e) The Company reserves the right to suspend or halt work on the project if any payment is more than seven (7) days past due.` : `d) The Company reserves the right to suspend or halt work on the project if any payment is more than seven (7) days past due.`}

5. AUTHORIZATION TO PERFORM WORK

By signing this Agreement, Customer authorizes the Company to perform the services described in Section 1 at the specified property. Customer represents that they are authorized to approve work at the service location.

6. CHANGES TO SCOPE

Any changes to the scope of work described above must be agreed upon in writing by both parties. Additional work beyond the original scope may result in additional charges, which will be documented in a separate change order.

7. WARRANTY & LIABILITY

a) The Company warrants its workmanship for a period of thirty (30) days from completion.
b) This warranty does not cover damage caused by weather, neglect, misuse, or acts of God.
c) The Company's total liability under this Agreement shall not exceed the total project cost.
d) The Company is not liable for any pre-existing conditions or damage not caused by Company's work.

8. CANCELLATION

a) Customer may cancel this Agreement within three (3) business days of signing for a full refund of the deposit, minus any costs already incurred.
b) After three (3) business days, the deposit is non-refundable.
c) If Customer cancels after work has begun, Customer is responsible for payment for all work completed to date.

9. DISPUTE RESOLUTION

Any disputes arising from this Agreement shall first be addressed through good-faith negotiation. If unresolved, disputes shall be settled through binding arbitration in Volusia County, Florida, in accordance with the rules of the American Arbitration Association.

10. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of the State of Florida.

11. ENTIRE AGREEMENT

This Agreement constitutes the entire understanding between the parties and supersedes all prior negotiations, discussions, and agreements. This Agreement may not be modified except in writing signed by both parties.

12. IDENTIFICATION VERIFICATION

Customer agrees to provide a valid government-issued photo identification as part of this Agreement for verification purposes. The Company will securely store this identification and use it solely for the purpose of verifying the Customer's identity in connection with this Agreement.

═══════════════════════════════════════════════════════

BY SIGNING BELOW, CUSTOMER ACKNOWLEDGES THAT THEY HAVE READ, UNDERSTAND, AND AGREE TO ALL TERMS AND CONDITIONS OF THIS AGREEMENT.

Customer Signature: ___________________________

Printed Name: ___________________________

Date: ___________________________`;
}

// ─── B2 Storage Keys ───

export function buildAgreementKey(agreementId: string, filename: string): string {
  return `agreements/${agreementId}/${filename}`;
}
