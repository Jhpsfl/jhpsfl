"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Invoice, InvoiceLineItem, Customer, CustomerJob, PaymentTerms, PaymentScheduleItem } from "./components/invoices/invoiceTypes";
import { generateInvoiceNumber, formatCurrency, getDefaultDueDate, createLineItemId, getDisclaimer } from "./components/invoices/invoiceHelpers";
import InvoiceListView from "./components/invoices/InvoiceListView";
import InvoiceForm from "./components/invoices/InvoiceForm";
import InvoiceDetailView from "./components/invoices/InvoiceDetailView";
import SendInvoiceModal from "./components/invoices/SendInvoiceModal";
import ServicePresetPicker from "./components/invoices/ServicePresetPicker";
import ConfirmDeleteModal from "./components/invoices/ConfirmDeleteModal";
import RecordPaymentModal from "./components/invoices/RecordPaymentModal";
import PdfPreviewModal from "./components/PdfPreviewModal";

// Re-export types for external consumers
export type { Invoice, InvoiceLineItem, Customer, CustomerJob } from "./components/invoices/invoiceTypes";

// ─── Main Export ───
export default function AdminInvoices({ userId, backRef, onNavigate, createRef, initialInvoiceId, onInitialInvoiceConsumed, initialCustomerId, onInitialCustomerConsumed }: { userId: string; backRef?: React.MutableRefObject<(() => boolean) | null>; onNavigate?: () => void; createRef?: React.MutableRefObject<((preselectedCustomerId?: string) => void) | null>; initialInvoiceId?: string | null; onInitialInvoiceConsumed?: () => void; initialCustomerId?: string | null; onInitialCustomerConsumed?: () => void }) {
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

  // New-customer mini-modal (inline in create/edit form)
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: "", email: "", phone: "", customer_type: "residential" as "residential" | "commercial", company_name: "" });
  const [savingNewCustomer, setSavingNewCustomer] = useState(false);

  // Invoice form state — now includes payment_terms
  const [form, setForm] = useState({
    customer_id: null as string | null,
    invoice_number: generateInvoiceNumber(),
    due_date: getDefaultDueDate(),
    show_due_date: true,
    tax_rate: 0,
    notes: "",
    line_items: [{ id: createLineItemId(), description: "", quantity: 1, unit_price: 0, amount: 0 }] as InvoiceLineItem[],
    payment_terms: null as PaymentTerms | null,
  });

  // Send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendMethod, setSendMethod] = useState<"email" | "link">("email");
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Confirm delete modal
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState<Invoice | null>(null);

  // Record payment modal
  const [recordPaymentItem, setRecordPaymentItem] = useState<PaymentScheduleItem | null>(null);

  // PDF preview
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const closePdfPreview = useCallback(() => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setShowPdfPreview(false);
    setPdfPreviewUrl(null);
  }, [pdfPreviewUrl]);

  // Jobs for the currently selected customer
  const [customerJobs, setCustomerJobs] = useState<CustomerJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // ─── Back button ───
  if (backRef) {
    backRef.current = () => {
      if (showPdfPreview) { closePdfPreview(); return true; }
      if (recordPaymentItem) { setRecordPaymentItem(null); return true; }
      if (confirmDeleteInvoice) { setConfirmDeleteInvoice(null); return true; }
      if (showNewCustomer) { setShowNewCustomer(false); return true; }
      if (showSendModal) { setShowSendModal(false); return true; }
      if (view !== "list") { setView("list"); setSelectedInvoice(null); return true; }
      return false;
    };
  }

  // ─── Create trigger ───
  if (createRef) {
    createRef.current = (preselectedCustomerId?: string) => {
      if (preselectedCustomerId) {
        setForm(prev => ({ ...prev, customer_id: preselectedCustomerId }));
      }
      setView("create");
      onNavigate?.();
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
    const customer = invoice.customer_id ? customers.find(c => c.id === invoice.customer_id) : null;
    const params = new URLSearchParams({
      invoice: invoice.invoice_number,
      amount: invoice.total.toFixed(2),
      ...(customer?.name && { name: customer.name }),
      ...(customer?.email && { email: customer.email }),
      ...(customer?.phone && { phone: customer.phone }),
      ...(invoice.line_items?.[0]?.description && { service: invoice.line_items[0].description }),
      ...(invoice.notes && { description: invoice.notes }),
    });

    // If payment terms with deposit, show next unpaid amount in link
    if (invoice.payment_terms && invoice.payment_terms.type !== "full") {
      const nextPayment = invoice.payment_terms.schedule.find(s => s.status !== "paid");
      if (nextPayment) {
        params.set("amount", nextPayment.amount.toFixed(2));
        params.set("payment_label", nextPayment.label);
      }
    }

    return `${baseUrl}/pay?${params.toString()}`;
  };

  // ─── PDF Preview ───
  const handlePreviewInvoicePdf = async (invoice: Invoice) => {
    setShowPdfPreview(true);
    setPdfPreviewLoading(true);
    setPdfPreviewUrl(null);
    onNavigate?.();

    const customer = invoice.customer_id ? customers.find(c => c.id === invoice.customer_id) : null;
    try {
      const res = await fetch("/api/pdf/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_user_id: userId,
          type: "invoice",
          data: {
            invoice_number: invoice.invoice_number,
            created_at: invoice.created_at,
            due_date: invoice.due_date,
            status: invoice.status,
            customer_name: customer?.name || invoice.customers?.name || "Customer",
            customer_email: customer?.email || invoice.customers?.email || "",
            customer_phone: customer?.phone || invoice.customers?.phone || "",
            line_items: invoice.line_items,
            subtotal: invoice.subtotal,
            tax_amount: invoice.tax_amount,
            total: invoice.total,
            payment_link: invoice.payment_link || getPaymentLink(invoice),
            notes: invoice.notes,
            payment_terms: invoice.payment_terms || null,
          },
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        setPdfPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error("PDF preview error:", err);
    }
    setPdfPreviewLoading(false);
  };

  const handlePreviewFormPdf = async () => {
    setShowPdfPreview(true);
    setPdfPreviewLoading(true);
    setPdfPreviewUrl(null);
    onNavigate?.();

    const customer = form.customer_id ? customers.find(c => c.id === form.customer_id) : null;
    const lineItems = form.line_items.filter(item => item.description && item.amount > 0);
    try {
      const res = await fetch("/api/pdf/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_user_id: userId,
          type: "invoice",
          data: {
            invoice_number: form.invoice_number,
            created_at: new Date().toISOString(),
            due_date: form.show_due_date ? form.due_date : null,
            status: "draft",
            customer_name: customer?.name || "Customer",
            customer_email: customer?.email || "",
            customer_phone: customer?.phone || "",
            line_items: lineItems,
            subtotal,
            tax_amount: taxAmount,
            total,
            notes: form.notes,
            payment_terms: form.payment_terms || null,
          },
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        setPdfPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error("PDF preview error:", err);
    }
    setPdfPreviewLoading(false);
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

  // ─── Create new customer inline ───
  const handleCreateNewCustomer = async () => {
    if (!newCustomerForm.name.trim()) { showToast("Name is required", "error"); return; }
    setSavingNewCustomer(true);
    const res = await adminPost("customers", "create", {
      name: newCustomerForm.name.trim(),
      email: newCustomerForm.email.trim() || null,
      phone: newCustomerForm.phone.trim() || null,
      customer_type: newCustomerForm.customer_type,
      company_name: newCustomerForm.company_name.trim() || null,
    });
    setSavingNewCustomer(false);
    if (res?.data?.id || res?.success) {
      const newId = res.data?.id || res.id;
      const custRes = await adminFetch("customers");
      if (custRes?.data) setCustomers(custRes.data);
      if (newId) setForm(prev => ({ ...prev, customer_id: newId }));
      setShowNewCustomer(false);
      setNewCustomerForm({ name: "", email: "", phone: "", customer_type: "residential", company_name: "" });
      showToast("Customer created");
    } else {
      showToast(res?.error || "Failed to create customer", "error");
    }
  };

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

  // ─── Fetch jobs when customer changes ───
  useEffect(() => {
    const cid = form.customer_id;
    if (!cid || !userId) { setCustomerJobs([]); return; }
    setLoadingJobs(true);
    const params = new URLSearchParams({ clerk_user_id: userId, resource: "customer_detail", customer_id: cid });
    fetch(`/api/admin/data?${params}`)
      .then(r => r.json())
      .then(d => { setCustomerJobs(d?.jobs || []); })
      .catch(() => setCustomerJobs([]))
      .finally(() => setLoadingJobs(false));
  }, [form.customer_id, userId]);

  // ─── Auto-fill line items from a job ───
  const handleJobAutoFill = (job: CustomerJob) => {
    const lines: InvoiceLineItem[] = [];
    if (job.amount && job.amount > 0) {
      lines.push({ id: createLineItemId(), description: job.service_type, quantity: 1, unit_price: job.amount, amount: job.amount });
    } else {
      lines.push({ id: createLineItemId(), description: job.service_type, quantity: 1, unit_price: 0, amount: 0 });
    }
    const notes = [job.description, job.crew_notes, job.admin_notes].filter(Boolean).join(" — ");
    setForm(prev => ({ ...prev, line_items: lines, notes: notes || prev.notes }));
  };

  // ─── Auto-open a specific invoice ───
  useEffect(() => {
    if (!initialInvoiceId || loading) return;
    const inv = invoices.find(i => i.id === initialInvoiceId);
    if (inv) {
      setSelectedInvoice(inv);
      setView("detail");
      onNavigate?.();
      onInitialInvoiceConsumed?.();
    }
  }, [initialInvoiceId, invoices, loading, onNavigate, onInitialInvoiceConsumed]);

  // ─── Auto-open create form pre-filled with customer ───
  useEffect(() => {
    if (!initialCustomerId) return;
    setForm(prev => ({ ...prev, customer_id: initialCustomerId }));
    setView("create");
    onNavigate?.();
    onInitialCustomerConsumed?.();
  }, [initialCustomerId, onNavigate, onInitialCustomerConsumed]);

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
    setForm(prev => ({ ...prev, line_items: prev.line_items.filter(item => item.id !== id) }));
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
    if (!form.line_items.some(item => item.description && item.amount > 0)) {
      showToast("Add at least one line item", "error");
      return;
    }

    // Build notes — append legal disclaimer if payment terms are set
    let finalNotes = form.notes || "";
    if (form.payment_terms && form.payment_terms.type !== "full") {
      const disclaimer = getDisclaimer(form.payment_terms.type);
      if (disclaimer && !finalNotes.includes(disclaimer)) {
        finalNotes = finalNotes ? `${finalNotes}\n\n${disclaimer}` : disclaimer;
      }
    }

    const payload: Record<string, unknown> = {
      customer_id: (form.customer_id && form.customer_id !== "__link_only__") ? form.customer_id : null,
      invoice_number: form.invoice_number,
      due_date: form.show_due_date ? form.due_date : null,
      tax_rate: form.tax_rate,
      tax_amount: taxAmount,
      subtotal,
      total,
      amount_paid: 0,
      notes: finalNotes || null,
      status: asDraft ? "draft" : "sent",
      line_items: form.line_items.filter(item => item.description && item.amount > 0),
      payment_terms: form.payment_terms || null,
    };

    if (view === "edit" && selectedInvoice) {
      payload.id = selectedInvoice.id;
      // Preserve existing amount_paid when editing
      payload.amount_paid = selectedInvoice.amount_paid || 0;
    }

    const action = view === "edit" ? "update" : "create";
    const res = await adminPost("invoices", action, payload);

    if (res?.success || res?.data) {
      await loadInvoices();

      if (!asDraft && res?.data && (!form.customer_id || form.customer_id === "__link_only__")) {
        const link = getPaymentLink(res.data);
        navigator.clipboard.writeText(link).then(() => {
          showToast("Invoice created — payment link copied to clipboard!");
        }).catch(() => {
          showToast("Invoice created! Copy the payment link from the invoice detail.");
        });
        setSelectedInvoice(res.data);
        setView("detail");
        resetForm();
        return;
      }

      showToast(view === "edit" ? "Invoice updated" : "Invoice created");

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
    const customer = invoice.customer_id ? customers.find(c => c.id === invoice.customer_id) : null;

    if (sendMethod === "email" && customer?.email) {
      const paymentLink = getPaymentLink(invoice);

      const res = await fetch("/api/invoice/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_user_id: userId,
          invoice,
          customer,
          payment_link: paymentLink,
        }),
      });

      if (res.ok) {
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

  // ─── Record payment against a schedule item ───
  const handleRecordPayment = async (data: {
    scheduleItemId: string;
    paid_amount: number;
    payment_method: string;
    paid_date: string;
    notes: string;
  }) => {
    if (!selectedInvoice || !selectedInvoice.payment_terms) return;

    // Update the schedule item locally
    const updatedSchedule = selectedInvoice.payment_terms.schedule.map(item => {
      if (item.id !== data.scheduleItemId) return item;
      return {
        ...item,
        status: data.paid_amount >= item.amount ? "paid" as const : "pending" as const,
        paid_amount: data.paid_amount,
        paid_date: data.paid_date,
        payment_method: data.payment_method,
        notes: data.notes || item.notes,
      };
    });

    const updatedTerms: PaymentTerms = {
      ...selectedInvoice.payment_terms,
      schedule: updatedSchedule,
    };

    // Calculate total amount paid across all schedule items
    const totalPaid = updatedSchedule.reduce((sum, item) => sum + item.paid_amount, 0);
    const allPaid = updatedSchedule.every(item => item.status === "paid");

    // Determine invoice status
    let newStatus: string = selectedInvoice.status;
    if (allPaid) {
      newStatus = "paid";
    } else if (totalPaid > 0) {
      newStatus = "partial";
    }

    const res = await adminPost("invoices", "update", {
      id: selectedInvoice.id,
      payment_terms: updatedTerms,
      amount_paid: totalPaid,
      status: newStatus,
      ...(allPaid ? { paid_date: new Date().toISOString() } : {}),
    });

    if (res?.success || res?.data) {
      showToast(`Payment of ${formatCurrency(data.paid_amount)} recorded`);

      // Update local state immediately
      const updatedInvoice: Invoice = {
        ...selectedInvoice,
        payment_terms: updatedTerms,
        amount_paid: totalPaid,
        status: newStatus as Invoice["status"],
        ...(allPaid ? { paid_date: new Date().toISOString() } : {}),
      };
      setSelectedInvoice(updatedInvoice);

      await loadInvoices();
    } else {
      showToast(res?.error || "Failed to record payment", "error");
    }

    setRecordPaymentItem(null);
  };

  // ─── Delete invoice ───
  const handleDeleteInvoice = (invoice: Invoice) => {
    setConfirmDeleteInvoice(invoice);
  };

  const confirmDeleteInvoiceAction = async () => {
    if (!confirmDeleteInvoice) return;
    const invoice = confirmDeleteInvoice;
    setConfirmDeleteInvoice(null);
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
      customer_id: null,
      invoice_number: generateInvoiceNumber(),
      due_date: getDefaultDueDate(),
      show_due_date: true,
      tax_rate: 0,
      notes: "",
      line_items: [{ id: createLineItemId(), description: "", quantity: 1, unit_price: 0, amount: 0 }],
      payment_terms: null,
    });
  };

  // ─── Edit invoice ───
  const startEditInvoice = (invoice: Invoice) => {
    onNavigate?.();
    setSelectedInvoice(invoice);
    setForm({
      customer_id: invoice.customer_id || null,
      invoice_number: invoice.invoice_number,
      due_date: invoice.due_date || getDefaultDueDate(),
      show_due_date: !!invoice.due_date,
      tax_rate: invoice.tax_rate || 0,
      notes: invoice.notes || "",
      line_items: invoice.line_items?.length
        ? invoice.line_items.map(item => ({ ...item, id: item.id || createLineItemId() }))
        : [{ id: createLineItemId(), description: "", quantity: 1, unit_price: 0, amount: 0 }],
      payment_terms: invoice.payment_terms || null,
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
    totalOwed: invoices.filter(i => ["sent", "overdue", "partial"].includes(i.status)).reduce((s, i) => s + (i.total - i.amount_paid), 0),
    totalPaid: invoices.filter(i => ["paid", "partial"].includes(i.status)).reduce((s, i) => s + i.amount_paid, 0),
  };

  // ─── RENDER ───
  return (
    <div style={{ animation: "fadeIn 0.3s ease", overflowX: "hidden", maxWidth: "100%" }}>
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

      {view === "list" && (
        <InvoiceListView
          invoices={invoices}
          customers={customers}
          filteredInvoices={filteredInvoices}
          stats={stats}
          loading={loading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          onCreateNew={() => { onNavigate?.(); resetForm(); setView("create"); }}
          onViewDetail={(inv) => { onNavigate?.(); setSelectedInvoice(inv); setView("detail"); }}
          onCopyLink={handleCopyLink}
          onSend={(inv) => { onNavigate?.(); setSelectedInvoice(inv); setShowSendModal(true); }}
          onDelete={handleDeleteInvoice}
          onNavigate={onNavigate}
        />
      )}

      {(view === "create" || view === "edit") && (
        <InvoiceForm
          view={view}
          isMobile={isMobile}
          form={form}
          setForm={setForm}
          customers={customers}
          selectedInvoice={selectedInvoice}
          customerJobs={customerJobs}
          loadingJobs={loadingJobs}
          showNewCustomer={showNewCustomer}
          setShowNewCustomer={setShowNewCustomer}
          newCustomerForm={newCustomerForm}
          setNewCustomerForm={setNewCustomerForm}
          savingNewCustomer={savingNewCustomer}
          subtotal={subtotal}
          taxAmount={taxAmount}
          total={total}
          onBack={() => { setView("list"); resetForm(); }}
          onSave={handleSaveInvoice}
          onCreateNewCustomer={handleCreateNewCustomer}
          onJobAutoFill={handleJobAutoFill}
          updateLineItem={updateLineItem}
          addLineItem={addLineItem}
          removeLineItem={removeLineItem}
          onShowPresetPicker={() => setShowPresetPicker(true)}
          onNavigate={onNavigate}
          onPreviewPdf={handlePreviewFormPdf}
        />
      )}

      {view === "detail" && selectedInvoice && (
        <InvoiceDetailView
          invoice={selectedInvoice}
          isMobile={isMobile}
          copiedLink={copiedLink}
          onBack={() => { setView("list"); setSelectedInvoice(null); }}
          onSend={() => setShowSendModal(true)}
          onCopyLink={handleCopyLink}
          onMarkPaid={handleMarkPaid}
          onEdit={startEditInvoice}
          onDelete={handleDeleteInvoice}
          onNavigate={onNavigate}
          onRecordPayment={(item) => setRecordPaymentItem(item)}
          onPreviewPdf={() => handlePreviewInvoicePdf(selectedInvoice)}
          onUpdateSettings={async (settings) => {
            await adminPost("invoices", "update", { id: selectedInvoice.id, ...settings });
            await loadInvoices();
          }}
        />
      )}

      {showSendModal && selectedInvoice && (
        <SendInvoiceModal
          invoice={selectedInvoice}
          customers={customers}
          sendMethod={sendMethod}
          setSendMethod={setSendMethod}
          sendingInvoice={sendingInvoice}
          copiedLink={copiedLink}
          onSend={handleSendInvoice}
          onCopyLink={handleCopyLink}
          onClose={() => setShowSendModal(false)}
          getPaymentLink={getPaymentLink}
          adminPost={adminPost}
          loadInvoices={loadInvoices}
        />
      )}

      {showPresetPicker && (
        <ServicePresetPicker
          presetCategory={presetCategory}
          setPresetCategory={setPresetCategory}
          onAddPreset={addPresetItem}
          onAddCustomItem={addLineItem}
          onClose={() => setShowPresetPicker(false)}
        />
      )}

      {confirmDeleteInvoice && (
        <ConfirmDeleteModal
          invoice={confirmDeleteInvoice}
          onConfirm={confirmDeleteInvoiceAction}
          onClose={() => setConfirmDeleteInvoice(null)}
        />
      )}

      {recordPaymentItem && (
        <RecordPaymentModal
          scheduleItem={recordPaymentItem}
          onConfirm={handleRecordPayment}
          onClose={() => setRecordPaymentItem(null)}
        />
      )}

      {showPdfPreview && (
        <PdfPreviewModal
          pdfUrl={pdfPreviewUrl}
          loading={pdfPreviewLoading}
          onClose={closePdfPreview}
        />
      )}

      {/* Styles */}
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
