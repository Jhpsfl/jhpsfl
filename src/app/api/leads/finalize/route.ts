import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToAllAdmins } from "@/lib/pushNotify";

/**
 * POST /api/leads/finalize
 *
 * Called when user hits "Submit Quote Request" on the review screen.
 * Promotes the lead from "incomplete" to "new" and saves customer notes.
 * Also sends push notification to admins.
 *
 * Body: { leadId, customerNotes? }
 * Returns: { success: true }
 */
export async function POST(request: NextRequest) {
  try {
    const { leadId, customerNotes } = await request.json();

    if (!leadId) {
      return NextResponse.json({ error: "Missing leadId" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Fetch the lead to get customer name and service type
    const { data: leadData } = await supabase
      .from("video_leads")
      .select("name, service_requested")
      .eq("id", leadId)
      .single();

    const { error } = await supabase
      .from("video_leads")
      .update({
        status: "new",
        customer_notes: customerNotes || null,
      })
      .eq("id", leadId);

    if (error) {
      console.error("Lead finalize error:", error);
      return NextResponse.json({ error: "Failed to finalize lead" }, { status: 500 });
    }

    // Send push notification to all admins
    if (leadData) {
      await sendPushToAllAdmins({
        title: "📹 New Quote Request",
        body: `${leadData.name} wants a quote for ${leadData.service_requested}`,
        url: "/admin?tab=video_leads",
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Lead finalize error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
