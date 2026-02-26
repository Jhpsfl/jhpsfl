import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

// ─── Auth check ───
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

// ─── GET: Fetch data ───
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const clerkUserId = url.searchParams.get("clerk_user_id");
    const resource = url.searchParams.get("resource");
    const customerId = url.searchParams.get("customer_id");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "100");

    if (!clerkUserId || !resource) {
      return NextResponse.json({ error: "Missing clerk_user_id or resource" }, { status: 400 });
    }

    const admin = await verifyAdmin(clerkUserId);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    switch (resource) {
      case "overview": {
        const [customersRes, activeJobsRes, completedJobsRes, subsRes, paymentsRes, recentPaymentsRes, paidInvoicesRes] = await Promise.all([
          supabase.from("customers").select("id", { count: "exact", head: true }),
          supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", ["scheduled", "in_progress"]),
          supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
          supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("payments").select("amount").eq("status", "completed"),
          supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(5),
          supabase.from("invoices").select("amount_paid").eq("status", "paid"),
        ]);

        const revenueFromPayments = (paymentsRes.data || []).reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0);
        const revenueFromInvoices = (paidInvoicesRes.data || []).reduce((sum: number, i: { amount_paid: number }) => sum + (i.amount_paid || 0), 0);
        const recentRevenue = revenueFromPayments + revenueFromInvoices;

        return NextResponse.json({
          totalCustomers: customersRes.count || 0,
          activeJobs: activeJobsRes.count || 0,
          completedJobs: completedJobsRes.count || 0,
          activeSubscriptions: subsRes.count || 0,
          recentRevenue,
          recentPayments: recentPaymentsRes.data || [],
        });
      }

      case "customers": {
        const { data, error } = await supabase
          .from("customers")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
      }

      case "customer_detail": {
        if (!customerId) return NextResponse.json({ error: "customer_id required" }, { status: 400 });

        const [customerRes, sitesRes, jobsRes, paymentsRes, subsRes, invoicesRes] = await Promise.all([
          supabase.from("customers").select("*").eq("id", customerId).single(),
          supabase.from("job_sites").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
          supabase.from("jobs").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
          supabase.from("payments").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
          supabase.from("subscriptions").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
          supabase.from("invoices").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
        ]);

        if (customerRes.error) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

        return NextResponse.json({
          customer: customerRes.data,
          jobSites: sitesRes.data || [],
          jobs: jobsRes.data || [],
          payments: paymentsRes.data || [],
          subscriptions: subsRes.data || [],
          invoices: invoicesRes.data || [],
        });
      }

      case "jobs": {
        let query = supabase.from("jobs").select("*, customers(name, phone, email)").order("created_at", { ascending: false }).limit(limit);
        if (status) query = query.eq("status", status);
        if (customerId) query = query.eq("customer_id", customerId);
        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
      }

      case "payments": {
        let query = supabase.from("payments").select("*, customers(name, phone, email)").order("created_at", { ascending: false }).limit(limit);
        if (status) query = query.eq("status", status);
        if (customerId) query = query.eq("customer_id", customerId);
        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
      }

      case "subscriptions": {
        let query = supabase.from("subscriptions").select("*, customers(name, phone, email)").order("created_at", { ascending: false }).limit(limit);
        if (status) query = query.eq("status", status);
        if (customerId) query = query.eq("customer_id", customerId);
        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
      }

      case "invoices": {
        let query = supabase.from("invoices").select("*, customers(name, phone, email)").order("created_at", { ascending: false }).limit(limit);
        if (status) query = query.eq("status", status);
        if (customerId) query = query.eq("customer_id", customerId);
        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
      }

      default:
        return NextResponse.json({ error: `Unknown resource: ${resource}` }, { status: 400 });
    }
  } catch (err) {
    console.error("Admin GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Create/Update/Delete ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clerk_user_id, resource, action, payload } = body;

    if (!clerk_user_id || !resource || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = await verifyAdmin(clerk_user_id);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    switch (resource) {
      case "jobs": {
        if (action === "create") {
          const { customer_id, service_type, description, status: jobStatus, scheduled_date, amount, crew_notes, admin_notes, job_site_id } = payload;
          if (!customer_id || !service_type) return NextResponse.json({ error: "customer_id and service_type required" }, { status: 400 });
          const insert: Record<string, unknown> = { customer_id, service_type };
          if (description) insert.description = description;
          if (jobStatus) insert.status = jobStatus;
          if (scheduled_date) insert.scheduled_date = scheduled_date;
          if (amount !== undefined && amount !== null) insert.amount = amount;
          if (crew_notes) insert.crew_notes = crew_notes;
          if (admin_notes) insert.admin_notes = admin_notes;
          if (job_site_id) insert.job_site_id = job_site_id;

          const { data, error } = await supabase.from("jobs").insert(insert).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "update") {
          const { id, ...updates } = payload;
          if (!id) return NextResponse.json({ error: "Job id required" }, { status: 400 });
          const clean: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(updates)) { if (v !== "" && v !== undefined) clean[k] = v; }
          const { data, error } = await supabase.from("jobs").update(clean).eq("id", id).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "delete") {
          const { id } = payload;
          if (!id) return NextResponse.json({ error: "Job id required" }, { status: 400 });
          const { error } = await supabase.from("jobs").delete().eq("id", id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true });
        }
        break;
      }

      case "job_sites": {
        if (action === "create") {
          const { customer_id, address, city, state, zip, notes } = payload;
          if (!customer_id || !address) return NextResponse.json({ error: "customer_id and address required" }, { status: 400 });
          const { data, error } = await supabase.from("job_sites").insert({
            customer_id, address, city: city || null, state: state || "FL", zip: zip || null, notes: notes || null,
          }).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "update") {
          const { id, ...updates } = payload;
          if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
          const { data, error } = await supabase.from("job_sites").update(updates).eq("id", id).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "delete") {
          const { id } = payload;
          if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
          const { error } = await supabase.from("job_sites").delete().eq("id", id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true });
        }
        break;
      }

      case "invoices": {
        switch (action) {
          case "create": {
            const { data, error } = await supabase
              .from("invoices")
              .insert({
                customer_id: payload.customer_id,
                invoice_number: payload.invoice_number,
                status: payload.status || "draft",
                amount: payload.total || payload.subtotal || 0,
                subtotal: payload.subtotal,
                tax_rate: payload.tax_rate || 0,
                tax_amount: payload.tax_amount || 0,
                total: payload.total,
                amount_paid: payload.amount_paid || 0,
                due_date: payload.due_date || null,
                notes: payload.notes || null,
                line_items: payload.line_items || [],
                payment_link: payload.payment_link || null,
                sent_at: payload.sent_at || null,
              })
              .select(`*, customers ( name, email, phone )`)
              .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, data });
          }
          case "update": {
            const updateData: Record<string, unknown> = {};
            const allowedFields = [
              "customer_id", "invoice_number", "status", "subtotal",
              "tax_rate", "tax_amount", "total", "amount_paid",
              "due_date", "paid_date", "notes", "line_items",
              "payment_link", "sent_at"
            ];
            for (const field of allowedFields) {
              if (payload[field] !== undefined) updateData[field] = payload[field];
            }
            updateData.updated_at = new Date().toISOString();
            const { data, error } = await supabase
              .from("invoices")
              .update(updateData)
              .eq("id", payload.id)
              .select(`*, customers ( name, email, phone )`)
              .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, data });
          }
          case "delete": {
            const { error } = await supabase.from("invoices").delete().eq("id", payload.id);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true });
          }
        }
        break;
      }

      case "subscriptions": {
        if (action === "create") {
          const { customer_id, plan_name, service_type, frequency, amount, job_site_id, notes } = payload;
          if (!customer_id || !plan_name || !service_type || !frequency || !amount) {
            return NextResponse.json({ error: "Missing required subscription fields" }, { status: 400 });
          }
          const { data, error } = await supabase.from("subscriptions").insert({
            customer_id, plan_name, service_type, frequency, amount, status: "active",
            job_site_id: job_site_id || null, notes: notes || null,
          }).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "update") {
          const { id, ...updates } = payload;
          if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
          const { data, error } = await supabase.from("subscriptions").update(updates).eq("id", id).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "delete") {
          const { id } = payload;
          if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
          const { error } = await supabase.from("subscriptions").delete().eq("id", id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true });
        }
        break;
      }

      case "payments": {
        if (action === "create") {
          const { customer_id, amount, payment_method, job_id, notes } = payload;
          if (!customer_id || !amount) return NextResponse.json({ error: "customer_id and amount required" }, { status: 400 });
          const { data, error } = await supabase.from("payments").insert({
            customer_id, amount, status: "completed", payment_method: payment_method || "cash",
            job_id: job_id || null, notes: notes || null, paid_at: new Date().toISOString(),
          }).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "update") {
          const { id, ...updates } = payload;
          if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
          const { data, error } = await supabase.from("payments").update(updates).eq("id", id).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "delete") {
          const { id } = payload;
          if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
          const { error } = await supabase.from("payments").delete().eq("id", id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true });
        }
        break;
      }

      case "customers": {
        if (action === "create") {
          const { name, email, phone } = payload;
          if (!name && !email && !phone) return NextResponse.json({ error: "At least one of name, email, or phone is required" }, { status: 400 });
          const { data, error } = await supabase.from("customers").insert({
            name: name || null, email: email || null, phone: phone || null,
          }).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "update") {
          const { id, ...updates } = payload;
          if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
          const { data, error } = await supabase.from("customers").update(updates).eq("id", id).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "delete") {
          const { id } = payload;
          if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
          // Hard delete — DB cascades to jobs, payments, invoices, subscriptions, job_sites
          const { error } = await supabase.from("customers").delete().eq("id", id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true });
        }
        break;
      }

      case "admin_users": {
        if (admin.role !== "super_admin") return NextResponse.json({ error: "super_admin only" }, { status: 403 });
        if (action === "add") {
          const { clerk_user_id: newId, email, name, role } = payload;
          if (!newId || !email) return NextResponse.json({ error: "clerk_user_id and email required" }, { status: 400 });
          const { data, error } = await supabase.from("admin_users").insert({
            clerk_user_id: newId, email, name: name || null, role: role || "admin",
          }).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "remove") {
          const { id } = payload;
          if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
          const { error } = await supabase.from("admin_users").delete().eq("id", id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true });
        }
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown resource: ${resource}` }, { status: 400 });
    }

    return NextResponse.json({ error: `Unknown action: ${action} for ${resource}` }, { status: 400 });
  } catch (err) {
    console.error("Admin POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
