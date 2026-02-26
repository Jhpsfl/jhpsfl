"use client";

import { useState } from "react";

export default function CustomerModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const isValid = !!(form.name || form.email || form.phone);

  const inputStyle = {
    width: "100%", padding: "12px 14px", background: "#0d1a0d",
    border: "1px solid #1a3a1a", borderRadius: 10, color: "#e8f5e8",
    fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, backdropFilter: "blur(8px)", animation: "fadeIn 0.2s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0d1f0d, #091409)",
        border: "1px solid #1a3a1a", borderRadius: 20, padding: "32px 28px",
        maxWidth: 460, width: "100%", boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#e8f5e8", fontWeight: 700 }}>Add Customer</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <p style={{ color: "#5a8a5a", fontSize: 13, marginBottom: 24 }}>
          Add a customer from your own sources — referrals, calls, door-to-door, etc.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full name" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(407) 555-0000" inputMode="tel" style={inputStyle} />
          </div>
          <button onClick={() => {
            if (!isValid) return;
            const data: Record<string, unknown> = {};
            if (form.name) data.name = form.name;
            if (form.email) data.email = form.email;
            if (form.phone) data.phone = form.phone;
            onSave(data);
          }} style={{
            background: isValid ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "#1a3a1a",
            color: isValid ? "#fff" : "#3a5a3a",
            border: "none", padding: "14px", borderRadius: 12, fontSize: 15,
            fontWeight: 700, cursor: isValid ? "pointer" : "not-allowed",
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: isValid ? "0 4px 20px rgba(76,175,80,0.35)" : "none", marginTop: 4,
          }}>
            Add Customer
          </button>
        </div>
      </div>
    </div>
  );
}
