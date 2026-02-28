"use client";

import React from "react";
import type { Quote, Customer } from "./quoteTypes";
import { formatCurrency } from "./quoteHelpers";
import { IconSend } from "../invoices/InvoiceIcons";

export default function SendQuoteModal({ quote, customers, sendingQuote, onSend, onClose }: {
  quote: Quote;
  customers: Customer[];
  sendingQuote: boolean;
  onSend: (quote: Quote) => void;
  onClose: () => void;
}) {
  const customer = quote.customers || customers.find(c => c.id === quote.customer_id);

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
            Send Estimate
          </h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 22, cursor: "pointer" }}
          >✕</button>
        </div>

        {/* Quote summary */}
        <div style={{
          background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 12,
          padding: "14px 16px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "#5a8a5a" }}>{quote.quote_number}</span>
            <span style={{ color: "#4CAF50", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              {formatCurrency(quote.total)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 4 }}>
            To: {customer?.name || "Customer"} ({customer?.email || "No email"})
          </div>
        </div>

        {customer?.email ? (
          <div>
            <div style={{
              background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.15)",
              borderRadius: 10, padding: "14px 16px", marginBottom: 16,
              fontSize: 13, color: "#8aba8a", lineHeight: 1.6,
            }}>
              A professional estimate email with an attached PDF will be sent to <strong style={{ color: "#4CAF50" }}>{customer.email}</strong>.
              {quote.show_financing && (
                <span> The estimate includes financing eligibility information.</span>
              )}
            </div>
            <button
              onClick={() => onSend(quote)}
              disabled={sendingQuote}
              style={{
                width: "100%", padding: "14px", borderRadius: 12, border: "none",
                background: sendingQuote ? "#1a3a1a" : "linear-gradient(135deg, #4CAF50, #2E7D32)",
                color: "#fff", fontSize: 15, fontWeight: 700, cursor: sendingQuote ? "default" : "pointer",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: sendingQuote ? "none" : "0 4px 20px rgba(76,175,80,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {sendingQuote ? (
                <>
                  <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Sending...
                </>
              ) : (
                <><IconSend /> Send Estimate Email</>
              )}
            </button>
          </div>
        ) : (
          <div style={{
            background: "rgba(239,83,80,0.06)", border: "1px solid rgba(239,83,80,0.15)",
            borderRadius: 10, padding: "14px 16px",
            fontSize: 13, color: "#ef9a9a",
          }}>
            ⚠ This customer doesn&apos;t have an email on file. Please update the customer&apos;s email first.
          </div>
        )}
      </div>
    </div>
  );
}
