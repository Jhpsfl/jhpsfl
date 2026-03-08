import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdmin } from '@/lib/supabase';
import { generateReceiptPDF, getReceiptFilename, generateReceiptNumber } from '@/lib/receipt-generator';
import type { ReceiptData } from '@/lib/receipt-generator';
import { auth } from '@clerk/nextjs/server';

const getResend = () => new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { customer_id, amount, service, notes } = body;

  if (!customer_id || !amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  // Auth check
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', userId)
    .single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch customer
  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, email, phone')
    .eq('id', customer_id)
    .single();
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  // Save payment to Supabase
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      customer_id,
      amount: parseFloat(parseFloat(amount).toFixed(2)),
      payment_method: 'cash',
      status: 'completed',
      notes: notes || service || 'Cash payment',
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (paymentError) {
    console.error('CASH_PAYMENT_INSERT_ERROR:', paymentError);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }

  // If no email, return success without sending receipt
  if (!customer.email) {
    return NextResponse.json({ success: true, payment_id: payment.id, receipt_sent: false });
  }

  // Build receipt PDF
  const amountCents = Math.round(parseFloat(amount) * 100);
  const receiptNum = generateReceiptNumber();
  const receiptData: ReceiptData = {
    paymentId: payment.id,
    receiptNumber: receiptNum,
    paymentDate: new Date(),
    customerName: customer.name || 'Valued Customer',
    customerEmail: customer.email,
    lineItems: [
      {
        name: service || 'JHPS Service',
        quantity: 1,
        unitPrice: amountCents,
        totalPrice: amountCents,
      },
    ],
    subtotal: amountCents,
    taxAmount: 0,
    totalAmount: amountCents,
    paymentStatus: 'COMPLETED',
    paymentMethod: 'Cash',
    notes: notes || undefined,
  };

  const pdfBuffer = await generateReceiptPDF(receiptData);
  const pdfFilename = getReceiptFilename(receiptData);
  const fmt = (n: number) => `$${(n / 100).toFixed(2)}`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Jenkins Home &amp; Property Solutions</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Cash Payment Receipt</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e0e0e0;border-top:none;">
        <h2 style="margin:0 0 16px;color:#2E7D32;font-size:20px;">Payment Received ✓</h2>
        <p style="margin:0 0 24px;font-size:15px;">Hi ${customer.name || 'there'},</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
          Thank you for your cash payment of <strong>${fmt(amountCents)}</strong>. Your receipt is attached to this email as a PDF.
        </p>
        <div style="background:#E8F5E9;border:1px solid #2E7D32;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:4px 0;font-size:14px;"><strong>Amount:</strong> ${fmt(amountCents)}</p>
          <p style="margin:4px 0;font-size:14px;"><strong>Receipt #:</strong> <span style="font-family:monospace;font-weight:bold;">${receiptNum}</span></p>
          <p style="margin:4px 0;font-size:14px;"><strong>Method:</strong> <span style="color:#2E7D32;font-weight:bold;">💵 Cash</span></p>
          ${service ? `<p style="margin:4px 0;font-size:14px;"><strong>Service:</strong> ${service}</p>` : ''}
          <p style="margin:4px 0;font-size:14px;"><strong>Status:</strong> <span style="color:#2E7D32;font-weight:bold;">PAID</span></p>
        </div>
        <p style="margin:0;font-size:15px;">If you have any questions, don't hesitate to reach out.</p>
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

  try {
    await getResend().emails.send({
      from: 'JHPS Florida <info@jhpsfl.com>',
      to: [customer.email],
      subject: `Cash Payment Receipt — ${fmt(amountCents)} — Jenkins Home & Property Solutions`,
      html,
      attachments: [{ filename: pdfFilename, content: pdfBuffer.toString('base64') }],
    });
  } catch (emailErr) {
    console.error('CASH_RECEIPT_EMAIL_ERROR:', emailErr);
    // Payment already saved — don't fail the whole request
    return NextResponse.json({ success: true, payment_id: payment.id, receipt_sent: false, email_error: true });
  }

  return NextResponse.json({ success: true, payment_id: payment.id, receipt_sent: true });
}
