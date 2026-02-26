"use client";

export default function InvoiceStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; glow: string }> = {
    draft: { bg: "rgba(158,158,158,0.1)", text: "#9e9e9e", glow: "rgba(158,158,158,0.1)" },
    sent: { bg: "rgba(33,150,243,0.12)", text: "#42a5f5", glow: "rgba(33,150,243,0.2)" },
    paid: { bg: "rgba(76,175,80,0.12)", text: "#66bb6a", glow: "rgba(76,175,80,0.2)" },
    overdue: { bg: "rgba(239,83,80,0.08)", text: "#ef5350", glow: "rgba(239,83,80,0.15)" },
    cancelled: { bg: "rgba(239,83,80,0.08)", text: "#ef5350", glow: "rgba(239,83,80,0.15)" },
  };
  const c = colors[status] || { bg: "rgba(255,255,255,0.06)", text: "#888", glow: "transparent" };
  return (
    <span style={{
      padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      letterSpacing: 0.8, textTransform: "uppercase",
      background: c.bg, color: c.text, boxShadow: `0 0 8px ${c.glow}`,
      whiteSpace: "nowrap",
    }}>
      {status}
    </span>
  );
}
