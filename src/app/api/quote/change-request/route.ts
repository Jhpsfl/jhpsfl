import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";

const getResend = () => new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { token, message, customer_name, customer_email } = await req.json();
    if (!token || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: quote } = await supabase
      .from("quotes")
      .select("id, quote_number")
      .eq("public_token", token)
      .single();

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Send notification email to admin
    await getResend().emails.send({
      from: "JHPS Florida <info@jhpsfl.com>",
      to: ["info@jhpsfl.com"],
      subject: `Change Request — Estimate ${quote.quote_number} from ${customer_name || "Customer"}`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#F57C00;padding:20px 24px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;color:#fff;">✏️ Change Request</h2>
          </div>
          <div style="background:#fff;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
            <p><strong>Estimate:</strong> ${quote.quote_number}</p>
            <p><strong>Customer:</strong> ${customer_name || "Unknown"} (${customer_email || "no email"})</p>
            <div style="margin:16px 0;padding:16px;background:#FFF3E0;border:1px solid #FFB74D;border-radius:8px;">
              <p style="margin:0;white-space:pre-wrap;">${message}</p>
            </div>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Change request error:", err);
    return NextResponse.json({ error: "Failed to send change request" }, { status: 500 });
  }
}
