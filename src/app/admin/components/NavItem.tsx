"use client";

export default function NavItem({ icon, label, active, onClick, badge }: {
  icon: string; label: string; active: boolean; onClick: () => void; badge?: number;
}) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%",
      padding: "12px 16px", borderRadius: 12, border: "none",
      background: active ? "linear-gradient(135deg, rgba(76,175,80,0.15), rgba(46,125,50,0.08))" : "transparent",
      color: active ? "#4CAF50" : "#6a9a6a",
      fontSize: 14, fontWeight: active ? 700 : 500, cursor: "pointer",
      fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
      textAlign: "left", position: "relative",
    }}
    onMouseOver={(e) => { if (!active) e.currentTarget.style.background = "rgba(76,175,80,0.05)"; }}
    onMouseOut={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          marginLeft: "auto", background: "#4CAF50", color: "#fff",
          fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10,
          fontFamily: "'JetBrains Mono', monospace",
        }}>{badge}</span>
      )}
    </button>
  );
}
