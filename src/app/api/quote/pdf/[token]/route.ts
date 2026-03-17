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
    .select("*, customers(name, email, phone, address)")
    .eq("public_token", token)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  // Resolve terms
  let termsText: string[] | undefined;
  if (quote.terms_conditions && Array.isArray(quote.terms_conditions) && quote.terms_conditions.length > 0) {
    try {
      const { data: terms } = await supabase
        .from("quote_terms")
        .select("title, body")
        .in("id", quote.terms_conditions)
        .order("sort_order");
      if (terms?.length) {
        termsText = terms.map((t: any) => t.title + " — " + t.body);
      }
    } catch {}
  }

  const estimateData: EstimateData = {
    quoteNumber: quote.quote_number,
    quoteDate: new Date(quote.created_at),
    expirationDate: quote.expiration_date ? new Date(quote.expiration_date) : undefined,
    dueDate: quote.due_date ? new Date(quote.due_date) : undefined,
    quoteStatus: quote.status === "accepted" ? "ACCEPTED" : "PENDING",
    showFinancing: quote.show_financing || false,
    paymentTerms: quote.payment_terms || null,
    customerName: quote.customers?.name || "Customer",
    customerEmail: quote.customers?.email || "",
    customerPhone: quote.customers?.phone || undefined,
    customerAddress: quote.customers?.address || undefined,
    lineItems: (quote.line_items || []).map((item: any) => ({
      name: item.description,
      description: item.section || undefined,
      quantity: item.quantity || 1,
      unit: item.unit || undefined,
      unitPrice: Math.round((item.unit_price || item.amount || 0) * 100),
      totalPrice: Math.round((item.amount || 0) * 100),
    })),
    subtotal: Math.round((quote.subtotal || 0) * 100),
    taxAmount: Math.round((quote.tax_amount || 0) * 100),
    totalAmount: Math.round((quote.total || 0) * 100),
    notes: quote.notes || undefined,
    serviceAddress: quote.service_address || undefined,
    scopeSummary: quote.scope_summary || undefined,
    aiProjectNotes: quote.ai_project_notes || undefined,
    startDate: quote.start_date || undefined,
    completionDate: quote.completion_date || undefined,
    exclusions: quote.exclusions || undefined,
    warranty: quote.warranty || undefined,
    closingStatement: quote.closing_statement || undefined,
    termsText,
  };

  try {
    const pdfBuffer = await generateEstimatePDF(estimateData);
    const filename = getEstimateFilename(estimateData);

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("PDF_TOKEN_ERROR:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
