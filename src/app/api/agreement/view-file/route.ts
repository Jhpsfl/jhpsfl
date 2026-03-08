import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getSignedViewUrl } from "@/lib/b2Storage";
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    // Verify admin
    const supabase = createSupabaseAdmin();
    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Only allow viewing agreement files
    if (!key.startsWith("agreements/")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const signedUrl = await getSignedViewUrl(key, 900); // 15 min expiry

    return NextResponse.json({ url: signedUrl });
  } catch (err) {
    console.error("Agreement view-file error:", err);
    return NextResponse.json({ error: "Failed to generate view URL" }, { status: 500 });
  }
}
