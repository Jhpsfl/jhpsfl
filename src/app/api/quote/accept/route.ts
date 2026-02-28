import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = createSupabaseAdmin();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id, status, public_token, quote_number, total, customer_id, customers(name)")
    .eq("public_token", token)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  if (quote.status === "accepted") {
    return NextResponse.json({ success: true, already: true });
  }

  if (!["draft", "sent"].includes(quote.status)) {
    return NextResponse.json({ error: `This estimate is ${quote.status} and cannot be accepted` }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("quotes")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", quote.id);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to accept estimate" }, { status: 500 });
  }

  // Send admin push notification
  try {
    const customerName = (quote.customers as unknown as { name: string } | null)?.name || "A customer";
    await fetch(new URL("/api/push/send", req.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "✅ Estimate Accepted!",
        body: `${customerName} accepted estimate ${quote.quote_number} — $${quote.total.toFixed(2)}`,
        url: "/admin",
      }),
    }).catch(() => {});
  } catch { /* non-fatal */ }

  return NextResponse.json({ success: true });
}
