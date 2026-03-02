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
    .select("invoice_number, due_date, line_items, subtotal, tax_rate, tax_amount, total, status, brand")
    .eq("invoice_number", invoiceNumber)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (data.status === "paid" || data.status === "cancelled") {
    return NextResponse.json({ error: "Invoice is no longer payable", status: data.status }, { status: 410 });
  }

  return NextResponse.json({ invoice: data });
}
