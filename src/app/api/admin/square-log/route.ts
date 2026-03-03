import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

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
    // Use Square REST API directly to avoid SDK type issues
    const res = await fetch("https://connect.squareup.com/v2/payments?sort_order=DESC&limit=50", {
      headers: {
        "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Square API error" }, { status: 502 });
    }

    const data = await res.json();
    const allPayments = data.payments || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payments = allPayments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p: any) => {
        if (!invoiceNumber) return true;
        return (p.note || "").includes(invoiceNumber);
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({
        id: p.id,
        createdAt: p.created_at,
        amount: p.amount_money?.amount ? Number(p.amount_money.amount) / 100 : 0,
        status: p.status,
        note: p.note || "",
        cardBrand: p.card_details?.card?.card_brand || null,
        cardLast4: p.card_details?.card?.last_4 || null,
        cardType: p.card_details?.card?.card_type || null,
        prepaidType: p.card_details?.card?.prepaid_type || null,
        cvvStatus: p.card_details?.cvv_status || null,
        avsStatus: p.card_details?.avs_status || null,
        entryMethod: p.card_details?.entry_method || null,
        errors: (p.card_details?.errors || []).map((e: { code?: string; detail?: string; category?: string }) => ({
          code: e.code,
          detail: e.detail,
          category: e.category,
        })),
        buyerEmail: p.buyer_email_address || null,
        orderId: p.order_id || null,
        receiptUrl: p.receipt_url || null,
      }));

    return NextResponse.json({ payments });
  } catch (err) {
    console.error("SQUARE_LOG_ERROR:", err);
    return NextResponse.json({ error: "Failed to fetch Square payments" }, { status: 500 });
  }
}
