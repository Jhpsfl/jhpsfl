"use client";

import React, { useState, useEffect, useCallback } from "react";

interface AgreementDetail {
  id: string;
  status: string;
  signer_name: string | null;
  signer_email: string | null;
  signer_phone: string | null;
  signer_address: string | null;
  signature_url: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  id_type: string | null;
  viewed_at: string | null;
  expires_at: string | null;
  created_at: string;
  quote_snapshot: { quote_number: string; total: number } | null;
}

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

const ID_TYPES: Record<string, string> = {
  drivers_license: "Driver's License",
  state_id: "State ID",
  passport: "Passport",
  military_id: "Military ID",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  viewed: { label: "Viewed", color: "#42a5f5", bg: "rgba(66,165,245,0.1)" },
  signed: { label: "Signed ✓", color: "#4CAF50", bg: "rgba(76,175,80,0.12)" },
  expired: { label: "Expired", color: "#ef5350", bg: "rgba(239,83,80,0.1)" },
  voided: { label: "Voided", color: "#ef5350", bg: "rgba(239,83,80,0.1)" },
};

export default function AgreementDetailModal({ agreement, userId, onClose, onVoid }: {
  agreement: AgreementDetail;
  userId: string;
  onClose: () => void;
  onVoid: (id: string) => void;
}) {
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [idFrontUrl, setIdFrontUrl] = useState<string | null>(null);
  const [idBackUrl, setIdBackUrl] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const fetchSignedUrl = useCallback(async (key: string): Promise<string | null> => {
    try {
      const params = new URLSearchParams({ clerk_user_id: userId, key });
      const res = await fetch(`/api/agreement/view-file?${params}`);
      const data = await res.json();
      return data.url || null;
    } catch { return null; }
  }, [userId]);

  useEffect(() => {
    if (agreement.signature_url) fetchSignedUrl(agreement.signature_url).then(setSignatureUrl);
    if (agreement.id_front_url) fetchSignedUrl(agreement.id_front_url).then(setIdFrontUrl);
    if (agreement.id_back_url) fetchSignedUrl(agreement.id_back_url).then(setIdBackUrl);
  }, [agreement, fetchSignedUrl]);

  const statusCfg = STATUS_CONFIG[agreement.status] || STATUS_CONFIG.pending;

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      }} onClick={onClose} />

      {/* Modal */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}>
        <div style={{
          background: "linear-gradient(160deg, #0d1f0d, #091409)",
          border: "1px solid #1a3a1a", borderRadius: 20,
          maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto",
          padding: "28px 24px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#e8f5e8", fontWeight: 700 }}>
              Financing Agreement
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                color: statusCfg.color, background: statusCfg.bg,
              }}>
                {statusCfg.label}
              </span>
              <button onClick={onClose} style={{
                width: 32, height: 32, borderRadius: 8, border: "1px solid #1a3a1a",
                background: "transparent", color: "#5a8a5a", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
              }}>✕</button>
            </div>
          </div>

          {/* Signer Info */}
          <div style={{
            background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 14,
            padding: "16px 18px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
              Signer Information
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#5a8a5a" }}>Name</div>
                <div style={{ fontSize: 14, color: "#e8f5e8", fontWeight: 600 }}>{agreement.signer_name || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#5a8a5a" }}>Email</div>
                <div style={{ fontSize: 14, color: "#c8e0c8" }}>{agreement.signer_email || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#5a8a5a" }}>Phone</div>
                <div style={{ fontSize: 14, color: "#c8e0c8" }}>{agreement.signer_phone || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#5a8a5a" }}>Address</div>
                <div style={{ fontSize: 14, color: "#c8e0c8" }}>{agreement.signer_address || "—"}</div>
              </div>
            </div>
          </div>

          {/* Signature */}
          {agreement.status === "signed" && (
            <div style={{
              background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 14,
              padding: "16px 18px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
                Digital Signature
              </div>
              {signatureUrl ? (
                <div style={{
                  background: "#fff", borderRadius: 10, padding: 12,
                  display: "flex", justifyContent: "center",
                }}>
                  <img src={signatureUrl} alt="Signature" style={{ maxWidth: "100%", maxHeight: 120 }} />
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#5a8a5a" }}>Loading signature...</div>
              )}
              <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                <div style={{ fontSize: 11, color: "#5a8a5a" }}>
                  Signed: <span style={{ color: "#8aba8a" }}>{fmtDate(agreement.signed_at)}</span>
                </div>
                <div style={{ fontSize: 11, color: "#5a8a5a" }}>
                  IP: <span style={{ color: "#8aba8a", fontFamily: "'JetBrains Mono', monospace" }}>{agreement.signer_ip || "—"}</span>
                </div>
              </div>
            </div>
          )}

          {/* ID Photos */}
          {agreement.status === "signed" && (agreement.id_front_url || agreement.id_back_url) && (
            <div style={{
              background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 14,
              padding: "16px 18px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
                  ID Verification
                </div>
                {agreement.id_type && (
                  <span style={{ fontSize: 11, color: "#8aba8a", fontWeight: 600 }}>
                    {ID_TYPES[agreement.id_type] || agreement.id_type}
                  </span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {idFrontUrl ? (
                  <div
                    style={{ cursor: "pointer", borderRadius: 10, overflow: "hidden", border: "1px solid #1a3a1a" }}
                    onClick={() => setZoomImage(idFrontUrl)}
                  >
                    <img src={idFrontUrl} alt="ID Front" style={{ width: "100%", height: 120, objectFit: "cover" }} />
                    <div style={{ fontSize: 10, color: "#5a8a5a", textAlign: "center", padding: 4, background: "#0d1a0d" }}>Front — tap to zoom</div>
                  </div>
                ) : (
                  <div style={{ background: "#0d1a0d", borderRadius: 10, height: 120, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#3a5a3a" }}>Loading...</div>
                )}
                {idBackUrl ? (
                  <div
                    style={{ cursor: "pointer", borderRadius: 10, overflow: "hidden", border: "1px solid #1a3a1a" }}
                    onClick={() => setZoomImage(idBackUrl)}
                  >
                    <img src={idBackUrl} alt="ID Back" style={{ width: "100%", height: 120, objectFit: "cover" }} />
                    <div style={{ fontSize: 10, color: "#5a8a5a", textAlign: "center", padding: 4, background: "#0d1a0d" }}>Back — tap to zoom</div>
                  </div>
                ) : (
                  <div style={{ background: "#0d1a0d", borderRadius: 10, height: 120, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#3a5a3a" }}>Loading...</div>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div style={{
            background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 14,
            padding: "16px 18px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
              Timeline
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#5a8a5a" }}>
                📄 Created: <span style={{ color: "#8aba8a" }}>{fmtDate(agreement.created_at)}</span>
              </div>
              {agreement.viewed_at && (
                <div style={{ fontSize: 12, color: "#5a8a5a" }}>
                  👁 Viewed: <span style={{ color: "#8aba8a" }}>{fmtDate(agreement.viewed_at)}</span>
                </div>
              )}
              {agreement.signed_at && (
                <div style={{ fontSize: 12, color: "#5a8a5a" }}>
                  ✍️ Signed: <span style={{ color: "#66bb6a" }}>{fmtDate(agreement.signed_at)}</span>
                </div>
              )}
              {agreement.expires_at && agreement.status !== "signed" && (
                <div style={{ fontSize: 12, color: "#5a8a5a" }}>
                  ⏰ Expires: <span style={{ color: new Date(agreement.expires_at) < new Date() ? "#ef5350" : "#ffb74d" }}>{fmtDate(agreement.expires_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            {["pending", "viewed"].includes(agreement.status) && (
              <button
                onClick={() => { if (confirm("Void this agreement? The customer will no longer be able to sign.")) onVoid(agreement.id); }}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12,
                  border: "1px solid rgba(239,83,80,0.3)", background: "transparent",
                  color: "#ef5350", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Void Agreement
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: "12px", borderRadius: 12,
                border: "1px solid #1a3a1a", background: "transparent",
                color: "#8aba8a", fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Zoom overlay */}
      {zoomImage && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 10001,
            background: "rgba(0,0,0,0.9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
          onClick={() => setZoomImage(null)}
        >
          <img src={zoomImage} alt="ID zoom" style={{ maxWidth: "90%", maxHeight: "85vh", borderRadius: 8, objectFit: "contain" }} />
          <div style={{ position: "absolute", top: 20, right: 20, color: "#fff", fontSize: 18, background: "rgba(0,0,0,0.5)", borderRadius: 8, padding: "6px 12px" }}>✕ Close</div>
        </div>
      )}
    </>
  );
}
