import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { generateEstimatePDF, getEstimateFilename } from "@/lib/receipt-generator";
import type { EstimateData } from "@/lib/receipt-generator";

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

  const estimateData: EstimateData = {
    quoteNumber: quote.quote_number,
    quoteDate: new Date(quote.created_at),
    expirationDate: quote.expiration_date ? new Date(quote.expiration_date) : undefined,
    quoteStatus: quote.status === "accepted" ? "ACCEPTED" : "PENDING",
    showFinancing: quote.show_financing || false,
    paymentTerms: quote.payment_terms || null,
    customerName: quote.customers?.name || "Customer",
    customerEmail: quote.customers?.email || "",
    customerPhone: quote.customers?.phone || undefined,
    lineItems: (quote.line_items || []).map((item: { description: string; quantity: number; unit_price: number; amount: number }) => ({
      name: item.description,
      quantity: item.quantity || 1,
      unitPrice: Math.round((item.unit_price || item.amount || 0) * 100),
      totalPrice: Math.round((item.amount || 0) * 100),
    })),
    subtotal: Math.round((quote.subtotal || 0) * 100),
    taxAmount: Math.round((quote.tax_amount || 0) * 100),
    totalAmount: Math.round((quote.total || 0) * 100),
    notes: quote.notes || undefined,
  };

  const pdfBuffer = await generateEstimatePDF(estimateData);
  const filename = getEstimateFilename(estimateData);

  return new NextResponse(Buffer.from(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
