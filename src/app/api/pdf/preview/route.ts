import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { generateInvoicePDF, generateEstimatePDF } from '@/lib/receipt-generator';
import type { InvoiceData, EstimateData } from '@/lib/receipt-generator';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clerk_user_id, type, data } = body;

  if (!clerk_user_id || !type || !data) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Auth check
  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', clerk_user_id)
    .single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let pdfBuffer: Buffer;

  try {
    if (type === 'invoice') {
      const invoiceData: InvoiceData = {
        invoiceNumber: data.invoice_number || 'PREVIEW',
        invoiceDate: new Date(data.created_at || Date.now()),
        dueDate: data.due_date ? new Date(data.due_date) : undefined,
        invoiceStatus: data.status === 'overdue' ? 'OVERDUE' : 'DUE',
        customerName: data.customer_name || 'Customer',
        customerEmail: data.customer_email || '',
        customerPhone: data.customer_phone || undefined,
        companyName: data.company_name || undefined,
        lineItems: (data.line_items || []).map((item: { description: string; quantity: number; unit_price: number; amount: number }) => ({
          name: item.description,
          quantity: item.quantity || 1,
          unitPrice: Math.round((item.unit_price || item.amount || 0) * 100),
          totalPrice: Math.round((item.amount || 0) * 100),
        })),
        subtotal: Math.round((data.subtotal || 0) * 100),
        taxAmount: Math.round((data.tax_amount || 0) * 100),
        totalAmount: Math.round((data.total || 0) * 100),
        paymentLink: data.payment_link || undefined,
        notes: data.notes || undefined,
        paymentTerms: data.payment_terms || undefined,
        brandKey: data.brand || 'jhps',
      };
      pdfBuffer = await generateInvoicePDF(invoiceData);
    } else if (type === 'estimate') {
      const estimateData: EstimateData = {
        quoteNumber: data.quote_number || 'PREVIEW',
        quoteDate: new Date(data.created_at || Date.now()),
        expirationDate: data.expiration_date ? new Date(data.expiration_date) : undefined,
        dueDate: data.due_date ? new Date(data.due_date) : undefined,
        quoteStatus: data.status === 'accepted' ? 'ACCEPTED' : 'PENDING',
        showFinancing: data.show_financing || false,
        paymentTerms: data.payment_terms || null,
        customerName: data.customer_name || 'Customer',
        customerEmail: data.customer_email || '',
        customerPhone: data.customer_phone || undefined,
        companyName: data.company_name || undefined,
        lineItems: (data.line_items || []).map((item: { description: string; quantity: number; unit_price: number; amount: number }) => ({
          name: item.description,
          quantity: item.quantity || 1,
          unitPrice: Math.round((item.unit_price || item.amount || 0) * 100),
          totalPrice: Math.round((item.amount || 0) * 100),
        })),
        subtotal: Math.round((data.subtotal || 0) * 100),
        taxAmount: Math.round((data.tax_amount || 0) * 100),
        totalAmount: Math.round((data.total || 0) * 100),
        notes: data.notes || undefined,
      };
      pdfBuffer = await generateEstimatePDF(estimateData);
    } else {
      return NextResponse.json({ error: 'Invalid type. Use "invoice" or "estimate".' }, { status: 400 });
    }
  } catch (err) {
    console.error('PDF_PREVIEW_ERROR:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
