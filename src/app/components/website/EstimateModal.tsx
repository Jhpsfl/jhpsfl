"use client";

import { useState, useEffect, type CSSProperties } from "react";

export default function EstimateModal({ onClose, email }: { onClose: () => void; email: string }) {
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", zip: "", service: "", notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.phone) {
      setErrorMsg("Please fill in your name, email, and phone number.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submission failed");
      setSubmitted(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please call us directly.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const inputStyle: CSSProperties = {
    width: "100%", padding: "14px 16px", background: "#1a2a1a", border: "1px solid #2a4a2a",
    borderRadius: 10, color: "#e8f5e8", fontSize: 15, outline: "none", fontFamily: "inherit",
    transition: "border-color 0.3s",
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.3s ease", padding: 20, backdropFilter: "blur(8px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0d1f0d 0%, #132913 50%, #0a1a0a 100%)",
        borderRadius: 20, padding: "40px 32px", maxWidth: 480, width: "100%",
        border: "1px solid #1a3a1a", boxShadow: "0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(76,175,80,0.1)",
        animation: "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        maxHeight: "90vh", overflowY: "auto", position: "relative",
      }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", color: "#6a9a6a", fontSize: 24, cursor: "pointer" }}>✕</button>
        {submitted ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✓</div>
            <h3 style={{ color: "var(--color-primary)", fontSize: 24, marginBottom: 8 }}>Request Received!</h3>
            <p style={{ color: "#8aba8a", lineHeight: 1.6, marginBottom: 16 }}>
              We&apos;re reviewing your information and will reach out within 24–48 hours. Check your email for a confirmation.
            </p>
            <p style={{ color: "#5a8a5a", fontSize: 14 }}>
              Need us sooner? Call or text:{" "}
              <a href={`tel:4076869817`} style={{ color: "var(--color-primary)", fontWeight: 600 }}>407-686-9817</a>
            </p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 13, letterSpacing: 3, color: "var(--color-primary)", marginBottom: 8, fontWeight: 600 }}>FREE ESTIMATE</div>
              <h3 style={{ color: "#e8f5e8", fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>Get Your Property Looking Its Best</h3>
              <p style={{ color: "#7a9a7a", fontSize: 14, marginTop: 8 }}>Fill out the form and we&apos;ll get back to you fast.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input placeholder="Your Name *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={inputStyle} />
              <input placeholder="Email Address *" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} style={inputStyle} />
              <input placeholder="Phone Number *" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} style={inputStyle} />
              <input placeholder="Zip Code" value={formData.zip} onChange={(e) => setFormData({ ...formData, zip: e.target.value })} style={inputStyle} />
              <select value={formData.service} onChange={(e) => setFormData({ ...formData, service: e.target.value })} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                <option value="">Select a Service</option>
                <option value="Lawn Care">Lawn Care</option>
                <option value="Pressure Washing">Pressure Washing / Soft Wash</option>
                <option value="Junk Removal">Junk Removal</option>
                <option value="Land Clearing">Land Clearing</option>
                <option value="Property Cleanup">Property Cleanups</option>
                <option value="Other">Other</option>
              </select>
              <textarea placeholder="Tell us about your project..." rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
              {errorMsg && (
                <p style={{ color: "#ef5350", fontSize: 13, margin: 0, textAlign: "center" }}>{errorMsg}</p>
              )}
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  background: loading ? "#2a4a2a" : "linear-gradient(135deg, var(--color-primary) 0%, var(--color-dark) 100%)",
                  color: "#fff", border: "none", padding: "16px", borderRadius: 12, fontSize: 17,
                  fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", letterSpacing: 0.5,
                  boxShadow: "0 4px 20px rgba(76,175,80,0.4)", transition: "transform 0.2s, box-shadow 0.2s",
                  width: "100%", opacity: loading ? 0.7 : 1,
                }}
                onMouseOver={(e) => { if (!loading) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(76,175,80,0.5)"; } }}
                onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(76,175,80,0.4)"; }}
              >
                {loading ? "Sending..." : "Request Free Estimate"}
              </button>
              <p style={{ textAlign: "center", color: "#5a8a5a", fontSize: 13, margin: 0 }}>
                Or call/text directly:{" "}
                <a href="tel:4076869817" style={{ color: "var(--color-primary)", fontWeight: 600 }}>407-686-9817</a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
