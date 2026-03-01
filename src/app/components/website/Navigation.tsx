"use client";

import Link from "next/link";

export default function Navigation({ scrollY, menuOpen, setMenuOpen, logoSrc, companyName, logoMaxWidth, logoMaxHeight, logoFit, logoPadding, primaryHex, setShowEstimate, scrollTo }: {
  scrollY: number;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  logoSrc: string | null;
  companyName: string;
  logoMaxWidth: number;
  logoMaxHeight: number;
  logoFit: string;
  logoPadding: number;
  primaryHex: string;
  setShowEstimate: (show: boolean) => void;
  scrollTo: (id: string) => void;
}) {
  return (
    <>
      <nav
        className="nav-blur"
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9996,
          background: scrollY > 50 ? "rgba(5,14,5,0.92)" : "transparent",
          borderBottom: scrollY > 50 ? "1px solid rgba(76,175,80,0.15)" : "1px solid transparent",
          transition: "all 0.4s", padding: "0 24px",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc || "/jhps-nav-logo.svg"}
              alt={companyName}
              style={{ width: logoMaxWidth, height: "auto", maxHeight: 60, padding: logoPadding }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="desktop-nav">
            {[["Services", "services"], ["Gallery", "gallery"], ["How It Works", "how-it-works"], ["Contact", "contact"]].map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id!)} style={{
                background: "none", border: "none", color: "#8aba8a", fontSize: 14, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit", transition: "color 0.3s", letterSpacing: 0.5,
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = primaryHex; }}
              onMouseOut={(e) => { e.currentTarget.style.color = "#8aba8a"; }}
              >{label}</button>
            ))}
            <Link href="/commercial" style={{
              color: "#c8a84b", fontSize: 13, fontWeight: 600, textDecoration: "none",
              padding: "7px 16px", border: "1px solid rgba(200,168,75,0.3)", borderRadius: 10,
              transition: "all 0.3s", letterSpacing: 0.3, whiteSpace: "nowrap",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(200,168,75,0.1)"; e.currentTarget.style.borderColor = "rgba(200,168,75,0.6)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(200,168,75,0.3)"; }}>
              🏢 Commercial
            </Link>
            <Link href="/pay" style={{
              color: "#4CAF50", fontSize: 14, fontWeight: 600, textDecoration: "none",
              padding: "8px 20px", border: "1px solid #2a5a2a", borderRadius: 10,
              transition: "all 0.3s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(76,175,80,0.1)"; e.currentTarget.style.borderColor = "#4CAF50"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#2a5a2a"; }}>
              💳 Pay
            </Link>
            <button className="cta-primary" onClick={() => setShowEstimate(true)} style={{ padding: "10px 24px", fontSize: 14 }}>
              Free Estimate
            </button>
            <Link href="/get-quote" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg, #b8860b, #ffd700, #b8860b)",
              backgroundSize: "200% 100%",
              color: "#0a0a00", fontWeight: 800, fontSize: 13,
              padding: "10px 22px", borderRadius: 30, textDecoration: "none",
              letterSpacing: 0.3, whiteSpace: "nowrap",
              boxShadow: "0 4px 20px rgba(184,134,11,0.4)",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 8px 30px rgba(184,134,11,0.6)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 20px rgba(184,134,11,0.4)"; }}>
              📹 Video Quote
            </Link>
          </div>

          {/* Mobile: gold quote button + hamburger */}
          <div style={{ display: "none", alignItems: "center", gap: 10 }} className="mobile-header-right">
            <Link href="/get-quote" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "linear-gradient(135deg, #b8860b, #ffd700)",
              color: "#0a0a00", fontWeight: 800, fontSize: 12,
              padding: "8px 14px", borderRadius: 24, textDecoration: "none",
              letterSpacing: 0.2, whiteSpace: "nowrap",
              boxShadow: "0 3px 14px rgba(184,134,11,0.45)",
            }}>
              📹 Quote
            </Link>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            display: "none", background: "none", border: "none", cursor: "pointer",
            flexDirection: "column", gap: 5, padding: 8,
          }} className="mobile-hamburger">
            <span style={{ width: 24, height: 2, background: primaryHex, borderRadius: 2, transition: "all 0.3s", transform: menuOpen ? "rotate(45deg) translateY(7px)" : "none", display: "block" }} />
            <span style={{ width: 24, height: 2, background: primaryHex, borderRadius: 2, transition: "all 0.3s", opacity: menuOpen ? 0 : 1, display: "block" }} />
            <span style={{ width: 24, height: 2, background: primaryHex, borderRadius: 2, transition: "all 0.3s", transform: menuOpen ? "rotate(-45deg) translateY(-7px)" : "none", display: "block" }} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="mobile-menu">
          <button onClick={() => setMenuOpen(false)} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", color: primaryHex, fontSize: 32, cursor: "pointer" }}>✕</button>

          <Link href="/get-quote" onClick={() => setMenuOpen(false)} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: "linear-gradient(135deg, #b8860b 0%, #ffd700 50%, #b8860b 100%)",
            color: "#0a0a00", fontWeight: 800, fontSize: 18,
            padding: "18px 32px", borderRadius: 16, textDecoration: "none",
            letterSpacing: 0.3, width: "100%", boxSizing: "border-box",
            boxShadow: "0 6px 30px rgba(184,134,11,0.5)",
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 22 }}>📹</span>
            Get Your Free Video Quote
            <span style={{ opacity: 0.7 }}>→</span>
          </Link>
          <div style={{ fontSize: 11, color: "#7a6a3a", letterSpacing: 2, textAlign: "center", marginBottom: 24 }}>
            SNAP PHOTOS · WE REVIEW · QUOTE DELIVERED
          </div>

          {[["Services", "services"], ["Gallery", "gallery"], ["How It Works", "how-it-works"], ["Contact", "contact"]].map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => { scrollTo(id!); setMenuOpen(false); }}>{label}</a>
          ))}
          <Link href="/commercial" onClick={() => setMenuOpen(false)} style={{ color: "#c8a84b", fontSize: 22, fontWeight: 600, textDecoration: "none", fontFamily: "'Playfair Display', serif" }}>
            🏢 Commercial Services
          </Link>
          <Link href="/pay" onClick={() => setMenuOpen(false)} style={{ color: "#e8f5e8", fontSize: 28, fontWeight: 600, textDecoration: "none", fontFamily: "'Playfair Display', serif" }}>
            Make Payment
          </Link>
          <button className="cta-primary" onClick={() => { setMenuOpen(false); setShowEstimate(true); }} style={{ marginTop: 16 }}>
            Get Free Estimate
          </button>
        </div>
      )}
    </>
  );
}
