import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { chargeStoredCard, advanceBillingDate } from "@/lib/square";
import { auth } from '@clerk/nextjs/server';
import { Resend } from "resend";
import { generateReceiptPDF, getReceiptFilename, generateReceiptNumber } from "@/lib/receipt-generator";
import type { ReceiptData } from "@/lib/receipt-generator";

// ─── Square error parser ───
const SQUARE_ERROR_MAP: Record<string, string> = {
  TRANSACTION_LIMIT: "Card declined: Transaction limit exceeded. Ask customer to contact their bank or use a different card.",
  INSUFFICIENT_FUNDS: "Card declined: Insufficient funds.",
  CARD_DECLINED: "Card was declined by the bank. Customer should contact their bank.",
  GENERIC_DECLINE: "Card was declined. Customer should try a different card or contact their bank.",
  EXPIRED_CARD: "Card has expired. Customer needs to update their card.",
  INVALID_CARD: "Card information is invalid.",
  CVV_FAILURE: "Card security code (CVV) did not match.",
  ADDRESS_VERIFICATION_FAILURE: "Billing address verification failed.",
  VOICE_FAILURE: "Card requires voice authorization — contact the bank.",
  BAD_EXPIRY: "Card expiration date is invalid.",
  CARD_NOT_SUPPORTED: "This card type is not supported.",
  INVALID_ACCOUNT: "Card account is invalid or closed.",
  CARD_VELOCITY_EXCEEDED: "Card declined: Too many transactions in a short period.",
  PAYMENT_LIMIT_EXCEEDED: "Payment amount exceeds the allowed limit.",
};

function parseSquareError(err: unknown): string {
  if (!(err instanceof Error)) return "Charge failed — unknown error";
  const msg = err.message;
  try {
    // Square SDK throws "Status code: 400 Body: {...}"
    const bodyMatch = msg.match(/Body:\s*(\{[\s\S]*)/);
    if (bodyMatch) {
      const parsed = JSON.parse(bodyMatch[1]);
      const squareErr = parsed?.errors?.[0];
      if (squareErr?.code && SQUARE_ERROR_MAP[squareErr.code]) {
        return SQUARE_ERROR_MAP[squareErr.code];
      }
      if (squareErr?.detail) {
        // Strip raw auth error wrappers like "Authorization error: 'TRANSACTION_LIMIT'"
        const detail = squareErr.detail.replace(/^Authorization error:\s*'?|'?$/g, "").trim();
        return SQUARE_ERROR_MAP[detail] || `Card declined: ${detail}`;
      }
      if (squareErr?.code) return `Card declined: ${squareErr.code}`;
    }
  } catch { /* fall through */ }
  // If no parseable JSON, return the raw message up to 120 chars
  return msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
}

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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const resource = url.searchParams.get("resource");
    const customerId = url.searchParams.get("customer_id");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "100");

    if (!resource) {
      return NextResponse.json({ error: "Missing resource" }, { status: 400 });
    }

    const admin = await verifyAdmin(userId);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    switch (resource) {
      case "analytics": {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();

        const [
          allPaymentsRes,
          allInvoicesRes,
          allQuotesRes,
          allJobsRes,
          allCustomersRes,
          feedbackRequestsRes,
          feedbackResponsesRes,
        ] = await Promise.all([
          supabase.from("payments").select("amount, status, payment_method, created_at, paid_at").eq("status", "completed").gte("created_at", sixMonthsAgo).order("created_at", { ascending: true }),
          supabase.from("invoices").select("amount_due, amount_paid, status, created_at, paid_at").gte("created_at", sixMonthsAgo).order("created_at", { ascending: true }),
          supabase.from("quotes").select("id, status, total, created_at, is_commercial").gte("created_at", sixMonthsAgo).order("created_at", { ascending: true }),
          supabase.from("jobs").select("id, status, service_type, amount, created_at, completed_date").gte("created_at", sixMonthsAgo).order("created_at", { ascending: true }),
          supabase.from("customers").select("id, customer_type, created_at").gte("created_at", sixMonthsAgo).order("created_at", { ascending: true }),
          supabase.from("feedback_requests").select("id, type, status, sent_at, responded_at, created_at"),
          supabase.from("feedback_responses").select("id, rating, lost_estimate_reason, google_review_clicked, resolution_requested, created_at"),
        ]);

        return NextResponse.json({
          payments: allPaymentsRes.data || [],
          invoices: allInvoicesRes.data || [],
          quotes: allQuotesRes.data || [],
          jobs: allJobsRes.data || [],
          customers: allCustomersRes.data || [],
          feedbackRequests: feedbackRequestsRes.data || [],
          feedbackResponses: feedbackResponsesRes.data || [],
        });
      }

      case "overview": {
        // Only sum revenue from the last 30 days to avoid loading thousands of rows
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [customersRes, activeJobsRes, completedJobsRes, subsRes, paymentsRes, recentPaymentsRes, paidInvoicesRes] = await Promise.all([
          supabase.from("customers").select("id", { count: "exact", head: true }),
          supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", ["scheduled", "in_progress"]),
          supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
          supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("payments").select("amount, notes").eq("status", "completed").gte("paid_at", thirtyDaysAgo),
          supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(5),
          supabase.from("invoices").select("invoice_number, amount_paid").eq("status", "paid").gte("paid_at", thirtyDaysAgo),
        ]);

        const paymentsList = paymentsRes.data || [];
        const revenueFromPayments = paymentsList.reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0);
        // Avoid double-counting: exclude paid invoices that already have a matching payment record
        const invoiceNumsWithPayment = new Set(
          paymentsList.map((p: { amount: number; notes?: string }) => {
            const m = (p.notes || '').match(/INV#(INV-\d{4}-\d+)/);
            return m ? m[1] : null;
          }).filter(Boolean)
        );
        const revenueFromInvoices = (paidInvoicesRes.data || [])
          .filter((i: { invoice_number: string; amount_paid: number }) => !invoiceNumsWithPayment.has(i.invoice_number))
          .reduce((sum: number, i: { invoice_number: string; amount_paid: number }) => sum + (i.amount_paid || 0), 0);
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

        const [customerRes, sitesRes, jobsRes, paymentsRes, subsRes, invoicesRes, cardsRes, quotesRes, notesRes, feedbackRes] = await Promise.all([
          supabase.from("customers").select("*").eq("id", customerId).single(),
          supabase.from("job_sites").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
          supabase.from("jobs").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
          supabase.from("payments").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
          supabase.from("subscriptions").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
          supabase.from("invoices").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
          supabase.from("stored_cards").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
          supabase.from("quotes").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
          supabase.from("customer_notes").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
          supabase.from("feedback_requests").select("*, feedback_responses(*)").eq("customer_id", customerId).order("created_at", { ascending: false }),
        ]);

        if (customerRes.error) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

        return NextResponse.json({
          customer: customerRes.data,
          jobSites: sitesRes.data || [],
          jobs: jobsRes.data || [],
          payments: paymentsRes.data || [],
          subscriptions: subsRes.data || [],
          invoices: invoicesRes.data || [],
          storedCards: cardsRes.data || [],
          quotes: quotesRes.data || [],
          notes: notesRes.data || [],
          feedbackRequests: feedbackRes.data || [],
        });
      }

      case "stored_cards": {
        if (!customerId) return NextResponse.json({ error: "customer_id required" }, { status: 400 });
        const { data, error } = await supabase
          .from("stored_cards")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
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

      case "quotes": {
        let query = supabase.from("quotes").select("*, customers(name, phone, email)").order("created_at", { ascending: false }).limit(limit);
        if (status) query = query.eq("status", status);
        if (customerId) query = query.eq("customer_id", customerId);
        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
      }

      case "financing_agreements": {
        const quoteId = url.searchParams.get("quote_id");
        let query = supabase.from("financing_agreements").select("*").order("created_at", { ascending: false }).limit(limit);
        if (quoteId) query = query.eq("quote_id", quoteId);
        if (status) query = query.eq("status", status);
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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resource, action, payload } = body;

    if (!resource || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = await verifyAdmin(userId);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    switch (resource) {
      case "jobs": {
        if (action === "create") {
          const { customer_id, service_type, description, status: jobStatus, scheduled_date, amount, crew_notes, admin_notes, job_site_id, quote_id, invoice_id } = payload;
          if (!customer_id || !service_type) return NextResponse.json({ error: "customer_id and service_type required" }, { status: 400 });
          const insert: Record<string, unknown> = { customer_id, service_type };
          if (description) insert.description = description;
          if (jobStatus) insert.status = jobStatus;
          if (scheduled_date) insert.scheduled_date = scheduled_date;
          if (amount !== undefined && amount !== null) insert.amount = amount;
          if (crew_notes) insert.crew_notes = crew_notes;
          if (admin_notes) insert.admin_notes = admin_notes;
          if (job_site_id) insert.job_site_id = job_site_id;
          if (quote_id) insert.quote_id = quote_id;
          if (invoice_id) insert.invoice_id = invoice_id;

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
                customer_id: payload.customer_id || null,
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
                payment_terms: payload.payment_terms || null,
                quote_id: payload.quote_id || null,
                brand: payload.brand || 'jhps',
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
              "payment_link", "sent_at", "payment_terms", "quote_id", "brand"
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
          const { customer_id, plan_name, service_type, frequency, amount, job_site_id, notes, billing_mode, next_billing_date } = payload;
          if (!customer_id || !plan_name || !service_type || !frequency || !amount) {
            return NextResponse.json({ error: "Missing required subscription fields" }, { status: 400 });
          }
          const { data, error } = await supabase.from("subscriptions").insert({
            customer_id, plan_name, service_type, frequency, amount, status: "active",
            job_site_id: job_site_id || null, notes: notes || null,
            billing_mode: billing_mode || "manual",
            next_billing_date: next_billing_date || null,
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
        if (action === "charge_now") {
          const { id } = payload;
          if (!id) return NextResponse.json({ error: "Subscription ID required" }, { status: 400 });

          // Look up subscription
          const { data: sub, error: subErr } = await supabase
            .from("subscriptions")
            .select("*, customers(id, name, email, phone, square_customer_id)")
            .eq("id", id)
            .single();
          if (subErr || !sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

          // Look up default stored card
          const { data: card } = await supabase
            .from("stored_cards")
            .select("square_card_id")
            .eq("customer_id", sub.customer_id)
            .eq("is_default", true)
            .single();

          if (!card) {
            // Log no_card
            await supabase.from("billing_log").insert({
              subscription_id: id,
              customer_id: sub.customer_id,
              amount: sub.amount,
              status: "no_card",
              error_message: "No stored card on file",
            });
            return NextResponse.json({ error: "No stored card on file for this customer" }, { status: 400 });
          }

          const amountCents = Math.round(sub.amount * 100);
          const note = `${sub.plan_name} — ${sub.service_type} (${sub.frequency})`;

          try {
            const payResult = await chargeStoredCard(
              card.square_card_id,
              amountCents,
              sub.customers?.square_customer_id || '',
              note,
              sub.customers?.email || undefined,
            );

            // Record payment in payments table
            await supabase.from("payments").insert({
              customer_id: sub.customer_id,
              subscription_id: id,
              amount: sub.amount,
              status: "completed",
              square_payment_id: payResult.paymentId,
              square_receipt_url: payResult.receiptUrl,
              payment_method: "card",
              notes: note,
              paid_at: new Date().toISOString(),
            });

            // Log success
            await supabase.from("billing_log").insert({
              subscription_id: id,
              customer_id: sub.customer_id,
              amount: sub.amount,
              status: "success",
              square_payment_id: payResult.paymentId,
            });

            // Advance billing date
            const currentDate = sub.next_billing_date || new Date().toISOString().split("T")[0];
            const nextDate = advanceBillingDate(currentDate, sub.frequency);
            await supabase.from("subscriptions").update({ next_billing_date: nextDate }).eq("id", id);

            // Send receipt email
            if (sub.customers?.email) {
              try {
                const resend = new Resend(process.env.RESEND_API_KEY);
                const receiptNum = generateReceiptNumber();
                const receiptData: ReceiptData = {
                  paymentId: payResult.paymentId,
                  receiptNumber: receiptNum,
                  paymentDate: new Date(),
                  customerName: sub.customers.name || "Valued Customer",
                  customerEmail: sub.customers.email,
                  lineItems: [{ name: note, quantity: 1, unitPrice: amountCents, totalPrice: amountCents }],
                  subtotal: amountCents,
                  taxAmount: 0,
                  totalAmount: amountCents,
                  paymentStatus: "COMPLETED",
                };
                const pdfBuffer = await generateReceiptPDF(receiptData);
                const pdfFilename = getReceiptFilename(receiptData);

                await resend.emails.send({
                  from: "JHPS Florida <info@jhpsfl.com>",
                  to: [sub.customers.email],
                  subject: `Payment Confirmation — $${sub.amount.toFixed(2)} — Jenkins Home & Property Solutions`,
                  html: `<p>Hi ${sub.customers.name || "Valued Customer"},</p><p>Your recurring payment of <strong>$${sub.amount.toFixed(2)}</strong> for <strong>${note}</strong> has been processed successfully.</p><p>Receipt #${receiptNum}</p><p>Thank you,<br/>Jenkins Home & Property Solutions</p>`,
                  attachments: [{ filename: pdfFilename, content: pdfBuffer.toString("base64") }],
                });
              } catch (emailErr) {
                console.error("CHARGE_RECEIPT_EMAIL_ERROR:", emailErr);
              }
            }

            return NextResponse.json({
              success: true,
              paymentId: payResult.paymentId,
              nextBillingDate: nextDate,
            });
          } catch (chargeErr) {
            const errMsg = parseSquareError(chargeErr);
            const rawMsg = chargeErr instanceof Error ? chargeErr.message : String(chargeErr);
            // Log failure (raw message for debugging)
            await supabase.from("billing_log").insert({
              subscription_id: id,
              customer_id: sub.customer_id,
              amount: sub.amount,
              status: "failed",
              error_message: rawMsg.slice(0, 500),
            });
            return NextResponse.json({ error: errMsg }, { status: 400 });
          }
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
          const { name, email, phone, address, customer_type, company_name, nickname, billing_address, billing_city, billing_zip } = payload;
          if (!name && !email && !phone && !nickname) return NextResponse.json({ error: "At least one of name, email, phone, or nickname is required" }, { status: 400 });
          const { data, error } = await supabase.from("customers").insert({
            name: name || null, email: email || null, phone: phone || null,
            address: address || null,
            customer_type: customer_type || "residential",
            company_name: company_name || null,
            nickname: nickname || null,
            billing_address: billing_address || null,
            billing_city: billing_city || null,
            billing_zip: billing_zip || null,
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

      case "quotes": {
        switch (action) {
          case "create": {
            const { data, error } = await supabase
              .from("quotes")
              .insert({
                customer_id: payload.customer_id || null,
                quote_number: payload.quote_number,
                status: payload.status || "draft",
                subtotal: payload.subtotal,
                tax_rate: payload.tax_rate || 0,
                tax_amount: payload.tax_amount || 0,
                total: payload.total,
                expiration_date: payload.expiration_date || null,
                due_date: payload.due_date || null,
                notes: payload.notes || null,
                line_items: payload.line_items || [],
                show_financing: payload.show_financing || false,
                is_commercial: payload.is_commercial || false,
                payment_terms: payload.payment_terms || null,
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
              "customer_id", "quote_number", "status", "subtotal",
              "tax_rate", "tax_amount", "total", "expiration_date", "due_date",
              "notes", "line_items", "show_financing", "is_commercial", "payment_terms",
              "sent_at", "accepted_at", "declined_at", "converted_invoice_id"
            ];
            for (const field of allowedFields) {
              if (payload[field] !== undefined) updateData[field] = payload[field];
            }
            updateData.updated_at = new Date().toISOString();
            const { data, error } = await supabase
              .from("quotes")
              .update(updateData)
              .eq("id", payload.id)
              .select(`*, customers ( name, email, phone )`)
              .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, data });
          }
          case "delete": {
            const { error } = await supabase.from("quotes").delete().eq("id", payload.id);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true });
          }
        }
        break;
      }

      case "financing_agreements": {
        if (action === "void") {
          const { error } = await supabase
            .from("financing_agreements")
            .update({ status: "voided", updated_at: new Date().toISOString() })
            .eq("id", payload.id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true });
        }
        break;
      }

      case "customer_notes": {
        if (action === "create") {
          const { customer_id, note } = payload;
          if (!customer_id || !note) return NextResponse.json({ error: "customer_id and note required" }, { status: 400 });
          const { data, error } = await supabase.from("customer_notes").insert({ customer_id, note }).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "update") {
          const { id, note } = payload;
          if (!id || !note) return NextResponse.json({ error: "id and note required" }, { status: 400 });
          const { data, error } = await supabase.from("customer_notes").update({ note, updated_at: new Date().toISOString() }).eq("id", id).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, data });
        }
        if (action === "delete") {
          const { id } = payload;
          if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
          const { error } = await supabase.from("customer_notes").delete().eq("id", id);
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
