"use client";

import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import Image from "next/image";

// ─── Types ───
interface GalleryItem {
  src: string;
  caption: string;
  tag: string;
}

// ─── Animation Hook ───
function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
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

// ─── Animated Section Wrapper ───
function FadeIn({ children, delay = 0, direction = "up", className = "" }: {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  className?: string;
}) {
  const [ref, isVisible] = useInView(0.1);
  const transforms: Record<string, string> = {
    up: "translateY(60px)", down: "translateY(-60px)",
    left: "translateX(60px)", right: "translateX(-60px)", none: "none",
  };
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "none" : transforms[direction],
        transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Counter Animation ───
function AnimatedCounter({ end, suffix = "", duration = 2000 }: {
  end: number;
  suffix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const [ref, isVisible] = useInView<HTMLSpanElement>(0.3);
  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [isVisible, end, duration]);
  return <span ref={ref}>{count}{suffix}</span>;
}

// ─── Image Modal / Lightbox ───
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.3s ease", cursor: "zoom-out", padding: "20px",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ maxWidth: "95%", maxHeight: "90vh", borderRadius: "12px", boxShadow: "0 25px 80px rgba(0,0,0,0.5)" }} />
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", color: "#fff", fontSize: 36, cursor: "pointer", lineHeight: 1 }}>✕</button>
    </div>
  );
}

// ─── Estimate Modal ───
function EstimateModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({ name: "", phone: "", zip: "", service: "", notes: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    const subject = encodeURIComponent(`Free Estimate Request - ${formData.service || "General"}`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\nPhone: ${formData.phone}\nZip: ${formData.zip}\nService: ${formData.service}\nNotes: ${formData.notes}`
    );
    window.location.href = `mailto:FRLawnCareFL@gmail.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
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
            <h3 style={{ color: "#4CAF50", fontSize: 24, marginBottom: 8 }}>Email Client Opened!</h3>
            <p style={{ color: "#8aba8a" }}>Send the pre-filled email, or call us directly at <a href="tel:4076869817" style={{ color: "#4CAF50" }}>407-686-9817</a></p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 13, letterSpacing: 3, color: "#4CAF50", marginBottom: 8, fontWeight: 600 }}>FREE ESTIMATE</div>
              <h3 style={{ color: "#e8f5e8", fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>Get Your Property Looking Its Best</h3>
              <p style={{ color: "#7a9a7a", fontSize: 14, marginTop: 8 }}>Fill out the form below and we&apos;ll get back to you fast.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input placeholder="Your Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={inputStyle} />
              <input placeholder="Phone Number" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} style={inputStyle} />
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
              <button
                onClick={handleSubmit}
                style={{
                  background: "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)",
                  color: "#fff", border: "none", padding: "16px", borderRadius: 12, fontSize: 17,
                  fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
                  boxShadow: "0 4px 20px rgba(76,175,80,0.4)", transition: "transform 0.2s, box-shadow 0.2s",
                  width: "100%",
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(76,175,80,0.5)"; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(76,175,80,0.4)"; }}
              >
                Request Free Estimate
              </button>
              <p style={{ textAlign: "center", color: "#5a8a5a", fontSize: 13, margin: 0 }}>
                Or call/text directly: <a href="tel:4076869817" style={{ color: "#4CAF50", fontWeight: 600 }}>407-686-9817</a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Service Data ───
const SERVICES = [
  {
    title: "Lawn Care",
    desc: "Mowing, edging, trimming, blowing & seasonal cleanups. Your yard, perfected every visit.",
    icon: "🌿",
    image: "https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=600&h=400&fit=crop",
  },
  {
    title: "Pressure Washing",
    desc: "High-pressure & soft wash for driveways, buildings, sidewalks & commercial properties.",
    icon: "💧",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop",
  },
  {
    title: "Junk Removal",
    desc: "Fast, affordable haul-away for furniture, debris, appliances & construction waste.",
    icon: "🚛",
    image: "https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&h=400&fit=crop",
  },
  {
    title: "Land Clearing",
    desc: "Brush removal, lot clearing & grading for residential and commercial properties.",
    icon: "🌲",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=400&fit=crop",
  },
  {
    title: "Property Cleanups",
    desc: "Vacant house cleanup, overgrown yards, plant removal & full property restoration.",
    icon: "🏠",
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop",
  },
];

// ─── Gallery Data ───
const GALLERY: GalleryItem[] = [
  { src: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=600&fit=crop", caption: "Commercial Pressure Washing", tag: "Pressure Wash" },
  { src: "https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=800&h=600&fit=crop", caption: "Professional Lawn Maintenance", tag: "Lawn Care" },
  { src: "https://images.unsplash.com/photo-1449844908441-8829872d2607?w=800&h=600&fit=crop", caption: "Full Property Restoration", tag: "Property Cleanup" },
  { src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=600&fit=crop", caption: "Land Clearing & Grading", tag: "Land Clearing" },
  { src: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop", caption: "Residential Exterior Cleaning", tag: "Pressure Wash" },
  { src: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=600&fit=crop", caption: "Garden & Yard Cleanup", tag: "Lawn Care" },
];

// ─── How It Works Steps ───
const STEPS = [
  { num: "01", title: "Call or Text", desc: "Reach us at 407-686-9817. We respond fast.", icon: "📱" },
  { num: "02", title: "Free Estimate", desc: "We assess your property and give you an honest quote.", icon: "📋" },
  { num: "03", title: "We Do The Work", desc: "Our crew shows up on time and gets it done right.", icon: "💪" },
  { num: "04", title: "You Enjoy", desc: "Sit back and enjoy your clean, beautiful property.", icon: "✨" },
];

// ─── Main Component ───
export default function JHPSFLWebsite() {
  const [showEstimate, setShowEstimate] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<GalleryItem | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeGalleryFilter, setActiveGalleryFilter] = useState("All");

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const filteredGallery = activeGalleryFilter === "All"
    ? GALLERY
    : GALLERY.filter((g) => g.tag === activeGalleryFilter);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@400;600;700;800&display=swap');

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: #050e05; color: #c8e0c8; overflow-x: hidden; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(76,175,80,0.3); } 50% { box-shadow: 0 0 40px rgba(76,175,80,0.6); } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes rotateIn { from { opacity: 0; transform: rotate(-5deg) scale(0.9); } to { opacity: 1; transform: none; } }

        .nav-blur { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
        .hero-gradient {
          background: linear-gradient(160deg, #0a1f0a 0%, #081808 40%, #050e05 70%, #0d200d 100%);
        }
        .section-dark { background: #050e05; }
        .section-darker { background: #030a03; }
        .section-accent { background: linear-gradient(170deg, #081808 0%, #0a200a 50%, #060f06 100%); }

        .glow-border { position: relative; }
        .glow-border::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          background: linear-gradient(135deg, #4CAF50, transparent, #2E7D32);
          z-index: -1;
          opacity: 0;
          transition: opacity 0.4s;
        }
        .glow-border:hover::before { opacity: 1; }

        .service-card {
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s;
          cursor: pointer;
        }
        .service-card:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 20px 60px rgba(76,175,80,0.15);
        }
        .service-card .card-img {
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .service-card:hover .card-img {
          transform: scale(1.1);
        }

        .gallery-item {
          cursor: zoom-in;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
          border-radius: 16px;
        }
        .gallery-item:hover { transform: scale(1.03); }
        .gallery-item .gallery-img { transition: transform 0.6s; }
        .gallery-item:hover .gallery-img { transform: scale(1.12); }

        .cta-primary {
          background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
          color: #fff; border: none; padding: 16px 36px; border-radius: 60px;
          font-size: 16px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px;
          box-shadow: 0 4px 24px rgba(76,175,80,0.4);
          transition: transform 0.3s, box-shadow 0.3s;
          font-family: inherit; display: inline-flex; align-items: center; gap: 8px;
        }
        .cta-primary:hover { transform: translateY(-3px); box-shadow: 0 8px 40px rgba(76,175,80,0.5); }

        .cta-secondary {
          background: transparent; color: #4CAF50; border: 2px solid #2a5a2a;
          padding: 14px 32px; border-radius: 60px; font-size: 16px; font-weight: 600;
          cursor: pointer; transition: all 0.3s; font-family: inherit;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .cta-secondary:hover { background: rgba(76,175,80,0.1); border-color: #4CAF50; }

        .filter-btn {
          padding: 8px 20px; border-radius: 30px; border: 1px solid #1a3a1a;
          background: transparent; color: #7a9a7a; font-size: 14px; cursor: pointer;
          transition: all 0.3s; font-family: inherit; font-weight: 500;
        }
        .filter-btn:hover, .filter-btn.active {
          background: #4CAF50; color: #fff; border-color: #4CAF50;
        }

        .step-card { transition: transform 0.3s; position: relative; }
        .step-card:hover { transform: translateY(-4px); }

        .trust-item { transition: transform 0.3s; }
        .trust-item:hover { transform: translateY(-4px) scale(1.02); }

        .promo-banner {
          position: relative;
          overflow: hidden;
          border-radius: 20px;
          border: 3px solid #1a3a1a;
        }
        .promo-banner::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(5,14,5,0) 0%, rgba(5,14,5,0.85) 100%);
          z-index: 1;
        }
        .promo-banner-gold { border-color: #b8860b; }
        .promo-banner-gold::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 23px;
          border: 3px solid transparent;
          background: linear-gradient(135deg, #b8860b, #ffd700, #b8860b) border-box;
          -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          z-index: 2;
        }

        .sticky-bar {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 999;
          background: rgba(5,14,5,0.95); backdrop-filter: blur(20px);
          border-top: 1px solid #1a3a1a;
          padding: 12px 16px;
          display: none;
          animation: slideUp 0.3s ease;
        }
        @media (max-width: 768px) {
          .sticky-bar { display: flex; gap: 10px; }
        }

        .mobile-menu {
          position: fixed; inset: 0; z-index: 9997;
          background: rgba(5,14,5,0.98); backdrop-filter: blur(20px);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px;
          animation: fadeIn 0.3s ease;
        }
        .mobile-menu a {
          color: #e8f5e8; font-size: 28px; font-weight: 600; text-decoration: none;
          transition: color 0.3s; font-family: 'Playfair Display', serif;
        }
        .mobile-menu a:hover { color: #4CAF50; }

        .noise-overlay {
          position: fixed; inset: 0; pointer-events: none; z-index: 9990;
          opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        @media (max-width: 768px) {
          .hero-text { font-size: 36px !important; }
          .section-title { font-size: 28px !important; }
          .services-grid { grid-template-columns: 1fr !important; }
          .gallery-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .trust-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
          .promo-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* Noise texture overlay */}
      <div className="noise-overlay" />

      {/* ─── NAVIGATION ─── */}
      <nav
        className="nav-blur"
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9996,
          background: scrollY > 50 ? "rgba(5,14,5,0.92)" : "transparent",
          borderBottom: scrollY > 50 ? "1px solid rgba(76,175,80,0.15)" : "1px solid transparent",
          transition: "all 0.4s",
          padding: "0 24px",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 800, color: "#fff",
            }}>J</div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18, color: "#e8f5e8", lineHeight: 1.1 }}>JHPS</div>
              <div style={{ fontSize: 9, letterSpacing: 2.5, color: "#5a8a5a", fontWeight: 600 }}>FLORIDA</div>
            </div>
          </div>

          {/* Desktop links */}
          <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="desktop-nav">
            {[["Services", "services"], ["Gallery", "gallery"], ["How It Works", "how-it-works"], ["Contact", "contact"]].map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id!)} style={{
                background: "none", border: "none", color: "#8aba8a", fontSize: 14, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit", transition: "color 0.3s", letterSpacing: 0.5,
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = "#4CAF50"; }}
              onMouseOut={(e) => { e.currentTarget.style.color = "#8aba8a"; }}
              >{label}</button>
            ))}
            <button className="cta-primary" onClick={() => setShowEstimate(true)} style={{ padding: "10px 24px", fontSize: 14 }}>
              Free Estimate
            </button>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            display: "none", background: "none", border: "none", cursor: "pointer",
            flexDirection: "column", gap: 5, padding: 8,
          }}
          className="mobile-hamburger"
          >
            <span style={{ width: 24, height: 2, background: "#4CAF50", borderRadius: 2, transition: "all 0.3s", transform: menuOpen ? "rotate(45deg) translateY(7px)" : "none", display: "block" }} />
            <span style={{ width: 24, height: 2, background: "#4CAF50", borderRadius: 2, transition: "all 0.3s", opacity: menuOpen ? 0 : 1, display: "block" }} />
            <span style={{ width: 24, height: 2, background: "#4CAF50", borderRadius: 2, transition: "all 0.3s", transform: menuOpen ? "rotate(-45deg) translateY(-7px)" : "none", display: "block" }} />
          </button>
        </div>
        <style>{`
          @media (max-width: 768px) {
            .desktop-nav { display: none !important; }
            .mobile-hamburger { display: flex !important; }
          }
        `}</style>
      </nav>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="mobile-menu">
          <button onClick={() => setMenuOpen(false)} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", color: "#4CAF50", fontSize: 32, cursor: "pointer" }}>✕</button>
          {[["Services", "services"], ["Gallery", "gallery"], ["How It Works", "how-it-works"], ["Contact", "contact"]].map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => { scrollTo(id!); setMenuOpen(false); }}>{label}</a>
          ))}
          <button className="cta-primary" onClick={() => { setMenuOpen(false); setShowEstimate(true); }} style={{ marginTop: 16 }}>
            Get Free Estimate
          </button>
        </div>
      )}

      {/* ─── HERO SECTION ─── */}
      <section className="hero-gradient" style={{ minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden" }}>
        {/* Animated background elements */}
        <div style={{
          position: "absolute", top: "15%", right: "-5%", width: 500, height: 500,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(76,175,80,0.08) 0%, transparent 70%)",
          animation: "float 8s ease-in-out infinite", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "10%", left: "-8%", width: 400, height: 400,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(46,125,50,0.06) 0%, transparent 70%)",
          animation: "float 10s ease-in-out infinite 2s", pointerEvents: "none",
        }} />
        {/* Grid pattern */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: "linear-gradient(rgba(76,175,80,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(76,175,80,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          transform: `translateY(${scrollY * 0.1}px)`,
        }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "120px 24px 80px", width: "100%", position: "relative", zIndex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }} className="hero-grid">
            <div>
              <FadeIn delay={0.1}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px",
                  background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.2)",
                  borderRadius: 40, marginBottom: 28,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4CAF50", animation: "pulse 2s infinite", display: "block" }} />
                  <span style={{ fontSize: 13, color: "#4CAF50", fontWeight: 600, letterSpacing: 1 }}>SERVING CENTRAL FLORIDA</span>
                </div>
              </FadeIn>
              <FadeIn delay={0.2}>
                <h1 className="hero-text" style={{
                  fontFamily: "'Playfair Display', serif", fontSize: 56, fontWeight: 800,
                  lineHeight: 1.1, color: "#e8f5e8", marginBottom: 24,
                }}>
                  Your Property,{" "}
                  <span style={{
                    background: "linear-gradient(135deg, #4CAF50, #81C784, #4CAF50)",
                    backgroundSize: "200% 200%",
                    animation: "gradientShift 4s ease infinite",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}>Transformed.</span>
                </h1>
              </FadeIn>
              <FadeIn delay={0.35}>
                <p style={{ fontSize: 18, lineHeight: 1.7, color: "#8aba8a", marginBottom: 36, maxWidth: 500 }}>
                  From lawn care to land clearing, pressure washing to junk removal — Jenkins Home & Property Solutions handles it all. Serving the Deltona, Orlando & Central Florida area.
                </p>
              </FadeIn>
              <FadeIn delay={0.5}>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <a href="tel:4076869817" className="cta-primary" style={{ textDecoration: "none" }}>
                    <span style={{ fontSize: 20 }}>📞</span> Call or Text Now
                  </a>
                  <button className="cta-secondary" onClick={() => setShowEstimate(true)}>
                    Free Estimate →
                  </button>
                </div>
              </FadeIn>
              <FadeIn delay={0.65}>
                <div style={{ display: "flex", gap: 32, marginTop: 48, flexWrap: "wrap" }}>
                  {[["Free", "Estimates"], ["Fast", "Response"], ["Professional", "Results"]].map(([top, bottom], i) => (
                    <div key={i} style={{ borderLeft: "2px solid #2a5a2a", paddingLeft: 16 }}>
                      <div style={{ fontSize: 13, color: "#5a8a5a", fontWeight: 500 }}>{top}</div>
                      <div style={{ fontSize: 16, color: "#c8e0c8", fontWeight: 700 }}>{bottom}</div>
                    </div>
                  ))}
                </div>
              </FadeIn>
            </div>

            {/* Hero Image Collage */}
            <FadeIn delay={0.4} direction="left">
              <div style={{ position: "relative" }}>
                <div style={{
                  borderRadius: 24, overflow: "hidden",
                  boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
                  border: "1px solid rgba(76,175,80,0.15)",
                  position: "relative", height: 420,
                }}>
                  <Image
                    src="https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=700&h=500&fit=crop"
                    alt="Professional pressure washing service"
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                </div>
                {/* Floating accent card */}
                <div style={{
                  position: "absolute", bottom: -24, left: -24, background: "rgba(5,14,5,0.9)",
                  border: "1px solid #2a5a2a", borderRadius: 16, padding: "16px 24px",
                  backdropFilter: "blur(10px)", animation: "float 6s ease-in-out infinite",
                }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#4CAF50", fontFamily: "'Playfair Display', serif" }}>
                    <AnimatedCounter end={500} suffix="+" />
                  </div>
                  <div style={{ fontSize: 12, color: "#7a9a7a", letterSpacing: 1 }}>JOBS COMPLETED</div>
                </div>
                {/* Floating accent card top right */}
                <div style={{
                  position: "absolute", top: -16, right: -16, background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                  borderRadius: 14, padding: "14px 20px", animation: "float 7s ease-in-out infinite 1s",
                  boxShadow: "0 8px 30px rgba(76,175,80,0.3)",
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>⭐ Top Rated</div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
        <style>{`
          @media (max-width: 768px) {
            .hero-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>

      {/* ─── PROMOTIONAL BANNERS ─── */}
      <section className="section-darker" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{ fontSize: 13, letterSpacing: 3, color: "#4CAF50", marginBottom: 12, fontWeight: 600 }}>WHAT WE DO</div>
              <h2 className="section-title" style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, color: "#e8f5e8", fontWeight: 700 }}>
                Premium Property Services
              </h2>
            </div>
          </FadeIn>

          <div className="promo-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <FadeIn delay={0.1}>
              <div className="promo-banner promo-banner-gold" style={{ height: 320 }}>
                <Image
                  src="https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=400&fit=crop"
                  alt="Night pressure washing"
                  fill
                  style={{ objectFit: "cover" }}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "32px 28px", zIndex: 3 }}>
                  <div style={{ fontSize: 11, letterSpacing: 3, color: "#ffd700", marginBottom: 6, fontWeight: 700 }}>FEATURED SERVICE</div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#fff", fontWeight: 700, marginBottom: 8 }}>Commercial Pressure Washing</h3>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>Gas stations, storefronts, driveways & more. Day or night service available.</p>
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="promo-banner" style={{ height: 320 }}>
                <Image
                  src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=400&fit=crop"
                  alt="Land clearing"
                  fill
                  style={{ objectFit: "cover" }}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "32px 28px", zIndex: 3 }}>
                  <div style={{ fontSize: 11, letterSpacing: 3, color: "#4CAF50", marginBottom: 6, fontWeight: 700 }}>LAND SERVICES</div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#fff", fontWeight: 700, marginBottom: 8 }}>Land Clearing & Lot Prep</h3>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>Brush removal, grading & clearing for residential or commercial projects.</p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ─── SERVICES SECTION ─── */}
      <section id="services" className="section-accent" style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: 60 }}>
              <div style={{ fontSize: 13, letterSpacing: 3, color: "#4CAF50", marginBottom: 12, fontWeight: 600 }}>OUR SERVICES</div>
              <h2 className="section-title" style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, color: "#e8f5e8", fontWeight: 700, marginBottom: 16 }}>
                Everything Your Property Needs
              </h2>
              <p style={{ color: "#7a9a7a", fontSize: 16, maxWidth: 560, margin: "0 auto" }}>
                Services starting at $50+. One call handles it all — from weekly lawn care to full property transformations.
              </p>
            </div>
          </FadeIn>

          <div className="services-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {SERVICES.map((service, i) => (
              <FadeIn key={i} delay={0.1 * i} direction={i % 2 === 0 ? "up" : "right"}>
                <div
                  className="service-card glow-border"
                  onClick={() => setShowEstimate(true)}
                  style={{
                    background: "linear-gradient(160deg, #0d1f0d 0%, #091409 100%)",
                    borderRadius: 20, overflow: "hidden",
                    border: "1px solid #1a3a1a",
                    ...(i === SERVICES.length - 1 && SERVICES.length % 3 === 2 ? { gridColumn: "2" } : {}),
                  }}
                >
                  <div style={{ overflow: "hidden", height: 200, position: "relative" }}>
                    <Image
                      src={service.image}
                      alt={service.title}
                      fill
                      className="card-img"
                      style={{ objectFit: "cover" }}
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <div style={{ padding: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 28 }}>{service.icon}</span>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#e8f5e8", fontWeight: 700 }}>{service.title}</h3>
                    </div>
                    <p style={{ color: "#7a9a7a", fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>{service.desc}</p>
                    <div style={{ fontSize: 14, color: "#4CAF50", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      Get Free Estimate <span style={{ transition: "transform 0.3s" }}>→</span>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TRUST BAR ─── */}
      <section className="section-darker" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="trust-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            {[
              { icon: "✓", title: "Free Estimates", desc: "No obligation quotes for all services" },
              { icon: "⚡", title: "Fast Scheduling", desc: "Quick turnaround, flexible availability" },
              { icon: "📍", title: "Locally Owned", desc: "Based in the Deltona / Orlando area" },
              { icon: "🛡️", title: "Reliable & Insured", desc: "Professional service you can trust" },
            ].map((item, i) => (
              <FadeIn key={i} delay={0.1 * i}>
                <div className="trust-item" style={{
                  background: "linear-gradient(160deg, #0d1f0d, #091409)",
                  border: "1px solid #1a3a1a", borderRadius: 16, padding: "32px 24px",
                  textAlign: "center",
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
                    background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                  }}>{item.icon}</div>
                  <h4 style={{ color: "#e8f5e8", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{item.title}</h4>
                  <p style={{ color: "#6a9a6a", fontSize: 13, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GALLERY SECTION ─── */}
      <section id="gallery" className="section-accent" style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontSize: 13, letterSpacing: 3, color: "#4CAF50", marginBottom: 12, fontWeight: 600 }}>OUR WORK</div>
              <h2 className="section-title" style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, color: "#e8f5e8", fontWeight: 700, marginBottom: 24 }}>
                See The Results
              </h2>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {["All", "Lawn Care", "Pressure Wash", "Land Clearing", "Property Cleanup"].map((filter) => (
                  <button
                    key={filter}
                    className={`filter-btn ${activeGalleryFilter === filter ? "active" : ""}`}
                    onClick={() => setActiveGalleryFilter(filter)}
                  >{filter}</button>
                ))}
              </div>
            </div>
          </FadeIn>

          <div className="gallery-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {filteredGallery.map((img, i) => (
              <FadeIn key={img.src + i} delay={0.08 * i}>
                <div className="gallery-item" onClick={() => setLightboxImg(img)}>
                  <div style={{ position: "relative", overflow: "hidden", height: 260 }}>
                    <Image
                      src={img.src}
                      alt={img.caption}
                      fill
                      className="gallery-img"
                      style={{ objectFit: "cover" }}
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(0deg, rgba(5,14,5,0.8) 0%, transparent 60%)",
                      display: "flex", alignItems: "flex-end", padding: 20, zIndex: 1,
                    }}>
                      <div>
                        <div style={{ fontSize: 10, letterSpacing: 2, color: "#4CAF50", marginBottom: 4, fontWeight: 600 }}>{img.tag.toUpperCase()}</div>
                        <div style={{ color: "#e8f5e8", fontWeight: 600, fontSize: 15 }}>{img.caption}</div>
                      </div>
                    </div>
                    <div style={{
                      position: "absolute", top: 12, right: 12, zIndex: 1,
                      width: 36, height: 36, borderRadius: "50%",
                      background: "rgba(76,175,80,0.2)", backdropFilter: "blur(8px)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, opacity: 0.7,
                    }}>🔍</div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.3}>
            <p style={{ textAlign: "center", color: "#5a8a5a", fontSize: 14, marginTop: 32, fontStyle: "italic" }}>
              Real project photos coming soon — these are representative of the work we do.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="section-darker" style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: 60 }}>
              <div style={{ fontSize: 13, letterSpacing: 3, color: "#4CAF50", marginBottom: 12, fontWeight: 600 }}>SIMPLE PROCESS</div>
              <h2 className="section-title" style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, color: "#e8f5e8", fontWeight: 700 }}>
                How It Works
              </h2>
            </div>
          </FadeIn>

          <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, position: "relative" }}>
            {/* Connecting line */}
            <div style={{
              position: "absolute", top: 52, left: "15%", right: "15%", height: 2,
              background: "linear-gradient(90deg, transparent, #2a5a2a, #2a5a2a, transparent)",
              zIndex: 0, display: "block",
            }} className="step-line" />
            <style>{`@media (max-width: 768px) { .step-line { display: none !important; } }`}</style>

            {STEPS.map((step, i) => (
              <FadeIn key={i} delay={0.15 * i}>
                <div className="step-card" style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: "50%", margin: "0 auto 20px",
                    background: "linear-gradient(135deg, rgba(76,175,80,0.15), rgba(46,125,50,0.1))",
                    border: "2px solid #2a5a2a",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 32, position: "relative",
                  }}>
                    {step.icon}
                    <div style={{
                      position: "absolute", top: -6, right: -6,
                      background: "#4CAF50", color: "#fff", fontSize: 11, fontWeight: 800,
                      width: 26, height: 26, borderRadius: "50%", display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}>{step.num}</div>
                  </div>
                  <h4 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#e8f5e8", fontWeight: 700, marginBottom: 8 }}>{step.title}</h4>
                  <p style={{ color: "#7a9a7a", fontSize: 14, lineHeight: 1.6 }}>{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS SECTION ─── */}
      <section className="section-accent" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32, textAlign: "center" }}>
            {[
              { value: 500, suffix: "+", label: "Jobs Completed" },
              { value: 100, suffix: "%", label: "Satisfaction Rate" },
              { value: 24, suffix: "hr", label: "Fast Response" },
              { value: 5, suffix: "+", label: "Services Offered" },
            ].map((stat, i) => (
              <FadeIn key={i} delay={0.1 * i}>
                <div>
                  <div style={{
                    fontFamily: "'Playfair Display', serif", fontSize: 48, fontWeight: 800,
                    background: "linear-gradient(135deg, #4CAF50, #81C784)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    marginBottom: 8,
                  }}>
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </div>
                  <div style={{ color: "#6a9a6a", fontSize: 14, letterSpacing: 1, fontWeight: 500 }}>{stat.label}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SERVICE AREA ─── */}
      <section className="section-darker" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <FadeIn>
            <div style={{
              background: "linear-gradient(160deg, #0d1f0d, #091409)",
              border: "1px solid #1a3a1a", borderRadius: 24, padding: "48px 40px",
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📍</div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 700, marginBottom: 12 }}>Service Area</h3>
              <p style={{ color: "#8aba8a", fontSize: 16, lineHeight: 1.8, marginBottom: 24 }}>
                Proudly serving <strong style={{ color: "#4CAF50" }}>Deltona, Orlando, Sanford, DeLand, Daytona Beach</strong> and surrounding Central Florida communities.
              </p>
              <p style={{ color: "#5a8a5a", fontSize: 14 }}>Don&apos;t see your area? Give us a call — we may still be able to help.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── BIG CTA SECTION ─── */}
      <section style={{
        padding: "120px 24px", position: "relative", overflow: "hidden",
        background: "linear-gradient(160deg, #0a200a 0%, #132913 50%, #0a1a0a 100%)",
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.06,
          backgroundImage: "radial-gradient(circle at 30% 50%, rgba(76,175,80,0.3), transparent 50%), radial-gradient(circle at 70% 50%, rgba(46,125,50,0.2), transparent 50%)",
        }} />
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <FadeIn>
            <h2 style={{
              fontFamily: "'Playfair Display', serif", fontSize: 48, color: "#e8f5e8",
              fontWeight: 800, lineHeight: 1.15, marginBottom: 20,
            }}>
              Ready to Transform<br />Your Property?
            </h2>
            <p style={{ color: "#8aba8a", fontSize: 18, marginBottom: 40, lineHeight: 1.7 }}>
              One call is all it takes. Get a free estimate today and see why Central Florida trusts Jenkins Home & Property Solutions.
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="tel:4076869817" className="cta-primary" style={{ textDecoration: "none", fontSize: 18, padding: "18px 40px" }}>
                📞 407-686-9817
              </a>
              <button className="cta-secondary" onClick={() => setShowEstimate(true)} style={{ fontSize: 18, padding: "16px 36px" }}>
                Request Estimate →
              </button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer id="contact" className="section-darker" style={{ padding: "64px 24px 100px", borderTop: "1px solid #1a3a1a" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 48, marginBottom: 48 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, fontWeight: 800, color: "#fff",
                }}>J</div>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 20, color: "#e8f5e8" }}>Jenkins Home & Property Solutions</div>
                </div>
              </div>
              <p style={{ color: "#6a9a6a", fontSize: 14, lineHeight: 1.8, maxWidth: 400, marginBottom: 20 }}>
                Central Florida&apos;s trusted partner for lawn care, pressure washing, junk removal, land clearing, and property cleanups.
              </p>
              <div style={{ display: "flex", gap: 16 }}>
                <a href="tel:4076869817" style={{ color: "#4CAF50", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>📞 407-686-9817</a>
                <a href="mailto:FRLawnCareFL@gmail.com" style={{ color: "#4CAF50", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>✉️ Email Us</a>
              </div>
            </div>
            <div>
              <h4 style={{ color: "#e8f5e8", fontSize: 15, fontWeight: 700, marginBottom: 16, letterSpacing: 1 }}>SERVICES</h4>
              {SERVICES.map((s) => (
                <div key={s.title} style={{ color: "#6a9a6a", fontSize: 14, marginBottom: 10, cursor: "pointer", transition: "color 0.3s" }}
                  onMouseOver={(e) => { e.currentTarget.style.color = "#4CAF50"; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = "#6a9a6a"; }}
                >{s.title}</div>
              ))}
            </div>
            <div>
              <h4 style={{ color: "#e8f5e8", fontSize: 15, fontWeight: 700, marginBottom: 16, letterSpacing: 1 }}>QUICK LINKS</h4>
              {[["Services", "services"], ["Gallery", "gallery"], ["How It Works", "how-it-works"], ["Contact", "contact"]].map(([label, id]) => (
                <div key={id} style={{ color: "#6a9a6a", fontSize: 14, marginBottom: 10, cursor: "pointer", transition: "color 0.3s" }}
                  onClick={() => scrollTo(id!)}
                  onMouseOver={(e) => { e.currentTarget.style.color = "#4CAF50"; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = "#6a9a6a"; }}
                >{label}</div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div style={{ color: "#3a5a3a", fontSize: 13 }}>© 2025 Jenkins Home & Property Solutions. All rights reserved.</div>
            <div style={{ color: "#3a5a3a", fontSize: 13 }}>Serving Central Florida — Deltona • Orlando • Sanford • DeLand</div>
          </div>
        </div>
      </footer>

      {/* ─── STICKY MOBILE BAR ─── */}
      <div className="sticky-bar">
        <a href="tel:4076869817" style={{
          flex: 1, background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
          border: "none", padding: "14px", borderRadius: 14, fontSize: 15, fontWeight: 700,
          textAlign: "center", textDecoration: "none", display: "block",
        }}>
          📞 Call Now
        </a>
        <a href="sms:4076869817" style={{
          flex: 1, background: "transparent", color: "#4CAF50",
          border: "2px solid #2a5a2a", padding: "12px", borderRadius: 14,
          fontSize: 15, fontWeight: 700, textAlign: "center", textDecoration: "none", display: "block",
        }}>
          💬 Text Us
        </a>
      </div>

      {/* ─── MODALS ─── */}
      {showEstimate && <EstimateModal onClose={() => setShowEstimate(false)} />}
      {lightboxImg && <Lightbox src={lightboxImg.src} alt={lightboxImg.caption} onClose={() => setLightboxImg(null)} />}
    </>
  );
}
