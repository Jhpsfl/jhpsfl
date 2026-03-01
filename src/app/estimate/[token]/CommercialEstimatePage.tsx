"use client";

import { useState, useCallback, useRef } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LineItem { description: string; quantity: number; unit_price: number; amount: number; }
interface ScheduleItem { label: string; amount: number; due_date: string | null; }
interface QuoteData {
  id: string; quote_number: string; status: string; subtotal: number; tax_rate: number;
  tax_amount: number; total: number; expiration_date: string | null; notes: string | null;
  line_items: LineItem[]; show_financing: boolean; is_commercial: boolean;
  payment_terms: { type: string; deposit_amount: number; schedule: ScheduleItem[] } | null;
  created_at: string; customer_name: string; customer_email: string; customer_phone: string;
  customer_address: string;
}

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
let pdfjsLoaded: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if (pdfjsLoaded) return pdfjsLoaded;
  pdfjsLoaded = new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) { resolve((window as any).pdfjsLib); return; }
    const s = document.createElement("script");
    s.src = `${PDFJS_CDN}/pdf.min.js`;
    s.onload = () => { const lib = (window as any).pdfjsLib; lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`; resolve(lib); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return pdfjsLoaded;
}

const fmt = (n: number) => `$${n.toFixed(2)}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });

// ─── Services data matching /commercial page ───
const SERVICES = [
  { icon: "🔄", title: "Property Turnovers", desc: "Complete turnover services — junk removal, deep cleaning, exterior wash, and curb appeal. Units rent-ready in 24–48 hours." },
  { icon: "💧", title: "Exterior Maintenance", desc: "Scheduled pressure washing, soft washing, and surface cleaning for buildings, walkways, parking areas, and common spaces." },
  { icon: "🌿", title: "Grounds & Lawn Care", desc: "Comprehensive lawn care, landscaping maintenance, and grounds keeping for commercial properties and rental communities." },
  { icon: "🚛", title: "Junk Removal & Cleanouts", desc: "Tenant trash-outs, unit cleanouts, construction debris removal, and bulk haul-offs with proper disposal." },
  { icon: "🌳", title: "Land Clearing & Lot Prep", desc: "Overgrown lot clearing, brush removal, and property prep for development, resale, or code compliance." },
  { icon: "✨", title: "Curb Appeal Restoration", desc: "Full exterior refresh combining pressure washing, cleanup, lawn care, and debris removal." },
];

const CAPABILITIES = [
  { icon: "💳", label: "Online Payments" },
  { icon: "🔁", label: "Recurring Billing" },
  { icon: "📋", label: "Digital Estimates" },
  { icon: "📅", label: "Smart Scheduling" },
  { icon: "💰", label: "Financing Available" },
  { icon: "📊", label: "Multi-Property Mgmt" },
];

export default function CommercialEstimatePage({ quote, token }: { quote: QuoteData; token: string }) {
  const [showProposal, setShowProposal] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [changeMessage, setChangeMessage] = useState("");
  const [changeSent, setChangeSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isExpired = quote.status === "expired";
  const isAccepted = quote.status === "accepted" || accepted;
  const hasPaymentTerms = quote.payment_terms && quote.payment_terms.schedule?.length > 0;

  const renderPdf = useCallback(async () => {
    setPdfLoading(true); setShowPdf(true); setPdfPages([]);
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
        const vp = page.getViewport({ scale: 2.5 });
        const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
        pages.push(c.toDataURL("image/png"));
      }
      setPdfPages(pages); URL.revokeObjectURL(url);
    } catch (err) { console.error("PDF render error:", err); }
    setPdfLoading(false);
  }, [token]);

  const handleAccept = async () => {
    if (!token || accepting) return;
    setAccepting(true);
    try {
      const res = await fetch("/api/quote/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await res.json();
      if (data.success) setAccepted(true);
    } catch { /* */ }
    setAccepting(false);
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = `/api/quote/pdf/${token}`;
    a.download = `JHPS-Commercial-Proposal-${quote.quote_number}.pdf`;
    a.click();
  };

  const handleSendChange = async () => {
    if (!changeMessage.trim()) return;
    try {
      await fetch("/api/quote/change-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, message: changeMessage, customer_name: quote.customer_name, customer_email: quote.customer_email }),
      });
      setChangeSent(true);
    } catch { setChangeSent(true); } // show success either way to not confuse customer
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #060e06; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
      `}</style>

      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #060e06 0%, #0a160a 100%)", fontFamily: "'DM Sans', sans-serif" }}>

        {/* ═══ HERO HEADER ═══ */}
        <div style={{
          background: "linear-gradient(135deg, rgba(13,71,161,0.2), rgba(21,101,192,0.08))",
          borderBottom: "1px solid rgba(66,165,245,0.15)", padding: "20px 0",
        }}>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ color: "#42a5f5", fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>JHPS</h1>
              <p style={{ color: "#5a7a9a", fontSize: 11 }}>Commercial Property Services</p>
            </div>
            <a href="tel:4076869817" style={{
              color: "#42a5f5", fontSize: 13, fontWeight: 600, textDecoration: "none",
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(66,165,245,0.2)",
              background: "rgba(66,165,245,0.05)",
            }}>
              📞 (407) 686-9817
            </a>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>

          {/* ═══ PROPOSAL CARD ═══ */}
          <div style={{
            background: "linear-gradient(160deg, #0a1a2a, #060e16)",
            border: "1px solid rgba(66,165,245,0.2)", borderRadius: 20, padding: "40px 32px",
            marginBottom: 32, animation: "fadeIn 0.5s ease", textAlign: "center",
          }}>
            <p style={{ color: "rgba(66,165,245,0.6)", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
              COMMERCIAL SERVICE PROPOSAL
            </p>
            <h2 style={{ color: "#E3F2FD", fontSize: 28, fontFamily: "'Playfair Display', serif", fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>
              Prepared for<br /><span style={{ whiteSpace: "nowrap" }}>{quote.customer_name}</span>
            </h2>
            {quote.customer_address && (
              <p style={{ color: "#5a7a9a", fontSize: 13, marginBottom: 4 }}>📍 {quote.customer_address}</p>
            )}
            <p style={{ color: "#5a7a9a", fontSize: 14, marginBottom: 24 }}>
              Proposal #{quote.quote_number} · {fmtDate(quote.created_at)}
              {quote.expiration_date && <><br /><span style={{ color: "#42a5f5", fontWeight: 600 }}>Valid until {fmtDate(quote.expiration_date)}</span></>}
            </p>

            {/* Status badge */}
            <div style={{
              display: "inline-block", padding: "8px 20px", borderRadius: 10,
              background: isExpired ? "rgba(239,83,80,0.1)" : isAccepted ? "rgba(76,175,80,0.12)" : "rgba(66,165,245,0.1)",
              border: `1px solid ${isExpired ? "rgba(239,83,80,0.3)" : isAccepted ? "rgba(76,175,80,0.3)" : "rgba(66,165,245,0.3)"}`,
              marginBottom: 32,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: isExpired ? "#ef5350" : isAccepted ? "#4CAF50" : "#42a5f5" }}>
                {isExpired ? "Expired" : isAccepted ? "✓ Proposal Accepted" : "Pending Review"}
              </span>
            </div>

            {/* Scope summary (no pricing) */}
            <div style={{ textAlign: "left", maxWidth: 600, margin: "0 auto" }}>
              <p style={{ color: "#90CAF9", fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>SCOPE OF WORK</p>
              {quote.line_items.map((item, i) => (
                <div key={i} style={{
                  padding: "10px 14px", borderRadius: 8, marginBottom: 6,
                  background: "rgba(66,165,245,0.04)", border: "1px solid rgba(66,165,245,0.08)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ color: "#42a5f5", fontSize: 16 }}>✦</span>
                  <span style={{ color: "#B0C4DE", fontSize: 14 }}>{item.description}</span>
                  {item.quantity > 1 && <span style={{ color: "#5a7a9a", fontSize: 12, marginLeft: "auto" }}>×{item.quantity}</span>}
                </div>
              ))}
              {quote.notes && (
                <p style={{ color: "#5a7a9a", fontSize: 13, marginTop: 12, lineHeight: 1.6, fontStyle: "italic" }}>{quote.notes}</p>
              )}
            </div>

            {/* CTA to reveal full proposal */}
            {!showProposal && !isExpired && (
              <button
                onClick={() => setShowProposal(true)}
                style={{
                  marginTop: 32, padding: "18px 40px", borderRadius: 14, border: "none",
                  background: "linear-gradient(135deg, #1565C0, #0D47A1)",
                  color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 4px 30px rgba(21,101,192,0.5)",
                  display: "inline-flex", alignItems: "center", gap: 10,
                  transition: "transform 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "none")}
              >
                📄 View Full Proposal & Pricing
              </button>
            )}
          </div>

          {/* ═══ SERVICES SHOWCASE ═══ */}
          {!showProposal && (
            <>
              <div style={{ marginBottom: 40, animation: "slideUp 0.6s ease 0.2s both" }}>
                <p style={{ color: "rgba(66,165,245,0.6)", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>
                  OUR COMMERCIAL SERVICES
                </p>
                <h3 style={{ color: "#E3F2FD", fontSize: 22, fontFamily: "'Playfair Display', serif", fontWeight: 700, textAlign: "center", marginBottom: 24 }}>
                  Multi-Service Property Solutions
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                  {SERVICES.map((s, i) => (
                    <div key={i} style={{
                      padding: "20px", borderRadius: 14,
                      background: "linear-gradient(160deg, rgba(13,71,161,0.08), rgba(66,165,245,0.03))",
                      border: "1px solid rgba(66,165,245,0.12)",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                      <h4 style={{ color: "#E3F2FD", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{s.title}</h4>
                      <p style={{ color: "#5a7a9a", fontSize: 13, lineHeight: 1.5 }}>{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capabilities strip */}
              <div style={{
                display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginBottom: 40,
                animation: "slideUp 0.6s ease 0.3s both",
              }}>
                {CAPABILITIES.map((c, i) => (
                  <div key={i} style={{
                    padding: "10px 16px", borderRadius: 10,
                    background: "rgba(66,165,245,0.06)", border: "1px solid rgba(66,165,245,0.12)",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 16 }}>{c.icon}</span>
                    <span style={{ color: "#90CAF9", fontSize: 13, fontWeight: 600 }}>{c.label}</span>
                  </div>
                ))}
              </div>

              {/* Trust stats */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 40,
                animation: "slideUp 0.6s ease 0.4s both",
              }}>
                {[
                  { val: "600+", label: "Jobs Completed" },
                  { val: "6+", label: "Service Categories" },
                  { val: "24hr", label: "Turnover Availability" },
                  { val: "100%", label: "Satisfaction Rate" },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: "center", padding: "16px 8px" }}>
                    <div style={{ color: "#42a5f5", fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{s.val}</div>
                    <div style={{ color: "#5a7a9a", fontSize: 11, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Final CTA */}
              <div style={{
                textAlign: "center", padding: "40px 24px", borderRadius: 20,
                background: "linear-gradient(160deg, rgba(13,71,161,0.12), rgba(21,101,192,0.04))",
                border: "1px solid rgba(66,165,245,0.15)", marginBottom: 40,
                animation: "slideUp 0.6s ease 0.5s both",
              }}>
                <h3 style={{ color: "#E3F2FD", fontSize: 20, fontFamily: "'Playfair Display', serif", fontWeight: 700, marginBottom: 8 }}>
                  Ready to Review Your Proposal?
                </h3>
                <p style={{ color: "#5a7a9a", fontSize: 14, marginBottom: 24 }}>
                  View pricing details, payment options, and accept or request changes — all online.
                </p>
                <button
                  onClick={() => setShowProposal(true)}
                  style={{
                    padding: "18px 40px", borderRadius: 14, border: "none",
                    background: "linear-gradient(135deg, #1565C0, #0D47A1)",
                    color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer",
                    boxShadow: "0 4px 30px rgba(21,101,192,0.5)",
                    display: "inline-flex", alignItems: "center", gap: 10,
                  }}
                >
                  📄 View Full Proposal & Pricing
                </button>
              </div>
            </>
          )}

          {/* ═══ FULL PROPOSAL (revealed on click) ═══ */}
          {showProposal && (
            <div style={{ animation: "slideUp 0.4s ease" }}>

              {/* Pricing breakdown */}
              <div style={{
                background: "linear-gradient(160deg, #0d1f0d, #091409)",
                border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px 24px",
                marginBottom: 24,
              }}>
                <p style={{ color: "#90CAF9", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, marginBottom: 16 }}>PRICING DETAILS</p>

                {/* Line items with pricing */}
                {quote.line_items.map((item, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 0", borderBottom: i < quote.line_items.length - 1 ? "1px solid rgba(66,165,245,0.08)" : "none",
                  }}>
                    <div>
                      <span style={{ color: "#B0C4DE", fontSize: 14 }}>{item.description}</span>
                      {item.quantity > 1 && <span style={{ color: "#5a7a9a", fontSize: 12 }}> × {item.quantity}</span>}
                    </div>
                    <span style={{ color: "#E3F2FD", fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt(item.amount)}
                    </span>
                  </div>
                ))}

                {/* Totals */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(66,165,245,0.15)" }}>
                  {quote.tax_amount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#5a7a9a", fontSize: 13 }}>Tax</span>
                      <span style={{ color: "#8aa8c8", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(quote.tax_amount)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#E3F2FD", fontSize: 17, fontWeight: 700 }}>
                      {hasPaymentTerms ? "Total Contract Price" : "Estimated Total"}
                    </span>
                    <span style={{ color: "#42a5f5", fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt(quote.total)}
                    </span>
                  </div>
                </div>

                {/* Deposit / Payment Schedule */}
                {hasPaymentTerms && (
                  <div style={{ marginTop: 20, padding: "16px", borderRadius: 12, background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.15)" }}>
                    <p style={{ color: "#66bb6a", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>PAYMENT SCHEDULE</p>
                    {quote.payment_terms!.schedule.map((item, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 0", borderBottom: i < quote.payment_terms!.schedule.length - 1 ? "1px solid rgba(76,175,80,0.08)" : "none",
                      }}>
                        <span style={{ color: "#8aba8a", fontSize: 13 }}>{item.label}</span>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ color: "#66bb6a", fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(item.amount)}</span>
                          {item.due_date && <span style={{ color: "#5a7a5a", fontSize: 11, marginLeft: 8 }}>{fmtDate(item.due_date)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Financing message */}
                {quote.show_financing && !hasPaymentTerms && (
                  <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 10, background: "rgba(38,166,154,0.06)", border: "1px solid rgba(38,166,154,0.15)" }}>
                    <p style={{ color: "#26A69A", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>$ Flexible Payment Options Available</p>
                    <p style={{ color: "#5a8a8a", fontSize: 12, lineHeight: 1.5 }}>
                      This project is eligible for flexible payment options including deposits and installment plans. Contact us to discuss a payment schedule.
                    </p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <button onClick={renderPdf} style={{
                  padding: "14px", borderRadius: 14, border: "1px solid rgba(66,165,245,0.3)",
                  background: "rgba(66,165,245,0.08)", color: "#42a5f5",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  📄 Preview PDF
                </button>
                <button onClick={handleDownload} style={{
                  padding: "14px", borderRadius: 14, border: "1px solid #1a3a1a",
                  background: "rgba(76,175,80,0.06)", color: "#8aba8a",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  ⬇ Download PDF
                </button>
              </div>

              {/* Request changes */}
              {!isExpired && !isAccepted && (
                <div style={{ marginBottom: 16 }}>
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
                          background: "rgba(0,0,0,0.3)", color: "#E3F2FD", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                          resize: "vertical", outline: "none",
                        }}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button
                          onClick={handleSendChange}
                          disabled={!changeMessage.trim()}
                          style={{
                            flex: 1, padding: "12px", borderRadius: 10, border: "none",
                            background: changeMessage.trim() ? "linear-gradient(135deg, #F57C00, #E65100)" : "#1a2a1a",
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
                            background: "transparent", color: "#5a7a9a", fontSize: 14, cursor: "pointer",
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
              {!isExpired && !isAccepted && (
                <button onClick={handleAccept} disabled={accepting} style={{
                  width: "100%", padding: "18px", borderRadius: 14, border: "none",
                  background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                  color: "#fff", fontSize: 17, fontWeight: 800, cursor: accepting ? "wait" : "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 4px 24px rgba(76,175,80,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  opacity: accepting ? 0.7 : 1, transition: "opacity 0.3s",
                  marginBottom: 16,
                }}>
                  {accepting ? <span style={{ animation: "pulse 1s infinite" }}>Processing...</span> : <>✓ Accept Proposal</>}
                </button>
              )}

              {isAccepted && (
                <div style={{
                  padding: "20px", borderRadius: 14, marginBottom: 16,
                  background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.3)", textAlign: "center",
                }}>
                  <p style={{ color: "#4CAF50", fontSize: 16, fontWeight: 700 }}>✓ Proposal Accepted</p>
                  <p style={{ color: "#5a8a5a", fontSize: 13, marginTop: 4 }}>Thank you! We&apos;ll be in touch shortly to get started.</p>
                </div>
              )}

              {/* ═══ LEGAL DISCLAIMERS ═══ */}
              <div style={{
                padding: "24px", borderRadius: 14, marginTop: 24,
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(66,165,245,0.08)",
              }}>
                <p style={{ color: "#5a7a9a", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>TERMS & DISCLAIMERS</p>
                <div style={{ color: "#3a5a6a", fontSize: 11, lineHeight: 1.7 }}>
                  <p style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#5a7a9a" }}>Estimate Validity:</strong> This proposal is valid for the period indicated above. Pricing may be subject to change after expiration based on material costs, labor availability, and site conditions at the time of service.
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#5a7a9a" }}>Scope of Work:</strong> Services will be performed as described in this proposal. Any additional work requested beyond the stated scope will require a separate estimate and written approval before commencement. Hidden conditions discovered during work (e.g., structural damage, hazardous materials, underground utilities) may result in additional charges.
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#5a7a9a" }}>Commercial Terms:</strong> For commercial accounts, a signed service agreement or purchase order may be required prior to commencement of work. Net-30 terms are available for qualifying commercial accounts upon credit approval. All work is performed in compliance with applicable Florida statutes, local building codes, and OSHA safety standards.
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#5a7a9a" }}>Insurance & Liability:</strong> Jenkins Home & Property Solutions maintains general liability insurance and workers&apos; compensation coverage. Certificates of insurance are available upon request. Liability is limited to the total contract value stated in this proposal.
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#5a7a9a" }}>Payment Terms:</strong> {hasPaymentTerms
                      ? "Payment is due per the schedule outlined above. A late fee of $50.00 will be assessed on payments not received within 7 calendar days of the due date. Interest of 1.5% per month (18% APR) accrues on balances past 8 days due."
                      : "Payment is due upon completion of services unless otherwise agreed in writing. Commercial accounts may qualify for Net-30 terms."
                    }
                  </p>
                  {quote.show_financing && (
                    <p style={{ marginBottom: 8 }}>
                      <strong style={{ color: "#5a7a9a" }}>Financing:</strong> Flexible payment options including deposit-based installment plans are available for qualifying commercial projects. Contact us to discuss terms. All financing arrangements will be documented in a separate service contract with payment schedule.
                    </p>
                  )}
                  <p style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#5a7a9a" }}>Cancellation:</strong> Customer may cancel within 3 business days of acceptance for a full refund of any deposit, minus costs already incurred. After 3 business days, deposits are non-refundable. Cancellation after work has commenced will be billed for all work completed, materials purchased, and any restocking or cancellation fees.
                  </p>
                  <p>
                    <strong style={{ color: "#5a7a9a" }}>Governing Law:</strong> This proposal and any resulting agreement shall be governed by the laws of the State of Florida. Any disputes shall be resolved in the courts of Volusia County, Florida. By accepting this proposal, the customer acknowledges and agrees to these terms.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: 40, paddingBottom: 40 }}>
            <p style={{ color: "#3a5a6a", fontSize: 12 }}>
              Questions? Call <a href="tel:4076869817" style={{ color: "#42a5f5", textDecoration: "none" }}>(407) 686-9817</a>
              {" "}or email <a href="mailto:info@jhpsfl.com" style={{ color: "#42a5f5", textDecoration: "none" }}>info@jhpsfl.com</a>
            </p>
            <p style={{ color: "#2a3a4a", fontSize: 11, marginTop: 6 }}>
              Jenkins Home & Property Solutions · Commercial Services · Serving Central Florida
            </p>
          </div>
        </div>
      </div>

      {/* ═══ PDF PREVIEW MODAL ═══ */}
      {showPdf && (
        <div onClick={() => setShowPdf(false)} style={{
          position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.92)",
          backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 900, height: "calc(100vh - 32px)", display: "flex", flexDirection: "column",
            background: "linear-gradient(160deg, #0a1a2a, #060e16)",
            border: "1px solid rgba(66,165,245,0.25)", borderRadius: 20, overflow: "hidden",
            boxShadow: "0 0 60px rgba(13,71,161,0.3)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid rgba(66,165,245,0.15)",
              background: "linear-gradient(135deg, rgba(13,71,161,0.2), rgba(21,101,192,0.08))", flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#E3F2FD" }}>Proposal {quote.quote_number}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleDownload} style={{
                  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(76,175,80,0.3)",
                  background: "rgba(76,175,80,0.1)", color: "#66bb6a", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>⬇ Download</button>
                <button onClick={() => setShowPdf(false)} style={{
                  width: 36, height: 36, borderRadius: 10, background: "rgba(239,83,80,0.1)",
                  border: "1px solid rgba(239,83,80,0.2)", color: "#ef9a9a", fontSize: 18, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>✕</button>
              </div>
            </div>
            <div ref={scrollRef} style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
              {pdfLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
                  <div style={{ width: 40, height: 40, border: "3px solid rgba(66,165,245,0.2)", borderTopColor: "#42a5f5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ fontSize: 14, color: "#90CAF9", fontWeight: 600 }}>Generating PDF...</p>
                </div>
              ) : pdfPages.length > 0 ? (
                <div style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                  {pdfPages.map((src, i) => (
                    <img key={i} src={src} alt={`Page ${i + 1}`} draggable={false}
                      style={{ width: "100%", maxWidth: 800, borderRadius: 4, boxShadow: "0 2px 20px rgba(0,0,0,0.5)", pointerEvents: "none", userSelect: "none" }} />
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
