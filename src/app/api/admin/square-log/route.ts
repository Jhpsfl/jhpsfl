import { NextRequest, NextResponse } from "next/server";
import { SquareClient, SquareEnvironment } from "square";
import { createSupabaseAdmin } from "@/lib/supabase";

const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment: SquareEnvironment.Production,
});

export async function GET(req: NextRequest) {
  const clerkUserId = req.nextUrl.searchParams.get("clerk_user_id");
  const invoiceNumber = req.nextUrl.searchParams.get("invoice_number");

  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin
  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase
    .from("admin_users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .limit(1)
    .single();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Square SDK v44 returns an async iterable from list()
    const allPayments: Array<Record<string, unknown>> = [];
    const iter = squareClient.payments.list({
      sortOrder: "DESC",
    });
    let count = 0;
    for await (const p of iter) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allPayments.push(p as any);
      count++;
      if (count >= 50) break; // limit to 50 results
    }

    const payments = allPayments
      .filter((p) => {
        if (!invoiceNumber) return true;
        return (String(p.note || "")).includes(invoiceNumber);
      })
      .map((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pay = p as any;
        return {
          id: pay.id,
          createdAt: pay.createdAt,
          amount: pay.amountMoney?.amount ? Number(pay.amountMoney.amount) / 100 : 0,
          status: pay.status,
          note: pay.note || "",
          cardBrand: pay.cardDetails?.card?.cardBrand || null,
          cardLast4: pay.cardDetails?.card?.last4 || null,
          cardType: pay.cardDetails?.card?.cardType || null,
          prepaidType: pay.cardDetails?.card?.prepaidType || null,
          cvvStatus: pay.cardDetails?.cvvStatus || null,
          avsStatus: pay.cardDetails?.avsStatus || null,
          entryMethod: pay.cardDetails?.entryMethod || null,
          errors: (pay.cardDetails?.errors || []).map((e: { code?: string; detail?: string; category?: string }) => ({
            code: e.code,
            detail: e.detail,
            category: e.category,
          })),
          buyerEmail: pay.buyerEmailAddress || null,
          orderId: pay.orderId || null,
          receiptUrl: pay.receiptUrl || null,
        };
      });

    return NextResponse.json({ payments });
  } catch (err) {
    console.error("SQUARE_LOG_ERROR:", err);
    return NextResponse.json({ error: "Failed to fetch Square payments" }, { status: 500 });
  }
}
