"use client";

import React, { useState } from "react";
import type { PaymentScheduleItem } from "./invoiceTypes";
import { formatCurrency, formatDate } from "./invoiceHelpers";

/**
 * RecordPaymentModal — Records a payment against a specific schedule item
 * (deposit, balance, or installment).
 */
export default function RecordPaymentModal({ scheduleItem, onConfirm, onClose }: {
  scheduleItem: PaymentScheduleItem;
  onConfirm: (data: {
    scheduleItemId: string;
    paid_amount: number;
    payment_method: string;
    paid_date: string;
    notes: string;
  }) => void;
  onClose: () => void;
}) {
  const [paidAmount, setPaidAmount] = useState(scheduleItem.amount);
  const [paymentMethod, setPaymentMethod] = useState("square");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", background: "#0d1a0d",
    border: "1px solid #1a3a1a", borderRadius: 10, color: "#e8f5e8",
    fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif",
    boxSizing: "border-box" as const,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5,
    textTransform: "uppercase" as const, display: "block", marginBottom: 6,
  };

  const handleSubmit = () => {
    onConfirm({
      scheduleItemId: scheduleItem.id,
      paid_amount: paidAmount,
      payment_method: paymentMethod,
      paid_date: paidDate,
      notes,
    });
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, backdropFilter: "blur(8px)", animation: "fadeIn 0.2s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0d1f0d, #091409)",
        border: "1px solid #1a3a1a", borderRadius: 20, padding: "28px 24px",
        maxWidth: 440, width: "100%", boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#e8f5e8", fontWeight: 700 }}>
            Record Payment
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {/* Payment info */}
        <div style={{
          background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 12,
          padding: "14px 16px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, color: "#c8e0c8", fontWeight: 600 }}>{scheduleItem.label}</div>
              {scheduleItem.due_date && (
                <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 2 }}>Due: {formatDate(scheduleItem.due_date)}</div>
              )}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace" }}>
              {formatCurrency(scheduleItem.amount)}
            </div>
          </div>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Amount */}
          <div>
            <label style={labelStyle}>Amount Paid</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#4CAF50", fontSize: 14, fontFamily: "'JetBrains Mono', monospace" }}>$</span>
              <input
                value={paidAmount || ""}
                onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)}
                inputMode="decimal"
                style={{ ...inputStyle, paddingLeft: 28, fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700 }}
              />
            </div>
            {paidAmount < scheduleItem.amount && paidAmount > 0 && (
              <div style={{ fontSize: 12, color: "#ffb74d", marginTop: 4 }}>
                ⚠ Partial payment — {formatCurrency(scheduleItem.amount - paidAmount)} will remain unpaid
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label style={labelStyle}>Payment Method</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[
                { val: "square", label: "💳 Square" },
                { val: "cash", label: "💵 Cash" },
                { val: "check", label: "📝 Check" },
                { val: "zelle", label: "⚡ Zelle" },
                { val: "venmo", label: "📱 Venmo" },
                { val: "other", label: "🔄 Other" },
              ].map(method => (
                <button
                  key={method.val}
                  onClick={() => setPaymentMethod(method.val)}
                  style={{
                    padding: "8px 6px", borderRadius: 8,
                    border: `1px solid ${paymentMethod === method.val ? "rgba(76,175,80,0.4)" : "#1a3a1a"}`,
                    background: paymentMethod === method.val ? "rgba(76,175,80,0.1)" : "transparent",
                    color: paymentMethod === method.val ? "#4CAF50" : "#5a8a5a",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label style={labelStyle}>Payment Date</label>
            <input
              type="date"
              value={paidDate}
              onChange={e => setPaidDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reference #, receipt info, etc."
              style={inputStyle}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", borderRadius: 12,
            border: "1px solid #2a2a2a", background: "transparent",
            color: "#8aba8a", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={paidAmount <= 0}
            style={{
              flex: 1, padding: "12px", borderRadius: 12, border: "none",
              background: paidAmount > 0 ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "#1a3a1a",
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: paidAmount > 0 ? "pointer" : "default",
              boxShadow: paidAmount > 0 ? "0 4px 20px rgba(76,175,80,0.35)" : "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            💰 Record {formatCurrency(paidAmount)}
          </button>
        </div>
      </div>
    </div>
  );
}
