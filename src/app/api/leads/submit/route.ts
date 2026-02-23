import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/leads/submit
 *
 * Phase 5b: Lead submission with direct-to-B2 upload flow.
 *
 * Step 1: Browser creates lead via this endpoint (JSON, no files)
 * Step 2: Browser gets pre-signed URLs from /api/leads/upload-url
 * Step 3: Browser uploads files directly to B2
 * Step 4: Browser registers uploaded media via /api/leads/register-media
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, email, phone, address, city, state, zip,
      latitude, longitude, property_type, service_requested,
      modifier_data, customer_notes,
    } = body;

    // Validate required fields
    if (!name || !email || !phone || !address || !service_requested) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, phone, address, service_requested" },
        { status: 400 }
      );
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Phone validation
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Check for existing customer (identity stitching prep)
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .single();

    // Parse modifier data
    let parsedModifiers = {};
    try {
      if (modifier_data && typeof modifier_data === "string") {
        parsedModifiers = JSON.parse(modifier_data);
      } else if (modifier_data && typeof modifier_data === "object") {
        parsedModifiers = modifier_data;
      }
    } catch {
      // Invalid JSON, use empty
    }

    // Create lead
    const { data: lead, error: leadError } = await supabase
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
        customer_notes: customer_notes || null,
        customer_id: existingCustomer?.id || null,
        status: "new",
      })
      .select()
      .single();

    if (leadError || !lead) {
      console.error("Lead creation error:", leadError);
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      leadId: lead.id,
    });

  } catch (err) {
    console.error("Lead submission error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
