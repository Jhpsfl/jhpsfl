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

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  id: string;
  customer_id: string | null;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
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
}
