"use client";

import Link from "next/link";

export default function Footer({ logoSrc, companyName, logoMaxWidth, logoMaxHeight, logoFit, logoPadding, primaryHex, darkHex, phone, phoneDisplay, phoneHref, emailHref, footerAbout, serviceAreas, displayServices, scrollTo }: {
  logoSrc: string | null;
  companyName: string;
  logoMaxWidth: number;
  logoMaxHeight: number;
  logoFit: string;
  logoPadding: number;
  primaryHex: string;
  darkHex: string;
  phone: string;
  phoneDisplay: string;
  phoneHref: string;
  emailHref: string;
  footerAbout: string;
  serviceAreas: string[];
  displayServices: { title: string }[];
  scrollTo: (id: string) => void;
}) {
  return (
    <>
      <footer id="contact" className="section-darker" style={{ padding: "64px 24px 100px", borderTop: "1px solid #1a3a1a" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 48, marginBottom: 48 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoSrc} alt={companyName} style={{ maxWidth: logoMaxWidth, height: "auto", maxHeight: logoMaxHeight, objectFit: logoFit as React.CSSProperties['objectFit'], padding: logoPadding }} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/jhps-nav-logo.svg" alt={companyName} style={{ maxWidth: 220, height: "auto", maxHeight: 48 }} />
                )}
              </div>
              <p style={{ color: "#6a9a6a", fontSize: 14, lineHeight: 1.8, maxWidth: 400, marginBottom: 20 }}>
                {footerAbout}
              </p>
              <div style={{ display: "flex", gap: 16 }}>
                <a href={phoneHref} style={{ color: primaryHex, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>📞 {phoneDisplay}</a>
                <a href={emailHref} style={{ color: primaryHex, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>✉️ Email Us</a>
              </div>
            </div>
            <div>
              <h4 style={{ color: "#e8f5e8", fontSize: 15, fontWeight: 700, marginBottom: 16, letterSpacing: 1 }}>SERVICES</h4>
              {displayServices.map((s) => (
                <div key={s.title} style={{ color: "#6a9a6a", fontSize: 14, marginBottom: 10, cursor: "pointer", transition: "color 0.3s" }}
                  onMouseOver={(e) => { e.currentTarget.style.color = primaryHex; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = "#6a9a6a"; }}
                >{s.title}</div>
              ))}
            </div>
            <div>
              <h4 style={{ color: "#e8f5e8", fontSize: 15, fontWeight: 700, marginBottom: 16, letterSpacing: 1 }}>QUICK LINKS</h4>
              {[["Services", "services"], ["Gallery", "gallery"], ["How It Works", "how-it-works"], ["Contact", "contact"]].map(([label, id]) => (
                <div key={id} style={{ color: "#6a9a6a", fontSize: 14, marginBottom: 10, cursor: "pointer", transition: "color 0.3s" }}
                  onClick={() => scrollTo(id!)}
                  onMouseOver={(e) => { e.currentTarget.style.color = primaryHex; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = "#6a9a6a"; }}
                >{label}</div>
              ))}
              <Link href="/pay" style={{ color: "#6a9a6a", fontSize: 14, marginBottom: 10, display: "block", textDecoration: "none", transition: "color 0.3s" }}
                onMouseOver={(e) => { e.currentTarget.style.color = primaryHex; }}
                onMouseOut={(e) => { e.currentTarget.style.color = "#6a9a6a"; }}>
                Make Payment
              </Link>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div style={{ color: "#3a5a3a", fontSize: 13 }}>© 2025 {companyName}. All rights reserved.</div>
            <div style={{ color: "#3a5a3a", fontSize: 13 }}>Serving Central Florida — {serviceAreas.slice(0, 4).join(" • ")}</div>
          </div>
        </div>
      </footer>

      {/* Sticky Mobile Bar */}
      <div className="sticky-bar">
        <a href={phoneHref} style={{
          flex: 1, background: `linear-gradient(135deg, ${primaryHex}, ${darkHex})`, color: "#fff",
          border: "none", padding: "9px 6px", borderRadius: 12, fontSize: 13, fontWeight: 700,
          textAlign: "center", textDecoration: "none", display: "block",
        }}>
          📞 Call
        </a>
        <Link href="/get-quote" style={{
          flex: 1.4, background: "linear-gradient(135deg, #b8860b, #ffd700, #b8860b)",
          color: "#0a0a00", padding: "9px 6px", borderRadius: 12,
          fontSize: 13, fontWeight: 800, textAlign: "center", textDecoration: "none", display: "block",
          boxShadow: "0 2px 16px rgba(184,134,11,0.5)",
        }}>
          📹 Video Quote
        </Link>
        <a href={`sms:${phone}`} style={{
          flex: 1, background: "transparent", color: primaryHex,
          border: "2px solid #2a5a2a", padding: "7px 6px", borderRadius: 12,
          fontSize: 14, fontWeight: 700, textAlign: "center", textDecoration: "none", display: "block",
        }}>
          💬 Text
        </a>
      </div>
    </>
  );
}
