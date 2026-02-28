import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { generateAgreementText, type QuoteSnapshot, type PaymentScheduleSnapshot } from "@/lib/agreement";
import crypto from "crypto";

// ─── POST: Create a new agreement (admin-initiated) ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clerk_user_id, quote_id } = body;

    if (!clerk_user_id || !quote_id) {
      return NextResponse.json({ error: "Missing clerk_user_id or quote_id" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Auth check
    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("clerk_user_id", clerk_user_id)
      .single();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Fetch the quote with customer data
    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("*, customers(name, email, phone)")
      .eq("id", quote_id)
      .single();

    if (quoteErr || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (!quote.show_financing && !quote.payment_terms) {
      return NextResponse.json({ error: "Quote does not have financing enabled" }, { status: 400 });
    }

    // Check if an active (non-expired/voided) agreement already exists
    const { data: existing } = await supabase
      .from("financing_agreements")
      .select("id, token, status")
      .eq("quote_id", quote_id)
      .in("status", ["pending", "viewed"])
      .single();

    if (existing) {
      // Return existing agreement instead of creating a new one
      const baseUrl = request.headers.get("origin") || "https://jhpsfl.com";
      return NextResponse.json({
        success: true,
        agreement_id: existing.id,
        token: existing.token,
        url: `${baseUrl}/agreement/${existing.token}`,
        existing: true,
      });
    }

    // Build the quote snapshot
    const customer = quote.customers || {};
    const paymentTerms = quote.payment_terms;
    const schedule: PaymentScheduleSnapshot[] = paymentTerms?.schedule?.map((s: { label: string; amount: number; due_date: string | null }) => ({
      label: s.label,
      amount: s.amount,
      due_date: s.due_date,
    })) || [];

    const snapshot: QuoteSnapshot = {
      quote_number: quote.quote_number,
      customer_name: customer.name || "Customer",
      customer_email: customer.email || "",
      customer_phone: customer.phone || "",
      line_items: (quote.line_items || []).map((li: { description: string; quantity: number; unit_price: number; amount: number }) => ({
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        amount: li.amount,
      })),
      subtotal: quote.subtotal,
      tax_amount: quote.tax_amount,
      total: quote.total,
      payment_terms_type: paymentTerms?.type || "deposit_balance",
      deposit_amount: paymentTerms?.deposit_amount || quote.total * 0.5,
      notes: quote.notes,
    };

    // Generate agreement text
    const agreementText = generateAgreementText(snapshot, schedule);

    // Generate secure token
    const token = crypto.randomUUID();

    // Set expiration — 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create the agreement record
    const { data: agreement, error: insertErr } = await supabase
      .from("financing_agreements")
      .insert({
        quote_id,
        customer_id: quote.customer_id || null,
        token,
        status: "pending",
        agreement_text: agreementText,
        payment_schedule: schedule,
        quote_snapshot: snapshot,
        expires_at: expiresAt.toISOString(),
        signer_name: customer.name || null,
        signer_email: customer.email || null,
        signer_phone: customer.phone || null,
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
