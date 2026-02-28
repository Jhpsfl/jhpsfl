export interface Customer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
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

export interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired" | "converted";

export interface Quote {
  id: string;
  customer_id: string | null;
  quote_number: string;
  status: QuoteStatus;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  expiration_date: string | null;
  notes: string | null;
  line_items: QuoteLineItem[];
  show_financing: boolean;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  converted_invoice_id: string | null;
  created_at: string;
  updated_at: string;
  customers?: { name: string | null; email: string | null; phone: string | null };
}
