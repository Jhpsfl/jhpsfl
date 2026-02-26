import { SquareClient, SquareEnvironment } from 'square';
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN?.trim()!,
  environment: SquareEnvironment.Production,
});

export async function POST(request: Request) {
  try {
    const { token, amount, customerName, customerEmail, customerPhone, service, invoiceNumber, note } =
      await request.json();

    if (!token || !amount) {
      return NextResponse.json({ success: false, error: 'Missing token or amount' }, { status: 400 });
    }

    const amountInCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid payment amount' }, { status: 400 });
    }

    const paymentNote =
      note ||
      [service, invoiceNumber ? 'INV#' + invoiceNumber : ''].filter(Boolean).join(' - ') ||
      'JHPS Payment';

    const result = await squareClient.payments.create({
      sourceId: token,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: BigInt(amountInCents),
        currency: 'USD',
      },
      locationId: process.env.SQUARE_LOCATION_ID?.trim(),
      note: paymentNote.slice(0, 500),
      buyerEmailAddress: customerEmail || undefined,
    });

    // ─── Record payment in Supabase ───
    if (result.payment?.status === 'COMPLETED') {
      try {
        const supabase = createSupabaseAdmin();
        const receiptUrl = result.payment.receiptUrl || null;

        // Try to find existing customer by email or phone
        let customerId: string | null = null;
        if (customerEmail) {
          const { data } = await supabase.from('customers').select('id').eq('email', customerEmail).limit(1).single();
          if (data) customerId = data.id;
        }
        if (!customerId && customerPhone) {
          const { data } = await supabase.from('customers').select('id').eq('phone', customerPhone).limit(1).single();
          if (data) customerId = data.id;
        }

        // If no existing customer, create one
        if (!customerId) {
          const { data } = await supabase.from('customers').insert({
            name: customerName || null,
            email: customerEmail || null,
            phone: customerPhone || null,
          }).select('id').single();
          if (data) customerId = data.id;
        }

        if (customerId) {
          // Find matching invoice if invoice number provided
          let invoiceId: string | null = null;
          if (invoiceNumber) {
            const { data } = await supabase.from('invoices')
              .select('id')
              .eq('invoice_number', invoiceNumber)
              .limit(1)
              .single();
            if (data) invoiceId = data.id;
          }

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

          // If invoice matched, mark it as paid
          if (invoiceId) {
            await supabase.from('invoices').update({
              status: 'paid',
              paid_date: new Date().toISOString().split('T')[0],
            }).eq('id', invoiceId);
          }
        }
      } catch (dbErr) {
        // Don't fail the payment response if DB write fails
        console.error('SUPABASE_PAYMENT_RECORD_ERROR:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      paymentId: result.payment?.id,
      status: result.payment?.status,
    });
  } catch (error: any) {
    // Log full error for server-side debugging
    console.error('SQUARE_ERROR_FULL:', JSON.stringify(error, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2));

    const squareErrors = error?.errors || [];
    const firstError = squareErrors[0] || {};

    // Construct a clear error message that includes the code
    const errorCode = firstError.code || 'UNKNOWN_ERROR';
    const errorDetail = firstError.detail || 'Payment failed';
    const category = firstError.category || 'API_ERROR';

    // This is the string the user sees. Including the code explicitly.
    const displayMessage = 'Error [' + errorCode + ']: ' + errorDetail + '. (Ref: ' + category + ')';

    return NextResponse.json({
      success: false,
      error: displayMessage,
      code: errorCode,
      category: category,
      detail: errorDetail
    }, { status: 400 });
  }
}
