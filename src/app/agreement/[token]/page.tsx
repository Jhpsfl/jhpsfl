"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

// ─── Types ───
interface ScheduleItem { label: string; amount: number; due_date: string | null; }
interface LineItem { description: string; quantity: number; unit_price: number; amount: number; }
interface QuoteSnapshot {
  quote_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  line_items: LineItem[];
  subtotal: number;
  tax_amount: number;
  total: number;
  payment_terms_type: string;
  deposit_amount: number;
  notes: string | null;
}
interface AgreementResponse {
  id: string;
  status: string;
  agreement_text: string;
  payment_schedule: ScheduleItem[] | null;
  quote_snapshot: QuoteSnapshot | null;
  signer_name: string | null;
  signer_email: string | null;
  signer_phone: string | null;
  expires_at: string | null;
  signed_at: string | null;
}

// ─── Helpers ───
const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ─── Signature Canvas Component ───
function SignaturePad({ onSignatureChange }: { onSignatureChange: (data: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const getPos = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  }, [getPos]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  }, [getPos]);

  const endDraw = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onSignatureChange(canvas.toDataURL("image/png"));
  }, [onSignatureChange]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onSignatureChange(null);
    }
  }, [onSignatureChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Set canvas resolution to 2x for retina
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
  }, []);

  return (
    <div>
      <div style={{ position: "relative", border: "2px solid #d1d5db", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: 160, touchAction: "none", cursor: "crosshair", display: "block" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <div style={{
          position: "absolute", bottom: 32, left: 24, right: 24,
          borderBottom: "1px dashed #d1d5db",
        }} />
        <div style={{
          position: "absolute", bottom: 10, left: 24,
          fontSize: 10, color: "#9ca3af", fontStyle: "italic",
        }}>
          Sign above the line
        </div>
      </div>
      <button
        type="button"
        onClick={clear}
        style={{
          marginTop: 8, padding: "6px 16px", fontSize: 12, color: "#6b7280",
          background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 8,
          cursor: "pointer",
        }}
      >
        Clear Signature
      </button>
    </div>
  );
}

// ─── ID Upload Component ───
// ─── Session persistence helpers (survives camera app switch on low-RAM phones) ───
const STORAGE_KEY = "jhps_agreement_state";

function saveToSession(data: Record<string, unknown>) {
  try {
    const existing = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...data }));
  } catch { /* quota exceeded or private browsing */ }
}

function loadFromSession(): Record<string, unknown> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function clearSession() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}

// Convert file to compressed base64 for session storage
function fileToSessionBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 800; // Smaller for sessionStorage
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Convert base64 data URL back to File
function base64ToFile(dataUrl: string, name: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], name, { type: mime });
}

// ─── ID Upload Component with session persistence ───
function IdUpload({ label, file, storageKey, onFileChange }: {
  label: string; file: File | null; storageKey: string;
  onFileChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // Restore from sessionStorage on mount (handles camera app kill + reload)
  useEffect(() => {
    if (file || restored) return;
    const saved = loadFromSession();
    const b64 = saved[storageKey] as string | undefined;
    if (b64) {
      setPreview(b64);
      const restoredFile = base64ToFile(b64, `${storageKey}.jpg`);
      onFileChange(restoredFile);
    }
    setRestored(true);
  }, [file, storageKey, onFileChange, restored]);

  // Update preview when file changes
  useEffect(() => {
    if (!file) { 
      if (!loadFromSession()[storageKey]) setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    // Also save compressed version to sessionStorage
    fileToSessionBase64(file).then(b64 => {
      setPreview(b64); // Use the compressed version as preview too
      URL.revokeObjectURL(url);
      saveToSession({ [storageKey]: b64 });
    });
  }, [file, storageKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      alert("File is too large. Please use an image under 10MB.");
      return;
    }
    onFileChange(f);
  };

  const handleClear = () => {
    onFileChange(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    saveToSession({ [storageKey]: null });
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{label}</div>
      {preview ? (
        <div style={{ position: "relative" }}>
          <img
            src={preview}
            alt={label}
            style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 12, border: "2px solid #d1fae5" }}
          />
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: "absolute", top: 8, right: 8,
              width: 28, height: 28, borderRadius: "50%",
              background: "rgba(0,0,0,0.6)", color: "#fff", border: "none",
              cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
          <div style={{
            position: "absolute", bottom: 8, left: 8,
            background: "rgba(34,197,94,0.9)", color: "#fff",
            fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
          }}>
            ✓ Captured
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              width: "100%", padding: "24px 16px", borderRadius: 12,
              border: "2px dashed #d1d5db", background: "#f9fafb",
              color: "#6b7280", fontSize: 13, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              transition: "border-color 0.2s, background 0.2s",
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = "#4CAF50"; e.currentTarget.style.background = "#f0fdf4"; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.background = "#f9fafb"; }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="12" cy="12" r="3" />
              <path d="M7 6V4h2M15 6V4h2" />
            </svg>
            <span style={{ fontWeight: 600 }}>Take Photo or Choose File</span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>Position your ID within the frame</span>
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif"
        capture="environment"
        onChange={handleChange}
        style={{ display: "none" }}
      />
    </div>
  );
}

// ─── File to base64 helper ───
async function fileToBase64(file: File): Promise<string> {
  // Compress large images via canvas before converting
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1600;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


// ═══════════════════════════════════════════════════════
// ─── Main Agreement Page ──────────────────────────────
// ═══════════════════════════════════════════════════════

export default function AgreementPage() {
  const params = useParams();
  const token = params.token as string;

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<AgreementResponse | null>(null);

  // Form state — restore from session on mount
  const saved = typeof window !== "undefined" ? loadFromSession() : {};
  const [step, setStep] = useState<"review" | "sign">((saved.step as "review" | "sign") || "review");
  const [signerName, setSignerName] = useState((saved.signerName as string) || "");
  const [signerEmail, setSignerEmail] = useState((saved.signerEmail as string) || "");
  const [signerPhone, setSignerPhone] = useState((saved.signerPhone as string) || "");
  const [signerAddress, setSignerAddress] = useState((saved.signerAddress as string) || "");
  const [signatureData, setSignatureData] = useState<string | null>((saved.signatureData as string) || null);
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [idType, setIdType] = useState((saved.idType as string) || "drivers_license");
  const [agreedToTerms, setAgreedToTerms] = useState(!!saved.agreedToTerms);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Persist form state to sessionStorage on changes
  useEffect(() => {
    saveToSession({
      step, signerName, signerEmail, signerPhone, signerAddress,
      signatureData, idType, agreedToTerms,
    });
  }, [step, signerName, signerEmail, signerPhone, signerAddress, signatureData, idType, agreedToTerms]);

  // ─── Fetch agreement ───
  useEffect(() => {
    if (!token) return;
    fetch(`/api/agreement?token=${token}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) { setError(res.error); }
        else if (res.data) {
          setAgreement(res.data);
          // Only set signer info if not already restored from session
          if (!signerName && res.data.signer_name) setSignerName(res.data.signer_name);
          if (!signerEmail && res.data.signer_email) setSignerEmail(res.data.signer_email);
          if (!signerPhone && res.data.signer_phone) setSignerPhone(res.data.signer_phone);
          if (res.data.status === "signed") setSubmitted(true);
        }
      })
      .catch(() => setError("Failed to load agreement. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  // ─── Submit ───
  const handleSubmit = async () => {
    setSubmitError(null);
    if (!signerName.trim()) { setSubmitError("Please enter your full legal name"); return; }
    if (!signatureData) { setSubmitError("Please sign above"); return; }
    if (!idFront) { setSubmitError("Please upload the front of your ID"); return; }
    if (!idBack) { setSubmitError("Please upload the back of your ID"); return; }
    if (!agreedToTerms) { setSubmitError("Please agree to the terms"); return; }

    setSubmitting(true);
    try {
      const [frontBase64, backBase64] = await Promise.all([
        fileToBase64(idFront),
        fileToBase64(idBack),
      ]);

      const res = await fetch("/api/agreement/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          signer_name: signerName.trim(),
          signer_email: signerEmail.trim() || undefined,
          signer_phone: signerPhone.trim() || undefined,
          signer_address: signerAddress.trim() || undefined,
          signature_data: signatureData,
          id_front_data: frontBase64,
          id_back_data: backBase64,
          id_type: idType,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        clearSession();
        setSubmitted(true);
      } else {
        setSubmitError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    }
    setSubmitting(false);
  };

  // ─── Styles ───
  const pageStyle: React.CSSProperties = {
    minHeight: "100vh", background: "#f8faf8",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };
  const containerStyle: React.CSSProperties = {
    maxWidth: 640, margin: "0 auto", padding: "20px 16px 80px",
  };
  const cardStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 16, padding: "24px 20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    marginBottom: 16,
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5,
    textTransform: "uppercase", marginBottom: 12,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 10,
    border: "1px solid #d1d5db", outline: "none", color: "#111827",
    fontFamily: "inherit", boxSizing: "border-box",
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ ...containerStyle, textAlign: "center", paddingTop: 120 }}>
          <div style={{ width: 32, height: 32, border: "3px solid #4CAF50", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ color: "#6b7280", fontSize: 14 }}>Loading agreement...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ ...containerStyle, textAlign: "center", paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Unable to Load Agreement</h2>
          <p style={{ color: "#6b7280", fontSize: 15, lineHeight: 1.6, maxWidth: 400, margin: "0 auto 24px" }}>{error}</p>
          <a href="tel:4076869817" style={{
            display: "inline-block", background: "#4CAF50", color: "#fff",
            padding: "12px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600,
            textDecoration: "none",
          }}>
            📞 Call (407) 686-9817
          </a>
        </div>
      </div>
    );
  }

  // ─── Already Signed ───
  if (submitted) {
    return (
      <div style={pageStyle}>
        <div style={{ ...containerStyle, textAlign: "center", paddingTop: 80 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 36,
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Agreement Signed!</h2>
          <p style={{ color: "#6b7280", fontSize: 15, lineHeight: 1.6, maxWidth: 420, margin: "0 auto 24px" }}>
            Thank you, {signerName || ""}. Your financing agreement has been submitted successfully.
          </p>

          {/* Pay Deposit button — built from snapshot data */}
          {agreement?.quote_snapshot && (() => {
            const snap = agreement.quote_snapshot as unknown as Record<string, unknown>;
            const depositAmt = (snap.deposit_amount as number) || 0;
            const payLink = snap.payment_link as string | undefined;
            // Build a deposit payment URL
            const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
            const params = new URLSearchParams({
              invoice: (snap.quote_number as string) || "",
              amount: depositAmt.toFixed(2),
              ...(snap.customer_name ? { name: snap.customer_name as string } : {}),
              ...(snap.customer_email ? { email: snap.customer_email as string } : {}),
              payment_label: "Deposit",
            });
            const depositUrl = payLink || `${baseUrl}/pay?${params.toString()}`;
            return depositAmt > 0 ? (
              <a
                href={depositUrl}
                style={{
                  display: "inline-block",
                  padding: "16px 40px",
                  background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                  color: "#fff",
                  textDecoration: "none",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 18,
                  marginBottom: 24,
                  boxShadow: "0 4px 14px rgba(46,125,50,0.3)",
                }}
              >
                Pay Deposit — ${depositAmt.toLocaleString("en-US", { minimumFractionDigits: 2 })} →
              </a>
            ) : null;
          })()}

          <div style={{ ...cardStyle, textAlign: "left", maxWidth: 380, margin: "0 auto" }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 12 }}>WHAT HAPPENS NEXT</div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#2E7D32", flexShrink: 0 }}>1</div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>We&apos;ll review your signed agreement and ID</div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#2E7D32", flexShrink: 0 }}>2</div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>Pay your deposit using the button above or contact us to arrange payment</div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#2E7D32", flexShrink: 0 }}>3</div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>Work begins per the agreed schedule</div>
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <a href="tel:4076869817" style={{ color: "#4CAF50", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              Questions? Call (407) 686-9817
            </a>
          </div>
        </div>
      </div>
    );
  }

  const snapshot = agreement?.quote_snapshot;

  // ═══════════════════════════════════════════════════════
  // ─── REVIEW STEP ───────────────────────────────────────
  // ═══════════════════════════════════════════════════════

  if (step === "review") {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          {/* Header */}
          <div style={{ textAlign: "center", paddingTop: 12, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#4CAF50", letterSpacing: 1, textTransform: "uppercase" }}>
              JHPS Florida
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginTop: 4 }}>
              Financing Agreement
            </h1>
            <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
              Review the estimate and payment plan below
            </p>
          </div>

          {/* Estimate Summary Card */}
          <div style={cardStyle}>
            <div style={sectionLabel}>Estimate Summary</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Estimate #</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{snapshot?.quote_number}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Total</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#2E7D32" }}>{fmt(snapshot?.total || 0)}</div>
              </div>
            </div>

            {/* Line items */}
            <div style={{ borderTop: "1px solid #f3f4f6" }}>
              {snapshot?.line_items.map((li, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <div>
                    <div style={{ fontSize: 14, color: "#111827" }}>{li.description}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{li.quantity} × {fmt(li.unit_price)}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{fmt(li.amount)}</div>
                </div>
              ))}
            </div>

            {snapshot?.tax_amount && snapshot.tax_amount > 0 ? (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 13, color: "#6b7280" }}>
                <span>Tax</span>
                <span>{fmt(snapshot.tax_amount)}</span>
              </div>
            ) : null}
          </div>

          {/* Payment Schedule Card */}
          {agreement?.payment_schedule && agreement.payment_schedule.length > 0 && (
            <div style={cardStyle}>
              <div style={sectionLabel}>Payment Schedule</div>
              {agreement.payment_schedule.map((item, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 0", borderBottom: i < (agreement.payment_schedule?.length || 0) - 1 ? "1px solid #f3f4f6" : "none",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>
                      {item.due_date ? `Due ${fmtDate(item.due_date)}` : "Due upon signing"}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: i === 0 ? "#2E7D32" : "#111827" }}>
                    {fmt(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Agreement Text Card */}
          <div style={cardStyle}>
            <div style={sectionLabel}>Agreement Terms</div>
            <div style={{
              maxHeight: 320, overflow: "auto",
              padding: "16px", background: "#f9fafb", borderRadius: 10,
              border: "1px solid #e5e7eb",
              fontSize: 12, color: "#374151", lineHeight: 1.8,
              whiteSpace: "pre-wrap", fontFamily: "'Courier New', monospace",
            }}>
              {agreement?.agreement_text}
            </div>
          </div>

          {/* Expiration notice */}
          {agreement?.expires_at && (
            <div style={{
              textAlign: "center", fontSize: 12, color: "#9ca3af", marginBottom: 16,
            }}>
              This agreement expires {fmtDate(agreement.expires_at)}
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={() => { setStep("sign"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            style={{
              width: "100%", padding: "16px", borderRadius: 14, border: "none",
              background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
              fontSize: 16, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(76,175,80,0.35)",
            }}
          >
            Continue to Sign →
          </button>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <a href="tel:4076869817" style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}>
              Questions? Call (407) 686-9817
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // ─── SIGN STEP ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {/* Back to review */}
        <button
          onClick={() => setStep("review")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", color: "#4CAF50",
            fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 20,
          }}
        >
          ← Back to Review
        </button>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
          Complete & Sign
        </h2>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
          Please provide your information, ID, and signature to finalize the agreement.
        </p>

        {/* ─── Your Information ─── */}
        <div style={cardStyle}>
          <div style={sectionLabel}>Your Information</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                Full Legal Name *
              </label>
              <input
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder="John Smith"
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Email</label>
                <input
                  type="email"
                  value={signerEmail}
                  onChange={e => setSignerEmail(e.target.value)}
                  placeholder="john@email.com"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Phone</label>
                <input
                  type="tel"
                  value={signerPhone}
                  onChange={e => setSignerPhone(e.target.value)}
                  placeholder="(407) 555-1234"
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                Service Address
              </label>
              <input
                value={signerAddress}
                onChange={e => setSignerAddress(e.target.value)}
                placeholder="123 Main St, Deltona, FL 32725"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* ─── ID Upload ─── */}
        <div style={cardStyle}>
          <div style={sectionLabel}>Government-Issued ID *</div>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, lineHeight: 1.5 }}>
            Please upload clear photos of the front and back of a valid government-issued ID for identity verification.
          </p>

          {/* ID Type selector */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { value: "drivers_license", label: "Driver's License" },
              { value: "state_id", label: "State ID" },
              { value: "passport", label: "Passport" },
              { value: "military_id", label: "Military ID" },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIdType(opt.value)}
                style={{
                  padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: idType === opt.value ? "2px solid #4CAF50" : "1px solid #d1d5db",
                  background: idType === opt.value ? "#f0fdf4" : "#fff",
                  color: idType === opt.value ? "#2E7D32" : "#6b7280",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <IdUpload label="Front of ID" file={idFront} storageKey="idFront" onFileChange={setIdFront} />
            <IdUpload label="Back of ID" file={idBack} storageKey="idBack" onFileChange={setIdBack} />
          </div>
        </div>

        {/* ─── Signature ─── */}
        <div style={cardStyle}>
          <div style={sectionLabel}>Your Signature *</div>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12, lineHeight: 1.5 }}>
            Draw your signature below using your finger or mouse.
          </p>
          <SignaturePad onSignatureChange={setSignatureData} />
        </div>

        {/* ─── Agree checkbox ─── */}
        <div style={{ ...cardStyle, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <input
            type="checkbox"
            id="agree"
            checked={agreedToTerms}
            onChange={e => setAgreedToTerms(e.target.checked)}
            style={{ marginTop: 3, width: 20, height: 20, accentColor: "#4CAF50", flexShrink: 0 }}
          />
          <label htmlFor="agree" style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, cursor: "pointer" }}>
            I have read and agree to all terms and conditions of this Payment Agreement.
            I understand that the deposit is non-refundable and that late payments are subject to fees as described in the agreement.
            I confirm that the ID provided is mine and that I am authorized to enter into this agreement.
          </label>
        </div>

        {/* ─── Error message ─── */}
        {submitError && (
          <div style={{
            padding: "12px 16px", borderRadius: 10, marginBottom: 16,
            background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
            fontSize: 13, fontWeight: 600,
          }}>
            {submitError}
          </div>
        )}

        {/* ─── Submit ─── */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: "100%", padding: "16px", borderRadius: 14, border: "none",
            background: submitting
              ? "#9ca3af"
              : "linear-gradient(135deg, #4CAF50, #2E7D32)",
            color: "#fff", fontSize: 16, fontWeight: 700,
            cursor: submitting ? "default" : "pointer",
            boxShadow: submitting ? "none" : "0 4px 14px rgba(76,175,80,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {submitting ? (
            <>
              <div style={{ width: 18, height: 18, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Submitting...
            </>
          ) : (
            "✍️ Sign Agreement"
          )}
        </button>

        <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 12, lineHeight: 1.5 }}>
          By clicking &quot;Sign Agreement&quot; you are electronically signing this document.
          Your IP address and device information will be recorded for verification.
        </p>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
