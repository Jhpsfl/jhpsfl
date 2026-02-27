"use client";

import React from "react";
import type { PaymentTerms, PaymentScheduleItem } from "./invoiceTypes";
import { formatCurrency, formatDate, getPaymentProgress, getDisclaimer } from "./invoiceHelpers";

/**
 * PaymentScheduleView — Displays the payment schedule, progress bar,
 * and individual payment statuses on the invoice detail view.
 */
export default function PaymentScheduleView({ terms, total, onRecordPayment }: {
  terms: PaymentTerms;
  total: number;
  onRecordPayment?: (scheduleItem: PaymentScheduleItem) => void;
}) {
  const { totalPaid, percentPaid, nextPayment, isFullyPaid } = getPaymentProgress(terms);
  const balance = Math.max(0, total - totalPaid);
  const disclaimer = getDisclaimer(terms.type);

  return (
    <div style={{
      background: "linear-gradient(160deg, #0d1f0d, #091409)",
      border: "1px solid #1a3a1a", borderRadius: 20, padding: "24px 20px",
      marginTop: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>💳</span>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#e8f5e8", fontWeight: 700 }}>
          Payment Schedule
        </h3>
        <span style={{
          marginLeft: "auto", padding: "3px 10px", borderRadius: 12,
          fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
          background: terms.type === "deposit_balance" ? "rgba(33,150,243,0.1)" : "rgba(255,183,77,0.1)",
          color: terms.type === "deposit_balance" ? "#42a5f5" : "#ffb74d",
          textTransform: "uppercase",
        }}>
          {terms.type === "deposit_balance" ? "Deposit + Balance" : "Installment Plan"}
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#5a8a5a" }}>
            {isFullyPaid ? "✓ Fully Paid" : `${percentPaid}% Paid`}
          </span>
          <span style={{ fontSize: 12, color: "#8aba8a", fontFamily: "'JetBrains Mono', monospace" }}>
            {formatCurrency(totalPaid)} / {formatCurrency(total)}
          </span>
        </div>
        <div style={{
          width: "100%", height: 8, borderRadius: 4,
          background: "#0a160a", border: "1px solid #1a3a1a",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${Math.min(100, percentPaid)}%`,
            height: "100%", borderRadius: 4,
            background: isFullyPaid
              ? "linear-gradient(90deg, #4CAF50, #66bb6a)"
              : "linear-gradient(90deg, #4CAF50, #2E7D32)",
            transition: "width 0.5s ease",
          }} />
        </div>
        {!isFullyPaid && balance > 0 && (
          <div style={{ fontSize: 12, color: "#ef9a9a", marginTop: 6, textAlign: "right" }}>
            Remaining: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(balance)}</strong>
          </div>
        )}
      </div>

      {/* Schedule Items */}
      <div style={{
        borderRadius: 12, border: "1px solid #1a3a1a", overflow: "hidden",
      }}>
        {terms.schedule.map((item, idx) => {
          const isPaid = item.status === "paid";
          const isOverdue = item.status === "overdue" || (
            item.due_date && !isPaid && new Date(item.due_date) < new Date()
          );
          const isNext = nextPayment?.id === item.id;

          return (
            <div key={item.id || idx} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px",
              borderTop: idx > 0 ? "1px solid #0d1a0d" : "none",
              background: isNext ? "rgba(76,175,80,0.04)" : "transparent",
            }}>
              {/* Status indicator */}
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, flexShrink: 0,
                background: isPaid
                  ? "rgba(76,175,80,0.15)"
                  : isOverdue
                    ? "rgba(239,83,80,0.12)"
                    : "rgba(255,255,255,0.04)",
                border: `1px solid ${isPaid ? "rgba(76,175,80,0.3)" : isOverdue ? "rgba(239,83,80,0.25)" : "#1a3a1a"}`,
                color: isPaid ? "#66bb6a" : isOverdue ? "#ef5350" : "#5a8a5a",
              }}>
                {isPaid ? "✓" : isOverdue ? "!" : (idx + 1)}
              </div>

              {/* Label & date */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: isPaid ? "#66bb6a" : isOverdue ? "#ef9a9a" : "#c8e0c8",
                  textDecoration: isPaid ? "none" : "none",
                }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 2 }}>
                  {item.due_date ? `Due: ${formatDate(item.due_date)}` : "Due at completion"}
                  {isPaid && item.paid_date && (
                    <span style={{ color: "#66bb6a", marginLeft: 8 }}>
                      • Paid {formatDate(item.paid_date)}
                      {item.payment_method && ` via ${item.payment_method}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Amount */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: isPaid ? "#66bb6a" : isOverdue ? "#ef5350" : "#4CAF50",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {formatCurrency(item.amount)}
                </div>
                {isPaid && item.paid_amount > 0 && item.paid_amount !== item.amount && (
                  <div style={{ fontSize: 11, color: "#ffb74d" }}>
                    Paid: {formatCurrency(item.paid_amount)}
                  </div>
                )}
              </div>

              {/* Record payment button */}
              {!isPaid && onRecordPayment && (
                <button
                  onClick={() => onRecordPayment(item)}
                  style={{
                    padding: "6px 10px", borderRadius: 8, flexShrink: 0,
                    border: "1px solid rgba(76,175,80,0.3)",
                    background: isNext ? "rgba(76,175,80,0.12)" : "transparent",
                    color: "#4CAF50", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  💰 Record
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Legal disclaimer */}
      {disclaimer && (
        <div style={{
          marginTop: 16, padding: "12px 14px", borderRadius: 10,
          background: "rgba(255,183,77,0.03)", border: "1px solid rgba(255,183,77,0.1)",
        }}>
          <div style={{ fontSize: 9, color: "#7a6a4a", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
            Terms & Conditions
          </div>
          <div style={{ fontSize: 11, color: "#6a5a3a", lineHeight: 1.6 }}>
            {disclaimer}
          </div>
        </div>
      )}
    </div>
  );
}
