import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

// Customer dashboard data API
// Called by the /account page when a user is signed in
// GET /api/customer/dashboard?clerk_user_id=user_XXXX

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clerkUserId = searchParams.get("clerk_user_id");

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "clerk_user_id is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Get customer record
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (customerError || !customer) {
      // Customer not yet in DB (webhook may not have fired yet)
      return NextResponse.json({
        customer: null,
        jobSites: [],
        jobs: [],
        payments: [],
        subscriptions: [],
        invoices: [],
      });
    }

    const customerId = customer.id;

    // Fetch all related data in parallel
    const [jobSitesRes, jobsRes, paymentsRes, subscriptionsRes, invoicesRes] =
      await Promise.all([
        supabase
          .from("job_sites")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("jobs")
          .select("*")
          .eq("customer_id", customerId)
          .order("scheduled_date", { ascending: false })
          .limit(50),
        supabase
          .from("payments")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("subscriptions")
          .select("*")
          .eq("customer_id", customerId)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("invoices")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    return NextResponse.json({
      customer,
      jobSites: jobSitesRes.data || [],
      jobs: jobsRes.data || [],
      payments: paymentsRes.data || [],
      subscriptions: subscriptionsRes.data || [],
      invoices: invoicesRes.data || [],
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
