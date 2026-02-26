"use client";

import React from "react";
import { SERVICE_PRESETS, formatCurrency } from "./invoiceHelpers";

export default function ServicePresetPicker({ presetCategory, setPresetCategory, onAddPreset, onAddCustomItem, onClose }: {
  presetCategory: string | null;
  setPresetCategory: (cat: string | null) => void;
  onAddPreset: (description: string, unit_price: number) => void;
  onAddCustomItem: () => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={() => { onClose(); setPresetCategory(null); }}
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
              onClick={() => { onClose(); setPresetCategory(null); }}
              style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 22, cursor: "pointer" }}
            >✕</button>
          </div>
        </div>

        {!presetCategory ? (
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
            <button
              onClick={() => { onClose(); onAddCustomItem(); }}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {SERVICE_PRESETS.find(c => c.category === presetCategory)?.items.map(item => (
              <button
                key={item.description}
                onClick={() => onAddPreset(item.description, item.unit_price)}
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
  );
}
