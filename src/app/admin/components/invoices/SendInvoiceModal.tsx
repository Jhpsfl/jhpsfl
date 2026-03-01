"use client";

import React, { useState, useEffect } from "react";
import type { Invoice, Customer } from "./invoiceTypes";
import { formatCurrency } from "./invoiceHelpers";
import { IconSend, IconCopy } from "./InvoiceIcons";
import { createShortLink } from "@/lib/shortLink";

export default function SendInvoiceModal({ invoice, customers, sendMethod, setSendMethod, sendingInvoice, copiedLink, onSend, onCopyLink, onClose, getPaymentLink, adminPost, loadInvoices }: {
  invoice: Invoice;
  customers: Customer[];
  sendMethod: "email" | "link";
  setSendMethod: (m: "email" | "link") => void;
  sendingInvoice: boolean;
  copiedLink: boolean;
  onSend: (invoice: Invoice) => void;
  onCopyLink: (invoice: Invoice) => void;
  onClose: () => void;
  getPaymentLink: (invoice: Invoice | null) => string;
  adminPost: (resource: string, action: string, payload: Record<string, unknown>) => Promise<unknown>;
  loadInvoices: () => Promise<void>;
}) {
  const [shortUrl, setShortUrl] = useState<string | null>(null);

  useEffect(() => {
    if (sendMethod === "link") {
      const fullLink = getPaymentLink(invoice);
      createShortLink(fullLink, `Payment: ${invoice.invoice_number}`).then(setShortUrl);
    }
  }, [sendMethod, invoice, getPaymentLink]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, backdropFilter: "blur(8px)", animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "linear-gradient(160deg, #0d1f0d, #091409)",
          border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px 24px",
          maxWidth: 480, width: "100%", boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
          animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#e8f5e8", fontWeight: 700 }}>
            Send Invoice
          </h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 22, cursor: "pointer" }}
          >✕</button>
        </div>

        {/* Invoice summary */}
        <div style={{
          background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 12,
          padding: "14px 16px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "#5a8a5a" }}>{invoice.invoice_number}</span>
            <span style={{ color: "#4CAF50", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              {formatCurrency(invoice.total)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 4 }}>
            To: {invoice.customers?.name || "Customer"} ({invoice.customers?.email || "No email"})
          </div>
        </div>

        {/* Send method tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setSendMethod("email")}
            style={{
              flex: 1, padding: "12px", borderRadius: 10,
              border: "1px solid " + (sendMethod === "email" ? "rgba(76,175,80,0.3)" : "#1a3a1a"),
              background: sendMethod === "email" ? "rgba(76,175,80,0.1)" : "transparent",
              color: sendMethod === "email" ? "#4CAF50" : "#5a8a5a",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            ✉️ Send via Email
          </button>
          <button
            onClick={() => setSendMethod("link")}
            style={{
              flex: 1, padding: "12px", borderRadius: 10,
              border: "1px solid " + (sendMethod === "link" ? "rgba(33,150,243,0.3)" : "#1a3a1a"),
              background: sendMethod === "link" ? "rgba(33,150,243,0.1)" : "transparent",
              color: sendMethod === "link" ? "#42a5f5" : "#5a8a5a",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            🔗 Copy Link (SMS)
          </button>
        </div>

        {sendMethod === "email" ? (
          <>
            {invoice.customers?.email ? (
              <div>
                <div style={{
                  background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.15)",
                  borderRadius: 10, padding: "14px 16px", marginBottom: 16,
                  fontSize: 13, color: "#8aba8a", lineHeight: 1.6,
                }}>
                  A professional invoice email will be sent to <strong style={{ color: "#4CAF50" }}>{invoice.customers.email}</strong> with
                  a secure payment link. The customer can pay directly from the email.
                </div>
                <button
                  onClick={() => onSend(invoice)}
                  disabled={sendingInvoice}
                  style={{
                    width: "100%", padding: "14px", borderRadius: 12, border: "none",
                    background: sendingInvoice ? "#1a3a1a" : "linear-gradient(135deg, #4CAF50, #2E7D32)",
                    color: "#fff", fontSize: 15, fontWeight: 700, cursor: sendingInvoice ? "default" : "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    boxShadow: sendingInvoice ? "none" : "0 4px 20px rgba(76,175,80,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {sendingInvoice ? (
                    <>
                      <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      Sending...
                    </>
                  ) : (
                    <><IconSend /> Send Invoice Email</>
                  )}
                </button>
              </div>
            ) : (
              <div style={{
                background: "rgba(239,83,80,0.06)", border: "1px solid rgba(239,83,80,0.15)",
                borderRadius: 10, padding: "14px 16px",
                fontSize: 13, color: "#ef9a9a",
              }}>
                ⚠ This customer doesn&apos;t have an email on file. Use the &quot;Copy Link&quot; option instead, or update the customer&apos;s email first.
              </div>
            )}
          </>
        ) : (
          <div>
            <div style={{
              background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 10,
              padding: "12px 14px", marginBottom: 16, wordBreak: "break-all",
              fontSize: 12, color: "#8aba8a", fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.6, maxHeight: 100, overflowY: "auto",
            }}>
              {shortUrl || getPaymentLink(invoice)}
            </div>
            <button
              onClick={() => {
                onCopyLink(invoice);
                // Also update status to sent
                (adminPost as (resource: string, action: string, payload: Record<string, unknown>) => Promise<unknown>)("invoices", "update", {
                  id: invoice.id,
                  status: invoice.status === "draft" ? "sent" : invoice.status,
                  payment_link: getPaymentLink(invoice),
                }).then(() => loadInvoices());
              }}
              style={{
                width: "100%", padding: "14px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #42a5f5, #1565c0)", color: "#fff",
                fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 4px 20px rgba(33,150,243,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <IconCopy /> Copy Payment Link
            </button>
            <p style={{ fontSize: 12, color: "#5a8a5a", marginTop: 10, textAlign: "center" }}>
              Paste this link into a text message to your customer
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
