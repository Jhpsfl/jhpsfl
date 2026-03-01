"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import CommercialEstimatePage from "./CommercialEstimatePage";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Types ───
interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}
interface ScheduleItem {
  label: string;
  amount: number;
  due_date: string | null;
}
interface QuoteData {
  id: string;
  quote_number: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  expiration_date: string | null;
  notes: string | null;
  line_items: LineItem[];
  show_financing: boolean;
  is_commercial: boolean;
  payment_terms: { type: string; deposit_amount: number; schedule: ScheduleItem[] } | null;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
}

// ─── PDF.js loader ───
const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
let pdfjsLoaded: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if (pdfjsLoaded) return pdfjsLoaded;
  pdfjsLoaded = new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) { resolve((window as any).pdfjsLib); return; }
    const s = document.createElement("script");
    s.src = `${PDFJS_CDN}/pdf.min.js`;
    s.onload = () => {
      const lib = (window as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve(lib);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return pdfjsLoaded;
}

const fmt = (n: number) => `$${n.toFixed(2)}`;
const fmtDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });
};

export default function EstimatePage() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [changeMessage, setChangeMessage] = useState("");
  const [changeSent, setChangeSent] = useState(false);

  // PDF preview state
  const [showPdf, setShowPdf] = useState(false);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch quote
  useEffect(() => {
    if (!token) return;
    fetch(`/api/quote/public/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.quote) setQuote(data.quote);
        else setError(data.error || "Estimate not found");
      })
      .catch(() => setError("Failed to load estimate"))
      .finally(() => setLoading(false));
  }, [token]);

  // Render PDF
  const renderPdf = useCallback(async () => {
    if (!token) return;
    setPdfLoading(true);
    setShowPdf(true);
    setPdfPages([]);
    try {
      const res = await fetch(`/api/quote/pdf/${token}`);
      if (!res.ok) throw new Error("PDF fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const pdfjsLib = await loadPdfJs();
      const pdf = await pdfjsLib.getDocument(url).promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push(canvas.toDataURL("image/png"));
      }
      setPdfPages(pages);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF render error:", err);
    }
    setPdfLoading(false);
  }, [token]);

  // Accept
  const handleAccept = async () => {
    if (!token || accepting) return;
    setAccepting(true);
    try {
      const res = await fetch("/api/quote/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) {
        setAccepted(true);
        if (quote) setQuote({ ...quote, status: "accepted" });
      }
    } catch { /* */ }
    setAccepting(false);
  };

  // Download PDF
  const handleDownload = () => {
    if (!token) return;
    const a = document.createElement("a");
    a.href = `/api/quote/pdf/${token}`;
    a.download = `JHPS-Estimate-${quote?.quote_number || "download"}.pdf`;
    a.click();
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#060e06", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #1a3a1a", borderTopColor: "#4CAF50", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "#5a8a5a", fontSize: 14 }}>Loading estimate...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: "#060e06", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
        <h1 style={{ color: "#e8f5e8", fontSize: 22, fontFamily: "'Playfair Display', serif", marginBottom: 8 }}>Estimate Not Found</h1>
        <p style={{ color: "#5a8a5a", fontSize: 14, lineHeight: 1.6 }}>{error}</p>
        <Link href="/" style={{ display: "inline-block", marginTop: 20, color: "#4CAF50", fontSize: 14, textDecoration: "underline" }}>
          Go to Homepage
        </Link>
      </div>
    </div>
  );

  if (!quote) return null;

  // Commercial estimates get a branded proposal landing page
  if (quote.is_commercial) {
    return <CommercialEstimatePage quote={quote} token={token} />;
  }

  const isExpired = quote.status === "expired";
  const isAcceptedStatus = quote.status === "accepted" || accepted;
  const hasPaymentTerms = quote.payment_terms && quote.payment_terms.schedule?.length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #060e06; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>

      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #060e06 0%, #0a160a 100%)", fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, rgba(46,125,50,0.15), rgba(76,175,80,0.05))",
          borderBottom: "1px solid #1a3a1a", padding: "20px 0",
        }}>
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ color: "#4CAF50", fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>JHPS</h1>
              <p style={{ color: "#3a5a3a", fontSize: 11 }}>Jenkins Home & Property Solutions</p>
            </div>
            <a href="tel:4076869817" style={{
              color: "#4CAF50", fontSize: 13, fontWeight: 600, textDecoration: "none",
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 10, border: "1px solid #1a3a1a",
              background: "rgba(76,175,80,0.05)",
            }}>
              📞 (407) 686-9817
            </a>
          </div>
        </div>

        {/* Main content */}
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>
          {/* Estimate header card */}
          <div style={{
            background: "linear-gradient(160deg, #0d1f0d, #091409)",
            border: "1px solid #1a3a1a", borderRadius: 20, padding: "32px 24px",
            marginBottom: 24, animation: "fadeIn 0.5s ease",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <p style={{ color: "#3a5a3a", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                  PREPARED FOR
                </p>
                <h2 style={{ color: "#e8f5e8", fontSize: 24, fontFamily: "'Playfair Display', serif", fontWeight: 700, marginBottom: 4 }}>
                  {quote.customer_name}
                </h2>
                {quote.customer_address && (
                  <p style={{ color: "#5a8a5a", fontSize: 13, marginBottom: 2 }}>📍 {quote.customer_address}</p>
                )}
                <p style={{ color: "#3a5a3a", fontSize: 12, marginTop: 6 }}>
                  {quote.quote_number} · {fmtDate(quote.created_at)}
                </p>
              </div>
              <div style={{
                padding: "8px 16px", borderRadius: 10,
                background: isExpired ? "rgba(239,83,80,0.1)" : isAcceptedStatus ? "rgba(76,175,80,0.12)" : "rgba(66,165,245,0.1)",
                border: `1px solid ${isExpired ? "rgba(239,83,80,0.3)" : isAcceptedStatus ? "rgba(76,175,80,0.3)" : "rgba(66,165,245,0.3)"}`,
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: isExpired ? "#ef5350" : isAcceptedStatus ? "#4CAF50" : "#42a5f5",
                }}>
                  {isExpired ? "Expired" : isAcceptedStatus ? "Accepted ✓" : "Pending Review"}
                </span>
              </div>
            </div>

            {/* Contact info row */}
            <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
              {quote.customer_email && (
                <div>
                  <p style={{ color: "#3a5a3a", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Email</p>
                  <p style={{ color: "#c8e0c8", fontSize: 14, marginTop: 4 }}>{quote.customer_email}</p>
                </div>
              )}
              {quote.customer_phone && (
                <div>
                  <p style={{ color: "#3a5a3a", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Phone</p>
                  <p style={{ color: "#c8e0c8", fontSize: 14, marginTop: 4 }}>{quote.customer_phone}</p>
                </div>
              )}
            </div>

            {quote.expiration_date && !isExpired && (
              <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(255,183,77,0.06)", border: "1px solid rgba(255,183,77,0.15)" }}>
                <p style={{ color: "#ffb74d", fontSize: 13, fontWeight: 600 }}>
                  ⏰ Valid until {fmtDate(quote.expiration_date)}
                </p>
              </div>
            )}
          </div>

          {/* Line items */}
          <div style={{
            background: "linear-gradient(160deg, #0d1f0d, #091409)",
            border: "1px solid #1a3a1a", borderRadius: 20, padding: "24px 16px",
            marginBottom: 24, animation: "fadeIn 0.5s ease 0.1s both",
          }}>
            <h3 style={{ color: "#3a5a3a", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>
              SCOPE OF WORK
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, overflowX: "hidden" }}>
              {/* Header */}
              <div style={{ display: "flex", padding: "8px 0", borderBottom: "1px solid #1a3a1a", gap: 8 }}>
                <span style={{ flex: "1 1 0", minWidth: 0, color: "#5a8a5a", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Description</span>
                <span style={{ width: 36, color: "#5a8a5a", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", textAlign: "center", flexShrink: 0 }}>Qty</span>
                <span style={{ width: 72, color: "#5a8a5a", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", textAlign: "right", flexShrink: 0 }}>Amount</span>
              </div>
              {/* Items */}
              {quote.line_items.map((item, i) => (
                <div key={i} style={{
                  display: "flex", gap: 8, alignItems: "flex-start",
                  padding: "14px 0", borderBottom: i < quote.line_items.length - 1 ? "1px solid rgba(26,58,26,0.5)" : "none",
                }}>
                  <span style={{ flex: "1 1 0", minWidth: 0, color: "#e8f5e8", fontSize: 14, wordBreak: "break-word" }}>{item.description}</span>
                  <span style={{ width: 36, color: "#8aba8a", fontSize: 14, textAlign: "center", flexShrink: 0 }}>{item.quantity}</span>
                  <span style={{ width: 72, color: "#e8f5e8", fontSize: 14, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", textAlign: "right", flexShrink: 0 }}>{fmt(item.amount)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ borderTop: "1px solid #1a3a1a", marginTop: 8, paddingTop: 16, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: 220 }}>
                <span style={{ color: "#5a8a5a", fontSize: 13 }}>Subtotal</span>
                <span style={{ color: "#c8e0c8", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(quote.subtotal)}</span>
              </div>
              {quote.tax_amount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", width: 220 }}>
                  <span style={{ color: "#5a8a5a", fontSize: 13 }}>Tax ({quote.tax_rate}%)</span>
                  <span style={{ color: "#c8e0c8", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(quote.tax_amount)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", width: 220, paddingTop: 8, borderTop: "1px solid #2a5a2a" }}>
                <span style={{ color: "#e8f5e8", fontSize: 16, fontWeight: 700 }}>Estimated Total</span>
                <span style={{ color: "#4CAF50", fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(quote.total)}</span>
              </div>

              {/* Deposit breakdown */}
              {hasPaymentTerms && quote.payment_terms && (
                <>
                  <div style={{
                    display: "flex", justifyContent: "space-between", width: 220,
                    padding: "10px 14px", marginTop: 4,
                    background: "rgba(76,175,80,0.08)", borderRadius: 10,
                    border: "1px solid rgba(76,175,80,0.2)",
                  }}>
                    <span style={{ color: "#4CAF50", fontSize: 14, fontWeight: 700 }}>Deposit Due</span>
                    <span style={{ color: "#4CAF50", fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt(quote.payment_terms.deposit_amount)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", width: 220 }}>
                    <span style={{ color: "#5a8a5a", fontSize: 12 }}>Remaining Balance</span>
                    <span style={{ color: "#8aba8a", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt(quote.total - quote.payment_terms.deposit_amount)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Payment Schedule */}
          {hasPaymentTerms && quote.payment_terms && (
            <div style={{
              background: "linear-gradient(160deg, #0d1f0d, #091409)",
              border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px",
              marginBottom: 24, animation: "fadeIn 0.5s ease 0.15s both",
            }}>
              <h3 style={{ color: "#3a5a3a", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>
                PAYMENT SCHEDULE
              </h3>
              {quote.payment_terms.schedule.map((item, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 0", borderBottom: i < quote.payment_terms!.schedule.length - 1 ? "1px solid rgba(26,58,26,0.5)" : "none",
                }}>
                  <div>
                    <p style={{ color: "#e8f5e8", fontSize: 14, fontWeight: 600 }}>{item.label}</p>
                    <p style={{ color: "#5a8a5a", fontSize: 12 }}>{item.due_date ? fmtDate(item.due_date) : "To be determined"}</p>
                  </div>
                  <span style={{
                    color: i === 0 ? "#4CAF50" : "#c8e0c8",
                    fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {fmt(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {quote.notes && (
            <div style={{
              background: "linear-gradient(160deg, #0d1f0d, #091409)",
              border: "1px solid #1a3a1a", borderRadius: 20, padding: "24px 28px",
              marginBottom: 24, animation: "fadeIn 0.5s ease 0.2s both",
            }}>
              <h3 style={{ color: "#3a5a3a", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
                NOTES
              </h3>
              <p style={{ color: "#c8e0c8", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{quote.notes}</p>
            </div>
          )}

          {/* Action buttons */}
          <div style={{
            background: "linear-gradient(160deg, #0d1f0d, #091409)",
            border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px",
            animation: "fadeIn 0.5s ease 0.25s both",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Preview PDF */}
              <button
                onClick={renderPdf}
                style={{
                  padding: "14px", borderRadius: 14,
                  border: "1px solid rgba(66,165,245,0.3)",
                  background: "rgba(66,165,245,0.08)", color: "#42a5f5",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                📄 Preview PDF
              </button>

              {/* Download PDF */}
              <button
                onClick={handleDownload}
                style={{
                  padding: "14px", borderRadius: 14,
                  border: "1px solid #1a3a1a",
                  background: "rgba(76,175,80,0.06)", color: "#8aba8a",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                ⬇ Download PDF
              </button>
            </div>

            {/* Request Changes */}
            {!isExpired && !isAcceptedStatus && (
              <div style={{ marginTop: 12 }}>
                {!showChangeForm ? (
                  <button
                    onClick={() => setShowChangeForm(true)}
                    style={{
                      width: "100%", padding: "14px", borderRadius: 14,
                      border: "1px solid rgba(255,183,77,0.25)", background: "rgba(255,183,77,0.06)",
                      color: "#FFB74D", fontSize: 14, fontWeight: 700, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    ✏️ Request Changes
                  </button>
                ) : changeSent ? (
                  <div style={{
                    padding: "20px", borderRadius: 14,
                    background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.2)",
                    textAlign: "center",
                  }}>
                    <p style={{ color: "#66bb6a", fontSize: 15, fontWeight: 700 }}>✓ Change Request Sent</p>
                    <p style={{ color: "#5a8a5a", fontSize: 13, marginTop: 4 }}>We&apos;ll review your request and get back to you shortly.</p>
                  </div>
                ) : (
                  <div style={{
                    padding: "20px", borderRadius: 14,
                    background: "rgba(255,183,77,0.04)", border: "1px solid rgba(255,183,77,0.15)",
                  }}>
                    <p style={{ color: "#FFB74D", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>✏️ Request Changes</p>
                    <textarea
                      value={changeMessage}
                      onChange={e => setChangeMessage(e.target.value)}
                      placeholder="Describe what you'd like changed — scope, pricing, scheduling, etc."
                      rows={4}
                      style={{
                        width: "100%", padding: "12px", borderRadius: 10, border: "1px solid rgba(255,183,77,0.2)",
                        background: "rgba(0,0,0,0.3)", color: "#e8f5e8", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                        resize: "vertical", outline: "none",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button
                        onClick={async () => {
                          if (!changeMessage.trim()) return;
                          try {
                            await fetch("/api/quote/change-request", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ token, message: changeMessage, customer_name: quote.customer_name, customer_email: quote.customer_email }),
                            });
                          } catch { /* */ }
                          setChangeSent(true);
                        }}
                        disabled={!changeMessage.trim()}
                        style={{
                          flex: 1, padding: "12px", borderRadius: 10, border: "none",
                          background: changeMessage.trim() ? "linear-gradient(135deg, #F57C00, #E65100)" : "#1a3a1a",
                          color: "#fff", fontSize: 14, fontWeight: 700, cursor: changeMessage.trim() ? "pointer" : "not-allowed",
                          opacity: changeMessage.trim() ? 1 : 0.5,
                        }}
                      >
                        Send Request
                      </button>
                      <button
                        onClick={() => { setShowChangeForm(false); setChangeMessage(""); }}
                        style={{
                          padding: "12px 20px", borderRadius: 10, border: "1px solid #1a3a1a",
                          background: "transparent", color: "#5a8a5a", fontSize: 14, cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Accept button */}
            {!isExpired && !isAcceptedStatus && (
              <button
                onClick={handleAccept}
                disabled={accepting}
                style={{
                  width: "100%", marginTop: 12, padding: "18px", borderRadius: 14,
                  border: "none",
                  background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                  color: "#fff", fontSize: 17, fontWeight: 800, cursor: accepting ? "wait" : "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 4px 24px rgba(76,175,80,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  opacity: accepting ? 0.7 : 1, transition: "opacity 0.3s",
                }}
              >
                {accepting ? (
                  <span style={{ animation: "pulse 1s infinite" }}>Accepting...</span>
                ) : (
                  <>✓ Accept This Estimate</>
                )}
              </button>
            )}

            {isAcceptedStatus && (
              <div style={{
                marginTop: 12, padding: "18px", borderRadius: 14,
                background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.3)",
                textAlign: "center",
              }}>
                <p style={{ color: "#4CAF50", fontSize: 16, fontWeight: 700 }}>✓ Estimate Accepted</p>
                <p style={{ color: "#5a8a5a", fontSize: 13, marginTop: 4 }}>
                  Thank you! We&apos;ll be in touch shortly to get started.
                </p>
              </div>
            )}

            {isExpired && (
              <div style={{
                marginTop: 12, padding: "18px", borderRadius: 14,
                background: "rgba(239,83,80,0.06)", border: "1px solid rgba(239,83,80,0.2)",
                textAlign: "center",
              }}>
                <p style={{ color: "#ef5350", fontSize: 14, fontWeight: 700 }}>This estimate has expired</p>
                <p style={{ color: "#5a8a5a", fontSize: 13, marginTop: 4 }}>
                  Please contact us for an updated estimate.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: 40, paddingBottom: 40 }}>
            <p style={{ color: "#3a5a3a", fontSize: 12 }}>
              Questions? Call <a href="tel:4076869817" style={{ color: "#4CAF50", textDecoration: "none" }}>(407) 686-9817</a>
              {" "}or email <a href="mailto:info@jhpsfl.com" style={{ color: "#4CAF50", textDecoration: "none" }}>info@jhpsfl.com</a>
            </p>
            <p style={{ color: "#2a4a2a", fontSize: 11, marginTop: 6 }}>
              Jenkins Home & Property Solutions · Serving Central Florida
            </p>
          </div>
        </div>
      </div>

      {/* ─── PDF Preview Modal ─── */}
      {showPdf && (
        <div
          onClick={() => setShowPdf(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 900,
              height: "calc(100vh - 32px)", maxHeight: "calc(100dvh - 32px)",
              display: "flex", flexDirection: "column",
              background: "linear-gradient(160deg, #0a1a0a, #060e06)",
              border: "1px solid rgba(66,165,245,0.25)", borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 0 60px rgba(13,71,161,0.3), 0 0 120px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid rgba(66,165,245,0.15)",
              background: "linear-gradient(135deg, rgba(13,71,161,0.2), rgba(21,101,192,0.08))", flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "linear-gradient(135deg, #1565C0, #0D47A1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 10px rgba(21,101,192,0.4)",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E3F2FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#E3F2FD" }}>Estimate {quote.quote_number}</div>
                  <div style={{ fontSize: 11, color: "rgba(144,202,249,0.6)" }}>
                    {pdfPages.length > 0 ? `${pdfPages.length} page${pdfPages.length > 1 ? "s" : ""}` : "Loading..."}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={handleDownload}
                  style={{
                    padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(76,175,80,0.3)",
                    background: "rgba(76,175,80,0.1)", color: "#66bb6a",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  ⬇ Download
                </button>
                <button
                  onClick={() => setShowPdf(false)}
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "rgba(239,83,80,0.1)", border: "1px solid rgba(239,83,80,0.2)",
                    color: "#ef9a9a", fontSize: 18, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div ref={scrollRef} style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
              {pdfLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
                  <div style={{ width: 40, height: 40, border: "3px solid rgba(66,165,245,0.2)", borderTopColor: "#42a5f5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ fontSize: 14, color: "#90CAF9", fontWeight: 600 }}>Generating PDF...</p>
                </div>
              ) : pdfPages.length > 0 ? (
                <div ref={contentRef} style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                  {pdfPages.map((src, i) => (
                    <img key={i} src={src} alt={`Page ${i + 1}`} draggable={false}
                      style={{ width: "100%", maxWidth: 800, borderRadius: 4, boxShadow: "0 2px 20px rgba(0,0,0,0.5)", pointerEvents: "none", userSelect: "none" }}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                  <div style={{ fontSize: 36 }}>⚠</div>
                  <p style={{ fontSize: 14, color: "#ef9a9a", fontWeight: 600 }}>Failed to render PDF</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
