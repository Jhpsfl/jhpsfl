"use client";

import { useState } from "react";

interface FeedbackModalProps {
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    company_name: string | null;
    customer_type: string | null;
  };
  jobs: Array<{
    id: string;
    service_type: string;
    status: string;
    completed_date: string | null;
    amount: number | null;
    description: string | null;
    created_at: string;
  }>;
  quotes: Array<{
    id: string;
    quote_number: string;
    status: string;
    total: number;
    created_at: string;
    is_commercial?: boolean;
    line_items?: Array<{ description: string }>;
  }>;
  feedbackHistory: Array<{
    id: string;
    type: string;
    status: string;
    sent_at: string;
  }>;
  preselect?: { type?: "post_service" | "lost_estimate"; quoteId?: string } | null;
  onClose: () => void;
  onSend: (params: {
    type: "post_service" | "lost_estimate";
    job_id?: string;
    quote_id?: string;
  }) => Promise<void>;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function FeedbackModal({ customer, jobs, quotes, feedbackHistory, preselect, onClose, onSend }: FeedbackModalProps) {
  // If preselect is provided, jump straight to preview with that selection
  const hasPreselect = preselect?.type && preselect?.quoteId;
  const [step, setStep] = useState<"choose_type" | "select_job" | "select_estimate" | "preview">(hasPreselect ? "preview" : "choose_type");
  const [feedbackType, setFeedbackType] = useState<"post_service" | "lost_estimate" | null>(hasPreselect ? (preselect.type || null) : null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(hasPreselect ? (preselect.quoteId || null) : null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const firstName = (customer.name || "Customer").split(" ")[0];

  // Completed jobs eligible for feedback
  const completedJobs = jobs.filter(j => j.status === "completed");

  // Lost estimates (declined, expired, or sent 14+ days ago with no response)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
  const lostEstimates = quotes.filter(q =>
    q.status === "declined" || q.status === "expired" ||
    (q.status === "sent" && q.created_at < fourteenDaysAgo)
  );

  // Already-sent feedback checks
  const recentFeedback = (type: string, refId?: string) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    return feedbackHistory.some(f => f.type === type && f.sent_at >= sevenDaysAgo);
  };

  const hasRecentPostService = recentFeedback("post_service");
  const hasRecentLostEstimate = recentFeedback("lost_estimate");

  // Handle send
  const handleSend = async () => {
    if (!feedbackType) return;
    setSending(true);
    try {
      await onSend({
        type: feedbackType,
        job_id: selectedJobId || undefined,
        quote_id: selectedQuoteId || undefined,
      });
      setSent(true);
    } catch {
      // Error handled by parent
    }
    setSending(false);
  };

  // Selected items for preview
  const selectedJob = completedJobs.find(j => j.id === selectedJobId);
  const selectedQuote = lostEstimates.find(q => q.id === selectedQuoteId);

  return (
    <div className="FeedbackModal" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(160deg, #0d1f0d, #091409)", border: "1px solid #1a3a1a", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "85vh", overflow: "auto", WebkitOverflowScrolling: "touch" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #1a3a1a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e8f5e8", fontFamily: "'Playfair Display', serif" }}>
              {sent ? "Feedback Sent!" : "Request Feedback"}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#5a8a5a" }}>
              {customer.name || customer.email}{customer.company_name ? ` · ${customer.company_name}` : ""}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 20, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* ═══ SENT CONFIRMATION ═══ */}
          {sent && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ color: "#4CAF50", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                {feedbackType === "post_service" ? "Feedback request sent!" : "Follow-up email sent!"}
              </p>
              <p style={{ color: "#5a8a5a", fontSize: 13, lineHeight: 1.5 }}>
                {firstName} will receive the email shortly at <strong style={{ color: "#8aaa8a" }}>{customer.email}</strong>
              </p>
              <button onClick={onClose} style={{ marginTop: 20, padding: "10px 28px", borderRadius: 10, border: "1px solid #1a3a1a", background: "rgba(76,175,80,0.1)", color: "#4CAF50", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
            </div>
          )}

          {/* ═══ STEP 1: CHOOSE TYPE ═══ */}
          {!sent && step === "choose_type" && (
            <>
              {/* No email warning */}
              {!customer.email && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(198,40,40,0.08)", border: "1px solid rgba(198,40,40,0.2)", marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#EF5350" }}>⚠️ This customer doesn't have an email address on file. Add one first to send feedback requests.</p>
                </div>
              )}

              <p style={{ color: "#8aaa8a", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                What kind of feedback do you want to request from {firstName}?
              </p>

              {/* Post-Service Option */}
              <button
                disabled={!customer.email || completedJobs.length === 0}
                onClick={() => {
                  setFeedbackType("post_service");
                  if (completedJobs.length === 1) {
                    setSelectedJobId(completedJobs[0].id);
                    setStep("preview");
                  } else {
                    setStep("select_job");
                  }
                }}
                style={{
                  width: "100%", textAlign: "left", padding: "18px 20px", borderRadius: 14, marginBottom: 10,
                  border: "1px solid rgba(255,215,0,0.2)", background: "rgba(255,215,0,0.04)",
                  cursor: !customer.email || completedJobs.length === 0 ? "default" : "pointer",
                  opacity: !customer.email || completedJobs.length === 0 ? 0.4 : 1,
                  fontFamily: "inherit",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 28 }}>⭐</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#FFD700", marginBottom: 4 }}>Service Feedback</div>
                    <div style={{ fontSize: 12, color: "#5a8a5a", lineHeight: 1.5 }}>
                      Ask how their experience was. They'll rate the service, leave optional comments, and see a path to leave a Google review.
                    </div>
                    {completedJobs.length === 0 && (
                      <div style={{ fontSize: 11, color: "#FF8A65", marginTop: 4 }}>No completed jobs for this customer</div>
                    )}
                    {hasRecentPostService && (
                      <div style={{ fontSize: 11, color: "#FF8A65", marginTop: 4 }}>⏰ Feedback already requested within the last 7 days</div>
                    )}
                    {completedJobs.length > 0 && (
                      <div style={{ fontSize: 11, color: "#3a5a3a", marginTop: 4 }}>{completedJobs.length} completed job{completedJobs.length > 1 ? "s" : ""}</div>
                    )}
                  </div>
                </div>
              </button>

              {/* Lost Estimate Option */}
              <button
                disabled={!customer.email || lostEstimates.length === 0}
                onClick={() => {
                  setFeedbackType("lost_estimate");
                  if (lostEstimates.length === 1) {
                    setSelectedQuoteId(lostEstimates[0].id);
                    setStep("preview");
                  } else {
                    setStep("select_estimate");
                  }
                }}
                style={{
                  width: "100%", textAlign: "left", padding: "18px 20px", borderRadius: 14, marginBottom: 10,
                  border: "1px solid rgba(66,165,245,0.2)", background: "rgba(66,165,245,0.04)",
                  cursor: !customer.email || lostEstimates.length === 0 ? "default" : "pointer",
                  opacity: !customer.email || lostEstimates.length === 0 ? 0.4 : 1,
                  fontFamily: "inherit",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 28 }}>📊</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#42a5f5", marginBottom: 4 }}>Lost Estimate Follow-Up</div>
                    <div style={{ fontSize: 12, color: "#5a8a5a", lineHeight: 1.5 }}>
                      Gracious thank-you email with a one-click poll asking why they didn't go with JHPS. Keeps the door open for future work.
                    </div>
                    {lostEstimates.length === 0 && (
                      <div style={{ fontSize: 11, color: "#FF8A65", marginTop: 4 }}>No declined or expired estimates for this customer</div>
                    )}
                    {hasRecentLostEstimate && (
                      <div style={{ fontSize: 11, color: "#FF8A65", marginTop: 4 }}>⏰ Follow-up already sent within the last 7 days</div>
                    )}
                    {lostEstimates.length > 0 && (
                      <div style={{ fontSize: 11, color: "#3a5a3a", marginTop: 4 }}>{lostEstimates.length} lost estimate{lostEstimates.length > 1 ? "s" : ""}</div>
                    )}
                  </div>
                </div>
              </button>
            </>
          )}

          {/* ═══ STEP 2A: SELECT JOB ═══ */}
          {!sent && step === "select_job" && (
            <>
              <button onClick={() => { setStep("choose_type"); setFeedbackType(null); }} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>← Back</button>
              <p style={{ color: "#8aaa8a", fontSize: 13, marginBottom: 14 }}>Which job are you requesting feedback for?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {completedJobs.map(j => (
                  <button key={j.id} onClick={() => { setSelectedJobId(j.id); setStep("preview"); }} style={{
                    width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 12,
                    border: "1px solid rgba(255,215,0,0.15)", background: "rgba(255,215,0,0.03)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#e8f5e8", textTransform: "capitalize" }}>{(j.service_type || "Service").replace(/_/g, " ")}</div>
                        {j.description && <div style={{ fontSize: 11, color: "#5a8a5a", marginTop: 2 }}>{j.description.slice(0, 60)}{j.description.length > 60 ? "..." : ""}</div>}
                        <div style={{ fontSize: 11, color: "#3a5a3a", marginTop: 4 }}>
                          Completed {j.completed_date ? formatDate(j.completed_date) : formatDate(j.created_at)}
                        </div>
                      </div>
                      {j.amount && <span style={{ fontSize: 14, fontWeight: 700, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(j.amount)}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ═══ STEP 2B: SELECT ESTIMATE ═══ */}
          {!sent && step === "select_estimate" && (
            <>
              <button onClick={() => { setStep("choose_type"); setFeedbackType(null); }} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>← Back</button>
              <p style={{ color: "#8aaa8a", fontSize: 13, marginBottom: 14 }}>Which estimate are you following up on?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lostEstimates.map(q => (
                  <button key={q.id} onClick={() => { setSelectedQuoteId(q.id); setStep("preview"); }} style={{
                    width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 12,
                    border: "1px solid rgba(66,165,245,0.15)", background: "rgba(66,165,245,0.03)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#42a5f5" }}>{q.quote_number}</span>
                          <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: q.status === "declined" ? "rgba(239,83,80,0.15)" : q.status === "expired" ? "rgba(255,138,101,0.15)" : "rgba(255,183,77,0.15)", color: q.status === "declined" ? "#EF5350" : q.status === "expired" ? "#FF8A65" : "#FFB74D" }}>{q.status.toUpperCase()}</span>
                        </div>
                        {q.line_items && q.line_items.length > 0 && (
                          <div style={{ fontSize: 11, color: "#5a8a5a", marginTop: 4 }}>{q.line_items.map(l => l.description).join(" · ")}</div>
                        )}
                        <div style={{ fontSize: 11, color: "#3a5a3a", marginTop: 4 }}>{formatDate(q.created_at)}</div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#42a5f5", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(q.total)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ═══ STEP 3: PREVIEW & CONFIRM ═══ */}
          {!sent && step === "preview" && feedbackType && (
            <>
              <button onClick={() => {
                if (feedbackType === "post_service" && completedJobs.length > 1) setStep("select_job");
                else if (feedbackType === "lost_estimate" && lostEstimates.length > 1) setStep("select_estimate");
                else { setStep("choose_type"); setFeedbackType(null); }
              }} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 16, display: "flex", alignItems: "center", gap: 4 }}>← Back</button>

              {/* Preview card */}
              <div style={{ padding: "18px 20px", borderRadius: 14, background: feedbackType === "post_service" ? "rgba(255,215,0,0.04)" : "rgba(66,165,245,0.04)", border: `1px solid ${feedbackType === "post_service" ? "rgba(255,215,0,0.15)" : "rgba(66,165,245,0.15)"}`, marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#3a5a3a", marginBottom: 10, textTransform: "uppercase" }}>Email Preview</div>

                <div style={{ fontSize: 12, color: "#5a8a5a", marginBottom: 4 }}>
                  <strong style={{ color: "#8aaa8a" }}>To:</strong> {customer.email}
                </div>
                <div style={{ fontSize: 12, color: "#5a8a5a", marginBottom: 4 }}>
                  <strong style={{ color: "#8aaa8a" }}>From:</strong> info@jhpsfl.com
                </div>
                <div style={{ fontSize: 12, color: "#5a8a5a", marginBottom: 12 }}>
                  <strong style={{ color: "#8aaa8a" }}>Subject:</strong> {feedbackType === "post_service" ? "How did we do? — Jenkins Home & Property Solutions" : "Thank you for considering JHPS"}
                </div>

                <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 12, fontSize: 13, color: "#8aaa8a", lineHeight: 1.6 }}>
                  {feedbackType === "post_service" ? (
                    <>
                      <p style={{ margin: "0 0 8px" }}>Hi {firstName},</p>
                      <p style={{ margin: "0 0 8px" }}>Thank you for choosing Jenkins Home & Property Solutions! We take pride in every job we do, and your feedback helps us continue to improve.</p>
                      <p style={{ margin: 0 }}>Would you mind taking 30 seconds to let us know how your experience was?</p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 8px" }}>Hi {firstName},</p>
                      <p style={{ margin: "0 0 8px" }}>Thank you for giving us the opportunity to provide an estimate. We genuinely appreciate you taking the time to meet with us.</p>
                      <p style={{ margin: 0 }}>Whether you went in a different direction or decided to hold off for now, we completely understand. We'd be grateful if you could take a quick moment to share what factored into your decision.</p>
                    </>
                  )}
                </div>
              </div>

              {/* Context: what job/estimate this references */}
              {feedbackType === "post_service" && selectedJob && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(76,175,80,0.04)", border: "1px solid rgba(76,175,80,0.1)", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#3a5a3a", marginBottom: 6, textTransform: "uppercase" }}>Linked Job</div>
                  <div style={{ fontSize: 13, color: "#e8f5e8", textTransform: "capitalize" }}>{(selectedJob.service_type || "Service").replace(/_/g, " ")}</div>
                  <div style={{ fontSize: 11, color: "#5a8a5a", marginTop: 2 }}>
                    Completed {selectedJob.completed_date ? formatDate(selectedJob.completed_date) : formatDate(selectedJob.created_at)}
                    {selectedJob.amount ? ` · ${formatCurrency(selectedJob.amount)}` : ""}
                  </div>
                </div>
              )}

              {feedbackType === "lost_estimate" && selectedQuote && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(66,165,245,0.04)", border: "1px solid rgba(66,165,245,0.1)", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#3a5a3a", marginBottom: 6, textTransform: "uppercase" }}>Linked Estimate</div>
                  <div style={{ fontSize: 13, color: "#42a5f5", fontWeight: 600 }}>{selectedQuote.quote_number} · {formatCurrency(selectedQuote.total)}</div>
                  <div style={{ fontSize: 11, color: "#5a8a5a", marginTop: 2 }}>
                    {selectedQuote.status.charAt(0).toUpperCase() + selectedQuote.status.slice(1)} · {formatDate(selectedQuote.created_at)}
                  </div>
                </div>
              )}

              {/* What customer will see */}
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid #1a3a1a", marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#3a5a3a", marginBottom: 8, textTransform: "uppercase" }}>What {firstName} will see</div>
                {feedbackType === "post_service" ? (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#8aaa8a", lineHeight: 1.8 }}>
                    <li>Star rating (1-5)</li>
                    <li>Optional comment box</li>
                    <li>Google review link (when enabled)</li>
                    <li>Private resolution option if unhappy</li>
                  </ul>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#8aaa8a", lineHeight: 1.8 }}>
                    <li>One-click reason picker (budget, timing, postponed, reviews, proposal, other)</li>
                    <li>Optional detail field for "other"</li>
                    <li>Thank-you confirmation that keeps the door open</li>
                  </ul>
                )}
              </div>

              {/* Admin alert info */}
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,183,77,0.04)", border: "1px solid rgba(255,183,77,0.1)", marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#3a5a3a", marginBottom: 6, textTransform: "uppercase" }}>You'll be notified</div>
                <p style={{ margin: 0, fontSize: 12, color: "#8aaa8a", lineHeight: 1.5 }}>
                  {feedbackType === "post_service"
                    ? "You'll receive an email alert when they respond — both for positive reviews and negative feedback that needs attention."
                    : "You'll receive an email alert with the reason they chose, so you can refine your bidding and presentation."}
                </p>
              </div>

              {/* Send button */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={onClose} style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid #1a3a1a", background: "transparent", color: "#5a8a5a", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  style={{
                    padding: "12px 28px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                    color: "#fff", fontSize: 14, fontWeight: 700,
                    cursor: sending ? "default" : "pointer",
                    opacity: sending ? 0.6 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  {sending ? "Sending..." : feedbackType === "post_service" ? "Send Feedback Request" : "Send Follow-Up"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
