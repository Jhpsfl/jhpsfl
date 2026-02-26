"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ───
interface Customer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface Invoice {
  id: string;
  customer_id: string;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  line_items: InvoiceLineItem[];
  payment_link: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  customers?: { name: string | null; email: string | null; phone: string | null };
}

// ─── Predefined Services ───
const SERVICE_PRESETS: { category: string; items: { description: string; unit_price: number }[] }[] = [
  {
    category: "Lawn Care",
    items: [
      { description: "Standard Lawn Mowing (up to 1/4 acre)", unit_price: 45 },
      { description: "Large Lawn Mowing (1/4 - 1/2 acre)", unit_price: 75 },
      { description: "XL Lawn Mowing (1/2 - 1 acre)", unit_price: 120 },
      { description: "Edging & Trimming", unit_price: 25 },
      { description: "Leaf Blowing / Cleanup", unit_price: 35 },
      { description: "Hedge Trimming", unit_price: 50 },
      { description: "Full Lawn Service Package", unit_price: 95 },
    ],
  },
  {
    category: "Pressure Washing",
    items: [
      { description: "Driveway Pressure Wash", unit_price: 150 },
      { description: "House Exterior Soft Wash", unit_price: 250 },
      { description: "Patio / Pool Deck Wash", unit_price: 125 },
      { description: "Fence Pressure Wash", unit_price: 100 },
      { description: "Roof Soft Wash", unit_price: 350 },
      { description: "Sidewalk / Walkway Wash", unit_price: 75 },
      { description: "Full Property Wash Package", unit_price: 450 },
    ],
  },
  {
    category: "Junk Removal",
    items: [
      { description: "Small Load (pickup truck)", unit_price: 150 },
      { description: "Half Load (dump trailer)", unit_price: 275 },
      { description: "Full Load (dump trailer)", unit_price: 450 },
      { description: "Appliance Removal (each)", unit_price: 75 },
      { description: "Furniture Removal (each)", unit_price: 50 },
      { description: "Yard Debris Removal", unit_price: 200 },
    ],
  },
  {
    category: "Land Clearing",
    items: [
      { description: "Brush Clearing (per 1/4 acre)", unit_price: 500 },
      { description: "Small Tree Removal (under 6\")", unit_price: 150 },
      { description: "Medium Tree Removal (6-12\")", unit_price: 350 },
      { description: "Stump Grinding (per stump)", unit_price: 100 },
      { description: "Lot Clearing (full)", unit_price: 1500 },
    ],
  },
  {
    category: "Property Cleanup",
    items: [
      { description: "General Property Cleanup", unit_price: 200 },
      { description: "Post-Construction Cleanup", unit_price: 400 },
      { description: "Foreclosure / Estate Cleanout", unit_price: 600 },
      { description: "Storm Damage Cleanup", unit_price: 300 },
    ],
  },
];

// ─── Helpers ───
function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${y}${m}-${rand}`;
}

function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

function getDefaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14); // Net 14 default
  return d.toISOString().split("T")[0];
}

function createLineItemId(): string {
  return `li_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// ─── Status Badge ───
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; glow: string }> = {
    draft: { bg: "rgba(158,158,158,0.1)", text: "#9e9e9e", glow: "rgba(158,158,158,0.1)" },
    sent: { bg: "rgba(33,150,243,0.12)", text: "#42a5f5", glow: "rgba(33,150,243,0.2)" },
    paid: { bg: "rgba(76,175,80,0.12)", text: "#66bb6a", glow: "rgba(76,175,80,0.2)" },
    overdue: { bg: "rgba(239,83,80,0.08)", text: "#ef5350", glow: "rgba(239,83,80,0.15)" },
    cancelled: { bg: "rgba(239,83,80,0.08)", text: "#ef5350", glow: "rgba(239,83,80,0.15)" },
  };
  const c = colors[status] || { bg: "rgba(255,255,255,0.06)", text: "#888", glow: "transparent" };
  return (
    <span style={{
      padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      letterSpacing: 0.8, textTransform: "uppercase",
      background: c.bg, color: c.text, boxShadow: `0 0 8px ${c.glow}`,
      whiteSpace: "nowrap",
    }}>
      {status}
    </span>
  );
}

// ─── Icon SVGs ───
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconSend = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconLink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

// ─── Main Export ───
export default function AdminInvoices({ userId, backRef }: { userId: string; backRef?: React.MutableRefObject<(() => boolean) | null> }) {
  // ─── State ───
  const [view, setView] = useState<"list" | "create" | "edit" | "detail">("list");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Invoice form state
  const [form, setForm] = useState({
    customer_id: "",
    invoice_number: generateInvoiceNumber(),
    due_date: getDefaultDueDate(),
    tax_rate: 0,
    notes: "",
    line_items: [{ id: createLineItemId(), description: "", quantity: 1, unit_price: 0, amount: 0 }] as InvoiceLineItem[],
  });

  // Send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendMethod, setSendMethod] = useState<"email" | "link">("email");
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // ─── Back button: updated synchronously every render (no useEffect timing gap) ───
  if (backRef) {
    backRef.current = () => {
      if (showSendModal) { setShowSendModal(false); return true; }
      if (view !== "list") { setView("list"); setSelectedInvoice(null); return true; }
      return false;
    };
  }

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Service preset picker
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [presetCategory, setPresetCategory] = useState<string | null>(null);

  // ─── Helpers ───
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const getPaymentLink = (invoice: Invoice | null): string => {
    if (!invoice) return "";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const customer = customers.find(c => c.id === invoice.customer_id);
    const params = new URLSearchParams({
      invoice: invoice.invoice_number,
      amount: invoice.total.toFixed(2),
      ...(customer?.name && { name: customer.name }),
      ...(customer?.email && { email: customer.email }),
      ...(customer?.phone && { phone: customer.phone }),
      ...(invoice.line_items?.[0]?.description && { service: invoice.line_items[0].description }),
      ...(invoice.notes && { description: invoice.notes }),
    });
    return `${baseUrl}/pay?${params.toString()}`;
  };

  // ─── API calls ───
  const adminFetch = useCallback(async (resource: string) => {
    if (!userId) return null;
    const params = new URLSearchParams({ clerk_user_id: userId, resource });
    const res = await fetch(`/api/admin/data?${params}`);
    if (!res.ok) return null;
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

  // ─── Load data ───
  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, custRes] = await Promise.all([
        adminFetch("invoices"),
        adminFetch("customers"),
      ]);
      if (invRes?.data) setInvoices(invRes.data);
      if (custRes?.data) setCustomers(custRes.data);
    } catch (err) {
      console.error("Failed to load invoices:", err);
    }
    setLoading(false);
  }, [adminFetch]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // ─── Line item calculations ───
  const updateLineItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setForm(prev => {
      const items = prev.line_items.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unit_price") {
          updated.amount = Number(updated.quantity) * Number(updated.unit_price);
        }
        return updated;
      });
      return { ...prev, line_items: items };
    });
  };

  const addLineItem = () => {
    setForm(prev => ({
      ...prev,
      line_items: [...prev.line_items, { id: createLineItemId(), description: "", quantity: 1, unit_price: 0, amount: 0 }],
    }));
  };

  const removeLineItem = (id: string) => {
    setForm(prev => ({
      ...prev,
      line_items: prev.line_items.filter(item => item.id !== id),
    }));
  };

  const addPresetItem = (description: string, unit_price: number) => {
    setForm(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items.filter(item => item.description || item.unit_price > 0),
        { id: createLineItemId(), description, quantity: 1, unit_price, amount: unit_price },
      ],
    }));
    setShowPresetPicker(false);
    setPresetCategory(null);
  };

  const subtotal = form.line_items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = subtotal * (form.tax_rate / 100);
  const total = subtotal + taxAmount;

  // ─── Save invoice ───
  const handleSaveInvoice = async (asDraft = true) => {
    if (!form.customer_id) {
      showToast("Please select a customer", "error");
      return;
    }
    if (!form.line_items.some(item => item.description && item.amount > 0)) {
      showToast("Add at least one line item", "error");
      return;
    }

    const payload: Record<string, unknown> = {
      customer_id: form.customer_id,
      invoice_number: form.invoice_number,
      due_date: form.due_date,
      tax_rate: form.tax_rate,
      tax_amount: taxAmount,
      subtotal,
      total,
      amount_paid: 0,
      notes: form.notes || null,
      status: asDraft ? "draft" : "sent",
      line_items: form.line_items.filter(item => item.description && item.amount > 0),
    };

    if (view === "edit" && selectedInvoice) {
      payload.id = selectedInvoice.id;
    }

    const action = view === "edit" ? "update" : "create";
    const res = await adminPost("invoices", action, payload);

    if (res?.success || res?.data) {
      showToast(view === "edit" ? "Invoice updated" : "Invoice created");
      await loadInvoices();

      if (!asDraft && res?.data) {
        setSelectedInvoice(res.data);
        setShowSendModal(true);
      }

      resetForm();
      setView("list");
    } else {
      showToast(res?.error || "Failed to save invoice", "error");
    }
  };

  // ─── Send invoice ───
  const handleSendInvoice = async (invoice: Invoice) => {
    if (!invoice) return;

    setSendingInvoice(true);
    const customer = customers.find(c => c.id === invoice.customer_id);

    if (sendMethod === "email" && customer?.email) {
      const paymentLink = getPaymentLink(invoice);

      // Format line items for email body
      const itemsList = invoice.line_items
        .map(item => `• ${item.description} — ${formatCurrency(item.amount)}`)
        .join("\n");

      const emailBody = `Hello ${customer.name || "there"},

You have a new invoice from Jenkins Home & Property Solutions.

Invoice #: ${invoice.invoice_number}
Due Date: ${formatDate(invoice.due_date)}

Services:
${itemsList}

${"─".repeat(40)}
Total Due: ${formatCurrency(invoice.total)}

Pay securely online:
${paymentLink}

Thank you for your business!

Jenkins Home & Property Solutions
📞 407-686-9817
✉️ Info@jhpsfl.com`;

      const res = await fetch("/api/email/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_user_id: userId,
          to_email: customer.email,
          subject: `Invoice ${invoice.invoice_number} from Jenkins Home & Property Solutions — ${formatCurrency(invoice.total)}`,
          body: emailBody,
        }),
      });

      if (res.ok) {
        // Update invoice status to "sent"
        await adminPost("invoices", "update", {
          id: invoice.id,
          status: "sent",
          sent_at: new Date().toISOString(),
          payment_link: paymentLink,
        });
        showToast(`Invoice sent to ${customer.email}`);
        await loadInvoices();
      } else {
        showToast("Failed to send email", "error");
      }
    }

    setSendingInvoice(false);
    setShowSendModal(false);
  };

  // ─── Mark as paid ───
  const handleMarkPaid = async (invoice: Invoice) => {
    const res = await adminPost("invoices", "update", {
      id: invoice.id,
      status: "paid",
      paid_date: new Date().toISOString(),
      amount_paid: invoice.total,
    });
    if (res?.success || res?.data) {
      showToast("Invoice marked as paid");
      await loadInvoices();
      if (selectedInvoice?.id === invoice.id) {
        setSelectedInvoice({ ...invoice, status: "paid", paid_date: new Date().toISOString(), amount_paid: invoice.total });
      }
    }
  };

  // ─── Delete invoice ───
  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!window.confirm(`Delete invoice ${invoice.invoice_number}? This cannot be undone.`)) return;
    const res = await adminPost("invoices", "delete", { id: invoice.id });
    if (res?.success) {
      showToast("Invoice deleted");
      await loadInvoices();
      if (selectedInvoice?.id === invoice.id) {
        setSelectedInvoice(null);
        setView("list");
      }
    } else {
      showToast(res?.error || "Failed to delete invoice", "error");
    }
  };

  // ─── Copy link ───
  const handleCopyLink = (invoice: Invoice) => {
    const link = getPaymentLink(invoice);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(true);
      showToast("Payment link copied!");
      setTimeout(() => setCopiedLink(false), 3000);
    });
  };

  // ─── Reset form ───
  const resetForm = () => {
    setForm({
      customer_id: "",
      invoice_number: generateInvoiceNumber(),
      due_date: getDefaultDueDate(),
      tax_rate: 0,
      notes: "",
      line_items: [{ id: createLineItemId(), description: "", quantity: 1, unit_price: 0, amount: 0 }],
    });
  };

  // ─── Edit invoice ───
  const startEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setForm({
      customer_id: invoice.customer_id,
      invoice_number: invoice.invoice_number,
      due_date: invoice.due_date || getDefaultDueDate(),
      tax_rate: invoice.tax_rate || 0,
      notes: invoice.notes || "",
      line_items: invoice.line_items?.length
        ? invoice.line_items.map(item => ({ ...item, id: item.id || createLineItemId() }))
        : [{ id: createLineItemId(), description: "", quantity: 1, unit_price: 0, amount: 0 }],
    });
    setView("edit");
  };

  // ─── Filter ───
  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus !== "all" && inv.status !== filterStatus) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const customer = inv.customers;
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      customer?.name?.toLowerCase().includes(q) ||
      customer?.email?.toLowerCase().includes(q) ||
      customer?.phone?.includes(q)
    );
  });

  // ─── Stats ───
  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === "draft").length,
    sent: invoices.filter(i => i.status === "sent").length,
    paid: invoices.filter(i => i.status === "paid").length,
    overdue: invoices.filter(i => i.status === "overdue").length,
    totalOwed: invoices.filter(i => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + i.total, 0),
    totalPaid: invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0),
  };

  // ─── Styles ───
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", background: "#0d1a0d",
    border: "1px solid #1a3a1a", borderRadius: 10, color: "#e8f5e8",
    fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5,
    textTransform: "uppercase", display: "block", marginBottom: 6,
  };

  // ─── RENDER ───
  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* ─── Toast ─── */}
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

      {/* ════════════════════════════════════════════
           INVOICE LIST VIEW
         ════════════════════════════════════════════ */}
      {view === "list" && (
        <>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 700 }}>
                Invoices
              </h1>
              <p style={{ color: "#5a8a5a", fontSize: 13, marginTop: 4 }}>
                Create, send, and track invoices
              </p>
            </div>
            <button
              onClick={() => { resetForm(); setView("create"); }}
              className="action-btn action-btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px" }}
            >
              <IconPlus /> New Invoice
            </button>
          </div>

          {/* Stats Row */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12, marginBottom: 24,
          }}>
            {[
              { label: "Outstanding", value: formatCurrency(stats.totalOwed), color: "#42a5f5", icon: "📄" },
              { label: "Paid (Total)", value: formatCurrency(stats.totalPaid), color: "#66bb6a", icon: "✓" },
              { label: "Draft", value: stats.draft.toString(), color: "#9e9e9e", icon: "✏️" },
              { label: "Sent", value: stats.sent.toString(), color: "#42a5f5", icon: "📨" },
              { label: "Overdue", value: stats.overdue.toString(), color: "#ef5350", icon: "⚠" },
            ].map(stat => (
              <div key={stat.label} style={{
                background: "linear-gradient(160deg, #0d1f0d, #091409)",
                border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 18px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{stat.icon}</span>
                  <span style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{stat.label}</span>
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 800, color: stat.color,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{
            display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center",
          }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#3a5a3a", fontSize: 14 }}>🔍</span>
              <input
                className="search-input"
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 36 }}
              />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["all", "draft", "sent", "paid", "overdue"].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  style={{
                    padding: "6px 14px", borderRadius: 8, border: "1px solid #1a3a1a",
                    background: filterStatus === status ? "rgba(76,175,80,0.15)" : "transparent",
                    color: filterStatus === status ? "#4CAF50" : "#5a8a5a",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize",
                    transition: "all 0.2s",
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Invoice Table */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#5a8a5a" }}>
              <div style={{ display: "inline-block", width: 20, height: 20, border: "2px solid #4CAF50", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <div style={{ marginTop: 12, fontSize: 13 }}>Loading invoices...</div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "linear-gradient(160deg, #0d1f0d, #091409)",
              border: "1px solid #1a3a1a", borderRadius: 20,
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#e8f5e8", fontWeight: 700, marginBottom: 8 }}>
                {searchQuery || filterStatus !== "all" ? "No matching invoices" : "No invoices yet"}
              </h3>
              <p style={{ color: "#5a8a5a", fontSize: 14, marginBottom: 24 }}>
                {searchQuery || filterStatus !== "all" ? "Try adjusting your filters." : "Create your first invoice to get started."}
              </p>
              {!searchQuery && filterStatus === "all" && (
                <button
                  onClick={() => { resetForm(); setView("create"); }}
                  className="action-btn action-btn-primary"
                  style={{ padding: "10px 24px" }}
                >
                  <IconPlus /> Create Invoice
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: 16, border: "1px solid #1a3a1a" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif" }}>
                <thead>
                  <tr style={{ background: "#0a160a" }}>
                    {["Invoice #", "Customer", "Status", "Amount", "Due Date", "Created", "Actions"].map(h => (
                      <th key={h} style={{
                        padding: "14px 12px", textAlign: "left", fontSize: 11,
                        color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5,
                        textTransform: "uppercase", borderBottom: "1px solid #1a3a1a",
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(inv => {
                    const customer = inv.customers || customers.find(c => c.id === inv.customer_id);
                    return (
                      <tr
                        key={inv.id}
                        style={{ cursor: "pointer", transition: "background 0.2s" }}
                        onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "rgba(76,175,80,0.04)"; }}
                        onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                        onClick={() => { setSelectedInvoice(inv); setView("detail"); }}
                      >
                        <td style={{ padding: "14px 12px", fontSize: 14, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid #0d1a0d" }}>
                          {inv.invoice_number}
                        </td>
                        <td style={{ padding: "14px 12px", fontSize: 14, color: "#c8e0c8", borderBottom: "1px solid #0d1a0d" }}>
                          {customer?.name || customer?.email || "—"}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #0d1a0d" }}>
                          <StatusBadge status={inv.status} />
                        </td>
                        <td style={{ padding: "14px 12px", fontSize: 14, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid #0d1a0d" }}>
                          {formatCurrency(inv.total)}
                        </td>
                        <td style={{ padding: "14px 12px", fontSize: 13, color: "#8aba8a", borderBottom: "1px solid #0d1a0d" }}>
                          {formatDate(inv.due_date)}
                        </td>
                        <td style={{ padding: "14px 12px", fontSize: 12, color: "#5a8a5a", borderBottom: "1px solid #0d1a0d" }}>
                          {timeAgo(inv.created_at)}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #0d1a0d" }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 4 }}>
                            {inv.status !== "paid" && (
                              <button
                                onClick={() => handleCopyLink(inv)}
                                title="Copy payment link"
                                className="quick-action"
                                style={{ display: "flex", alignItems: "center", gap: 4 }}
                              >
                                <IconLink /> Link
                              </button>
                            )}
                            {["draft", "sent", "overdue"].includes(inv.status) && (
                              <button
                                onClick={() => { setSelectedInvoice(inv); setShowSendModal(true); }}
                                title="Send invoice"
                                className="quick-action"
                                style={{ display: "flex", alignItems: "center", gap: 4 }}
                              >
                                <IconSend /> Send
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════
           CREATE / EDIT VIEW
         ════════════════════════════════════════════ */}
      {(view === "create" || view === "edit") && (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button
              onClick={() => { setView("list"); resetForm(); }}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: "none",
                border: "1px solid #1a3a1a", borderRadius: 10, padding: "8px 14px",
                color: "#5a8a5a", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <IconBack /> Back
            </button>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#e8f5e8", fontWeight: 700 }}>
              {view === "edit" ? "Edit Invoice" : "New Invoice"}
            </h1>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 340px", gap: 24, alignItems: "start" }}>
            {/* ─── Left: Form ─── */}
            <div style={{
              background: "linear-gradient(160deg, #0d1f0d, #091409)",
              border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px 24px",
            }}>
              {/* Customer & Invoice Info */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>Customer *</label>
                  <select
                    value={form.customer_id}
                    onChange={e => setForm(prev => ({ ...prev, customer_id: e.target.value }))}
                    style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                  >
                    <option value="">Select customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name || c.email || c.phone || "Unknown"}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Invoice #</label>
                  <input
                    value={form.invoice_number}
                    onChange={e => setForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                    style={{ ...inputStyle, colorScheme: "dark" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Tax Rate (%)</label>
                  <input
                    value={form.tax_rate}
                    onChange={e => setForm(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                    inputMode="decimal"
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>
              </div>

              {/* ─── Line Items ─── */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Line Items</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setShowPresetPicker(true)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 12px", borderRadius: 8,
                        background: "rgba(33,150,243,0.1)", border: "1px solid rgba(33,150,243,0.2)",
                        color: "#42a5f5", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      ⚡ Quick Add Service
                    </button>
                    <button
                      onClick={addLineItem}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "6px 12px", borderRadius: 8,
                        background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.2)",
                        color: "#4CAF50", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      <IconPlus /> Custom Item
                    </button>
                  </div>
                </div>

                {/* Line item header — desktop only */}
                {!isMobile && (
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 80px 100px 100px 36px",
                    gap: 8, padding: "8px 0", borderBottom: "1px solid #1a3a1a", marginBottom: 8,
                  }}>
                    <span style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Description</span>
                    <span style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Qty</span>
                    <span style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Rate</span>
                    <span style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", textAlign: "right" }}>Amount</span>
                    <span />
                  </div>
                )}

                {/* Line items */}
                {form.line_items.map((item, idx) => (
                  isMobile ? (
                    /* Mobile: card layout */
                    <div key={item.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1a3a1a", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                      <input
                        value={item.description}
                        onChange={e => updateLineItem(item.id, "description", e.target.value)}
                        placeholder="Service or item description"
                        style={{ ...inputStyle, padding: "10px 12px", fontSize: 13, width: "100%", boxSizing: "border-box", marginBottom: 8 }}
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "64px 1fr auto 32px", gap: 8, alignItems: "center" }}>
                        <input
                          value={item.quantity}
                          onChange={e => updateLineItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                          inputMode="numeric"
                          placeholder="Qty"
                          style={{ ...inputStyle, padding: "8px 8px", fontSize: 13, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}
                        />
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#4CAF50", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>$</span>
                          <input
                            value={item.unit_price || ""}
                            onChange={e => updateLineItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            inputMode="decimal"
                            style={{ ...inputStyle, padding: "8px 8px 8px 20px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", width: "100%", boxSizing: "border-box" }}
                          />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: item.amount > 0 ? "#4CAF50" : "#3a5a3a", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
                          {formatCurrency(item.amount)}
                        </div>
                        <button
                          onClick={() => removeLineItem(item.id)}
                          disabled={form.line_items.length === 1 && idx === 0}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: form.line_items.length === 1 && idx === 0 ? "#1a3a1a" : "#7a4a4a", cursor: form.line_items.length === 1 && idx === 0 ? "default" : "pointer" }}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Desktop: grid row */
                    <div
                      key={item.id}
                      style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 100px 36px", gap: 8, marginBottom: 8, alignItems: "center" }}
                    >
                      <input
                        value={item.description}
                        onChange={e => updateLineItem(item.id, "description", e.target.value)}
                        placeholder="Service or item description"
                        style={{ ...inputStyle, padding: "10px 12px", fontSize: 13 }}
                      />
                      <input
                        value={item.quantity}
                        onChange={e => updateLineItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                        inputMode="numeric"
                        style={{ ...inputStyle, padding: "10px 8px", fontSize: 13, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}
                      />
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#4CAF50", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>$</span>
                        <input
                          value={item.unit_price || ""}
                          onChange={e => updateLineItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          inputMode="decimal"
                          style={{ ...inputStyle, padding: "10px 8px 10px 20px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}
                        />
                      </div>
                      <div style={{ textAlign: "right", fontSize: 14, fontWeight: 700, color: item.amount > 0 ? "#4CAF50" : "#3a5a3a", fontFamily: "'JetBrains Mono', monospace", padding: "0 4px" }}>
                        {formatCurrency(item.amount)}
                      </div>
                      <button
                        onClick={() => removeLineItem(item.id)}
                        disabled={form.line_items.length === 1 && idx === 0}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: form.line_items.length === 1 && idx === 0 ? "#1a3a1a" : "#7a4a4a", cursor: form.line_items.length === 1 && idx === 0 ? "default" : "pointer", transition: "all 0.15s" }}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  )
                ))}
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes / Message to Customer</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Thank you for your business! Payment is due within 14 days."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button
                  onClick={() => handleSaveInvoice(true)}
                  style={{
                    flex: 1, padding: "14px", borderRadius: 12, border: "1px solid #1a3a1a",
                    background: "transparent", color: "#c8e0c8", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Save as Draft
                </button>
                <button
                  onClick={() => handleSaveInvoice(false)}
                  style={{
                    flex: 1, padding: "14px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
                    fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    boxShadow: "0 4px 20px rgba(76,175,80,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <IconSend /> Save & Send
                </button>
              </div>
            </div>

            {/* ─── Right: Live Preview ─── */}
            <div style={{
              background: "linear-gradient(160deg, #0d1f0d, #091409)",
              border: "1px solid #1a3a1a", borderRadius: 20, padding: "24px 20px",
              position: "sticky", top: 80,
            }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#e8f5e8", fontWeight: 700, marginBottom: 16 }}>
                Invoice Preview
              </h3>

              {/* Mini invoice card */}
              <div style={{
                background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 14,
                padding: "20px 16px", marginBottom: 16,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Invoice</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace" }}>
                      {form.invoice_number}
                    </div>
                  </div>
                  <StatusBadge status={view === "edit" ? (selectedInvoice?.status || "draft") : "draft"} />
                </div>

                <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Bill To</div>
                  <div style={{ fontSize: 13, color: "#c8e0c8" }}>
                    {form.customer_id
                      ? (customers.find(c => c.id === form.customer_id)?.name || "Customer Selected")
                      : "Select a customer..."
                    }
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 12 }}>
                  {form.line_items.filter(item => item.description).map(item => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8aba8a", marginBottom: 6 }}>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.description} {item.quantity > 1 ? `×${item.quantity}` : ""}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, marginLeft: 8 }}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  {form.line_items.filter(item => item.description).length === 0 && (
                    <div style={{ fontSize: 12, color: "#3a5a3a", fontStyle: "italic" }}>No items added yet</div>
                  )}
                </div>

                {form.tax_rate > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5a8a5a", marginTop: 8, paddingTop: 8, borderTop: "1px dashed #1a3a1a" }}>
                    <span>Tax ({form.tax_rate}%)</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(taxAmount)}</span>
                  </div>
                )}

                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  marginTop: 12, paddingTop: 12, borderTop: "2px solid #1a3a1a",
                }}>
                  <span style={{ fontSize: 12, color: "#7a9a7a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Total</span>
                  <span style={{
                    fontSize: 24, fontWeight: 800, color: "#4CAF50",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 11, color: "#3a5a3a", textAlign: "center" }}>
                Due: {form.due_date ? formatDate(form.due_date) : "Not set"}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
           DETAIL VIEW
         ════════════════════════════════════════════ */}
      {view === "detail" && selectedInvoice && (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button
              onClick={() => { setView("list"); setSelectedInvoice(null); }}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: "none",
                border: "1px solid #1a3a1a", borderRadius: 10, padding: "8px 14px",
                color: "#5a8a5a", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <IconBack /> Back
            </button>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#e8f5e8", fontWeight: 700, flex: 1 }}>
              Invoice {selectedInvoice.invoice_number}
            </h1>
            <StatusBadge status={selectedInvoice.status} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 24, alignItems: "start" }}>
            {/* Left: Invoice details */}
            <div style={{
              background: "linear-gradient(160deg, #0d1f0d, #091409)",
              border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px 24px",
              order: isMobile ? 1 : 0,
            }}>
              {/* Business header */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #1a3a1a" }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#4CAF50", marginBottom: 4 }}>
                    Jenkins Home & Property Solutions
                  </div>
                  <div style={{ fontSize: 12, color: "#5a8a5a", lineHeight: 1.8 }}>
                    Central Florida<br />
                    📞 407-686-9817<br />
                    ✉️ Info@jhpsfl.com
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#e8f5e8", fontFamily: "'Playfair Display', serif" }}>INVOICE</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
                    {selectedInvoice.invoice_number}
                  </div>
                  <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 8 }}>
                    Date: {formatDate(selectedInvoice.created_at)}<br />
                    Due: {formatDate(selectedInvoice.due_date)}
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Bill To</div>
                <div style={{ fontSize: 15, color: "#c8e0c8", fontWeight: 600 }}>
                  {selectedInvoice.customers?.name || "—"}
                </div>
                {selectedInvoice.customers?.email && (
                  <div style={{ fontSize: 13, color: "#5a8a5a" }}>{selectedInvoice.customers.email}</div>
                )}
                {selectedInvoice.customers?.phone && (
                  <div style={{ fontSize: 13, color: "#5a8a5a" }}>{selectedInvoice.customers.phone}</div>
                )}
              </div>

              {/* Line items table */}
              <div style={{ borderRadius: 12, border: "1px solid #1a3a1a", overflow: "hidden", marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0a160a" }}>
                      <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Description</th>
                      <th style={{ padding: "12px 14px", textAlign: "center", fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", width: 60 }}>Qty</th>
                      <th style={{ padding: "12px 14px", textAlign: "right", fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", width: 100 }}>Rate</th>
                      <th style={{ padding: "12px 14px", textAlign: "right", fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", width: 100 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedInvoice.line_items || []).map((item, idx) => (
                      <tr key={idx} style={{ borderTop: "1px solid #0d1a0d" }}>
                        <td style={{ padding: "12px 14px", fontSize: 14, color: "#c8e0c8" }}>{item.description}</td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "#8aba8a", textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}>{item.quantity}</td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "#8aba8a", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(item.unit_price)}</td>
                        <td style={{ padding: "12px 14px", fontSize: 14, color: "#4CAF50", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: 260 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "#8aba8a" }}>
                    <span>Subtotal</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  {selectedInvoice.tax_rate > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "#8aba8a" }}>
                      <span>Tax ({selectedInvoice.tax_rate}%)</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(selectedInvoice.tax_amount)}</span>
                    </div>
                  )}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    padding: "12px 0", borderTop: "2px solid #1a3a1a", marginTop: 4,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#e8f5e8" }}>Total</span>
                    <span style={{ fontSize: 26, fontWeight: 800, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatCurrency(selectedInvoice.total)}
                    </span>
                  </div>
                  {selectedInvoice.status === "paid" && (
                    <div style={{
                      display: "flex", justifyContent: "space-between", padding: "8px 0",
                      fontSize: 13, color: "#66bb6a", fontWeight: 600,
                    }}>
                      <span>Paid</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(selectedInvoice.amount_paid)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedInvoice.notes && (
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #1a3a1a" }}>
                  <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Notes</div>
                  <div style={{ fontSize: 13, color: "#8aba8a", lineHeight: 1.6 }}>{selectedInvoice.notes}</div>
                </div>
              )}
            </div>

            {/* Right: Actions sidebar — appears first on mobile */}
            <div style={{
              background: "linear-gradient(160deg, #0d1f0d, #091409)",
              border: "1px solid #1a3a1a", borderRadius: 20, padding: "24px 20px",
              position: isMobile ? "static" : "sticky", top: 80,
              order: isMobile ? 0 : 1,
            }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#e8f5e8", fontWeight: 700, marginBottom: 20 }}>
                Actions
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Send / Resend */}
                {["draft", "sent", "overdue"].includes(selectedInvoice.status) && (
                  <button
                    onClick={() => setShowSendModal(true)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "12px", borderRadius: 12, border: "none",
                      background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
                      fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      boxShadow: "0 4px 20px rgba(76,175,80,0.35)",
                    }}
                  >
                    <IconSend /> {selectedInvoice.status === "draft" ? "Send Invoice" : "Resend Invoice"}
                  </button>
                )}

                {/* Copy payment link */}
                {selectedInvoice.status !== "paid" && (
                  <button
                    onClick={() => handleCopyLink(selectedInvoice)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "12px", borderRadius: 12,
                      border: "1px solid rgba(33,150,243,0.3)",
                      background: "rgba(33,150,243,0.08)", color: "#42a5f5",
                      fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <IconCopy /> {copiedLink ? "Copied!" : "Copy Payment Link (for SMS)"}
                  </button>
                )}

                {/* Mark as paid */}
                {["sent", "overdue"].includes(selectedInvoice.status) && (
                  <button
                    onClick={() => handleMarkPaid(selectedInvoice)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "12px", borderRadius: 12,
                      border: "1px solid rgba(76,175,80,0.3)",
                      background: "rgba(76,175,80,0.08)", color: "#66bb6a",
                      fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    ✓ Mark as Paid
                  </button>
                )}

                {/* Edit */}
                {["draft", "sent"].includes(selectedInvoice.status) && (
                  <button
                    onClick={() => startEditInvoice(selectedInvoice)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "12px", borderRadius: 12,
                      border: "1px solid #1a3a1a", background: "transparent",
                      color: "#8aba8a", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <IconEdit /> Edit Invoice
                  </button>
                )}

                {/* Delete */}
                <button
                  onClick={() => handleDeleteInvoice(selectedInvoice)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "12px", borderRadius: 12,
                    border: "1px solid rgba(239,83,80,0.2)", background: "transparent",
                    color: "#ef5350", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <IconTrash /> Delete Invoice
                </button>
              </div>

              {/* Sent info */}
              {selectedInvoice.sent_at && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #1a3a1a" }}>
                  <div style={{ fontSize: 11, color: "#5a8a5a" }}>
                    📨 Sent: {formatDate(selectedInvoice.sent_at)}
                  </div>
                </div>
              )}
              {selectedInvoice.paid_date && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: "#66bb6a" }}>
                    ✓ Paid: {formatDate(selectedInvoice.paid_date)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
           SEND MODAL
         ════════════════════════════════════════════ */}
      {showSendModal && selectedInvoice && (
        <div
          onClick={() => setShowSendModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20, backdropFilter: "blur(8px)", animation: "fadeIn 0.2s ease",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "linear-gradient(160deg, #0d1f0d, #091409)",
              border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px 24px",
              maxWidth: 480, width: "100%", boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
              animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#e8f5e8", fontWeight: 700 }}>
                Send Invoice
              </h3>
              <button
                onClick={() => setShowSendModal(false)}
                style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 22, cursor: "pointer" }}
              >✕</button>
            </div>

            {/* Invoice summary */}
            <div style={{
              background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 12,
              padding: "14px 16px", marginBottom: 20,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "#5a8a5a" }}>{selectedInvoice.invoice_number}</span>
                <span style={{ color: "#4CAF50", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatCurrency(selectedInvoice.total)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 4 }}>
                To: {selectedInvoice.customers?.name || "Customer"} ({selectedInvoice.customers?.email || "No email"})
              </div>
            </div>

            {/* Send method tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => setSendMethod("email")}
                style={{
                  flex: 1, padding: "12px", borderRadius: 10,
                  border: "1px solid " + (sendMethod === "email" ? "rgba(76,175,80,0.3)" : "#1a3a1a"),
                  background: sendMethod === "email" ? "rgba(76,175,80,0.1)" : "transparent",
                  color: sendMethod === "email" ? "#4CAF50" : "#5a8a5a",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                ✉️ Send via Email
              </button>
              <button
                onClick={() => setSendMethod("link")}
                style={{
                  flex: 1, padding: "12px", borderRadius: 10,
                  border: "1px solid " + (sendMethod === "link" ? "rgba(33,150,243,0.3)" : "#1a3a1a"),
                  background: sendMethod === "link" ? "rgba(33,150,243,0.1)" : "transparent",
                  color: sendMethod === "link" ? "#42a5f5" : "#5a8a5a",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                🔗 Copy Link (SMS)
              </button>
            </div>

            {sendMethod === "email" ? (
              <>
                {selectedInvoice.customers?.email ? (
                  <div>
                    <div style={{
                      background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.15)",
                      borderRadius: 10, padding: "14px 16px", marginBottom: 16,
                      fontSize: 13, color: "#8aba8a", lineHeight: 1.6,
                    }}>
                      A professional invoice email will be sent to <strong style={{ color: "#4CAF50" }}>{selectedInvoice.customers.email}</strong> with
                      a secure payment link. The customer can pay directly from the email.
                    </div>
                    <button
                      onClick={() => handleSendInvoice(selectedInvoice)}
                      disabled={sendingInvoice}
                      style={{
                        width: "100%", padding: "14px", borderRadius: 12, border: "none",
                        background: sendingInvoice ? "#1a3a1a" : "linear-gradient(135deg, #4CAF50, #2E7D32)",
                        color: "#fff", fontSize: 15, fontWeight: 700, cursor: sendingInvoice ? "default" : "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                        boxShadow: sendingInvoice ? "none" : "0 4px 20px rgba(76,175,80,0.35)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      {sendingInvoice ? (
                        <>
                          <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                          Sending...
                        </>
                      ) : (
                        <><IconSend /> Send Invoice Email</>
                      )}
                    </button>
                  </div>
                ) : (
                  <div style={{
                    background: "rgba(239,83,80,0.06)", border: "1px solid rgba(239,83,80,0.15)",
                    borderRadius: 10, padding: "14px 16px",
                    fontSize: 13, color: "#ef9a9a",
                  }}>
                    ⚠ This customer doesn&apos;t have an email on file. Use the &quot;Copy Link&quot; option instead, or update the customer&apos;s email first.
                  </div>
                )}
              </>
            ) : (
              <div>
                <div style={{
                  background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 10,
                  padding: "12px 14px", marginBottom: 16, wordBreak: "break-all",
                  fontSize: 12, color: "#8aba8a", fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.6, maxHeight: 100, overflowY: "auto",
                }}>
                  {getPaymentLink(selectedInvoice)}
                </div>
                <button
                  onClick={() => {
                    handleCopyLink(selectedInvoice);
                    // Also update status to sent
                    adminPost("invoices", "update", {
                      id: selectedInvoice.id,
                      status: selectedInvoice.status === "draft" ? "sent" : selectedInvoice.status,
                      payment_link: getPaymentLink(selectedInvoice),
                    }).then(() => loadInvoices());
                  }}
                  style={{
                    width: "100%", padding: "14px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #42a5f5, #1565c0)", color: "#fff",
                    fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    boxShadow: "0 4px 20px rgba(33,150,243,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <IconCopy /> Copy Payment Link
                </button>
                <p style={{ fontSize: 12, color: "#5a8a5a", marginTop: 10, textAlign: "center" }}>
                  Paste this link into a text message to your customer
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
           SERVICE PRESET PICKER MODAL
         ════════════════════════════════════════════ */}
      {showPresetPicker && (
        <div
          onClick={() => { setShowPresetPicker(false); setPresetCategory(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20, backdropFilter: "blur(8px)", animation: "fadeIn 0.2s ease",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "linear-gradient(160deg, #0d1f0d, #091409)",
              border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px 24px",
              maxWidth: 560, width: "100%", maxHeight: "80vh", overflowY: "auto",
              boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
              animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#e8f5e8", fontWeight: 700 }}>
                {presetCategory ? presetCategory : "Quick Add Service"}
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                {presetCategory && (
                  <button
                    onClick={() => setPresetCategory(null)}
                    style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 13, cursor: "pointer" }}
                  >← Back</button>
                )}
                <button
                  onClick={() => { setShowPresetPicker(false); setPresetCategory(null); }}
                  style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 22, cursor: "pointer" }}
                >✕</button>
              </div>
            </div>

            {!presetCategory ? (
              /* Category grid */
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {SERVICE_PRESETS.map(cat => (
                  <button
                    key={cat.category}
                    onClick={() => setPresetCategory(cat.category)}
                    style={{
                      padding: "18px 16px", borderRadius: 14, border: "1px solid #1a3a1a",
                      background: "#0a160a", cursor: "pointer",
                      textAlign: "left", transition: "all 0.2s",
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = "#4CAF50"; e.currentTarget.style.background = "rgba(76,175,80,0.06)"; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = "#1a3a1a"; e.currentTarget.style.background = "#0a160a"; }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#e8f5e8", marginBottom: 4 }}>
                      {cat.category}
                    </div>
                    <div style={{ fontSize: 12, color: "#5a8a5a" }}>
                      {cat.items.length} services
                    </div>
                  </button>
                ))}
                {/* Custom item option */}
                <button
                  onClick={() => { setShowPresetPicker(false); addLineItem(); }}
                  style={{
                    padding: "18px 16px", borderRadius: 14,
                    border: "1px dashed rgba(76,175,80,0.3)",
                    background: "rgba(76,175,80,0.04)", cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#4CAF50", marginBottom: 4 }}>
                    ✏️ Custom Item
                  </div>
                  <div style={{ fontSize: 12, color: "#5a8a5a" }}>
                    Repair, upgrade, website, etc.
                  </div>
                </button>
              </div>
            ) : (
              /* Service items list */
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {SERVICE_PRESETS.find(c => c.category === presetCategory)?.items.map(item => (
                  <button
                    key={item.description}
                    onClick={() => addPresetItem(item.description, item.unit_price)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "14px 16px", borderRadius: 10, border: "1px solid #1a3a1a",
                      background: "#0a160a", cursor: "pointer", textAlign: "left",
                      transition: "all 0.2s",
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = "#4CAF50"; e.currentTarget.style.background = "rgba(76,175,80,0.06)"; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = "#1a3a1a"; e.currentTarget.style.background = "#0a160a"; }}
                  >
                    <span style={{ fontSize: 14, color: "#c8e0c8" }}>{item.description}</span>
                    <span style={{
                      fontSize: 14, fontWeight: 700, color: "#4CAF50",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {formatCurrency(item.unit_price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Styles ─── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: none; } }

        @media (max-width: 768px) {
          .invoice-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
