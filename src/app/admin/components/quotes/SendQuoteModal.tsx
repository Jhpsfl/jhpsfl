"use client";

import React, { useState, useEffect } from "react";
import type { Quote, Customer } from "./quoteTypes";
import { formatCurrency } from "./quoteHelpers";
import { IconSend, IconCopy } from "../invoices/InvoiceIcons";
import { createShortLink } from "@/lib/shortLink";

export default function SendQuoteModal({ quote, customers, sendingQuote, copiedLink, onSend, onCopyLink, onClose }: {
  quote: Quote;
  customers: Customer[];
  sendingQuote: boolean;
  copiedLink?: boolean;
  onSend: (quote: Quote) => void;
  onCopyLink?: (quote: Quote) => void;
  onClose: () => void;
}) {
  const customer = quote.customers || customers.find(c => c.id === quote.customer_id);
  const hasEmail = !!customer?.email;
  const [sendMethod, setSendMethod] = useState<"email" | "link">(hasEmail ? "email" : "link");
  const [shortUrl, setShortUrl] = useState<string | null>(null);

  useEffect(() => {
    if (sendMethod === "link" && quote.public_token) {
      const fullLink = `${typeof window !== "undefined" ? window.location.origin : "https://jhpsfl.com"}/estimate/${quote.public_token}`;
      createShortLink(fullLink, `Estimate: ${quote.quote_number}`).then(setShortUrl);
    }
  }, [sendMethod, quote.public_token, quote.quote_number]);

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
            Send {quote.is_commercial ? "Proposal" : "Estimate"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {/* Summary */}
        <div style={{ background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "#5a8a5a" }}>{quote.quote_number}</span>
            <span style={{ color: "#4CAF50", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(quote.total)}</span>
          </div>
          <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 4 }}>
            To: {customer?.name || "Customer"} ({customer?.email || "No email"})
          </div>
          {quote.is_commercial && (
            <div style={{ marginTop: 8, padding: "4px 10px", borderRadius: 6, background: "rgba(66,165,245,0.08)", border: "1px solid rgba(66,165,245,0.15)", display: "inline-block" }}>
              <span style={{ color: "#42a5f5", fontSize: 11, fontWeight: 700 }}>🏢 COMMERCIAL</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          <button onClick={() => setSendMethod("email")} style={{
            padding: "10px", borderRadius: 10, border: "none",
            background: sendMethod === "email" ? "rgba(76,175,80,0.15)" : "rgba(255,255,255,0.03)",
            color: sendMethod === "email" ? "#4CAF50" : "#5a8a5a",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            outline: sendMethod === "email" ? "1px solid rgba(76,175,80,0.3)" : "1px solid transparent",
          }}>📧 Send Email</button>
          <button onClick={() => setSendMethod("link")} style={{
            padding: "10px", borderRadius: 10, border: "none",
            background: sendMethod === "link" ? "rgba(66,165,245,0.15)" : "rgba(255,255,255,0.03)",
            color: sendMethod === "link" ? "#42a5f5" : "#5a8a5a",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            outline: sendMethod === "link" ? "1px solid rgba(66,165,245,0.3)" : "1px solid transparent",
          }}>🔗 Copy Link / SMS</button>
        </div>

        {sendMethod === "email" ? (
          hasEmail ? (
            <div>
              <div style={{ background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.15)", borderRadius: 10, padding: "14px 16px", marginBottom: 16, fontSize: 13, color: "#8aba8a", lineHeight: 1.6 }}>
                {quote.is_commercial
                  ? <>A branded commercial proposal email will be sent to <strong style={{ color: "#42a5f5" }}>{customer!.email}</strong>. The email shows scope of work and links to the full proposal page — pricing is only visible on the proposal page.</>
                  : <>A professional estimate email with an attached PDF will be sent to <strong style={{ color: "#4CAF50" }}>{customer!.email}</strong>.{quote.show_financing && <span> The estimate includes financing eligibility information.</span>}</>
                }
              </div>
              <button onClick={() => onSend(quote)} disabled={sendingQuote} style={{
                width: "100%", padding: "14px", borderRadius: 12, border: "none",
                background: sendingQuote ? "#1a3a1a" : "linear-gradient(135deg, #4CAF50, #2E7D32)",
                color: "#fff", fontSize: 15, fontWeight: 700, cursor: sendingQuote ? "default" : "pointer",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: sendingQuote ? "none" : "0 4px 20px rgba(76,175,80,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {sendingQuote ? (
                  <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Sending...</>
                ) : (
                  <><IconSend /> Send {quote.is_commercial ? "Proposal" : "Estimate"} Email</>
                )}
              </button>
            </div>
          ) : (
            <div style={{ background: "rgba(239,83,80,0.06)", border: "1px solid rgba(239,83,80,0.15)", borderRadius: 10, padding: "14px 16px", fontSize: 13, color: "#ef9a9a", lineHeight: 1.6 }}>
              ⚠ No email on file for this customer. Use the <strong>Copy Link / SMS</strong> option to share the estimate directly.
            </div>
          )
        ) : (
          <div>
            {quote.public_token ? (
              <>
                <div style={{ background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 10, padding: "12px 14px", marginBottom: 16, wordBreak: "break-all", fontSize: 12, color: "#8aba8a", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
                  {shortUrl || "Loading..."}
                </div>
                <div style={{ background: "rgba(66,165,245,0.06)", border: "1px solid rgba(66,165,245,0.15)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#90CAF9", lineHeight: 1.6 }}>
                  {quote.is_commercial
                    ? "This link opens a branded proposal page with your service showcase, pricing details, financing options, and acceptance."
                    : "This link lets the customer preview the estimate, view pricing, download the PDF, and accept online."
                  }
                </div>
                <button onClick={() => onCopyLink?.(quote)} style={{
                  width: "100%", padding: "14px", borderRadius: 12, border: "none",
                  background: copiedLink ? "rgba(76,175,80,0.15)" : "linear-gradient(135deg, #42a5f5, #1565C0)",
                  color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  boxShadow: copiedLink ? "none" : "0 4px 20px rgba(33,150,243,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.3s",
                }}>
                  {copiedLink ? <><span style={{ color: "#4CAF50" }}>✓</span> Link Copied!</> : <><IconCopy /> Copy Link</>}
                </button>
              </>
            ) : (
              <div style={{ background: "rgba(255,183,77,0.06)", border: "1px solid rgba(255,183,77,0.15)", borderRadius: 10, padding: "14px 16px", fontSize: 13, color: "#FFB74D", lineHeight: 1.6 }}>
                ⚠ This estimate doesn&apos;t have a public link yet. Save it first, then you can share the link.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
