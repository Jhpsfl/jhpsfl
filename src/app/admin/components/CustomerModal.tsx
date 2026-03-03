"use client";

import { useState } from "react";

interface CustomerData {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  customer_type?: string;
  company_name?: string;
  nickname?: string;
  billing_address?: string;
  billing_city?: string;
  billing_zip?: string;
}

export default function CustomerModal({ onClose, onSave, editCustomer }: {
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  editCustomer?: CustomerData | null;
}) {
  const isEdit = !!editCustomer?.id;
  const [form, setForm] = useState({
    name: editCustomer?.name || "",
    email: editCustomer?.email || "",
    phone: editCustomer?.phone || "",
    address: editCustomer?.address || "",
    customer_type: editCustomer?.customer_type || "residential",
    company_name: editCustomer?.company_name || "",
    nickname: editCustomer?.nickname || "",
    billing_address: editCustomer?.billing_address || "",
    billing_city: editCustomer?.billing_city || "",
    billing_zip: editCustomer?.billing_zip || "",
  });
  const isValid = !!(form.name || form.email || form.phone || form.nickname);
  const isCommercial = form.customer_type === "commercial";

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", background: "#0d1a0d",
    border: "1px solid #1a3a1a", borderRadius: 10, color: "#e8f5e8",
    fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5,
    textTransform: "uppercase" as const, display: "block", marginBottom: 6,
  };

  const handleSubmit = () => {
    if (!isValid) return;
    const data: Record<string, unknown> = {};
    if (isEdit) data.id = editCustomer!.id;

    // Core fields
    if (form.name) data.name = form.name;
    else if (isEdit) data.name = null;
    if (form.email) data.email = form.email;
    else if (isEdit) data.email = null;
    if (form.phone) data.phone = form.phone;
    else if (isEdit) data.phone = null;
    if (form.address) data.address = form.address;
    else if (isEdit) data.address = null;

    // Commercial / enrichment fields
    data.customer_type = form.customer_type;
    if (form.company_name) data.company_name = form.company_name;
    else if (isEdit) data.company_name = null;
    if (form.nickname) data.nickname = form.nickname;
    else if (isEdit) data.nickname = null;
    if (form.billing_address) data.billing_address = form.billing_address;
    else if (isEdit) data.billing_address = null;
    if (form.billing_city) data.billing_city = form.billing_city;
    else if (isEdit) data.billing_city = null;
    if (form.billing_zip) data.billing_zip = form.billing_zip;
    else if (isEdit) data.billing_zip = null;

    onSave(data);
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
        maxWidth: 500, width: "100%", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#e8f5e8", fontWeight: 700 }}>
            {isEdit ? "Edit Customer" : "Add Customer"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <p style={{ color: "#5a8a5a", fontSize: 13, marginBottom: 20 }}>
          {isEdit ? "Update customer details. Changes apply everywhere — invoices, estimates, and contracts." : "Add a customer. Just a name or phone is enough — they'll fill in the rest when they pay."}
        </p>

        {/* Customer Type Toggle */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 10, overflow: "hidden", border: "1px solid #1a3a1a" }}>
          {(["residential", "commercial"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setForm({ ...form, customer_type: type })}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                textTransform: "uppercase", letterSpacing: 1,
                background: form.customer_type === type ? "#4CAF50" : "#0d1a0d",
                color: form.customer_type === type ? "#fff" : "#5a8a5a",
                transition: "all 0.2s ease",
              }}
            >
              {type === "residential" ? "🏠 Residential" : "🏢 Commercial"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Company — show for commercial */}
          {isCommercial && (
            <div>
              <label style={labelStyle}>Company Name</label>
              <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="e.g. Rounlimited" style={inputStyle} />
            </div>
          )}

          {/* Name + Nickname row */}
          <div style={{ display: "grid", gridTemplateColumns: isCommercial ? "1fr 1fr" : "1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>{isCommercial ? "Contact Name" : "Name"}</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name" style={inputStyle} />
            </div>
            {isCommercial && (
              <div>
                <label style={labelStyle}>Nickname</label>
                <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  placeholder="e.g. Jr" style={inputStyle} />
              </div>
            )}
          </div>

          {/* Email + Phone */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(407) 555-0000" inputMode="tel" style={inputStyle} />
            </div>
          </div>

          {/* Address */}
          <div>
            <label style={labelStyle}>{isCommercial ? "Service Address" : "Address"}</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="123 Main St, Deltona, FL 32725" style={inputStyle} />
          </div>

          {/* Billing — for commercial */}
          {isCommercial && (
            <>
              <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 16, marginTop: 4 }}>
                <label style={{ ...labelStyle, marginBottom: 12, fontSize: 12, color: "#4CAF50" }}>
                  📋 Billing Info <span style={{ color: "#3a5a3a", fontWeight: 400, fontSize: 10, textTransform: "none" as const }}>— optional, customer fills this at payment</span>
                </label>
              </div>
              <div>
                <label style={labelStyle}>Billing Address</label>
                <input value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })}
                  placeholder="Billing street address" style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input value={form.billing_city} onChange={(e) => setForm({ ...form, billing_city: e.target.value })}
                    placeholder="City" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Zip</label>
                  <input value={form.billing_zip} onChange={(e) => setForm({ ...form, billing_zip: e.target.value })}
                    placeholder="32725" style={inputStyle} />
                </div>
              </div>
            </>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} style={{
            background: isValid ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "#1a3a1a",
            color: isValid ? "#fff" : "#3a5a3a",
            border: "none", padding: "14px", borderRadius: 12, fontSize: 15,
            fontWeight: 700, cursor: isValid ? "pointer" : "not-allowed",
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: isValid ? "0 4px 20px rgba(76,175,80,0.35)" : "none", marginTop: 4,
          }}>
            {isEdit ? "Save Changes" : "Add Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}
