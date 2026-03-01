"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

// Google Business review link — update with your actual Google Place ID
const GOOGLE_REVIEW_URL = "https://g.page/r/JHPS-REVIEW-LINK/review"; // TODO: Replace with actual Google Business review URL

const LOST_ESTIMATE_REASONS = [
  { key: "price", icon: "💰", label: "Pricing didn't fit our budget" },
  { key: "timing", icon: "📅", label: "Went with someone who could start sooner" },
  { key: "postponed", icon: "⏸️", label: "Decided to postpone the project" },
  { key: "reviews", icon: "⭐", label: "Chose a company with more reviews" },
  { key: "proposal", icon: "📋", label: "Other proposal was more detailed" },
  { key: "other", icon: "💬", label: "Other" },
];

export default function FeedbackPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackData, setFeedbackData] = useState<{
    type: string;
    status: string;
    first_name: string;
  } | null>(null);

  // Post-service state
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [step, setStep] = useState<"rate" | "followup" | "done">("rate");

  // Lost estimate state
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherDetail, setOtherDetail] = useState("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/feedback/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.status === "responded" ? "responded" : "not_found");
        } else if (data.status === "responded") {
          setError("responded");
        } else {
          setFeedbackData(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("not_found");
        setLoading(false);
      });
  }, [token]);

  // ─── Submit post-service feedback ───
  async function submitPostService(requestResolution: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          comment: comment.trim() || null,
          resolution_requested: requestResolution,
          google_review_clicked: false,
        }),
      });
      if (res.ok) {
        setStep("done");
      }
    } catch {
      // Silently handle
    }
    setSubmitting(false);
  }

  // ─── Track Google review click ───
  function handleGoogleReviewClick() {
    // Fire and forget the tracking update
    fetch("/api/feedback/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        rating,
        comment: comment.trim() || null,
        google_review_clicked: true,
        resolution_requested: false,
      }),
    });
    setStep("done");
    window.open(GOOGLE_REVIEW_URL, "_blank");
  }

  // ─── Submit lost estimate feedback ───
  async function submitLostEstimate() {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          lost_estimate_reason: selectedReason,
          lost_estimate_detail: selectedReason === "other" ? otherDetail.trim() || null : null,
        }),
      });
      if (res.ok) {
        setStep("done");
      }
    } catch {
      // Silently handle
    }
    setSubmitting(false);
  }

  // ─── Loading ───
  if (loading) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 32, marginBottom: 16, animation: "pulse 1.5s infinite" }}>🌿</div>
          <p style={{ color: "#5a8a5a", fontSize: 14 }}>Loading...</p>
        </div>
      </Shell>
    );
  }

  // ─── Error states ───
  if (error === "responded") {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: "#e8f5e8", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Thank You!</h2>
          <p style={{ color: "#5a8a5a", fontSize: 14 }}>You&apos;ve already submitted your feedback. We truly appreciate it!</p>
        </div>
      </Shell>
    );
  }

  if (error || !feedbackData) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h2 style={{ color: "#e8f5e8", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Link Not Found</h2>
          <p style={{ color: "#5a8a5a", fontSize: 14 }}>This feedback link may have expired or is no longer valid.</p>
        </div>
      </Shell>
    );
  }

  // ─── POST-SERVICE: Done state ───
  if (step === "done") {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🙏</div>
          <h2 style={{ color: "#e8f5e8", fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>Thank You, {feedbackData.first_name}!</h2>
          {feedbackData.type === "post_service" && rating && rating <= 3 ? (
            <p style={{ color: "#FFB74D", fontSize: 15, lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
              We&apos;re sorry we didn&apos;t fully meet your expectations. Your feedback has been sent directly to our team lead, and we&apos;ll be reaching out within 24 hours to make this right.
            </p>
          ) : (
            <p style={{ color: "#5a8a5a", fontSize: 15, lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
              Your feedback means the world to us. Thank you for helping us improve and continue to serve Central Florida with pride.
            </p>
          )}
        </div>
      </Shell>
    );
  }

  // ─── LOST ESTIMATE flow ───
  if (feedbackData.type === "lost_estimate") {
    return (
      <Shell>
        <div style={{ padding: "32px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h2 style={{ color: "#e8f5e8", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
              Thank you, {feedbackData.first_name}
            </h2>
            <p style={{ color: "#5a8a5a", fontSize: 14, lineHeight: 1.6, maxWidth: 380, margin: "0 auto" }}>
              We appreciate you considering JHPS. What was the biggest factor in your decision? Just one tap:
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420, margin: "0 auto" }}>
            {LOST_ESTIMATE_REASONS.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelectedReason(r.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 20px",
                  borderRadius: 12,
                  border: selectedReason === r.key ? "2px solid #4CAF50" : "1px solid #1a3a1a",
                  background: selectedReason === r.key ? "rgba(76,175,80,0.08)" : "rgba(255,255,255,0.02)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 15,
                  color: selectedReason === r.key ? "#e8f5e8" : "#8aaa8a",
                  fontWeight: selectedReason === r.key ? 600 : 400,
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>

          {/* Other detail field */}
          {selectedReason === "other" && (
            <div style={{ maxWidth: 420, margin: "16px auto 0" }}>
              <textarea
                placeholder="We'd love to know more (optional)..."
                value={otherDetail}
                onChange={(e) => setOtherDetail(e.target.value)}
                maxLength={500}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid #1a3a1a",
                  background: "rgba(255,255,255,0.03)",
                  color: "#e8f5e8",
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical",
                  minHeight: 80,
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* Submit */}
          {selectedReason && (
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <button
                onClick={submitLostEstimate}
                disabled={submitting}
                style={{
                  padding: "14px 40px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: submitting ? "default" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {submitting ? "Sending..." : "Submit Feedback"}
              </button>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  // ─── POST-SERVICE: Rating step ───
  if (step === "rate") {
    return (
      <Shell>
        <div style={{ padding: "32px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h2 style={{ color: "#e8f5e8", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
              How did we do, {feedbackData.first_name}?
            </h2>
            <p style={{ color: "#5a8a5a", fontSize: 14, lineHeight: 1.6 }}>
              Your honest feedback helps us improve
            </p>
          </div>

          {/* Star rating */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                style={{
                  fontSize: 42,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "transform 0.15s",
                  transform: (hoverRating || rating || 0) >= star ? "scale(1.15)" : "scale(1)",
                  filter: (hoverRating || rating || 0) >= star ? "none" : "grayscale(1) opacity(0.3)",
                  padding: 4,
                }}
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
              >
                ⭐
              </button>
            ))}
          </div>

          {/* Rating label */}
          {(hoverRating || rating) && (
            <p style={{ textAlign: "center", color: "#8aaa8a", fontSize: 13, marginBottom: 20 }}>
              {["", "Poor", "Below Average", "Average", "Great", "Excellent"][hoverRating || rating || 0]}
            </p>
          )}

          {/* Comment (optional) */}
          {rating && (
            <>
              <textarea
                placeholder="Anything you'd like to add? (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid #1a3a1a",
                  background: "rgba(255,255,255,0.03)",
                  color: "#e8f5e8",
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical",
                  minHeight: 80,
                  boxSizing: "border-box",
                  marginBottom: 20,
                }}
              />

              <div style={{ textAlign: "center" }}>
                <button
                  onClick={() => setStep("followup")}
                  style={{
                    padding: "14px 40px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Continue
                </button>
              </div>
            </>
          )}
        </div>
      </Shell>
    );
  }

  // ─── POST-SERVICE: Follow-up step (Google review OR resolution) ───
  // This is the compliant approach: EVERYONE sees the Google review link
  // regardless of their rating. We additionally offer resolution for unhappy customers.
  if (step === "followup") {
    const isHappy = rating && rating >= 4;
    const isUnhappy = rating && rating <= 3;

    return (
      <Shell>
        <div style={{ padding: "32px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{isHappy ? "🎉" : "🙏"}</div>
            <h2 style={{ color: "#e8f5e8", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
              {isHappy ? "We're glad you had a great experience!" : "Thank you for your honesty"}
            </h2>
            <p style={{ color: "#5a8a5a", fontSize: 14, lineHeight: 1.6, maxWidth: 380, margin: "0 auto" }}>
              {isHappy
                ? "If you have a moment, a Google review would mean the world to our small business."
                : "Your feedback is truly valuable. Here's how we can move forward:"}
            </p>
          </div>

          {/* Google Review button — shown to EVERYONE (compliant) */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <button
              onClick={handleGoogleReviewClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "16px 32px",
                borderRadius: 12,
                border: "none",
                background: isHappy ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "rgba(76,175,80,0.1)",
                color: isHappy ? "#fff" : "#4CAF50",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                ...(isHappy ? {} : { border: "1px solid rgba(76,175,80,0.3)" }),
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Leave a Google Review
            </button>
          </div>

          {/* Resolution option for unhappy customers */}
          {isUnhappy && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <div style={{ background: "rgba(255,183,77,0.08)", border: "1px solid rgba(255,183,77,0.2)", borderRadius: 12, padding: 20, maxWidth: 400, margin: "0 auto" }}>
                <p style={{ color: "#FFB74D", fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>
                  We take your satisfaction seriously. If you&apos;d prefer, we can have our team lead reach out to you directly to discuss how we can make things right.
                </p>
                <button
                  onClick={() => submitPostService(true)}
                  disabled={submitting}
                  style={{
                    padding: "12px 28px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,183,77,0.4)",
                    background: "rgba(255,183,77,0.1)",
                    color: "#FFB74D",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: submitting ? "default" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  {submitting ? "Sending..." : "Yes, please reach out to me"}
                </button>
              </div>
            </div>
          )}

          {/* Skip / just submit */}
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button
              onClick={() => submitPostService(false)}
              disabled={submitting}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: "none",
                color: "#5a8a5a",
                fontSize: 13,
                cursor: submitting ? "default" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {isHappy ? "No thanks, just submit my feedback" : "Just submit my feedback"}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return null;
}

// ─── Shell wrapper ───────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #080f08, #0d1a0d, #091209)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          maxWidth: 500,
          width: "100%",
          background: "linear-gradient(160deg, #0d1f0d, #091409)",
          border: "1px solid #1a3a1a",
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
            padding: "20px 24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
            Jenkins Home &amp; Property Solutions
          </h1>
          <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
            Central Florida&rsquo;s Trusted Property Services
          </p>
        </div>
        {children}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  );
}
