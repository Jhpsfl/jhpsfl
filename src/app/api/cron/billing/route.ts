import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { chargeStoredCard, advanceBillingDate } from '@/lib/square';
import { Resend } from 'resend';
import { generateReceiptPDF, getReceiptFilename, generateReceiptNumber } from '@/lib/receipt-generator';
import type { ReceiptData } from '@/lib/receipt-generator';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const today = new Date().toISOString().split('T')[0];

  // Find all auto-billing subscriptions due today or earlier
  const { data: dueSubs, error: queryErr } = await supabase
    .from('subscriptions')
    .select('*, customers(id, name, email, phone, square_customer_id)')
    .eq('billing_mode', 'auto')
    .eq('status', 'active')
    .lte('next_billing_date', today);

  if (queryErr) {
    console.error('CRON_QUERY_ERROR:', queryErr);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const results = { processed: 0, succeeded: 0, failed: 0, no_card: 0 };

  for (const sub of dueSubs || []) {
    results.processed++;

    // Look up default stored card
    const { data: card } = await supabase
      .from('stored_cards')
      .select('square_card_id')
      .eq('customer_id', sub.customer_id)
      .eq('is_default', true)
      .single();

    if (!card) {
      results.no_card++;
      await supabase.from('billing_log').insert({
        subscription_id: sub.id,
        customer_id: sub.customer_id,
        amount: sub.amount,
        status: 'no_card',
        error_message: 'No stored card on file',
      });
      continue;
    }

    const amountCents = Math.round(sub.amount * 100);
    const note = `${sub.plan_name} — ${sub.service_type} (${sub.frequency})`;

    try {
      const payResult = await chargeStoredCard(
        card.square_card_id,
        amountCents,
        sub.customers?.square_customer_id || '',
        note,
        sub.customers?.email || undefined,
      );

      // Record payment
      await supabase.from('payments').insert({
        customer_id: sub.customer_id,
        subscription_id: sub.id,
        amount: sub.amount,
        status: 'completed',
        square_payment_id: payResult.paymentId,
        square_receipt_url: payResult.receiptUrl,
        payment_method: 'card',
        notes: `Auto-billing: ${note}`,
        paid_at: new Date().toISOString(),
      });

      // Log success
      await supabase.from('billing_log').insert({
        subscription_id: sub.id,
        customer_id: sub.customer_id,
        amount: sub.amount,
        status: 'success',
        square_payment_id: payResult.paymentId,
      });

      // Advance billing date
      const currentDate = sub.next_billing_date || today;
      const nextDate = advanceBillingDate(currentDate, sub.frequency);
      await supabase.from('subscriptions').update({ next_billing_date: nextDate }).eq('id', sub.id);

      // Send receipt email
      if (sub.customers?.email) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const receiptNum = generateReceiptNumber();
          const receiptData: ReceiptData = {
            paymentId: payResult.paymentId,
            receiptNumber: receiptNum,
            paymentDate: new Date(),
            customerName: sub.customers.name || 'Valued Customer',
            customerEmail: sub.customers.email,
            lineItems: [{ name: note, quantity: 1, unitPrice: amountCents, totalPrice: amountCents }],
            subtotal: amountCents,
            taxAmount: 0,
            totalAmount: amountCents,
            paymentStatus: 'COMPLETED',
          };
          const pdfBuffer = await generateReceiptPDF(receiptData);
          const pdfFilename = getReceiptFilename(receiptData);

          await resend.emails.send({
            from: 'JHPS Florida <info@jhpsfl.com>',
            to: [sub.customers.email],
            subject: `Payment Confirmation — $${sub.amount.toFixed(2)} — Jenkins Home & Property Solutions`,
            html: `<p>Hi ${sub.customers.name || 'Valued Customer'},</p><p>Your recurring payment of <strong>$${sub.amount.toFixed(2)}</strong> for <strong>${note}</strong> has been processed automatically.</p><p>Receipt #${receiptNum}</p><p>Thank you,<br/>Jenkins Home & Property Solutions</p>`,
            attachments: [{ filename: pdfFilename, content: pdfBuffer.toString('base64') }],
          });
        } catch (emailErr) {
          console.error('CRON_RECEIPT_EMAIL_ERROR:', emailErr);
        }
      }

      results.succeeded++;
    } catch (chargeErr) {
      results.failed++;
      const rawMsg = chargeErr instanceof Error ? chargeErr.message : String(chargeErr);
      await supabase.from('billing_log').insert({
        subscription_id: sub.id,
        customer_id: sub.customer_id,
        amount: sub.amount,
        status: 'failed',
        error_message: rawMsg.slice(0, 500),
      });
      // Do NOT advance billing date — will retry next day
      console.error(`CRON_CHARGE_FAILED [sub=${sub.id}]:`, rawMsg);
    }
  }

  return NextResponse.json(results);
}
