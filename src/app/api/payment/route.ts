import { Currency, type OrderLineItem } from 'square';
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { squareClient, locationId as sqLocationId, ensureSquareCustomer, storeCardOnFile } from '@/lib/square';
import { Resend } from 'resend';
import { generateReceiptPDF, getReceiptFilename, generateReceiptNumber } from '@/lib/receipt-generator';
import type { ReceiptData } from '@/lib/receipt-generator';

const getResend = () => new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { token, amount, customerName, customerEmail, customerPhone, service, invoiceNumber, note, saveCard, clerkUserId } =
      await request.json();

    if (!token || !amount) {
      return NextResponse.json({ success: false, error: 'Missing token or amount' }, { status: 400 });
    }

    const amountInCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid payment amount' }, { status: 400 });
    }

    const locationId = sqLocationId;
    const supabase = createSupabaseAdmin();
    const paymentNote =
      note || [service, invoiceNumber ? 'INV#' + invoiceNumber : ''].filter(Boolean).join(' - ') || 'JHPS Payment';

    // ─── 1. Build Square Order line items ───
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let invoiceRecord: any = null;
    let orderLineItems: OrderLineItem[] = [];
    let useAdditionalTax = false;
    let taxRate = 0;

    if (invoiceNumber) {
      const { data: inv } = await supabase.from('invoices')
        .select('*, customers(name, email, phone)')
        .eq('invoice_number', invoiceNumber)
        .limit(1)
        .single();

      if (inv) {
        invoiceRecord = inv;
        taxRate = inv.tax_rate || 0;
        useAdditionalTax = taxRate > 0;

        if (inv.line_items?.length) {
          // Invoice line items are pre-tax amounts — use ADDITIVE tax
          orderLineItems = inv.line_items.map((item: { description?: string; quantity?: number; unit_price?: number; amount?: number }) => ({
            name: item.description || 'Service',
            quantity: String(item.quantity || 1),
            basePriceMoney: {
              amount: BigInt(Math.round((item.unit_price || item.amount || 0) * 100)),
              currency: Currency.Usd,
            },
          }));
        }
      }
    }

    // Fallback: single line item for the full amount
    if (orderLineItems.length === 0) {
      const isCommercial = (service || '').toLowerCase().includes('commercial');
      if (isCommercial) {
        // Amount entered includes tax — use INCLUSIVE so total stays the same
        taxRate = 6.5;
        orderLineItems = [{
          name: service || 'Commercial Service',
          quantity: '1',
          basePriceMoney: { amount: BigInt(amountInCents), currency: Currency.Usd },
        }];
        useAdditionalTax = false; // INCLUSIVE, not additive
      } else {
        orderLineItems = [{
          name: service || 'JHPS Service',
          quantity: '1',
          basePriceMoney: { amount: BigInt(amountInCents), currency: Currency.Usd },
        }];
      }
    }

    // ─── 2. Create Square Order ───
    let orderId: string | undefined;
    try {
      // Build tax array
      const taxes = taxRate > 0 ? [{
        uid: 'fl_sales_tax',
        name: `FL Sales Tax (${taxRate}%)`,
        percentage: String(taxRate),
        // Invoice line items are pre-tax → ADDITIVE tax adds on top
        // Non-invoice commercial → INCLUSIVE (total stays what customer entered)
        type: useAdditionalTax ? 'ADDITIVE' as const : 'INCLUSIVE' as const,
        scope: 'ORDER' as const,
      }] : undefined;

      const orderResult = await squareClient.orders.create({
        idempotencyKey: crypto.randomUUID(),
        order: {
          locationId: locationId!,
          referenceId: invoiceNumber || undefined,
          lineItems: orderLineItems,
          ...(taxes && { taxes }),
          metadata: {
            ...(invoiceNumber && { invoiceNumber }),
            ...(service && { service: service.slice(0, 255) }),
            source: 'jhpsfl_website',
          },
        },
      });
      orderId = orderResult.order?.id;
    } catch (orderErr) {
      // Order creation failed — proceed with payment-only (no order linkage)
      console.error('SQUARE_ORDER_ERROR:', orderErr);
    }

    // ─── 3. Create Square Payment (linked to Order if available) ───
    const result = await squareClient.payments.create({
      sourceId: token,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: { amount: BigInt(amountInCents), currency: Currency.Usd },
      ...(orderId && { orderId }),
      locationId,
      note: paymentNote.slice(0, 500),
      buyerEmailAddress: customerEmail || undefined,
    });

    // ─── 4. Record in Supabase + send receipt email ───
    if (result.payment?.status === 'COMPLETED') {
      try {
        const receiptUrl = result.payment.receiptUrl || null;

        // Find or create customer
        let customerId: string | null = null;
        if (customerEmail) {
          const { data } = await supabase.from('customers').select('id').eq('email', customerEmail).limit(1).single();
          if (data) customerId = data.id;
        }
        if (!customerId && customerPhone) {
          const { data } = await supabase.from('customers').select('id').eq('phone', customerPhone).limit(1).single();
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

        if (customerId) {
          await supabase.from('payments').insert({
            customer_id: customerId,
            amount: parseFloat(amount),
            status: 'completed',
            square_payment_id: result.payment.id || null,
            square_receipt_url: receiptUrl,
            payment_method: 'card',
            notes: paymentNote,
            paid_at: new Date().toISOString(),
          });

          // ─── Save card on file if requested ───
          if (saveCard && clerkUserId && customerId && result.payment?.id) {
            try {
              // Look up customer details for Square
              const { data: custData } = await supabase.from('customers').select('name, email, phone').eq('id', customerId).single();
              const sqCustId = await ensureSquareCustomer(customerId, custData?.name, custData?.email, custData?.phone);
              const cardInfo = await storeCardOnFile(sqCustId, result.payment.id);

              // Check if this is the first card (make it default)
              const { count } = await supabase.from('stored_cards').select('id', { count: 'exact', head: true }).eq('customer_id', customerId);
              await supabase.from('stored_cards').insert({
                customer_id: customerId,
                square_card_id: cardInfo.cardId,
                brand: cardInfo.brand || null,
                last4: cardInfo.last4 || null,
                exp_month: cardInfo.expMonth || null,
                exp_year: cardInfo.expYear || null,
                is_default: (count || 0) === 0,
              });
            } catch (cardErr) {
              // Card save failure should NOT affect the successful payment
              console.error('CARD_SAVE_ERROR:', cardErr);
            }
          }

          // Mark invoice as paid + link customer if invoice had none
          if (invoiceNumber) {
            const { data: inv } = await supabase.from('invoices')
              .select('id, customer_id')
              .eq('invoice_number', invoiceNumber)
              .limit(1)
              .single();
            if (inv) {
              const invoiceUpdate: Record<string, unknown> = {
                status: 'paid',
                paid_date: new Date().toISOString().split('T')[0],
                amount_paid: parseFloat(amount),
              };
              // If invoice had no customer, link the newly-created one
              if (!inv.customer_id && customerId) {
                invoiceUpdate.customer_id = customerId;
              }
              await supabase.from('invoices').update(invoiceUpdate).eq('id', inv.id);
            }
          }
        }

        // ─── 5. Send receipt email with PDF attachment ───
        if (customerEmail) {
          try {
            const paymentAmountCents = Math.round(parseFloat(amount) * 100);
            const lineItemsCents: ReceiptData['lineItems'] = invoiceRecord?.line_items?.length
              ? invoiceRecord.line_items.map((item: { description?: string; quantity?: number; unit_price?: number; amount?: number }) => {
                  const unitCents = Math.round((item.unit_price || item.amount || 0) * 100);
                  const qty = item.quantity || 1;
                  return {
                    name: item.description || 'Service',
                    quantity: qty,
                    unitPrice: unitCents,
                    totalPrice: unitCents * qty,
                  };
                })
              : [{ name: service || 'JHPS Service', quantity: 1, unitPrice: paymentAmountCents, totalPrice: paymentAmountCents }];

            const taxCents = taxRate > 0 ? Math.round(lineItemsCents.reduce((s, i) => s + i.totalPrice, 0) * (taxRate / 100)) : 0;
            const subtotalCents = paymentAmountCents - taxCents;

            const receiptNum = generateReceiptNumber();
            const receiptData: ReceiptData = {
              paymentId: result.payment.id || 'N/A',
              receiptNumber: receiptNum,
              paymentDate: new Date(),
              customerName: customerName || 'Valued Customer',
              customerEmail,
              lineItems: lineItemsCents,
              subtotal: subtotalCents,
              taxAmount: taxCents,
              totalAmount: paymentAmountCents,
              paymentStatus: 'COMPLETED',
              paymentMethod: result.payment.cardDetails
                ? `${result.payment.cardDetails.card?.cardBrand || 'Card'} ending in ${result.payment.cardDetails.card?.last4 || '????'}`
                : undefined,
              orderId: orderId || undefined,
            };

            const pdfBuffer = await generateReceiptPDF(receiptData);
            const pdfFilename = getReceiptFilename(receiptData);

            const receiptHtml = buildReceiptHtml({ receiptNumber: receiptNum,
              customerName: customerName || 'Valued Customer',
              amount: parseFloat(amount),
              service: service || 'JHPS Service',
              invoiceNumber: invoiceNumber || null,
              paymentId: result.payment.id || null,
              receiptUrl,
              date: new Date(),
              lineItems: invoiceRecord?.line_items || null,
              taxRate: taxRate || 0,
            });

            await getResend().emails.send({
              from: 'JHPS Florida <info@jhpsfl.com>',
              to: [customerEmail],
              subject: `Payment Confirmation — $${parseFloat(amount).toFixed(2)} — Jenkins Home & Property Solutions`,
              html: receiptHtml,
              attachments: [
                {
                  filename: pdfFilename,
                  content: pdfBuffer.toString('base64'),
                },
              ],
            });
          } catch (emailErr) {
            console.error('RECEIPT_EMAIL_ERROR:', emailErr);
          }
        }
      } catch (dbErr) {
        console.error('SUPABASE_PAYMENT_RECORD_ERROR:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      paymentId: result.payment?.id,
      orderId: orderId || null,
      status: result.payment?.status,
    });
  } catch (error: unknown) {
    const err = error as { errors?: Array<{ code?: string; detail?: string; category?: string }> };
    console.error('SQUARE_ERROR_FULL:', JSON.stringify(error, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2));

    const squareErrors = err?.errors || [];
    const firstError = squareErrors[0] || {};

    const errorCode = firstError.code || 'UNKNOWN_ERROR';
    const errorDetail = firstError.detail || 'Payment failed';
    const category = firstError.category || 'API_ERROR';
    const displayMessage = `Error [${errorCode}]: ${errorDetail}. (Ref: ${category})`;

    return NextResponse.json({
      success: false, error: displayMessage,
      code: errorCode, category, detail: errorDetail,
    }, { status: 400 });
  }
}

// ─── Receipt Email HTML Template ───
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
}): string {
  const { customerName, amount, service, invoiceNumber, paymentId, receiptNumber, receiptUrl, date, lineItems, taxRate } = params;
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const formattedDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // Build line items HTML
  let itemsHtml = '';
  if (lineItems?.length) {
    const rows = lineItems.map(item =>
      `<tr><td style="padding:8px 12px;color:#333;font-size:14px;border-bottom:1px solid #f0f0f0;">${item.description}</td><td style="padding:8px 12px;color:#333;font-size:14px;text-align:right;border-bottom:1px solid #f0f0f0;font-family:monospace;">${fmt(item.amount)}</td></tr>`
    ).join('');
    const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
    const taxAmt = taxRate > 0 ? subtotal * (taxRate / 100) : 0;
    itemsHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 20px;border:1px solid #e0e8e0;border-radius:8px;overflow:hidden;">
        <tr style="background:#f0f5f0;"><th style="padding:10px 12px;text-align:left;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:0.5px;">Service</th><th style="padding:10px 12px;text-align:right;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:0.5px;">Amount</th></tr>
        ${rows}
        <tr><td style="padding:10px 12px;font-size:13px;color:#888;text-align:right;">Subtotal</td><td style="padding:10px 12px;font-size:14px;color:#333;text-align:right;font-family:monospace;">${fmt(subtotal)}</td></tr>
        ${taxRate > 0 ? `<tr><td style="padding:8px 12px;font-size:13px;color:#888;text-align:right;">Tax (${taxRate}%)</td><td style="padding:8px 12px;font-size:14px;color:#333;text-align:right;font-family:monospace;">${fmt(taxAmt)}</td></tr>` : ''}
        <tr style="background:#f0f5f0;"><td style="padding:12px;font-size:14px;color:#2E7D32;font-weight:700;text-align:right;">Total Paid</td><td style="padding:12px;font-size:16px;color:#2E7D32;font-weight:700;text-align:right;font-family:monospace;">${fmt(amount)}</td></tr>
      </table>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payment Confirmation</title></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:28px 32px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Jenkins Home &amp; Property Solutions</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Payment Confirmation</p>
        </td></tr>
        <tr><td style="background:#fff;padding:32px;">
          <p style="margin:0 0 20px;color:#333;font-size:15px;">Hi ${customerName},</p>
          <p style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.6;">Thank you for your payment! Here are the details:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faf8;border-radius:12px;border:1px solid #e0e8e0;margin-bottom:20px;">
            <tr><td style="padding:20px 24px;border-bottom:1px solid #e0e8e0;">
              <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Amount Paid</div>
              <div style="color:#2E7D32;font-size:28px;font-weight:700;">${fmt(amount)}</div>
            </td></tr>
            <tr><td style="padding:16px 24px;border-bottom:1px solid #e0e8e0;">
              <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Service</div>
              <div style="color:#333;font-size:15px;font-weight:600;">${service}</div>
            </td></tr>
            ${invoiceNumber ? `<tr><td style="padding:16px 24px;border-bottom:1px solid #e0e8e0;">
              <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Invoice</div>
              <div style="color:#333;font-size:15px;font-weight:600;">${invoiceNumber}</div>
            </td></tr>` : ''}
            <tr><td style="padding:16px 24px;${paymentId ? 'border-bottom:1px solid #e0e8e0;' : ''}">
              <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Date</div>
              <div style="color:#333;font-size:15px;">${formattedDate} at ${formattedTime}</div>
            </td></tr>
            ${receiptNumber ? `<tr><td style="padding:16px 24px;border-bottom:1px solid #e0e8e0;">
              <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Receipt #</div>
              <div style="color:#333;font-size:15px;font-weight:700;font-family:monospace;">${receiptNumber}</div>
            </td></tr>` : ''}
            ${paymentId ? `<tr><td style="padding:12px 24px;">
              <div style="color:#aaa;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Transaction ID</div>
              <div style="color:#bbb;font-size:11px;font-family:monospace;">${paymentId}</div>
            </td></tr>` : ''}
          </table>
          ${itemsHtml}
          ${receiptUrl ? `<p style="margin:0 0 24px;text-align:center;"><a href="${receiptUrl}" target="_blank" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#2E7D32,#4CAF50);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Full Receipt</a></p>` : ''}
          <p style="margin:0;color:#333;font-size:15px;line-height:1.6;">If you have any questions about this payment, please don't hesitate to contact us.</p>
          <p style="margin:16px 0 0;color:#333;font-size:15px;">Best regards,<br><strong style="color:#2E7D32;">Jenkins Home &amp; Property Solutions</strong></p>
        </td></tr>
        <tr><td style="background:#fafafa;padding:20px 32px;border-radius:0 0 12px 12px;border-top:1px solid #eee;">
          <p style="margin:0 0 4px;color:#888;font-size:12px;">
            &#128222; <a href="tel:4076869817" style="color:#2E7D32;text-decoration:none;">(407) 686-9817</a>
            &nbsp;&middot;&nbsp;
            &#9993; <a href="mailto:info@jhpsfl.com" style="color:#2E7D32;text-decoration:none;">info@jhpsfl.com</a>
          </p>
          <p style="margin:0;color:#aaa;font-size:11px;">Serving Deltona, Orlando, Sanford, DeLand, Daytona Beach &amp; all of Central Florida</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
