import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { deleteFromB2 } from "@/lib/b2Storage";

async function verifyAdmin(clerkUserId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, role")
    .eq("clerk_user_id", clerkUserId)
    .single();
    
  if (error || !data) return null;
  return data as { id: string; role: string };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clerk_user_id, media_id } = body;

    if (!clerk_user_id || !media_id) {
      return NextResponse.json(
        { error: "Missing required fields: clerk_user_id, media_id" },
        { status: 400 }
      );
    }

    // Verify admin
    const admin = await verifyAdmin(clerk_user_id);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdmin();

    // 1. Get the media record to get storage_path
    const { data: media, error: fetchError } = await supabase
      .from("lead_media")
      .select("storage_path, lead_id")
      .eq("id", media_id)
      .single();

    if (fetchError || !media) {
      return NextResponse.json(
        { error: "Media not found" },
        { status: 404 }
      );
    }

    // 2. Delete from Backblaze B2
    try {
      await deleteFromB2(media.storage_path);
    } catch (b2Error) {
      console.error("Failed to delete from B2:", b2Error);
      // Continue with DB deletion even if B2 fails, but log it
      // We could choose to return an error here, but for now we continue
    }

    // 3. Delete from Supabase
    const { error: deleteError } = await supabase
      .from("lead_media")
      .delete()
      .eq("id", media_id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete media record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Media deleted successfully",
      lead_id: media.lead_id,
    });

  } catch (error) {
    console.error("Delete media error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
