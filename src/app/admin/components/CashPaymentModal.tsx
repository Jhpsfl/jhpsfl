"use client";

import React, { useState } from "react";
import type { Customer, Job } from "../AdminDashboard";

export default function CashPaymentModal({ onClose, onSave, customers, jobs, preselectedCustomerId }: {
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  customers: Customer[];
  jobs: Job[];
  preselectedCustomerId?: string | null;
}) {
  const [form, setForm] = useState({ customer_id: preselectedCustomerId || "", amount: "", service: "", job_id: "", notes: "" });
  const [sendReceipt, setSendReceipt] = useState(!!preselectedCustomerId);
  const isValid = !!(form.customer_id && form.amount && parseFloat(form.amount) > 0);
  const selectedCustomer = customers.find(c => c.id === form.customer_id);
  const hasEmail = !!selectedCustomer?.email;

  const filteredJobs = form.customer_id
    ? jobs.filter(j => j.customer_id === form.customer_id && ["scheduled", "in_progress", "completed"].includes(j.status))
    : jobs.filter(j => ["scheduled", "in_progress", "completed"].includes(j.status));

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
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#e8f5e8", fontWeight: 700 }}>Record Cash Payment</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <p style={{ color: "#5a8a5a", fontSize: 13, marginBottom: 24 }}>
          Log an on-the-spot cash payment. It will appear in revenue and payment history.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Customer *</label>
            {preselectedCustomerId ? (
              <div style={{ ...inputStyle, color: "#4CAF50", fontWeight: 600, opacity: 0.8 }}>
                {selectedCustomer?.name || selectedCustomer?.email || "Selected Customer"}
              </div>
            ) : (
              <select value={form.customer_id}
                onChange={e => setForm(f => ({ ...f, customer_id: e.target.value, job_id: "" }))}
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                <option value="">Select customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.email || c.phone || "Unknown"}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label style={labelStyle}>Amount *</label>
            <input
              type="number" inputMode="decimal" min="0" step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Service Description (optional)</label>
            <input
              placeholder="e.g. Lawn mowing, pressure washing..."
              value={form.service}
              onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Linked Job (optional)</label>
            <select value={form.job_id}
              onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))}
              style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              <option value="">None</option>
              {filteredJobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.service_type}{j.scheduled_date ? ` — ${new Date(j.scheduled_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}{j.customers?.name ? ` (${j.customers.name})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <input
              placeholder="e.g. Paid on site"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={inputStyle}
            />
          </div>
          {/* Send receipt toggle */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 10, padding: "12px 14px",
          }}>
            <div>
              <div style={{ fontSize: 13, color: "#c8e0c8", fontWeight: 600 }}>Send PDF receipt to customer</div>
              {!hasEmail && form.customer_id && (
                <div style={{ fontSize: 11, color: "#5a6a5a", marginTop: 2 }}>No email on file for this customer</div>
              )}
              {hasEmail && (
                <div style={{ fontSize: 11, color: "#5a8a5a", marginTop: 2 }}>{selectedCustomer?.email}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSendReceipt(r => !r)}
              disabled={!hasEmail}
              style={{
                background: sendReceipt && hasEmail ? "rgba(76,175,80,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${sendReceipt && hasEmail ? "rgba(76,175,80,0.4)" : "#1a3a1a"}`,
                borderRadius: 8, padding: "6px 14px", fontSize: 12,
                color: sendReceipt && hasEmail ? "#4CAF50" : "#3a5a3a",
                cursor: hasEmail ? "pointer" : "not-allowed", fontWeight: 700,
              }}
            >
              {sendReceipt && hasEmail ? "ON" : "OFF"}
            </button>
          </div>
          <button onClick={() => {
            if (!isValid) return;
            onSave({
              customer_id: form.customer_id,
              amount: parseFloat(parseFloat(form.amount).toFixed(2)),
              payment_method: "cash",
              service: form.service || null,
              job_id: form.job_id || null,
              notes: form.notes || null,
              send_receipt: sendReceipt && hasEmail,
            });
          }} style={{
            background: isValid ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "#1a3a1a",
            color: isValid ? "#fff" : "#3a5a3a",
            border: "none", padding: "14px", borderRadius: 12, fontSize: 15,
            fontWeight: 700, cursor: isValid ? "pointer" : "not-allowed",
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: isValid ? "0 4px 20px rgba(76,175,80,0.35)" : "none", marginTop: 4,
          }}>
            {sendReceipt && hasEmail ? "Record & Send Receipt" : "Record Cash Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
