import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const getResend = () => new Resend(process.env.RESEND_API_KEY);

interface LineItem {
  service: string;
  description?: string;
  quantity: number;
  unit_price: number;
}

interface QuoteEmailPayload {
  customer_name: string;
  customer_email: string;
  service_address: string;
  service_requested: string;
  line_items: LineItem[];
  total_low: number;
  total_high: number;
  notes_to_customer: string | null;
  valid_until: string | null;
  quote_id: string;
}

function buildEmailHtml(q: QuoteEmailPayload): string {
  const lineItemRows = q.line_items
    .map((item) => {
      const lineTotal = item.unit_price * (item.quantity || 1);
      return `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e8f5e8;color:#1a1a1a;font-size:14px;">
            <strong>${item.service}</strong>
            ${item.description ? `<br><span style="color:#555;font-size:13px;">${item.description}</span>` : ""}
          </td>
          <td style="padding:10px 16px;border-bottom:1px solid #e8f5e8;color:#555;font-size:14px;text-align:center;">${item.quantity}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e8f5e8;color:#555;font-size:14px;text-align:right;">$${item.unit_price.toFixed(2)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e8f5e8;color:#1a1a1a;font-size:14px;text-align:right;font-weight:600;">$${lineTotal.toFixed(2)}</td>
        </tr>`;
    })
    .join("");

  const validUntilText = q.valid_until
    ? `<p style="margin:0 0 8px;color:#555;font-size:14px;">
        <strong>Valid until:</strong> ${new Date(q.valid_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
       </p>`
    : "";

  const notesSection = q.notes_to_customer
    ? `
      <div style="background:#f0faf0;border-left:4px solid #4CAF50;border-radius:0 8px 8px 0;padding:16px 20px;margin:24px 0;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:1px;text-transform:uppercase;">Notes from JHPS</p>
        <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">${q.notes_to_customer}</p>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Quote from JHPS Florida</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:32px 40px;text-align:center;">
      <h1 style="margin:0 0 4px;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">JHPS Florida</h1>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;font-weight:500;">Property Services — First Responders Lawn Care</p>
    </div>

    <!-- Body -->
    <div style="padding:36px 40px;">

      <!-- Greeting -->
      <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a1a;font-weight:700;">Hi ${q.customer_name},</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
        Thank you for choosing JHPS Florida! We've reviewed your property details and prepared a customized estimate for you.
      </p>

      <!-- Service summary -->
      <div style="background:#f9fdf9;border:1px solid #d4edda;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:1px;text-transform:uppercase;">Service Details</p>
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1a1a1a;">${q.service_requested}</p>
        <p style="margin:0;font-size:13px;color:#555;">📍 ${q.service_address}</p>
      </div>

      <!-- Line items table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e8f5e8;border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:#f0faf0;">
            <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:0.8px;text-transform:uppercase;">Service</th>
            <th style="padding:10px 16px;text-align:center;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:0.8px;text-transform:uppercase;">Qty</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:0.8px;text-transform:uppercase;">Unit Price</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;font-weight:700;color:#4CAF50;letter-spacing:0.8px;text-transform:uppercase;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemRows}
        </tbody>
      </table>

      <!-- Price range -->
      <div style="background:linear-gradient(135deg,#f0faf0,#e8f5e8);border:2px solid #4CAF50;border-radius:12px;padding:20px 24px;margin-bottom:24px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#2E7D32;letter-spacing:1px;text-transform:uppercase;">Your Estimated Investment</p>
        <p style="margin:0;font-size:30px;font-weight:800;color:#1a1a1a;letter-spacing:-1px;">
          $${q.total_low.toFixed(0)} &mdash; $${q.total_high.toFixed(0)}
        </p>
        <p style="margin:6px 0 0;font-size:12px;color:#555;">Final price confirmed after on-site assessment</p>
      </div>

      ${validUntilText}
      ${notesSection}

      <!-- CTA -->
      <div style="border-top:1px solid #e8f5e8;padding-top:24px;margin-top:24px;">
        <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6;">
          Ready to move forward? Have questions about your quote? Just reply to this email or give us a call — we're happy to help.
        </p>
        <a href="tel:4076869817"
           style="display:inline-block;background:linear-gradient(135deg,#4CAF50,#2E7D32);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.3px;">
          📞 Call (407) 686-9817
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#f9fdf9;border-top:1px solid #e8f5e8;padding:20px 40px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#555;font-weight:600;">JHPS Florida · First Responders Lawn Care &amp; Maintenance</p>
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Deltona, Orlando, Sanford, DeLand, Daytona Beach</p>
      <p style="margin:0;font-size:12px;color:#aaa;">
        Questions? Reply to this email or call
        <a href="tel:4076869817" style="color:#4CAF50;text-decoration:none;">407-686-9817</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

/**
 * POST /api/leads/send-quote-email
 * Internal utility — called by the send_quote action in /api/leads/route.ts
 */
export async function POST(request: NextRequest) {
  try {
    const payload: QuoteEmailPayload = await request.json();

    const { customer_name, customer_email, quote_id } = payload;
    if (!customer_email || !customer_name || !quote_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const html = buildEmailHtml(payload);

    const { data, error } = await getResend().emails.send({
      from: "JHPS Florida <info@jhpsfl.com>",
      to: [customer_email],
      subject: `Your Quote from JHPS Florida — ${payload.service_requested}`,
      html,
      replyTo: "info@jhpsfl.com",
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, emailId: data?.id });
  } catch (err) {
    console.error("send-quote-email error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
