"use client";

import React from "react";
import type { Quote, QuoteLineItem, Customer, CustomerJob } from "./quoteTypes";
import { formatCurrency, formatDate, FINANCING_MESSAGE } from "./quoteHelpers";
import QuoteStatusBadge from "./QuoteStatusBadge";
import { IconPlus, IconSend, IconTrash, IconBack } from "../invoices/InvoiceIcons";

export default function QuoteForm({
  view, isMobile, form, setForm, customers, selectedQuote,
  customerJobs, loadingJobs, showNewCustomer, setShowNewCustomer,
  newCustomerForm, setNewCustomerForm, savingNewCustomer,
  subtotal, taxAmount, total,
  onBack, onSave, onCreateNewCustomer, onJobAutoFill,
  updateLineItem, addLineItem, removeLineItem, onShowPresetPicker,
  onNavigate,
}: {
  view: "create" | "edit";
  isMobile: boolean;
  form: {
    customer_id: string | null;
    quote_number: string;
    expiration_date: string;
    show_expiration: boolean;
    tax_rate: number;
    notes: string;
    line_items: QuoteLineItem[];
    show_financing: boolean;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  customers: Customer[];
  selectedQuote: Quote | null;
  customerJobs: CustomerJob[];
  loadingJobs: boolean;
  showNewCustomer: boolean;
  setShowNewCustomer: (v: boolean) => void;
  newCustomerForm: { name: string; email: string; phone: string };
  setNewCustomerForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; phone: string }>>;
  savingNewCustomer: boolean;
  subtotal: number;
  taxAmount: number;
  total: number;
  onBack: () => void;
  onSave: (asDraft: boolean) => void;
  onCreateNewCustomer: () => void;
  onJobAutoFill: (job: CustomerJob) => void;
  updateLineItem: (id: string, field: keyof QuoteLineItem, value: string | number) => void;
  addLineItem: () => void;
  removeLineItem: (id: string) => void;
  onShowPresetPicker: () => void;
  onNavigate?: () => void;
}) {
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

  return (
    <>
      {/* Floating total — mobile only, locked top-right */}
      {isMobile && (
        <div style={{
          position: "fixed", top: 14, right: 14, zIndex: 9990,
          background: "linear-gradient(135deg, rgba(13,71,161,0.95), rgba(21,101,192,0.92))",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(66,165,245,0.4)",
          borderRadius: 14, padding: "10px 16px",
          boxShadow: "0 4px 24px rgba(13,71,161,0.5), 0 0 12px rgba(66,165,245,0.2)",
          display: "flex", flexDirection: "column", alignItems: "flex-end",
          minWidth: 100,
        }}>
          <div style={{ fontSize: 9, color: "rgba(144,202,249,0.8)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>
            TOTAL
          </div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: "#E3F2FD",
            fontFamily: "'JetBrains Mono', monospace",
            textShadow: "0 0 12px rgba(66,165,245,0.6)",
            lineHeight: 1,
          }}>
            {formatCurrency(total)}
          </div>
          {form.line_items.filter(i => i.description && i.amount > 0).length > 0 && (
            <div style={{ fontSize: 10, color: "rgba(144,202,249,0.6)", marginTop: 2 }}>
              {form.line_items.filter(i => i.description && i.amount > 0).length} item{form.line_items.filter(i => i.description && i.amount > 0).length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "1px solid #1a3a1a", borderRadius: 10, padding: "8px 14px",
            color: "#5a8a5a", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <IconBack /> Back
        </button>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#e8f5e8", fontWeight: 700 }}>
          {view === "edit" ? "Edit Estimate" : "New Estimate"}
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 340px", gap: 24, alignItems: "start", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
        {/* ─── Left: Form ─── */}
        <div style={{
          background: "linear-gradient(160deg, #0d1f0d, #091409)",
          border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px 24px",
          overflow: "hidden", minWidth: 0, maxWidth: "100%", boxSizing: "border-box",
        }}>
          {/* ─── Financing Toggle ─── */}
          <div style={{
            padding: "16px 18px", borderRadius: 14, marginBottom: 24,
            background: form.show_financing ? "rgba(38,166,154,0.08)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${form.show_financing ? "rgba(38,166,154,0.3)" : "#1a3a1a"}`,
            transition: "all 0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: form.show_financing ? 12 : 0 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: form.show_financing ? "#26A69A" : "#8aba8a" }}>
                  $ Eligible for Financing / Payment Plan
                </div>
                <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 2 }}>
                  Show flexible payment options on the estimate
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, show_financing: !prev.show_financing }))}
                style={{
                  width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
                  background: form.show_financing ? "linear-gradient(135deg, #26A69A, #00897B)" : "#1a3a1a",
                  position: "relative", transition: "background 0.2s", flexShrink: 0,
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 3,
                  left: form.show_financing ? 27 : 3,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }} />
              </button>
            </div>
            {form.show_financing && (
              <div style={{
                padding: "12px 14px", borderRadius: 10,
                background: "rgba(38,166,154,0.06)", border: "1px solid rgba(38,166,154,0.15)",
                fontSize: 13, color: "#80CBC4", lineHeight: 1.6,
              }}>
                {FINANCING_MESSAGE}
              </div>
            )}
          </div>

          {/* Customer & Quote Info */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}>
              <label style={labelStyle}>Customer</label>
              <select
                value={form.customer_id ?? ""}
                onChange={e => {
                  if (e.target.value === "__new__") {
                    setNewCustomerForm({ name: "", email: "", phone: "" });
                    setShowNewCustomer(true);
                  } else {
                    setForm(prev => ({ ...prev, customer_id: e.target.value || null }));
                  }
                }}
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
              >
                <option value="">Select customer</option>
                <option value="__new__">+ New Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.email || c.phone || "Unknown"}</option>
                ))}
              </select>

              {/* Customer info card */}
              {form.customer_id && (() => {
                const sel = customers.find(c => c.id === form.customer_id);
                if (!sel) return null;
                return (
                  <div style={{
                    marginTop: 8, padding: "10px 14px", borderRadius: 10,
                    background: "rgba(76,175,80,0.04)", border: "1px solid rgba(76,175,80,0.15)",
                    display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
                  }}>
                    <span style={{ fontSize: 13, color: "#8aba8a", fontWeight: 600 }}>{sel.name || "—"}</span>
                    {sel.email && <span style={{ fontSize: 12, color: "#5a8a5a" }}>✉ {sel.email}</span>}
                    {sel.phone && <span style={{ fontSize: 12, color: "#5a8a5a" }}>📞 {sel.phone}</span>}
                  </div>
                );
              })()}

              {/* Job selector */}
              {form.customer_id && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ ...labelStyle, color: "#42a5f5" }}>
                    Link to Job {loadingJobs && <span style={{ fontWeight: 400, letterSpacing: 0 }}>— loading…</span>}
                  </label>
                  {customerJobs.length > 0 ? (
                    <select
                      defaultValue=""
                      onChange={e => {
                        const job = customerJobs.find(j => j.id === e.target.value);
                        if (job) onJobAutoFill(job);
                      }}
                      style={{ ...inputStyle, appearance: "none", cursor: "pointer", borderColor: "rgba(33,150,243,0.3)", color: "#c8e0c8" }}
                    >
                      <option value="">— Select a job to auto-fill —</option>
                      {customerJobs.map(j => (
                        <option key={j.id} value={j.id}>
                          {j.service_type}
                          {j.scheduled_date ? ` · ${new Date(j.scheduled_date).toLocaleDateString()}` : ""}
                          {j.amount ? ` · $${j.amount}` : ""}
                          {" "}[{j.status}]
                        </option>
                      ))}
                    </select>
                  ) : !loadingJobs ? (
                    <p style={{ fontSize: 12, color: "#3a5a3a", margin: "4px 0 0" }}>No jobs on file for this customer.</p>
                  ) : null}
                </div>
              )}

              {/* Inline new-customer mini-modal */}
              {showNewCustomer && (
                <div style={{
                  marginTop: 10, padding: 14, borderRadius: 10,
                  background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.2)",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#5a8a5a", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>New Customer</div>
                  {[
                    { key: "name", placeholder: "Full Name *", type: "text" },
                    { key: "email", placeholder: "Email", type: "email" },
                    { key: "phone", placeholder: "Phone", type: "tel" },
                  ].map(f => (
                    <input
                      key={f.key}
                      type={f.type}
                      placeholder={f.placeholder}
                      value={newCustomerForm[f.key as keyof typeof newCustomerForm]}
                      onChange={e => setNewCustomerForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ ...inputStyle, marginBottom: 8 }}
                    />
                  ))}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={onCreateNewCustomer}
                      disabled={savingNewCustomer}
                      style={{
                        flex: 1, padding: "8px 0", borderRadius: 6,
                        background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                        border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}
                    >{savingNewCustomer ? "Saving..." : "Save Customer"}</button>
                    <button
                      onClick={() => { setShowNewCustomer(false); }}
                      style={{
                        padding: "8px 14px", borderRadius: 6,
                        background: "rgba(255,255,255,0.05)", border: "1px solid #1a3a1a",
                        color: "#5a8a5a", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Estimate #</label>
              <input
                value={form.quote_number}
                onChange={e => setForm(prev => ({ ...prev, quote_number: e.target.value }))}
                style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}
              />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Expiration Date</label>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, show_expiration: !prev.show_expiration }))}
                  style={{
                    background: form.show_expiration ? "rgba(76,175,80,0.15)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${form.show_expiration ? "rgba(76,175,80,0.4)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 6, padding: "3px 10px", fontSize: 11,
                    color: form.show_expiration ? "#4CAF50" : "#5a7a5a",
                    cursor: "pointer", fontWeight: 600, letterSpacing: 0.3,
                  }}
                >
                  {form.show_expiration ? "ON" : "OFF"}
                </button>
              </div>
              {form.show_expiration && (
                <input
                  type="date"
                  value={form.expiration_date}
                  onChange={e => setForm(prev => ({ ...prev, expiration_date: e.target.value }))}
                  style={{ ...inputStyle, colorScheme: "dark" }}
                />
              )}
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
                  onClick={onShowPresetPicker}
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
                <div key={item.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1a3a1a", borderRadius: 10, padding: "10px 12px", marginBottom: 10, overflow: "hidden", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                  <textarea
                    value={item.description}
                    onChange={e => updateLineItem(item.id, "description", e.target.value)}
                    placeholder="Service or item description"
                    rows={2}
                    style={{ ...inputStyle, padding: "10px 12px", fontSize: 13, width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", marginBottom: 8, resize: "none", lineHeight: 1.5, overflow: "hidden", wordBreak: "break-word" }}
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
                <div
                  key={item.id}
                  style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 100px 36px", gap: 8, marginBottom: 8, alignItems: "center", minWidth: 0, overflow: "hidden" }}
                >
                  <textarea
                    value={item.description}
                    onChange={e => updateLineItem(item.id, "description", e.target.value)}
                    placeholder="Service or item description"
                    rows={2}
                    style={{ ...inputStyle, padding: "10px 12px", fontSize: 13, minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box", resize: "none", lineHeight: 1.5, overflow: "hidden", wordBreak: "break-word" }}
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
              placeholder="Scope of work, terms, or special instructions..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button
              onClick={() => onSave(true)}
              style={{
                flex: 1, padding: "14px", borderRadius: 12, border: "1px solid #1a3a1a",
                background: "transparent", color: "#c8e0c8", fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Save as Draft
            </button>
            <button
              onClick={() => onSave(false)}
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
            Estimate Preview
          </h3>

          <div style={{
            background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 14,
            padding: "20px 16px", marginBottom: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Estimate</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace" }}>
                  {form.quote_number}
                </div>
              </div>
              <QuoteStatusBadge status={view === "edit" ? (selectedQuote?.status || "draft") : "draft"} />
            </div>

            <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Prepared For</div>
              <div style={{ fontSize: 13, color: form.customer_id ? "#c8e0c8" : "#5a8a5a" }}>
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
              <span style={{ fontSize: 12, color: "#7a9a7a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Est. Total</span>
              <span style={{
                fontSize: 24, fontWeight: 800, color: "#4CAF50",
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {formatCurrency(total)}
              </span>
            </div>

            {form.show_financing && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #1a3a1a" }}>
                <div style={{ fontSize: 10, color: "#26A69A", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                  $ Financing Available
                </div>
              </div>
            )}
          </div>

          {form.show_expiration && form.expiration_date && (
            <div style={{ fontSize: 11, color: "#3a5a3a", textAlign: "center" }}>
              Valid until: {formatDate(form.expiration_date)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
