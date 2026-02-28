import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = "info@jhpsfl.com";
const NOTIFY_EMAIL = "FRLawnCareFL@gmail.com";

export async function POST(request: NextRequest) {
  try {
    const { signer_name, quote_number, total } = await request.json();

    const formattedTotal = total
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)
      : "N/A";

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:28px 40px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">✍️</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Financing Agreement Signed!</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 20px;">
        Great news — <strong>${signer_name || "A customer"}</strong> has signed the financing agreement for estimate <strong>${quote_number || "N/A"}</strong>.
      </p>
      <div style="background:#f0faf0;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #d4edda;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#666;width:120px;">Customer</td>
            <td style="padding:8px 0;font-size:15px;color:#1a1a1a;font-weight:600;">${signer_name || "—"}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#666;">Estimate</td>
            <td style="padding:8px 0;font-size:15px;color:#1a1a1a;font-weight:600;">${quote_number || "—"}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#666;">Total</td>
            <td style="padding:8px 0;font-size:15px;color:#2E7D32;font-weight:700;">${formattedTotal}</td>
          </tr>
        </table>
      </div>
      <div style="text-align:center;">
        <a href="https://jhpsfl.com/admin" style="display:inline-block;background:linear-gradient(135deg,#4CAF50,#2E7D32);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">
          View in Admin Dashboard
        </a>
      </div>
      <p style="margin-top:20px;font-size:12px;color:#aaa;text-align:center;">
        The signed agreement, signature, and ID documents are available in the admin dashboard.
      </p>
    </div>
  </div>
</body>
</html>`;

    await resend.emails.send({
      from: "JHPS Florida <info@jhpsfl.com>",
      to: [ADMIN_EMAIL, NOTIFY_EMAIL],
      subject: `✍️ Agreement Signed — ${signer_name || "Customer"} (${quote_number || "Estimate"})`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Agreement notify error:", err);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
