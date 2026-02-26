"use client";

import Link from "next/link";
import { FadeIn } from "./animations";

export default function VideoQuoteSection() {
  return (
    <section style={{ padding: "80px 24px", background: "#060f06", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, #ffd700, #b8860b, #ffd700, transparent)" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(184,134,11,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 11, letterSpacing: 4, color: "#ffd700", fontWeight: 700,
              marginBottom: 20, padding: "6px 18px",
              border: "1px solid rgba(255,215,0,0.3)", borderRadius: 30,
              background: "rgba(184,134,11,0.08)",
            }}>
              <span style={{ fontSize: 8, color: "#ffd700" }}>✦</span>
              INTRODUCING
              <span style={{ fontSize: 8, color: "#ffd700" }}>✦</span>
            </div>

            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(30px, 5vw, 52px)",
              fontWeight: 700, color: "#f0ead0",
              lineHeight: 1.2, marginBottom: 20,
            }}>
              Get a Quote Without<br />
              <span style={{
                background: "linear-gradient(135deg, #ffd700 0%, #f0a500 50%, #b8860b 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Ever Leaving Your Couch</span>
            </h2>

            <p style={{
              fontSize: 18, lineHeight: 1.75, color: "#8a9a7a",
              maxWidth: 620, margin: "0 auto 40px",
            }}>
              Snap a few photos or a short video of your property, upload them right here,
              and we&apos;ll review everything and send back a detailed quote — usually within hours.
              No phone tag. No appointments. No guessing.
            </p>
          </div>
        </FadeIn>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20,
          marginBottom: 48,
        }} className="quote-steps-grid">
          {[
            { icon: "📸", step: "01", title: "Snap & Upload", desc: "Take photos or a quick video of your property straight from your phone — no special equipment needed." },
            { icon: "🔍", step: "02", title: "We Review", desc: "Our team reviews your media, assesses the scope of work, and prices out the job accurately." },
            { icon: "📋", step: "03", title: "Quote Delivered", desc: "A detailed quote lands in your inbox fast — usually the same day. Approve it and we schedule the work." },
          ].map(({ icon, step, title, desc }, i) => (
            <FadeIn key={i} delay={i * 0.12}>
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,215,0,0.12)",
                borderRadius: 16, padding: "32px 28px",
                transition: "border-color 0.3s, transform 0.3s",
                height: "100%",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,215,0,0.4)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,215,0,0.12)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <span style={{ fontSize: 36 }}>{icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,215,0,0.3)", letterSpacing: 2 }}>{step}</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#e8d8a0", marginBottom: 10, fontFamily: "'Playfair Display', serif" }}>{title}</div>
                <div style={{ fontSize: 14, color: "#7a8a6a", lineHeight: 1.65 }}>{desc}</div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.4}>
          <div style={{ textAlign: "center" }}>
            <Link href="/get-quote" style={{
              display: "inline-flex", alignItems: "center", gap: 12,
              background: "linear-gradient(135deg, #b8860b 0%, #ffd700 50%, #b8860b 100%)",
              backgroundSize: "200% 100%",
              color: "#0a0a00", fontWeight: 800, fontSize: 17,
              padding: "18px 44px", borderRadius: 60,
              textDecoration: "none", letterSpacing: 0.3,
              boxShadow: "0 8px 40px rgba(184,134,11,0.35), 0 0 80px rgba(255,215,0,0.08)",
              transition: "transform 0.2s, box-shadow 0.2s, background-position 0.4s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 14px 50px rgba(184,134,11,0.55), 0 0 100px rgba(255,215,0,0.12)"; (e.currentTarget as HTMLAnchorElement).style.backgroundPosition = "100% 0"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 8px 40px rgba(184,134,11,0.35), 0 0 80px rgba(255,215,0,0.08)"; (e.currentTarget as HTMLAnchorElement).style.backgroundPosition = "0% 0"; }}
            >
              <span style={{ fontSize: 20 }}>📹</span>
              Try Our Video Quote System
              <span style={{ fontSize: 18, opacity: 0.8 }}>→</span>
            </Link>
            <p style={{ marginTop: 14, fontSize: 13, color: "#5a6a4a", letterSpacing: 0.5 }}>
              Free · No commitment · Results in hours
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
