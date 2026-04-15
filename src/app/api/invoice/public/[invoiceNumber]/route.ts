import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> }
) {
  const { invoiceNumber } = await params;

  if (!invoiceNumber) {
    return NextResponse.json({ error: "Invoice number required" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number, due_date, line_items, subtotal, tax_rate, tax_amount, surcharge, surcharge_amount, total, status, brand, notes, payment_terms, created_at, customer_id, customers(company_name, name, email, phone)")
    .eq("invoice_number", invoiceNumber)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (data.status === "paid" || data.status === "cancelled") {
    return NextResponse.json({ error: "Invoice is no longer payable", status: data.status }, { status: 410 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customer = (data as any).customers;
  return NextResponse.json({ invoice: {
    invoice_number: data.invoice_number,
    due_date: data.due_date,
    line_items: data.line_items,
    subtotal: data.subtotal,
    tax_rate: data.tax_rate,
    tax_amount: data.tax_amount,
    surcharge: data.surcharge ?? false,
    surcharge_amount: data.surcharge_amount ?? 0,
    total: data.total,
    status: data.status,
    brand: data.brand,
    notes: data.notes || null,
    payment_terms: data.payment_terms || null,
    created_at: data.created_at,
    company_name: customer?.company_name || null,
    customer_name: customer?.name || null,
    customer_email: customer?.email || null,
    customer_phone: customer?.phone || null,
  }});
}
