"use client";

import React, { useState } from "react";
import type { Customer, Subscription } from "../AdminDashboard";

export default function SubscriptionModal({ onClose, onSave, customers, subscription }: {
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  customers: Customer[];
  subscription: Subscription | null;
}) {
  const [form, setForm] = useState({
    customer_id: subscription?.customer_id || "",
    plan_name: subscription?.plan_name || "",
    service_type: subscription?.service_type || "",
    frequency: subscription?.frequency || "monthly",
    amount: subscription ? String(subscription.amount) : "",
    billing_mode: subscription?.billing_mode || "manual",
    next_billing_date: subscription?.next_billing_date || "",
    notes: "",
  });

  const isValid = !!(form.customer_id && form.plan_name && form.service_type && form.frequency && form.amount && parseFloat(form.amount) > 0);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", background: "#0d1a0d",
    border: "1px solid #1a3a1a", borderRadius: 10, color: "#e8f5e8",
    fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: "#5a8a5a", fontWeight: 700,
    letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6,
  };

  return (
    <div className="JobModal" onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, backdropFilter: "blur(8px)", animation: "fadeIn 0.2s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0d1f0d, #091409)",
        border: "1px solid #1a3a1a", borderRadius: 20, padding: "32px 28px",
        maxWidth: 480, width: "100%", boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#e8f5e8", fontWeight: 700 }}>
            {subscription ? "Edit Subscription" : "New Subscription"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>Customer *</label>
            <select value={form.customer_id}
              onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
              disabled={!!subscription}
              style={{ ...inputStyle, appearance: "none", cursor: subscription ? "not-allowed" : "pointer", opacity: subscription ? 0.7 : 1 }}>
              <option value="">Select customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.email || c.phone || "Unknown"}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Plan Name *</label>
            <input placeholder="e.g. Weekly Lawn Care" value={form.plan_name}
              onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Service Type *</label>
            <input placeholder="e.g. Lawn Mowing" value={form.service_type}
              onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Frequency *</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Amount *</label>
              <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Billing Mode</label>
              <select value={form.billing_mode} onChange={e => setForm(f => ({ ...f, billing_mode: e.target.value }))}
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                <option value="manual">Manual</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Next Billing Date</label>
              <input type="date" value={form.next_billing_date}
                onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))}
                style={inputStyle} />
            </div>
          </div>
          <button
            onClick={() => {
              if (!isValid) return;
              onSave({
                customer_id: form.customer_id,
                plan_name: form.plan_name,
                service_type: form.service_type,
                frequency: form.frequency,
                amount: parseFloat(form.amount),
                billing_mode: form.billing_mode,
                next_billing_date: form.next_billing_date || null,
              });
            }}
            disabled={!isValid}
            style={{
              background: isValid ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "#1a3a1a",
              color: isValid ? "#fff" : "#5a8a5a",
              border: "none", borderRadius: 12, padding: "14px",
              fontSize: 15, fontWeight: 700, cursor: isValid ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans', sans-serif", marginTop: 4,
            }}
          >
            {subscription ? "Update Subscription" : "Create Subscription"}
          </button>
        </div>
      </div>
    </div>
  );
}
