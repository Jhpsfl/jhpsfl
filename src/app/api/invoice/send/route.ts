import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdmin } from '@/lib/supabase';
import { logEmail } from '@/lib/email';
import { generateInvoicePDF, getInvoiceFilename } from '@/lib/receipt-generator';
import type { InvoiceData } from '@/lib/receipt-generator';
import { randomUUID } from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clerk_user_id, invoice, customer, payment_link } = body;

  if (!clerk_user_id || !invoice || !customer?.email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', clerk_user_id)
    .single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // ─── Build InvoiceData for PDF generator ───
  const subtotalCents = Math.round((invoice.subtotal || 0) * 100);
  const taxCents = Math.round((invoice.tax_amount || 0) * 100);
  const totalCents = Math.round((invoice.total || 0) * 100);

  const invoiceData: InvoiceData = {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: new Date(invoice.created_at),
    dueDate: invoice.due_date ? new Date(invoice.due_date) : undefined,
    invoiceStatus: invoice.status === 'overdue' ? 'OVERDUE' : 'DUE',
    customerName: customer.name || 'Valued Customer',
    customerEmail: customer.email,
    customerPhone: customer.phone || undefined,
    lineItems: (invoice.line_items || []).map((item: { description: string; quantity: number; unit_price: number; amount: number }) => ({
      name: item.description,
      quantity: item.quantity || 1,
      unitPrice: Math.round((item.unit_price || item.amount || 0) * 100),
      totalPrice: Math.round((item.amount || 0) * 100),
    })),
    subtotal: subtotalCents,
    taxAmount: taxCents,
    totalAmount: totalCents,
    paymentLink: payment_link || undefined,
    notes: invoice.notes || undefined,
  };

  // ─── Generate PDF ───
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateInvoicePDF(invoiceData);
  } catch (err) {
    console.error('INVOICE_PDF_ERROR:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  const pdfFilename = getInvoiceFilename(invoiceData);
  const fmt = (n: number) => `$${(n / 100).toFixed(2)}`;

  const isOverdue = invoiceData.invoiceStatus === 'OVERDUE';
  const statusColor = isOverdue ? '#C62828' : '#1565C0';

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Jenkins Home &amp; Property Solutions</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Invoice ${invoiceData.invoiceNumber}</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e0e0e0;border-top:none;">
        <p style="margin:0 0 16px;font-size:15px;">Hi ${invoiceData.customerName},</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
          Please find your invoice for <strong>${fmt(totalCents)}</strong> attached to this email as a PDF.
        </p>
        <div style="background:${isOverdue ? '#FFEBEE' : '#FFF3E0'};border:1px solid ${statusColor};border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:4px 0;font-size:14px;"><strong>Invoice #:</strong> ${invoiceData.invoiceNumber}</p>
          <p style="margin:4px 0;font-size:14px;"><strong>Amount Due:</strong> ${fmt(totalCents)}</p>
          ${invoiceData.dueDate ? `<p style="margin:4px 0;font-size:14px;"><strong>Due Date:</strong> <span style="color:${statusColor};font-weight:bold;">${new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' }).format(invoiceData.dueDate)}</span></p>` : ''}
        </div>
        ${payment_link ? `
          <div style="text-align:center;margin:24px 0;">
            <a href="${payment_link}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#4CAF50,#2E7D32);color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;">Pay Now →</a>
          </div>
          <p style="text-align:center;font-size:12px;color:#999;margin-top:8px;">Or copy this link: ${payment_link}</p>
        ` : ''}
        <p style="margin:24px 0 0;font-size:15px;">If you have any questions, please don't hesitate to reach out.</p>
        <p style="margin:16px 0 0;font-size:15px;">
          Best regards,<br/>
          <strong style="color:#2E7D32;">Jenkins Home &amp; Property Solutions</strong>
        </p>
      </div>
      <div style="background:#fafafa;padding:20px 32px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0;border-top:none;">
        <p style="margin:0 0 4px;color:#888;font-size:12px;">
          📞 <a href="tel:4076869817" style="color:#2E7D32;text-decoration:none;">(407) 686-9817</a>
          &nbsp;·&nbsp;
          ✉️ <a href="mailto:info@jhpsfl.com" style="color:#2E7D32;text-decoration:none;">info@jhpsfl.com</a>
        </p>
        <p style="margin:0;color:#aaa;font-size:11px;">Serving Deltona, Orlando, Sanford, DeLand, Daytona Beach &amp; all of Central Florida</p>
      </div>
    </div>
  `;

  // ─── Send via Resend with PDF attached ───
  const thread_id = randomUUID();
  let resendMessageId: string | undefined;
  try {
    const { data, error } = await resend.emails.send({
      from: 'JHPS Florida <info@jhpsfl.com>',
      to: [customer.email],
      subject: `Invoice ${invoiceData.invoiceNumber} — ${fmt(totalCents)} Due — Jenkins Home & Property Solutions`,
      html,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer.toString('base64'),
        },
      ],
    });
    if (error) {
      console.error('RESEND_ERROR:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
    resendMessageId = data?.id;
  } catch (err) {
    console.error('EMAIL_SERVICE_ERROR:', err);
    return NextResponse.json({ error: 'Email service error' }, { status: 500 });
  }

  // ─── Log to Supabase ───
  await logEmail({
    thread_id,
    direction: 'outbound',
    from_email: 'info@jhpsfl.com',
    to_email: customer.email,
    subject: `Invoice ${invoiceData.invoiceNumber} — ${fmt(totalCents)} Due — Jenkins Home & Property Solutions`,
    body_html: html,
    resend_message_id: resendMessageId,
  });

  return NextResponse.json({ success: true, thread_id, resend_id: resendMessageId });
}
