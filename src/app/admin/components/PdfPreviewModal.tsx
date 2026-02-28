"use client";

import { useState, useEffect } from "react";

export default function PdfPreviewModal({ pdfUrl, loading, onClose }: {
  pdfUrl: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        animation: "pdfFadeIn 0.25s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 900,
          height: "calc(100vh - 32px)", maxHeight: "calc(100dvh - 32px)",
          display: "flex", flexDirection: "column",
          background: "linear-gradient(160deg, #0a1a0a, #060e06)",
          border: "1px solid rgba(66,165,245,0.25)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 0 60px rgba(13,71,161,0.3), 0 0 120px rgba(0,0,0,0.5), inset 0 1px 0 rgba(66,165,245,0.1)",
          animation: "pdfSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Header bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(66,165,245,0.15)",
          background: "linear-gradient(135deg, rgba(13,71,161,0.2), rgba(21,101,192,0.08))",
          flexShrink: 0,
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
              <div style={{ fontSize: 15, fontWeight: 700, color: "#E3F2FD", fontFamily: "'DM Sans', sans-serif" }}>
                PDF Preview
              </div>
              <div style={{ fontSize: 11, color: "rgba(144,202,249,0.6)" }}>
                Review before sending
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(239,83,80,0.1)", border: "1px solid rgba(239,83,80,0.2)",
              color: "#ef9a9a", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(239,83,80,0.2)"; e.currentTarget.style.borderColor = "rgba(239,83,80,0.4)"; }}
            onMouseOut={e => { e.currentTarget.style.background = "rgba(239,83,80,0.1)"; e.currentTarget.style.borderColor = "rgba(239,83,80,0.2)"; }}
          >
            ✕
          </button>
        </div>

        {/* PDF content area */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {loading ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "100%", gap: 16,
            }}>
              <div style={{
                width: 40, height: 40, border: "3px solid rgba(66,165,245,0.2)",
                borderTopColor: "#42a5f5", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
              <div style={{ fontSize: 14, color: "#90CAF9", fontWeight: 600 }}>
                Generating PDF...
              </div>
              <div style={{ fontSize: 12, color: "rgba(144,202,249,0.4)" }}>
                This takes a few seconds
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="PDF Preview"
              style={{
                width: "100%", height: "100%", border: "none",
                background: "#fff",
              }}
            />
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "100%", gap: 12,
            }}>
              <div style={{ fontSize: 36 }}>⚠</div>
              <div style={{ fontSize: 14, color: "#ef9a9a", fontWeight: 600 }}>
                Failed to generate PDF
              </div>
              <div style={{ fontSize: 12, color: "#5a8a5a" }}>
                Try again or check your form data
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pdfFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pdfSlideUp { from { opacity: 0; transform: translateY(30px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
