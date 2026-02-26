import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

// PATCH /api/customer/dashboard — customer self-service profile updates
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { clerk_user_id, action, payload } = body;

    if (!clerk_user_id || !action) {
      return NextResponse.json({ error: "clerk_user_id and action required" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verify customer exists
    const { data: customer, error: lookupErr } = await supabase
      .from("customers")
      .select("id")
      .eq("clerk_user_id", clerk_user_id)
      .single();

    if (lookupErr || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const customerId = customer.id;

    if (action === "update_profile") {
      const { name, phone } = payload || {};
      const updates: Record<string, string | null> = {};
      if (name !== undefined) updates.name = name?.trim() || null;
      if (phone !== undefined) updates.phone = phone?.trim() || null;
      const { error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", customerId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "add_site") {
      const { address, city, state, zip, notes } = payload || {};
      if (!address?.trim()) return NextResponse.json({ error: "Address is required" }, { status: 400 });
      const { data, error } = await supabase
        .from("job_sites")
        .insert({
          customer_id: customerId,
          address: address.trim(),
          city: city?.trim() || null,
          state: state?.trim() || "FL",
          zip: zip?.trim() || null,
          notes: notes?.trim() || null,
        })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data });
    }

    if (action === "update_site") {
      const { id, address, city, state, zip, notes } = payload || {};
      if (!id) return NextResponse.json({ error: "Site id required" }, { status: 400 });
      if (!address?.trim()) return NextResponse.json({ error: "Address is required" }, { status: 400 });
      // Verify site belongs to this customer
      const { data: site } = await supabase.from("job_sites").select("id").eq("id", id).eq("customer_id", customerId).single();
      if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const { error } = await supabase
        .from("job_sites")
        .update({
          address: address.trim(),
          city: city?.trim() || null,
          state: state?.trim() || "FL",
          zip: zip?.trim() || null,
          notes: notes?.trim() || null,
        })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "delete_site") {
      const { id } = payload || {};
      if (!id) return NextResponse.json({ error: "Site id required" }, { status: 400 });
      const { data: site } = await supabase.from("job_sites").select("id").eq("id", id).eq("customer_id", customerId).single();
      if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const { error } = await supabase.from("job_sites").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Dashboard PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
