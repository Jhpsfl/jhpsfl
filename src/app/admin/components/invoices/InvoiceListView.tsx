"use client";

import React from "react";
import type { Invoice, Customer } from "./invoiceTypes";
import { formatCurrency, formatDate, timeAgo } from "./invoiceHelpers";
import InvoiceStatusBadge from "./InvoiceStatusBadge";
import { IconPlus, IconLink, IconSend, IconTrash } from "./InvoiceIcons";

export default function InvoiceListView({ invoices, customers, filteredInvoices, stats, loading, searchQuery, setSearchQuery, filterStatus, setFilterStatus, onCreateNew, onViewDetail, onCopyLink, onSend, onDelete, onNavigate }: {
  invoices: Invoice[];
  customers: Customer[];
  filteredInvoices: Invoice[];
  stats: {
    total: number;
    draft: number;
    sent: number;
    paid: number;
    overdue: number;
    totalOwed: number;
    totalPaid: number;
  };
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterStatus: string;
  setFilterStatus: (s: string) => void;
  onCreateNew: () => void;
  onViewDetail: (inv: Invoice) => void;
  onCopyLink: (inv: Invoice) => void;
  onSend: (inv: Invoice) => void;
  onDelete: (inv: Invoice) => void;
  onNavigate?: () => void;
}) {
  return (
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
          onClick={onCreateNew}
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
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", "draft", "sent", "partial", "paid", "overdue"].map(status => (
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
              onClick={onCreateNew}
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
                {["Invoice #", "Customer", "Status", "Amount", "Paid", "Due Date", "Created", "Actions"].map(h => (
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
                const hasTerms = inv.payment_terms && inv.payment_terms.type !== "full";
                return (
                  <tr
                    key={inv.id}
                    style={{ cursor: "pointer", transition: "background 0.2s" }}
                    onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "rgba(76,175,80,0.04)"; }}
                    onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    onClick={() => onViewDetail(inv)}
                  >
                    <td style={{ padding: "14px 12px", fontSize: 14, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid #0d1a0d" }}>
                      {inv.invoice_number}
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: 14, color: inv.customer_id ? "#c8e0c8" : "#64b5f6", borderBottom: "1px solid #0d1a0d" }}>
                      {inv.customer_id ? (customer?.name || customer?.email || "—") : "🔗 Link Only"}
                    </td>
                    <td style={{ padding: "14px 12px", borderBottom: "1px solid #0d1a0d" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <InvoiceStatusBadge status={inv.status} />
                        {hasTerms && (
                          <span style={{ fontSize: 10, color: "#ffb74d", fontWeight: 600 }} title="Has payment plan">💳</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: 14, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid #0d1a0d" }}>
                      {formatCurrency(inv.total)}
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid #0d1a0d", color: inv.amount_paid > 0 ? "#66bb6a" : "#3a5a3a" }}>
                      {inv.amount_paid > 0 ? formatCurrency(inv.amount_paid) : "—"}
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
                            onClick={() => onCopyLink(inv)}
                            title="Copy payment link"
                            className="quick-action"
                            style={{ display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <IconLink /> Link
                          </button>
                        )}
                        {["draft", "sent", "overdue", "partial"].includes(inv.status) && (
                          <button
                            onClick={() => onSend(inv)}
                            title="Send invoice"
                            className="quick-action"
                            style={{ display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <IconSend /> Send
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(inv)}
                          title="Delete invoice"
                          className="quick-action quick-action-danger"
                          style={{ display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <IconTrash /> Delete
                        </button>
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
  );
}
