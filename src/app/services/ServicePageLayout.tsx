"use client";

import Link from "next/link";

interface FAQ {
  q: string;
  a: string;
}

interface ServicePageProps {
  title: string;
  icon: string;
  headline: string;
  description: string;
  includes: string[];
  areas: string[];
  faqs: FAQ[];
  relatedServices: { title: string; href: string; icon: string }[];
  ctaText?: string;
}

export default function ServicePageLayout({
  title, icon, headline, description, includes, areas, faqs, relatedServices, ctaText,
}: ServicePageProps) {
  return (
    <div style={{ minHeight: "100vh", background: "#050e05", color: "#e0e0e0" }}>
      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(5,14,5,0.95)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(76,175,80,0.15)", padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <Link href="/" style={{ color: "#4CAF50", fontWeight: 800, fontSize: 18, textDecoration: "none" }}>
            JHPS
          </Link>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <Link href="/#services" style={{ color: "#8ab88a", textDecoration: "none", fontSize: 14 }}>Services</Link>
            <Link href="/get-quote" style={{
              background: "#4CAF50", color: "#fff", padding: "8px 18px",
              borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 700,
            }}>Free Quote</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: "80px 24px 60px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{icon}</div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 800, color: "#fff", marginBottom: 16, lineHeight: 1.2,
          }}>
            {headline}
          </h1>
          <p style={{ fontSize: 18, color: "#8ab88a", lineHeight: 1.6, maxWidth: 600, margin: "0 auto 32px" }}>
            {description}
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/get-quote" style={{
              background: "#4CAF50", color: "#fff", padding: "14px 32px", borderRadius: 8,
              textDecoration: "none", fontWeight: 700, fontSize: 16,
            }}>
              Get a Free Estimate
            </Link>
            <a href="tel:4076869817" style={{
              border: "2px solid #4CAF50", color: "#4CAF50", padding: "14px 32px", borderRadius: 8,
              textDecoration: "none", fontWeight: 700, fontSize: 16,
            }}>
              Call (407) 686-9817
            </a>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section style={{ padding: "60px 24px", background: "rgba(10,20,10,0.5)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 32 }}>
            What&apos;s Included in Our {title} Service
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
            {includes.map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 18px", borderRadius: 10,
                background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.15)",
              }}>
                <span style={{ color: "#4CAF50", fontSize: 18 }}>&#10003;</span>
                <span style={{ fontSize: 15, color: "#ccc" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Area */}
      <section style={{ padding: "60px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
            {title} Service Areas
          </h2>
          <p style={{ color: "#8ab88a", marginBottom: 24, fontSize: 15 }}>
            We proudly serve residential and commercial customers across Central Florida:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {areas.map((area, i) => (
              <span key={i} style={{
                padding: "8px 16px", borderRadius: 20,
                background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.2)",
                color: "#8ab88a", fontSize: 14,
              }}>
                {area}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "60px 24px", background: "rgba(10,20,10,0.5)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 32 }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{
                padding: "20px 24px", borderRadius: 12,
                background: "rgba(20,40,20,0.5)", border: "1px solid rgba(76,175,80,0.12)",
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{faq.q}</h3>
                <p style={{ fontSize: 15, color: "#aaa", lineHeight: 1.6, margin: 0 }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
            {ctaText || `Ready for Professional ${title}?`}
          </h2>
          <p style={{ color: "#8ab88a", marginBottom: 32, fontSize: 16 }}>
            Get a free, no-obligation estimate. We respond within 24 hours.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/get-quote" style={{
              background: "#4CAF50", color: "#fff", padding: "16px 36px", borderRadius: 8,
              textDecoration: "none", fontWeight: 700, fontSize: 17,
            }}>
              Get Your Free Quote
            </Link>
            <a href="tel:4076869817" style={{
              border: "2px solid #4CAF50", color: "#4CAF50", padding: "16px 36px", borderRadius: 8,
              textDecoration: "none", fontWeight: 700, fontSize: 17,
            }}>
              (407) 686-9817
            </a>
          </div>
        </div>
      </section>

      {/* Related Services */}
      <section style={{ padding: "40px 24px 80px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h3 style={{ fontSize: 18, color: "#5a8a5a", marginBottom: 16 }}>Other Services</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {relatedServices.map((s, i) => (
              <Link key={i} href={s.href} style={{
                padding: "12px 20px", borderRadius: 10,
                background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.15)",
                color: "#8ab88a", textDecoration: "none", fontSize: 14, fontWeight: 600,
              }}>
                {s.icon} {s.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Minimal footer */}
      <footer style={{
        padding: "24px", borderTop: "1px solid #1a3a1a", textAlign: "center",
        fontSize: 13, color: "#3a5a3a",
      }}>
        &copy; {new Date().getFullYear()} Jenkins Home &amp; Property Solutions | Deltona, FL |{" "}
        <a href="tel:4076869817" style={{ color: "#4CAF50", textDecoration: "none" }}>(407) 686-9817</a>
      </footer>
    </div>
  );
}
