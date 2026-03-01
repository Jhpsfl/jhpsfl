import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase";

const getResend = () => new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = "info@jhpsfl.com";
const NOTIFY_EMAIL = "FRLawnCareFL@gmail.com";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, rating, comment, google_review_clicked, resolution_requested, lost_estimate_reason, lost_estimate_detail } = body;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  // Look up the feedback request
  const { data: fbReq, error: fbErr } = await supabase
    .from("feedback_requests")
    .select("*, customers(name, email, phone, company_name)")
    .eq("token", token)
    .single();

  if (fbErr || !fbReq) {
    return NextResponse.json({ error: "Invalid or expired feedback link" }, { status: 404 });
  }

  if (fbReq.status === "responded") {
    return NextResponse.json({ error: "Feedback already submitted" }, { status: 409 });
  }

  // Insert response
  const { error: respErr } = await supabase
    .from("feedback_responses")
    .insert({
      feedback_request_id: fbReq.id,
      customer_id: fbReq.customer_id,
      rating: rating || null,
      comment: comment || null,
      google_review_clicked: google_review_clicked || false,
      resolution_requested: resolution_requested || false,
      lost_estimate_reason: lost_estimate_reason || null,
      lost_estimate_detail: lost_estimate_detail || null,
    });

  if (respErr) {
    console.error("FEEDBACK_RESPONSE_INSERT_ERROR:", respErr);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  // Mark request as responded
  await supabase
    .from("feedback_requests")
    .update({ status: "responded", responded_at: new Date().toISOString() })
    .eq("id", fbReq.id);

  // ─── Admin alert for negative feedback or lost estimates ───
  const customerName = (fbReq.customers as { name: string | null })?.name || "A customer";
  const needsAlert =
    (fbReq.type === "post_service" && (rating && rating <= 3 || resolution_requested)) ||
    fbReq.type === "lost_estimate";

  if (needsAlert) {
    try {
      const alertSubject = fbReq.type === "post_service"
        ? `⚠️ Customer Feedback Alert — ${customerName} (${rating}★)`
        : `📊 Lost Estimate Feedback — ${customerName}`;

      const alertHtml = fbReq.type === "post_service"
        ? buildNegativeFeedbackAlert(customerName, rating, comment, resolution_requested)
        : buildLostEstimateAlert(customerName, lost_estimate_reason, lost_estimate_detail);

      await getResend().emails.send({
        from: "JHPS Florida <info@jhpsfl.com>",
        to: [ADMIN_EMAIL, NOTIFY_EMAIL],
        subject: alertSubject,
        html: alertHtml,
      });
    } catch (err) {
      console.error("ADMIN_ALERT_EMAIL_ERROR:", err);
      // Don't fail the response just because the alert didn't send
    }
  }

  // Also alert for positive feedback (5 stars) so you know who's happy
  if (fbReq.type === "post_service" && rating && rating >= 4) {
    try {
      await getResend().emails.send({
        from: "JHPS Florida <info@jhpsfl.com>",
        to: [ADMIN_EMAIL, NOTIFY_EMAIL],
        subject: `⭐ Great Feedback — ${customerName} (${rating}★)`,
        html: buildPositiveFeedbackAlert(customerName, rating, comment),
      });
    } catch (err) {
      console.error("POSITIVE_ALERT_ERROR:", err);
    }
  }

  return NextResponse.json({ success: true });
}

// ─── Admin Alert: Negative Feedback ──────────────────────────
function buildNegativeFeedbackAlert(name: string, rating: number | null, comment: string | null, resolution: boolean): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#C62828,#E53935);padding:28px 40px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">⚠️</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Customer Needs Attention</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 20px;">
        <strong>${name}</strong> submitted feedback that may need follow-up.
      </p>
      <div style="background:#FFF3E0;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #FFE0B2;">
        <table style="width:100%;border-collapse:collapse;">
          ${rating ? `<tr><td style="padding:8px 0;font-size:13px;color:#666;width:120px;">Rating</td><td style="padding:8px 0;font-size:15px;color:#E65100;font-weight:700;">${"★".repeat(rating)}${"☆".repeat(5 - rating)} (${rating}/5)</td></tr>` : ""}
          ${comment ? `<tr><td style="padding:8px 0;font-size:13px;color:#666;vertical-align:top;">Comment</td><td style="padding:8px 0;font-size:14px;color:#333;line-height:1.5;">"${comment}"</td></tr>` : ""}
          <tr><td style="padding:8px 0;font-size:13px;color:#666;">Resolution</td><td style="padding:8px 0;font-size:14px;color:${resolution ? "#C62828" : "#666"};font-weight:${resolution ? "700" : "400"};">${resolution ? "YES — Customer expects follow-up" : "Not requested"}</td></tr>
        </table>
      </div>
      ${resolution ? `<p style="font-size:14px;color:#C62828;font-weight:600;background:#FFEBEE;padding:12px 16px;border-radius:8px;margin:0 0 20px;">⏰ This customer was told we would reach out within 24 hours.</p>` : ""}
      <div style="text-align:center;">
        <a href="https://jhpsfl.com/admin" style="display:inline-block;background:linear-gradient(135deg,#4CAF50,#2E7D32);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">Open Admin Dashboard</a>
      </div>
    </div>
  </div>
</body></html>`;
}

// ─── Admin Alert: Positive Feedback ──────────────────────────
function buildPositiveFeedbackAlert(name: string, rating: number, comment: string | null): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:28px 40px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">⭐</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Great Feedback Received!</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 20px;">
        <strong>${name}</strong> left a <strong>${rating}-star</strong> rating!
      </p>
      <div style="background:#E8F5E9;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #C8E6C9;">
        <p style="margin:0 0 8px;font-size:24px;text-align:center;">${"⭐".repeat(rating)}</p>
        ${comment ? `<p style="margin:8px 0 0;font-size:14px;color:#333;text-align:center;font-style:italic;line-height:1.5;">"${comment}"</p>` : ""}
      </div>
      <p style="font-size:13px;color:#888;text-align:center;">They were also shown a link to leave a Google review.</p>
    </div>
  </div>
</body></html>`;
}

// ─── Admin Alert: Lost Estimate Feedback ─────────────────────
function buildLostEstimateAlert(name: string, reason: string | null, detail: string | null): string {
  const reasonLabels: Record<string, string> = {
    price: "💰 Pricing didn't fit their budget",
    timing: "📅 Went with someone who could start sooner",
    postponed: "⏸️ Decided to postpone / not do the project",
    reviews: "⭐ Chose a company with more reviews / references",
    proposal: "📋 Other company's proposal was more detailed",
    other: "❓ Other reason",
  };

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1565C0,#0D47A1);padding:28px 40px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">📊</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Lost Estimate Insight</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 20px;">
        <strong>${name}</strong> responded to the lost estimate follow-up.
      </p>
      <div style="background:#E3F2FD;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #90CAF9;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#666;width:100px;">Reason</td>
            <td style="padding:8px 0;font-size:15px;color:#1565C0;font-weight:600;">${reason ? (reasonLabels[reason] || reason) : "Not specified"}</td>
          </tr>
          ${detail ? `<tr><td style="padding:8px 0;font-size:13px;color:#666;vertical-align:top;">Details</td><td style="padding:8px 0;font-size:14px;color:#333;line-height:1.5;">"${detail}"</td></tr>` : ""}
        </table>
      </div>
      <p style="font-size:13px;color:#888;text-align:center;">Use this insight to refine your bidding and presentation process.</p>
    </div>
  </div>
</body></html>`;
}
