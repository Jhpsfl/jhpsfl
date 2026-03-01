import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase";

const getResend = () => new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = "info@jhpsfl.com";
const NOTIFY_EMAIL = "FRLawnCareFL@gmail.com"; // also notified

interface EstimatePayload {
  name: string;
  email: string;
  phone: string;
  zip: string;
  service: string;
  notes: string;
}

function buildAdminHtml(p: EstimatePayload, leadId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:28px 40px;">
      <h1 style="margin:0 0 4px;color:#fff;font-size:22px;font-weight:800;">New Estimate Request</h1>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">Submitted via jhpsfl.com</p>
    </div>
    <div style="padding:32px 40px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:10px 0;border-bottom:1px solid #e8f5e8;font-size:13px;color:#888;width:120px;">Name</td><td style="padding:10px 0;border-bottom:1px solid #e8f5e8;font-size:15px;color:#1a1a1a;font-weight:600;">${p.name}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #e8f5e8;font-size:13px;color:#888;">Email</td><td style="padding:10px 0;border-bottom:1px solid #e8f5e8;font-size:15px;color:#1a1a1a;"><a href="mailto:${p.email}" style="color:#4CAF50;">${p.email}</a></td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #e8f5e8;font-size:13px;color:#888;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #e8f5e8;font-size:15px;color:#1a1a1a;"><a href="tel:${p.phone}" style="color:#4CAF50;">${p.phone}</a></td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #e8f5e8;font-size:13px;color:#888;">Zip Code</td><td style="padding:10px 0;border-bottom:1px solid #e8f5e8;font-size:15px;color:#1a1a1a;">${p.zip}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #e8f5e8;font-size:13px;color:#888;">Service</td><td style="padding:10px 0;border-bottom:1px solid #e8f5e8;font-size:15px;color:#1a1a1a;font-weight:600;">${p.service || "Not specified"}</td></tr>
        ${p.notes ? `<tr><td style="padding:10px 0;font-size:13px;color:#888;vertical-align:top;">Notes</td><td style="padding:10px 0;font-size:15px;color:#1a1a1a;line-height:1.6;">${p.notes}</td></tr>` : ""}
      </table>
      <div style="margin-top:28px;padding:16px 20px;background:#f0faf0;border-radius:10px;border:1px solid #d4edda;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#2E7D32;letter-spacing:1px;text-transform:uppercase;">Quick Actions</p>
        <a href="tel:${p.phone}" style="display:inline-block;margin-right:12px;background:#4CAF50;color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:8px 18px;border-radius:8px;">📞 Call Now</a>
        <a href="mailto:${p.email}" style="display:inline-block;background:#2E7D32;color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:8px 18px;border-radius:8px;">✉️ Reply by Email</a>
      </div>
      <p style="margin-top:20px;font-size:12px;color:#aaa;">Lead ID: ${leadId} · View in <a href="https://jhpsfl.com/admin" style="color:#4CAF50;">Admin Dashboard</a></p>
    </div>
    <div style="background:#f9fdf9;border-top:1px solid #e8f5e8;padding:16px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#888;">JHPS Florida · jhpsfl.com</p>
    </div>
  </div>
</body>
</html>`;
}

function buildCustomerHtml(p: EstimatePayload): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:32px 40px;text-align:center;">
      <h1 style="margin:0 0 4px;color:#fff;font-size:26px;font-weight:800;">JHPS Florida</h1>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">Property Services — First Responders Lawn Care</p>
    </div>
    <div style="padding:36px 40px;">
      <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a1a;font-weight:700;">We got your request, ${p.name.split(" ")[0]}!</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.7;">
        Thank you for reaching out to JHPS Florida. We've received your estimate request for <strong>${p.service || "property services"}</strong> and we're already reviewing it.
      </p>
      <div style="background:#f0faf0;border-left:4px solid #4CAF50;border-radius:0 10px 10px 0;padding:18px 22px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#2E7D32;letter-spacing:1px;text-transform:uppercase;">What happens next</p>
        <p style="margin:0;font-size:14px;color:#333;line-height:1.7;">
          A member of our team will review your request and reach out to you within <strong>24–48 hours</strong> to schedule a walk-through or provide your estimate. If you have any urgent needs, feel free to call or text us directly.
        </p>
      </div>
      <div style="border:1px solid #e8f5e8;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:1px;text-transform:uppercase;">Your Request Summary</p>
        <p style="margin:0 0 6px;font-size:14px;color:#555;"><strong>Service:</strong> ${p.service || "General estimate"}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#555;"><strong>Zip Code:</strong> ${p.zip}</p>
        <p style="margin:0;font-size:14px;color:#555;"><strong>Contact:</strong> ${p.phone}</p>
      </div>
      <div style="text-align:center;">
        <a href="tel:4076869817" style="display:inline-block;background:linear-gradient(135deg,#4CAF50,#2E7D32);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.3px;">
          📞 (407) 686-9817
        </a>
        <p style="margin:12px 0 0;font-size:13px;color:#888;">Call or text anytime — we're local to Central Florida</p>
      </div>
    </div>
    <div style="background:#f9fdf9;border-top:1px solid #e8f5e8;padding:20px 40px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#555;font-weight:600;">JHPS Florida · First Responders Lawn Care &amp; Maintenance</p>
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Deltona · Orlando · Sanford · DeLand · Daytona Beach</p>
      <p style="margin:0;font-size:12px;color:#aaa;">
        Questions? Reply to this email or call <a href="tel:4076869817" style="color:#4CAF50;text-decoration:none;">407-686-9817</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const payload: EstimatePayload = await request.json();
    const { name, email, phone, zip, service, notes } = payload;

    if (!name || !email || !phone) {
      return NextResponse.json({ error: "Name, email, and phone are required." }, { status: 400 });
    }

    // ── 1. Save to Supabase (video_leads table, source: estimate_form) ──────────
    const supabase = createSupabaseAdmin();
    const { data: lead, error: dbError } = await supabase
      .from("video_leads")
      .insert({
        name,
        email,
        phone,
        service_requested: service || "General estimate",
        modifier_data: { source: "estimate_form", zip, notes },
        status: "new",
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("Supabase insert error:", dbError);
      // Non-fatal — still send emails even if DB write fails
    }

    const leadId = lead?.id ?? "unknown";

    // ── 2. Admin notification email ──────────────────────────────────────────────
    await getResend().emails.send({
      from: "JHPS Florida <info@jhpsfl.com>",
      to: [ADMIN_EMAIL, NOTIFY_EMAIL],
      subject: `New Estimate Request — ${name} (${service || "General"})`,
      html: buildAdminHtml(payload, leadId),
      replyTo: email,
    });

    // ── 3. Customer confirmation email ───────────────────────────────────────────
    await getResend().emails.send({
      from: "JHPS Florida <info@jhpsfl.com>",
      to: [email],
      subject: "We received your estimate request — JHPS Florida",
      html: buildCustomerHtml(payload),
      replyTo: ADMIN_EMAIL,
    });

    // ── 4. SMS placeholder ────────────────────────────────────────────────────────
    // TODO: wire in SMS when API is ready
    // await sendSms({
    //   to: OWNER_PHONE,   // e.g. "+14076869817"
    //   body: `New estimate: ${name} | ${phone} | ${service} | ${zip}`,
    // });

    return NextResponse.json({ success: true, leadId });
  } catch (err) {
    console.error("estimate route error:", err);
    return NextResponse.json({ error: "Failed to submit request. Please call us directly." }, { status: 500 });
  }
}
