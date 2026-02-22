import { SquareClient, SquareEnvironment } from "square";
import { NextResponse } from "next/server";

const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment: SquareEnvironment.Sandbox,
});

export async function POST(request: Request) {
  try {
    const { token, amount, customerName, customerEmail, service, invoiceNumber, note } =
      await request.json();

    if (!token || !amount) {
      return NextResponse.json({ success: false, error: "Missing token or amount" }, { status: 400 });
    }

    const amountInCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      return NextResponse.json({ success: false, error: "Invalid payment amount" }, { status: 400 });
    }

    const paymentNote =
      note ||
      [service, invoiceNumber ? `INV#${invoiceNumber}` : ""].filter(Boolean).join(" — ") ||
      "JHPS Payment";

    const result = await squareClient.payments.create({
      sourceId: token,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: BigInt(amountInCents),
        currency: "USD",
      },
      locationId: process.env.SQUARE_LOCATION_ID,
      note: paymentNote.slice(0, 500),
      buyerEmailAddress: customerEmail || undefined,
    });

    return NextResponse.json({
      success: true,
      paymentId: result.payment?.id,
      status: result.payment?.status,
    });
  } catch (error: unknown) {
    console.error("Square payment error:", error);

    // Extract Square API error message if available
    const squareError = error as { errors?: Array<{ detail?: string; code?: string }> };
    const detail = squareError?.errors?.[0]?.detail;
    const code = squareError?.errors?.[0]?.code;

    const message = detail || "Payment processing failed. Please try again or call us directly.";
    return NextResponse.json({ success: false, error: message, code }, { status: 400 });
  }
}
