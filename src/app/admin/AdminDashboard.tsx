"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
  useAuth,
} from "@clerk/nextjs";
import AdminVideoLeads from "./AdminVideoLeads";
import AdminInbox from "./AdminInbox";
import AdminInvoices from "./AdminInvoices";

// ─── Types ───
interface Customer {
  id: string;
  clerk_user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  job_sites?: { count: number }[];
  jobs?: { count: number }[];
  payments?: { count: number }[];
}

interface JobSite {
  id: string;
  customer_id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  created_at: string;
}

interface Job {
  id: string;
  customer_id: string;
  job_site_id: string | null;
  service_type: string;
  description: string | null;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  amount: number | null;
  crew_notes: string | null;
  admin_notes: string | null;
  created_at: string;
  customers?: { name: string; phone: string; email: string };
}

interface Payment {
  id: string;
  customer_id: string;
  job_id: string | null;
  amount: number;
  status: string;
  square_payment_id: string | null;
  square_receipt_url: string | null;
  payment_method: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  customers?: { name: string; phone: string; email: string };
}

interface Subscription {
  id: string;
  customer_id: string;
  plan_name: string;
  service_type: string;
  frequency: string;
  amount: number;
  status: string;
  billing_mode: string;
  next_billing_date: string | null;
  customers?: { name: string; phone: string; email: string };
}

interface StoredCard {
  id: string;
  customer_id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
}

interface Invoice {
  id: string;
  customer_id: string;
  invoice_number: string | null;
  amount: number;
  status: string;
  due_date: string | null;
  paid_date: string | null;
  line_items: unknown;
  notes: string | null;
  created_at: string;
}

interface OverviewData {
  totalCustomers: number;
  activeJobs: number;
  completedJobs: number;
  activeSubscriptions: number;
  recentRevenue: number;
  recentPayments: Payment[];
}

interface CustomerDetail {
  customer: Customer;
  jobSites: JobSite[];
  jobs: Job[];
  payments: Payment[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  storedCards: StoredCard[];
}

type Tab = "overview" | "customers" | "jobs" | "payments" | "subscriptions" | "customer_detail" | "video_leads" | "messages" | "invoices";

// ─── Helpers ───
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatCurrency(n: number | null) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toFixed(2)}`;
}
function timeAgo(d: string) {
  const now = Date.now();
  const then = new Date(d).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; glow: string }> = {
    scheduled: { bg: "rgba(33,150,243,0.12)", text: "#42a5f5", glow: "rgba(33,150,243,0.2)" },
    in_progress: { bg: "rgba(255,167,38,0.12)", text: "#ffa726", glow: "rgba(255,167,38,0.2)" },
    completed: { bg: "rgba(76,175,80,0.12)", text: "#66bb6a", glow: "rgba(76,175,80,0.2)" },
    cancelled: { bg: "rgba(239,83,80,0.08)", text: "#ef5350", glow: "rgba(239,83,80,0.15)" },
    active: { bg: "rgba(76,175,80,0.12)", text: "#66bb6a", glow: "rgba(76,175,80,0.2)" },
    pending: { bg: "rgba(255,167,38,0.12)", text: "#ffa726", glow: "rgba(255,167,38,0.2)" },
    failed: { bg: "rgba(239,83,80,0.08)", text: "#ef5350", glow: "rgba(239,83,80,0.15)" },
    refunded: { bg: "rgba(156,39,176,0.1)", text: "#ba68c8", glow: "rgba(156,39,176,0.15)" },
    paused: { bg: "rgba(255,167,38,0.12)", text: "#ffa726", glow: "rgba(255,167,38,0.2)" },
    draft: { bg: "rgba(158,158,158,0.1)", text: "#9e9e9e", glow: "rgba(158,158,158,0.1)" },
    sent: { bg: "rgba(33,150,243,0.12)", text: "#42a5f5", glow: "rgba(33,150,243,0.2)" },
    paid: { bg: "rgba(76,175,80,0.12)", text: "#66bb6a", glow: "rgba(76,175,80,0.2)" },
    overdue: { bg: "rgba(239,83,80,0.08)", text: "#ef5350", glow: "rgba(239,83,80,0.15)" },
    new: { bg: "rgba(0,188,212,0.12)", text: "#26c6da", glow: "rgba(0,188,212,0.2)" },
  };
  const c = colors[status] || { bg: "rgba(255,255,255,0.06)", text: "#888", glow: "transparent" };
  return (
    <span style={{
      padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      letterSpacing: 0.8, textTransform: "uppercase",
      background: c.bg, color: c.text, boxShadow: `0 0 8px ${c.glow}`,
      whiteSpace: "nowrap",
    }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}


// ─── Data Table ───
function DataTable({ headers, children, emptyMessage = "No data yet" }: {
  headers: string[];
  children: React.ReactNode;
  emptyMessage?: string;
}) {
  const hasChildren = Array.isArray(children) ? children.filter(Boolean).length > 0 : !!children;
  return (
    <div style={{ overflowX: "auto", borderRadius: 16, border: "1px solid #1a3a1a" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif" }}>
        <thead>
          <tr style={{ background: "#0a160a" }}>
            {headers.map((h) => (
              <th key={h} style={{
                padding: "14px 16px", textAlign: "left", fontSize: 11,
                color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5,
                textTransform: "uppercase", borderBottom: "1px solid #1a3a1a",
                whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasChildren ? children : (
            <tr>
              <td colSpan={headers.length} style={{
                padding: "40px 16px", textAlign: "center", color: "#3a5a3a", fontSize: 14,
              }}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TableRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", transition: "background 0.2s" }}
      onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(76,175,80,0.04)"; }}
      onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {children}
    </tr>
  );
}

function Td({ children, mono, accent, style }: { children: React.ReactNode; mono?: boolean; accent?: boolean; style?: React.CSSProperties }) {
  return (
    <td style={{
      padding: "14px 16px", fontSize: 14, color: accent ? "#4CAF50" : "#c8e0c8",
      borderBottom: "1px solid #0d1a0d",
      fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
      fontWeight: mono ? 600 : 400, whiteSpace: "nowrap",
      ...style,
    }}>{children}</td>
  );
}

// ─── Create/Edit Job Modal ───
function JobModal({ onClose, onSave, customers, job }: {
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

// ─── Add Customer Modal ───
function CustomerModal({ onClose, onSave }: {
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

// ─── Record Cash Payment Modal ───
function SubscriptionModal({ onClose, onSave, customers, subscription }: {
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

function CashPaymentModal({ onClose, onSave, customers, jobs, preselectedCustomerId }: {
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
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#e8f5e8", fontWeight: 700 }}>💵 Record Cash Payment</h3>
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

// ─── Sidebar Nav Item ───
function NavItem({ icon, label, active, onClick, badge }: {
  icon: string; label: string; active: boolean; onClick: () => void; badge?: number;
}) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%",
      padding: "12px 16px", borderRadius: 12, border: "none",
      background: active ? "linear-gradient(135deg, rgba(76,175,80,0.15), rgba(46,125,50,0.08))" : "transparent",
      color: active ? "#4CAF50" : "#6a9a6a",
      fontSize: 14, fontWeight: active ? 700 : 500, cursor: "pointer",
      fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
      textAlign: "left", position: "relative",
    }}
    onMouseOver={(e) => { if (!active) e.currentTarget.style.background = "rgba(76,175,80,0.05)"; }}
    onMouseOut={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          marginLeft: "auto", background: "#4CAF50", color: "#fff",
          fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10,
          fontFamily: "'JetBrains Mono', monospace",
        }}>{badge}</span>
      )}
    </button>
  );
}

// ─── Main Admin Dashboard ───
export default function AdminDashboard() {
  const { userId } = useAuth();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  // Full navigation stack — used by back button handler; ref avoids stale closure
  const tabHistoryRef = useRef<Tab[]>(["overview"]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paidInvoices, setPaidInvoices] = useState<Invoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);
  const [pendingInvoiceCustomerId, setPendingInvoiceCustomerId] = useState<string | null>(null);

  // Subscription modal
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [chargingSubId, setChargingSubId] = useState<string | null>(null);

  // Modals
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashModalPreselectedCustomer, setCashModalPreselectedCustomer] = useState<string | null>(null);
  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState<{ id: string; name: string } | null>(null);

  // ─── Back-button refs for child components ───
  const inboxBackRef = useRef<(() => boolean) | null>(null);
  const videoLeadsBackRef = useRef<(() => boolean) | null>(null);
  const invoicesBackRef = useRef<(() => boolean) | null>(null);
  const invoiceCreateRef = useRef<((preselectedCustomerId?: string) => void) | null>(null);

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt: () => Promise<void> } | null>(null);
  const [installed, setInstalled] = useState(false);

  // iOS / standalone detection (computed once, stable)
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = typeof window !== "undefined" && (
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(window.navigator as any).standalone
  );
  const showIOSInstallHint = isIOS && !isStandalone;

  // Badge counts for push notifications
  const [badgeCounts, setBadgeCounts] = useState<{ unreadEmail: number; newLeads: number }>({
    unreadEmail: 0,
    newLeads: 0,
  });

  // Toasts
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    // Success auto-dismisses; errors stay until clicked
    if (type === "success") {
      toastTimeout.current = setTimeout(() => setToast(null), 4000);
    }
  }, []);

  // ─── API helper ───
  const adminFetch = useCallback(async (resource: string, customerId?: string) => {
    if (!userId) return null;
    const params = new URLSearchParams({ clerk_user_id: userId, resource });
    if (customerId) params.set("customer_id", customerId);
    const res = await fetch(`/api/admin/data?${params}`);
    if (res.status === 403) { setIsAdmin(false); setLoading(false); return null; }
    if (!res.ok) return null;
    setIsAdmin(true);
    return res.json();
  }, [userId]);

  const adminPost = useCallback(async (resource: string, action: string, payload: Record<string, unknown>) => {
    if (!userId) return null;
    const res = await fetch("/api/admin/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerk_user_id: userId, resource, action, payload }),
    });
    return res.json();
  }, [userId]);

  // ─── Gesture-based sentinel system ───
  // Chrome's History Manipulation Intervention marks pushState entries created
  // WITHOUT user activation (click/tap) as "skippable" — the hardware back button
  // skips ALL of them in one press. To prevent the TWA from closing, we ONLY push
  // sentinel entries during user gestures (which have activation and are non-skippable).
  const pushSentinel = useCallback(() => {
    const n = Date.now();
    window.history.pushState({ sentinel: true, n }, "", `/admin#nav${n}`);
  }, []);

  // Push 2 extra "buffer" sentinels on the very first user interaction.
  // Why 2: when the user backtracks all the way, the LAST sentinel's back press
  // lands on the initial /admin entry (no sentinel state) which our capture handler
  // ignores. We need 2 buffers so that after all nav sentinels are consumed:
  //   buffer-2 back → lands on buffer-1 (sentinel) → handler shows exit toast
  //   buffer-1 back → lands on initial (no sentinel) → Chrome closes TWA
  const firstInteractionDone = useRef(false);
  useEffect(() => {
    const handler = () => {
      if (!firstInteractionDone.current) {
        firstInteractionDone.current = true;
        pushSentinel(); // buffer 1 — has user activation
        pushSentinel(); // buffer 2 — has user activation
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [pushSentinel]);

  // ─── Load data based on active tab ───
  const loadTab = useCallback(async (tab: Tab) => {
    setLoading(true);
    try {
      switch (tab) {
        case "overview": {
          const [ovRes, custRes] = await Promise.all([
            adminFetch("overview"),
            adminFetch("customers"),
          ]);
          if (ovRes) setOverview(ovRes);
          if (custRes?.data) setCustomers(custRes.data);
          break;
        }
        case "customers": {
          const res = await adminFetch("customers");
          if (res?.data) setCustomers(res.data);
          break;
        }
        case "jobs": {
          const [jobRes, custRes] = await Promise.all([
            adminFetch("jobs"),
            adminFetch("customers"),
          ]);
          if (jobRes?.data) setJobs(jobRes.data);
          if (custRes?.data) setCustomers(custRes.data);
          break;
        }
        case "payments": {
          const [payRes, invRes] = await Promise.all([
            adminFetch("payments"),
            fetch(`/api/admin/data?${new URLSearchParams({ clerk_user_id: userId!, resource: "invoices", status: "paid" })}`).then(r => r.json()),
          ]);
          if (payRes?.data) setPayments(payRes.data);
          if (invRes?.data) setPaidInvoices(invRes.data);
          break;
        }
        case "subscriptions": {
          const res = await adminFetch("subscriptions");
          if (res?.data) setSubscriptions(res.data);
          break;
        }
      }
    } catch (err) {
      console.error("Load error:", err);
    }
    setLoading(false);
  }, [adminFetch]);

  const loadCustomerDetail = useCallback(async (customerId: string) => {
    pushSentinel(); // user-activated — non-skippable by Chrome
    setLoading(true);
    try {
      const res = await adminFetch("customer_detail", customerId);
      if (res) {
        setCustomerDetail(res);
        tabHistoryRef.current = [...tabHistoryRef.current, "customer_detail"];
        setActiveTab("customer_detail");
      }
    } catch (err) {
      console.error("Customer detail error:", err);
    }
    setLoading(false);
  }, [adminFetch, pushSentinel]);

  useEffect(() => {
    if (userId) loadTab("overview");
  }, [userId, loadTab]);

  useEffect(() => {
    if (userId && activeTab !== "customer_detail") loadTab(activeTab);
  }, [activeTab, userId, loadTab]);

  // ─── PWA install prompt ───
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { setInstalled(true); setInstallPrompt(null); });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // ─── Badge counts polling & push registration ───
  useEffect(() => {
    if (!userId) return;

    // Store clerk_user_id in localStorage for AdminSwRegistrar
    localStorage.setItem("jhps_admin_uid", userId);

    // Fetch badge counts
    const fetchBadgeCounts = async () => {
      try {
        const res = await fetch("/api/admin/badge-counts");
        if (res.ok) {
          const data = await res.json();
          setBadgeCounts(data);

          // Update PWA app badge icon
          if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
            const totalBadge = (data.unreadEmail || 0) + (data.newLeads || 0);
            if (totalBadge > 0) {
              (navigator as any).setAppBadge(totalBadge);
            } else {
              (navigator as any).clearAppBadge?.();
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch badge counts:", err);
      }
    };

    // Fetch immediately on mount
    fetchBadgeCounts();

    // Poll every 60 seconds
    const pollInterval = setInterval(fetchBadgeCounts, 60000);

    // Also refresh instantly when a push notification arrives
    const swMessageHandler = (event: MessageEvent) => {
      if (event.data?.type === "REFRESH_BADGES") fetchBadgeCounts();
    };
    navigator.serviceWorker?.addEventListener("message", swMessageHandler);

    return () => {
      clearInterval(pollInterval);
      navigator.serviceWorker?.removeEventListener("message", swMessageHandler);
    };
  }, [userId]);

  // ─── Exit-toast state ───
  const [showExitToast, setShowExitToast] = useState(false);
  const exitToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitToastActive = useRef(false);

  // ─── Stable popstate handler ref ───
  // Updated synchronously every render so the listener is never stale.
  // The listener itself is registered once (empty deps) via the ref indirection.
  const popstateHandlerRef = useRef<() => void>(() => {});

  // ─── Register popstate listener once, in CAPTURE phase ───
  // Capture phase runs before Next.js's bubble-phase router listener.
  // We check e.state.sentinel — if it's our entry, stop propagation so Next.js
  // never sees the event (prevents the brief flash/re-render Next.js causes).
  // Non-sentinel popstates (real Next.js navigations) are left alone.
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      if (!e.state?.sentinel) return; // not our entry — let Next.js handle it
      e.stopImmediatePropagation();   // block Next.js router from seeing this
      popstateHandlerRef.current();
    };
    window.addEventListener("popstate", handler, true); // true = capture phase
    return () => window.removeEventListener("popstate", handler, true);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  // ─── Job CRUD ───
  const handleSaveJob = async (data: Record<string, unknown>) => {
    const isEdit = !!data.id;
    const res = await adminPost("jobs", isEdit ? "update" : "create", data);
    if (res?.success || res?.data) {
      showToast(isEdit ? "Job updated" : "Job created");
      setShowJobModal(false);
      setEditingJob(null);
      loadTab("jobs");
    } else {
      showToast(res?.error || "Failed to save job", "error");
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!window.confirm("Delete this job? This cannot be undone.")) return;
    const res = await adminPost("jobs", "delete", { id: jobId });
    if (res?.success) {
      showToast("Job deleted");
      if (activeTab === "jobs") loadTab("jobs");
      else if (customerDetail) loadCustomerDetail(customerDetail.customer.id);
    } else {
      showToast(res?.error || "Failed to delete job", "error");
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm("Delete this payment record? This cannot be undone.")) return;
    const res = await adminPost("payments", "delete", { id: paymentId });
    if (res?.success) {
      showToast("Payment deleted");
      if (activeTab === "payments") loadTab("payments");
      if (customerDetail) loadCustomerDetail(customerDetail.customer.id);
      loadTab("overview");
    } else {
      showToast(res?.error || "Failed to delete payment", "error");
    }
  };

  const handleDeleteSubscription = async (subId: string) => {
    if (!window.confirm("Delete this subscription? This cannot be undone.")) return;
    const res = await adminPost("subscriptions", "delete", { id: subId });
    if (res?.success) {
      showToast("Subscription deleted");
      if (customerDetail) loadCustomerDetail(customerDetail.customer.id);
    } else {
      showToast(res?.error || "Failed to delete subscription", "error");
    }
  };

  const handleChargeNow = async (subId: string) => {
    setChargingSubId(subId);
    try {
      const res = await adminPost("subscriptions", "charge_now", { id: subId });
      if (res?.success) {
        showToast(`Payment processed! Next billing: ${res.nextBillingDate}`);
        loadTab("subscriptions");
        if (customerDetail) loadCustomerDetail(customerDetail.customer.id);
        loadTab("overview");
      } else {
        showToast(res?.error || "Charge failed", "error");
      }
    } catch {
      showToast("Charge failed unexpectedly", "error");
    }
    setChargingSubId(null);
  };

  const handleToggleBillingMode = async (sub: Subscription) => {
    const newMode = sub.billing_mode === "auto" ? "manual" : "auto";
    const res = await adminPost("subscriptions", "update", { id: sub.id, billing_mode: newMode });
    if (res?.success) {
      showToast(`Billing mode set to ${newMode}`);
      loadTab("subscriptions");
      if (customerDetail) loadCustomerDetail(customerDetail.customer.id);
    } else {
      showToast(res?.error || "Failed to update billing mode", "error");
    }
  };

  const handleToggleSubStatus = async (sub: Subscription) => {
    const newStatus = sub.status === "active" ? "paused" : "active";
    const res = await adminPost("subscriptions", "update", { id: sub.id, status: newStatus });
    if (res?.success) {
      showToast(`Subscription ${newStatus}`);
      loadTab("subscriptions");
      if (customerDetail) loadCustomerDetail(customerDetail.customer.id);
    } else {
      showToast(res?.error || "Failed to update status", "error");
    }
  };

  const handleSaveSubscription = async (data: Record<string, unknown>) => {
    const action = editingSub ? "update" : "create";
    const payload = editingSub ? { id: editingSub.id, ...data } : data;
    const res = await adminPost("subscriptions", action, payload);
    if (res?.success || res?.data) {
      showToast(editingSub ? "Subscription updated" : "Subscription created");
      setShowSubModal(false);
      setEditingSub(null);
      loadTab("subscriptions");
      loadTab("overview");
    } else {
      showToast(res?.error || `Failed to ${action} subscription`, "error");
    }
  };

  const handleDeleteCustomer = async () => {
    if (!confirmDeleteCustomer) return;
    const { id } = confirmDeleteCustomer;
    setConfirmDeleteCustomer(null);
    const res = await adminPost("customers", "delete", { id });
    if (res?.success) {
      showToast("Customer and all related records deleted");
      setActiveTab("customers");
      setCustomerDetail(null);
      loadTab("customers");
      loadTab("overview");
    } else {
      showToast(res?.error || "Failed to delete customer", "error");
    }
  };

  const handleSaveCustomer = async (data: Record<string, unknown>) => {
    const res = await adminPost("customers", "create", data);
    if (res?.success || res?.data) {
      showToast("Customer added");
      setShowCustomerModal(false);
      loadTab("customers");
    } else {
      showToast(res?.error || "Failed to add customer", "error");
    }
  };

  const handleSaveCashPayment = async (data: Record<string, unknown>) => {
    if (data.send_receipt) {
      // Use the cash-receipt route which records + generates + emails PDF
      const res = await fetch("/api/cash-receipt/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerk_user_id: userId, ...data }),
      }).then(r => r.json());
      if (res?.success) {
        showToast(res.receipt_sent ? "Cash payment recorded & receipt sent" : "Cash payment recorded (no email on file)");
        setShowCashModal(false);
        setCashModalPreselectedCustomer(null);
        loadTab("payments");
        loadTab("overview");
      } else {
        showToast(res?.error || "Failed to record payment", "error");
      }
    } else {
      const res = await adminPost("payments", "create", data);
      if (res?.success || res?.data) {
        showToast("Cash payment recorded");
        setShowCashModal(false);
        setCashModalPreselectedCustomer(null);
        loadTab("payments");
        loadTab("overview");
      } else {
        showToast(res?.error || "Failed to record payment", "error");
      }
    }
  };

  const handleUpdateJobStatus = async (jobId: string, status: string) => {
    const res = await adminPost("jobs", "update", { id: jobId, status, ...(status === "completed" ? { completed_date: new Date().toISOString().split("T")[0] } : {}) });
    if (res?.success || res?.data) {
      showToast(`Job marked ${status.replace("_", " ")}`);
      if (activeTab === "jobs") loadTab("jobs");
      else if (customerDetail) loadCustomerDetail(customerDetail.customer.id);
    }
  };

  // ─── Filter helpers ───
  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q));
  });

  const switchTab = (tab: Tab) => {
    pushSentinel(); // user-activated — non-skippable by Chrome
    tabHistoryRef.current = [...tabHistoryRef.current, tab];
    setActiveTab(tab);
    setCustomerDetail(null);
    setSidebarOpen(false);
    // Optimistically clear badge when user switches to that tab
    if (tab === "messages") {
      setBadgeCounts(prev => ({ ...prev, unreadEmail: 0 }));
    } else if (tab === "video_leads") {
      setBadgeCounts(prev => ({ ...prev, newLeads: 0 }));
    }
  };

  // ─── Soft back — called from the on-screen back button (iOS / no hardware back) ───
  // Same logic as the popstate handler but: called from a user gesture, no exit toast.
  const handleSoftBack = () => {
    if (showJobModal) { setShowJobModal(false); setEditingJob(null); return; }
    if (showCustomerModal) { setShowCustomerModal(false); return; }
    if (showCashModal) { setShowCashModal(false); return; }
    if (activeTab === "messages" && inboxBackRef.current?.()) return;
    if (activeTab === "video_leads" && videoLeadsBackRef.current?.()) return;
    if (activeTab === "invoices" && invoicesBackRef.current?.()) return;
    if (tabHistoryRef.current.length > 1) {
      const newHistory = tabHistoryRef.current.slice(0, -1);
      const dest = newHistory[newHistory.length - 1];
      tabHistoryRef.current = newHistory;
      setActiveTab(dest);
      if (dest !== "customer_detail") setCustomerDetail(null);
    }
  };
  const canSoftBack = activeTab !== "overview" || showJobModal || showCustomerModal || showCashModal;

  // ─── Update popstate handler every render (always fresh, never stale) ───
  popstateHandlerRef.current = () => {
    // NOTE: Do NOT push sentinels here. This handler runs inside a popstate event,
    // which has NO user activation. Chrome's History Manipulation Intervention would
    // mark any pushState entries from here as "skippable" — defeating the purpose.
    // Sentinels are only pushed during user gestures (switchTab, onNavigate, etc.).

    // P1: Close dashboard-level modals
    if (showJobModal) { setShowJobModal(false); setEditingJob(null); return; }
    if (showCustomerModal) { setShowCustomerModal(false); return; }
    if (showCashModal) { setShowCashModal(false); return; }

    // P2: Delegate to active child's back handler (updated synchronously — never null)
    if (activeTab === "messages" && inboxBackRef.current?.()) return;
    if (activeTab === "video_leads" && videoLeadsBackRef.current?.()) return;
    if (activeTab === "invoices" && invoicesBackRef.current?.()) return;

    // P3: Pop tab history — go back exactly one level
    if (tabHistoryRef.current.length > 1) {
      const newHistory = tabHistoryRef.current.slice(0, -1);
      const dest = newHistory[newHistory.length - 1];
      tabHistoryRef.current = newHistory;
      setActiveTab(dest);
      if (dest !== "customer_detail") setCustomerDetail(null);
      // Clear any pending exit toast since we navigated back
      if (exitToastActive.current) {
        exitToastActive.current = false;
        setShowExitToast(false);
        if (exitToastTimer.current) { clearTimeout(exitToastTimer.current); exitToastTimer.current = null; }
      }
      return;
    }

    // P4: At root — show "press back again to exit" toast
    if (exitToastActive.current) {
      // Second press within window — dismiss toast (TWA will handle close via sentinel depletion)
      exitToastActive.current = false;
      setShowExitToast(false);
      if (exitToastTimer.current) { clearTimeout(exitToastTimer.current); exitToastTimer.current = null; }
      return;
    }
    exitToastActive.current = true;
    setShowExitToast(true);
    exitToastTimer.current = setTimeout(() => {
      exitToastActive.current = false;
      setShowExitToast(false);
      exitToastTimer.current = null;
    }, 2500);
  };

  // ─── RENDER ───
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Playfair+Display:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: #050e05; color: #c8e0c8; overflow-x: hidden; max-width: 100vw; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: none; } }

        .admin-layout { display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; }
        .admin-sidebar {
          background: linear-gradient(180deg, #071207 0%, #050e05 100%);
          border-right: 1px solid #1a3a1a;
          padding: 24px 16px;
          padding-top: max(24px, calc(env(safe-area-inset-top, 0px) + 16px));
          position: fixed; top: 0; left: 0; bottom: 0; width: 260px;
          display: flex; flex-direction: column; z-index: 100;
          overflow-y: auto;
        }
        .admin-main { margin-left: 260px; min-height: 100vh; overflow-x: hidden; }
        .admin-content-inner { padding: 16px; max-width: 1400px; }

        .search-input {
          width: 100%; padding: 10px 14px 10px 36px; background: #0a160a;
          border: 1px solid #1a3a1a; border-radius: 10px; color: #e8f5e8;
          font-size: 14px; outline: none; font-family: 'DM Sans', sans-serif;
          transition: border-color 0.3s;
        }
        .search-input:focus { border-color: #4CAF50; }
        .search-input::placeholder { color: #3a5a3a; }

        .action-btn {
          padding: 8px 16px; border-radius: 10px; border: none;
          font-size: 13px; font-weight: 600; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: all 0.2s;
          display: inline-flex; align-items: center; gap: 6px;
        }
        .action-btn-primary {
          background: linear-gradient(135deg, #4CAF50, #2E7D32);
          color: #fff; box-shadow: 0 2px 12px rgba(76,175,80,0.3);
        }
        .action-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(76,175,80,0.4); }
        .action-btn-ghost {
          background: transparent; color: #4CAF50; border: 1px solid #1a3a1a;
        }
        .action-btn-ghost:hover { background: rgba(76,175,80,0.08); border-color: #4CAF50; }

        .quick-action {
          padding: 4px 10px; border-radius: 6px; border: 1px solid #1a3a1a;
          background: transparent; color: #5a8a5a; font-size: 11px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.2s;
        }
        .quick-action:hover { background: rgba(76,175,80,0.1); color: #4CAF50; border-color: #4CAF50; }
        .quick-action-danger { color: "#ef5350"; border-color: rgba(239,83,80,0.2); }
        .quick-action-danger:hover { background: rgba(239,83,80,0.1) !important; color: "#ef5350" !important; border-color: "#ef5350" !important; }

        .mobile-toggle {
          display: none; position: fixed;
          top: calc(env(safe-area-inset-top, 0px) + 12px);
          left: 16px; z-index: 200;
          background: rgba(5,14,5,0.95); border: 1px solid #1a3a1a;
          border-radius: 10px; padding: 10px 14px; cursor: pointer;
          color: #4CAF50; font-size: 20px;
        }
        .mobile-back-btn {
          display: none; position: fixed;
          top: calc(env(safe-area-inset-top, 0px) + 14px);
          left: 78px; z-index: 200;
          background: rgba(5,14,5,0.85);
          border: 1px solid rgba(76,175,80,0.3);
          border-radius: 20px; padding: 7px 14px 7px 10px;
          cursor: pointer; color: #4CAF50;
          font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          align-items: center; gap: 5px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: all 0.2s;
          box-shadow: 0 2px 12px rgba(0,0,0,0.3);
        }
        .mobile-back-btn:active {
          transform: scale(0.95);
          background: rgba(76,175,80,0.12);
        }
        .mobile-overlay {
          display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          z-index: 99;
        }

        /* ── High-Density Mobile Styles ── */
        @media (max-width: 900px) {
          .admin-layout { grid-template-columns: 1fr; }
          .admin-sidebar {
            transform: translateX(-100%);
            width: 280px;
          }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-main { margin-left: 0; }
          .admin-content-inner {
            padding: 16px;
            /* Push content below hamburger button + iOS safe area */
            padding-top: calc(env(safe-area-inset-top, 0px) + 68px) !important;
          }
          .mobile-toggle { display: flex; }
          .mobile-back-btn { display: flex; }
          .mobile-overlay.open { display: block; }
          
          /* Compact tables */
          .admin-content-inner table th { 
            padding: 8px 6px !important; 
            font-size: 10px !important; 
          }
          .admin-content-inner table td { 
            padding: 8px 6px !important; 
            font-size: 11px !important; 
          }
          
          /* Navigation Grid - 2 columns on very small screens */
          @media (max-width: 480px) {
            .navigation-grid { grid-template-columns: repeat(2, 1fr) !important; }
          }
        }

        /* Remove all touch target size increases - keep compact */
        button, [role="button"], .action-btn, .quick-action {
          min-height: 32px !important;
          padding: 6px 10px !important;
        }

        /* High-density mobile styles */
        .admin-content-inner h1 { font-size: 18px !important; }
        .admin-content-inner h2 { font-size: 16px !important; }
        .admin-content-inner h3 { font-size: 12px !important; }
        .admin-content-inner p, .admin-content-inner td { font-size: 11px !important; }
        .action-btn { font-size: 11px !important; padding: 6px 10px !important; }
        .quick-action { font-size: 9px !important; padding: 4px 6px !important; }
        
        /* Compact tables for high density */
        .admin-content-inner table th { 
            padding: 6px 4px !important; 
            font-size: 9px !important; 
        }
        .admin-content-inner table td { 
            padding: 6px 4px !important; 
            font-size: 10px !important; 
        }
        
        /* High-density navigation */
        .navigation-grid { 
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 4px !important;
        }
        
        /* Compact form elements */
        input, select, textarea {
            font-size: 14px !important;
            padding: 8px 10px !important;
            min-height: 40px !important;
        }
        
        /* Mobile bottom nav adjustments */
        @media (max-width: 900px) {
            .mobile-bottom-nav button {
                min-height: 56px !important;
                padding: 4px 2px !important;
                font-size: 10px !important;
            }
            .mobile-bottom-nav span:first-child {
                font-size: 18px !important;
            }
        }
        
        /* ── Mobile sidebar touch improvements ── */
        .admin-sidebar {
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }
        
        /* ── Enhanced mobile table touch ── */
        .table-row {
          position: relative;
        }
        .table-row::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 16px;
          right: 16px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #1a3a1a, transparent);
        }
        
        /* ── Mobile status badges ── */
        .mobile-status-badge {
          padding: 8px 16px !important;
          font-size: 12px !important;
          min-height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        /* ── Improve touch scrolling ── */
        .admin-sidebar,
        .admin-content-inner,
        .modal-content {
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }

        /* ── Prevent text size adjustment on orientation change ── */
        html {
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 10000,
          maxWidth: "min(420px, calc(100vw - 40px)",
          padding: "14px 16px 14px 20px", borderRadius: 12,
          background: toast.type === "success" ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "linear-gradient(135deg, #c62828, #8b0000)",
          color: "#fff", fontSize: 14, fontWeight: 600,
          boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          animation: "toastIn 0.3s ease",
          display: "flex", alignItems: "flex-start", gap: 10,
          cursor: "pointer",
        }} onClick={() => { if (toastTimeout.current) clearTimeout(toastTimeout.current); setToast(null); }}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{toast.type === "success" ? "✓" : "⚠"}</span>
          <span style={{ flex: 1, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{toast.message}</span>
          <span style={{ fontSize: 18, opacity: 0.7, flexShrink: 0, lineHeight: 1, marginTop: -1, marginLeft: 4 }}>✕</span>
        </div>
      )}

      <SignedOut>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050e05" }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: "#e8f5e8", marginBottom: 16 }}>Admin Access Required</h1>
            <p style={{ color: "#5a8a5a", marginBottom: 24 }}>Please sign in with an admin account.</p>
            <Link href="/sign-in" style={{
              background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
              padding: "14px 32px", borderRadius: 12, textDecoration: "none", fontWeight: 700,
            }}>Sign In</Link>
          </div>
        </main>
      </SignedOut>

      <SignedIn>
        {isAdmin === false && (
          <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050e05" }}>
            <div style={{ textAlign: "center", maxWidth: 400 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", marginBottom: 12 }}>Access Denied</h1>
              <p style={{ color: "#5a8a5a", marginBottom: 24 }}>Your account does not have admin privileges. Contact the business owner to request access.</p>
              <Link href="/" style={{ color: "#4CAF50", textDecoration: "underline", textUnderlineOffset: 3 }}>← Back to Home</Link>
            </div>
          </main>
        )}

        {isAdmin !== false && (
          <>
            {/* Enhanced Mobile Toggle Button */}
            <button 
              className="mobile-toggle" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 6px 25px rgba(76,175,80,0.3)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
              }}
            >
              {sidebarOpen ? (
                <span style={{ 
                  fontSize: "26px", 
                  lineHeight: 1,
                  transition: "transform 0.3s",
                  display: "inline-block",
                  transform: "rotate(90deg)"
                }}>✕</span>
              ) : (
                <span style={{ 
                  fontSize: "26px", 
                  lineHeight: 1,
                  transition: "transform 0.3s",
                  display: "inline-block"
                }}>☰</span>
              )}
            </button>
            {/* Soft Back Button — iOS / no hardware back */}
            {canSoftBack && (
              <button
                className="mobile-back-btn"
                onClick={handleSoftBack}
                aria-label="Go back"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M9 2L4 7L9 12" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back
              </button>
            )}

            <div
              className={`mobile-overlay ${sidebarOpen ? "open" : ""}`}
              onClick={() => setSidebarOpen(false)}
              role="button"
              tabIndex={0}
              aria-label="Close menu"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSidebarOpen(false);
                }
              }}
              style={{
                transition: "opacity 0.3s ease"
              }}
            />

            <div className="admin-layout">
              {/* ─── SIDEBAR ─── */}
              <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
                <Link href="/" style={{ textDecoration: "none", marginBottom: 8, display: "block" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/jhps-nav-logo.svg" alt="JHPS" style={{ maxWidth: 180, height: "auto", maxHeight: 40 }} />
                </Link>
                <div style={{
                  padding: "6px 12px", background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.2)",
                  borderRadius: 8, marginBottom: 24, fontSize: 11, color: "#4CAF50", fontWeight: 700, letterSpacing: 1,
                  textAlign: "center",
                }}>ADMIN DASHBOARD</div>

                <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <NavItem icon="📊" label="Overview" active={activeTab === "overview"} onClick={() => switchTab("overview")} />
                  <NavItem icon="👥" label="Customers" active={activeTab === "customers"} onClick={() => switchTab("customers")} badge={customers.length} />
                  <NavItem icon="🔧" label="Jobs" active={activeTab === "jobs"} onClick={() => switchTab("jobs")} />
                  <NavItem icon="💰" label="Payments" active={activeTab === "payments"} onClick={() => switchTab("payments")} />
                  <NavItem icon="🔄" label="Subscriptions" active={activeTab === "subscriptions"} onClick={() => switchTab("subscriptions")} />
                  <NavItem icon="📹" label="Video Quotes" active={activeTab === "video_leads"} onClick={() => switchTab("video_leads")} badge={badgeCounts.newLeads} />
                  <NavItem icon="✉️" label="Messages" active={activeTab === "messages"} onClick={() => switchTab("messages")} badge={badgeCounts.unreadEmail} />

                  <NavItem icon="📄" label="Invoices" active={activeTab === "invoices"} onClick={() => switchTab("invoices")} />

                  <div style={{ borderTop: "1px solid #1a3a1a", margin: "16px 0" }} />

                  <div style={{ fontSize: 10, color: "#2a4a2a", letterSpacing: 2, padding: "0 16px", marginBottom: 8, fontWeight: 700 }}>COMING SOON</div>
                  <NavItem icon="📈" label="Analytics" active={false} onClick={() => showToast("Analytics coming soon", "error")} />
                </nav>

                {/* ─── Install App button ─── */}
                {installPrompt && !installed && (
                  <button
                    onClick={handleInstall}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "10px 14px", marginBottom: 8,
                      background: "linear-gradient(135deg, rgba(76,175,80,0.18), rgba(46,125,50,0.1))",
                      border: "1px solid rgba(76,175,80,0.35)", borderRadius: 12,
                      color: "#4CAF50", fontSize: 13, fontWeight: 700, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = "linear-gradient(135deg, rgba(76,175,80,0.28), rgba(46,125,50,0.18))")}
                    onMouseOut={e => (e.currentTarget.style.background = "linear-gradient(135deg, rgba(76,175,80,0.18), rgba(46,125,50,0.1))")}
                  >
                    <span style={{ fontSize: 18 }}>📲</span>
                    <div style={{ textAlign: "left" }}>
                      <div>Install App</div>
                      <div style={{ fontSize: 10, color: "#3a6a3a", fontWeight: 400 }}>Add to home screen</div>
                    </div>
                  </button>
                )}
                {installed && (
                  <div style={{ padding: "8px 14px", marginBottom: 8, fontSize: 12, color: "#4CAF50" }}>
                    ✓ App installed
                  </div>
                )}

                {/* ─── iOS install hint (Safari only) ─── */}
                {showIOSInstallHint && (
                  <div style={{
                    padding: "10px 14px", marginBottom: 8,
                    background: "linear-gradient(135deg, rgba(33,150,243,0.12), rgba(13,125,205,0.07))",
                    border: "1px solid rgba(33,150,243,0.3)", borderRadius: 12,
                    fontSize: 12, color: "#64b5f6", lineHeight: 1.5,
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>📲 iPhone: Install for Notifications</div>
                    <div style={{ color: "#4a8fc4" }}>
                      Safari → <strong style={{ color: "#64b5f6" }}>Share ⬆</strong> → <strong style={{ color: "#64b5f6" }}>Add to Home Screen</strong>
                    </div>
                    <div style={{ marginTop: 4, color: "#3a6a9a", fontSize: 11 }}>Requires iOS 16.4+ · Safari only</div>
                  </div>
                )}

                {/* ─── Enable Notifications button ─── */}
                {typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted" && (
                  <button
                    onClick={() => {
                      const enableFn = (window as any).__enablePushNotifications;
                      if (enableFn) enableFn();
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "10px 14px", marginBottom: 8,
                      background: "linear-gradient(135deg, rgba(33,150,243,0.18), rgba(13,125,205,0.1))",
                      border: "1px solid rgba(33,150,243,0.35)", borderRadius: 12,
                      color: "#42a5f5", fontSize: 13, fontWeight: 700, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = "linear-gradient(135deg, rgba(33,150,243,0.28), rgba(13,125,205,0.18))")}
                    onMouseOut={e => (e.currentTarget.style.background = "linear-gradient(135deg, rgba(33,150,243,0.18), rgba(13,125,205,0.1))")}
                  >
                    <span style={{ fontSize: 18 }}>🔔</span>
                    <div style={{ textAlign: "left" }}>
                      <div>Enable Notifications</div>
                      <div style={{ fontSize: 10, color: "#2a6aab", fontWeight: 400 }}>Get lead & email alerts</div>
                    </div>
                  </button>
                )}
                {typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" && (
                  <button
                    onClick={() => {
                      const enableFn = (window as any).__enablePushNotifications;
                      if (enableFn) {
                        console.log("Retrying push subscription...");
                        enableFn();
                      }
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "10px 14px", marginBottom: 8,
                      background: "linear-gradient(135deg, rgba(76,175,80,0.18), rgba(46,125,50,0.1))",
                      border: "1px solid rgba(76,175,80,0.35)", borderRadius: 12,
                      color: "#4CAF50", fontSize: 13, fontWeight: 700, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = "linear-gradient(135deg, rgba(76,175,80,0.28), rgba(46,125,50,0.18))")}
                    onMouseOut={e => (e.currentTarget.style.background = "linear-gradient(135deg, rgba(76,175,80,0.18), rgba(46,125,50,0.1))")}
                  >
                    <span style={{ fontSize: 18 }}>✓</span>
                    <div style={{ textAlign: "left" }}>
                      <div>Notifications granted</div>
                      <div style={{ fontSize: 10, color: "#3a6a3a", fontWeight: 400 }}>Click to verify subscription</div>
                    </div>
                  </button>
                )}

                <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 16, marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px" }}>
                    <UserButton appearance={{ elements: { avatarBox: { width: 36, height: 36 } } }} />
                    <div>
                      <div style={{ fontSize: 13, color: "#e8f5e8", fontWeight: 600 }}>{user?.fullName || "Admin"}</div>
                      <div style={{ fontSize: 11, color: "#3a5a3a" }}>Super Admin</div>
                    </div>
                  </div>
                </div>
              </aside>

              {/* ─── MAIN CONTENT ─── */}
              <main className="admin-main" style={{ background: "linear-gradient(170deg, #050e05, #081808, #050e05)" }}>
                <div className="admin-content-inner" style={{ padding: "16px" }}>
                {loading && isAdmin === null ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                    <div style={{ textAlign: "center", color: "#3a5a3a" }}>
                      <div style={{ fontSize: 40, marginBottom: 12, animation: "fadeIn 1s infinite alternate" }}>🌿</div>
                      <p>Loading admin dashboard...</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ maxWidth: 1200, animation: "fadeIn 0.4s ease" }}>
                    {/* ─── OVERVIEW TAB ─── */}
                    {activeTab === "overview" && overview && (
                      <>
                        {/* ── Top bar: greeting ── */}
                        <div style={{ marginBottom: 16 }}>
                          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#e8f5e8", fontWeight: 800, marginBottom: 4 }}>
                            Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
                          </h1>
                          <p style={{ color: "#5a8a5a", fontSize: 12 }}>Here&apos;s what&apos;s happening with your business.</p>
                        </div>

                        {/* High-density Stats Ticker */}
                        <div style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "6px 10px", background: "#0a160a", border: "1px solid #1a3a1a",
                          borderRadius: 6, marginBottom: 8, fontSize: 10, color: "#5a8a5a",
                          fontWeight: 600, letterSpacing: 0.3,
                        }}>
                          <div style={{ display: "flex", gap: 12 }}>
                            <span>👥 {overview?.totalCustomers || 0}</span>
                            <span>🔧 {overview?.activeJobs || 0}</span>
                            <span>✅ {overview?.completedJobs || 0}</span>
                            <span>🔄 {overview?.activeSubscriptions || 0}</span>
                          </div>
                          <div style={{ color: "#4CAF50", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                            💰 {formatCurrency(overview?.recentRevenue || 0)}
                          </div>
                        </div>

                        {/* Quick-Action Split Bar */}
                        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                          {[
                            { label: "New Job", onClick: () => { pushSentinel(); setEditingJob(null); setShowJobModal(true); } },
                            { label: "Invoices", onClick: () => { pushSentinel(); switchTab("invoices"); } },
                            { label: "New Customer", onClick: () => { pushSentinel(); setShowCustomerModal(true); } },
                          ].map((btn, i) => (
                            <button
                              key={btn.label}
                              onClick={btn.onClick}
                              style={{
                                flex: 1, padding: "6px 4px",
                                background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                                border: "none",
                                borderRadius: i === 0 ? "6px 0 0 6px" : i === 2 ? "0 6px 6px 0" : 0,
                                borderRight: i < 2 ? "1px solid rgba(0,0,0,0.25)" : "none",
                                color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer",
                                fontFamily: "'DM Sans', sans-serif",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                              }}
                            >
                              <span style={{ fontSize: 11 }}>+</span> {btn.label}
                            </button>
                          ))}
                        </div>

                        {/* High-density Navigation Grid */}
                        <div style={{
                          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6,
                          marginBottom: 16,
                        }}>
                          {[
                            { icon: "✉️", label: "Messages", tab: "messages", badge: badgeCounts.unreadEmail },
                            { icon: "📹", label: "Video", tab: "video_leads", badge: badgeCounts.newLeads },
                            { icon: "💰", label: "Payments", tab: "payments", badge: 0 },
                            { icon: "🔄", label: "Subs", tab: "subscriptions", badge: 0 },
                            { icon: "🔧", label: "Jobs", tab: "jobs", badge: 0 },
                            { icon: "👥", label: "Customers", tab: "customers", badge: 0 },
                          ].map((item) => (
                            <button
                              key={item.tab}
                              onClick={() => switchTab(item.tab as Tab)}
                              style={{
                                position: "relative",
                                display: "flex", flexDirection: "column", alignItems: "center",
                                padding: "8px 4px", background: item.badge > 0
                                  ? "linear-gradient(160deg, rgba(76,175,80,0.12), rgba(46,125,50,0.06))"
                                  : "linear-gradient(160deg, #0d1f0d, #091409)",
                                border: item.badge > 0 ? "1px solid rgba(76,175,80,0.4)" : "1px solid #1a3a1a",
                                borderRadius: 8, color: "#c8e0c8",
                                fontSize: 10, fontWeight: 600, cursor: "pointer",
                                transition: "all 0.2s", minHeight: 60,
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = "linear-gradient(160deg, rgba(76,175,80,0.15), rgba(46,125,50,0.08))";
                                e.currentTarget.style.borderColor = "#4CAF50";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = item.badge > 0
                                  ? "linear-gradient(160deg, rgba(76,175,80,0.12), rgba(46,125,50,0.06))"
                                  : "linear-gradient(160deg, #0d1f0d, #091409)";
                                e.currentTarget.style.borderColor = item.badge > 0 ? "rgba(76,175,80,0.4)" : "#1a3a1a";
                              }}
                            >
                              {item.badge > 0 && (
                                <span style={{
                                  position: "absolute", top: 4, right: 4,
                                  background: "#ef5350", color: "#fff",
                                  fontSize: 9, fontWeight: 800, lineHeight: 1,
                                  padding: "2px 5px", borderRadius: 10,
                                  fontFamily: "'JetBrains Mono', monospace",
                                }}>{item.badge}</span>
                              )}
                              <span style={{ fontSize: 16, marginBottom: 4 }}>{item.icon}</span>
                              <span style={{ fontSize: 9 }}>{item.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* ── Recent customers ── */}
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <h3 style={{ fontSize: 12, color: "#e8f5e8", fontWeight: 700 }}>Recent Customers</h3>
                            <button className="quick-action" onClick={() => switchTab("customers")} style={{ fontSize: 10, padding: "4px 8px" }}>View all →</button>
                          </div>
                          <DataTable headers={["Name", "Email", "Phone", "Joined"]} emptyMessage="No customers yet. Share your site to get signups!">
                            {customers.slice(0, 5).map((c) => (
                              <TableRow key={c.id} onClick={() => loadCustomerDetail(c.id)}>
                                <Td style={{ fontSize: 11 }}>{c.name || "—"}</Td>
                                <Td style={{ fontSize: 11 }}>{c.email || "—"}</Td>
                                <Td mono style={{ fontSize: 11 }}>{c.phone || "—"}</Td>
                                <Td style={{ fontSize: 11 }}>{timeAgo(c.created_at)}</Td>
                              </TableRow>
                            ))}
                          </DataTable>
                        </div>

                        {/* ── Recent payments ── */}
                        {overview.recentPayments.length > 0 && (
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <h3 style={{ fontSize: 12, color: "#e8f5e8", fontWeight: 700 }}>Recent Payments</h3>
                              <button className="quick-action" onClick={() => switchTab("payments")} style={{ fontSize: 10, padding: "4px 8px" }}>View all →</button>
                            </div>
                            <DataTable headers={["Amount", "Status", "Date"]}>
                              {overview.recentPayments.map((p, i) => (
                                <TableRow key={i}>
                                  <Td mono accent style={{ fontSize: 11 }}>{formatCurrency(p.amount)}</Td>
                                  <Td style={{ fontSize: 11 }}><StatusBadge status={p.status} /></Td>
                                  <Td style={{ fontSize: 11 }}>{formatDate(p.created_at)}</Td>
                                </TableRow>
                              ))}
                            </DataTable>
                          </div>
                        )}
                      </>
                    )}

                    {/* ─── CUSTOMERS TAB ─── */}
                    {activeTab === "customers" && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 800 }}>
                              Customers
                            </h1>
                            <button className="action-btn action-btn-primary" onClick={() => { pushSentinel(); setShowCustomerModal(true); }}>
                              + Add Customer
                            </button>
                          </div>
                          <div style={{ position: "relative", flex: "1 1 300px", maxWidth: "100%" }}>
                            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#3a5a3a", fontSize: 16, zIndex: 1 }}>🔍</span>
                            <input className="search-input" placeholder="Search customers..."
                              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                              style={{ width: "100%", paddingLeft: "42px" }} />
                          </div>
                        </div>
                        
                        {/* Mobile stacked table view */}
                        <div className="mobile-force-stack">
                          <div className="mobile-stacked-table" style={{ display: "none" }}>
                            {filteredCustomers.length === 0 ? (
                              <div style={{ padding: "40px 16px", textAlign: "center", color: "#3a5a3a", fontSize: 14 }}>
                                No customers found
                              </div>
                            ) : (
                              filteredCustomers.map((c) => (
                                <div key={c.id} className="table-row" onClick={() => loadCustomerDetail(c.id)}>
                                  <div className="table-cell">
                                    <span className="table-label">Name</span>
                                    <span className="table-value">{c.name || "—"}</span>
                                  </div>
                                  <div className="table-cell">
                                    <span className="table-label">Email</span>
                                    <span className="table-value">{c.email || "—"}</span>
                                  </div>
                                  <div className="table-cell">
                                    <span className="table-label">Phone</span>
                                    <span className="table-value" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.phone || "—"}</span>
                                  </div>
                                  <div className="table-cell">
                                    <span className="table-label">Joined</span>
                                    <span className="table-value">{formatDate(c.created_at)}</span>
                                  </div>
                                  <div className="table-cell">
                                    <span className="table-label"></span>
                                    <span className="table-value" style={{ color: "#4CAF50", fontWeight: 600 }}>View →</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          
                          {/* Desktop table view */}
                          <DataTable headers={["Name", "Email", "Phone", "Joined", ""]} emptyMessage="No customers found">
                            {filteredCustomers.map((c) => (
                              <TableRow key={c.id} onClick={() => loadCustomerDetail(c.id)}>
                                <Td>{c.name || "—"}</Td>
                                <Td>{c.email || "—"}</Td>
                                <Td mono>{c.phone || "—"}</Td>
                                <Td>{formatDate(c.created_at)}</Td>
                                <Td><span style={{ color: "#4CAF50", fontSize: 13, fontWeight: 600 }}>View →</span></Td>
                              </TableRow>
                            ))}
                          </DataTable>
                        </div>
                      </>
                    )}

                    {/* ─── CUSTOMER DETAIL ─── */}
                    {activeTab === "customer_detail" && customerDetail && (
                      <>
                        <button onClick={() => switchTab("customers")} style={{
                          background: "none", border: "none", color: "#5a8a5a", fontSize: 14,
                          cursor: "pointer", fontFamily: "inherit", marginBottom: 16, display: "flex", alignItems: "center", gap: 6,
                        }}>← Back to Customers</button>

                        <div style={{
                          background: "linear-gradient(160deg, #0d1f0d, #091409)", border: "1px solid #1a3a1a",
                          borderRadius: 20, padding: "28px 32px", marginBottom: 24,
                          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
                        }}>
                          <div>
                            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 800 }}>
                              {customerDetail.customer.name || "Unknown Customer"}
                            </h1>
                            <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
                              {customerDetail.customer.email && (
                                <a href={`mailto:${customerDetail.customer.email}`} style={{ color: "#4CAF50", fontSize: 14, textDecoration: "none" }}>✉️ {customerDetail.customer.email}</a>
                              )}
                              {customerDetail.customer.phone && (
                                <a href={`tel:${customerDetail.customer.phone}`} style={{ color: "#4CAF50", fontSize: 14, textDecoration: "none" }}>📞 {customerDetail.customer.phone}</a>
                              )}
                            </div>
                            <div style={{ color: "#3a5a3a", fontSize: 12, marginTop: 8 }}>Customer since {formatDate(customerDetail.customer.created_at)}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button className="action-btn action-btn-primary" onClick={() => { pushSentinel(); setEditingJob(null); setShowJobModal(true); }}>
                              + New Job
                            </button>
                            <button className="action-btn action-btn-primary" onClick={() => {
                              pushSentinel();
                              setPendingInvoiceCustomerId(customerDetail.customer.id);
                              switchTab("invoices");
                            }}>
                              📄 Create Invoice
                            </button>
                            <button className="action-btn action-btn-primary" onClick={() => {
                              pushSentinel();
                              setCashModalPreselectedCustomer(customerDetail.customer.id);
                              setShowCashModal(true);
                            }}>
                              💵 Cash Payment
                            </button>
                            <button
                              className="action-btn"
                              onClick={() => setConfirmDeleteCustomer({
                                id: customerDetail.customer.id,
                                name: customerDetail.customer.name || customerDetail.customer.email || "this customer",
                              })}
                              style={{ background: "rgba(198,40,40,0.12)", border: "1px solid rgba(198,40,40,0.3)", color: "#ef9a9a" }}
                            >
                              🗑️ Delete Customer
                            </button>
                          </div>
                        </div>

                        {/* Job Sites */}
                        {customerDetail.jobSites.length > 0 && (
                          <div style={{ marginBottom: 24 }}>
                            <h3 style={{ fontSize: 14, color: "#4CAF50", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>Properties</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                              {customerDetail.jobSites.map((site) => (
                                <div key={site.id} style={{
                                  background: "linear-gradient(160deg, #0d1f0d, #091409)", border: "1px solid #1a3a1a",
                                  borderRadius: 14, padding: "16px 20px",
                                }}>
                                  <p style={{ color: "#e8f5e8", fontWeight: 600, fontSize: 14 }}>📍 {site.address}</p>
                                  <p style={{ color: "#5a8a5a", fontSize: 13 }}>{[site.city, site.state, site.zip].filter(Boolean).join(", ")}</p>
                                  {site.notes && <p style={{ color: "#3a5a3a", fontSize: 12, marginTop: 4 }}>{site.notes}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Jobs */}
                        <div style={{ marginBottom: 24 }}>
                          <h3 style={{ fontSize: 14, color: "#4CAF50", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>Jobs</h3>
                          <DataTable headers={["Service", "Status", "Date", "Amount", "Actions"]} emptyMessage="No jobs yet for this customer">
                            {customerDetail.jobs.map((j) => (
                              <TableRow key={j.id}>
                                <Td>{j.service_type}</Td>
                                <Td><StatusBadge status={j.status} /></Td>
                                <Td>{formatDate(j.scheduled_date)}</Td>
                                <Td mono accent>{formatCurrency(j.amount)}</Td>
                                <Td>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="quick-action" onClick={() => { pushSentinel(); setEditingJob(j); setShowJobModal(true); }}>Edit</button>
                                    {j.status === "scheduled" && (
                                      <button className="quick-action" onClick={() => handleUpdateJobStatus(j.id, "in_progress")}>Start</button>
                                    )}
                                    {j.status === "in_progress" && (
                                      <button className="quick-action" onClick={() => handleUpdateJobStatus(j.id, "completed")}>Complete</button>
                                    )}
                                    <button className="quick-action quick-action-danger" onClick={() => handleDeleteJob(j.id)}>Delete</button>
                                  </div>
                                </Td>
                              </TableRow>
                            ))}
                          </DataTable>
                        </div>

                        {/* Payments */}
                        <div style={{ marginBottom: 24 }}>
                          <h3 style={{ fontSize: 14, color: "#4CAF50", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>Payment History</h3>
                          <DataTable headers={["Amount", "Status", "Method", "Date", "Receipt", ""]} emptyMessage="No payments recorded">
                            {customerDetail.payments.map((p) => (
                              <TableRow key={p.id}>
                                <Td mono accent>{formatCurrency(p.amount)}</Td>
                                <Td><StatusBadge status={p.status} /></Td>
                                <Td>{p.payment_method || "—"}</Td>
                                <Td>{formatDate(p.paid_at || p.created_at)}</Td>
                                <Td>
                                  {p.square_receipt_url ? (
                                    <a href={p.square_receipt_url} target="_blank" rel="noreferrer" style={{ color: "#4CAF50", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>View ↗</a>
                                  ) : "—"}
                                </Td>
                                <Td>
                                  <button className="quick-action quick-action-danger" onClick={() => handleDeletePayment(p.id)}>Delete</button>
                                </Td>
                              </TableRow>
                            ))}
                          </DataTable>
                        </div>

                        {/* Subscriptions */}
                        {customerDetail.subscriptions.length > 0 && (
                          <div>
                            <h3 style={{ fontSize: 14, color: "#4CAF50", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>Subscriptions</h3>
                            <DataTable headers={["Plan", "Service", "Frequency", "Amount", "Mode", "Status", "Next Billing", ""]}>
                              {customerDetail.subscriptions.map((s) => (
                                <TableRow key={s.id}>
                                  <Td>{s.plan_name}</Td>
                                  <Td>{s.service_type}</Td>
                                  <Td>{s.frequency}</Td>
                                  <Td mono accent>{formatCurrency(s.amount)}</Td>
                                  <Td>
                                    <span style={{
                                      fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                                      color: s.billing_mode === "auto" ? "#66bb6a" : "#888",
                                    }}>{s.billing_mode || "manual"}</span>
                                  </Td>
                                  <Td><StatusBadge status={s.status} /></Td>
                                  <Td>{formatDate(s.next_billing_date)}</Td>
                                  <Td>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      {s.status === "active" && (
                                        <button className="quick-action" onClick={() => handleChargeNow(s.id)} disabled={chargingSubId === s.id}>
                                          {chargingSubId === s.id ? "..." : "Charge"}
                                        </button>
                                      )}
                                      <button className="quick-action" onClick={() => { setEditingSub(s); setShowSubModal(true); }}>Edit</button>
                                      <button className="quick-action quick-action-danger" onClick={() => handleDeleteSubscription(s.id)}>Delete</button>
                                    </div>
                                  </Td>
                                </TableRow>
                              ))}
                            </DataTable>
                          </div>
                        )}

                        {/* Stored Cards */}
                        {customerDetail.storedCards && customerDetail.storedCards.length > 0 && (
                          <div>
                            <h3 style={{ fontSize: 14, color: "#4CAF50", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>Cards on File</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {customerDetail.storedCards.map((card) => (
                                <div key={card.id} style={{
                                  background: "rgba(255,255,255,0.02)", border: "1px solid #1a3a1a",
                                  borderRadius: 10, padding: "12px 16px",
                                  display: "flex", alignItems: "center", gap: 12,
                                }}>
                                  <span style={{ fontSize: 18 }}>💳</span>
                                  <span style={{ color: "#e8f5e8", fontWeight: 600, fontSize: 14 }}>
                                    {card.brand || "Card"} ····{card.last4 || "????"}
                                  </span>
                                  <span style={{ color: "#5a8a5a", fontSize: 12 }}>
                                    {card.exp_month ? `${String(card.exp_month).padStart(2, "0")}/${card.exp_year}` : ""}
                                  </span>
                                  {card.is_default && (
                                    <span style={{
                                      padding: "2px 8px", background: "rgba(76,175,80,0.15)",
                                      borderRadius: 8, fontSize: 10, fontWeight: 700, color: "#66bb6a",
                                    }}>DEFAULT</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* ─── JOBS TAB ─── */}
                    {activeTab === "jobs" && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
                          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 800 }}>
                            Jobs
                          </h1>
                          <button className="action-btn action-btn-primary" onClick={() => { pushSentinel(); setEditingJob(null); setShowJobModal(true); }}>
                            + New Job
                          </button>
                        </div>
                        <DataTable headers={["Customer", "Service", "Status", "Date", "Amount", "Actions"]} emptyMessage="No jobs created yet">
                          {jobs.map((j) => (
                            <TableRow key={j.id}>
                              <Td>{j.customers?.name || "—"}</Td>
                              <Td>{j.service_type}</Td>
                              <Td><StatusBadge status={j.status} /></Td>
                              <Td>{formatDate(j.scheduled_date)}</Td>
                              <Td mono accent>{formatCurrency(j.amount)}</Td>
                              <Td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button className="quick-action" onClick={() => { pushSentinel(); setEditingJob(j); setShowJobModal(true); }}>Edit</button>
                                  {j.status === "scheduled" && (
                                    <button className="quick-action" onClick={() => handleUpdateJobStatus(j.id, "in_progress")}>Start</button>
                                  )}
                                  {j.status === "in_progress" && (
                                    <button className="quick-action" onClick={() => handleUpdateJobStatus(j.id, "completed")}>Complete</button>
                                  )}
                                </div>
                              </Td>
                            </TableRow>
                          ))}
                        </DataTable>
                      </>
                    )}

                    {/* ─── PAYMENTS TAB ─── */}
                    {activeTab === "payments" && (() => {
                      // Merge card/cash payments + paid invoices into one sorted list
                      type PayEntry = { key: string; customer: string; amount: number; type: string; date: string; paymentId?: string; invoiceId?: string; invoiceNumber?: string; receiptUrl?: string; };
                      const entries: PayEntry[] = [
                        ...payments.map(p => ({
                          key: `pay-${p.id}`,
                          customer: p.customers?.name || "—",
                          amount: p.amount,
                          type: p.payment_method === "cash" ? "💵 Cash" : p.payment_method === "card" ? "💳 Card" : p.payment_method || "—",
                          date: p.paid_at || p.created_at,
                          paymentId: p.id,
                          receiptUrl: p.square_receipt_url || undefined,
                        })),
                        ...paidInvoices.map(inv => ({
                          key: `inv-${inv.id}`,
                          customer: (inv as Invoice & { customers?: { name: string | null } }).customers?.name || "—",
                          amount: inv.amount,
                          type: "🧾 Invoice",
                          date: inv.paid_date || inv.created_at,
                          invoiceId: inv.id,
                          invoiceNumber: inv.invoice_number || undefined,
                        })),
                      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                      return (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 800 }}>
                              Payments
                            </h1>
                            <button className="action-btn action-btn-primary" onClick={() => { pushSentinel(); setShowCashModal(true); }}>
                              💵 Record Cash
                            </button>
                          </div>
                          <DataTable headers={["Customer", "Amount", "Type", "Date", "Action", ""]} emptyMessage="No payments recorded yet">
                            {entries.map(e => (
                              <TableRow key={e.key}>
                                <Td>{e.customer}</Td>
                                <Td mono accent>{formatCurrency(e.amount)}</Td>
                                <Td>{e.type}</Td>
                                <Td>{formatDate(e.date)}</Td>
                                <Td>
                                  {e.invoiceId ? (
                                    <button
                                      onClick={() => { pushSentinel(); setPendingInvoiceId(e.invoiceId!); switchTab("invoices"); }}
                                      style={{ background: "none", border: "none", color: "#4CAF50", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
                                    >
                                      {e.invoiceNumber || "Open"} ↗
                                    </button>
                                  ) : e.receiptUrl ? (
                                    <a href={e.receiptUrl} target="_blank" rel="noreferrer" style={{ color: "#4CAF50", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Receipt ↗</a>
                                  ) : "—"}
                                </Td>
                                <Td>
                                  {e.paymentId && (
                                    <button className="quick-action quick-action-danger" onClick={() => handleDeletePayment(e.paymentId!)}>Delete</button>
                                  )}
                                </Td>
                              </TableRow>
                            ))}
                          </DataTable>
                        </>
                      );
                    })()}

                    {/* ─── SUBSCRIPTIONS TAB ─── */}
                    {activeTab === "subscriptions" && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 800 }}>
                            Subscriptions
                          </h1>
                          <button onClick={() => { setEditingSub(null); setShowSubModal(true); }} style={{
                            background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
                            border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700,
                            cursor: "pointer", fontFamily: "inherit",
                          }}>+ New Subscription</button>
                        </div>
                        <DataTable headers={["Customer", "Plan", "Freq", "Amount", "Mode", "Status", "Next Billing", "Actions"]} emptyMessage="No subscriptions">
                          {subscriptions.map((s) => (
                            <TableRow key={s.id}>
                              <Td>{s.customers?.name || "—"}</Td>
                              <Td>
                                <span style={{ fontWeight: 600 }}>{s.plan_name}</span>
                                <br/><span style={{ fontSize: 11, color: "#5a8a5a" }}>{s.service_type}</span>
                              </Td>
                              <Td>{s.frequency}</Td>
                              <Td mono accent>{formatCurrency(s.amount)}</Td>
                              <Td>
                                <button onClick={() => handleToggleBillingMode(s)} style={{
                                  background: s.billing_mode === "auto" ? "rgba(76,175,80,0.15)" : "rgba(255,255,255,0.05)",
                                  border: `1px solid ${s.billing_mode === "auto" ? "rgba(76,175,80,0.3)" : "#2a2a2a"}`,
                                  borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700,
                                  color: s.billing_mode === "auto" ? "#66bb6a" : "#888",
                                  cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
                                }}>{s.billing_mode || "manual"}</button>
                              </Td>
                              <Td>
                                <button onClick={() => handleToggleSubStatus(s)} style={{
                                  background: "none", border: "none", cursor: "pointer", padding: 0,
                                }}>
                                  <StatusBadge status={s.status} />
                                </button>
                              </Td>
                              <Td>{formatDate(s.next_billing_date)}</Td>
                              <Td>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {s.status === "active" && (
                                    <button
                                      onClick={() => handleChargeNow(s.id)}
                                      disabled={chargingSubId === s.id}
                                      style={{
                                        background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
                                        border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700,
                                        cursor: chargingSubId === s.id ? "not-allowed" : "pointer", fontFamily: "inherit",
                                        opacity: chargingSubId === s.id ? 0.5 : 1,
                                      }}
                                    >{chargingSubId === s.id ? "..." : "Charge"}</button>
                                  )}
                                  <button onClick={() => { setEditingSub(s); setShowSubModal(true); }} style={{
                                    background: "rgba(255,255,255,0.05)", border: "1px solid #2a2a2a",
                                    borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600,
                                    color: "#8aba8a", cursor: "pointer", fontFamily: "inherit",
                                  }}>Edit</button>
                                  <button onClick={() => handleDeleteSubscription(s.id)} style={{
                                    background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.2)",
                                    borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600,
                                    color: "#ef5350", cursor: "pointer", fontFamily: "inherit",
                                  }}>Del</button>
                                </div>
                              </Td>
                            </TableRow>
                          ))}
                        </DataTable>
                      </>
                    )}

                    {/* ─── VIDEO LEADS TAB ─── */}
                    {activeTab === "video_leads" && userId && (
                      <AdminVideoLeads userId={userId} backRef={videoLeadsBackRef} onNavigate={pushSentinel} />
                    )}

                    {/* ─── MESSAGES TAB ─── */}
                    {activeTab === "messages" && userId && (
                      <AdminInbox userId={userId} backRef={inboxBackRef} onNavigate={pushSentinel} />
                    )}

                    {/* ─── INVOICES TAB ─── */}
                    {activeTab === "invoices" && userId && (
                      <AdminInvoices userId={userId} backRef={invoicesBackRef} onNavigate={pushSentinel} createRef={invoiceCreateRef} initialInvoiceId={pendingInvoiceId} onInitialInvoiceConsumed={() => setPendingInvoiceId(null)} initialCustomerId={pendingInvoiceCustomerId} onInitialCustomerConsumed={() => setPendingInvoiceCustomerId(null)} />
                    )}
                  </div>
                )}
                </div>
              </main>
            </div>

            {/* ─── JOB MODAL ─── */}
            {showJobModal && (
              <JobModal
                onClose={() => { setShowJobModal(false); setEditingJob(null); }}
                onSave={handleSaveJob}
                customers={customers}
                job={editingJob}
              />
            )}
            {/* ─── CUSTOMER MODAL ─── */}
            {showCustomerModal && (
              <CustomerModal
                onClose={() => setShowCustomerModal(false)}
                onSave={handleSaveCustomer}
              />
            )}
            {/* ─── CONFIRM DELETE CUSTOMER MODAL ─── */}
            {confirmDeleteCustomer && (
              <div onClick={() => setConfirmDeleteCustomer(null)} style={{
                position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 20, backdropFilter: "blur(8px)",
              }}>
                <div onClick={e => e.stopPropagation()} style={{
                  background: "linear-gradient(160deg, #1a0d0d, #110909)",
                  border: "1px solid rgba(239,83,80,0.3)", borderRadius: 20, padding: "32px 28px",
                  maxWidth: 440, width: "100%", boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
                }}>
                  <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>⚠️</div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#ffcdd2", fontWeight: 700, textAlign: "center", marginBottom: 8 }}>
                    Delete Customer?
                  </h3>
                  <p style={{ color: "#ef9a9a", fontSize: 15, fontWeight: 600, textAlign: "center", marginBottom: 12 }}>
                    {confirmDeleteCustomer.name}
                  </p>
                  <div style={{ background: "rgba(198,40,40,0.08)", border: "1px solid rgba(198,40,40,0.2)", borderRadius: 10, padding: "14px 16px", marginBottom: 24 }}>
                    <p style={{ color: "#9a7a7a", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                      This will permanently delete this customer and <strong style={{ color: "#ef9a9a" }}>all associated records</strong>:<br/>
                      jobs · payments · invoices · subscriptions · job sites
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={() => setConfirmDeleteCustomer(null)} style={{
                      flex: 1, padding: "12px", borderRadius: 12,
                      border: "1px solid #2a2a2a", background: "transparent",
                      color: "#8aba8a", fontSize: 14, fontWeight: 600, cursor: "pointer",
                    }}>
                      Cancel
                    </button>
                    <button onClick={handleDeleteCustomer} style={{
                      flex: 1, padding: "12px", borderRadius: 12, border: "none",
                      background: "linear-gradient(135deg, #c62828, #b71c1c)",
                      color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                      boxShadow: "0 4px 20px rgba(198,40,40,0.4)",
                    }}>
                      Yes, Delete Everything
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── CASH PAYMENT MODAL ─── */}
            {showCashModal && (
              <CashPaymentModal
                onClose={() => { setShowCashModal(false); setCashModalPreselectedCustomer(null); }}
                onSave={handleSaveCashPayment}
                customers={customers}
                jobs={jobs}
                preselectedCustomerId={cashModalPreselectedCustomer}
              />
            )}

            {/* ─── SUBSCRIPTION MODAL ─── */}
            {showSubModal && (
              <SubscriptionModal
                onClose={() => { setShowSubModal(false); setEditingSub(null); }}
                onSave={handleSaveSubscription}
                customers={customers}
                subscription={editingSub}
              />
            )}
          </>
        )}
      </SignedIn>
      
      {/* Enhanced Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav" style={{
        display: "none",
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(5,14,5,0.98)",
        borderTop: "1px solid #1a3a1a",
        padding: "12px 8px 20px",
        zIndex: 90,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 -4px 30px rgba(0,0,0,0.4)"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          gap: "4px"
        }}>
          {[
            { icon: "📊", label: "Overview", tab: "overview" },
            { icon: "👥", label: "Customers", tab: "customers" },
            { icon: "🔧", label: "Jobs", tab: "jobs" },
            { icon: "💰", label: "Payments", tab: "payments" },
            { icon: "📹", label: "Leads", tab: "video_leads" }
          ].map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => {
                  switchTab(item.tab as Tab);
                  setSidebarOpen(false);
                }}
                data-active={isActive}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: isActive ? "rgba(76,175,80,0.15)" : "transparent",
                  border: "none",
                  color: isActive ? "#4CAF50" : "#5a8a5a",
                  padding: "8px 4px",
                  minWidth: "64px",
                  minHeight: "64px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: isActive ? 700 : 500,
                  transition: "all 0.2s",
                  position: "relative",
                  flex: 1,
                  borderRadius: "12px",
                  outline: "none"
                }}
                aria-label={`Switch to ${item.label}`}
                onTouchStart={(e) => {
                  e.currentTarget.style.transform = "scale(0.95)";
                  e.currentTarget.style.background = "rgba(76,175,80,0.2)";
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.background = isActive ? "rgba(76,175,80,0.15)" : "transparent";
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "#7ab87a";
                    e.currentTarget.style.background = "rgba(76,175,80,0.08)";
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "#5a8a5a";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <span style={{ 
                  fontSize: "22px", 
                  marginBottom: "4px",
                  transition: "transform 0.2s",
                  transform: isActive ? "scale(1.1)" : "scale(1)",
                  display: "inline-block"
                }}>{item.icon}</span>
                <span style={{
                  fontSize: "11px",
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: "0.3px"
                }}>{item.label}</span>
                {isActive && (
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "24px",
                    height: "3px",
                    background: "#4CAF50",
                    borderRadius: "0 0 2px 2px",
                    boxShadow: "0 0 8px rgba(76,175,80,0.5)"
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      <style>{`
        @media (max-width: 900px) {
          .mobile-bottom-nav {
            display: block !important;
          }
          .admin-content-inner {
            padding-bottom: 100px !important;
          }
        }
        @media (max-width: 600px) {
          .mobile-bottom-nav {
            padding: 12px 8px 24px !important;
          }
          .mobile-bottom-nav button {
            min-width: 64px;
            min-height: 64px;
            font-size: 11px;
          }
          .mobile-bottom-nav span:first-child {
            font-size: 22px !important;
          }
          .admin-content-inner {
            padding-bottom: 100px !important;
          }
        }
        @media (max-width: 375px) {
          .mobile-bottom-nav button {
            min-width: 56px;
          }
          .mobile-bottom-nav span:first-child {
            font-size: 20px !important;
          }
        }
        
        /* Safe area support for notched phones */
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .mobile-bottom-nav {
            padding-bottom: calc(20px + env(safe-area-inset-bottom)) !important;
          }
          .admin-content-inner {
            padding-bottom: calc(100px + env(safe-area-inset-bottom)) !important;
          }
        }
        
        /* Improved mobile table touch interactions */
        .table-row {
          position: relative;
          min-height: 44px;
          display: flex;
          align-items: center;
          padding: 12px 0;
        }
        .table-row:active {
          background: rgba(76,175,80,0.08) !important;
        }
        
        /* Better modal touch interactions */
        @media (max-width: 600px) {
          .JobModal > div,
          .CustomerModal > div {
            width: calc(100% - 20px) !important;
            margin: 10px !important;
            max-height: 90vh !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }

          /* Improved form inputs for mobile */
          .JobModal input,
          .JobModal select,
          .JobModal textarea,
          .CustomerModal input {
            font-size: 16px !important;
            min-height: 52px !important;
            padding: 14px 16px !important;
          }
        }
        @keyframes exitToastSlide {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* ─── Exit toast ─── */}
      {showExitToast && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: "#1a3a1a", color: "#c8e0c8",
          padding: "14px 28px", borderRadius: 28, zIndex: 99999,
          fontSize: 14, fontWeight: 500, whiteSpace: "nowrap",
          boxShadow: "0 6px 24px rgba(0,0,0,0.6)", border: "1px solid #2e5a2e",
          animation: "exitToastSlide 0.25s ease",
        }}>
          Press back again to exit
        </div>
      )}
    </>
  );
}











