import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = createSupabaseAdmin();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*, customers(name, email, phone)")
    .eq("public_token", token)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  // Check expiration
  if (quote.expiration_date && new Date(quote.expiration_date) < new Date()) {
    if (["draft", "sent"].includes(quote.status)) {
      await supabase.from("quotes").update({ status: "expired" }).eq("id", quote.id);
      quote.status = "expired";
    }
  }

  // Return public-safe data
  return NextResponse.json({
    quote: {
      id: quote.id,
      quote_number: quote.quote_number,
      status: quote.status,
      subtotal: quote.subtotal,
      tax_rate: quote.tax_rate,
      tax_amount: quote.tax_amount,
      total: quote.total,
      expiration_date: quote.expiration_date,
      notes: quote.notes,
      line_items: quote.line_items,
      show_financing: quote.show_financing,
      payment_terms: quote.payment_terms,
      created_at: quote.created_at,
      customer_name: quote.customers?.name || "Customer",
      customer_email: quote.customers?.email || "",
      customer_phone: quote.customers?.phone || "",
    },
  });
}
