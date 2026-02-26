import { SquareClient, SquareEnvironment } from 'square';
import { NextResponse } from 'next/server';

const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN?.trim()!,
  environment: SquareEnvironment.Production,
});

export async function POST(request: Request) {
  try {
    const { token, amount, customerName, customerEmail, service, invoiceNumber, note } =
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
      [service, invoiceNumber ? \INV#\\ : ''].filter(Boolean).join(' - ') ||
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
    const displayMessage = \Error [\]: \. (Ref: \)\;

    return NextResponse.json({ 
      success: false, 
      error: displayMessage, 
      code: errorCode,
      category: category,
      detail: errorDetail
    }, { status: 400 });
  }
}
