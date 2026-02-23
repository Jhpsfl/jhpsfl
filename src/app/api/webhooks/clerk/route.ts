import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      console.error("CLERK_WEBHOOK_SECRET not set");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    // Get Svix headers for verification
    const svix_id = req.headers.get("svix-id");
    const svix_timestamp = req.headers.get("svix-timestamp");
    const svix_signature = req.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
    }

    // Verify the webhook signature
    const payload = await req.text();
    const wh = new Webhook(secret);
    let event: { type: string; data: Record<string, unknown> };

    try {
      event = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as { type: string; data: Record<string, unknown> };
    } catch {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const { type, data } = event;
    const supabase = createSupabaseAdmin();

    if (type === "user.created" || type === "user.updated") {
      const clerkUserId = data.id as string;
      const emailAddresses = data.email_addresses as Array<{ email_address: string }>;
      const phoneNumbers = data.phone_numbers as Array<{ phone_number: string }>;
      const email = emailAddresses?.[0]?.email_address || null;
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
      const phone = phoneNumbers?.[0]?.phone_number || null;

      const { error } = await supabase
        .from("customers")
        .upsert(
          { clerk_user_id: clerkUserId, email, name, phone },
          { onConflict: "clerk_user_id" }
        );

      if (error) {
        console.error("Supabase upsert error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (type === "user.deleted") {
      const clerkUserId = data.id as string;

      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("clerk_user_id", clerkUserId);

      if (error) {
        console.error("Supabase delete error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
