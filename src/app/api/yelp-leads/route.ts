import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";
import { Resend } from "resend";

async function verifyAdmin(clerkUserId: string) {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("admin_users")
    .select("id, role")
    .eq("clerk_user_id", clerkUserId)
    .single();
  return data as { id: string; role: string } | null;
}

// GET — list conversations or get single conversation
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await verifyAdmin(userId);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const status = searchParams.get("status");

  // Single conversation
  if (id) {
    const { data, error } = await supabase
      .from("yelp_conversations")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // List all conversations
  let query = supabase
    .from("yelp_conversations")
    .select("id, customer_name, services, zip_code, urgency, status, ai_exchange_count, messages, thread_href, last_customer_message_at, last_ai_reply_at, created_at, project_details")
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// PATCH — update conversation status or send manual reply
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await verifyAdmin(userId);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createSupabaseAdmin();
  const body = await req.json();
  const { id, action, message } = body as { id: string; action: string; message?: string };

  if (!id || !action) {
    return NextResponse.json({ error: "id and action required" }, { status: 400 });
  }

  // Get current conversation
  const { data: conv, error: fetchErr } = await supabase
    .from("yelp_conversations")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (action === "take_over") {
    const { error } = await supabase
      .from("yelp_conversations")
      .update({ status: "taken_over", taken_over_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "taken_over" });
  }

  if (action === "resume_ai") {
    const { error } = await supabase
      .from("yelp_conversations")
      .update({ status: "ai_active", taken_over_at: null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "ai_active" });
  }

  if (action === "complete") {
    const { error } = await supabase
      .from("yelp_conversations")
      .update({ status: "completed" })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "completed" });
  }

  if (action === "send_reply") {
    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Append message to conversation
    const messages = conv.messages || [];
    messages.push({ role: "admin", text: message.trim(), ts: new Date().toISOString() });

    const { error: updateErr } = await supabase
      .from("yelp_conversations")
      .update({
        messages,
        status: "taken_over",
        taken_over_at: conv.taken_over_at || new Date().toISOString(),
      })
      .eq("id", id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Fast path: send via email if we have the Yelp masked email
    let sentViaEmail = false;
    if (conv.yelp_masked_email) {
      try {
        const resend = new Resend(process.env.RESEND_FULL_KEY || process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Jenkins Home & Property Solutions <info@jhpsfl.com>",
          to: [conv.yelp_masked_email],
          subject: `Re: ${conv.customer_name} - JHPS`,
          text: message.trim(),
        });
        sentViaEmail = true;
      } catch (emailErr) {
        console.error("Email fast path failed, falling back to trigger:", emailErr);
      }
    }

    // Fallback: create a trigger for the local Puppeteer agent
    if (!sentViaEmail) {
      const { error: triggerErr } = await supabase
        .from("yelp_triggers")
        .insert({
          trigger_type: "manual_reply",
          lead_id: conv.yelp_thread_id,
          thread_id: conv.yelp_thread_id,
          customer_name: conv.customer_name,
          service: (conv.services || []).join(", "),
          email_body_text: message.trim(),
          status: "pending",
        });
      if (triggerErr) {
        console.error("Failed to create trigger:", triggerErr);
      }
    }

    return NextResponse.json({ ok: true, messages, sentViaEmail });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
