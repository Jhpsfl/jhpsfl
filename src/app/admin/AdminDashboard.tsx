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
  next_billing_date: string | null;
  customers?: { name: string; phone: string; email: string };
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
}

type Tab = "overview" | "customers" | "jobs" | "payments" | "subscriptions" | "customer_detail" | "video_leads" | "messages";

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

// ─── Stat Card ───
function StatCard({ icon, label, value, accent = false, onClick }: {
  icon: string; label: string; value: string | number; accent?: boolean; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: accent
          ? "linear-gradient(135deg, rgba(76,175,80,0.15), rgba(46,125,50,0.08))"
          : "linear-gradient(160deg, #0d1f0d, #091409)",
        border: accent ? "1px solid rgba(76,175,80,0.3)" : "1px solid #1a3a1a",
        borderRadius: 16, padding: "24px 20px",
        transition: "transform 0.3s, box-shadow 0.3s",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
      }}
      onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,0,0,0.2)"; }}
      onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {onClick && (
        <div style={{ position: "absolute", top: 12, right: 14, fontSize: 11, color: "#2a4a2a" }}>→</div>
      )}
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{
        fontSize: 28, fontWeight: 800, color: accent ? "#4CAF50" : "#e8f5e8",
        fontFamily: "'JetBrains Mono', monospace", marginBottom: 4,
      }}>{value}</div>
      <div style={{ fontSize: 12, color: "#5a8a5a", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
    </div>
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

function Td({ children, mono, accent }: { children: React.ReactNode; mono?: boolean; accent?: boolean }) {
  return (
    <td style={{
      padding: "14px 16px", fontSize: 14, color: accent ? "#4CAF50" : "#c8e0c8",
      borderBottom: "1px solid #0d1a0d",
      fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
      fontWeight: mono ? 600 : 400, whiteSpace: "nowrap",
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
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Toasts
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 4000);
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
          const res = await adminFetch("payments");
          if (res?.data) setPayments(res.data);
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
    setLoading(true);
    try {
      const res = await adminFetch("customer_detail", customerId);
      if (res) {
        setCustomerDetail(res);
        setActiveTab("customer_detail");
      }
    } catch (err) {
      console.error("Customer detail error:", err);
    }
    setLoading(false);
  }, [adminFetch]);

  useEffect(() => {
    if (userId) loadTab("overview");
  }, [userId, loadTab]);

  useEffect(() => {
    if (userId && activeTab !== "customer_detail") loadTab(activeTab);
  }, [activeTab, userId, loadTab]);

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
    setActiveTab(tab);
    setCustomerDetail(null);
    setSidebarOpen(false);
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
          position: fixed; top: 0; left: 0; bottom: 0; width: 260px;
          display: flex; flex-direction: column; z-index: 100;
          overflow-y: auto;
        }
        .admin-main { margin-left: 260px; min-height: 100vh; overflow-x: hidden; }
        .admin-content-inner { padding: 28px 28px 60px; max-width: 1400px; }

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
        .quick-action-danger { color: #ef5350; border-color: rgba(239,83,80,0.2); }
        .quick-action-danger:hover { background: rgba(239,83,80,0.1) !important; color: #ef5350 !important; border-color: #ef5350 !important; }

        .mobile-toggle {
          display: none; position: fixed; top: 16px; left: 16px; z-index: 200;
          background: rgba(5,14,5,0.95); border: 1px solid #1a3a1a;
          border-radius: 10px; padding: 10px 14px; cursor: pointer;
          color: #4CAF50; font-size: 20px;
        }
        .mobile-overlay {
          display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          z-index: 99;
        }

        /* ── Windowed desktop: ~1150px and below, sidebar still visible ── */
        @media (max-width: 1150px) {
          .admin-content-inner { padding: 22px 18px 56px; }
          .admin-content-inner h1 { font-size: 22px !important; }
          .admin-content-inner table th { padding: 10px 10px !important; }
          .admin-content-inner table td { padding: 10px 10px !important; font-size: 13px !important; }
          .stats-grid-admin > div { padding: 18px 14px !important; }
        }

        /* ── Tablet / collapsed sidebar ── */
        @media (max-width: 900px) {
          .admin-layout { grid-template-columns: 1fr; }
          .admin-sidebar { transform: translateX(-100%); transition: transform 0.3s; width: 280px; }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-main { margin-left: 0; }
          .admin-content-inner { padding: 64px 14px 56px; }
          .mobile-toggle { display: flex; }
          .mobile-overlay.open { display: block; }
          .stats-grid-admin { grid-template-columns: repeat(3, 1fr) !important; }
          .stats-grid-admin > div { padding: 16px 12px !important; border-radius: 12px !important; }
          .admin-content-inner table th { padding: 9px 8px !important; font-size: 10px !important; letter-spacing: 0.8px !important; }
          .admin-content-inner table td { padding: 9px 8px !important; font-size: 12px !important; }
          .quick-action { padding: 3px 8px !important; font-size: 10px !important; }
          .action-btn { padding: 7px 12px !important; font-size: 12px !important; }
          .admin-content-inner h1 { font-size: 20px !important; }
          .search-input { width: 200px !important; }
        }

        /* ── Mobile phone ── */
        @media (max-width: 600px) {
          .admin-content-inner { padding: 60px 8px 56px; }
          .stats-grid-admin { grid-template-columns: 1fr 1fr !important; }
          .stats-grid-admin > div { padding: 14px 10px !important; }
          .stats-grid-admin > div > div:nth-child(1) { font-size: 18px !important; margin-bottom: 4px !important; }
          .stats-grid-admin > div > div:nth-child(2) { font-size: 20px !important; }
          .stats-grid-admin > div > div:nth-child(3) { font-size: 10px !important; }
          .admin-content-inner table th { padding: 7px 6px !important; font-size: 9px !important; letter-spacing: 0.3px !important; }
          .admin-content-inner table td { padding: 7px 6px !important; font-size: 11px !important; }
          .admin-content-inner h1 { font-size: 18px !important; }
          .action-btn { padding: 6px 10px !important; font-size: 11px !important; }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 10000,
          padding: "14px 24px", borderRadius: 12,
          background: toast.type === "success" ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "linear-gradient(135deg, #ef5350, #c62828)",
          color: "#fff", fontSize: 14, fontWeight: 600,
          boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
          animation: "toastIn 0.3s ease",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {toast.type === "success" ? "✓" : "⚠"} {toast.message}
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
            {/* Mobile toggle */}
            <button className="mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? "✕" : "☰"}
            </button>
            <div className={`mobile-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

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
                  <NavItem icon="📹" label="Video Quotes" active={activeTab === "video_leads"} onClick={() => switchTab("video_leads")} />
                  <NavItem icon="✉️" label="Messages" active={activeTab === "messages"} onClick={() => switchTab("messages")} />

                  <div style={{ borderTop: "1px solid #1a3a1a", margin: "16px 0" }} />

                  <div style={{ fontSize: 10, color: "#2a4a2a", letterSpacing: 2, padding: "0 16px", marginBottom: 8, fontWeight: 700 }}>COMING SOON</div>
                  <NavItem icon="📄" label="Invoices" active={false} onClick={() => showToast("Invoice management coming soon", "error")} />
                  <NavItem icon="📈" label="Analytics" active={false} onClick={() => showToast("Analytics coming soon", "error")} />
                </nav>

                <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 16, marginTop: 16 }}>
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
                <div className="admin-content-inner">
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
                        {/* ── Top bar: greeting + revenue pill ── */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                          <div>
                            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: "#e8f5e8", fontWeight: 800, marginBottom: 4 }}>
                              Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
                            </h1>
                            <p style={{ color: "#5a8a5a", fontSize: 15 }}>Here&apos;s what&apos;s happening with your business.</p>
                          </div>
                          {/* Revenue info pill */}
                          <div
                            onClick={() => switchTab("payments")}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              background: "linear-gradient(135deg, rgba(76,175,80,0.15), rgba(46,125,50,0.08))",
                              border: "1px solid rgba(76,175,80,0.3)", borderRadius: 14,
                              padding: "12px 20px", cursor: "pointer", transition: "all 0.2s",
                              flexShrink: 0,
                            }}
                            onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(76,175,80,0.2)"; }}
                            onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                          >
                            <span style={{ fontSize: 20 }}>💰</span>
                            <div>
                              <div style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Revenue (30d)</div>
                              <div style={{ fontSize: 22, fontWeight: 800, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace" }}>
                                {formatCurrency(overview.recentRevenue)}
                              </div>
                            </div>
                            <span style={{ color: "#2a4a2a", fontSize: 14, marginLeft: 4 }}>→</span>
                          </div>
                        </div>

                        {/* ── Clickable stat cards (4 cards, no revenue) ── */}
                        <div className="stats-grid-admin" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                          <StatCard icon="👥" label="Customers" value={overview.totalCustomers} onClick={() => switchTab("customers")} />
                          <StatCard icon="🔧" label="Active Jobs" value={overview.activeJobs} accent onClick={() => switchTab("jobs")} />
                          <StatCard icon="✅" label="Completed" value={overview.completedJobs} onClick={() => switchTab("jobs")} />
                          <StatCard icon="🔄" label="Subscriptions" value={overview.activeSubscriptions} onClick={() => switchTab("subscriptions")} />
                        </div>

                        {/* ── Separator ── */}
                        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #1a3a1a, transparent)", margin: "4px 0 20px" }} />

                        {/* ── Compact nav tabs ── */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
                          {[
                            { icon: "➕", label: "New Job", action: () => { switchTab("jobs"); setTimeout(() => setShowJobModal(true), 100); }, primary: true },
                            { icon: "👥", label: "Customers", action: () => switchTab("customers") },
                            { icon: "🔧", label: "Jobs", action: () => switchTab("jobs") },
                            { icon: "💰", label: "Payments", action: () => switchTab("payments") },
                            { icon: "🔄", label: "Subscriptions", action: () => switchTab("subscriptions") },
                            { icon: "📹", label: "Video Quotes", action: () => switchTab("video_leads") },
                            { icon: "✉️", label: "Messages", action: () => switchTab("messages") },
                          ].map(({ icon, label, action, primary }) => (
                            <button
                              key={label}
                              onClick={action}
                              style={{
                                display: "flex", alignItems: "center", gap: 5,
                                padding: "6px 14px", borderRadius: 20,
                                background: primary
                                  ? "linear-gradient(135deg, #4CAF50, #2E7D32)"
                                  : "rgba(76,175,80,0.08)",
                                color: primary ? "#fff" : "#7ab87a",
                                fontSize: 12, fontWeight: 600, cursor: "pointer",
                                fontFamily: "'DM Sans', sans-serif",
                                border: primary ? "none" : "1px solid #1a3a1a",
                                transition: "all 0.15s",
                                boxShadow: primary ? "0 2px 12px rgba(76,175,80,0.25)" : "none",
                              } as React.CSSProperties}
                              onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = primary ? "linear-gradient(135deg, #56c75a, #388e3c)" : "rgba(76,175,80,0.14)"; }}
                              onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = primary ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "rgba(76,175,80,0.08)"; }}
                            >
                              <span style={{ fontSize: 13 }}>{icon}</span>
                              {label}
                            </button>
                          ))}
                          <Link
                            href="/pay"
                            target="_blank"
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "6px 14px", borderRadius: 20,
                              background: "rgba(76,175,80,0.08)", border: "1px solid #1a3a1a",
                              color: "#7ab87a", fontSize: 12, fontWeight: 600,
                              fontFamily: "'DM Sans', sans-serif", textDecoration: "none",
                              transition: "all 0.15s",
                            }}
                          >
                            <span style={{ fontSize: 13 }}>💳</span>
                            Payment Page ↗
                          </Link>
                        </div>

                        {/* ── Separator ── */}
                        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #1a3a1a, transparent)", margin: "4px 0 24px" }} />

                        {/* ── Recent customers ── */}
                        <div style={{ marginBottom: 32 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ fontSize: 16, color: "#e8f5e8", fontWeight: 700 }}>Recent Customers</h3>
                            <button className="quick-action" onClick={() => switchTab("customers")}>View all →</button>
                          </div>
                          <DataTable headers={["Name", "Email", "Phone", "Joined"]} emptyMessage="No customers yet. Share your site to get signups!">
                            {customers.slice(0, 5).map((c) => (
                              <TableRow key={c.id} onClick={() => loadCustomerDetail(c.id)}>
                                <Td>{c.name || "—"}</Td>
                                <Td>{c.email || "—"}</Td>
                                <Td mono>{c.phone || "—"}</Td>
                                <Td>{timeAgo(c.created_at)}</Td>
                              </TableRow>
                            ))}
                          </DataTable>
                        </div>

                        {/* ── Recent payments ── */}
                        {overview.recentPayments.length > 0 && (
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                              <h3 style={{ fontSize: 16, color: "#e8f5e8", fontWeight: 700 }}>Recent Payments</h3>
                              <button className="quick-action" onClick={() => switchTab("payments")}>View all →</button>
                            </div>
                            <DataTable headers={["Amount", "Status", "Date"]}>
                              {overview.recentPayments.map((p, i) => (
                                <TableRow key={i}>
                                  <Td mono accent>{formatCurrency(p.amount)}</Td>
                                  <Td><StatusBadge status={p.status} /></Td>
                                  <Td>{formatDate(p.created_at)}</Td>
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
                            <button className="action-btn action-btn-primary" onClick={() => setShowCustomerModal(true)}>
                              + Add Customer
                            </button>
                          </div>
                          <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#3a5a3a", fontSize: 14 }}>🔍</span>
                            <input className="search-input" placeholder="Search customers..."
                              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                              style={{ width: 280 }} />
                          </div>
                        </div>
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
                          <button className="action-btn action-btn-primary" onClick={() => { setEditingJob(null); setShowJobModal(true); }}>
                            + New Job
                          </button>
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
                                    <button className="quick-action" onClick={() => { setEditingJob(j); setShowJobModal(true); }}>Edit</button>
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
                          <DataTable headers={["Amount", "Status", "Method", "Date", "Receipt"]} emptyMessage="No payments recorded">
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
                              </TableRow>
                            ))}
                          </DataTable>
                        </div>

                        {/* Subscriptions */}
                        {customerDetail.subscriptions.length > 0 && (
                          <div>
                            <h3 style={{ fontSize: 14, color: "#4CAF50", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>Subscriptions</h3>
                            <DataTable headers={["Plan", "Service", "Frequency", "Amount", "Status", "Next Billing"]}>
                              {customerDetail.subscriptions.map((s) => (
                                <TableRow key={s.id}>
                                  <Td>{s.plan_name}</Td>
                                  <Td>{s.service_type}</Td>
                                  <Td>{s.frequency}</Td>
                                  <Td mono accent>{formatCurrency(s.amount)}</Td>
                                  <Td><StatusBadge status={s.status} /></Td>
                                  <Td>{formatDate(s.next_billing_date)}</Td>
                                </TableRow>
                              ))}
                            </DataTable>
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
                          <button className="action-btn action-btn-primary" onClick={() => { setEditingJob(null); setShowJobModal(true); }}>
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
                                  <button className="quick-action" onClick={() => { setEditingJob(j); setShowJobModal(true); }}>Edit</button>
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
                    {activeTab === "payments" && (
                      <>
                        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 800, marginBottom: 24 }}>
                          Payments
                        </h1>
                        <DataTable headers={["Customer", "Amount", "Status", "Method", "Date", "Receipt"]} emptyMessage="No payments recorded yet">
                          {payments.map((p) => (
                            <TableRow key={p.id}>
                              <Td>{p.customers?.name || "—"}</Td>
                              <Td mono accent>{formatCurrency(p.amount)}</Td>
                              <Td><StatusBadge status={p.status} /></Td>
                              <Td>{p.payment_method || "—"}</Td>
                              <Td>{formatDate(p.paid_at || p.created_at)}</Td>
                              <Td>
                                {p.square_receipt_url ? (
                                  <a href={p.square_receipt_url} target="_blank" rel="noreferrer" style={{ color: "#4CAF50", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>View ↗</a>
                                ) : "—"}
                              </Td>
                            </TableRow>
                          ))}
                        </DataTable>
                      </>
                    )}

                    {/* ─── SUBSCRIPTIONS TAB ─── */}
                    {activeTab === "subscriptions" && (
                      <>
                        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 800, marginBottom: 24 }}>
                          Subscriptions
                        </h1>
                        <DataTable headers={["Customer", "Plan", "Service", "Frequency", "Amount", "Status", "Next Billing"]} emptyMessage="No active subscriptions">
                          {subscriptions.map((s) => (
                            <TableRow key={s.id}>
                              <Td>{s.customers?.name || "—"}</Td>
                              <Td>{s.plan_name}</Td>
                              <Td>{s.service_type}</Td>
                              <Td>{s.frequency}</Td>
                              <Td mono accent>{formatCurrency(s.amount)}</Td>
                              <Td><StatusBadge status={s.status} /></Td>
                              <Td>{formatDate(s.next_billing_date)}</Td>
                            </TableRow>
                          ))}
                        </DataTable>
                      </>
                    )}

                    {/* ─── VIDEO LEADS TAB ─── */}
                    {activeTab === "video_leads" && userId && (
                      <AdminVideoLeads userId={userId} />
                    )}

                    {/* ─── MESSAGES TAB ─── */}
                    {activeTab === "messages" && userId && (
                      <AdminInbox userId={userId} />
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
          </>
        )}
      </SignedIn>
    </>
  );
}
