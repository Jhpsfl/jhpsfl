"use client";

import type { Tab } from "../AdminDashboard";

export default function MobileNav({ activeTab, onSwitchTab }: {
  activeTab: Tab;
  onSwitchTab: (tab: Tab) => void;
}) {
  return (
    <div className="mobile-bottom-nav" style={{
      display: "none",
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "rgba(5,14,5,0.98)",
      borderTop: "1px solid #1a3a1a",
      padding: "12px 8px 20px",
      zIndex: 90,
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      boxShadow: "0 -4px 30px rgba(0,0,0,0.4)"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        gap: "4px"
      }}>
        {[
          { icon: "📊", label: "Overview", tab: "overview" as Tab },
          { icon: "👥", label: "Customers", tab: "customers" as Tab },
          { icon: "🔧", label: "Jobs", tab: "jobs" as Tab },
          { icon: "💰", label: "Payments", tab: "payments" as Tab },
          { icon: "📹", label: "Leads", tab: "video_leads" as Tab }
        ].map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => onSwitchTab(item.tab)}
              data-active={isActive}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: isActive ? "rgba(76,175,80,0.15)" : "transparent",
                border: "none",
                color: isActive ? "#4CAF50" : "#5a8a5a",
                padding: "8px 4px",
                minWidth: "64px",
                minHeight: "64px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: isActive ? 700 : 500,
                transition: "all 0.2s",
                position: "relative",
                flex: 1,
                borderRadius: "12px",
                outline: "none"
              }}
              aria-label={`Switch to ${item.label}`}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = "scale(0.95)";
                e.currentTarget.style.background = "rgba(76,175,80,0.2)";
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.background = isActive ? "rgba(76,175,80,0.15)" : "transparent";
              }}
              onMouseOver={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#7ab87a";
                  e.currentTarget.style.background = "rgba(76,175,80,0.08)";
                }
              }}
              onMouseOut={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#5a8a5a";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span style={{
                fontSize: "22px",
                marginBottom: "4px",
                transition: "transform 0.2s",
                transform: isActive ? "scale(1.1)" : "scale(1)",
                display: "inline-block"
              }}>{item.icon}</span>
              <span style={{
                fontSize: "11px",
                fontWeight: isActive ? 700 : 500,
                letterSpacing: "0.3px"
              }}>{item.label}</span>
              {isActive && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "24px",
                  height: "3px",
                  background: "#4CAF50",
                  borderRadius: "0 0 2px 2px",
                  boxShadow: "0 0 8px rgba(76,175,80,0.5)"
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
