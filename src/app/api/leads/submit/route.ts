import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import {
  uploadLeadMedia,
  getContentType,
  isAllowedMediaType,
  MAX_VIDEO_SIZE,
  MAX_PHOTO_SIZE,
} from "@/lib/b2Storage";

/**
 * POST /api/leads/submit
 *
 * Zero-friction lead submission. No auth required.
 * Accepts multipart form data with contact info + media files.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const mode = (formData.get("mode") as string) || "full"; // "full" | "lead" | "media"

    // ─── MEDIA MODE: upload a single file to an existing lead ───
    if (mode === "media") {
      const leadId = formData.get("lead_id") as string;
      if (!leadId) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

      const file = formData.get("media_0") as File | null;
      if (!file) return NextResponse.json({ success: true, skipped: true });

      const context = (formData.get("context_0") as string) || null;
      const sortOrder = parseInt((formData.get("sort_order") as string) || "0");
      const contentType = file.type || getContentType(file.name);

      if (!isAllowedMediaType(contentType)) {
        return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
      }

      const isVideo = contentType.startsWith("video/");
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_PHOTO_SIZE;
      if (file.size > maxSize) {
        return NextResponse.json({ error: "File too large" }, { status: 413 });
      }

      const supabase = createSupabaseAdmin();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { storagePath, fileSize } = await uploadLeadMedia(leadId, buffer, file.name, contentType);

      await supabase.from("lead_media").insert({
        lead_id: leadId,
        media_type: isVideo ? "video" : "photo",
        storage_path: storagePath,
        original_filename: file.name,
        content_type: contentType,
        file_size_bytes: fileSize,
        capture_context: context,
        sort_order: sortOrder,
      });

      return NextResponse.json({ success: true });
    }

    // ─── Extract contact & property info ───
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const address = formData.get("address") as string;
    const city = (formData.get("city") as string) || "Deltona";
    const state = (formData.get("state") as string) || "FL";
    const zip = formData.get("zip") as string;
    const latitude = formData.get("latitude") ? parseFloat(formData.get("latitude") as string) : null;
    const longitude = formData.get("longitude") ? parseFloat(formData.get("longitude") as string) : null;
    const propertyType = (formData.get("property_type") as string) || "residential";
    const serviceRequested = formData.get("service_requested") as string;
    const modifierData = formData.get("modifier_data") as string; // JSON string
    const customerNotes = formData.get("customer_notes") as string;

    // ─── Validate required fields ───
    if (!name || !email || !phone || !address || !serviceRequested) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, phone, address, service_requested" },
        { status: 400 }
      );
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Basic phone validation (strip non-digits, check length)
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // ─── Check for existing customer by email (for identity stitching) ───
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .single();

    // ─── Create the lead record ───
    let parsedModifiers = {};
    try {
      if (modifierData) parsedModifiers = JSON.parse(modifierData);
    } catch {
      // Invalid JSON, use empty object
    }

    const { data: lead, error: leadError } = await supabase
      .from("video_leads")
      .insert({
        name,
        email,
        phone: phoneDigits,
        address,
        city,
        state,
        zip: zip || null,
        latitude,
        longitude,
        property_type: propertyType,
        service_requested: serviceRequested,
        modifier_data: parsedModifiers,
        customer_notes: customerNotes || null,
        customer_id: existingCustomer?.id || null,
        status: "new",
      })
      .select()
      .single();

    if (leadError || !lead) {
      console.error("Lead creation error:", leadError);
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
    }

    // ─── LEAD MODE: return leadId without uploading files ───
    if (mode === "lead") {
      return NextResponse.json({
        success: true,
        leadId: lead.id,
        message: "Lead created. Ready for file uploads.",
      });
    }

    // ─── Upload media files to B2 ───
    const mediaResults: Array<{
      id: string;
      mediaType: string;
      storagePath: string;
      fileSize: number;
      captureContext: string | null;
    }> = [];

    // Collect all file entries from formData
    // Files are named like: media_0, media_1, etc.
    // Context is: context_0, context_1, etc.
    let fileIndex = 0;
    while (true) {
      const file = formData.get(`media_${fileIndex}`) as File | null;
      if (!file) break;

      const context = (formData.get(`context_${fileIndex}`) as string) || null;
      const contentType = file.type || getContentType(file.name);

      // Validate file type
      if (!isAllowedMediaType(contentType)) {
        fileIndex++;
        continue; // Skip unsupported types silently
      }

      // Validate file size
      const isVideo = contentType.startsWith("video/");
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_PHOTO_SIZE;
      if (file.size > maxSize) {
        fileIndex++;
        continue; // Skip oversized files
      }

      try {
        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to B2
        const { storagePath, fileSize } = await uploadLeadMedia(
          lead.id,
          buffer,
          file.name,
          contentType
        );

        // Record in database
        const { data: mediaRecord, error: mediaError } = await supabase
          .from("lead_media")
          .insert({
            lead_id: lead.id,
            media_type: isVideo ? "video" : "photo",
            storage_path: storagePath,
            original_filename: file.name,
            content_type: contentType,
            file_size_bytes: fileSize,
            capture_context: context,
            sort_order: fileIndex,
          })
          .select()
          .single();

        if (mediaRecord && !mediaError) {
          mediaResults.push({
            id: mediaRecord.id,
            mediaType: isVideo ? "video" : "photo",
            storagePath,
            fileSize,
            captureContext: context,
          });
        }
      } catch (uploadErr) {
        console.error(`Failed to upload file ${fileIndex}:`, uploadErr);
        // Continue with other files
      }

      fileIndex++;
    }

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      mediaCount: mediaResults.length,
      message: "Your quote request has been submitted! We'll review and send you an estimate soon.",
    });

  } catch (err) {
    console.error("Lead submission error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
