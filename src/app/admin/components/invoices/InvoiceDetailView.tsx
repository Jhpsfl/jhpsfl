"use client";

import React from "react";
import type { Invoice, PaymentScheduleItem } from "./invoiceTypes";
import { formatCurrency, formatDate } from "./invoiceHelpers";
import InvoiceStatusBadge from "./InvoiceStatusBadge";
import { IconSend, IconCopy, IconEdit, IconTrash, IconBack } from "./InvoiceIcons";
import PaymentScheduleView from "./PaymentScheduleView";

export default function InvoiceDetailView({ invoice, isMobile, copiedLink, onBack, onSend, onCopyLink, onMarkPaid, onEdit, onDelete, onNavigate, onRecordPayment, onPreviewPdf, onUpdateSettings }: {
  invoice: Invoice;
  isMobile: boolean;
  copiedLink: boolean;
  onBack: () => void;
  onSend: () => void;
  onCopyLink: (inv: Invoice) => void;
  onMarkPaid: (inv: Invoice) => void;
  onEdit: (inv: Invoice) => void;
  onDelete: (inv: Invoice) => void;
  onNavigate?: () => void;
  onRecordPayment?: (scheduleItem: PaymentScheduleItem) => void;
  onPreviewPdf?: () => void;
  onUpdateSettings?: (settings: Record<string, unknown>) => void;
}) {
  const hasPaymentTerms = invoice.payment_terms && invoice.payment_terms.type !== "full";

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "1px solid #1a3a1a", borderRadius: 10, padding: "8px 14px",
            color: "#5a8a5a", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <IconBack /> Back
        </button>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#e8f5e8", fontWeight: 700, flex: 1 }}>
          Invoice {invoice.invoice_number}
        </h1>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 24, alignItems: "start" }}>
        {/* Left: Invoice details */}
        <div style={{ order: isMobile ? 1 : 0 }}>
          <div style={{
            background: "linear-gradient(160deg, #0d1f0d, #091409)",
            border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px 24px",
          }}>
            {/* Business header */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #1a3a1a" }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#4CAF50", marginBottom: 4 }}>
                  Jenkins Home & Property Solutions
                </div>
                <div style={{ fontSize: 12, color: "#5a8a5a", lineHeight: 1.8 }}>
                  Central Florida<br />
                  📞 407-686-9817<br />
                  ✉️ Info@jhpsfl.com
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#e8f5e8", fontFamily: "'Playfair Display', serif" }}>INVOICE</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
                  {invoice.invoice_number}
                </div>
                <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 8 }}>
                  Date: {formatDate(invoice.created_at)}
                  {invoice.due_date && <><br />Due: {formatDate(invoice.due_date)}</>}
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Bill To</div>
              {invoice.customer_id ? (
                <>
                  <div style={{ fontSize: 15, color: "#c8e0c8", fontWeight: 600 }}>
                    {invoice.customers?.name || "—"}
                  </div>
                  {invoice.customers?.email && (
                    <div style={{ fontSize: 13, color: "#5a8a5a" }}>{invoice.customers.email}</div>
                  )}
                  {invoice.customers?.phone && (
                    <div style={{ fontSize: 13, color: "#5a8a5a" }}>{invoice.customers.phone}</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#64b5f6", fontWeight: 600 }}>
                  🔗 Link Only — recipient fills in their info at payment
                </div>
              )}
            </div>

            {/* Line items table */}
            <div style={{ borderRadius: 12, border: "1px solid #1a3a1a", overflow: "hidden", marginBottom: 20 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#0a160a" }}>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Description</th>
                    <th style={{ padding: "12px 14px", textAlign: "center", fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", width: 60 }}>Qty</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", width: 100 }}>Rate</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", width: 100 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.line_items || []).map((item, idx) => (
                    <tr key={idx} style={{ borderTop: "1px solid #0d1a0d" }}>
                      <td style={{ padding: "12px 14px", fontSize: 14, color: "#c8e0c8" }}>{item.description}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: "#8aba8a", textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}>{item.quantity}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: "#8aba8a", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(item.unit_price)}</td>
                      <td style={{ padding: "12px 14px", fontSize: 14, color: "#4CAF50", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ width: 260 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "#8aba8a" }}>
                  <span>Subtotal</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.tax_rate > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "#8aba8a" }}>
                    <span>Tax ({invoice.tax_rate}%)</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(invoice.tax_amount)}</span>
                  </div>
                )}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  padding: "12px 0", borderTop: "2px solid #1a3a1a", marginTop: 4,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#e8f5e8" }}>Total</span>
                  <span style={{ fontSize: 26, fontWeight: 800, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatCurrency(invoice.total)}
                  </span>
                </div>
                {(invoice.status === "paid" || invoice.amount_paid > 0) && (
                  <div style={{
                    display: "flex", justifyContent: "space-between", padding: "8px 0",
                    fontSize: 13, color: "#66bb6a", fontWeight: 600,
                  }}>
                    <span>Paid</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(invoice.amount_paid)}</span>
                  </div>
                )}
                {invoice.amount_paid > 0 && invoice.amount_paid < invoice.total && (
                  <div style={{
                    display: "flex", justifyContent: "space-between", padding: "8px 0",
                    fontSize: 13, color: "#ef9a9a", fontWeight: 600,
                  }}>
                    <span>Balance</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(invoice.total - invoice.amount_paid)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #1a3a1a" }}>
                <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Notes</div>
                <div style={{ fontSize: 13, color: "#8aba8a", lineHeight: 1.6 }}>{invoice.notes}</div>
              </div>
            )}
          </div>

          {/* Payment Schedule (below the invoice card) */}
          {hasPaymentTerms && invoice.payment_terms && (
            <PaymentScheduleView
              terms={invoice.payment_terms}
              total={invoice.total}
              onRecordPayment={onRecordPayment}
            />
          )}
        </div>

        {/* Right: Actions sidebar */}
        <div style={{
          background: "linear-gradient(160deg, #0d1f0d, #091409)",
          border: "1px solid #1a3a1a", borderRadius: 20, padding: "24px 20px",
          position: isMobile ? "static" : "sticky", top: 80,
          order: isMobile ? 0 : 1,
        }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#e8f5e8", fontWeight: 700, marginBottom: 20 }}>
            Actions
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {["draft", "sent", "overdue", "partial"].includes(invoice.status) && (
              <button
                onClick={() => { onNavigate?.(); onSend(); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 4px 20px rgba(76,175,80,0.35)",
                }}
              >
                <IconSend /> {invoice.status === "draft" ? "Send Invoice" : "Resend Invoice"}
              </button>
            )}

            {onPreviewPdf && (
              <button
                onClick={onPreviewPdf}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: 12,
                  border: "1px solid rgba(66,165,245,0.3)",
                  background: "rgba(13,71,161,0.12)", color: "#42a5f5",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Preview PDF
              </button>
            )}

            {invoice.status !== "paid" && (
              <button
                onClick={() => onCopyLink(invoice)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: 12,
                  border: !invoice.customer_id ? "none" : "1px solid rgba(33,150,243,0.3)",
                  background: !invoice.customer_id ? "linear-gradient(135deg, #1e88e5, #1565c0)" : "rgba(33,150,243,0.08)",
                  color: !invoice.customer_id ? "#fff" : "#42a5f5",
                  fontSize: !invoice.customer_id ? 14 : 13,
                  fontWeight: !invoice.customer_id ? 700 : 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  ...((!invoice.customer_id) ? { boxShadow: "0 4px 20px rgba(33,150,243,0.35)" } : {}),
                }}
              >
                <IconCopy /> {copiedLink ? "Copied!" : (!invoice.customer_id ? "Copy Payment Link" : "Copy Payment Link (for SMS)")}
              </button>
            )}
            {!invoice.customer_id && invoice.status !== "paid" && (
              <p style={{ fontSize: 12, color: "#5a8a8a", textAlign: "center", lineHeight: 1.5 }}>
                Send this link to anyone — they&apos;ll enter their info and pay. A customer profile will be created automatically.
              </p>
            )}

            {["sent", "overdue", "partial"].includes(invoice.status) && !hasPaymentTerms && (
              <button
                onClick={() => onMarkPaid(invoice)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: 12,
                  border: "1px solid rgba(76,175,80,0.3)",
                  background: "rgba(76,175,80,0.08)", color: "#66bb6a",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ✓ Mark as Paid
              </button>
            )}

            {["draft", "sent"].includes(invoice.status) && (
              <button
                onClick={() => onEdit(invoice)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: 12,
                  border: "1px solid #1a3a1a", background: "transparent",
                  color: "#8aba8a", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <IconEdit /> Edit Invoice
              </button>
            )}

            <button
              onClick={() => onDelete(invoice)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px", borderRadius: 12,
                border: "1px solid rgba(239,83,80,0.2)", background: "transparent",
                color: "#ef5350", fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <IconTrash /> Delete Invoice
            </button>
          </div>

          {/* Payment terms badge in sidebar */}
          {hasPaymentTerms && invoice.payment_terms && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #1a3a1a" }}>
              <div style={{
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(255,183,77,0.04)", border: "1px solid rgba(255,183,77,0.12)",
              }}>
                <div style={{ fontSize: 10, color: "#ffb74d", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                  💳 {invoice.payment_terms.type === "deposit_balance" ? "Deposit + Balance" : "Installment Plan"}
                </div>
                <div style={{ fontSize: 13, color: "#c8e0c8" }}>
                  Deposit: <strong style={{ color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(invoice.payment_terms.deposit_amount)}</strong>
                </div>
                <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 2 }}>
                  {invoice.payment_terms.schedule.filter(s => s.status === "paid").length} of {invoice.payment_terms.schedule.length} payments received
                </div>
              </div>
            </div>
          )}

          {/* Verification settings — for contract invoices */}
          {hasPaymentTerms && onUpdateSettings && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1a3a1a" }}>
              <div style={{ fontSize: 10, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                🔒 Verification Settings
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={!!invoice.verification_settings?.allow_upload}
                  onChange={e => onUpdateSettings({
                    verification_settings: { ...invoice.verification_settings, allow_upload: e.target.checked }
                  })}
                  style={{ accentColor: "#4CAF50", width: 16, height: 16 }}
                />
                <span style={{ fontSize: 12, color: "#c8e0c8" }}>Allow file upload (manager override)</span>
              </label>
              <div style={{ fontSize: 10, color: "#5a8a5a", lineHeight: 1.5 }}>
                Default: camera-only for residential. Enable this if the customer calls and needs to upload a file instead.
              </div>
            </div>
          )}

          {invoice.sent_at && (
            <div style={{ marginTop: hasPaymentTerms ? 8 : 20, paddingTop: hasPaymentTerms ? 0 : 16, borderTop: hasPaymentTerms ? "none" : "1px solid #1a3a1a" }}>
              <div style={{ fontSize: 11, color: "#5a8a5a" }}>
                📨 Sent: {formatDate(invoice.sent_at)}
              </div>
            </div>
          )}
          {invoice.paid_date && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "#66bb6a" }}>
                ✓ Paid: {formatDate(invoice.paid_date)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
