import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getSignedViewUrl } from "@/lib/b2Storage";

// ─── Auth check (reuse from admin/data) ───
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

/**
 * GET /api/leads
 *
 * Fetch leads for admin dashboard.
 * ?clerk_user_id=xxx (required)
 * ?status=new (optional filter)
 * ?lead_id=xxx (optional - get single lead with media + quotes)
 * ?media_key=xxx (optional - get signed URL for a specific file)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const clerkUserId = url.searchParams.get("clerk_user_id");
    const statusFilter = url.searchParams.get("status");
    const leadId = url.searchParams.get("lead_id");
    const mediaKey = url.searchParams.get("media_key");

    if (!clerkUserId) {
      return NextResponse.json({ error: "Missing clerk_user_id" }, { status: 400 });
    }

    const admin = await verifyAdmin(clerkUserId);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    // ─── Get signed URL for specific media file ───
    if (mediaKey) {
      try {
        const signedUrl = await getSignedViewUrl(mediaKey, 3600); // 1 hour
        return NextResponse.json({ url: signedUrl });
      } catch (err) {
        console.error("Signed URL error:", err);
        return NextResponse.json({ error: "Failed to generate view URL" }, { status: 500 });
      }
    }

    // ─── Get single lead with all details ───
    if (leadId) {
      const [leadRes, mediaRes, quotesRes] = await Promise.all([
        supabase.from("video_leads").select("*").eq("id", leadId).single(),
        supabase.from("lead_media").select("*").eq("lead_id", leadId).order("sort_order"),
        supabase.from("lead_quotes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
      ]);

      if (leadRes.error) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }

      return NextResponse.json({
        lead: leadRes.data,
        media: mediaRes.data || [],
        quotes: quotesRes.data || [],
      });
    }

    // ─── Get leads list ───
    let query = supabase
      .from("video_leads")
      .select("*, lead_media(id, media_type, storage_path)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get counts by status for the dashboard badges
    const { data: statusCounts } = await supabase
      .from("video_leads")
      .select("status")
      .then((res) => {
        const counts: Record<string, number> = {};
        (res.data || []).forEach((row: { status: string }) => {
          counts[row.status] = (counts[row.status] || 0) + 1;
        });
        return { data: counts };
      });

    return NextResponse.json({
      leads: data || [],
      counts: statusCounts || {},
    });

  } catch (err) {
    console.error("Leads GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/leads
 *
 * Admin actions on leads: update status, create quote, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clerk_user_id, action, payload } = body;

    if (!clerk_user_id || !action) {
      return NextResponse.json({ error: "Missing clerk_user_id or action" }, { status: 400 });
    }

    const admin = await verifyAdmin(clerk_user_id);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    switch (action) {
      // ─── Update lead status ───
      case "update_status": {
        const { lead_id, status, admin_notes } = payload;
        if (!lead_id || !status) {
          return NextResponse.json({ error: "lead_id and status required" }, { status: 400 });
        }

        const updates: Record<string, unknown> = { status };
        if (admin_notes !== undefined) updates.admin_notes = admin_notes;
        if (status === "reviewing") updates.assigned_to = clerk_user_id;

        const { data, error } = await supabase
          .from("video_leads")
          .update(updates)
          .eq("id", lead_id)
          .select()
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, data });
      }

      // ─── Create/send quote ───
      case "create_quote": {
        const { lead_id, line_items, total_low, total_high, notes_to_customer, internal_notes, valid_until } = payload;
        if (!lead_id || !line_items || !total_low || !total_high) {
          return NextResponse.json({ error: "lead_id, line_items, total_low, total_high required" }, { status: 400 });
        }

        const subtotal = (line_items as Array<{ unit_price: number; quantity: number }>)
          .reduce((sum: number, item) => sum + (item.unit_price * (item.quantity || 1)), 0);

        const { data, error } = await supabase
          .from("lead_quotes")
          .insert({
            lead_id,
            quoted_by: clerk_user_id,
            line_items,
            subtotal,
            total_low,
            total_high,
            notes_to_customer: notes_to_customer || null,
            internal_notes: internal_notes || null,
            valid_until: valid_until || null,
            status: "draft",
          })
          .select()
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, data });
      }

      // ─── Send quote (update quote + lead status + email customer) ───
      case "send_quote": {
        const { quote_id, lead_id } = payload;
        if (!quote_id || !lead_id) {
          return NextResponse.json({ error: "quote_id and lead_id required" }, { status: 400 });
        }

        // Fetch quote + lead details for the email
        const [quoteRes, leadRes] = await Promise.all([
          supabase.from("lead_quotes").select("*").eq("id", quote_id).single(),
          supabase.from("video_leads").select("name, email, address, city, state, zip, service_requested").eq("id", lead_id).single(),
        ]);

        if (quoteRes.error || !quoteRes.data) {
          return NextResponse.json({ error: "Quote not found" }, { status: 404 });
        }
        if (leadRes.error || !leadRes.data) {
          return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        const quote = quoteRes.data;
        const lead = leadRes.data;

        // Update quote status
        await supabase
          .from("lead_quotes")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", quote_id);

        // Update lead status
        await supabase
          .from("video_leads")
          .update({ status: "quoted" })
          .eq("id", lead_id);

        // Build service address string
        const addressParts = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean);
        const serviceAddress = addressParts.join(", ");

        // Send email via Resend
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

        try {
          const emailRes = await fetch(`${baseUrl}/api/leads/send-quote-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_name: lead.name,
              customer_email: lead.email,
              service_address: serviceAddress,
              service_requested: lead.service_requested,
              line_items: quote.line_items,
              total_low: quote.total_low,
              total_high: quote.total_high,
              notes_to_customer: quote.notes_to_customer,
              valid_until: quote.valid_until,
              quote_id: quote.id,
            }),
          });

          if (!emailRes.ok) {
            const emailErr = await emailRes.json().catch(() => ({}));
            console.error("Email send failed:", emailErr);
            // Don't fail the whole action — DB is already updated
            return NextResponse.json({ success: true, message: "Quote sent (email failed)", emailError: emailErr });
          }
        } catch (emailErr) {
          console.error("Email send error:", emailErr);
          return NextResponse.json({ success: true, message: "Quote sent (email failed)", emailError: String(emailErr) });
        }

        return NextResponse.json({ success: true, message: "Quote sent and email delivered" });
      }

      // ─── Convert accepted lead to job ───
      case "convert_to_job": {
        const { lead_id, quote_id } = payload;
        if (!lead_id) {
          return NextResponse.json({ error: "lead_id required" }, { status: 400 });
        }

        // Get lead details
        const { data: lead } = await supabase
          .from("video_leads")
          .select("*")
          .eq("id", lead_id)
          .single();

        if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

        // Get the quote if specified
        let quoteAmount = null;
        if (quote_id) {
          const { data: quote } = await supabase
            .from("lead_quotes")
            .select("total_low, total_high")
            .eq("id", quote_id)
            .single();
          if (quote) quoteAmount = quote.total_high; // Use high end as job amount
        }

        // Check if customer exists, create if not (identity stitching)
        let customerId = lead.customer_id;
        if (!customerId) {
          // Check by email first
          const { data: existingCustomer } = await supabase
            .from("customers")
            .select("id")
            .eq("email", lead.email)
            .single();

          if (existingCustomer) {
            customerId = existingCustomer.id;
          } else {
            // Create new customer record (without clerk_user_id — they can claim it later)
            const { data: newCustomer } = await supabase
              .from("customers")
              .insert({
                email: lead.email,
                name: lead.name,
                phone: lead.phone,
              })
              .select()
              .single();
            customerId = newCustomer?.id;
          }

          // Link customer to lead
          if (customerId) {
            await supabase
              .from("video_leads")
              .update({ customer_id: customerId })
              .eq("id", lead_id);
          }
        }

        if (!customerId) {
          return NextResponse.json({ error: "Could not resolve customer" }, { status: 500 });
        }

        // Create a job site from the lead address
        const { data: jobSite } = await supabase
          .from("job_sites")
          .insert({
            customer_id: customerId,
            address: lead.address,
            city: lead.city,
            state: lead.state,
            zip: lead.zip,
          })
          .select()
          .single();

        // Create the job
        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .insert({
            customer_id: customerId,
            job_site_id: jobSite?.id || null,
            service_type: lead.service_requested,
            description: `Video quote lead - ${lead.name}. ${lead.customer_notes || ""}`.trim(),
            status: "scheduled",
            amount: quoteAmount,
            admin_notes: `Converted from video lead ${lead_id}`,
          })
          .select()
          .single();

        if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });

        // Update lead status
        await supabase
          .from("video_leads")
          .update({ status: "converted", converted_job_id: job?.id })
          .eq("id", lead_id);

        return NextResponse.json({ success: true, jobId: job?.id, customerId });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

  } catch (err) {
    console.error("Leads POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
