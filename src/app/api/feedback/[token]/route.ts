import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("feedback_requests")
    .select("id, type, status, customer_id, customers(name)")
    .eq("token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const customerData = data.customers as unknown as { name: string | null } | null;
  const customerName = customerData?.name || "Valued Customer";

  return NextResponse.json({
    id: data.id,
    type: data.type,
    status: data.status,
    customer_name: customerName,
    first_name: customerName.split(" ")[0],
  });
}
