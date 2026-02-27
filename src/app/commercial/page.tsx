"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ───
interface InViewOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

// ─── Custom Hook: Intersection Observer ───
function useInView(options: InViewOptions = {}) {
  const { threshold = 0.15, rootMargin = "0px", triggerOnce = true } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (triggerOnce) observer.unobserve(el);
        } else if (!triggerOnce) {
          setIsInView(false);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce]);

  return { ref, isInView };
}

// ─── Animated Counter Hook ───
function useCounter(target: number, isInView: boolean, duration = 2000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target, duration]);
  return count;
}

// ─── Data ───
const PHONE = "407-686-9817";
const EMAIL = "info@jhpsfl.com";

const audiences = [
  {
    icon: "🏢",
    title: "Property Management Companies",
    description:
      "Reduce vendor headaches with one reliable partner for turnovers, exterior maintenance, and recurring property care — backed by digital estimates, online billing, and fast scheduling.",
  },
  {
    icon: "📊",
    title: "Real Estate Investors & Rental Portfolios",
    description:
      "Minimize vacancy downtime with rapid turnover services, recurring maintenance plans, and streamlined billing across your entire portfolio — whether you manage 5 units or 50.",
  },
  {
    icon: "🏘️",
    title: "HOA Communities",
    description:
      "Maintain appearance standards and reduce liability with scheduled exterior cleaning programs, predictable billing, and consistent professional service your board can count on.",
  },
  {
    icon: "🏗️",
    title: "Commercial Facilities & Storage Properties",
    description:
      "Keep your facility presentable and safe with ongoing cleanup services, concrete and walkway maintenance, unit cleanouts, and dumpster area sanitation — all under one vendor.",
  },
  {
    icon: "🏠",
    title: "Multi-Location Businesses",
    description:
      "Consolidate your property maintenance needs across multiple Central Florida locations with a single point of contact, unified billing, and consistent quality at every site.",
  },
  {
    icon: "🔑",
    title: "Turnover Specialists & Realtors",
    description:
      "Get properties rent-ready or sale-ready fast — from full property cleanups and junk removal to curb appeal enhancements. One call, one crew, one invoice.",
  },
];

const solutions = [
  {
    icon: "🔄",
    title: "Property Turnovers",
    description:
      "Complete turnover services including junk removal, deep cleaning, exterior wash, and curb appeal restoration. Get units rent-ready in 24–48 hours, not weeks.",
    image:
      "https://images.pexels.com/photos/5463576/pexels-photo-5463576.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    icon: "💧",
    title: "Exterior Maintenance Programs",
    description:
      "Scheduled pressure washing, soft washing, and surface cleaning for buildings, walkways, parking areas, and common spaces. Recurring or on-demand.",
    image:
      "https://images.pexels.com/photos/4239031/pexels-photo-4239031.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    icon: "🌿",
    title: "Grounds & Lawn Maintenance",
    description:
      "Comprehensive lawn care, landscaping maintenance, and grounds keeping for commercial properties, rental communities, and multi-unit portfolios.",
    image:
      "https://images.pexels.com/photos/1453499/pexels-photo-1453499.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    icon: "🚛",
    title: "Junk Removal & Cleanouts",
    description:
      "Tenant trash-outs, unit cleanouts, construction debris removal, and bulk haul-offs. Fast scheduling, clean execution, and proper disposal every time.",
    image:
      "https://images.pexels.com/photos/6419128/pexels-photo-6419128.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    icon: "🌳",
    title: "Land Clearing & Lot Prep",
    description:
      "Overgrown lot clearing, brush removal, and property prep for development, resale, or code compliance. Handle everything from small lots to multi-acre parcels.",
    image:
      "https://images.pexels.com/photos/5997993/pexels-photo-5997993.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    icon: "✨",
    title: "Curb Appeal & Property Restoration",
    description:
      "Full exterior refresh packages combining pressure washing, cleanup, lawn care, and debris removal to restore property value and first impressions.",
    image:
      "https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
];

const systemFeatures = [
  {
    icon: "💳",
    title: "Online Payments",
    description:
      "Secure online payment portal for invoices. No checks, no chasing. Pay on your schedule with credit card, ACH, or bank transfer.",
  },
  {
    icon: "🔁",
    title: "Recurring Billing",
    description:
      "Automated recurring billing for ongoing maintenance programs. Set it and forget it — predictable costs, zero paperwork friction.",
  },
  {
    icon: "📋",
    title: "Digital Estimates & Approvals",
    description:
      "Receive detailed estimates digitally. Review, approve, and authorize work from your phone or desktop — no printing, no scanning.",
  },
  {
    icon: "📅",
    title: "Smart Scheduling",
    description:
      "Flexible scheduling that works around your tenants, your timeline, and your priorities. Recurring slots, rush availability, and real-time updates.",
  },
  {
    icon: "💰",
    title: "Financing Options",
    description:
      "Spread costs across multiple payments for larger projects. Flexible financing available for qualifying commercial accounts.",
  },
  {
    icon: "📊",
    title: "Multi-Property Management",
    description:
      "One account, multiple properties. Track service history, invoices, and schedules across your entire portfolio from a single dashboard.",
  },
];

const processSteps = [
  {
    number: "01",
    title: "Initial Consultation",
    description:
      "Tell us about your properties, your pain points, and your goals. We'll assess your needs and build a custom service plan.",
    icon: "📞",
  },
  {
    number: "02",
    title: "Custom Proposal",
    description:
      "Receive a detailed digital proposal with pricing, scope, and scheduling options. Review and approve online — no friction.",
    icon: "📄",
  },
  {
    number: "03",
    title: "Vendor Onboarding",
    description:
      "We set up your account with recurring billing, scheduling preferences, and property details. Your system is ready to go.",
    icon: "⚙️",
  },
  {
    number: "04",
    title: "Ongoing Service & Support",
    description:
      "Scheduled maintenance runs like clockwork. On-demand requests handled fast. One vendor, multiple solutions, zero headaches.",
    icon: "✅",
  },
];

// ─── Styles ───
const keyframes = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeInLeft {
    from { opacity: 0; transform: translateX(-30px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeInRight {
    from { opacity: 0; transform: translateX(30px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  @keyframes gridMove {
    0% { transform: translateY(0); }
    100% { transform: translateY(40px); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(100%); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes borderGlow {
    0%, 100% { border-color: rgba(76, 175, 80, 0.3); }
    50% { border-color: rgba(76, 175, 80, 0.6); }
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: #030a03; }
  ::-webkit-scrollbar-thumb { background: #2E7D32; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #4CAF50; }

  /* Modal animation */
  .modal-overlay { animation: fadeIn 0.2s ease-out; }
  .modal-content { animation: slideUp 0.3s ease-out; }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

// ─── Section Wrapper Component ───
function AnimatedSection({
  children,
  delay = 0,
  direction = "up",
  style = {},
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  style?: React.CSSProperties;
}) {
  const { ref, isInView } = useInView();
  const animMap = {
    up: "fadeInUp",
    down: "fadeInDown",
    left: "fadeInLeft",
    right: "fadeInRight",
  };
  return (
    <div
      ref={ref}
      style={{
        opacity: isInView ? 1 : 0,
        animation: isInView
          ? `${animMap[direction]} 0.7s ease-out ${delay}s both`
          : "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Vendor Inquiry Modal ───
function VendorModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    portfolioSize: "",
    servicesNeeded: [] as string[],
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleServiceToggle = (service: string) => {
    setFormData((prev) => ({
      ...prev,
      servicesNeeded: prev.servicesNeeded.includes(service)
        ? prev.servicesNeeded.filter((s) => s !== service)
        : [...prev.servicesNeeded, service],
    }));
  };

  const handleSubmit = () => {
    const subject = `Commercial Vendor Inquiry — ${formData.companyName || "New Client"}`;
    const body = [
      `Company: ${formData.companyName}`,
      `Contact: ${formData.contactName}`,
      `Email: ${formData.email}`,
      `Phone: ${formData.phone}`,
      `Portfolio Size: ${formData.portfolioSize}`,
      `Services Needed: ${formData.servicesNeeded.join(", ") || "Not specified"}`,
      `Message: ${formData.message}`,
    ].join("\n");
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setSubmitted(false);
      setFormData({
        companyName: "",
        contactName: "",
        email: "",
        phone: "",
        portfolioSize: "",
        servicesNeeded: [],
        message: "",
      });
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    background: "#091409",
    border: "1px solid #1a3a1a",
    borderRadius: "8px",
    color: "#e8f5e8",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
  };

  const serviceOptions = [
    "Property Turnovers",
    "Pressure Washing",
    "Lawn Maintenance",
    "Junk Removal",
    "Land Clearing",
    "Recurring Programs",
  ];

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(8px)",
        padding: "20px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal-content"
        style={{
          background: "linear-gradient(145deg, #0d1f0d, #050e05)",
          border: "1px solid #1a3a1a",
          borderRadius: "16px",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "32px",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            color: "#8aba8a",
            fontSize: "24px",
            cursor: "pointer",
            padding: "4px 8px",
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        {submitted ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
            <h3
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "24px",
                color: "#e8f5e8",
                marginBottom: "8px",
              }}
            >
              Inquiry Sent
            </h3>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                color: "#8aba8a",
                fontSize: "14px",
              }}
            >
              Your email client should have opened with the details pre-filled.
              We&apos;ll review your inquiry and respond within 24 hours.
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  background: "rgba(76, 175, 80, 0.1)",
                  border: "1px solid rgba(76, 175, 80, 0.3)",
                  borderRadius: "20px",
                  fontSize: "11px",
                  color: "#4CAF50",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  marginBottom: "12px",
                }}
              >
                Commercial Inquiry
              </div>
              <h3
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "24px",
                  color: "#e8f5e8",
                  marginBottom: "4px",
                }}
              >
                Start a Vendor Conversation
              </h3>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  color: "#7a9a7a",
                  fontSize: "14px",
                }}
              >
                Tell us about your properties. We&apos;ll build a custom
                service plan.
              </p>
            </div>

            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      color: "#8aba8a",
                      fontFamily: "'DM Sans', sans-serif",
                      marginBottom: "6px",
                      fontWeight: 500,
                    }}
                  >
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                    placeholder="Your company"
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "#4CAF50")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "#1a3a1a")
                    }
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      color: "#8aba8a",
                      fontFamily: "'DM Sans', sans-serif",
                      marginBottom: "6px",
                      fontWeight: 500,
                    }}
                  >
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) =>
                      setFormData({ ...formData, contactName: e.target.value })
                    }
                    placeholder="Your name"
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "#4CAF50")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "#1a3a1a")
                    }
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      color: "#8aba8a",
                      fontFamily: "'DM Sans', sans-serif",
                      marginBottom: "6px",
                      fontWeight: 500,
                    }}
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="email@company.com"
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "#4CAF50")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "#1a3a1a")
                    }
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      color: "#8aba8a",
                      fontFamily: "'DM Sans', sans-serif",
                      marginBottom: "6px",
                      fontWeight: 500,
                    }}
                  >
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="(407) 000-0000"
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "#4CAF50")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "#1a3a1a")
                    }
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    color: "#8aba8a",
                    fontFamily: "'DM Sans', sans-serif",
                    marginBottom: "6px",
                    fontWeight: 500,
                  }}
                >
                  Portfolio Size
                </label>
                <select
                  value={formData.portfolioSize}
                  onChange={(e) =>
                    setFormData({ ...formData, portfolioSize: e.target.value })
                  }
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238aba8a' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                  }}
                >
                  <option value="">Select portfolio size</option>
                  <option value="1-5">1–5 Properties</option>
                  <option value="6-20">6–20 Properties</option>
                  <option value="21-50">21–50 Properties</option>
                  <option value="50+">50+ Properties</option>
                  <option value="commercial-single">
                    Single Commercial Facility
                  </option>
                  <option value="hoa">HOA Community</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    color: "#8aba8a",
                    fontFamily: "'DM Sans', sans-serif",
                    marginBottom: "8px",
                    fontWeight: 500,
                  }}
                >
                  Services Needed
                </label>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  {serviceOptions.map((service) => (
                    <button
                      key={service}
                      onClick={() => handleServiceToggle(service)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "20px",
                        fontSize: "13px",
                        fontFamily: "'DM Sans', sans-serif",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        border: formData.servicesNeeded.includes(service)
                          ? "1px solid #4CAF50"
                          : "1px solid #1a3a1a",
                        background: formData.servicesNeeded.includes(service)
                          ? "rgba(76, 175, 80, 0.15)"
                          : "transparent",
                        color: formData.servicesNeeded.includes(service)
                          ? "#4CAF50"
                          : "#7a9a7a",
                      }}
                    >
                      {formData.servicesNeeded.includes(service) ? "✓ " : ""}
                      {service}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    color: "#8aba8a",
                    fontFamily: "'DM Sans', sans-serif",
                    marginBottom: "6px",
                    fontWeight: 500,
                  }}
                >
                  Tell Us About Your Needs
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  placeholder="Describe your properties, current challenges, and what you're looking for in a vendor partner..."
                  rows={4}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "#4CAF50")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "#1a3a1a")
                  }
                />
              </div>

              <button
                onClick={handleSubmit}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.3s",
                  letterSpacing: "0.3px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 20px rgba(76, 175, 80, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Send Vendor Inquiry →
              </button>

              <p
                style={{
                  textAlign: "center",
                  fontSize: "12px",
                  color: "#5a8a5a",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Or call directly:{" "}
                <a
                  href={`tel:${PHONE}`}
                  style={{ color: "#4CAF50", textDecoration: "none" }}
                >
                  {PHONE}
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── MAIN COMMERCIAL PAGE COMPONENT ───
// ═══════════════════════════════════════════════════════

export default function CommercialPage() {
  const [scrollY, setScrollY] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Track scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      setNavSolid(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Stats section
  const statsRef = useInView();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />

      {/* ═══ NAVBAR ═══ */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: "0 24px",
          height: "72px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "all 0.3s ease",
          background: navSolid
            ? "rgba(5, 14, 5, 0.95)"
            : "rgba(5, 14, 5, 0.4)",
          backdropFilter: "blur(20px)",
          borderBottom: navSolid
            ? "1px solid rgba(76, 175, 80, 0.1)"
            : "1px solid transparent",
        }}
      >
        {/* Logo */}
        <a
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Playfair Display', serif",
              fontWeight: 800,
              fontSize: "18px",
              color: "#fff",
            }}
          >
            J
          </div>
          <div>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 700,
                fontSize: "15px",
                color: "#e8f5e8",
                letterSpacing: "1px",
                lineHeight: 1.2,
              }}
            >
              JHPS FLORIDA
            </div>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "10px",
                color: "#4CAF50",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              Commercial Services
            </div>
          </div>
        </a>

        {/* Desktop Nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "32px",
          }}
          className="desktop-nav"
        >
          {[
            { label: "Solutions", href: "#solutions" },
            { label: "Systems", href: "#systems" },
            { label: "Process", href: "#process" },
            { label: "Service Area", href: "#area" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                color: "#c8e0c8",
                textDecoration: "none",
                transition: "color 0.2s",
                fontWeight: 500,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "#4CAF50")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "#c8e0c8")
              }
            >
              {link.label}
            </a>
          ))}
          <a
            href="/"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px",
              color: "#8aba8a",
              textDecoration: "none",
              transition: "color 0.2s",
              fontWeight: 500,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "#4CAF50")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "#8aba8a")
            }
          >
            ← Residential
          </a>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: "10px 20px",
              background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 4px 15px rgba(76, 175, 80, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Get Portfolio Pricing
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: "none",
            background: "none",
            border: "none",
            color: "#e8f5e8",
            fontSize: "24px",
            cursor: "pointer",
            padding: "8px",
          }}
          className="mobile-menu-btn"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99,
            background: "rgba(5, 14, 5, 0.98)",
            backdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {[
            { label: "Solutions", href: "#solutions" },
            { label: "Systems", href: "#systems" },
            { label: "Process", href: "#process" },
            { label: "Service Area", href: "#area" },
            { label: "← Residential", href: "/" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "24px",
                color: "#e8f5e8",
                textDecoration: "none",
              }}
            >
              {link.label}
            </a>
          ))}
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              setModalOpen(true);
            }}
            style={{
              marginTop: "16px",
              padding: "14px 32px",
              background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Get Portfolio Pricing
          </button>
        </div>
      )}

      {/* ═══ HERO SECTION ═══ */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          background: "#050e05",
        }}
      >
        {/* Background grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(76, 175, 80, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(76, 175, 80, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
            transform: `translateY(${scrollY * 0.1}px)`,
          }}
        />

        {/* Radial glows */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            right: "-10%",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(76, 175, 80, 0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            left: "-5%",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(46, 125, 50, 0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "120px 24px 80px",
            width: "100%",
          }}
        >
          {/* Badge */}
          <AnimatedSection delay={0.1}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 16px",
                background: "rgba(76, 175, 80, 0.08)",
                border: "1px solid rgba(76, 175, 80, 0.2)",
                borderRadius: "24px",
                marginBottom: "24px",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#4CAF50",
                  animation: "pulse 2s infinite",
                }}
              />
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  color: "#4CAF50",
                  fontWeight: 600,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                }}
              >
                Commercial & Portfolio Services
              </span>
            </div>
          </AnimatedSection>

          {/* Headline */}
          <AnimatedSection delay={0.2}>
            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(36px, 5vw, 64px)",
                fontWeight: 800,
                lineHeight: 1.1,
                color: "#e8f5e8",
                maxWidth: "800px",
                marginBottom: "20px",
              }}
            >
              Your Properties Maintained.{" "}
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #4CAF50, #81C784, #4CAF50)",
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  animation: "shimmer 4s linear infinite",
                }}
              >
                Your Turnovers Handled.
              </span>{" "}
              Your Billing Simplified.
            </h1>
          </AnimatedSection>

          {/* Subheadline */}
          <AnimatedSection delay={0.3}>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "clamp(16px, 2vw, 19px)",
                color: "#8aba8a",
                lineHeight: 1.7,
                maxWidth: "640px",
                marginBottom: "32px",
              }}
            >
              Supporting property managers, investors, HOAs, and commercial
              facilities across Central Florida with reliable multi-service
              solutions — backed by online billing, recurring service programs,
              and fast scheduling.
            </p>
          </AnimatedSection>

          {/* CTAs */}
          <AnimatedSection delay={0.4}>
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                marginBottom: "48px",
              }}
            >
              <button
                onClick={() => setModalOpen(true)}
                style={{
                  padding: "16px 32px",
                  background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
                  border: "none",
                  borderRadius: "10px",
                  color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.3s",
                  letterSpacing: "0.3px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 30px rgba(76, 175, 80, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Get Portfolio Pricing
              </button>
              <a
                href={`tel:${PHONE}`}
                style={{
                  padding: "16px 32px",
                  background: "transparent",
                  border: "1px solid #2a5a2a",
                  borderRadius: "10px",
                  color: "#e8f5e8",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "16px",
                  fontWeight: 500,
                  cursor: "pointer",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.3s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#4CAF50";
                  e.currentTarget.style.background =
                    "rgba(76, 175, 80, 0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#2a5a2a";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                📞 Call {PHONE}
              </a>
            </div>
          </AnimatedSection>

          {/* Trust badges */}
          <AnimatedSection delay={0.5}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              {[
                "Online Payments",
                "Recurring Billing",
                "Digital Estimates",
                "Financing Available",
                "24–48hr Turnovers",
              ].map((badge) => (
                <div
                  key={badge}
                  style={{
                    padding: "8px 16px",
                    background: "rgba(76, 175, 80, 0.06)",
                    border: "1px solid rgba(76, 175, 80, 0.15)",
                    borderRadius: "6px",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    color: "#8aba8a",
                    fontWeight: 500,
                  }}
                >
                  ✓ {badge}
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ WHO WE SERVE ═══ */}
      <section
        style={{
          background: "#030a03",
          padding: "100px 24px",
          borderTop: "1px solid #1a3a1a",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <AnimatedSection>
            <div style={{ textAlign: "center", marginBottom: "60px" }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  background: "rgba(76, 175, 80, 0.08)",
                  border: "1px solid rgba(76, 175, 80, 0.2)",
                  borderRadius: "20px",
                  fontSize: "11px",
                  color: "#4CAF50",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "16px",
                }}
              >
                Who We Serve
              </div>
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "clamp(28px, 4vw, 42px)",
                  fontWeight: 700,
                  color: "#e8f5e8",
                  marginBottom: "12px",
                }}
              >
                Trusted by Property Professionals
              </h2>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "16px",
                  color: "#7a9a7a",
                  maxWidth: "600px",
                  margin: "0 auto",
                  lineHeight: 1.6,
                }}
              >
                Built to reduce vendor friction, speed up turnovers, and keep
                properties tenant-ready with predictable, professional service.
              </p>
            </div>
          </AnimatedSection>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "20px",
            }}
          >
            {audiences.map((aud, i) => (
              <AnimatedSection key={aud.title} delay={i * 0.08}>
                <div
                  style={{
                    padding: "28px",
                    background:
                      "linear-gradient(145deg, rgba(13, 31, 13, 0.8), rgba(5, 14, 5, 0.8))",
                    border: "1px solid #1a3a1a",
                    borderRadius: "12px",
                    transition: "all 0.3s",
                    cursor: "default",
                    height: "100%",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(76, 175, 80, 0.3)";
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 30px rgba(76, 175, 80, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#1a3a1a";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    style={{
                      fontSize: "28px",
                      marginBottom: "12px",
                    }}
                  >
                    {aud.icon}
                  </div>
                  <h3
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#e8f5e8",
                      marginBottom: "8px",
                    }}
                  >
                    {aud.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "14px",
                      color: "#7a9a7a",
                      lineHeight: 1.7,
                    }}
                  >
                    {aud.description}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SOLUTIONS (Outcomes, not tools) ═══ */}
      <section
        id="solutions"
        style={{
          background: "#050e05",
          padding: "100px 24px",
          borderTop: "1px solid #1a3a1a",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <AnimatedSection>
            <div style={{ textAlign: "center", marginBottom: "60px" }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  background: "rgba(76, 175, 80, 0.08)",
                  border: "1px solid rgba(76, 175, 80, 0.2)",
                  borderRadius: "20px",
                  fontSize: "11px",
                  color: "#4CAF50",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "16px",
                }}
              >
                Solutions
              </div>
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "clamp(28px, 4vw, 42px)",
                  fontWeight: 700,
                  color: "#e8f5e8",
                  marginBottom: "12px",
                }}
              >
                Multi-Service Property Solutions
              </h2>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "16px",
                  color: "#7a9a7a",
                  maxWidth: "550px",
                  margin: "0 auto",
                  lineHeight: 1.6,
                }}
              >
                One vendor for everything your properties need. No more juggling
                contractors.
              </p>
            </div>
          </AnimatedSection>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "24px",
            }}
          >
            {solutions.map((sol, i) => (
              <AnimatedSection key={sol.title} delay={i * 0.08}>
                <div
                  style={{
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid #1a3a1a",
                    background: "#091409",
                    transition: "all 0.3s",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(76, 175, 80, 0.3)";
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow =
                      "0 12px 40px rgba(76, 175, 80, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#1a3a1a";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Image */}
                  <div
                    style={{
                      height: "180px",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <img
                      src={sol.image}
                      alt={sol.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "transform 0.5s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.transform = "scale(1.05)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.transform = "scale(1)")
                      }
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: "60px",
                        background:
                          "linear-gradient(transparent, #091409)",
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div style={{ padding: "24px", flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "10px",
                      }}
                    >
                      <span style={{ fontSize: "22px" }}>{sol.icon}</span>
                      <h3
                        style={{
                          fontFamily: "'Playfair Display', serif",
                          fontSize: "18px",
                          fontWeight: 700,
                          color: "#e8f5e8",
                        }}
                      >
                        {sol.title}
                      </h3>
                    </div>
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "14px",
                        color: "#7a9a7a",
                        lineHeight: 1.7,
                      }}
                    >
                      {sol.description}
                    </p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SYSTEMS & INFRASTRUCTURE ═══ */}
      <section
        id="systems"
        style={{
          background: "#030a03",
          padding: "100px 24px",
          borderTop: "1px solid #1a3a1a",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <AnimatedSection>
            <div style={{ textAlign: "center", marginBottom: "60px" }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  background: "rgba(255, 215, 0, 0.08)",
                  border: "1px solid rgba(255, 215, 0, 0.2)",
                  borderRadius: "20px",
                  fontSize: "11px",
                  color: "#ffd700",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "16px",
                }}
              >
                Vendor Infrastructure
              </div>
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "clamp(28px, 4vw, 42px)",
                  fontWeight: 700,
                  color: "#e8f5e8",
                  marginBottom: "12px",
                }}
              >
                Systems Built for Property Professionals
              </h2>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "16px",
                  color: "#7a9a7a",
                  maxWidth: "600px",
                  margin: "0 auto",
                  lineHeight: 1.6,
                }}
              >
                We don&apos;t just show up with equipment. We show up with
                systems that make your job easier — from first estimate to
                recurring invoice.
              </p>
            </div>
          </AnimatedSection>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "20px",
            }}
          >
            {systemFeatures.map((feat, i) => (
              <AnimatedSection key={feat.title} delay={i * 0.08}>
                <div
                  style={{
                    padding: "28px",
                    background:
                      "linear-gradient(145deg, rgba(13, 31, 13, 0.6), rgba(5, 14, 5, 0.6))",
                    border: "1px solid rgba(255, 215, 0, 0.1)",
                    borderRadius: "12px",
                    transition: "all 0.3s",
                    height: "100%",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(255, 215, 0, 0.3)";
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 30px rgba(255, 215, 0, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(255, 215, 0, 0.1)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "rgba(255, 215, 0, 0.08)",
                      border: "1px solid rgba(255, 215, 0, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      marginBottom: "16px",
                    }}
                  >
                    {feat.icon}
                  </div>
                  <h3
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#e8f5e8",
                      marginBottom: "8px",
                    }}
                  >
                    {feat.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "14px",
                      color: "#7a9a7a",
                      lineHeight: 1.7,
                    }}
                  >
                    {feat.description}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section
        id="process"
        style={{
          background: "#050e05",
          padding: "100px 24px",
          borderTop: "1px solid #1a3a1a",
        }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <AnimatedSection>
            <div style={{ textAlign: "center", marginBottom: "60px" }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  background: "rgba(76, 175, 80, 0.08)",
                  border: "1px solid rgba(76, 175, 80, 0.2)",
                  borderRadius: "20px",
                  fontSize: "11px",
                  color: "#4CAF50",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "16px",
                }}
              >
                Getting Started
              </div>
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "clamp(28px, 4vw, 42px)",
                  fontWeight: 700,
                  color: "#e8f5e8",
                  marginBottom: "12px",
                }}
              >
                Simple Onboarding. Lasting Partnership.
              </h2>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "16px",
                  color: "#7a9a7a",
                  maxWidth: "500px",
                  margin: "0 auto",
                  lineHeight: 1.6,
                }}
              >
                From first conversation to ongoing service — here&apos;s how
                we make it effortless.
              </p>
            </div>
          </AnimatedSection>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0",
              position: "relative",
            }}
          >
            {/* Connecting line */}
            <div
              style={{
                position: "absolute",
                left: "32px",
                top: "40px",
                bottom: "40px",
                width: "2px",
                background:
                  "linear-gradient(to bottom, #4CAF50, rgba(76, 175, 80, 0.1))",
              }}
            />

            {processSteps.map((step, i) => (
              <AnimatedSection key={step.number} delay={i * 0.15}>
                <div
                  style={{
                    display: "flex",
                    gap: "24px",
                    padding: "24px 0",
                    position: "relative",
                  }}
                >
                  {/* Step number circle */}
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background:
                        "linear-gradient(135deg, #0d1f0d, #091409)",
                      border: "2px solid #4CAF50",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      position: "relative",
                      zIndex: 2,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "20px",
                        fontWeight: 700,
                        color: "#4CAF50",
                      }}
                    >
                      {step.icon}
                    </span>
                  </div>

                  {/* Content */}
                  <div style={{ paddingTop: "8px" }}>
                    <div
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "12px",
                        color: "#4CAF50",
                        fontWeight: 600,
                        letterSpacing: "1px",
                        marginBottom: "4px",
                      }}
                    >
                      STEP {step.number}
                    </div>
                    <h3
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: "20px",
                        fontWeight: 700,
                        color: "#e8f5e8",
                        marginBottom: "6px",
                      }}
                    >
                      {step.title}
                    </h3>
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "14px",
                        color: "#7a9a7a",
                        lineHeight: 1.7,
                        maxWidth: "500px",
                      }}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STATS / SCALE SIGNAL ═══ */}
      <section
        ref={statsRef.ref}
        style={{
          background: "#030a03",
          padding: "80px 24px",
          borderTop: "1px solid #1a3a1a",
        }}
      >
        <div
          style={{
            maxWidth: "1000px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "32px",
            textAlign: "center",
          }}
        >
          {[
            { value: 500, suffix: "+", label: "Jobs Completed" },
            { value: 5, suffix: "+", label: "Service Categories" },
            { value: 24, suffix: "hr", label: "Turnover Availability" },
            { value: 100, suffix: "%", label: "Satisfaction Rate" },
          ].map((stat, i) => {
            const count = useCounter(stat.value, statsRef.isInView);
            return (
              <AnimatedSection key={stat.label} delay={i * 0.1}>
                <div>
                  <div
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: "clamp(36px, 5vw, 48px)",
                      fontWeight: 800,
                      color: "#4CAF50",
                      lineHeight: 1,
                      marginBottom: "8px",
                    }}
                  >
                    {count}
                    {stat.suffix}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "14px",
                      color: "#7a9a7a",
                      fontWeight: 500,
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </section>

      {/* ═══ RESPONSE PROMISE ═══ */}
      <section
        style={{
          background:
            "linear-gradient(145deg, #0d1f0d, #050e05)",
          padding: "80px 24px",
          borderTop: "1px solid #1a3a1a",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <AnimatedSection>
            <div
              style={{
                fontSize: "48px",
                marginBottom: "16px",
                animation: "float 3s ease-in-out infinite",
              }}
            >
              ⚡
            </div>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(28px, 4vw, 38px)",
                fontWeight: 700,
                color: "#e8f5e8",
                marginBottom: "16px",
              }}
            >
              24–48 Hour Turnover Availability
            </h2>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "16px",
                color: "#8aba8a",
                lineHeight: 1.7,
                marginBottom: "32px",
              }}
            >
              Vacant units cost money every day they sit empty. We prioritize
              rapid turnovers to get your properties rent-ready fast — including
              same-week scheduling for junk removal, cleanouts, pressure
              washing, and curb appeal restoration.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                padding: "16px 32px",
                background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
                border: "none",
                borderRadius: "10px",
                color: "#fff",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "16px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 8px 30px rgba(76, 175, 80, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Schedule a Turnover →
            </button>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ SERVICE AREA ═══ */}
      <section
        id="area"
        style={{
          background: "#050e05",
          padding: "80px 24px",
          borderTop: "1px solid #1a3a1a",
        }}
      >
        <div style={{ maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
          <AnimatedSection>
            <div
              style={{
                display: "inline-block",
                padding: "4px 14px",
                background: "rgba(76, 175, 80, 0.08)",
                border: "1px solid rgba(76, 175, 80, 0.2)",
                borderRadius: "20px",
                fontSize: "11px",
                color: "#4CAF50",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              Coverage Area
            </div>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(28px, 4vw, 38px)",
                fontWeight: 700,
                color: "#e8f5e8",
                marginBottom: "24px",
              }}
            >
              Serving Central Florida
            </h2>
          </AnimatedSection>

          <AnimatedSection delay={0.15}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              {[
                "Deltona",
                "Orlando",
                "Sanford",
                "DeLand",
                "Daytona Beach",
                "Lake Mary",
                "Winter Park",
                "Apopka",
                "Kissimmee",
                "Oviedo",
              ].map((city) => (
                <span
                  key={city}
                  style={{
                    padding: "8px 18px",
                    background: "rgba(76, 175, 80, 0.06)",
                    border: "1px solid #1a3a1a",
                    borderRadius: "8px",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "14px",
                    color: "#c8e0c8",
                    fontWeight: 500,
                  }}
                >
                  📍 {city}
                </span>
              ))}
            </div>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                color: "#5a8a5a",
                lineHeight: 1.6,
              }}
            >
              Don&apos;t see your area? We cover most of Central Florida for
              commercial accounts.{" "}
              <a
                href={`tel:${PHONE}`}
                style={{ color: "#4CAF50", textDecoration: "none" }}
              >
                Call us
              </a>{" "}
              to confirm coverage for your properties.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ VENDOR PARTNERSHIP CTA ═══ */}
      <section
        style={{
          background: "linear-gradient(145deg, #0d1f0d, #091409)",
          padding: "100px 24px",
          borderTop: "1px solid rgba(255, 215, 0, 0.15)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <AnimatedSection>
            <div
              style={{
                display: "inline-block",
                padding: "4px 14px",
                background: "rgba(255, 215, 0, 0.08)",
                border: "1px solid rgba(255, 215, 0, 0.2)",
                borderRadius: "20px",
                fontSize: "11px",
                color: "#ffd700",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              Start Today
            </div>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 700,
                color: "#e8f5e8",
                marginBottom: "12px",
              }}
            >
              Ready to Simplify Your Property Maintenance?
            </h2>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "16px",
                color: "#8aba8a",
                lineHeight: 1.7,
                marginBottom: "32px",
                maxWidth: "550px",
                margin: "0 auto 32px",
              }}
            >
              One conversation is all it takes. Tell us about your portfolio and
              we&apos;ll build a service plan that fits — with transparent pricing,
              digital everything, and no surprises.
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => setModalOpen(true)}
                style={{
                  padding: "16px 32px",
                  background:
                    "linear-gradient(135deg, #b8860b, #ffd700)",
                  border: "none",
                  borderRadius: "10px",
                  color: "#050e05",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.3s",
                  letterSpacing: "0.3px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 30px rgba(255, 215, 0, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Get Portfolio Pricing
              </button>
              <a
                href={`tel:${PHONE}`}
                style={{
                  padding: "16px 32px",
                  background: "transparent",
                  border: "1px solid #2a5a2a",
                  borderRadius: "10px",
                  color: "#e8f5e8",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "16px",
                  fontWeight: 500,
                  cursor: "pointer",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.3s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#4CAF50";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#2a5a2a";
                }}
              >
                📞 {PHONE}
              </a>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer
        style={{
          background: "#030a03",
          padding: "60px 24px 32px",
          borderTop: "1px solid #1a3a1a",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "40px",
            marginBottom: "40px",
          }}
        >
          {/* About */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 800,
                  fontSize: "16px",
                  color: "#fff",
                }}
              >
                J
              </div>
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: "14px",
                  color: "#e8f5e8",
                  letterSpacing: "0.5px",
                }}
              >
                JHPS FLORIDA
              </span>
            </div>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                color: "#5a8a5a",
                lineHeight: 1.7,
              }}
            >
              Central Florida&apos;s trusted partner for commercial property
              maintenance, turnovers, and recurring service programs. Reliable
              &amp; Insured.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                color: "#8aba8a",
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              Commercial Services
            </h4>
            {[
              "Property Turnovers",
              "Exterior Maintenance",
              "Lawn & Grounds Care",
              "Junk Removal & Cleanouts",
              "Land Clearing",
              "Curb Appeal Restoration",
            ].map((s) => (
              <div
                key={s}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  color: "#5a8a5a",
                  marginBottom: "8px",
                }}
              >
                {s}
              </div>
            ))}
          </div>

          {/* Contact */}
          <div>
            <h4
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                color: "#8aba8a",
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              Contact
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a
                href={`tel:${PHONE}`}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  color: "#5a8a5a",
                  textDecoration: "none",
                }}
              >
                📞 {PHONE}
              </a>
              <a
                href={`mailto:${EMAIL}`}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  color: "#5a8a5a",
                  textDecoration: "none",
                }}
              >
                ✉️ {EMAIL}
              </a>
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  color: "#5a8a5a",
                }}
              >
                📍 Serving Central Florida
              </span>
            </div>

            <div style={{ marginTop: "16px" }}>
              <h4
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#8aba8a",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "10px",
                }}
              >
                Quick Links
              </h4>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <a
                  href="/"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    color: "#4CAF50",
                    textDecoration: "none",
                  }}
                >
                  Residential Services
                </a>
                <a
                  href="#solutions"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    color: "#4CAF50",
                    textDecoration: "none",
                  }}
                >
                  Solutions
                </a>
                <a
                  href="#systems"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    color: "#4CAF50",
                    textDecoration: "none",
                  }}
                >
                  Our Systems
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div
          style={{
            borderTop: "1px solid #1a3a1a",
            paddingTop: "24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "12px",
              color: "#3a5a3a",
            }}
          >
            © {new Date().getFullYear()} Jenkins Home & Property Solutions.
            Serving Deltona, Orlando, Sanford, DeLand, Daytona Beach &amp;
            surrounding areas.
          </p>
        </div>
      </footer>

      {/* ═══ STICKY MOBILE BAR ═══ */}
      <div
        className="mobile-sticky-bar"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 90,
          display: "none",
          background: "rgba(5, 14, 5, 0.95)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid #1a3a1a",
          padding: "10px 16px",
          gap: "10px",
        }}
      >
        <a
          href={`tel:${PHONE}`}
          style={{
            flex: 1,
            padding: "12px",
            background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
            border: "none",
            borderRadius: "8px",
            color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 600,
            textAlign: "center",
            textDecoration: "none",
          }}
        >
          📞 Call Now
        </a>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            flex: 1,
            padding: "12px",
            background:
              "linear-gradient(135deg, #b8860b, #ffd700)",
            border: "none",
            borderRadius: "8px",
            color: "#050e05",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          Get Pricing
        </button>
      </div>

      {/* ═══ RESPONSIVE STYLES ═══ */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 768px) {
              .desktop-nav { display: none !important; }
              .mobile-menu-btn { display: block !important; }
              .mobile-sticky-bar { display: flex !important; }
            }
            @media (min-width: 769px) {
              .desktop-nav { display: flex !important; }
              .mobile-menu-btn { display: none !important; }
              .mobile-sticky-bar { display: none !important; }
            }
          `,
        }}
      />

      {/* ═══ VENDOR MODAL ═══ */}
      <VendorModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
