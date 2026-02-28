"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Quote, QuoteLineItem, Customer, CustomerJob } from "./components/quotes/quoteTypes";
import { generateQuoteNumber, formatCurrency, getDefaultExpirationDate, createLineItemId } from "./components/quotes/quoteHelpers";
import QuoteListView from "./components/quotes/QuoteListView";
import QuoteForm from "./components/quotes/QuoteForm";
import QuoteDetailView from "./components/quotes/QuoteDetailView";
import SendQuoteModal from "./components/quotes/SendQuoteModal";
import ServicePresetPicker from "./components/invoices/ServicePresetPicker";
import ConfirmDeleteModal from "./components/invoices/ConfirmDeleteModal";

// Re-export types for external consumers
export type { Quote, QuoteLineItem, Customer, CustomerJob } from "./components/quotes/quoteTypes";

// ─── Main Export ───
export default function AdminQuotes({ userId, backRef, onNavigate, onSwitchToInvoice }: {
  userId: string;
  backRef?: React.MutableRefObject<(() => boolean) | null>;
  onNavigate?: () => void;
  onSwitchToInvoice?: (invoiceId: string) => void;
}) {
  // ─── State ───
  const [view, setView] = useState<"list" | "create" | "edit" | "detail">("list");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New-customer mini-modal
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: "", email: "", phone: "" });
  const [savingNewCustomer, setSavingNewCustomer] = useState(false);

  // Quote form state
  const [form, setForm] = useState({
    customer_id: null as string | null,
    quote_number: generateQuoteNumber(),
    expiration_date: getDefaultExpirationDate(),
    show_expiration: true,
    tax_rate: 0,
    notes: "",
    line_items: [{ id: createLineItemId(), description: "", quantity: 1, unit_price: 0, amount: 0 }] as QuoteLineItem[],
    show_financing: false,
  });

  // Send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendingQuote, setSendingQuote] = useState(false);

  // Confirm delete
  const [confirmDeleteQuote, setConfirmDeleteQuote] = useState<Quote | null>(null);

  // Jobs for the currently selected customer
  const [customerJobs, setCustomerJobs] = useState<CustomerJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // ─── Back button ───
  if (backRef) {
    backRef.current = () => {
      if (confirmDeleteQuote) { setConfirmDeleteQuote(null); return true; }
      if (showNewCustomer) { setShowNewCustomer(false); return true; }
      if (showSendModal) { setShowSendModal(false); return true; }
      if (view !== "list") { setView("list"); setSelectedQuote(null); return true; }
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
    });
    setSavingNewCustomer(false);
    if (res?.data?.id || res?.success) {
      const newId = res.data?.id || res.id;
      const custRes = await adminFetch("customers");
      if (custRes?.data) setCustomers(custRes.data);
      if (newId) setForm(prev => ({ ...prev, customer_id: newId }));
      setShowNewCustomer(false);
      setNewCustomerForm({ name: "", email: "", phone: "" });
      showToast("Customer created");
    } else {
      showToast(res?.error || "Failed to create customer", "error");
    }
  };

  // ─── Load data ───
  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, custRes] = await Promise.all([
        adminFetch("quotes"),
        adminFetch("customers"),
      ]);
      if (qRes?.data) setQuotes(qRes.data);
      if (custRes?.data) setCustomers(custRes.data);
    } catch (err) {
      console.error("Failed to load quotes:", err);
    }
    setLoading(false);
  }, [adminFetch]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

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
    const lines: QuoteLineItem[] = [];
    if (job.amount && job.amount > 0) {
      lines.push({ id: createLineItemId(), description: job.service_type, quantity: 1, unit_price: job.amount, amount: job.amount });
    } else {
      lines.push({ id: createLineItemId(), description: job.service_type, quantity: 1, unit_price: 0, amount: 0 });
    }
    const notes = [job.description, job.crew_notes, job.admin_notes].filter(Boolean).join(" — ");
    setForm(prev => ({ ...prev, line_items: lines, notes: notes || prev.notes }));
  };

  // ─── Line item calculations ───
  const updateLineItem = (id: string, field: keyof QuoteLineItem, value: string | number) => {
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

  // ─── Save quote ───
  const handleSaveQuote = async (asDraft = true) => {
    if (!form.line_items.some(item => item.description && item.amount > 0)) {
      showToast("Add at least one line item", "error");
      return;
    }

    const payload: Record<string, unknown> = {
      customer_id: form.customer_id || null,
      quote_number: form.quote_number,
      expiration_date: form.show_expiration ? form.expiration_date : null,
      tax_rate: form.tax_rate,
      tax_amount: taxAmount,
      subtotal,
      total,
      notes: form.notes || null,
      status: asDraft ? "draft" : "sent",
      line_items: form.line_items.filter(item => item.description && item.amount > 0),
      show_financing: form.show_financing,
    };

    if (view === "edit" && selectedQuote) {
      payload.id = selectedQuote.id;
    }

    if (!asDraft) {
      payload.sent_at = new Date().toISOString();
    }

    const action = view === "edit" ? "update" : "create";
    const res = await adminPost("quotes", action, payload);

    if (res?.success || res?.data) {
      await loadQuotes();
      showToast(view === "edit" ? "Estimate updated" : "Estimate created");

      if (!asDraft && res?.data) {
        setSelectedQuote(res.data);
        setShowSendModal(true);
      }

      resetForm();
      setView("list");
    } else {
      showToast(res?.error || "Failed to save estimate", "error");
    }
  };

  // ─── Send quote ───
  const handleSendQuote = async (quote: Quote) => {
    if (!quote) return;

    setSendingQuote(true);
    const customer = quote.customer_id ? customers.find(c => c.id === quote.customer_id) : null;

    if (customer?.email) {
      const res = await fetch("/api/quote/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_user_id: userId,
          quote,
          customer,
        }),
      });

      if (res.ok) {
        await adminPost("quotes", "update", {
          id: quote.id,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
        showToast(`Estimate sent to ${customer.email}`);
        await loadQuotes();
      } else {
        showToast("Failed to send email", "error");
      }
    }

    setSendingQuote(false);
    setShowSendModal(false);
  };

  // ─── Mark accepted/declined ───
  const handleMarkAccepted = async (quote: Quote) => {
    const res = await adminPost("quotes", "update", {
      id: quote.id,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    });
    if (res?.success || res?.data) {
      showToast("Estimate marked as accepted");
      await loadQuotes();
      if (selectedQuote?.id === quote.id) {
        setSelectedQuote({ ...quote, status: "accepted", accepted_at: new Date().toISOString() });
      }
    }
  };

  const handleMarkDeclined = async (quote: Quote) => {
    const res = await adminPost("quotes", "update", {
      id: quote.id,
      status: "declined",
      declined_at: new Date().toISOString(),
    });
    if (res?.success || res?.data) {
      showToast("Estimate marked as declined");
      await loadQuotes();
      if (selectedQuote?.id === quote.id) {
        setSelectedQuote({ ...quote, status: "declined", declined_at: new Date().toISOString() });
      }
    }
  };

  // ─── Convert to Invoice ───
  const handleConvertToInvoice = async (quote: Quote) => {
    // Create a new invoice from the quote data
    const invoiceRes = await adminPost("invoices", "create", {
      customer_id: quote.customer_id,
      invoice_number: `INV-${quote.quote_number.replace("QTE-", "")}`,
      status: "draft",
      subtotal: quote.subtotal,
      tax_rate: quote.tax_rate,
      tax_amount: quote.tax_amount,
      total: quote.total,
      amount_paid: 0,
      notes: quote.notes,
      line_items: quote.line_items,
    });

    if (invoiceRes?.success || invoiceRes?.data) {
      const newInvoiceId = invoiceRes.data?.id;

      // Update quote status to converted
      await adminPost("quotes", "update", {
        id: quote.id,
        status: "converted",
        converted_invoice_id: newInvoiceId,
      });

      showToast("Estimate converted to invoice");
      await loadQuotes();

      // Switch to invoices tab with the new invoice open
      if (onSwitchToInvoice && newInvoiceId) {
        onSwitchToInvoice(newInvoiceId);
      }
    } else {
      showToast(invoiceRes?.error || "Failed to convert to invoice", "error");
    }
  };

  // ─── Delete quote ───
  const handleDeleteQuote = (quote: Quote) => {
    setConfirmDeleteQuote(quote);
  };

  const confirmDeleteQuoteAction = async () => {
    if (!confirmDeleteQuote) return;
    const quote = confirmDeleteQuote;
    setConfirmDeleteQuote(null);
    const res = await adminPost("quotes", "delete", { id: quote.id });
    if (res?.success) {
      showToast("Estimate deleted");
      await loadQuotes();
      if (selectedQuote?.id === quote.id) {
        setSelectedQuote(null);
        setView("list");
      }
    } else {
      showToast(res?.error || "Failed to delete estimate", "error");
    }
  };

  // ─── Reset form ───
  const resetForm = () => {
    setForm({
      customer_id: null,
      quote_number: generateQuoteNumber(),
      expiration_date: getDefaultExpirationDate(),
      show_expiration: true,
      tax_rate: 0,
      notes: "",
      line_items: [{ id: createLineItemId(), description: "", quantity: 1, unit_price: 0, amount: 0 }],
      show_financing: false,
    });
  };

  // ─── Edit quote ───
  const startEditQuote = (quote: Quote) => {
    onNavigate?.();
    setSelectedQuote(quote);
    setForm({
      customer_id: quote.customer_id || null,
      quote_number: quote.quote_number,
      expiration_date: quote.expiration_date || getDefaultExpirationDate(),
      show_expiration: !!quote.expiration_date,
      tax_rate: quote.tax_rate || 0,
      notes: quote.notes || "",
      line_items: quote.line_items?.length
        ? quote.line_items.map(item => ({ ...item, id: item.id || createLineItemId() }))
        : [{ id: createLineItemId(), description: "", quantity: 1, unit_price: 0, amount: 0 }],
      show_financing: quote.show_financing,
    });
    setView("edit");
  };

  // ─── Filter ───
  const filteredQuotes = quotes.filter(q => {
    if (filterStatus !== "all" && q.status !== filterStatus) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const customer = q.customers;
    return (
      q.quote_number.toLowerCase().includes(query) ||
      customer?.name?.toLowerCase().includes(query) ||
      customer?.email?.toLowerCase().includes(query) ||
      customer?.phone?.includes(query)
    );
  });

  // ─── Stats ───
  const stats = {
    total: quotes.length,
    draft: quotes.filter(q => q.status === "draft").length,
    sent: quotes.filter(q => q.status === "sent").length,
    accepted: quotes.filter(q => q.status === "accepted").length,
    declined: quotes.filter(q => q.status === "declined").length,
    expired: quotes.filter(q => q.status === "expired").length,
    converted: quotes.filter(q => q.status === "converted").length,
    totalValue: quotes.filter(q => ["draft", "sent", "accepted"].includes(q.status)).reduce((s, q) => s + q.total, 0),
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
        <QuoteListView
          quotes={quotes}
          customers={customers}
          filteredQuotes={filteredQuotes}
          stats={stats}
          loading={loading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          onCreateNew={() => { onNavigate?.(); resetForm(); setView("create"); }}
          onViewDetail={(q) => { onNavigate?.(); setSelectedQuote(q); setView("detail"); }}
          onSend={(q) => { onNavigate?.(); setSelectedQuote(q); setShowSendModal(true); }}
          onDelete={handleDeleteQuote}
        />
      )}

      {(view === "create" || view === "edit") && (
        <QuoteForm
          view={view}
          isMobile={isMobile}
          form={form}
          setForm={setForm}
          customers={customers}
          selectedQuote={selectedQuote}
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
          onSave={handleSaveQuote}
          onCreateNewCustomer={handleCreateNewCustomer}
          onJobAutoFill={handleJobAutoFill}
          updateLineItem={updateLineItem}
          addLineItem={addLineItem}
          removeLineItem={removeLineItem}
          onShowPresetPicker={() => setShowPresetPicker(true)}
          onNavigate={onNavigate}
        />
      )}

      {view === "detail" && selectedQuote && (
        <QuoteDetailView
          quote={selectedQuote}
          isMobile={isMobile}
          onBack={() => { setView("list"); setSelectedQuote(null); }}
          onSend={() => setShowSendModal(true)}
          onEdit={startEditQuote}
          onDelete={handleDeleteQuote}
          onMarkAccepted={handleMarkAccepted}
          onMarkDeclined={handleMarkDeclined}
          onConvertToInvoice={handleConvertToInvoice}
          onNavigate={onNavigate}
        />
      )}

      {showSendModal && selectedQuote && (
        <SendQuoteModal
          quote={selectedQuote}
          customers={customers}
          sendingQuote={sendingQuote}
          onSend={handleSendQuote}
          onClose={() => setShowSendModal(false)}
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

      {confirmDeleteQuote && (
        <ConfirmDeleteModal
          invoice={{ ...confirmDeleteQuote, invoice_number: confirmDeleteQuote.quote_number } as any}
          onConfirm={confirmDeleteQuoteAction}
          onClose={() => setConfirmDeleteQuote(null)}
        />
      )}

      {/* Styles */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
