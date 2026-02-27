"use client";

import React from "react";
import type { PaymentTerms, PaymentTermsType } from "./invoiceTypes";
import { formatCurrency, formatDate, createDefaultPaymentTerms, regenerateSchedule, getDisclaimer } from "./invoiceHelpers";

/**
 * PaymentTermsConfig — Inline form section for setting up payment terms
 * on an invoice (deposit, installments, or full payment).
 */
export default function PaymentTermsConfig({ terms, total, onChange }: {
  terms: PaymentTerms | null;
  total: number;
  onChange: (terms: PaymentTerms | null) => void;
}) {
  const activeType: PaymentTermsType = terms?.type || "full";

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "#0d1a0d",
    border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8",
    fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.2,
    textTransform: "uppercase" as const, display: "block", marginBottom: 4,
  };

  const handleTypeChange = (type: PaymentTermsType) => {
    if (type === "full") {
      onChange(null);
      return;
    }
    const newTerms = createDefaultPaymentTerms(type, total);
    onChange(newTerms);
  };

  const updateDepositByPercentage = (pct: number) => {
    if (!terms) return;
    const clampedPct = Math.max(0, Math.min(100, pct));
    const amt = Math.round((total * clampedPct) / 100 * 100) / 100;
    const updated: PaymentTerms = {
      ...terms,
      deposit_percentage: clampedPct,
      deposit_amount: amt,
      deposit_method: "percentage",
    };
    updated.schedule = regenerateSchedule(updated, total);
    onChange(updated);
  };

  const updateDepositByFixed = (amt: number) => {
    if (!terms) return;
    const clampedAmt = Math.max(0, Math.min(total, amt));
    const pct = total > 0 ? Math.round((clampedAmt / total) * 100) : 0;
    const updated: PaymentTerms = {
      ...terms,
      deposit_amount: clampedAmt,
      deposit_percentage: pct,
      deposit_method: "fixed",
    };
    updated.schedule = regenerateSchedule(updated, total);
    onChange(updated);
  };

  const updateInstallments = (n: number) => {
    if (!terms) return;
    const clamped = Math.max(2, Math.min(12, n));
    const updated: PaymentTerms = { ...terms, num_installments: clamped };
    updated.schedule = regenerateSchedule(updated, total);
    onChange(updated);
  };

  const updateFrequency = (freq: "weekly" | "biweekly" | "monthly") => {
    if (!terms) return;
    const updated: PaymentTerms = { ...terms, installment_frequency: freq };
    updated.schedule = regenerateSchedule(updated, total);
    onChange(updated);
  };

  const updateBalanceDueOn = (val: "completion" | "date") => {
    if (!terms) return;
    const updated: PaymentTerms = { ...terms, balance_due_on: val };
    updated.schedule = regenerateSchedule(updated, total);
    onChange(updated);
  };

  const disclaimer = activeType !== "full" ? getDisclaimer(activeType) : "";

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Section Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>💳</span>
        <label style={{ ...labelStyle, marginBottom: 0, fontSize: 11, letterSpacing: 1.5 }}>Payment Terms</label>
      </div>

      {/* Type Selector — 3 pill buttons */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {([
          { type: "full" as const, label: "Full Payment", icon: "💵" },
          { type: "deposit_balance" as const, label: "Deposit + Balance", icon: "🔒" },
          { type: "deposit_installments" as const, label: "Deposit + Installments", icon: "📅" },
        ]).map(opt => {
          const isActive = activeType === opt.type;
          return (
            <button
              key={opt.type}
              onClick={() => handleTypeChange(opt.type)}
              style={{
                flex: 1, padding: "10px 8px", borderRadius: 10,
                border: `1px solid ${isActive ? "rgba(76,175,80,0.4)" : "#1a3a1a"}`,
                background: isActive ? "rgba(76,175,80,0.1)" : "transparent",
                color: isActive ? "#4CAF50" : "#5a8a5a",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 16 }}>{opt.icon}</span>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Full payment — no config needed */}
      {activeType === "full" && (
        <div style={{
          padding: "12px 14px", borderRadius: 10,
          background: "rgba(76,175,80,0.04)", border: "1px solid rgba(76,175,80,0.12)",
          fontSize: 13, color: "#8aba8a", lineHeight: 1.5,
        }}>
          Full amount of <strong style={{ color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(total)}</strong> due at time of service or upon receipt of invoice.
        </div>
      )}

      {/* Deposit config — shared by both deposit types */}
      {(activeType === "deposit_balance" || activeType === "deposit_installments") && terms && (
        <div style={{
          background: "rgba(76,175,80,0.03)", border: "1px solid rgba(76,175,80,0.12)",
          borderRadius: 14, padding: "16px 14px",
        }}>
          {/* Deposit Amount */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Deposit Amount</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#4CAF50", fontSize: 12 }}>%</span>
                <input
                  value={terms.deposit_percentage || ""}
                  onChange={e => updateDepositByPercentage(parseFloat(e.target.value) || 0)}
                  placeholder="50"
                  inputMode="decimal"
                  style={{ ...inputStyle, paddingRight: 28, fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}
                />
              </div>
              <span style={{ color: "#3a5a3a", fontSize: 12, fontWeight: 700 }}>OR</span>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4CAF50", fontSize: 12 }}>$</span>
                <input
                  value={terms.deposit_amount || ""}
                  onChange={e => updateDepositByFixed(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  inputMode="decimal"
                  style={{ ...inputStyle, paddingLeft: 24, fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}
                />
              </div>
            </div>
          </div>

          {/* Deposit visual summary */}
          <div style={{
            display: "flex", justifyContent: "space-between", padding: "10px 12px",
            background: "#0a160a", borderRadius: 8, marginBottom: 14,
            fontSize: 13,
          }}>
            <div>
              <div style={{ color: "#5a8a5a", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Deposit</div>
              <div style={{ color: "#4CAF50", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(terms.deposit_amount)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#3a5a3a", fontSize: 16, lineHeight: "32px" }}>→</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#5a8a5a", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Remaining</div>
              <div style={{ color: "#e8f5e8", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                {formatCurrency(Math.max(0, total - terms.deposit_amount))}
              </div>
            </div>
          </div>

          {/* Deposit + Balance specific: when is balance due? */}
          {activeType === "deposit_balance" && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Balance Due</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => updateBalanceDueOn("completion")}
                  style={{
                    flex: 1, padding: "8px", borderRadius: 8,
                    border: `1px solid ${terms.balance_due_on === "completion" ? "rgba(76,175,80,0.3)" : "#1a3a1a"}`,
                    background: terms.balance_due_on === "completion" ? "rgba(76,175,80,0.08)" : "transparent",
                    color: terms.balance_due_on === "completion" ? "#4CAF50" : "#5a8a5a",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  At Job Completion
                </button>
                <button
                  onClick={() => updateBalanceDueOn("date")}
                  style={{
                    flex: 1, padding: "8px", borderRadius: 8,
                    border: `1px solid ${terms.balance_due_on === "date" ? "rgba(76,175,80,0.3)" : "#1a3a1a"}`,
                    background: terms.balance_due_on === "date" ? "rgba(76,175,80,0.08)" : "transparent",
                    color: terms.balance_due_on === "date" ? "#4CAF50" : "#5a8a5a",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Specific Date
                </button>
              </div>
              {terms.balance_due_on === "date" && terms.schedule[1] && (
                <input
                  type="date"
                  value={terms.schedule[1].due_date || ""}
                  onChange={e => {
                    const updated = { ...terms };
                    if (updated.schedule[1]) {
                      updated.schedule = [...updated.schedule];
                      updated.schedule[1] = { ...updated.schedule[1], due_date: e.target.value };
                    }
                    onChange(updated);
                  }}
                  style={{ ...inputStyle, marginTop: 8, colorScheme: "dark" }}
                />
              )}
            </div>
          )}

          {/* Installment-specific config */}
          {activeType === "deposit_installments" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}># of Installments</label>
                  <select
                    value={terms.num_installments}
                    onChange={e => updateInstallments(parseInt(e.target.value))}
                    style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                  >
                    {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                      <option key={n} value={n}>{n} payments</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Frequency</label>
                  <select
                    value={terms.installment_frequency}
                    onChange={e => updateFrequency(e.target.value as "weekly" | "biweekly" | "monthly")}
                    style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 Weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              {/* Installment breakdown */}
              {terms.schedule.length > 0 && (
                <div style={{
                  background: "#0a160a", borderRadius: 10, padding: "12px",
                  border: "1px solid #1a3a1a", marginBottom: 14,
                }}>
                  <div style={{ fontSize: 10, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                    Payment Schedule Preview
                  </div>
                  {terms.schedule.map((item, idx) => (
                    <div key={item.id || idx} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 0",
                      borderTop: idx > 0 ? "1px solid #0d1a0d" : "none",
                    }}>
                      <div>
                        <div style={{ fontSize: 13, color: idx === 0 ? "#4CAF50" : "#c8e0c8", fontWeight: idx === 0 ? 700 : 500 }}>
                          {item.label}
                        </div>
                        {item.due_date && (
                          <div style={{ fontSize: 11, color: "#5a8a5a" }}>Due: {formatDate(item.due_date)}</div>
                        )}
                        {!item.due_date && idx > 0 && (
                          <div style={{ fontSize: 11, color: "#5a8a5a", fontStyle: "italic" }}>Due at completion</div>
                        )}
                      </div>
                      <div style={{
                        fontSize: 14, fontWeight: 700,
                        color: idx === 0 ? "#4CAF50" : "#e8f5e8",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Legal Disclaimer Preview */}
          {disclaimer && (
            <div style={{
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(255,183,77,0.04)", border: "1px solid rgba(255,183,77,0.15)",
            }}>
              <div style={{ fontSize: 10, color: "#ffb74d", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                ⚖️ Legal Disclaimer (auto-included)
              </div>
              <div style={{ fontSize: 11, color: "#8a7a5a", lineHeight: 1.6 }}>
                {disclaimer}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
