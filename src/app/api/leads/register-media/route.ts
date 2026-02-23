import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/leads/register-media
 *
 * Called by the browser AFTER a file has been uploaded directly to B2.
 * Registers the media metadata in the lead_media table.
 *
 * Body: { leadId, storagePath, mediaType, originalFilename, contentType, fileSizeBytes, durationSeconds?, captureContext?, sortOrder? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      leadId, storagePath, mediaType, originalFilename,
      contentType, fileSizeBytes, durationSeconds,
      captureContext, sortOrder,
    } = body;

    if (!leadId || !storagePath || !mediaType) {
      return NextResponse.json(
        { error: "Missing required fields: leadId, storagePath, mediaType" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify the lead exists
    const { data: lead } = await supabase
      .from("video_leads")
      .select("id")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Register the media
    const { data: media, error } = await supabase
      .from("lead_media")
      .insert({
        lead_id: leadId,
        storage_path: storagePath,
        media_type: mediaType,
        original_filename: originalFilename || null,
        content_type: contentType || null,
        file_size_bytes: fileSizeBytes || 0,
        duration_seconds: durationSeconds || null,
        capture_context: captureContext || null,
        sort_order: sortOrder || 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Media registration error:", error);
      return NextResponse.json({ error: "Failed to register media" }, { status: 500 });
    }

    return NextResponse.json({ success: true, mediaId: media.id });

  } catch (err) {
    console.error("Register media error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
