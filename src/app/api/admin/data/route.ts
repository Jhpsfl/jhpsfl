import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

// Admin CRUD API — requires admin user
// Checks admin_users table before allowing access
// GET  /api/admin/data?resource=customers&clerk_user_id=user_XXXX
// POST /api/admin/data  { clerk_user_id, resource, action, payload }

async function verifyAdmin(clerkUserId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, role")
    .eq("clerk_user_id", clerkUserId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clerkUserId = searchParams.get("clerk_user_id");
    const resource = searchParams.get("resource");

    if (!clerkUserId) {
      return NextResponse.json({ error: "clerk_user_id required" }, { status: 400 });
    }

    const admin = await verifyAdmin(clerkUserId);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();
    const validResources = ["customers", "job_sites", "jobs", "payments", "subscriptions", "invoices", "admin_users"];

    if (!resource || !validResources.includes(resource)) {
      return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from(resource)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin GET error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Admin GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clerk_user_id, resource, action, payload } = body;

    if (!clerk_user_id) {
      return NextResponse.json({ error: "clerk_user_id required" }, { status: 400 });
    }

    const admin = await verifyAdmin(clerk_user_id);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();
    const validResources = ["customers", "job_sites", "jobs", "payments", "subscriptions", "invoices", "admin_users"];

    if (!resource || !validResources.includes(resource)) {
      return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
    }

    let result;

    if (action === "create") {
      result = await supabase.from(resource).insert(payload).select().single();
    } else if (action === "update") {
      const { id, ...updates } = payload;
      result = await supabase.from(resource).update(updates).eq("id", id).select().single();
    } else if (action === "delete") {
      result = await supabase.from(resource).delete().eq("id", payload.id);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (result.error) {
      console.error("Admin POST error:", result.error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error("Admin POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
