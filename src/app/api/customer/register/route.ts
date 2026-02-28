import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";

// POST /api/customer/register — create Clerk account + link to customer record
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, phone, customer_id } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const clerk = await clerkClient();

    // Check if user already exists in Clerk
    const existingUsers = await clerk.users.getUserList({
      emailAddress: [email],
    });

    if (existingUsers.data.length > 0) {
      const existingUser = existingUsers.data[0];
      // User exists — just return their ID so sign-in can proceed
      return NextResponse.json({
        success: true,
        userId: existingUser.id,
        existing: true,
        message: "Account already exists. Please sign in.",
      });
    }

    // Create Clerk user
    const nameParts = (name || "").trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const clerkUser = await clerk.users.createUser({
      emailAddress: [email],
      password,
      firstName,
      lastName,
      publicMetadata: {
        role: "customer",
        customer_id: customer_id || null,
      },
      skipPasswordChecks: false,
    });

    // Link Clerk user to customer record in Supabase
    if (customer_id) {
      const supabase = createSupabaseAdmin();
      await supabase
        .from("customers")
        .update({ clerk_user_id: clerkUser.id })
        .eq("id", customer_id);
    }

    return NextResponse.json({
      success: true,
      userId: clerkUser.id,
      existing: false,
    });
  } catch (err: unknown) {
    console.error("Customer register error:", err);
    const message = err instanceof Error ? err.message : "Failed to create account";
    // Clerk-specific errors
    if (typeof err === "object" && err !== null && "errors" in err) {
      const clerkErrors = (err as { errors: { message: string }[] }).errors;
      if (clerkErrors?.[0]?.message) {
        return NextResponse.json({ error: clerkErrors[0].message }, { status: 400 });
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
