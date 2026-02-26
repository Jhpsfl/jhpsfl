"use client";

import React from "react";

export function DataTable({ headers, children, emptyMessage = "No data yet" }: {
  headers: string[];
  children: React.ReactNode;
  emptyMessage?: string;
}) {
  const hasChildren = Array.isArray(children) ? children.filter(Boolean).length > 0 : !!children;
  return (
    <div style={{ overflowX: "auto", borderRadius: 16, border: "1px solid #1a3a1a" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif" }}>
        <thead>
          <tr style={{ background: "#0a160a" }}>
            {headers.map((h) => (
              <th key={h} style={{
                padding: "14px 16px", textAlign: "left", fontSize: 11,
                color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.5,
                textTransform: "uppercase", borderBottom: "1px solid #1a3a1a",
                whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasChildren ? children : (
            <tr>
              <td colSpan={headers.length} style={{
                padding: "40px 16px", textAlign: "center", color: "#3a5a3a", fontSize: 14,
              }}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TableRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", transition: "background 0.2s" }}
      onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(76,175,80,0.04)"; }}
      onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {children}
    </tr>
  );
}

export function Td({ children, mono, accent, style }: { children: React.ReactNode; mono?: boolean; accent?: boolean; style?: React.CSSProperties }) {
  return (
    <td style={{
      padding: "14px 16px", fontSize: 14, color: accent ? "#4CAF50" : "#c8e0c8",
      borderBottom: "1px solid #0d1a0d",
      fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
      fontWeight: mono ? 600 : 400, whiteSpace: "nowrap",
      ...style,
    }}>{children}</td>
  );
}
