import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/leads/finalize
 *
 * Called when user hits "Submit Quote Request" on the review screen.
 * Promotes the lead from "incomplete" to "new" and saves customer notes.
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Lead finalize error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
