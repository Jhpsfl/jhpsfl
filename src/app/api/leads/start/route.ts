import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/leads/start
 *
 * Creates a lead with status "incomplete" when the user enters the media step.
 * Allows background uploads to begin immediately using the returned leadId.
 * If the user abandons, the lead stays as "incomplete" for follow-up.
 *
 * Body: { name, email, phone, address, city, state, zip, latitude, longitude,
 *         property_type, service_requested, modifier_data }
 * Returns: { leadId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, email, phone, address, city, state, zip,
      latitude, longitude, property_type, service_requested, modifier_data,
    } = body;

    if (!name || !email || !phone || !address || !service_requested) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .single();

    let parsedModifiers = {};
    try {
      if (modifier_data && typeof modifier_data === "string") {
        parsedModifiers = JSON.parse(modifier_data);
      } else if (modifier_data && typeof modifier_data === "object") {
        parsedModifiers = modifier_data;
      }
    } catch { /* invalid JSON */ }

    const { data: lead, error } = await supabase
      .from("video_leads")
      .insert({
        name,
        email,
        phone: phoneDigits,
        address,
        city: city || "Deltona",
        state: state || "FL",
        zip: zip || null,
        latitude: latitude || null,
        longitude: longitude || null,
        property_type: property_type || "residential",
        service_requested,
        modifier_data: parsedModifiers,
        customer_id: existingCustomer?.id || null,
        status: "incomplete",
      })
      .select()
      .single();

    if (error || !lead) {
      console.error("Lead start error:", error);
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
    }

    return NextResponse.json({ leadId: lead.id });
  } catch (err) {
    console.error("Lead start error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
