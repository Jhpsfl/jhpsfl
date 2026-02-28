import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { generateAgreementText, type QuoteSnapshot, type PaymentScheduleSnapshot } from "@/lib/agreement";
import crypto from "crypto";

// ─── POST: Create a new agreement (admin-initiated) ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clerk_user_id, quote_id, invoice_id } = body;

    if (!clerk_user_id || (!quote_id && !invoice_id)) {
      return NextResponse.json({ error: "Missing clerk_user_id or quote_id/invoice_id" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Auth check
    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("clerk_user_id", clerk_user_id)
      .single();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // ─── Source: Invoice or Quote ───
    let sourceData: {
      customer_id: string | null;
      customer_name: string;
      customer_email: string;
      customer_phone: string;
      line_items: { description: string; quantity: number; unit_price: number; amount: number }[];
      subtotal: number;
      tax_amount: number;
      total: number;
      payment_terms: { type: string; deposit_amount: number; deposit_percentage: number; deposit_method: string; schedule: { label: string; amount: number; due_date: string | null }[] } | null;
      notes: string | null;
      source_number: string;
      source_type: "quote" | "invoice";
      source_id: string;
      payment_link?: string;
    } | null = null;

    if (invoice_id) {
      // Invoice-based agreement
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .select("*, customers(name, email, phone)")
        .eq("id", invoice_id)
        .single();
      if (invErr || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      if (!invoice.payment_terms) return NextResponse.json({ error: "Invoice does not have payment terms" }, { status: 400 });

      const customer = invoice.customers || {};
      sourceData = {
        customer_id: invoice.customer_id,
        customer_name: customer.name || "Customer",
        customer_email: customer.email || "",
        customer_phone: customer.phone || "",
        line_items: invoice.line_items || [],
        subtotal: invoice.subtotal,
        tax_amount: invoice.tax_amount,
        total: invoice.total,
        payment_terms: invoice.payment_terms,
        notes: invoice.notes,
        source_number: invoice.invoice_number,
        source_type: "invoice",
        source_id: invoice_id,
        payment_link: invoice.payment_link || undefined,
      };
    } else if (quote_id) {
      // Quote-based agreement (original flow)
      const { data: quote, error: quoteErr } = await supabase
        .from("quotes")
        .select("*, customers(name, email, phone)")
        .eq("id", quote_id)
        .single();
      if (quoteErr || !quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
      if (!quote.show_financing && !quote.payment_terms) return NextResponse.json({ error: "Quote does not have financing enabled" }, { status: 400 });

      const customer = quote.customers || {};
      sourceData = {
        customer_id: quote.customer_id,
        customer_name: customer.name || "Customer",
        customer_email: customer.email || "",
        customer_phone: customer.phone || "",
        line_items: quote.line_items || [],
        subtotal: quote.subtotal,
        tax_amount: quote.tax_amount,
        total: quote.total,
        payment_terms: quote.payment_terms,
        notes: quote.notes,
        source_number: quote.quote_number,
        source_type: "quote",
        source_id: quote_id,
      };
    }

    if (!sourceData) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    // Check if an active agreement already exists for this source
    const lookupCol = sourceData.source_type === "invoice" ? "quote_id" : "quote_id";
    const lookupId = sourceData.source_type === "invoice" ? invoice_id : quote_id;
    
    // For invoices, check by customer_id + matching snapshot number; for quotes use quote_id
    let existingQuery = supabase
      .from("financing_agreements")
      .select("id, token, status")
      .in("status", ["pending", "viewed"]);
    
    if (quote_id) {
      existingQuery = existingQuery.eq("quote_id", quote_id);
    } else {
      // For invoice-based, look up by customer_id and check snapshot
      existingQuery = existingQuery.eq("customer_id", sourceData.customer_id);
    }

    const { data: existing } = await existingQuery.single();

    if (existing && quote_id) {
      const baseUrl = request.headers.get("origin") || "https://jhpsfl.com";
      return NextResponse.json({
        success: true,
        agreement_id: existing.id,
        token: existing.token,
        url: `${baseUrl}/agreement/${existing.token}`,
        existing: true,
      });
    }

    // Build snapshot and schedule
    const paymentTerms = sourceData.payment_terms;
    const schedule: PaymentScheduleSnapshot[] = paymentTerms?.schedule?.map((s: { label: string; amount: number; due_date: string | null }) => ({
      label: s.label,
      amount: s.amount,
      due_date: s.due_date,
    })) || [];

    const snapshot: QuoteSnapshot = {
      quote_number: sourceData.source_number,
      customer_name: sourceData.customer_name,
      customer_email: sourceData.customer_email,
      customer_phone: sourceData.customer_phone,
      line_items: sourceData.line_items.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        amount: li.amount,
      })),
      subtotal: sourceData.subtotal,
      tax_amount: sourceData.tax_amount,
      total: sourceData.total,
      payment_terms_type: paymentTerms?.type || "deposit_balance",
      deposit_amount: paymentTerms?.deposit_amount || sourceData.total * 0.5,
      notes: sourceData.notes,
    };

    // Add payment_link to snapshot if available (for post-signing redirect)
    const snapshotWithPayLink = {
      ...snapshot,
      ...(sourceData.payment_link ? { payment_link: sourceData.payment_link } : {}),
    };

    const agreementText = generateAgreementText(snapshot, schedule);
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: agreement, error: insertErr } = await supabase
      .from("financing_agreements")
      .insert({
        quote_id: quote_id || null,
        customer_id: sourceData.customer_id || null,
        token,
        status: "pending",
        agreement_text: agreementText,
        payment_schedule: schedule,
        quote_snapshot: snapshotWithPayLink,
        expires_at: expiresAt.toISOString(),
        signer_name: sourceData.customer_name || null,
        signer_email: sourceData.customer_email || null,
        signer_phone: sourceData.customer_phone || null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Agreement insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const baseUrl = request.headers.get("origin") || "https://jhpsfl.com";

    return NextResponse.json({
      success: true,
      agreement_id: agreement.id,
      token: agreement.token,
      url: `${baseUrl}/agreement/${agreement.token}`,
      existing: false,
    });
  } catch (err) {
    console.error("Agreement create error:", err);
    return NextResponse.json({ error: "Failed to create agreement" }, { status: 500 });
  }
}

// ─── GET: Fetch agreement by token (public — customer-facing) ───
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    // Admin fetch by quote_id (authenticated)
    const clerkUserId = url.searchParams.get("clerk_user_id");
    const quoteId = url.searchParams.get("quote_id");

    const supabase = createSupabaseAdmin();

    if (clerkUserId && quoteId) {
      // Admin fetching agreement data for a specific quote
      const { data: admin } = await supabase
        .from("admin_users")
        .select("id")
        .eq("clerk_user_id", clerkUserId)
        .single();
      if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const { data: agreements } = await supabase
        .from("financing_agreements")
        .select("*")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false })
        .limit(5);

      return NextResponse.json({ data: agreements || [] });
    }

    // Public token-based lookup
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const { data: agreement, error } = await supabase
      .from("financing_agreements")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    // Check expiration
    if (agreement.status === "pending" || agreement.status === "viewed") {
      if (agreement.expires_at && new Date(agreement.expires_at) < new Date()) {
        // Mark as expired
        await supabase
          .from("financing_agreements")
          .update({ status: "expired" })
          .eq("id", agreement.id);
        return NextResponse.json({ error: "This agreement has expired. Please contact JHPS for a new agreement.", expired: true }, { status: 410 });
      }
    }

    // Mark as viewed on first access
    if (agreement.status === "pending") {
      await supabase
        .from("financing_agreements")
        .update({ status: "viewed", viewed_at: new Date().toISOString() })
        .eq("id", agreement.id);
      agreement.status = "viewed";
      agreement.viewed_at = new Date().toISOString();
    }

    // For public access, strip internal fields
    return NextResponse.json({
      data: {
        id: agreement.id,
        status: agreement.status,
        agreement_text: agreement.agreement_text,
        payment_schedule: agreement.payment_schedule,
        quote_snapshot: agreement.quote_snapshot,
        signer_name: agreement.signer_name,
        signer_email: agreement.signer_email,
        signer_phone: agreement.signer_phone,
        expires_at: agreement.expires_at,
        signed_at: agreement.signed_at,
      },
    });
  } catch (err) {
    console.error("Agreement fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch agreement" }, { status: 500 });
  }
}
