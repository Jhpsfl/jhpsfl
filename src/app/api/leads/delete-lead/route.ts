import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { deleteFromB2 } from "@/lib/b2Storage";
import { auth } from '@clerk/nextjs/server';

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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { lead_id } = body;

    if (!lead_id) {
      return NextResponse.json(
        { error: "Missing required fields: lead_id" },
        { status: 400 }
      );
    }

    // Verify admin
    const admin = await verifyAdmin(userId);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdmin();

    // 1. Get all media files for this lead
    const { data: mediaFiles, error: mediaError } = await supabase
      .from("lead_media")
      .select("storage_path")
      .eq("lead_id", lead_id);

    if (mediaError) {
      console.error("Error fetching media files:", mediaError);
    }

    // 2. Delete all media files from Backblaze B2
    if (mediaFiles && mediaFiles.length > 0) {
      const deletePromises = mediaFiles.map(async (media) => {
        try {
          await deleteFromB2(media.storage_path);
        } catch (b2Error) {
          console.error(`Failed to delete from B2: ${media.storage_path}`, b2Error);
          // Continue even if B2 deletion fails
        }
      });
      await Promise.all(deletePromises);
    }

    // 3. Delete related records in order (due to foreign key constraints)
    // First delete quotes (if any)
    await supabase.from("lead_quotes").delete().eq("lead_id", lead_id);
    
    // Then delete media records
    await supabase.from("lead_media").delete().eq("lead_id", lead_id);
    
    // Finally delete the lead itself
    const { error: deleteError } = await supabase
      .from("video_leads")
      .delete()
      .eq("id", lead_id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete lead record from database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Lead and all associated media deleted successfully",
    });

  } catch (error) {
    console.error("Delete lead error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
