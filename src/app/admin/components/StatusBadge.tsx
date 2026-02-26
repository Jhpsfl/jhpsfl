"use client";

export default function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; glow: string }> = {
    scheduled: { bg: "rgba(33,150,243,0.12)", text: "#42a5f5", glow: "rgba(33,150,243,0.2)" },
    in_progress: { bg: "rgba(255,167,38,0.12)", text: "#ffa726", glow: "rgba(255,167,38,0.2)" },
    completed: { bg: "rgba(76,175,80,0.12)", text: "#66bb6a", glow: "rgba(76,175,80,0.2)" },
    cancelled: { bg: "rgba(239,83,80,0.08)", text: "#ef5350", glow: "rgba(239,83,80,0.15)" },
    active: { bg: "rgba(76,175,80,0.12)", text: "#66bb6a", glow: "rgba(76,175,80,0.2)" },
    pending: { bg: "rgba(255,167,38,0.12)", text: "#ffa726", glow: "rgba(255,167,38,0.2)" },
    failed: { bg: "rgba(239,83,80,0.08)", text: "#ef5350", glow: "rgba(239,83,80,0.15)" },
    refunded: { bg: "rgba(156,39,176,0.1)", text: "#ba68c8", glow: "rgba(156,39,176,0.15)" },
    paused: { bg: "rgba(255,167,38,0.12)", text: "#ffa726", glow: "rgba(255,167,38,0.2)" },
    draft: { bg: "rgba(158,158,158,0.1)", text: "#9e9e9e", glow: "rgba(158,158,158,0.1)" },
    sent: { bg: "rgba(33,150,243,0.12)", text: "#42a5f5", glow: "rgba(33,150,243,0.2)" },
    paid: { bg: "rgba(76,175,80,0.12)", text: "#66bb6a", glow: "rgba(76,175,80,0.2)" },
    overdue: { bg: "rgba(239,83,80,0.08)", text: "#ef5350", glow: "rgba(239,83,80,0.15)" },
    new: { bg: "rgba(0,188,212,0.12)", text: "#26c6da", glow: "rgba(0,188,212,0.2)" },
  };
  const c = colors[status] || { bg: "rgba(255,255,255,0.06)", text: "#888", glow: "transparent" };
  return (
    <span style={{
      padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      letterSpacing: 0.8, textTransform: "uppercase",
      background: c.bg, color: c.text, boxShadow: `0 0 8px ${c.glow}`,
      whiteSpace: "nowrap",
    }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
