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
    // Get recent payments from Square — filter by invoice if provided
    const result = await squareClient.payments.list({
      sortOrder: "DESC",
      limit: 25,
    });

    const payments = (result.payments || [])
      .filter((p) => {
        if (!invoiceNumber) return true;
        return (p.note || "").includes(invoiceNumber);
      })
      .map((p) => ({
        id: p.id,
        createdAt: p.createdAt,
        amount: p.amountMoney?.amount ? Number(p.amountMoney.amount) / 100 : 0,
        status: p.status,
        note: p.note || "",
        cardBrand: p.cardDetails?.card?.cardBrand || null,
        cardLast4: p.cardDetails?.card?.last4 || null,
        cardType: p.cardDetails?.card?.cardType || null,
        prepaidType: p.cardDetails?.card?.prepaidType || null,
        cvvStatus: p.cardDetails?.cvvStatus || null,
        avsStatus: p.cardDetails?.avsStatus || null,
        entryMethod: p.cardDetails?.entryMethod || null,
        errors: (p.cardDetails?.errors || []).map((e) => ({
          code: e.code,
          detail: e.detail,
          category: e.category,
        })),
        buyerEmail: p.buyerEmailAddress || null,
        orderId: p.orderId || null,
        receiptUrl: p.receiptUrl || null,
      }));

    return NextResponse.json({ payments });
  } catch (err) {
    console.error("SQUARE_LOG_ERROR:", err);
    return NextResponse.json({ error: "Failed to fetch Square payments" }, { status: 500 });
  }
}
