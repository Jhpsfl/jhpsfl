export interface Customer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  customer_type?: 'residential' | 'commercial';
  company_name?: string | null;
}

export interface CustomerJob {
  id: string;
  service_type: string;
  description: string | null;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  amount: number | null;
  crew_notes: string | null;
  admin_notes: string | null;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

// ─── Payment Terms Types ───

export type PaymentTermsType = "full" | "deposit_balance" | "deposit_installments";

export interface PaymentScheduleItem {
  id: string;
  label: string;            // e.g. "Deposit", "Balance Due", "Installment 1 of 3"
  amount: number;
  due_date: string | null;  // ISO date string
  status: "pending" | "paid" | "overdue";
  paid_date: string | null;
  paid_amount: number;
  payment_method: string | null;  // "square", "cash", "check", "zelle", etc.
  notes: string | null;
}

export interface PaymentTerms {
  type: PaymentTermsType;
  deposit_amount: number;         // flat dollar amount for deposit
  deposit_percentage: number;     // OR percentage (whichever was used to calculate)
  deposit_method: "percentage" | "fixed";
  num_installments: number;       // only for deposit_installments (e.g. 2, 3, 4)
  installment_frequency: "weekly" | "biweekly" | "monthly";  // spacing between installments
  balance_due_on: "completion" | "date";  // for deposit_balance: when is the rest due?
  schedule: PaymentScheduleItem[];
}

export interface Invoice {
  id: string;
  customer_id: string | null;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled" | "partial";
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  line_items: InvoiceLineItem[];
  payment_link: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  customers?: { name: string | null; email: string | null; phone: string | null };

  // ─── New: Payment Terms ───
  payment_terms?: PaymentTerms | null;

  // ─── Verification settings (per-invoice overrides) ───
  verification_settings?: {
    allow_upload?: boolean;        // Allow file upload for residential (manager override)
    verification_mode?: 'id' | 'document';  // 'id' for residential, 'document' for commercial
    document_types?: string[];     // e.g. ['loa', 'business_license', 'coi', 'w9', 'purchase_order']
  } | null;
}
