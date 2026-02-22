"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function AccountPage() {
  const [scrollY, setScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const handleSubmit = () => {
    // Phase future: Connect to Clerk/Supabase auth
    // For now, show coming soon message
  };

  const inputStyle = {
    width: "100%", padding: "14px 16px", background: "#0d1a0d",
    border: "1px solid #1a3a1a", borderRadius: 12, color: "#e8f5e8",
    fontSize: 15, outline: "none", fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.3s, box-shadow 0.3s",
  };

  const labelStyle = {
    fontSize: 12, fontWeight: 600 as const, color: "#7a9a7a", letterSpacing: 1.5,
    textTransform: "uppercase" as const, marginBottom: 6, display: "block" as const,
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
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

        .nav-blur { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }

        .acct-input {
          width: 100%; padding: 14px 16px; background: #0d1a0d;
          border: 1px solid #1a3a1a; border-radius: 12px; color: #e8f5e8;
          font-size: 15px; outline: none; font-family: 'DM Sans', sans-serif;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .acct-input:focus { border-color: #4CAF50; box-shadow: 0 0 0 3px rgba(76,175,80,0.15); }
        .acct-input::placeholder { color: #3a5a3a; }

        .tab-btn {
          flex: 1; padding: 14px 20px; border: none; font-size: 15px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.3s;
          border-radius: 10px; background: transparent; color: #5a8a5a;
        }
        .tab-btn.active {
          background: linear-gradient(135deg, rgba(76,175,80,0.15), rgba(46,125,50,0.1));
          color: #4CAF50;
          box-shadow: inset 0 0 0 1px rgba(76,175,80,0.3);
        }

        .feature-card {
          background: linear-gradient(160deg, #0d1f0d, #091409);
          border: 1px solid #1a3a1a;
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          transition: transform 0.3s;
        }
        .feature-card:hover { transform: translateY(-4px); }

        .mobile-menu {
          position: fixed; inset: 0; z-index: 9997;
          background: rgba(5,14,5,0.98); backdrop-filter: blur(20px);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px;
          animation: fadeIn 0.3s ease;
        }
        .mobile-menu a { color: #e8f5e8; font-size: 28px; font-weight: 600; text-decoration: none; font-family: 'Playfair Display', serif; }

        .noise-overlay {
          position: fixed; inset: 0; pointer-events: none; z-index: 9990; opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-hamburger { display: flex !important; }
          .features-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="noise-overlay" />

      {/* ─── NAVIGATION ─── */}
      <nav className="nav-blur" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9996,
        background: "rgba(5,14,5,0.92)",
        borderBottom: "1px solid rgba(76,175,80,0.15)",
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jhps-nav-logo.svg" alt="JHPS Florida" style={{ maxWidth: 200, height: "auto", maxHeight: 44 }} />
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 28 }} className="desktop-nav">
            <Link href="/" style={{ color: "#8aba8a", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>← Home</Link>
            <Link href="/pay" style={{ color: "#8aba8a", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>Make Payment</Link>
            <a href="tel:4076869817" style={{
              background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
              padding: "10px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none",
            }}>📞 Call Us</a>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            display: "none", background: "none", border: "none", cursor: "pointer",
            flexDirection: "column", gap: 5, padding: 8,
          }} className="mobile-hamburger">
            <span style={{ width: 24, height: 2, background: "#4CAF50", borderRadius: 2, display: "block" }} />
            <span style={{ width: 24, height: 2, background: "#4CAF50", borderRadius: 2, display: "block" }} />
            <span style={{ width: 24, height: 2, background: "#4CAF50", borderRadius: 2, display: "block" }} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="mobile-menu">
          <button onClick={() => setMenuOpen(false)} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", color: "#4CAF50", fontSize: 32, cursor: "pointer" }}>✕</button>
          <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/pay" onClick={() => setMenuOpen(false)}>Make Payment</Link>
          <a href="tel:4076869817">📞 407-686-9817</a>
        </div>
      )}

      {/* ─── MAIN ─── */}
      <main style={{ minHeight: "100vh", paddingTop: 72, background: "linear-gradient(170deg, #050e05 0%, #081808 40%, #050e05 100%)" }}>
        {/* Background */}
        <div style={{ position: "fixed", top: "15%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(76,175,80,0.04), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "fixed", bottom: "10%", left: "-10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(46,125,50,0.03), transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px 80px", position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 48, animation: "slideUp 0.6s ease" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px",
              background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.2)",
              borderRadius: 40, marginBottom: 20,
            }}>
              <span style={{ fontSize: 16 }}>👤</span>
              <span style={{ fontSize: 13, color: "#4CAF50", fontWeight: 600, letterSpacing: 1 }}>CUSTOMER PORTAL</span>
            </div>
            <h1 style={{
              fontFamily: "'Playfair Display', serif", fontSize: 42, fontWeight: 800,
              color: "#e8f5e8", lineHeight: 1.15, marginBottom: 12,
            }}>
              Your{" "}
              <span style={{
                background: "linear-gradient(135deg, #4CAF50, #81C784, #4CAF50)",
                backgroundSize: "200% 200%", animation: "gradientShift 4s ease infinite",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Account</span>
            </h1>
            <p style={{ color: "#7a9a7a", fontSize: 16, maxWidth: 480, margin: "0 auto" }}>
              Manage your services, view payment history, and track your property maintenance.
            </p>
          </div>

          {/* Login/Signup Card */}
          <div style={{ maxWidth: 460, margin: "0 auto 64px", animation: "slideUp 0.7s ease 0.1s both" }}>
            <div style={{
              background: "linear-gradient(160deg, #0d1f0d, #091409)",
              border: "1px solid #1a3a1a", borderRadius: 24, padding: "36px 32px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 28, background: "#080f08", borderRadius: 12, padding: 4 }}>
                <button className={`tab-btn ${activeTab === "login" ? "active" : ""}`} onClick={() => setActiveTab("login")}>Sign In</button>
                <button className={`tab-btn ${activeTab === "signup" ? "active" : ""}`} onClick={() => setActiveTab("signup")}>Create Account</button>
              </div>

              {/* Coming Soon Badge */}
              <div style={{
                padding: "16px 20px", background: "rgba(76,175,80,0.06)",
                border: "1px solid rgba(76,175,80,0.15)", borderRadius: 12, marginBottom: 24,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", background: "#4CAF50",
                  animation: "pulse 2s infinite", flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#4CAF50", marginBottom: 2 }}>Coming Soon</div>
                  <div style={{ fontSize: 12, color: "#5a8a5a", lineHeight: 1.5 }}>
                    Customer accounts are being built. You can{" "}
                    <Link href="/pay" style={{ color: "#4CAF50", textDecoration: "underline", textUnderlineOffset: 2 }}>make a payment</Link>{" "}
                    right now, or call us at{" "}
                    <a href="tel:4076869817" style={{ color: "#4CAF50", textDecoration: "none" }}>407-686-9817</a>.
                  </div>
                </div>
              </div>

              {/* Form Fields (visual, non-functional) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, opacity: 0.5, pointerEvents: "none" }}>
                {activeTab === "signup" && (
                  <>
                    <div>
                      <label style={labelStyle}>Full Name</label>
                      <input className="acct-input" placeholder="John Smith" value={name} readOnly />
                    </div>
                    <div>
                      <label style={labelStyle}>Phone</label>
                      <input className="acct-input" placeholder="(407) 555-0123" value={phone} readOnly />
                    </div>
                  </>
                )}
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input className="acct-input" placeholder="john@example.com" type="email" value={email} readOnly />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input className="acct-input" placeholder="••••••••" type="password" value={password} readOnly />
                </div>

                <button style={{
                  background: "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)",
                  color: "#fff", border: "none", padding: "16px", borderRadius: 12,
                  fontSize: 16, fontWeight: 700, cursor: "not-allowed", width: "100%",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {activeTab === "login" ? "Sign In" : "Create Account"}
                </button>
              </div>
            </div>
          </div>

          {/* What You'll Get Section */}
          <div style={{ textAlign: "center", marginBottom: 40, animation: "slideUp 0.8s ease 0.2s both" }}>
            <div style={{ fontSize: 13, letterSpacing: 3, color: "#4CAF50", marginBottom: 12, fontWeight: 600 }}>WHAT&apos;S COMING</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: "#e8f5e8", fontWeight: 700, marginBottom: 12 }}>
              Your Property Dashboard
            </h2>
            <p style={{ color: "#7a9a7a", fontSize: 15, maxWidth: 500, margin: "0 auto" }}>
              Everything you need to manage your property services in one place.
            </p>
          </div>

          <div className="features-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 60,
            animation: "slideUp 0.9s ease 0.3s both",
          }}>
            {[
              { icon: "📋", title: "Job History", desc: "View all past and upcoming service visits with details and photos." },
              { icon: "💰", title: "Payment History", desc: "Track every payment, download receipts, and manage billing." },
              { icon: "🔄", title: "Subscription Plans", desc: "Manage recurring services with easy plan changes and scheduling." },
              { icon: "🏠", title: "Property Profiles", desc: "Save multiple job sites with notes, photos, and service preferences." },
              { icon: "📊", title: "Monthly Statements", desc: "Detailed monthly breakdowns of all services and charges." },
              { icon: "💬", title: "Direct Messaging", desc: "Communicate with your service crew directly through the portal." },
            ].map((feature, i) => (
              <div key={i} className="feature-card">
                <div style={{ fontSize: 32, marginBottom: 12 }}>{feature.icon}</div>
                <h4 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: "#e8f5e8", fontWeight: 700, marginBottom: 8 }}>{feature.title}</h4>
                <p style={{ color: "#6a9a6a", fontSize: 13, lineHeight: 1.6 }}>{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ textAlign: "center", animation: "slideUp 1s ease 0.4s both" }}>
            <p style={{ color: "#5a8a5a", fontSize: 14, marginBottom: 16 }}>In the meantime, reach us directly:</p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="tel:4076869817" style={{
                background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
                padding: "14px 32px", borderRadius: 14, fontSize: 16, fontWeight: 700,
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
              }}>📞 407-686-9817</a>
              <Link href="/pay" style={{
                background: "transparent", color: "#4CAF50", border: "2px solid #2a5a2a",
                padding: "12px 28px", borderRadius: 14, fontSize: 16, fontWeight: 600,
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
              }}>💳 Make a Payment</Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: "#030a03", borderTop: "1px solid #1a3a1a", padding: "40px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jhps-nav-logo.svg" alt="JHPS" style={{ maxWidth: 160, height: "auto", maxHeight: 36, opacity: 0.7 }} />
          </Link>
          <div style={{ display: "flex", gap: 24 }}>
            <a href="tel:4076869817" style={{ color: "#4CAF50", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>📞 407-686-9817</a>
            <a href="mailto:Info@jhpsfl.com" style={{ color: "#4CAF50", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>✉️ Email</a>
          </div>
          <div style={{ color: "#2a4a2a", fontSize: 12, width: "100%", textAlign: "center", marginTop: 16 }}>
            © 2025 Jenkins Home & Property Solutions. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
