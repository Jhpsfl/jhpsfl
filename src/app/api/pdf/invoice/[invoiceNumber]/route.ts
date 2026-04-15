import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { generateInvoicePDF, getInvoiceFilename } from "@/lib/receipt-generator";
import type { InvoiceData } from "@/lib/receipt-generator";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> }
) {
  const { invoiceNumber } = await params;
  if (!invoiceNumber) return NextResponse.json({ error: "Missing invoice number" }, { status: 400 });

  const supabase = createSupabaseAdmin();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, customers(name, email, phone, company_name)")
    .eq("invoice_number", invoiceNumber)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const customer = (invoice as any).customers;

  const invoiceData: InvoiceData = {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: new Date(invoice.created_at),
    dueDate: invoice.due_date ? new Date(invoice.due_date) : undefined,
    invoiceStatus: invoice.status === "overdue" ? "OVERDUE" : "DUE",
    customerName: customer?.name || "Customer",
    customerEmail: customer?.email || "",
    customerPhone: customer?.phone || undefined,
    companyName: customer?.company_name || undefined,
    lineItems: (invoice.line_items || []).map((item: any) => ({
      name: item.description,
      quantity: item.quantity || 1,
      unitPrice: Math.round((item.unit_price || item.amount || 0) * 100),
      totalPrice: Math.round((item.amount || 0) * 100),
    })),
    subtotal: Math.round((invoice.subtotal || 0) * 100),
    taxAmount: Math.round((invoice.tax_amount || 0) * 100),
    surchargeAmount: Math.round((invoice.surcharge_amount || 0) * 100),
    totalAmount: Math.round((invoice.total || 0) * 100),
    notes: invoice.notes || undefined,
    paymentTerms: invoice.payment_terms || undefined,
    brandKey: invoice.brand || "jhps",
  };

  try {
    const pdfBuffer = await generateInvoicePDF(invoiceData);
    const filename = getInvoiceFilename(invoiceData);

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("INVOICE_PDF_ERROR:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
