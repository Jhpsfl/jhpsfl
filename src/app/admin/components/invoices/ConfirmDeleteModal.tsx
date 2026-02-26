"use client";

import React from "react";
import type { Invoice } from "./invoiceTypes";

export default function ConfirmDeleteModal({ invoice, onConfirm, onClose }: {
  invoice: Invoice;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, backdropFilter: "blur(8px)", animation: "fadeIn 0.2s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #1a0d0d, #110909)",
        border: "1px solid rgba(239,83,80,0.3)", borderRadius: 20, padding: "32px 28px",
        maxWidth: 420, width: "100%", boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
        animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#ffcdd2", fontWeight: 700, textAlign: "center", marginBottom: 8 }}>
          Delete Invoice?
        </h3>
        <p style={{ color: "#9a7a7a", fontSize: 14, textAlign: "center", marginBottom: 8 }}>
          <strong style={{ color: "#ef9a9a" }}>{invoice.invoice_number}</strong>
          {invoice.customers?.name ? ` — ${invoice.customers.name}` : ""}
        </p>
        <p style={{ color: "#7a5a5a", fontSize: 13, textAlign: "center", marginBottom: 24 }}>
          This permanently removes the invoice from the database. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", borderRadius: 12,
            border: "1px solid #2a2a2a", background: "transparent",
            color: "#8aba8a", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "12px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, #c62828, #b71c1c)",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(198,40,40,0.4)",
          }}>
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}
