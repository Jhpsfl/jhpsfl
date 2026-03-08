import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase";
import { logEmail } from "@/lib/email";
import { randomUUID } from "crypto";
import { auth } from '@clerk/nextjs/server';

const getResend = () => new Resend(process.env.RESEND_API_KEY);
const FROM = "JHPS Florida <info@jhpsfl.com>";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://jhpsfl.com";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { customer_id, type } = body;

  if (!customer_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  // Auth check
  const { data: admin } = await supabase
    .from("admin_users")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get customer
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, name, email, phone, customer_type, company_name")
    .eq("id", customer_id)
    .single();
  if (custErr || !customer?.email) {
    return NextResponse.json({ error: "Customer not found or missing email" }, { status: 404 });
  }

  const feedbackType = type === "lost_estimate" ? "lost_estimate" : "post_service";

  // Check for recent duplicate (don't spam same customer within 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("feedback_requests")
    .select("id")
    .eq("customer_id", customer_id)
    .eq("type", feedbackType)
    .gte("sent_at", sevenDaysAgo)
    .limit(1);
  if (recent && recent.length > 0) {
    return NextResponse.json({ error: "Feedback already requested within the last 7 days" }, { status: 409 });
  }

  // Create feedback request
  const { data: fbReq, error: fbErr } = await supabase
    .from("feedback_requests")
    .insert({
      customer_id: customer.id,
      job_id: body.job_id || null,
      quote_id: body.quote_id || null,
      type: feedbackType,
    })
    .select()
    .single();
  if (fbErr || !fbReq) {
    console.error("FEEDBACK_INSERT_ERROR:", fbErr);
    return NextResponse.json({ error: "Failed to create feedback request" }, { status: 500 });
  }

  // Create short link
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  const targetUrl = `${BASE_URL}/feedback/${fbReq.token}`;
  await supabase.from("short_links").insert({
    code,
    target_url: targetUrl,
    label: `Feedback: ${customer.name || customer.email}`,
  });
  const shortUrl = `${BASE_URL}/l/${code}`;

  const customerName = customer.name || "Valued Customer";
  const firstName = customerName.split(" ")[0];

  // Build email based on type
  let subject: string;
  let html: string;

  if (feedbackType === "post_service") {
    subject = `How did we do? — Jenkins Home & Property Solutions`;
    html = buildPostServiceEmail(firstName, shortUrl);
  } else {
    subject = `Thank you for considering JHPS`;
    html = buildLostEstimateEmail(firstName, shortUrl);
  }

  // Send via Resend
  const thread_id = randomUUID();
  let resendMessageId: string | undefined;
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM,
      to: [customer.email],
      subject,
      html,
    });
    if (error) {
      console.error("RESEND_ERROR:", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }
    resendMessageId = data?.id;
  } catch (err) {
    console.error("EMAIL_SERVICE_ERROR:", err);
    return NextResponse.json({ error: "Email service error" }, { status: 500 });
  }

  // Log to email system
  await logEmail({
    thread_id,
    direction: "outbound",
    from_email: "info@jhpsfl.com",
    to_email: customer.email,
    subject,
    body_html: html,
    resend_message_id: resendMessageId,
  });

  return NextResponse.json({
    success: true,
    feedback_request_id: fbReq.id,
    token: fbReq.token,
    short_url: shortUrl,
    resend_id: resendMessageId,
  });
}

// ─── Post-Service Feedback Email ─────────────────────────────
function buildPostServiceEmail(firstName: string, feedbackUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:28px 32px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Jenkins Home &amp; Property Solutions</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">We&rsquo;d love to hear how we did</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:32px;">
            <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">
              Hi ${firstName},
            </p>
            <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.7;">
              Thank you for choosing Jenkins Home &amp; Property Solutions! We take pride in every job we do, and your feedback helps us continue to improve.
            </p>
            <p style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.7;">
              Would you mind taking 30 seconds to let us know how your experience was? It truly means the world to us.
            </p>

            <!-- CTA Button -->
            <div style="text-align:center;margin:28px 0;">
              <a href="${feedbackUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#4CAF50,#2E7D32);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px;letter-spacing:0.3px;">Share Your Feedback</a>
            </div>

            <p style="margin:24px 0 0;color:#888;font-size:13px;text-align:center;line-height:1.5;">
              Your honest feedback helps us serve you and our community better.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;padding:20px 32px;border-radius:0 0 12px 12px;border-top:1px solid #eee;">
            <p style="margin:0 0 4px;color:#888;font-size:12px;text-align:center;">
              📞 <a href="tel:4076869817" style="color:#2E7D32;text-decoration:none;">(407) 686-9817</a>
              &nbsp;&middot;&nbsp;
              ✉️ <a href="mailto:info@jhpsfl.com" style="color:#2E7D32;text-decoration:none;">info@jhpsfl.com</a>
            </p>
            <p style="margin:0;color:#aaa;font-size:11px;text-align:center;">
              Serving Deltona, Orlando, Sanford, DeLand, Daytona Beach &amp; all of Central Florida
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Lost Estimate Follow-Up Email ───────────────────────────
function buildLostEstimateEmail(firstName: string, feedbackUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:28px 32px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Jenkins Home &amp; Property Solutions</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Central Florida&rsquo;s Trusted Property Services</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:32px;">
            <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">
              Hi ${firstName},
            </p>
            <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.7;">
              Thank you for giving us the opportunity to provide an estimate for your project. We genuinely appreciate you taking the time to meet with us.
            </p>
            <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.7;">
              Whether you went in a different direction or decided to hold off for now, we completely understand. We&rsquo;re always looking to improve, and we&rsquo;d be grateful if you could take a quick moment to share what factored into your decision.
            </p>
            <p style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.7;">
              It&rsquo;s just one quick click &mdash; no forms to fill out:
            </p>

            <!-- CTA Button -->
            <div style="text-align:center;margin:28px 0;">
              <a href="${feedbackUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#4CAF50,#2E7D32);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px;letter-spacing:0.3px;">Quick Feedback (30 seconds)</a>
            </div>

            <p style="margin:20px 0 0;color:#333;font-size:15px;line-height:1.7;">
              Either way, we wish you the best with your project. If your plans change or you need anything in the future, we&rsquo;d love the chance to earn your business.
            </p>

            <p style="margin:24px 0 0;color:#333;font-size:15px;line-height:1.6;">
              Warm regards,<br/>
              <strong style="color:#2E7D32;">Jenkins Home &amp; Property Solutions</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;padding:20px 32px;border-radius:0 0 12px 12px;border-top:1px solid #eee;">
            <p style="margin:0 0 4px;color:#888;font-size:12px;text-align:center;">
              📞 <a href="tel:4076869817" style="color:#2E7D32;text-decoration:none;">(407) 686-9817</a>
              &nbsp;&middot;&nbsp;
              ✉️ <a href="mailto:info@jhpsfl.com" style="color:#2E7D32;text-decoration:none;">info@jhpsfl.com</a>
            </p>
            <p style="margin:0;color:#aaa;font-size:11px;text-align:center;">
              Serving Deltona, Orlando, Sanford, DeLand, Daytona Beach &amp; all of Central Florida
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
