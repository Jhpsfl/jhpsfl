import { NextResponse } from 'next/server';
import { getPaymentIntent, describePaymentMethod } from '@/lib/stripe';
import { createSupabaseAdmin } from '@/lib/supabase';
import { Resend } from 'resend';
import { generateReceiptPDF, getReceiptFilename, generateReceiptNumber } from '@/lib/receipt-generator';
import type { ReceiptData } from '@/lib/receipt-generator';
import { getBrand, type BrandKey } from '@/lib/brand-config';
import { logEmail } from '@/lib/email';

const getResend = () => new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const {
      paymentIntentId,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerZip,
      billingAddress,
      billingCity,
      billingZip,
      service,
      invoiceNumber,
      note,
      clerkUserId,
      companyName,
    } = await request.json();

    if (!paymentIntentId) {
      return NextResponse.json({ success: false, error: 'Missing paymentIntentId' }, { status: 400 });
    }

    // Retrieve the PaymentIntent from Stripe to verify it actually succeeded
    const pi = await getPaymentIntent(paymentIntentId);

    if (pi.status !== 'succeeded') {
      return NextResponse.json({
        success: false,
        error: `Payment not completed. Status: ${pi.status}`,
      }, { status: 400 });
    }

    const amount = pi.amount / 100;
    const amountInCents = pi.amount;
    const paymentMethodDesc = describePaymentMethod(pi);
    const stripeReceiptUrl = (pi.latest_charge as { receipt_url?: string } | null)?.receipt_url || null;
    const paymentNote = note || [service, invoiceNumber ? `INV#${invoiceNumber}` : ''].filter(Boolean).join(' - ') || 'Payment';

    const supabase = createSupabaseAdmin();

    // ─── Look up invoice record ───
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let invoiceRecord: any = null;
    let taxRate = 0;

    if (invoiceNumber) {
      const { data: inv } = await supabase.from('invoices')
        .select('*, customers(name, email, phone, company_name)')
        .eq('invoice_number', invoiceNumber)
        .limit(1)
        .single();
      if (inv) {
        invoiceRecord = inv;
        taxRate = inv.tax_rate || 0;
      }
    }

    // ─── Find or create customer ───
    let customerId: string | null = null;

    if (invoiceNumber) {
      const { data: inv } = await supabase.from('invoices').select('customer_id').eq('invoice_number', invoiceNumber).limit(1).single();
      if (inv?.customer_id) customerId = inv.customer_id;
    }
    if (!customerId && customerEmail) {
      const { data } = await supabase.from('customers').select('id').eq('email', customerEmail).limit(1).single();
      if (data) customerId = data.id;
    }
    if (!customerId && customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
      const { data } = await supabase.from('customers').select('id').ilike('phone', `%${cleanPhone}`).limit(1).single();
      if (data) customerId = data.id;
    }
    if (!customerId) {
      const { data } = await supabase.from('customers').insert({
        name: customerName || null,
        email: customerEmail || null,
        phone: customerPhone || null,
      }).select('id').single();
      if (data) customerId = data.id;
    }

    // ─── Enrich customer record ───
    if (customerId) {
      try {
        const { data: existing } = await supabase.from('customers')
          .select('name, email, phone, address, nickname, billing_address, billing_city, billing_zip')
          .eq('id', customerId).single();

        if (existing) {
          const enrichment: Record<string, string> = {};
          const currentName = existing.name || '';
          const isNickname = currentName.length > 0 && currentName.length <= 15 && !currentName.includes(' ');
          if (customerName && customerName.includes(' ') && isNickname) {
            enrichment.name = customerName;
            if (!existing.nickname) enrichment.nickname = currentName;
          } else if (!existing.name && customerName) {
            enrichment.name = customerName;
          }
          if (!existing.email && customerEmail) enrichment.email = customerEmail;
          if (!existing.phone && customerPhone) enrichment.phone = customerPhone;
          if (!existing.address && customerAddress) {
            enrichment.address = [customerAddress, customerCity, customerZip].filter(Boolean).join(', ');
          }
          if (!existing.billing_address && billingAddress) enrichment.billing_address = billingAddress;
          if (!existing.billing_city && billingCity) enrichment.billing_city = billingCity;
          if (!existing.billing_zip && billingZip) enrichment.billing_zip = billingZip;

          if (Object.keys(enrichment).length > 0) {
            await supabase.from('customers').update(enrichment).eq('id', customerId);
          }
        }
      } catch (enrichErr) {
        console.error('STRIPE_CUSTOMER_ENRICH_ERROR:', enrichErr);
      }
    }

    // ─── Record payment in Supabase ───
    if (customerId) {
      await supabase.from('payments').insert({
        customer_id: customerId,
        amount,
        status: 'completed',
        stripe_payment_id: paymentIntentId,
        square_payment_id: null,
        square_receipt_url: stripeReceiptUrl,
        payment_method: paymentMethodDesc.toLowerCase().includes('card') ? 'card' :
                         paymentMethodDesc.toLowerCase().includes('bank') ? 'bank' :
                         paymentMethodDesc.toLowerCase().includes('cash app') ? 'cashapp' :
                         paymentMethodDesc.toLowerCase().includes('amazon') ? 'amazon_pay' : 'other',
        notes: paymentNote,
        paid_at: new Date().toISOString(),
      });

      // ─── Mark invoice as paid + auto-create job ───
      if (invoiceNumber) {
        const { data: inv } = await supabase.from('invoices')
          .select('id, customer_id, quote_id, line_items, notes, total')
          .eq('invoice_number', invoiceNumber)
          .limit(1)
          .single();

        if (inv) {
          const invoiceUpdate: Record<string, unknown> = {
            status: 'paid',
            paid_date: new Date().toISOString().split('T')[0],
            amount_paid: amount,
            stripe_payment_id: paymentIntentId,
          };
          if (!inv.customer_id && customerId) {
            invoiceUpdate.customer_id = customerId;
          }
          await supabase.from('invoices').update(invoiceUpdate).eq('id', inv.id);

          // Auto-create job if none exists
          const effectiveCustomerId = inv.customer_id || customerId;
          if (effectiveCustomerId) {
            const { data: existingJob } = await supabase.from('jobs')
              .select('id').eq('invoice_id', inv.id).limit(1).maybeSingle();

            if (!existingJob) {
              const lineItems = (inv.line_items as Array<{ description?: string }>) || [];
              const allText = lineItems.map(li => li.description || '').join(' ').toLowerCase();
              let serviceType = 'general';
              if (allText.includes('lawn') || allText.includes('mow')) serviceType = 'lawn_care';
              else if (allText.includes('pressure') || allText.includes('wash')) serviceType = 'pressure_washing';
              else if (allText.includes('junk') || allText.includes('removal') || allText.includes('haul')) serviceType = 'junk_removal';
              else if (allText.includes('clear') || allText.includes('land')) serviceType = 'land_clearing';
              else if (allText.includes('clean')) serviceType = 'property_cleanup';
              else if (allText.includes('fence')) serviceType = 'fence';
              else if (allText.includes('tree') || allText.includes('trim')) serviceType = 'tree_service';

              const jobDesc = lineItems.map(li => li.description).filter(Boolean).join('; ') || inv.notes || service || '';
              await supabase.from('jobs').insert({
                customer_id: effectiveCustomerId,
                service_type: serviceType,
                description: (jobDesc as string).slice(0, 500),
                status: 'completed',
                completed_date: new Date().toISOString().split('T')[0],
                amount: inv.total || amount,
                invoice_id: inv.id,
                quote_id: inv.quote_id || null,
              });
            }
          }
        }
      }
    }

    // ─── Send receipt email with PDF ───
    if (customerEmail) {
      try {
        const brandKey: BrandKey = (invoiceRecord?.brand as BrandKey) || 'jhps';
        const brand = getBrand(brandKey);
        const resolvedCompanyName = companyName || invoiceRecord?.customers?.company_name || null;

        const lineItemsCents: ReceiptData['lineItems'] = invoiceRecord?.line_items?.length
          ? invoiceRecord.line_items.map((item: { description?: string; quantity?: number; unit_price?: number; amount?: number }) => {
              const unitCents = Math.round((item.unit_price || item.amount || 0) * 100);
              const qty = item.quantity || 1;
              return { name: item.description || 'Service', quantity: qty, unitPrice: unitCents, totalPrice: unitCents * qty };
            })
          : [{ name: service || `${brand.shortName} Service`, quantity: 1, unitPrice: amountInCents, totalPrice: amountInCents }];

        const taxCents = taxRate > 0 ? Math.round(lineItemsCents.reduce((s, i) => s + i.totalPrice, 0) * (taxRate / 100)) : 0;
        const subtotalCents = amountInCents - taxCents;

        const receiptNum = generateReceiptNumber();
        const receiptData: ReceiptData = {
          paymentId: paymentIntentId,
          receiptNumber: receiptNum,
          paymentDate: new Date(),
          customerName: customerName || 'Valued Customer',
          customerEmail,
          companyName: resolvedCompanyName || undefined,
          lineItems: lineItemsCents,
          subtotal: subtotalCents,
          taxAmount: taxCents,
          totalAmount: amountInCents,
          paymentStatus: 'COMPLETED',
          paymentMethod: paymentMethodDesc,
          orderId: paymentIntentId,
          brandKey,
        };

        const pdfBuffer = await generateReceiptPDF(receiptData);
        const pdfFilename = getReceiptFilename(receiptData);

        const receiptHtml = buildReceiptHtml({
          receiptNumber: receiptNum,
          customerName: customerName || 'Valued Customer',
          amount,
          service: service || `${brand.shortName} Service`,
          invoiceNumber: invoiceNumber || null,
          paymentId: paymentIntentId,
          receiptUrl: stripeReceiptUrl,
          date: new Date(),
          lineItems: invoiceRecord?.line_items || null,
          taxRate,
          brandKey,
          companyName: resolvedCompanyName,
          paymentMethodDesc,
        });

        const emailSubject = `Payment Confirmation — $${amount.toFixed(2)} — ${brand.name}`;
        await getResend().emails.send({
          from: `${brand.name} <info@jhpsfl.com>`,
          replyTo: brand.email,
          to: [customerEmail],
          subject: emailSubject,
          html: receiptHtml,
          attachments: [{ filename: pdfFilename, content: pdfBuffer.toString('base64') }],
        });

        await logEmail({
          direction: 'outbound',
          from_email: brand.email,
          to_email: customerEmail,
          subject: emailSubject,
          body_html: receiptHtml,
          body_text: `Payment receipt for $${amount.toFixed(2)} — ${receiptNum}`,
          folder: 'sent',
          has_attachments: true,
        });
      } catch (emailErr) {
        console.error('STRIPE_RECEIPT_EMAIL_ERROR:', emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      paymentId: paymentIntentId,
      receiptUrl: stripeReceiptUrl,
    });
  } catch (error) {
    console.error('STRIPE_CONFIRM_ERROR:', error);
    const msg = error instanceof Error ? error.message : 'Payment confirmation failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── Receipt Email HTML (same template as Square, works for both) ───
function buildReceiptHtml(params: {
  customerName: string;
  amount: number;
  service: string;
  invoiceNumber: string | null;
  paymentId: string | null;
  receiptNumber?: string;
  receiptUrl: string | null;
  date: Date;
  lineItems: Array<{ description: string; quantity: number; amount: number }> | null;
  taxRate: number;
  brandKey?: BrandKey;
  companyName?: string | null;
  paymentMethodDesc?: string;
}): string {
  const { customerName, amount, service, invoiceNumber, paymentId, receiptNumber, receiptUrl, date, lineItems, taxRate, brandKey, companyName: co, paymentMethodDesc } = params;
  const brand = getBrand(brandKey || 'jhps');

  const isNexa = brandKey === 'nexa';
  const gradientStart = isNexa ? '#005C50' : '#2E7D32';
  const gradientEnd = isNexa ? '#00A99D' : '#4CAF50';
  const accentColor = isNexa ? '#00897B' : '#2E7D32';
  const bgTint = isNexa ? '#f0faf9' : '#f8faf8';
  const borderTint = isNexa ? '#d0e8e5' : '#e0e8e0';
  const headerBgTint = isNexa ? '#e8f5f3' : '#f0f5f0';

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const formattedDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  let itemsHtml = '';
  if (lineItems?.length) {
    const rows = lineItems.map(item =>
      `<tr><td style="padding:8px 12px;color:#333;font-size:14px;border-bottom:1px solid #f0f0f0;">${item.description}</td><td style="padding:8px 12px;color:#333;font-size:14px;text-align:right;border-bottom:1px solid #f0f0f0;font-family:monospace;">${fmt(item.amount)}</td></tr>`
    ).join('');
    const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
    const taxAmt = taxRate > 0 ? subtotal * (taxRate / 100) : 0;
    itemsHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 20px;border:1px solid ${borderTint};border-radius:8px;overflow:hidden;">
        <tr style="background:${headerBgTint};"><th style="padding:10px 12px;text-align:left;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:0.5px;">Service</th><th style="padding:10px 12px;text-align:right;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:0.5px;">Amount</th></tr>
        ${rows}
        <tr><td style="padding:10px 12px;font-size:13px;color:#888;text-align:right;">Subtotal</td><td style="padding:10px 12px;font-size:14px;color:#333;text-align:right;font-family:monospace;">${fmt(subtotal)}</td></tr>
        ${taxRate > 0 ? `<tr><td style="padding:8px 12px;font-size:13px;color:#888;text-align:right;">Tax (${taxRate}%)</td><td style="padding:8px 12px;font-size:14px;color:#333;text-align:right;font-family:monospace;">${fmt(taxAmt)}</td></tr>` : ''}
        <tr style="background:${headerBgTint};"><td style="padding:12px;font-size:14px;color:${accentColor};font-weight:700;text-align:right;">Total Paid</td><td style="padding:12px;font-size:16px;color:${accentColor};font-weight:700;text-align:right;font-family:monospace;">${fmt(amount)}</td></tr>
      </table>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payment Confirmation</title></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,${gradientStart},${gradientEnd});padding:28px 32px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${brand.name}</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Payment Confirmation</p>
        </td></tr>
        <tr><td style="background:#fff;padding:32px;">
          ${co ? `<div style="margin:0 0 20px;padding:16px 20px;background:linear-gradient(135deg,${bgTint},#fff);border-left:4px solid ${accentColor};border-radius:0 8px 8px 0;">
            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">Prepared for</div>
            <div style="font-size:20px;font-weight:800;color:${accentColor};letter-spacing:0.3px;">${co}</div>
            <div style="font-size:13px;color:#666;margin-top:2px;">${customerName}</div>
          </div>` : `<p style="margin:0 0 20px;color:#333;font-size:15px;">Hi ${customerName},</p>`}
          <p style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.6;">Thank you for your payment! Here are the details:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${bgTint};border-radius:12px;border:1px solid ${borderTint};margin-bottom:20px;">
            <tr><td style="padding:20px 24px;border-bottom:1px solid ${borderTint};">
              <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Amount Paid</div>
              <div style="color:${accentColor};font-size:28px;font-weight:700;">${fmt(amount)}</div>
            </td></tr>
            ${paymentMethodDesc ? `<tr><td style="padding:16px 24px;border-bottom:1px solid ${borderTint};">
              <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Payment Method</div>
              <div style="color:#333;font-size:15px;font-weight:600;">${paymentMethodDesc}</div>
            </td></tr>` : ''}
            <tr><td style="padding:16px 24px;border-bottom:1px solid ${borderTint};">
              <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Service</div>
              <div style="color:#333;font-size:15px;font-weight:600;">${service}</div>
            </td></tr>
            ${invoiceNumber ? `<tr><td style="padding:16px 24px;border-bottom:1px solid ${borderTint};">
              <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Invoice</div>
              <div style="color:#333;font-size:15px;font-weight:600;">${invoiceNumber}</div>
            </td></tr>` : ''}
            <tr><td style="padding:16px 24px;${paymentId ? `border-bottom:1px solid ${borderTint};` : ''}">
              <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Date</div>
              <div style="color:#333;font-size:15px;">${formattedDate} at ${formattedTime}</div>
            </td></tr>
            ${receiptNumber ? `<tr><td style="padding:16px 24px;border-bottom:1px solid ${borderTint};">
              <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Receipt #</div>
              <div style="color:#333;font-size:15px;font-weight:700;font-family:monospace;">${receiptNumber}</div>
            </td></tr>` : ''}
            ${paymentId ? `<tr><td style="padding:12px 24px;">
              <div style="color:#aaa;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Transaction ID</div>
              <div style="color:#bbb;font-size:11px;font-family:monospace;">${paymentId}</div>
            </td></tr>` : ''}
          </table>
          ${itemsHtml}
          ${receiptUrl ? `<p style="margin:0 0 24px;text-align:center;"><a href="${receiptUrl}" target="_blank" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,${gradientStart},${gradientEnd});color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Full Receipt</a></p>` : ''}
          <p style="margin:0;color:#333;font-size:15px;line-height:1.6;">If you have any questions about this payment, please don't hesitate to contact us.</p>
          <p style="margin:16px 0 0;color:#333;font-size:15px;">Best regards,<br><strong style="color:${accentColor};">${brand.name}</strong></p>
        </td></tr>
        <tr><td style="background:#fafafa;padding:20px 32px;border-radius:0 0 12px 12px;border-top:1px solid #eee;">
          <p style="margin:0 0 4px;color:#888;font-size:12px;">
            &#128222; <a href="tel:${brand.phone.replace(/[^0-9]/g, '')}" style="color:${accentColor};text-decoration:none;">${brand.phone}</a>
            &nbsp;&middot;&nbsp;
            &#9993; <a href="mailto:${brand.email}" style="color:${accentColor};text-decoration:none;">${brand.email}</a>
          </p>
          <p style="margin:0;color:#aaa;font-size:11px;">${brand.serviceArea}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
