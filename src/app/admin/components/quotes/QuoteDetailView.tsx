"use client";

import React from "react";
import type { Quote } from "./quoteTypes";
import { formatCurrency, formatDate, FINANCING_MESSAGE } from "./quoteHelpers";
import QuoteStatusBadge from "./QuoteStatusBadge";
import { IconSend, IconEdit, IconTrash, IconBack } from "../invoices/InvoiceIcons";

export default function QuoteDetailView({ quote, isMobile, onBack, onSend, onEdit, onDelete, onMarkAccepted, onMarkDeclined, onConvertToInvoice, onNavigate, onPreviewPdf }: {
  quote: Quote;
  isMobile: boolean;
  onBack: () => void;
  onSend: () => void;
  onEdit: (q: Quote) => void;
  onDelete: (q: Quote) => void;
  onMarkAccepted: (q: Quote) => void;
  onMarkDeclined: (q: Quote) => void;
  onConvertToInvoice: (q: Quote) => void;
  onNavigate?: () => void;
  onPreviewPdf?: () => void;
}) {
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
          Estimate {quote.quote_number}
        </h1>
        <QuoteStatusBadge status={quote.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 24, alignItems: "start" }}>
        {/* Left: Quote details */}
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
                <div style={{ fontSize: 28, fontWeight: 800, color: "#e8f5e8", fontFamily: "'Playfair Display', serif" }}>ESTIMATE</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
                  {quote.quote_number}
                </div>
                <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 8 }}>
                  Date: {formatDate(quote.created_at)}
                  {quote.expiration_date && <><br />Valid Until: {formatDate(quote.expiration_date)}</>}
                </div>
              </div>
            </div>

            {/* Prepared For */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Prepared For</div>
              {quote.customer_id ? (
                <>
                  <div style={{ fontSize: 15, color: "#c8e0c8", fontWeight: 600 }}>
                    {quote.customers?.name || "—"}
                  </div>
                  {quote.customers?.email && (
                    <div style={{ fontSize: 13, color: "#5a8a5a" }}>{quote.customers.email}</div>
                  )}
                  {quote.customers?.phone && (
                    <div style={{ fontSize: 13, color: "#5a8a5a" }}>{quote.customers.phone}</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#5a8a5a" }}>No customer assigned</div>
              )}
            </div>

            {/* Financing callout */}
            {quote.show_financing && (
              <div style={{
                marginBottom: 24, padding: "16px 18px", borderRadius: 12,
                background: "rgba(38,166,154,0.06)", border: "1px solid rgba(38,166,154,0.25)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#26A69A", marginBottom: 6 }}>
                  $ Flexible Payment Options Available
                </div>
                <div style={{ fontSize: 13, color: "#80CBC4", lineHeight: 1.6 }}>
                  {FINANCING_MESSAGE}
                </div>
              </div>
            )}

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
                  {(quote.line_items || []).map((item, idx) => (
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
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(quote.subtotal)}</span>
                </div>
                {quote.tax_rate > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "#8aba8a" }}>
                    <span>Tax ({quote.tax_rate}%)</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(quote.tax_amount)}</span>
                  </div>
                )}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  padding: "12px 0", borderTop: "2px solid #1a3a1a", marginTop: 4,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#e8f5e8" }}>Estimated Total</span>
                  <span style={{ fontSize: 26, fontWeight: 800, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatCurrency(quote.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #1a3a1a" }}>
                <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Notes</div>
                <div style={{ fontSize: 13, color: "#8aba8a", lineHeight: 1.6 }}>{quote.notes}</div>
              </div>
            )}
          </div>
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
            {/* Convert to Invoice — only when accepted */}
            {quote.status === "accepted" && (
              <button
                onClick={() => onConvertToInvoice(quote)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "14px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #AB47BC, #7B1FA2)", color: "#fff",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 4px 20px rgba(171,71,188,0.35)",
                }}
              >
                📄 Convert to Invoice
              </button>
            )}

            {/* Preview PDF */}
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

            {/* Send / Resend */}
            {["draft", "sent"].includes(quote.status) && (
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
                <IconSend /> {quote.status === "draft" ? "Send Estimate" : "Resend Estimate"}
              </button>
            )}

            {/* Mark Accepted */}
            {["sent"].includes(quote.status) && (
              <button
                onClick={() => onMarkAccepted(quote)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: 12,
                  border: "1px solid rgba(76,175,80,0.3)",
                  background: "rgba(76,175,80,0.08)", color: "#66bb6a",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ✓ Mark as Accepted
              </button>
            )}

            {/* Mark Declined */}
            {["sent"].includes(quote.status) && (
              <button
                onClick={() => onMarkDeclined(quote)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: 12,
                  border: "1px solid rgba(239,83,80,0.2)",
                  background: "rgba(239,83,80,0.05)", color: "#ef9a9a",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ✕ Mark as Declined
              </button>
            )}

            {/* Edit */}
            {["draft", "sent"].includes(quote.status) && (
              <button
                onClick={() => onEdit(quote)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: 12,
                  border: "1px solid #1a3a1a", background: "transparent",
                  color: "#8aba8a", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <IconEdit /> Edit Estimate
              </button>
            )}

            {/* Delete */}
            <button
              onClick={() => onDelete(quote)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px", borderRadius: 12,
                border: "1px solid rgba(239,83,80,0.2)", background: "transparent",
                color: "#ef5350", fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <IconTrash /> Delete Estimate
            </button>
          </div>

          {/* Financing badge */}
          {quote.show_financing && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #1a3a1a" }}>
              <div style={{
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(38,166,154,0.04)", border: "1px solid rgba(38,166,154,0.15)",
              }}>
                <div style={{ fontSize: 10, color: "#26A69A", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                  $ Financing Eligible
                </div>
              </div>
            </div>
          )}

          {/* Converted badge */}
          {quote.status === "converted" && quote.converted_invoice_id && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #1a3a1a" }}>
              <div style={{
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(171,71,188,0.04)", border: "1px solid rgba(171,71,188,0.15)",
              }}>
                <div style={{ fontSize: 10, color: "#ce93d8", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                  📄 Converted to Invoice
                </div>
                <div style={{ fontSize: 12, color: "#8aba8a" }}>
                  This estimate has been converted to an invoice.
                </div>
              </div>
            </div>
          )}

          {quote.sent_at && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #1a3a1a" }}>
              <div style={{ fontSize: 11, color: "#5a8a5a" }}>
                📨 Sent: {formatDate(quote.sent_at)}
              </div>
            </div>
          )}
          {quote.accepted_at && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "#66bb6a" }}>
                ✓ Accepted: {formatDate(quote.accepted_at)}
              </div>
            </div>
          )}
          {quote.declined_at && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "#ef9a9a" }}>
                ✕ Declined: {formatDate(quote.declined_at)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
