import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getSignedViewUrl } from "@/lib/b2Storage";
import { Resend } from "resend";

const getResend = () => new Resend(process.env.RESEND_API_KEY);

// ─── Quote email builder ───
interface QuoteEmailPayload {
  customer_name: string; customer_email: string; service_address: string;
  service_requested: string; line_items: { service: string; description?: string; quantity: number; unit_price: number }[];
  total_low: number; total_high: number; notes_to_customer: string | null;
  valid_until: string | null; quote_id: string;
}
function buildQuoteEmailHtml(q: QuoteEmailPayload): string {
  const rows = q.line_items.map((item) => {
    const t = item.unit_price * (item.quantity || 1);
    return `<tr><td style="padding:10px 16px;border-bottom:1px solid #e8f5e8;color:#1a1a1a;font-size:14px;"><strong>${item.service}</strong>${item.description ? `<br><span style="color:#555;font-size:13px;">${item.description}</span>` : ""}</td><td style="padding:10px 16px;border-bottom:1px solid #e8f5e8;color:#555;font-size:14px;text-align:center;">${item.quantity}</td><td style="padding:10px 16px;border-bottom:1px solid #e8f5e8;color:#555;font-size:14px;text-align:right;">$${item.unit_price.toFixed(2)}</td><td style="padding:10px 16px;border-bottom:1px solid #e8f5e8;color:#1a1a1a;font-size:14px;text-align:right;font-weight:600;">$${t.toFixed(2)}</td></tr>`;
  }).join("");
  const validUntilText = q.valid_until ? `<p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Valid until:</strong> ${new Date(q.valid_until).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>` : "";
  const notesSection = q.notes_to_customer ? `<div style="background:#f0faf0;border-left:4px solid #4CAF50;border-radius:0 8px 8px 0;padding:16px 20px;margin:24px 0;"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:1px;text-transform:uppercase;">Notes from JHPS</p><p style="margin:0;font-size:14px;color:#333;line-height:1.6;">${q.notes_to_customer}</p></div>` : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);"><div style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:32px 40px;text-align:center;"><h1 style="margin:0 0 4px;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">JHPS Florida</h1><p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;font-weight:500;">Property Services — First Responders Lawn Care</p></div><div style="padding:36px 40px;"><h2 style="margin:0 0 8px;font-size:22px;color:#1a1a1a;font-weight:700;">Hi ${q.customer_name},</h2><p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">Thank you for choosing JHPS Florida! We've reviewed your property details and prepared a customized estimate for you.</p><div style="background:#f9fdf9;border:1px solid #d4edda;border-radius:10px;padding:16px 20px;margin-bottom:24px;"><p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:1px;text-transform:uppercase;">Service Details</p><p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1a1a1a;">${q.service_requested}</p><p style="margin:0;font-size:13px;color:#555;">📍 ${q.service_address}</p></div><table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e8f5e8;border-radius:10px;overflow:hidden;"><thead><tr style="background:#f0faf0;"><th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:0.8px;text-transform:uppercase;">Service</th><th style="padding:10px 16px;text-align:center;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:0.8px;text-transform:uppercase;">Qty</th><th style="padding:10px 16px;text-align:right;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:0.8px;text-transform:uppercase;">Unit Price</th><th style="padding:10px 16px;text-align:right;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:0.8px;text-transform:uppercase;">Total</th></tr></thead><tbody>${rows}</tbody></table><div style="background:linear-gradient(135deg,#f0faf0,#e8f5e8);border:2px solid #4CAF50;border-radius:12px;padding:20px 24px;margin-bottom:24px;text-align:center;"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#2E7D32;letter-spacing:1px;text-transform:uppercase;">Your Estimated Investment</p><p style="margin:0;font-size:30px;font-weight:800;color:#1a1a1a;letter-spacing:-1px;">$${q.total_low.toFixed(0)} &mdash; $${q.total_high.toFixed(0)}</p><p style="margin:6px 0 0;font-size:12px;color:#555;">Final price confirmed after on-site assessment</p></div>${validUntilText}${notesSection}<div style="border-top:1px solid #e8f5e8;padding-top:24px;margin-top:24px;"><p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6;">Ready to move forward? Have questions? Just reply to this email or give us a call.</p><a href="tel:4076869817" style="display:inline-block;background:linear-gradient(135deg,#4CAF50,#2E7D32);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">📞 Call (407) 686-9817</a></div></div><div style="background:#f9fdf9;border-top:1px solid #e8f5e8;padding:20px 40px;text-align:center;"><p style="margin:0 0 4px;font-size:13px;color:#555;font-weight:600;">JHPS Florida · First Responders Lawn Care &amp; Maintenance</p><p style="margin:0 0 4px;font-size:12px;color:#888;">Deltona, Orlando, Sanford, DeLand, Daytona Beach</p><p style="margin:0;font-size:12px;color:#aaa;">Questions? Reply to this email or call <a href="tel:4076869817" style="color:#4CAF50;text-decoration:none;">407-686-9817</a></p></div></div></body></html>`;
}

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

        // Send email via Resend directly (no internal fetch)
        const { error: emailError } = await getResend().emails.send({
          from: "JHPS Florida <info@jhpsfl.com>",
          to: [lead.email],
          subject: `Your Quote from JHPS Florida — ${lead.service_requested}`,
          replyTo: "info@jhpsfl.com",
          html: buildQuoteEmailHtml({
            customer_name: lead.name,
            customer_email: lead.email,
            service_address: serviceAddress,
            service_requested: lead.service_requested,
            line_items: quote.line_items,
            total_low: quote.total_low,
            total_high: quote.total_high,
            notes_to_customer: quote.notes_to_customer ?? null,
            valid_until: quote.valid_until ?? null,
            quote_id: quote.id,
          }),
        });

        if (emailError) {
          console.error("Resend error:", emailError);
          return NextResponse.json({ success: true, message: "Quote saved (email failed)", emailError }, { status: 200 });
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
