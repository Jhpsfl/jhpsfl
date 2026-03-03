"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth, useSignIn, useSignUp, useClerk } from "@clerk/nextjs";
import { getBrand, type BrandConfig } from "@/lib/brand-config";

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
  onReady, onError, squareStyle,
}: {
  onReady: (card: SquareCard) => void;
  onError: (msg: string) => void;
  squareStyle?: Record<string, Record<string, string>>;
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
          style: squareStyle || {},
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
  brand?: string;
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
  const { userId: clerkUserId, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { signOut } = useClerk();
  const searchParams = useSearchParams();
  const paymentLabel = searchParams.get("payment_label") || "";
  const isDeposit = paymentLabel.toLowerCase().includes("deposit");
  const isTestMode = searchParams.get("test") === "1";

  // ─── Brand theming ───
  const brandParam = searchParams.get("brand");
  const [brandKey, setBrandKey] = useState<string>(brandParam || "jhps");
  const [brandResolved, setBrandResolved] = useState<boolean>(!!brandParam);
  const brand: BrandConfig = getBrand(brandKey);

  // Account creation for deposit payments
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [accountCreating, setAccountCreating] = useState(false);

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
            // Set brand from invoice if present
            if (data.invoice.brand) setBrandKey(data.invoice.brand);
            setBrandResolved(true);
            // Lock the amount to the real invoice total — UNLESS a specific amount was passed in URL (e.g. deposit)
            const urlAmount = searchParams.get("amount");
            if (!urlAmount) {
              setFormData(prev => ({ ...prev, amount: data.invoice.total.toFixed(2) }));
            }
          } else {
            setInvoiceError(data.error || "Could not load invoice details.");
            setBrandResolved(true);
          }
        })
        .catch(() => { setInvoiceError("Could not load invoice details."); setBrandResolved(true); })
        .finally(() => setInvoiceLoading(false));
    } else {
      setBrandResolved(true);
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
    // Deposit payments require password when not signed in
    const passwordValid = !isDeposit || isSignedIn || accountCreated || (password.length >= 8 && password === confirmPassword);
    if (!valid || !passwordValid) {
      setShowErrors(true);
      if (!valid) {
        const firstError =
          !formData.name ? nameRef :
          !formData.phone ? phoneRef :
          !formData.email ? emailRef :
          !formData.address ? addressRef :
          amountRef;
        firstError.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        const inputs = firstError.current?.querySelectorAll(".pay-input, .amount-input-wrapper");
        inputs?.forEach(el => {
          (el as HTMLElement).style.animation = "none";
          (el as HTMLElement).offsetHeight;
          (el as HTMLElement).style.animation = "";
        });
      } else if (!passwordValid) {
        if (password.length < 8) setAccountError("Password must be at least 8 characters");
        else if (password !== confirmPassword) setAccountError("Passwords don't match");
      }
      return;
    }
    setShowErrors(false);
    setPaymentError(null);
    setSquareCard(null);
    setStep("payment");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Create Clerk account and sign in using frontend SDK
  const createAndSignIn = async (): Promise<boolean> => {
    if (!signUp || !signIn) return false;
    setAccountError(null);
    setAccountCreating(true);
    try {
      // Try to create the account via Clerk frontend SDK
      const result = await signUp.create({
        emailAddress: formData.email,
        password,
        firstName: formData.name.split(" ")[0] || "",
        lastName: formData.name.split(" ").slice(1).join(" ") || "",
      });

      if (result.status === "complete") {
        // Account created — set active session
        if (result.createdSessionId) {
          await signIn.create({ transfer: true });
        }
        // Also link to customer record via backend
        fetch("/api/customer/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email, password, name: formData.name, phone: formData.phone,
          }),
        }).catch(() => {}); // fire-and-forget, non-blocking
        setAccountCreated(true);
        setAccountCreating(false);
        return true;
      }

      // Handle email verification if Clerk requires it
      if (result.status === "missing_requirements") {
        // Clerk might need email verification — try to prepare it
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setAccountError("Please check your email for a verification code. You can complete verification after payment.");
        setAccountCreated(true); // Let them proceed
        setAccountCreating(false);
        return true;
      }

      setAccountError("Account creation incomplete. Please try again.");
      setAccountCreating(false);
      return false;
    } catch (err: unknown) {
      // If account already exists, try to sign in instead
      const clerkErr = err as { errors?: { code: string; message: string }[] };
      if (clerkErr.errors?.some(e => e.code === "form_identifier_exists")) {
        try {
          const signInResult = await signIn.create({
            identifier: formData.email,
            password,
          });
          if (signInResult.status === "complete") {
            setAccountCreated(true);
            setAccountCreating(false);
            return true;
          }
        } catch {
          setAccountError("Account exists but password is incorrect. Please use the correct password or reset it.");
          setAccountCreating(false);
          return false;
        }
      }
      const msg = clerkErr.errors?.[0]?.message || "Failed to create account";
      setAccountError(msg);
      setAccountCreating(false);
      return false;
    }
  };

  const handlePayment = async () => {
    if (!squareCard || isProcessing) return;
    setIsProcessing(true);
    setPaymentError(null);
    setAccountError(null);

    try {
      // For deposit payments: create account + sign in FIRST
      if (isDeposit && !isSignedIn && !accountCreated && password) {
        const ok = await createAndSignIn();
        if (!ok) { setIsProcessing(false); return; }
      }

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
    fontSize: 12, fontWeight: 600, color: brand.colors.textMuted, letterSpacing: 1.5,
    textTransform: "uppercase" as const, marginBottom: 6, display: "block",
  };

  return (
    <>
      {!brandResolved && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "#080808",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ width: 28, height: 28, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "rgba(255,255,255,0.5)", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "block" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <style>{`
        @import url('${brand.fonts.googleImport}');

        :root {
          --pay-bg: ${brand.colors.bg};
          --pay-bg-elevated: ${brand.colors.bgElevated};
          --pay-bg-card: ${brand.colors.bgCard};
          --pay-accent: ${brand.colors.primary};
          --pay-accent-dark: ${brand.colors.primaryDark};
          --pay-accent-glow: ${brand.colors.glow};
          --pay-text: ${brand.colors.textPrimary};
          --pay-text-secondary: ${brand.colors.textSecondary};
          --pay-text-muted: ${brand.colors.textMuted};
          --pay-border: ${brand.colors.border};
          --pay-border-hover: ${brand.colors.borderHover};
          --pay-font-display: ${brand.fonts.display};
          --pay-font-body: ${brand.fonts.body};
          --pay-font-mono: ${brand.fonts.mono};
        }

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { font-family: var(--pay-font-body); background: var(--pay-bg); color: ${brand.colors.textSecondary}; overflow-x: hidden; }

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
        .pay-input.input-error {
          border-color: #ef5350 !important;
          box-shadow: 0 0 0 3px rgba(239,83,80,0.2) !important;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .nav-blur { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }

        .pay-input {
          width: 100%; padding: 14px 16px; background: var(--pay-bg-elevated);
          border: 1px solid var(--pay-border); border-radius: 12px; color: var(--pay-text);
          font-size: 15px; outline: none; font-family: var(--pay-font-body);
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .pay-input:focus {
          border-color: var(--pay-accent);
          box-shadow: 0 0 0 3px var(--pay-accent-glow);
        }
        .pay-input::placeholder { color: var(--pay-text-muted); }
        .pay-input-mono {
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 1.5px;
        }

        .pay-select {
          width: 100%; padding: 14px 16px; background: var(--pay-bg-elevated);
          border: 1px solid var(--pay-border); border-radius: 12px; color: var(--pay-text);
          font-size: 15px; outline: none; font-family: var(--pay-font-body);
          transition: border-color 0.3s, box-shadow 0.3s;
          appearance: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='${encodeURIComponent(brand.colors.primary)}' stroke-width='2' fill='none'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 16px center;
        }
        .pay-select:focus {
          border-color: var(--pay-accent);
          box-shadow: 0 0 0 3px var(--pay-accent-glow);
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
          color: var(--pay-accent);
          font-size: 22px;
          font-weight: 700;
          font-family: var(--pay-font-mono);
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
          background: ${brand.colors.primaryDark ? `linear-gradient(135deg, ${brand.colors.primary}, ${brand.colors.primaryDark})` : brand.colors.primary};
          color: ${brand.key === 'nexa' ? '#0A1628' : '#fff'};
          box-shadow: 0 0 20px var(--pay-accent-glow);
        }
        .step-dot.completed {
          background: var(--pay-accent);
          color: ${brand.key === 'nexa' ? '#0A1628' : '#fff'};
        }
        .step-dot.inactive {
          background: var(--pay-bg-elevated);
          border: 2px solid var(--pay-border);
          color: var(--pay-text-muted);
        }
        .step-line {
          flex: 1;
          height: 2px;
          background: var(--pay-border);
          transition: background 0.4s;
        }
        .step-line.active {
          background: ${brand.colors.primaryDark ? `linear-gradient(90deg, ${brand.colors.primary}, ${brand.colors.primaryDark})` : brand.colors.primary};
        }

        .cta-pay {
          background: ${brand.colors.primaryDark ? `linear-gradient(135deg, ${brand.colors.primary} 0%, ${brand.colors.primaryDark} 100%)` : brand.colors.primary};
          color: ${brand.key === 'nexa' ? '#0A1628' : '#fff'}; border: none; padding: 18px 40px; border-radius: 14px;
          font-size: 17px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px;
          box-shadow: 0 4px 24px var(--pay-accent-glow);
          transition: transform 0.3s, box-shadow 0.3s;
          font-family: var(--pay-font-body);
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .cta-pay:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 40px var(--pay-accent-glow);
        }
        .cta-pay:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cta-secondary-pay {
          background: transparent; color: var(--pay-accent); border: 2px solid var(--pay-border);
          padding: 14px 32px; border-radius: 14px; font-size: 15px; font-weight: 600;
          cursor: pointer; transition: all 0.3s; font-family: var(--pay-font-body);
          width: 100%; text-align: center;
        }
        .cta-secondary-pay:hover {
          background: var(--pay-accent-glow);
          border-color: var(--pay-accent);
        }

        .summary-card {
          background: linear-gradient(160deg, ${brand.colors.bgElevated} 0%, ${brand.colors.bgCard} 100%);
          border: 1px solid var(--pay-border);
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
          background: var(--pay-accent-glow);
          border: 1px solid ${brand.colors.borderHover};
          border-radius: 8px;
          font-size: 12px;
          color: var(--pay-text-secondary);
          font-weight: 500;
        }

        .mobile-menu {
          position: fixed; inset: 0; z-index: 9997;
          background: ${brand.key === 'nexa' ? 'rgba(10,22,40,0.98)' : 'rgba(5,14,5,0.98)'}; backdrop-filter: blur(20px);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px;
          animation: fadeIn 0.3s ease;
        }
        .mobile-menu a { color: var(--pay-text); font-size: 28px; font-weight: 600; text-decoration: none; transition: color 0.3s; font-family: var(--pay-font-display); }
        .mobile-menu a:hover { color: var(--pay-accent); }

        .same-billing-toggle {
          display: flex; align-items: center; gap: 12px; cursor: pointer;
          padding: 12px 16px; border-radius: 10px;
          border: 1px solid var(--pay-border); background: var(--pay-accent-glow);
          transition: border-color 0.2s, background 0.2s;
          user-select: none; width: 100%; box-sizing: border-box;
        }
        .same-billing-toggle:hover {
          border-color: var(--pay-accent);
          background: var(--pay-accent-glow);
        }
        .same-billing-toggle.checked {
          border-color: var(--pay-accent);
          background: var(--pay-accent-glow);
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
        background: scrollY > 50 ? `${brand.key === 'nexa' ? 'rgba(10,22,40,0.92)' : 'rgba(5,14,5,0.92)'}` : `${brand.key === 'nexa' ? 'rgba(10,22,40,0.8)' : 'rgba(5,14,5,0.8)'}`,
        borderBottom: `1px solid ${brand.colors.borderHover}`,
        transition: "all 0.4s", padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}>
          <Link href={brand.key === 'nexa' ? 'https://nexavisiongroup.com' : '/'} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logo} alt={brand.shortName} style={{ maxWidth: 200, height: "auto", maxHeight: 44 }} />
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 28 }} className="desktop-nav">
            <Link href={brand.key === 'nexa' ? 'https://nexavisiongroup.com' : '/'} style={{ color: brand.colors.textSecondary, fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "color 0.3s" }}
              onMouseOver={(e) => { e.currentTarget.style.color = brand.colors.primary; }}
              onMouseOut={(e) => { e.currentTarget.style.color = brand.colors.textSecondary; }}>
              ← Back to Home
            </Link>
            {brand.key === 'jhps' && (
              <Link href="/account" style={{
                color: brand.colors.primary, fontSize: 14, fontWeight: 600, textDecoration: "none",
                padding: "8px 20px", border: `1px solid ${brand.colors.border}`, borderRadius: 10,
                transition: "all 0.3s",
              }}
                onMouseOver={(e) => { e.currentTarget.style.background = brand.colors.glow; e.currentTarget.style.borderColor = brand.colors.primary; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = brand.colors.border; }}>
                My Account
              </Link>
            )}
            <a href={`tel:${brand.phone.replace(/[^0-9]/g, '')}`} style={{
              background: brand.colors.primaryDark ? `linear-gradient(135deg, ${brand.colors.primary}, ${brand.colors.primaryDark})` : brand.colors.primary,
              color: brand.key === 'nexa' ? '#0A1628' : '#fff',
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
            <span style={{ width: 24, height: 2, background: brand.colors.primary, borderRadius: 2, display: "block", transition: "all 0.3s", transform: menuOpen ? "rotate(45deg) translateY(7px)" : "none" }} />
            <span style={{ width: 24, height: 2, background: brand.colors.primary, borderRadius: 2, display: "block", transition: "all 0.3s", opacity: menuOpen ? 0 : 1 }} />
            <span style={{ width: 24, height: 2, background: brand.colors.primary, borderRadius: 2, display: "block", transition: "all 0.3s", transform: menuOpen ? "rotate(-45deg) translateY(-7px)" : "none" }} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="mobile-menu">
          <button onClick={() => setMenuOpen(false)} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", color: brand.colors.primary, fontSize: 32, cursor: "pointer" }}>✕</button>
          <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/account" onClick={() => setMenuOpen(false)}>My Account</Link>
          <a href="tel:4076869817" style={{ color: brand.colors.primary }}>📞 407-686-9817</a>
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <main style={{ minHeight: "100vh", paddingTop: 72, background: brand.key === 'nexa' ? `linear-gradient(170deg, #050B18 0%, #0A1628 40%, #050B18 100%)` : `linear-gradient(170deg, #050e05 0%, #081808 40%, #050e05 100%)` }}>
        {/* Background accents */}
        <div style={{
          position: "fixed", top: "20%", right: "-10%", width: 600, height: 600,
          borderRadius: "50%", background: `radial-gradient(circle, ${brand.colors.glow.replace('0.35', '0.04').replace('0.2', '0.04')} 0%, transparent 70%)`,
          pointerEvents: "none", zIndex: 0,
        }} />
        <div style={{
          position: "fixed", bottom: "10%", left: "-10%", width: 500, height: 500,
          borderRadius: "50%", background: `radial-gradient(circle, ${brand.colors.glow.replace('0.35', '0.03').replace('0.2', '0.03')} 0%, transparent 70%)`,
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px", position: "relative", zIndex: 1 }}>
          {/* Page Header */}
          <FadeIn delay={0.05}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px",
                background: brand.colors.glow, border: `1px solid ${brand.colors.borderHover}`,
                borderRadius: 40, marginBottom: 20,
              }}>
                <span style={{ fontSize: 16 }}>💳</span>
                <span style={{ fontSize: 13, color: brand.colors.primary, fontWeight: 600, letterSpacing: 1 }}>SECURE PAYMENT</span>
              </div>
              <h1 style={{
                fontFamily: brand.fonts.display, fontSize: 42, fontWeight: 800,
                color: brand.colors.textPrimary, lineHeight: 1.15, marginBottom: 12,
              }}>
                Make a{" "}
                <span style={{
                  background: brand.key === 'nexa'
                    ? "linear-gradient(135deg, #33FFD8, #00E5CC, #009E8F)"
                    : `linear-gradient(135deg, ${brand.colors.primary}, ${brand.colors.primaryDark}, ${brand.colors.primary})`,
                  backgroundSize: "200% 200%", animation: "gradientShift 4s ease infinite",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  backgroundClip: "text", color: "transparent",
                  display: "inline",
                }}>Payment</span>
              </h1>
              <p style={{ color: brand.colors.textMuted, fontSize: 16, maxWidth: 520, margin: "0 auto" }}>
                Pay for services quickly and securely.{brand.key === 'jhps' && (<>{" "}Have an account?{" "}
                <Link href="/account" style={{ color: brand.colors.primary, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>
                  Sign in for faster checkout
                </Link></>)}
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
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: brand.colors.textMuted, letterSpacing: 1, fontWeight: 600 }}>
                <span style={{ color: step === "form" ? brand.colors.primary : brand.colors.textMuted }}>DETAILS</span>
                <span style={{ color: step === "payment" ? brand.colors.primary : brand.colors.textMuted }}>PAYMENT</span>
                <span style={{ color: step === "confirm" ? brand.colors.primary : brand.colors.textMuted }}>DONE</span>
              </div>
            </div>
          </FadeIn>

          {/* ─── CONFIRMATION STATE ─── */}
          {step === "confirm" && (
            <FadeIn delay={0.1}>
              <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
                <div style={{
                  background: `linear-gradient(160deg, ${brand.colors.bgElevated}, ${brand.colors.bgCard})`,
                  border: `1px solid ${brand.colors.border}`, borderRadius: 24, padding: "60px 40px",
                }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: "50%", margin: "0 auto 24px",
                    background: brand.colors.glow,
                    border: `2px solid ${brand.colors.primary}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 36, animation: "checkmark 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}>✓</div>
                  <h2 style={{ fontFamily: brand.fonts.display, fontSize: 28, color: brand.colors.textPrimary, fontWeight: 700, marginBottom: 12 }}>
                    Payment Received!
                  </h2>
                  <p style={{ color: brand.colors.textSecondary, fontSize: 16, lineHeight: 1.7, marginBottom: 8 }}>
                    Thank you, <strong style={{ color: brand.colors.textPrimary }}>{formData.name}</strong>. Your {isDeposit ? "deposit" : "payment"} of{" "}
                    <strong style={{ color: brand.colors.primary, fontFamily: brand.fonts.mono }}>${formData.amount}</strong>{" "}
                    has been processed successfully.
                  </p>

                  {/* Deposit: prompt to go to their new account */}
                  {isDeposit && accountCreated && (
                    <div style={{
                      background: brand.colors.glow, border: `1px solid ${brand.colors.border}`,
                      borderRadius: 14, padding: "16px 20px", marginTop: 20, marginBottom: 4,
                    }}>
                      <p style={{ color: brand.colors.primary, fontSize: 14, fontWeight: 700, marginBottom: 6 }}>🎉 Your account has been created!</p>
                      <p style={{ color: brand.colors.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
                        Sign in to your customer portal to view your payment plan, job details, and contract documents.
                      </p>
                    </div>
                  )}
                  <div style={{ borderTop: `1px solid ${brand.colors.border}`, paddingTop: 24, marginTop: 24, marginBottom: 24 }}>
                    <p style={{ color: brand.colors.textMuted, fontSize: 13, marginBottom: 16 }}>Payment confirmation:</p>
                    <div style={{
                      background: "#080f08", borderRadius: 12, padding: "16px 20px",
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#6a9a6a",
                      textAlign: "left", lineHeight: 1.8,
                    }}>
                      <div><span style={{ color: brand.colors.textMuted }}>Name:</span> {formData.name}</div>
                      <div><span style={{ color: brand.colors.textMuted }}>Phone:</span> {formData.phone}</div>
                      <div><span style={{ color: brand.colors.textMuted }}>Service:</span> {formData.service || "General"}</div>
                      <div><span style={{ color: brand.colors.textMuted }}>Amount:</span> <span style={{ color: brand.colors.primary }}>${formData.amount}</span></div>
                      {formData.invoiceNumber && <div><span style={{ color: brand.colors.textMuted }}>Invoice #:</span> {formData.invoiceNumber}</div>}
                      {paymentId && <div><span style={{ color: brand.colors.textMuted }}>Transaction ID:</span> <span style={{ fontSize: 11 }}>{paymentId}</span></div>}
                    </div>
                  </div>
                  <p style={{ color: brand.colors.textMuted, fontSize: 14, marginBottom: 20 }}>
                    Questions? We&apos;re here to help.
                  </p>
                  <a href="tel:4076869817" style={{
                    background: "transparent", color: brand.colors.primary, border: `2px solid ${brand.colors.border}`,
                    padding: "14px 32px", borderRadius: 14, fontSize: 15, fontWeight: 600,
                    textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                    📞 407-686-9817
                  </a>

                  {/* Dashboard link for deposit customers — already signed in via Clerk */}
                  {isDeposit && accountCreated && (
                    <div style={{ marginTop: 20 }}>
                      <Link href="/account?welcome=true" style={{
                        display: "block", textAlign: "center", padding: "16px",
                        background: `linear-gradient(135deg, ${brand.colors.primary}, ${brand.colors.primaryDark})`, color: "#fff",
                        borderRadius: 14, fontWeight: 700, fontSize: 16, textDecoration: "none",
                        boxShadow: `0 4px 20px ${brand.colors.glow}`,
                      }}>
                        Go to Your Dashboard →
                      </Link>
                    </div>
                  )}
                  <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                    <button onClick={() => { setStep("form"); setPaymentId(null); setSameBilling(true); setFormData({ name: "", email: "", phone: "", address: "", city: "", zip: "", billingAddress: "", billingCity: "", billingZip: "", service: "", jobDescription: "", invoiceNumber: "", amount: "" }); }}
                      style={{ background: "none", border: "none", color: brand.colors.textMuted, fontSize: 14, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>
                      Make another payment
                    </button>
                    {isSignedIn && (
                      <>
                        <span style={{ color: `${brand.colors.border}` }}>·</span>
                        <button onClick={() => signOut()} style={{ background: "none", border: "none", color: brand.colors.textMuted, fontSize: 14, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>
                          Sign out
                        </button>
                      </>
                    )}
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
                          background: brand.colors.bgElevated,
                          border: `1px solid ${brand.colors.border}`, borderRadius: 20, padding: "28px 28px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                            <h2 style={{ fontFamily: brand.fonts.display, fontSize: 20, color: brand.colors.textPrimary, fontWeight: 700 }}>
                              Invoice Summary
                            </h2>
                            {invoiceData && (
                              <span style={{
                                fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                                color: brand.colors.primary, background: brand.colors.glow,
                                border: `1px solid ${brand.colors.border}`, borderRadius: 8,
                                padding: "4px 12px", fontWeight: 600,
                              }}>
                                {invoiceData.invoice_number}
                              </span>
                            )}
                          </div>

                          {invoiceLoading && (
                            <div style={{ color: "#4a7a4a", fontSize: 14, textAlign: "center", padding: "20px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                              <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid ${brand.colors.primary}`, borderTopColor: "transparent", borderRadius: "50%", animation: "pulse 0.8s linear infinite" }} />
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
                                <div style={{ fontSize: 13, color: brand.colors.textMuted, marginBottom: 16 }}>
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
                                        <span style={{ fontSize: 12, color: brand.colors.textMuted, marginLeft: 8 }}>× {item.quantity}</span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: 14, color: brand.colors.textPrimary, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                                      ${item.amount.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Totals */}
                              <div style={{ borderTop: `1px solid ${brand.colors.border}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                {isDeposit ? (
                                  <>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: brand.colors.textMuted }}>
                                      <span>Total Contract Price</span>
                                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>${invoiceData.total.toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4, paddingTop: 8, borderTop: `1px dashed ${brand.colors.border}` }}>
                                      <span style={{ fontSize: 15, fontWeight: 700, color: "#ffa726" }}>{paymentLabel || "Deposit Due Now"}</span>
                                      <span style={{ fontSize: 26, fontWeight: 800, color: brand.colors.primary, fontFamily: "'JetBrains Mono', monospace" }}>
                                        ${formData.amount || "0.00"}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: brand.colors.textMuted }}>
                                      <span>Subtotal</span>
                                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>${invoiceData.subtotal.toFixed(2)}</span>
                                    </div>
                                    {invoiceData.tax_rate > 0 && (
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: brand.colors.textMuted }}>
                                        <span>Tax ({invoiceData.tax_rate}%)</span>
                                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>${invoiceData.tax_amount.toFixed(2)}</span>
                                      </div>
                                    )}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                                      <span style={{ fontSize: 15, fontWeight: 700, color: brand.colors.textPrimary }}>Total Due</span>
                                      <span style={{ fontSize: 26, fontWeight: 800, color: brand.colors.primary, fontFamily: "'JetBrains Mono', monospace" }}>
                                        ${invoiceData.total.toFixed(2)}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* ── Contact Information ── */}
                      <div style={{
                        background: brand.colors.bgElevated,
                        border: `1px solid ${brand.colors.border}`, borderRadius: 20, padding: "28px 28px",
                      }}>
                        <h2 style={{ fontFamily: brand.fonts.display, fontSize: 20, color: brand.colors.textPrimary, fontWeight: 700, marginBottom: 20 }}>
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

                          {/* Create Account — for deposit payments when not signed in */}
                          {isDeposit && !isSignedIn && !accountCreated && (
                            <div style={{
                              background: brand.colors.glow,
                              border: `1px solid ${showErrors && isDeposit && (!password || password.length < 8 || password !== confirmPassword) ? "rgba(239,83,80,0.5)" : `${brand.colors.glow}`}`,
                              borderRadius: 14, padding: "20px 20px 16px",
                              transition: "border-color 0.3s",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 18 }}>🔐</span>
                                <div>
                                  <p style={{ color: brand.colors.textPrimary, fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Create Your Account</p>
                                  <p style={{ color: brand.colors.textMuted, fontSize: 12 }}>Set a password to access your customer portal after payment</p>
                                </div>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <div>
                                  <label style={labelStyle}>Password *</label>
                                  <div style={{ position: "relative" }}>
                                    <input
                                      className={`pay-input ${showErrors && (!password || password.length < 8) ? "input-error" : ""}`}
                                      placeholder="Min 8 characters"
                                      type={showPassword ? "text" : "password"}
                                      value={password}
                                      onChange={(e) => { setPassword(e.target.value); setAccountError(null); }}
                                      autoComplete="new-password"
                                      style={{ paddingRight: 44 }}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                                      background: "none", border: "none", cursor: "pointer", padding: 4,
                                      fontSize: 13, color: brand.colors.textMuted,
                                    }}>
                                      {showPassword ? "Hide" : "Show"}
                                    </button>
                                  </div>
                                  {showErrors && !password && <span className="field-error-msg">Password is required</span>}
                                  {showErrors && password && password.length < 8 && <span className="field-error-msg">Minimum 8 characters</span>}
                                </div>
                                <div>
                                  <label style={labelStyle}>Confirm *</label>
                                  <input
                                    className={`pay-input ${showErrors && password && confirmPassword && password !== confirmPassword ? "input-error" : ""}`}
                                    placeholder="Confirm password"
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => { setConfirmPassword(e.target.value); setAccountError(null); }}
                                    autoComplete="new-password"
                                  />
                                  {showErrors && password && confirmPassword && password !== confirmPassword && <span className="field-error-msg">Passwords don&apos;t match</span>}
                                </div>
                              </div>
                              {accountError && (
                                <p style={{ color: "#ef5350", fontSize: 12, marginTop: 8, padding: "8px 12px", background: "rgba(239,83,80,0.08)", borderRadius: 8 }}>
                                  {accountError}
                                </p>
                              )}
                            </div>
                          )}
                          {isDeposit && isSignedIn && (
                            <div style={{
                              background: brand.colors.glow,
                              border: `1px solid ${brand.colors.border}`,
                              borderRadius: 14, padding: "12px 16px",
                              display: "flex", alignItems: "center", gap: 8,
                            }}>
                              <span style={{ color: brand.colors.primary, fontSize: 14 }}>✓</span>
                              <span style={{ color: brand.colors.textSecondary, fontSize: 13 }}>Signed in — payment will be linked to your account</span>
                            </div>
                          )}

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
                        background: brand.colors.bgElevated,
                        border: `1px solid ${brand.colors.border}`, borderRadius: 20, padding: "28px 28px",
                      }}>
                        <h2 style={{ fontFamily: brand.fonts.display, fontSize: 20, color: brand.colors.textPrimary, fontWeight: 700, marginBottom: 8 }}>
                          Service Address
                        </h2>
                        <p style={{ fontSize: 13, color: brand.colors.textMuted, marginBottom: 20 }}>
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
                              border: `2px solid ${sameBilling ? "#4CAF50" : `${brand.colors.border}`}`,
                              background: sameBilling ? `${brand.colors.glow}` : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.2s",
                            }}>
                              {sameBilling && (
                                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                  <path d="M1 4.5L4 7.5L10 1" stroke="${brand.colors.primary}" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 600, color: sameBilling ? brand.colors.textSecondary : brand.colors.textMuted }}>
                                Billing address same as service address
                              </p>
                              {!sameBilling && (
                                <p style={{ fontSize: 12, color: brand.colors.textMuted, marginTop: 2 }}>
                                  Enter a different billing address below
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Animated billing address — pure inline transitions, no CSS class dependency */}
                          <div style={{
                            width: "100%",
                            maxHeight: sameBilling ? 0 : 480,
                            overflow: "hidden",
                            opacity: sameBilling ? 0 : 1,
                            transition: "max-height 0.44s cubic-bezier(0.16,1,0.3,1), opacity 0.32s cubic-bezier(0.16,1,0.3,1)",
                          }}>
                            <div style={{
                              transform: sameBilling ? "scaleY(0.65)" : "scaleY(1)",
                              transformOrigin: "center top",
                              transition: "transform 0.38s cubic-bezier(0.16,1,0.3,1)",
                              paddingTop: 4,
                            }}>
                              <div style={{
                                background: "rgba(33,150,243,0.05)",
                                border: "1px solid rgba(33,150,243,0.2)",
                                borderRadius: 14, padding: "20px 18px",
                                display: "flex", flexDirection: "column", gap: 14,
                                boxSizing: "border-box", width: "100%",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ width: 3, height: 16, borderRadius: 2, background: "#42a5f5", flexShrink: 0 }} />
                                  <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#42a5f5" }}>
                                    BILLING ADDRESS
                                  </p>
                                </div>
                                <div>
                                  <label style={labelStyle}>Street Address</label>
                                  <input className="pay-input" placeholder="123 Billing Street"
                                    value={formData.billingAddress}
                                    onChange={(e) => updateField("billingAddress", e.target.value)}
                                    style={{ borderColor: "rgba(33,150,243,0.25)" }} />
                                </div>
                                <div>
                                  <label style={labelStyle}>City</label>
                                  <input className="pay-input" placeholder="Deltona"
                                    value={formData.billingCity}
                                    onChange={(e) => updateField("billingCity", e.target.value)}
                                    style={{ borderColor: "rgba(33,150,243,0.25)" }} />
                                </div>
                                <div>
                                  <label style={labelStyle}>Zip Code</label>
                                  <input className="pay-input" placeholder="32725"
                                    value={formData.billingZip}
                                    onChange={(e) => updateField("billingZip", e.target.value)}
                                    style={{ borderColor: "rgba(33,150,243,0.25)" }} />
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
                      background: brand.colors.bgElevated,
                      border: `1px solid ${brand.colors.border}`, borderRadius: 20, padding: "36px 32px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                        <h2 style={{ fontFamily: brand.fonts.display, fontSize: 24, color: brand.colors.textPrimary, fontWeight: 700 }}>
                          Payment Details
                        </h2>
                        <button onClick={() => { setStep("form"); setShowErrors(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{
                          background: "none", border: "none", color: brand.colors.textMuted, fontSize: 14,
                          cursor: "pointer", fontFamily: "inherit",
                        }}>← Edit Info</button>
                      </div>

                      {/* Square card — SquareCardSection mounts fresh on each visit */}
                      <div style={{
                        border: `1px solid ${brand.colors.border}`, borderRadius: 16, padding: "24px",
                        background: brand.colors.bgCard, marginBottom: 24,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                          <span style={{ fontSize: 20 }}>💳</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: brand.colors.textSecondary }}>Card Information</span>
                          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                            {["VISA", "MC", "AMEX"].map(brand => (
                              <span key={brand} style={{
                                padding: "2px 8px", background: "#0d1a0d", border: `1px solid ${brand.colors.border}`,
                                borderRadius: 4, fontSize: 10, fontWeight: 700, color: brand.colors.textMuted,
                                fontFamily: "'JetBrains Mono', monospace",
                              }}>{brand}</span>
                            ))}
                          </div>
                        </div>

                        <SquareCardSection
                          onReady={(card) => { setSquareCard(card); setPaymentError(null); }}
                          onError={(msg) => setPaymentError(`Card form error: ${msg}. Please call us at ${brand.phone}.`)}
                          squareStyle={brand.squareCardStyle}
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
                          marginTop: 16, padding: "10px 14px", background: brand.colors.glow,
                          borderRadius: 8, border: `1px solid ${brand.colors.border}`,
                          fontSize: 11, color: brand.colors.textMuted, lineHeight: 1.6,
                        }}>
                          🔒 Secured by Square. Your card details are encrypted and never stored on our servers.
                        </div>
                      </div>

                      {/* Save card checkbox — only for signed-in users */}
                      {clerkUserId && (
                        <label style={{
                          display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                          padding: "14px 16px", background: brand.colors.glow,
                          border: `1px solid ${brand.colors.border}`, borderRadius: 12, marginBottom: 20,
                        }}>
                          <input
                            type="checkbox"
                            checked={saveCard}
                            onChange={(e) => setSaveCard(e.target.checked)}
                            style={{ width: 18, height: 18, accentColor: brand.colors.primary, cursor: "pointer" }}
                          />
                          <span style={{ fontSize: 14, color: brand.colors.textSecondary, fontWeight: 500 }}>
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

                      {/* Test mode: skip Square payment */}
                      {isTestMode && (
                        <button
                          className="cta-pay"
                          onClick={async () => {
                            setIsProcessing(true);
                            // Create account + sign in if deposit
                            if (isDeposit && !isSignedIn && !accountCreated && password) {
                              const ok = await createAndSignIn();
                              if (!ok) { setIsProcessing(false); return; }
                            }
                            setPaymentId("TEST-" + Date.now());
                            setStep("confirm");
                            setIsProcessing(false);
                          }}
                          disabled={isProcessing || accountCreating}
                          style={{ background: "linear-gradient(135deg, #ff9800, #e65100)", marginTop: 8 }}
                        >
                          {accountCreating ? "Creating account..." : "⚡ TEST: Skip Payment →"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </FadeIn>

              {/* Right: Summary Card */}
              <FadeIn delay={0.25} direction="left">
                <div className="summary-card">
                  <h3 style={{ fontFamily: brand.fonts.display, fontSize: 18, color: brand.colors.textPrimary, fontWeight: 700, marginBottom: 24 }}>
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
                        <span style={{ color: brand.colors.textMuted }}>{label}</span>
                        <span style={{ color: "#c8e0c8", fontWeight: 500, textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Invoice line items in summary sidebar */}
                  {invoiceMode && invoiceData && invoiceData.line_items.length > 0 && (
                    <div style={{ borderTop: `1px solid ${brand.colors.border}`, paddingTop: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: brand.colors.textMuted, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Services</div>
                      {invoiceData.line_items.map((item, i) => (
                        <div key={item.id || i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                          <span style={{ color: brand.colors.textSecondary, flex: 1, marginRight: 8, lineHeight: 1.4 }}>
                            {item.description}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                          </span>
                          <span style={{ color: "#c8e0c8", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                            ${item.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {invoiceData.tax_rate > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4, color: brand.colors.textMuted }}>
                          <span>Tax ({invoiceData.tax_rate}%)</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>${invoiceData.tax_amount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ borderTop: `1px solid ${brand.colors.border}`, paddingTop: 16, marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 14, color: brand.colors.textMuted, fontWeight: 600 }}>{paymentLabel || "Total Due"}</span>
                      <span style={{
                        fontSize: 32, fontWeight: 800, color: brand.colors.primary,
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
                  <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${brand.colors.border}` }}>
                    <p style={{ fontSize: 13, color: brand.colors.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
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
                    <p style={{ fontSize: 12, color: brand.colors.textMuted }}>
                      Need help? <a href={`tel:${brand.phone.replace(/[^0-9]/g, '')}`} style={{ color: brand.colors.primary, textDecoration: "none" }}>{brand.phone}</a>
                    </p>
                  </div>
                </div>
              </FadeIn>
            </div>
          )}
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: brand.key === 'nexa' ? '#040A14' : '#030a03', borderTop: `1px solid ${brand.colors.border}`, padding: "40px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href={brand.key === 'nexa' ? 'https://nexavisiongroup.com' : '/'} style={{ textDecoration: "none" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logo} alt={brand.shortName} style={{ maxWidth: 160, height: "auto", maxHeight: 36, opacity: 0.7 }} />
            </Link>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <a href={`tel:${brand.phone.replace(/[^0-9]/g, '')}`} style={{ color: brand.colors.primary, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>📞 {brand.phone}</a>
            <a href={`mailto:${brand.email}`} style={{ color: brand.colors.primary, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>✉️ Email</a>
            {brand.key === 'jhps' && <Link href="/account" style={{ color: brand.colors.textMuted, fontSize: 13, textDecoration: "none" }}>My Account</Link>}
          </div>
          <div style={{ color: brand.colors.textMuted, fontSize: 12, width: "100%", textAlign: "center", marginTop: 16, opacity: 0.6 }}>
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
