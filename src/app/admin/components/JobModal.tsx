"use client";

import { useState } from "react";
import type { Customer, Job } from "../AdminDashboard";

export default function JobModal({ onClose, onSave, customers, job }: {
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  customers: Customer[];
  job?: Job | null;
}) {
  const [form, setForm] = useState({
    customer_id: job?.customer_id || "",
    service_type: job?.service_type || "",
    description: job?.description || "",
    status: job?.status || "scheduled",
    scheduled_date: job?.scheduled_date || "",
    amount: job?.amount?.toString() || "",
    crew_notes: job?.crew_notes || "",
    admin_notes: job?.admin_notes || "",
  });

  const inputStyle = {
    width: "100%", padding: "14px 16px", background: "#0d1a0d",
    border: "1px solid #1a3a1a", borderRadius: 12, color: "#e8f5e8",
    fontSize: 16, outline: "none", fontFamily: "'DM Sans', sans-serif",
    minHeight: "52px",
    boxSizing: "border-box" as const,
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
        maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#e8f5e8", fontWeight: 700 }}>
            {job ? "Edit Job" : "Create Job"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!job && (
            <div>
              <label style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Customer *</label>
              <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || c.email || c.phone || "Unknown"}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Service Type *</label>
            <select value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })}
              style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              <option value="">Select service</option>
              <option value="Lawn Care">Lawn Care</option>
              <option value="Pressure Washing">Pressure Washing</option>
              <option value="Junk Removal">Junk Removal</option>
              <option value="Land Clearing">Land Clearing</option>
              <option value="Property Cleanup">Property Cleanup</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Date</label>
              <input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                style={{ ...inputStyle, colorScheme: "dark" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Amount ($)</label>
            <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, "") })}
              placeholder="0.00" inputMode="decimal" style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2} placeholder="Job details..." style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Crew Notes</label>
            <textarea value={form.crew_notes} onChange={(e) => setForm({ ...form, crew_notes: e.target.value })}
              rows={2} placeholder="Notes for the crew..." style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Admin Notes (internal)</label>
            <textarea value={form.admin_notes} onChange={(e) => setForm({ ...form, admin_notes: e.target.value })}
              rows={2} placeholder="Internal notes..." style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <button onClick={() => {
            if (!form.service_type || (!job && !form.customer_id)) return;
            const data: Record<string, unknown> = { ...form };
            if (form.amount) data.amount = parseFloat(form.amount);
            else delete data.amount;
            if (!form.scheduled_date) delete data.scheduled_date;
            if (job) data.id = job.id;
            onSave(data);
          }} style={{
            background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
            border: "none", padding: "14px", borderRadius: 12, fontSize: 15,
            fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            boxShadow: "0 4px 20px rgba(76,175,80,0.35)", marginTop: 4,
          }}>
            {job ? "Update Job" : "Create Job"}
          </button>
        </div>
      </div>
    </div>
  );
}
