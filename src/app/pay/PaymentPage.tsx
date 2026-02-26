"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

// Square Web Payments SDK type shim
declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => SquarePayments;
    };
  }
}
interface SquarePayments {
  card: (options?: object) => Promise<SquareCard>;
}
interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message: string }> }>;
  destroy: () => Promise<void>;
}

// ─── Square Card Section ───
// Isolated component so React's mount/unmount mirrors Square SDK lifecycle.
// Each time the user enters the payment step a fresh instance mounts,
// Square is fully re-initialized, and on unmount the card is destroyed.
function SquareCardSection({
  onReady, onError,
}: {
  onReady: (card: SquareCard) => void;
  onError: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let card: SquareCard | null = null;

    const init = async () => {
      try {
        // Load SDK script if not already present
        if (!window.Square) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[src*="squarecdn"]');
            if (existing) { resolve(); return; }
            const s = document.createElement("script");
            s.src = "https://web.squarecdn.com/v1/square.js";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Square SDK failed to load"));
            document.head.appendChild(s);
          });
        }
        if (cancelled) return;

        const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.trim();
        const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID?.trim();
        if (!appId || !locationId) throw new Error("Payment configuration missing");

        const payments = window.Square!.payments(appId, locationId);
        card = await payments.card({
          style: {
            ".input-container": {
              borderColor: "#1a3a1a",
              borderRadius: "12px",
            },
            ".input-container.is-focus": {
              borderColor: "#4CAF50",
            },
            ".input-container.is-error": {
              borderColor: "#ef5350",
            },
            "input": {
              backgroundColor: "#0d1a0d",
              color: "#e8f5e8",
            },
            "input::placeholder": {
              color: "#3a5a3a",
            },
          },
        });
        if (cancelled) { card.destroy().catch(() => {}); return; }

        await card.attach("#sq-card-container");
        if (cancelled) { card.destroy().catch(() => {}); return; }

        setLoading(false);
        onReady(card);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Square init error:", msg);
        setLoading(false);
        onError(msg);
      }
    };

    init();
    return () => {
      cancelled = true;
      if (card) card.destroy().catch(() => {});
    };
  }, []); // empty — runs once on mount, cleans up on unmount

  return (
    <>
      {loading && (
        <div style={{ color: "#4a7a4a", fontSize: 13, padding: "20px 0", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #4CAF50", borderTopColor: "transparent", borderRadius: "50%", animation: "pulse 0.8s linear infinite" }} />
          Loading secure payment form…
        </div>
      )}
      <div id="sq-card-container" style={{ minHeight: loading ? 0 : 89 }} />
    </>
  );
}

// ─── Animation Hook ───
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, isVisible] as const;
}

function FadeIn({ children, delay = 0, direction = "up", className = "" }: {
  children: React.ReactNode; delay?: number; direction?: string; className?: string;
}) {
  const [ref, isVisible] = useInView(0.1);
  const transforms: Record<string, string> = {
    up: "translateY(40px)", down: "translateY(-40px)",
    left: "translateX(40px)", right: "translateX(-40px)", none: "none",
  };
  return (
    <div ref={ref} className={className} style={{
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "none" : (transforms[direction] || transforms.up),
      transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
    }}>{children}</div>
  );
}

// ─── Types ───
interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  billingAddress: string;
  billingCity: string;
  billingZip: string;
  service: string;
  jobDescription: string;
  invoiceNumber: string;
  amount: string;
}

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface InvoicePublicData {
  invoice_number: string;
  due_date: string | null;
  line_items: InvoiceLineItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: string;
}

export default function PaymentPage() {
  const [scrollY, setScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState<"form" | "payment" | "confirm">("form");
  const [formData, setFormData] = useState<FormData>({
    name: "", email: "", phone: "", address: "", city: "", zip: "",
    billingAddress: "", billingCity: "", billingZip: "",
    service: "", jobDescription: "", invoiceNumber: "", amount: "",
  });
  const [sameBilling, setSameBilling] = useState(true);
  const [squareCard, setSquareCard] = useState<SquareCard | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoicePublicData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(false);
  const { userId: clerkUserId } = useAuth();
  const searchParams = useSearchParams();

  // Auto-fill from invoice payment link params
  useEffect(() => {
    const invoice = searchParams.get("invoice");
    const amount = searchParams.get("amount");
    const name = searchParams.get("name");
    const email = searchParams.get("email");
    const phone = searchParams.get("phone");
    const service = searchParams.get("service");
    const description = searchParams.get("description");
    const address = searchParams.get("address");
    const city = searchParams.get("city");
    const zip = searchParams.get("zip");

    setFormData(prev => ({
      ...prev,
      ...(name && { name }),
      ...(email && { email }),
      ...(phone && { phone }),
      ...(address && { address }),
      ...(city && { city }),
      ...(zip && { zip }),
      ...(service && { service }),
      ...(description && { jobDescription: description }),
      ...(invoice && { invoiceNumber: invoice }),
      ...(amount && { amount }),
    }));

    // Invoice mode: fetch line items from the server
    if (invoice) {
      setInvoiceMode(true);
      setInvoiceLoading(true);
      setInvoiceError(null);
      fetch(`/api/invoice/public/${encodeURIComponent(invoice)}`)
        .then(r => r.json())
        .then(data => {
          if (data.invoice) {
            setInvoiceData(data.invoice);
            // Lock the amount to the real invoice total
            setFormData(prev => ({ ...prev, amount: data.invoice.total.toFixed(2) }));
          } else {
            setInvoiceError(data.error || "Could not load invoice details.");
          }
        })
        .catch(() => setInvoiceError("Could not load invoice details."))
        .finally(() => setInvoiceLoading(false));
    }
  }, [searchParams]);

  const nameRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);
  const addressRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Format amount
  const formatAmount = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return parts[0] + "." + parts.slice(1).join("");
    if (parts[1]?.length > 2) return parts[0] + "." + parts[1].slice(0, 2);
    return cleaned;
  };

  const handleContinue = () => {
    const valid = !!(
      formData.name && formData.phone && formData.email &&
      formData.address && formData.amount && parseFloat(formData.amount) > 0
    );
    if (!valid) {
      setShowErrors(true);
      // Scroll to first missing required field in top-to-bottom order
      const firstError =
        !formData.name ? nameRef :
        !formData.phone ? phoneRef :
        !formData.email ? emailRef :
        !formData.address ? addressRef :
        amountRef;
      firstError.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      // Re-trigger shake animation (force reflow)
      const inputs = firstError.current?.querySelectorAll(".pay-input, .amount-input-wrapper");
      inputs?.forEach(el => {
        (el as HTMLElement).style.animation = "none";
        (el as HTMLElement).offsetHeight;
        (el as HTMLElement).style.animation = "";
      });
      return;
    }
    setShowErrors(false);
    setPaymentError(null);
    setSquareCard(null);
    setStep("payment");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePayment = async () => {
    if (!squareCard || isProcessing) return;
    setIsProcessing(true);
    setPaymentError(null);

    try {
      const result = await squareCard.tokenize();

      if (result.status !== "OK") {
        const msg = result.errors?.map((e) => e.message).join(", ") || "Card verification failed. Please check your details.";
        setPaymentError(msg);
        setIsProcessing(false);
        return;
      }

      const response = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: result.token,
          amount: formData.amount,
          customerName: formData.name,
          customerPhone: formData.phone,
          customerEmail: formData.email,
          service: formData.service,
          invoiceNumber: formData.invoiceNumber,
          billingAddress: sameBilling
            ? `${formData.address}${formData.city ? `, ${formData.city}` : ""}${formData.zip ? ` ${formData.zip}` : ""}`
            : `${formData.billingAddress}${formData.billingCity ? `, ${formData.billingCity}` : ""}${formData.billingZip ? ` ${formData.billingZip}` : ""}`,
          note: [formData.service, formData.jobDescription, formData.invoiceNumber ? `INV#${formData.invoiceNumber}` : ""]
            .filter(Boolean).join(" — "),
          saveCard: saveCard && !!clerkUserId,
          clerkUserId: clerkUserId || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPaymentId(data.paymentId || null);
        setStep("confirm");
      } else {
        setPaymentError(data.error || "Payment failed. Please try again or call us directly.");
      }
    } catch {
      setPaymentError("An unexpected error occurred. Please try again or call us directly.");
    } finally {
      setIsProcessing(false);
    }
  };

  const labelStyle: CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "#7a9a7a", letterSpacing: 1.5,
    textTransform: "uppercase" as const, marginBottom: 6, display: "block",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Playfair+Display:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: #050e05; color: #c8e0c8; overflow-x: hidden; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes checkmark { 0% { transform: scale(0) rotate(-45deg); opacity: 0; } 50% { transform: scale(1.2) rotate(0deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 15%{transform:translateX(-7px)} 30%{transform:translateX(7px)} 45%{transform:translateX(-5px)} 60%{transform:translateX(5px)} 75%{transform:translateX(-3px)} 90%{transform:translateX(3px)} }
        .field-invalid .pay-input, .field-invalid .pay-select, .field-invalid .amount-input-wrapper {
          border-color: #ef5350 !important;
          box-shadow: 0 0 0 3px rgba(239,83,80,0.2) !important;
          animation: shake 0.45s cubic-bezier(0.36,0.07,0.19,0.97);
        }
        .field-invalid .amount-input-wrapper { border: 1px solid #ef5350; border-radius: 12px; }
        .field-error-msg { font-size: 12px; color: #ef9a9a; margin-top: 5px; display: block; }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .nav-blur { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }

        .pay-input {
          width: 100%; padding: 14px 16px; background: #0d1a0d;
          border: 1px solid #1a3a1a; border-radius: 12px; color: #e8f5e8;
          font-size: 15px; outline: none; font-family: 'DM Sans', sans-serif;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .pay-input:focus {
          border-color: #4CAF50;
          box-shadow: 0 0 0 3px rgba(76,175,80,0.15);
        }
        .pay-input::placeholder { color: #3a5a3a; }
        .pay-input-mono {
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 1.5px;
        }

        .pay-select {
          width: 100%; padding: 14px 16px; background: #0d1a0d;
          border: 1px solid #1a3a1a; border-radius: 12px; color: #e8f5e8;
          font-size: 15px; outline: none; font-family: 'DM Sans', sans-serif;
          transition: border-color 0.3s, box-shadow 0.3s;
          appearance: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234CAF50' stroke-width='2' fill='none'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 16px center;
        }
        .pay-select:focus {
          border-color: #4CAF50;
          box-shadow: 0 0 0 3px rgba(76,175,80,0.15);
        }

        .amount-input-wrapper {
          position: relative;
        }
        .amount-input-wrapper::before {
          content: '$';
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #4CAF50;
          font-size: 22px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          z-index: 1;
        }
        .amount-input {
          padding-left: 36px !important;
          font-size: 22px !important;
          font-weight: 700 !important;
          font-family: 'JetBrains Mono', monospace !important;
          letter-spacing: 1px;
        }

        .card-field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .step-indicator {
          display: flex;
          align-items: center;
          gap: 0;
          margin-bottom: 40px;
        }
        .step-dot {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700;
          transition: all 0.4s;
          flex-shrink: 0;
        }
        .step-dot.active {
          background: linear-gradient(135deg, #4CAF50, #2E7D32);
          color: #fff;
          box-shadow: 0 0 20px rgba(76,175,80,0.4);
        }
        .step-dot.completed {
          background: #4CAF50;
          color: #fff;
        }
        .step-dot.inactive {
          background: #0d1a0d;
          border: 2px solid #1a3a1a;
          color: #3a5a3a;
        }
        .step-line {
          flex: 1;
          height: 2px;
          background: #1a3a1a;
          transition: background 0.4s;
        }
        .step-line.active {
          background: linear-gradient(90deg, #4CAF50, #2E7D32);
        }

        .cta-pay {
          background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
          color: #fff; border: none; padding: 18px 40px; border-radius: 14px;
          font-size: 17px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px;
          box-shadow: 0 4px 24px rgba(76,175,80,0.4);
          transition: transform 0.3s, box-shadow 0.3s;
          font-family: 'DM Sans', sans-serif;
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .cta-pay:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 40px rgba(76,175,80,0.5);
        }
        .cta-pay:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cta-secondary-pay {
          background: transparent; color: #4CAF50; border: 2px solid #1a3a1a;
          padding: 14px 32px; border-radius: 14px; font-size: 15px; font-weight: 600;
          cursor: pointer; transition: all 0.3s; font-family: 'DM Sans', sans-serif;
          width: 100%; text-align: center;
        }
        .cta-secondary-pay:hover {
          background: rgba(76,175,80,0.08);
          border-color: #4CAF50;
        }

        .summary-card {
          background: linear-gradient(160deg, #0d1f0d 0%, #091409 100%);
          border: 1px solid #1a3a1a;
          border-radius: 20px;
          padding: 32px;
          position: sticky;
          top: 96px;
        }

        .trust-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: rgba(76,175,80,0.08);
          border: 1px solid rgba(76,175,80,0.15);
          border-radius: 8px;
          font-size: 12px;
          color: #7a9a7a;
          font-weight: 500;
        }

        .mobile-menu {
          position: fixed; inset: 0; z-index: 9997;
          background: rgba(5,14,5,0.98); backdrop-filter: blur(20px);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px;
          animation: fadeIn 0.3s ease;
        }
        .mobile-menu a { color: #e8f5e8; font-size: 28px; font-weight: 600; text-decoration: none; transition: color 0.3s; font-family: 'Playfair Display', serif; }
        .mobile-menu a:hover { color: #4CAF50; }

        .billing-expand {
          overflow: hidden;
          transform-origin: center;
          transition: max-height 0.42s cubic-bezier(0.16, 1, 0.3, 1),
                      opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .billing-expand.open {
          max-height: 400px;
          opacity: 1;
          transform: scaleY(1);
        }
        .billing-expand.closed {
          max-height: 0;
          opacity: 0;
          transform: scaleY(0.85);
        }

        .same-billing-toggle {
          display: flex; align-items: center; gap: 10; cursor: pointer;
          padding: 12px 16px; border-radius: 10px;
          border: 1px solid #1a3a1a; background: rgba(76,175,80,0.04);
          transition: border-color 0.2s, background 0.2s;
          user-select: none;
        }
        .same-billing-toggle:hover {
          border-color: rgba(76,175,80,0.3);
          background: rgba(76,175,80,0.07);
        }
        .same-billing-toggle.checked {
          border-color: rgba(76,175,80,0.35);
          background: rgba(76,175,80,0.08);
        }

        .noise-overlay {
          position: fixed; inset: 0; pointer-events: none; z-index: 9990; opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        @media (max-width: 768px) {
          .pay-grid { grid-template-columns: 1fr !important; }
          .pay-grid-reverse { display: flex; flex-direction: column-reverse; }
          .summary-card { position: static; }
          .desktop-nav { display: none !important; }
          .mobile-hamburger { display: flex !important; }
          .card-field-grid { grid-template-columns: 1fr; }
          .form-2col { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="noise-overlay" />

      {/* ─── NAVIGATION ─── */}
      <nav className="nav-blur" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9996,
        background: scrollY > 50 ? "rgba(5,14,5,0.92)" : "rgba(5,14,5,0.8)",
        borderBottom: "1px solid rgba(76,175,80,0.15)",
        transition: "all 0.4s", padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jhps-nav-logo.svg" alt="JHPS Florida" style={{ maxWidth: 200, height: "auto", maxHeight: 44 }} />
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 28 }} className="desktop-nav">
            <Link href="/" style={{ color: "#8aba8a", fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "color 0.3s" }}
              onMouseOver={(e) => { e.currentTarget.style.color = "#4CAF50"; }}
              onMouseOut={(e) => { e.currentTarget.style.color = "#8aba8a"; }}>
              ← Back to Home
            </Link>
            <Link href="/account" style={{
              color: "#4CAF50", fontSize: 14, fontWeight: 600, textDecoration: "none",
              padding: "8px 20px", border: "1px solid #2a5a2a", borderRadius: 10,
              transition: "all 0.3s",
            }}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(76,175,80,0.1)"; e.currentTarget.style.borderColor = "#4CAF50"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#2a5a2a"; }}>
              My Account
            </Link>
            <a href="tel:4076869817" style={{
              background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
              padding: "10px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              📞 Call Us
            </a>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            display: "none", background: "none", border: "none", cursor: "pointer",
            flexDirection: "column", gap: 5, padding: 8,
          }} className="mobile-hamburger">
            <span style={{ width: 24, height: 2, background: "#4CAF50", borderRadius: 2, display: "block", transition: "all 0.3s", transform: menuOpen ? "rotate(45deg) translateY(7px)" : "none" }} />
            <span style={{ width: 24, height: 2, background: "#4CAF50", borderRadius: 2, display: "block", transition: "all 0.3s", opacity: menuOpen ? 0 : 1 }} />
            <span style={{ width: 24, height: 2, background: "#4CAF50", borderRadius: 2, display: "block", transition: "all 0.3s", transform: menuOpen ? "rotate(-45deg) translateY(-7px)" : "none" }} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="mobile-menu">
          <button onClick={() => setMenuOpen(false)} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", color: "#4CAF50", fontSize: 32, cursor: "pointer" }}>✕</button>
          <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/account" onClick={() => setMenuOpen(false)}>My Account</Link>
          <a href="tel:4076869817" style={{ color: "#4CAF50" }}>📞 407-686-9817</a>
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <main style={{ minHeight: "100vh", paddingTop: 72, background: "linear-gradient(170deg, #050e05 0%, #081808 40%, #050e05 100%)" }}>
        {/* Background accents */}
        <div style={{
          position: "fixed", top: "20%", right: "-10%", width: 600, height: 600,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(76,175,80,0.04) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />
        <div style={{
          position: "fixed", bottom: "10%", left: "-10%", width: 500, height: 500,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(46,125,50,0.03) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px", position: "relative", zIndex: 1 }}>
          {/* Page Header */}
          <FadeIn delay={0.05}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px",
                background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.2)",
                borderRadius: 40, marginBottom: 20,
              }}>
                <span style={{ fontSize: 16 }}>💳</span>
                <span style={{ fontSize: 13, color: "#4CAF50", fontWeight: 600, letterSpacing: 1 }}>SECURE PAYMENT</span>
              </div>
              <h1 style={{
                fontFamily: "'Playfair Display', serif", fontSize: 42, fontWeight: 800,
                color: "#e8f5e8", lineHeight: 1.15, marginBottom: 12,
              }}>
                Make a{" "}
                <span style={{
                  background: "linear-gradient(135deg, #4CAF50, #81C784, #4CAF50)",
                  backgroundSize: "200% 200%", animation: "gradientShift 4s ease infinite",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>Payment</span>
              </h1>
              <p style={{ color: "#7a9a7a", fontSize: 16, maxWidth: 520, margin: "0 auto" }}>
                Pay for services quickly and securely. Have an account?{" "}
                <Link href="/account" style={{ color: "#4CAF50", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>
                  Sign in for faster checkout
                </Link>
              </p>
            </div>
          </FadeIn>

          {/* Step Indicator */}
          <FadeIn delay={0.1}>
            <div style={{ maxWidth: 400, margin: "0 auto 40px" }}>
              <div className="step-indicator">
                <div className={`step-dot ${step === "form" ? "active" : step === "payment" || step === "confirm" ? "completed" : "inactive"}`}>
                  {step === "payment" || step === "confirm" ? "✓" : "1"}
                </div>
                <div className={`step-line ${step === "payment" || step === "confirm" ? "active" : ""}`} />
                <div className={`step-dot ${step === "payment" ? "active" : step === "confirm" ? "completed" : "inactive"}`}>
                  {step === "confirm" ? "✓" : "2"}
                </div>
                <div className={`step-line ${step === "confirm" ? "active" : ""}`} />
                <div className={`step-dot ${step === "confirm" ? "active" : "inactive"}`}>3</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#5a8a5a", letterSpacing: 1, fontWeight: 600 }}>
                <span style={{ color: step === "form" ? "#4CAF50" : "#5a8a5a" }}>DETAILS</span>
                <span style={{ color: step === "payment" ? "#4CAF50" : "#5a8a5a" }}>PAYMENT</span>
                <span style={{ color: step === "confirm" ? "#4CAF50" : "#5a8a5a" }}>DONE</span>
              </div>
            </div>
          </FadeIn>

          {/* ─── CONFIRMATION STATE ─── */}
          {step === "confirm" && (
            <FadeIn delay={0.1}>
              <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
                <div style={{
                  background: "linear-gradient(160deg, #0d1f0d, #091409)",
                  border: "1px solid #1a3a1a", borderRadius: 24, padding: "60px 40px",
                }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: "50%", margin: "0 auto 24px",
                    background: "linear-gradient(135deg, rgba(76,175,80,0.2), rgba(46,125,50,0.1))",
                    border: "2px solid #4CAF50",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 36, animation: "checkmark 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}>✓</div>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 700, marginBottom: 12 }}>
                    Payment Received!
                  </h2>
                  <p style={{ color: "#8aba8a", fontSize: 16, lineHeight: 1.7, marginBottom: 8 }}>
                    Thank you, <strong style={{ color: "#e8f5e8" }}>{formData.name}</strong>. Your payment of{" "}
                    <strong style={{ color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace" }}>${formData.amount}</strong>{" "}
                    has been processed successfully.
                  </p>
                  <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 24, marginTop: 24, marginBottom: 24 }}>
                    <p style={{ color: "#5a8a5a", fontSize: 13, marginBottom: 16 }}>Payment confirmation:</p>
                    <div style={{
                      background: "#080f08", borderRadius: 12, padding: "16px 20px",
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#6a9a6a",
                      textAlign: "left", lineHeight: 1.8,
                    }}>
                      <div><span style={{ color: "#3a5a3a" }}>Name:</span> {formData.name}</div>
                      <div><span style={{ color: "#3a5a3a" }}>Phone:</span> {formData.phone}</div>
                      <div><span style={{ color: "#3a5a3a" }}>Service:</span> {formData.service || "General"}</div>
                      <div><span style={{ color: "#3a5a3a" }}>Amount:</span> <span style={{ color: "#4CAF50" }}>${formData.amount}</span></div>
                      {formData.invoiceNumber && <div><span style={{ color: "#3a5a3a" }}>Invoice #:</span> {formData.invoiceNumber}</div>}
                      {paymentId && <div><span style={{ color: "#3a5a3a" }}>Transaction ID:</span> <span style={{ fontSize: 11 }}>{paymentId}</span></div>}
                    </div>
                  </div>
                  <p style={{ color: "#5a8a5a", fontSize: 14, marginBottom: 20 }}>
                    Questions? We&apos;re here to help.
                  </p>
                  <a href="tel:4076869817" style={{
                    background: "transparent", color: "#4CAF50", border: "2px solid #2a5a2a",
                    padding: "14px 32px", borderRadius: 14, fontSize: 15, fontWeight: 600,
                    textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                    📞 407-686-9817
                  </a>
                  <div style={{ marginTop: 24 }}>
                    <button onClick={() => { setStep("form"); setPaymentId(null); setSameBilling(true); setFormData({ name: "", email: "", phone: "", address: "", city: "", zip: "", billingAddress: "", billingCity: "", billingZip: "", service: "", jobDescription: "", invoiceNumber: "", amount: "" }); }}
                      style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 14, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>
                      Make another payment
                    </button>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}

          {/* ─── FORM + SUMMARY GRID ─── */}
          {step !== "confirm" && (
            <div className="pay-grid pay-grid-reverse" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }}>
              {/* Left: Form */}
              <FadeIn delay={0.15}>
                <div>
                  {/* ─── Step 1: Details ─── */}
                  {step === "form" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                      {/* ── Invoice Summary (invoice mode only) ── */}
                      {invoiceMode && (
                        <div style={{
                          background: "linear-gradient(160deg, #0d1f0d 0%, #091409 100%)",
                          border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px 28px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#e8f5e8", fontWeight: 700 }}>
                              Invoice Summary
                            </h2>
                            {invoiceData && (
                              <span style={{
                                fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                                color: "#4CAF50", background: "rgba(76,175,80,0.1)",
                                border: "1px solid rgba(76,175,80,0.2)", borderRadius: 8,
                                padding: "4px 12px", fontWeight: 600,
                              }}>
                                {invoiceData.invoice_number}
                              </span>
                            )}
                          </div>

                          {invoiceLoading && (
                            <div style={{ color: "#4a7a4a", fontSize: 14, textAlign: "center", padding: "20px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #4CAF50", borderTopColor: "transparent", borderRadius: "50%", animation: "pulse 0.8s linear infinite" }} />
                              Loading invoice…
                            </div>
                          )}

                          {invoiceError && (
                            <div style={{ color: "#ef9a9a", fontSize: 14, padding: "12px 16px", background: "rgba(244,67,54,0.08)", border: "1px solid rgba(244,67,54,0.2)", borderRadius: 10 }}>
                              ⚠️ {invoiceError}
                            </div>
                          )}

                          {invoiceData && !invoiceLoading && (
                            <>
                              {invoiceData.due_date && (
                                <div style={{ fontSize: 13, color: "#7a9a7a", marginBottom: 16 }}>
                                  Due: <span style={{ color: "#c8e0c8", fontWeight: 600 }}>
                                    {new Date(invoiceData.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                  </span>
                                </div>
                              )}

                              {/* Line items */}
                              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 16 }}>
                                {invoiceData.line_items.map((item, i) => (
                                  <div key={item.id || i} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "baseline",
                                    padding: "10px 0",
                                    borderBottom: i < invoiceData.line_items.length - 1 ? "1px solid #112a11" : "none",
                                  }}>
                                    <div style={{ flex: 1, marginRight: 16 }}>
                                      <span style={{ fontSize: 14, color: "#c8e0c8" }}>{item.description}</span>
                                      {item.quantity > 1 && (
                                        <span style={{ fontSize: 12, color: "#5a8a5a", marginLeft: 8 }}>× {item.quantity}</span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: 14, color: "#e8f5e8", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                                      ${item.amount.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Totals */}
                              <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7a9a7a" }}>
                                  <span>Subtotal</span>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>${invoiceData.subtotal.toFixed(2)}</span>
                                </div>
                                {invoiceData.tax_rate > 0 && (
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7a9a7a" }}>
                                    <span>Tax ({invoiceData.tax_rate}%)</span>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>${invoiceData.tax_amount.toFixed(2)}</span>
                                  </div>
                                )}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                                  <span style={{ fontSize: 15, fontWeight: 700, color: "#e8f5e8" }}>Total Due</span>
                                  <span style={{ fontSize: 26, fontWeight: 800, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace" }}>
                                    ${invoiceData.total.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* ── Contact Information ── */}
                      <div style={{
                        background: "linear-gradient(160deg, #0d1f0d 0%, #091409 100%)",
                        border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px 28px",
                      }}>
                        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#e8f5e8", fontWeight: 700, marginBottom: 20 }}>
                          {invoiceMode ? "Contact Information" : "Your Information"}
                        </h2>

                        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                          {/* Name + Phone row */}
                          <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div ref={nameRef} className={showErrors && !formData.name ? "field-invalid" : ""}>
                              <label style={labelStyle}>Full Name *</label>
                              <input className="pay-input" placeholder="John Smith" value={formData.name}
                                onChange={(e) => updateField("name", e.target.value)} />
                              {showErrors && !formData.name && <span className="field-error-msg">Name is required</span>}
                            </div>
                            <div ref={phoneRef} className={showErrors && !formData.phone ? "field-invalid" : ""}>
                              <label style={labelStyle}>Phone Number *</label>
                              <input className="pay-input" placeholder="(407) 555-0123" type="tel" value={formData.phone}
                                onChange={(e) => updateField("phone", e.target.value)} />
                              {showErrors && !formData.phone && <span className="field-error-msg">Phone is required</span>}
                            </div>
                          </div>

                          {/* Email */}
                          <div ref={emailRef} className={showErrors && !formData.email ? "field-invalid" : ""}>
                            <label style={labelStyle}>Email *</label>
                            <input className="pay-input" placeholder="john@example.com" type="email" value={formData.email}
                              onChange={(e) => updateField("email", e.target.value)} />
                            {showErrors && !formData.email && <span className="field-error-msg">Email is required</span>}
                          </div>

                          {/* Generic mode only: Service + Description + Invoice# + Amount */}
                          {!invoiceMode && (
                            <>
                              {/* Service */}
                              <div>
                                <label style={labelStyle}>Service Type</label>
                                <select className="pay-select" value={formData.service}
                                  onChange={(e) => updateField("service", e.target.value)}>
                                  <option value="">Select a service</option>
                                  <option value="Lawn Care">Lawn Care</option>
                                  <option value="Pressure Washing">Pressure Washing / Soft Wash</option>
                                  <option value="Junk Removal">Junk Removal</option>
                                  <option value="Land Clearing">Land Clearing</option>
                                  <option value="Property Cleanup">Property Cleanups</option>
                                  <option value="Other">Other</option>
                                </select>
                              </div>

                              {/* Job Description */}
                              <div>
                                <label style={labelStyle}>Job Description</label>
                                <textarea className="pay-input" placeholder="Describe the work being paid for..." rows={3}
                                  value={formData.jobDescription}
                                  onChange={(e) => updateField("jobDescription", e.target.value)}
                                  style={{ resize: "vertical" }} />
                              </div>

                              {/* Invoice + Amount row */}
                              <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div>
                                  <label style={labelStyle}>Invoice # (optional)</label>
                                  <input className="pay-input" placeholder="INV-001" value={formData.invoiceNumber}
                                    onChange={(e) => updateField("invoiceNumber", e.target.value)} />
                                </div>
                                <div ref={amountRef} className={showErrors && !(formData.amount && parseFloat(formData.amount) > 0) ? "field-invalid" : ""}>
                                  <label style={labelStyle}>Payment Amount *</label>
                                  <div className="amount-input-wrapper">
                                    <input className="pay-input amount-input" placeholder="0.00" value={formData.amount}
                                      onChange={(e) => updateField("amount", formatAmount(e.target.value))}
                                      inputMode="decimal" />
                                  </div>
                                  {showErrors && !(formData.amount && parseFloat(formData.amount) > 0) && <span className="field-error-msg">Enter a valid amount</span>}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* ── Service Address ── */}
                      <div style={{
                        background: "linear-gradient(160deg, #0d1f0d 0%, #091409 100%)",
                        border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px 28px",
                      }}>
                        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#e8f5e8", fontWeight: 700, marginBottom: 8 }}>
                          Service Address
                        </h2>
                        <p style={{ fontSize: 13, color: "#5a8a5a", marginBottom: 20 }}>
                          Where the work is or was performed.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                          <div ref={addressRef} className={showErrors && !formData.address ? "field-invalid" : ""}>
                            <label style={labelStyle}>Street Address *</label>
                            <input className="pay-input" placeholder="123 Main Street" value={formData.address}
                              onChange={(e) => updateField("address", e.target.value)} />
                            {showErrors && !formData.address && <span className="field-error-msg">Address is required</span>}
                          </div>

                          <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
                            <div>
                              <label style={labelStyle}>City</label>
                              <input className="pay-input" placeholder="Deltona" value={formData.city}
                                onChange={(e) => updateField("city", e.target.value)} />
                            </div>
                            <div>
                              <label style={labelStyle}>Zip Code</label>
                              <input className="pay-input" placeholder="32725" value={formData.zip}
                                onChange={(e) => updateField("zip", e.target.value)} />
                            </div>
                          </div>

                          {/* Same-as-service-address checkbox */}
                          <div
                            className={`same-billing-toggle${sameBilling ? " checked" : ""}`}
                            onClick={() => setSameBilling(v => !v)}
                            style={{ display: "flex", alignItems: "center", gap: 12 }}
                          >
                            {/* Custom checkbox */}
                            <div style={{
                              width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                              border: `2px solid ${sameBilling ? "#4CAF50" : "#2a4a2a"}`,
                              background: sameBilling ? "rgba(76,175,80,0.2)" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.2s",
                            }}>
                              {sameBilling && (
                                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                  <path d="M1 4.5L4 7.5L10 1" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 600, color: sameBilling ? "#8aba8a" : "#5a8a5a" }}>
                                Billing address same as service address
                              </p>
                              {!sameBilling && (
                                <p style={{ fontSize: 12, color: "#3a5a3a", marginTop: 2 }}>
                                  Enter a different billing address below
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Animated billing address */}
                          <div className={`billing-expand${sameBilling ? " closed" : " open"}`}>
                            <div style={{
                              background: "rgba(33,150,243,0.04)", border: "1px solid rgba(33,150,243,0.15)",
                              borderRadius: 14, padding: "20px 18px",
                              display: "flex", flexDirection: "column", gap: 14,
                            }}>
                              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#42a5f5", textTransform: "uppercase" }}>
                                Billing Address
                              </p>
                              <div>
                                <label style={{ ...labelStyle, color: "#5a8a9a" }}>Street Address</label>
                                <input className="pay-input" placeholder="123 Billing Street" value={formData.billingAddress}
                                  onChange={(e) => updateField("billingAddress", e.target.value)}
                                  style={{ borderColor: "rgba(33,150,243,0.2)" }} />
                              </div>
                              <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
                                <div>
                                  <label style={{ ...labelStyle, color: "#5a8a9a" }}>City</label>
                                  <input className="pay-input" placeholder="Deltona" value={formData.billingCity}
                                    onChange={(e) => updateField("billingCity", e.target.value)}
                                    style={{ borderColor: "rgba(33,150,243,0.2)" }} />
                                </div>
                                <div>
                                  <label style={{ ...labelStyle, color: "#5a8a9a" }}>Zip Code</label>
                                  <input className="pay-input" placeholder="32725" value={formData.billingZip}
                                    onChange={(e) => updateField("billingZip", e.target.value)}
                                    style={{ borderColor: "rgba(33,150,243,0.2)" }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Continue button */}
                      <button className="cta-pay" onClick={handleContinue} style={{ marginTop: 4 }}>
                        Continue to Payment →
                      </button>
                    </div>
                  )}

                  {/* ─── Step 2: Payment ─── */}
                  {step === "payment" && (
                    <div style={{
                      background: "linear-gradient(160deg, #0d1f0d 0%, #091409 100%)",
                      border: "1px solid #1a3a1a", borderRadius: 20, padding: "36px 32px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#e8f5e8", fontWeight: 700 }}>
                          Payment Details
                        </h2>
                        <button onClick={() => { setStep("form"); setShowErrors(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{
                          background: "none", border: "none", color: "#5a8a5a", fontSize: 14,
                          cursor: "pointer", fontFamily: "inherit",
                        }}>← Edit Info</button>
                      </div>

                      {/* Square card — SquareCardSection mounts fresh on each visit */}
                      <div style={{
                        border: "1px solid #1a3a1a", borderRadius: 16, padding: "24px",
                        background: "#0a160a", marginBottom: 24,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                          <span style={{ fontSize: 20 }}>💳</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#8aba8a" }}>Card Information</span>
                          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                            {["VISA", "MC", "AMEX"].map(brand => (
                              <span key={brand} style={{
                                padding: "2px 8px", background: "#0d1a0d", border: "1px solid #1a3a1a",
                                borderRadius: 4, fontSize: 10, fontWeight: 700, color: "#5a8a5a",
                                fontFamily: "'JetBrains Mono', monospace",
                              }}>{brand}</span>
                            ))}
                          </div>
                        </div>

                        <SquareCardSection
                          onReady={(card) => { setSquareCard(card); setPaymentError(null); }}
                          onError={(msg) => setPaymentError(`Card form error: ${msg}. Please call us at 407-686-9817.`)}
                        />

                        {paymentError && (
                          <div style={{
                            marginTop: 12, padding: "12px 16px", background: "rgba(244,67,54,0.08)",
                            borderRadius: 10, border: "1px solid rgba(244,67,54,0.2)",
                            fontSize: 13, color: "#ef9a9a", lineHeight: 1.5,
                          }}>
                            ⚠️ {paymentError}
                          </div>
                        )}

                        <div style={{
                          marginTop: 16, padding: "10px 14px", background: "rgba(76,175,80,0.05)",
                          borderRadius: 8, border: "1px solid rgba(76,175,80,0.1)",
                          fontSize: 11, color: "#4a7a4a", lineHeight: 1.6,
                        }}>
                          🔒 Secured by Square. Your card details are encrypted and never stored on our servers.
                        </div>
                      </div>

                      {/* Save card checkbox — only for signed-in users */}
                      {clerkUserId && (
                        <label style={{
                          display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                          padding: "14px 16px", background: "rgba(76,175,80,0.05)",
                          border: "1px solid rgba(76,175,80,0.15)", borderRadius: 12, marginBottom: 20,
                        }}>
                          <input
                            type="checkbox"
                            checked={saveCard}
                            onChange={(e) => setSaveCard(e.target.checked)}
                            style={{ width: 18, height: 18, accentColor: "#4CAF50", cursor: "pointer" }}
                          />
                          <span style={{ fontSize: 14, color: "#8aba8a", fontWeight: 500 }}>
                            Save this card for future payments
                          </span>
                        </label>
                      )}

                      <button className="cta-pay" onClick={handlePayment} disabled={!squareCard || isProcessing}>
                        {isProcessing ? (
                          <><span style={{ fontSize: 16, animation: "pulse 1s infinite" }}>⏳</span> Processing…</>
                        ) : (
                          <><span style={{ fontSize: 18 }}>🔒</span> Pay ${formData.amount || "0.00"}</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </FadeIn>

              {/* Right: Summary Card */}
              <FadeIn delay={0.25} direction="left">
                <div className="summary-card">
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#e8f5e8", fontWeight: 700, marginBottom: 24 }}>
                    Payment Summary
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                    {[
                      ["Customer", formData.name || "—"],
                      ["Phone", formData.phone || "—"],
                      ...(!invoiceMode ? [["Service", formData.service || "—"]] : []),
                      ["Invoice", formData.invoiceNumber || "—"],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                        <span style={{ color: "#5a8a5a" }}>{label}</span>
                        <span style={{ color: "#c8e0c8", fontWeight: 500, textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Invoice line items in summary sidebar */}
                  {invoiceMode && invoiceData && invoiceData.line_items.length > 0 && (
                    <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Services</div>
                      {invoiceData.line_items.map((item, i) => (
                        <div key={item.id || i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                          <span style={{ color: "#8aba8a", flex: 1, marginRight: 8, lineHeight: 1.4 }}>
                            {item.description}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                          </span>
                          <span style={{ color: "#c8e0c8", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                            ${item.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {invoiceData.tax_rate > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4, color: "#5a8a5a" }}>
                          <span>Tax ({invoiceData.tax_rate}%)</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>${invoiceData.tax_amount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 16, marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 14, color: "#7a9a7a", fontWeight: 600 }}>Total Due</span>
                      <span style={{
                        fontSize: 32, fontWeight: 800, color: "#4CAF50",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        ${formData.amount || "0.00"}
                      </span>
                    </div>
                  </div>

                  {/* Trust signals */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="trust-badge">🔒 Secure payment</div>
                    <div className="trust-badge">🛡️ Reliable & Insured</div>
                    <div className="trust-badge">✓ Free estimates available</div>
                  </div>

                  {/* Account CTA */}
                  <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #1a3a1a" }}>
                    <p style={{ fontSize: 13, color: "#5a8a5a", marginBottom: 12, lineHeight: 1.6 }}>
                      Want to track payments, view history & manage subscriptions?
                    </p>
                    <Link href="/account" className="cta-secondary-pay" style={{
                      display: "block", textDecoration: "none",
                    }}>
                      Create an Account →
                    </Link>
                  </div>

                  {/* Help */}
                  <div style={{ marginTop: 20, textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "#3a5a3a" }}>
                      Need help? <a href="tel:4076869817" style={{ color: "#4CAF50", textDecoration: "none" }}>407-686-9817</a>
                    </p>
                  </div>
                </div>
              </FadeIn>
            </div>
          )}
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: "#030a03", borderTop: "1px solid #1a3a1a", padding: "40px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/jhps-nav-logo.svg" alt="JHPS" style={{ maxWidth: 160, height: "auto", maxHeight: 36, opacity: 0.7 }} />
            </Link>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <a href="tel:4076869817" style={{ color: "#4CAF50", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>📞 407-686-9817</a>
            <a href="mailto:Info@jhpsfl.com" style={{ color: "#4CAF50", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>✉️ Email</a>
            <Link href="/account" style={{ color: "#5a8a5a", fontSize: 13, textDecoration: "none" }}>My Account</Link>
          </div>
          <div style={{ color: "#2a4a2a", fontSize: 12, width: "100%", textAlign: "center", marginTop: 16 }}>
            © 2025 Jenkins Home & Property Solutions. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
