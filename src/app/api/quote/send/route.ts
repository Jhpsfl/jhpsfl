import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdmin } from '@/lib/supabase';
import { logEmail } from '@/lib/email';
import { generateEstimatePDF, getEstimateFilename } from '@/lib/receipt-generator';
import type { EstimateData } from '@/lib/receipt-generator';
import { randomUUID } from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

const FINANCING_MESSAGE =
  'This project is eligible for flexible payment options including deposits and installment plans. Contact us to discuss a payment schedule that works for you.';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clerk_user_id, quote, customer } = body;

  if (!clerk_user_id || !quote || !customer?.email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', clerk_user_id)
    .single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // ─── Build EstimateData for PDF generator ───
  const subtotalCents = Math.round((quote.subtotal || 0) * 100);
  const taxCents = Math.round((quote.tax_amount || 0) * 100);
  const totalCents = Math.round((quote.total || 0) * 100);

  const estimateData: EstimateData = {
    quoteNumber: quote.quote_number,
    quoteDate: new Date(quote.created_at),
    expirationDate: quote.expiration_date ? new Date(quote.expiration_date) : undefined,
    quoteStatus: quote.status === 'accepted' ? 'ACCEPTED' : 'PENDING',
    showFinancing: quote.show_financing || false,
    paymentTerms: quote.payment_terms || null,
    customerName: customer.name || 'Valued Customer',
    customerEmail: customer.email,
    customerPhone: customer.phone || undefined,
    lineItems: (quote.line_items || []).map((item: { description: string; quantity: number; unit_price: number; amount: number }) => ({
      name: item.description,
      quantity: item.quantity || 1,
      unitPrice: Math.round((item.unit_price || item.amount || 0) * 100),
      totalPrice: Math.round((item.amount || 0) * 100),
    })),
    subtotal: subtotalCents,
    taxAmount: taxCents,
    totalAmount: totalCents,
    notes: quote.notes || undefined,
  };

  // ─── Generate PDF ───
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateEstimatePDF(estimateData);
  } catch (err) {
    console.error('ESTIMATE_PDF_ERROR:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  const pdfFilename = getEstimateFilename(estimateData);
  const fmt = (n: number) => `$${(n / 100).toFixed(2)}`;

  const expirationHtml = estimateData.expirationDate
    ? `<p style="margin:4px 0;font-size:14px;"><strong>Valid Until:</strong> <span style="color:#1565C0;font-weight:bold;">${new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' }).format(estimateData.expirationDate)}</span></p>`
    : '';

  const financingHtml = quote.show_financing
    ? `<div style="margin:20px 0;padding:16px;background:#E0F2F1;border:2px solid #26A69A;border-radius:8px;">
        <p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:#00695C;">$ Flexible Payment Options Available</p>
        <p style="margin:0;font-size:13px;color:#004D40;line-height:1.5;">${FINANCING_MESSAGE}</p>
      </div>`
    : '';

  const scheduleItems: Array<{ label: string; amount: number; due_date: string | null }> =
    quote.payment_terms?.schedule || [];
  const paymentScheduleHtml = scheduleItems.length > 0
    ? `<div style="margin:20px 0;">
        <h3 style="margin:0 0 10px;font-size:15px;color:#1E3A5F;">Payment Schedule</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#EDF2F7;">
              <th style="padding:8px 12px;text-align:left;border:1px solid #CBD5E0;color:#4A5568;">Description</th>
              <th style="padding:8px 12px;text-align:center;border:1px solid #CBD5E0;color:#4A5568;">Due Date</th>
              <th style="padding:8px 12px;text-align:right;border:1px solid #CBD5E0;color:#4A5568;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${scheduleItems.map((item, i) => `
              <tr style="background:${i % 2 === 0 ? '#fff' : '#F7FAFC'};">
                <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#2D3748;">${item.label}</td>
                <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#4A5568;text-align:center;">${item.due_date ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(item.due_date)) : 'TBD'}</td>
                <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#2D3748;text-align:right;font-weight:bold;">${fmt(Math.round(item.amount * 100))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`
    : '';

  const isCommercial = quote.is_commercial || false;

  // Build short link for commercial proposal page
  let proposalShortLink = '';
  if (isCommercial && quote.public_token) {
    try {
      const { data: existing } = await supabase.from('short_links').select('code').eq('target_url', `https://jhpsfl.com/estimate/${quote.public_token}`).limit(1);
      if (existing && existing.length > 0) {
        proposalShortLink = `https://jhpsfl.com/l/${existing[0].code}`;
      } else {
        const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
        let code = ''; for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        await supabase.from('short_links').insert({ code, target_url: `https://jhpsfl.com/estimate/${quote.public_token}`, label: `Commercial Proposal: ${quote.quote_number}` });
        proposalShortLink = `https://jhpsfl.com/l/${code}`;
      }
    } catch { proposalShortLink = `https://jhpsfl.com/estimate/${quote.public_token}`; }
  }

  // Line items summary for commercial email (no prices)
  const scopeList = (quote.line_items || []).map((item: { description: string }) => item.description).join(', ');

  const html = isCommercial ? `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="background:linear-gradient(135deg,#1565C0,#0D47A1);padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Jenkins Home &amp; Property Solutions</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Commercial Services — Proposal ${estimateData.quoteNumber}</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e0e0e0;border-top:none;">
        <p style="margin:0 0 16px;font-size:15px;">Hi ${estimateData.customerName},</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
          Thank you for the opportunity to serve your property. We&apos;ve prepared a detailed commercial service proposal for your review.
        </p>
        <div style="background:#E3F2FD;border:1px solid #90CAF9;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:4px 0;font-size:14px;"><strong>Proposal #:</strong> ${estimateData.quoteNumber}</p>
          <p style="margin:4px 0;font-size:14px;"><strong>Scope:</strong> ${scopeList}</p>
          ${expirationHtml}
        </div>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#555;">
          Your proposal includes full pricing details, payment options${quote.show_financing ? ', financing arrangements' : ''}, and terms. Review everything online, request changes, or accept — all from one page.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${proposalShortLink}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#1565C0,#0D47A1);color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;">View Your Proposal →</a>
        </div>
        <div style="background:#F5F5F5;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#333;">Why Property Professionals Choose JHPS:</p>
          <p style="margin:2px 0;font-size:13px;color:#555;">✓ 24–48 hour turnover availability</p>
          <p style="margin:2px 0;font-size:13px;color:#555;">✓ Online payments &amp; recurring billing</p>
          <p style="margin:2px 0;font-size:13px;color:#555;">✓ Digital estimates with instant approvals</p>
          <p style="margin:2px 0;font-size:13px;color:#555;">✓ Multi-property management &amp; scheduling</p>
          ${quote.show_financing ? '<p style="margin:2px 0;font-size:13px;color:#555;">✓ Flexible financing for commercial projects</p>' : ''}
        </div>
        <p style="margin:20px 0 0;font-size:15px;">
          Best regards,<br/>
          <strong style="color:#1565C0;">Jenkins Home &amp; Property Solutions</strong><br/>
          <span style="font-size:13px;color:#888;">Commercial Services Division</span>
        </p>
      </div>
      <div style="background:#fafafa;padding:20px 32px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0;border-top:none;">
        <p style="margin:0 0 4px;color:#888;font-size:12px;">
          📞 <a href="tel:4076869817" style="color:#1565C0;text-decoration:none;">(407) 686-9817</a>
          &nbsp;·&nbsp;
          ✉️ <a href="mailto:info@jhpsfl.com" style="color:#1565C0;text-decoration:none;">info@jhpsfl.com</a>
          &nbsp;·&nbsp;
          🌐 <a href="https://jhpsfl.com/commercial" style="color:#1565C0;text-decoration:none;">jhpsfl.com/commercial</a>
        </p>
        <p style="margin:0;color:#aaa;font-size:11px;">Serving Deltona, Orlando, Sanford, DeLand, Daytona Beach &amp; all of Central Florida</p>
      </div>
    </div>
  ` : `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Jenkins Home &amp; Property Solutions</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Estimate ${estimateData.quoteNumber}</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e0e0e0;border-top:none;">
        <p style="margin:0 0 16px;font-size:15px;">Hi ${estimateData.customerName},</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
          Thank you for your interest! Please find your estimate for <strong>${fmt(totalCents)}</strong> attached to this email as a PDF.
        </p>
        <div style="background:#E3F2FD;border:1px solid #1565C0;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:4px 0;font-size:14px;"><strong>Estimate #:</strong> ${estimateData.quoteNumber}</p>
          <p style="margin:4px 0;font-size:14px;"><strong>Estimated Total:</strong> ${fmt(totalCents)}</p>
          ${expirationHtml}
        </div>
        ${paymentScheduleHtml}
        ${financingHtml}
        <p style="margin:24px 0 0;font-size:15px;">If you&apos;d like to proceed or have any questions, please don&apos;t hesitate to reach out.</p>
        <p style="margin:16px 0 0;font-size:15px;">
          Best regards,<br/>
          <strong style="color:#2E7D32;">Jenkins Home &amp; Property Solutions</strong>
        </p>
      </div>
      <div style="background:#fafafa;padding:20px 32px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0;border-top:none;">
        <p style="margin:0 0 4px;color:#888;font-size:12px;">
          📞 <a href="tel:4076869817" style="color:#2E7D32;text-decoration:none;">(407) 686-9817</a>
          &nbsp;·&nbsp;
          ✉️ <a href="mailto:info@jhpsfl.com" style="color:#2E7D32;text-decoration:none;">info@jhpsfl.com</a>
        </p>
        <p style="margin:0;color:#aaa;font-size:11px;">Serving Deltona, Orlando, Sanford, DeLand, Daytona Beach &amp; all of Central Florida</p>
      </div>
    </div>
  `;

  const emailSubject = isCommercial
    ? `Commercial Proposal ${estimateData.quoteNumber} — Jenkins Home & Property Solutions`
    : `Estimate ${estimateData.quoteNumber} — ${fmt(totalCents)} — Jenkins Home & Property Solutions`;

  // ─── Send via Resend ───
  const thread_id = randomUUID();
  let resendMessageId: string | undefined;
  try {
    const emailOptions: { from: string; to: string[]; subject: string; html: string; attachments?: { filename: string; content: string }[] } = {
      from: 'JHPS Florida <info@jhpsfl.com>',
      to: [customer.email],
      subject: emailSubject,
      html,
    };
    // Only attach PDF for residential estimates (commercial gets the landing page instead)
    if (!isCommercial) {
      emailOptions.attachments = [{ filename: pdfFilename, content: pdfBuffer.toString('base64') }];
    }
    const { data, error } = await resend.emails.send(emailOptions);
    if (error) {
      console.error('RESEND_ERROR:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
    resendMessageId = data?.id;
  } catch (err) {
    console.error('EMAIL_SERVICE_ERROR:', err);
    return NextResponse.json({ error: 'Email service error' }, { status: 500 });
  }

  // ─── Log to Supabase ───
  await logEmail({
    thread_id,
    direction: 'outbound',
    from_email: 'info@jhpsfl.com',
    to_email: customer.email,
    subject: emailSubject,
    body_html: html,
    resend_message_id: resendMessageId,
  });

  return NextResponse.json({ success: true, thread_id, resend_id: resendMessageId });
}
