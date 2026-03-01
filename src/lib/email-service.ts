/**
 * JHPS Email Service — Send Invoice & Receipt PDFs via Resend
 * ─────────────────────────────────────────────────────────────
 * Sends branded emails with PDF attachments using Resend
 * (already configured on this project — no extra env vars needed).
 *
 * USAGE:
 *   import { sendReceiptEmail, sendInvoiceEmail } from '@/lib/email-service';
 *   await sendReceiptEmail(receiptData, pdfBuffer);
 *
 * FILE LOCATION: src/lib/email-service.ts
 * ─────────────────────────────────────────────────────────────
 */

import { Resend } from 'resend';
import type { ReceiptData, InvoiceData } from './receipt-generator';
import { getReceiptFilename, getInvoiceFilename } from './receipt-generator';

const getResend = () => new Resend(process.env.RESEND_API_KEY);
const FROM = 'JHPS Florida <info@jhpsfl.com>';

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Receipt Email ───────────────────────────────────────────

export async function sendReceiptEmail(
  data: ReceiptData,
  pdfBuffer: Buffer
): Promise<void> {
  const filename = getReceiptFilename(data);

  await getResend().emails.send({
    from: FROM,
    to: [data.customerEmail],
    subject: `JHPS Payment Receipt — ${fmt(data.totalAmount)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: #1B5E20; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Jenkins Home &amp; Property Solutions</h1>
        </div>
        <div style="padding: 30px 24px;">
          <h2 style="color: #1B5E20; margin-top: 0;">Payment Received ✓</h2>
          <p>Hi ${data.customerName},</p>
          <p>Thank you for your payment of <strong>${fmt(data.totalAmount)}</strong>. Your receipt is attached to this email as a PDF.</p>
          <div style="background: #E8F5E9; border: 1px solid #2E7D32; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Reference:</strong> ${data.paymentId}</p>
            <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #2E7D32; font-weight: bold;">PAID</span></p>
            ${data.paymentMethod ? `<p style="margin: 4px 0;"><strong>Method:</strong> ${data.paymentMethod}</p>` : ''}
          </div>
          <p>If you have any questions, don't hesitate to reach out!</p>
          <p style="margin-top: 24px;">
            Best regards,<br/>
            <strong>Jenkins Home &amp; Property Solutions</strong><br/>
            <span style="color: #666;">(407) 686-9817 · info@jhpsfl.com · jhpsfl.com</span>
          </p>
        </div>
        <div style="background: #f5f5f5; padding: 16px; text-align: center; font-size: 12px; color: #999;">
          Reliable &amp; Insured · Central Florida
        </div>
      </div>
    `,
    attachments: [
      {
        filename,
        content: pdfBuffer.toString('base64'),
      },
    ],
  });
}

// ─── Invoice Email ───────────────────────────────────────────

export async function sendInvoiceEmail(
  data: InvoiceData,
  pdfBuffer: Buffer
): Promise<void> {
  const filename = getInvoiceFilename(data);
  const isOverdue = data.invoiceStatus === 'OVERDUE';
  const statusColor = isOverdue ? '#C62828' : '#1565C0';
  const statusLabel = isOverdue ? 'OVERDUE' : 'DUE';

  const dueDateStr = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York',
  }).format(data.dueDate);

  await getResend().emails.send({
    from: FROM,
    to: [data.customerEmail],
    subject: `JHPS Invoice ${data.invoiceNumber} — ${fmt(data.totalAmount)} ${statusLabel}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: #1B5E20; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Jenkins Home &amp; Property Solutions</h1>
        </div>
        <div style="padding: 30px 24px;">
          <h2 style="color: #1B5E20; margin-top: 0;">Invoice ${data.invoiceNumber}</h2>
          <p>Hi ${data.customerName},</p>
          <p>Please find your invoice for <strong>${fmt(data.totalAmount)}</strong> attached to this email.</p>
          <div style="background: ${isOverdue ? '#FFEBEE' : '#FFF3E0'}; border: 1px solid ${statusColor}; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Invoice #:</strong> ${data.invoiceNumber}</p>
            <p style="margin: 4px 0;"><strong>Amount:</strong> ${fmt(data.totalAmount)}</p>
            <p style="margin: 4px 0;"><strong>Due Date:</strong> <span style="color: ${statusColor}; font-weight: bold;">${dueDateStr}</span></p>
          </div>
          ${data.paymentLink ? `
            <div style="text-align: center; margin: 24px 0;">
              <a href="${data.paymentLink}" style="background: #1B5E20; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Pay Now →</a>
            </div>
            <p style="text-align: center; font-size: 12px; color: #999;">Or copy this link: ${data.paymentLink}</p>
          ` : ''}
          <p>If you have any questions about this invoice, please reach out.</p>
          <p style="margin-top: 24px;">
            Best regards,<br/>
            <strong>Jenkins Home &amp; Property Solutions</strong><br/>
            <span style="color: #666;">(407) 686-9817 · info@jhpsfl.com · jhpsfl.com</span>
          </p>
        </div>
        <div style="background: #f5f5f5; padding: 16px; text-align: center; font-size: 12px; color: #999;">
          Reliable &amp; Insured · Central Florida
        </div>
      </div>
    `,
    attachments: [
      {
        filename,
        content: pdfBuffer.toString('base64'),
      },
    ],
  });
}
