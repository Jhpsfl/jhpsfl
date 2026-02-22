import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

// This webhook is called by Clerk when a user signs up or updates their profile.
// It syncs the user data to the Supabase customers table.
//
// Setup: In Clerk Dashboard → Webhooks → Add Endpoint
// URL: https://jhpsfl.com/api/webhooks/clerk
// Events: user.created, user.updated

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    // Verify this is from Clerk (in production, verify the webhook signature)
    // For now, we check the event type
    if (!type || !data) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    if (type === "user.created" || type === "user.updated") {
      const clerkUserId = data.id;
      const email =
        data.email_addresses?.[0]?.email_address || null;
      const name = [data.first_name, data.last_name]
        .filter(Boolean)
        .join(" ") || null;
      const phone =
        data.phone_numbers?.[0]?.phone_number || null;

      // Upsert customer record
      const { error } = await supabase
        .from("customers")
        .upsert(
          {
            clerk_user_id: clerkUserId,
            email,
            name,
            phone,
          },
          { onConflict: "clerk_user_id" }
        );

      if (error) {
        console.error("Supabase upsert error:", error);
        return NextResponse.json(
          { error: "Database error" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (type === "user.deleted") {
      const clerkUserId = data.id;

      // Delete customer (cascades to job_sites, jobs, payments, etc.)
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("clerk_user_id", clerkUserId);

      if (error) {
        console.error("Supabase delete error:", error);
        return NextResponse.json(
          { error: "Database error" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Unknown event type — acknowledge but do nothing
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
