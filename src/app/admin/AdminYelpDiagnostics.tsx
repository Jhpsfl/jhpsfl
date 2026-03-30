"use client";

import { useState, useEffect, useCallback } from "react";

interface AgentHealth {
  heartbeat_at: string;
  uptime_seconds: number;
  memory_mb: number;
  browser_status: string;
  session_age_min: number;
  scrapes_today: number;
  scrapes_hour: number;
  rate_budget_remaining: number;
  queue_depth: number;
  errors_today: number;
  last_error: string | null;
  last_error_at: string | null;
  circuit_state: string;
}

interface DiagnosticsData {
  health: AgentHealth | null;
  is_alive: boolean;
  rate_limits: {
    max_scrapes_per_day: number;
    max_scrapes_per_hour: number;
    current_status: string;
    blocked_until: string | null;
  } | null;
  stats: { triggers_today: number; triggers_week: number; errors_today: number };
  dead_letters: Array<{ id: string; message: string; context: Record<string, unknown>; created_at: string }>;
  queue: Array<{ id: string; trigger_type: string; customer_name: string; status: string; created_at: string; processed_at: string; retry_count: number }>;
}

interface ErrorLog {
  id: string;
  error_type: string;
  message: string;
  context: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function statusDot(alive: boolean) {
  return (
    <span style={{
      display: "inline-block", width: "10px", height: "10px", borderRadius: "50%",
      background: alive ? "#4CAF50" : "#ef4444",
      boxShadow: alive ? "0 0 6px #4CAF50" : "0 0 6px #ef4444",
      marginRight: "6px",
    }} />
  );
}

export default function AdminYelpDiagnostics({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");
  const [activeSection, setActiveSection] = useState<"overview" | "queue" | "errors" | "dead_letters">("overview");

  const fetchData = useCallback(async () => {
    try {
      const [mainRes, errRes] = await Promise.all([
        fetch("/api/yelp-diagnostics"),
        fetch("/api/yelp-diagnostics?section=errors"),
      ]);
      if (mainRes.ok) setData(await mainRes.json());
      if (errRes.ok) setErrors(await errRes.json());
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const doAction = async (action: string, payload?: Record<string, unknown>) => {
    setActionMsg(`Running ${action}...`);
    try {
      const res = await fetch("/api/yelp-agent/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const result = await res.json();
      setActionMsg(result.message || result.ok ? `✓ ${action} done` : `✗ ${action} failed`);
      fetchData();
    } catch (e) {
      setActionMsg(`✗ ${action} error`);
    }
    setTimeout(() => setActionMsg(""), 3000);
  };

  const doDiagAction = async (action: string, payload?: Record<string, unknown>) => {
    try {
      await fetch("/api/yelp-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      fetchData();
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#5a8a5a" }}>
        Loading diagnostics...
      </div>
    );
  }

  const health = data?.health;
  const alive = data?.is_alive || false;
  const heartbeatAge = health?.heartbeat_at
    ? Math.round((Date.now() - new Date(health.heartbeat_at).getTime()) / 1000)
    : null;

  const cardStyle: React.CSSProperties = {
    background: "rgba(10,20,10,0.8)", border: "1px solid #1a3a1a",
    borderRadius: "12px", padding: "14px 16px", marginBottom: "10px",
  };

  const sectionBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: "16px", border: "none", fontSize: "12px",
    background: active ? "#4CAF50" : "rgba(76,175,80,0.1)",
    color: active ? "#fff" : "#8ab88a", cursor: "pointer", fontWeight: active ? 700 : 400,
  });

  return (
    <div style={{ height: "calc(100vh - 140px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid #1a3a1a",
        background: "rgba(5,14,5,0.95)", flexShrink: 0,
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: "#4CAF50", fontSize: "20px", cursor: "pointer", padding: "2px 6px",
        }}>&larr;</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "15px", color: "#fff" }}>
            {statusDot(alive)}
            Yelp Agent Diagnostics
          </div>
          <div style={{ fontSize: "11px", color: "#5a8a5a" }}>
            {alive ? `Heartbeat ${heartbeatAge}s ago` : heartbeatAge ? `Last seen ${heartbeatAge}s ago — OFFLINE` : "No heartbeat data"}
          </div>
        </div>
        <button onClick={fetchData} style={{
          padding: "5px 12px", border: "1px solid #2a4a2a", borderRadius: "8px",
          background: "none", color: "#4CAF50", fontSize: "12px", cursor: "pointer",
        }}>Refresh</button>
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: "6px", padding: "10px 12px", borderBottom: "1px solid #1a3a1a", flexShrink: 0, overflowX: "auto" }}>
        {(["overview", "queue", "errors", "dead_letters"] as const).map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={sectionBtnStyle(activeSection === s)}>
            {s === "dead_letters" ? "Dead Letters" : s.charAt(0).toUpperCase() + s.slice(1)}
            {s === "queue" && data?.queue?.length ? ` (${data.queue.length})` : ""}
            {s === "errors" && errors.filter(e => !e.resolved).length ? ` (${errors.filter(e => !e.resolved).length})` : ""}
            {s === "dead_letters" && data?.dead_letters?.length ? ` (${data.dead_letters.length})` : ""}
          </button>
        ))}
      </div>

      {actionMsg && (
        <div style={{
          padding: "8px 16px", background: "rgba(76,175,80,0.1)", borderBottom: "1px solid #1a3a1a",
          fontSize: "13px", color: "#4CAF50", flexShrink: 0,
        }}>{actionMsg}</div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {/* ─── OVERVIEW ─── */}
        {activeSection === "overview" && (
          <>
            {/* Agent health card */}
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, color: "#4CAF50", marginBottom: "10px", fontSize: "13px" }}>Agent Health</div>
              {health ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px", color: "#aaa" }}>
                  <div><span style={{ color: "#5a8a5a" }}>Uptime:</span> {formatUptime(health.uptime_seconds)}</div>
                  <div><span style={{ color: "#5a8a5a" }}>Memory:</span> {health.memory_mb}MB</div>
                  <div><span style={{ color: "#5a8a5a" }}>Circuit:</span> <span style={{ color: health.circuit_state === "CLOSED" ? "#4CAF50" : "#ef4444", fontWeight: 700 }}>{health.circuit_state}</span></div>
                  <div><span style={{ color: "#5a8a5a" }}>Browser:</span> {health.browser_status}</div>
                  <div><span style={{ color: "#5a8a5a" }}>Queue:</span> {health.queue_depth} pending</div>
                  <div><span style={{ color: "#5a8a5a" }}>Errors today:</span> {health.errors_today}</div>
                </div>
              ) : (
                <div style={{ color: "#666", fontSize: "12px" }}>No health data available</div>
              )}
              {health?.last_error && (
                <div style={{
                  marginTop: "8px", padding: "6px 10px", borderRadius: "6px",
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                  fontSize: "11px", color: "#ef4444",
                }}>
                  Last error ({health.last_error_at ? timeAgo(health.last_error_at) : "?"}): {health.last_error.substring(0, 120)}
                </div>
              )}
            </div>

            {/* Rate limit card */}
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, color: "#4CAF50", marginBottom: "10px", fontSize: "13px" }}>Rate Limit Budget</div>
              {health && data?.rate_limits ? (
                <>
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#aaa", marginBottom: "3px" }}>
                      <span>Daily scrapes</span>
                      <span style={{ color: health.scrapes_today >= data.rate_limits.max_scrapes_per_day * 0.8 ? "#ef4444" : "#4CAF50" }}>
                        {health.scrapes_today}/{data.rate_limits.max_scrapes_per_day}
                      </span>
                    </div>
                    <div style={{ height: "6px", borderRadius: "3px", background: "#1a3a1a", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: "3px",
                        width: `${Math.min(100, (health.scrapes_today / data.rate_limits.max_scrapes_per_day) * 100)}%`,
                        background: health.scrapes_today >= data.rate_limits.max_scrapes_per_day * 0.8 ? "#ef4444" : "#4CAF50",
                        transition: "width 0.3s",
                      }} />
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: "#aaa" }}>
                    <span style={{ color: "#5a8a5a" }}>Status:</span>{" "}
                    <span style={{ color: data.rate_limits.current_status === "normal" ? "#4CAF50" : "#ef4444", fontWeight: 700 }}>
                      {data.rate_limits.current_status.toUpperCase()}
                    </span>
                    {data.rate_limits.blocked_until && (
                      <span style={{ color: "#ef4444" }}> (until {new Date(data.rate_limits.blocked_until).toLocaleTimeString()})</span>
                    )}
                  </div>
                </>
              ) : <div style={{ color: "#666", fontSize: "12px" }}>Loading rate limit data...</div>}
            </div>

            {/* Stats card */}
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, color: "#4CAF50", marginBottom: "10px", fontSize: "13px" }}>Activity</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", textAlign: "center" }}>
                {[
                  { label: "Triggers Today", value: data?.stats.triggers_today || 0 },
                  { label: "Triggers Week", value: data?.stats.triggers_week || 0 },
                  { label: "Errors Today", value: data?.stats.errors_today || 0, danger: (data?.stats.errors_today || 0) > 5 },
                ].map(s => (
                  <div key={s.label} style={{ padding: "8px", background: "rgba(0,0,0,0.3)", borderRadius: "8px" }}>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: s.danger ? "#ef4444" : "#4CAF50" }}>{s.value}</div>
                    <div style={{ fontSize: "10px", color: "#5a8a5a" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin actions */}
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, color: "#4CAF50", marginBottom: "10px", fontSize: "13px" }}>Admin Actions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {[
                  { action: "reset_circuit", label: "Reset Circuit Breaker", color: "#f97316" },
                  { action: "retry_failed", label: "Retry All Failed", color: "#4CAF50" },
                  { action: "clear_stale", label: "Clear Stale", color: "#2196F3" },
                  { action: "clear_browser", label: "Clear Browser Session", color: "#888" },
                ].map(btn => (
                  <button key={btn.action} onClick={() => doAction(btn.action)} style={{
                    padding: "7px 14px", borderRadius: "8px",
                    border: `1px solid ${btn.color}44`,
                    background: `${btn.color}15`, color: btn.color,
                    fontSize: "12px", cursor: "pointer", fontWeight: 600,
                  }}>{btn.label}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ─── TRIGGER QUEUE ─── */}
        {activeSection === "queue" && (
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ fontWeight: 700, color: "#4CAF50", fontSize: "13px" }}>Trigger Queue</div>
              <button onClick={() => doAction("retry_failed")} style={{
                padding: "4px 10px", borderRadius: "6px", border: "1px solid #4CAF5044",
                background: "rgba(76,175,80,0.1)", color: "#4CAF50", fontSize: "11px", cursor: "pointer",
              }}>Retry All Failed</button>
            </div>
            {!data?.queue?.length ? (
              <div style={{ color: "#5a8a5a", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>No active triggers</div>
            ) : data.queue.map(t => (
              <div key={t.id} style={{
                padding: "10px 12px", borderRadius: "8px", marginBottom: "6px",
                background: "rgba(0,0,0,0.3)", border: `1px solid ${t.status === "failed" ? "#ef444430" : "#1a3a1a"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 600, color: "#ddd", fontSize: "13px" }}>{t.customer_name || "Unknown"}</span>
                  <span style={{
                    fontSize: "10px", padding: "2px 7px", borderRadius: "8px", fontWeight: 700,
                    background: t.status === "failed" ? "rgba(239,68,68,0.2)" : t.status === "processing" ? "rgba(33,150,243,0.2)" : "rgba(76,175,80,0.2)",
                    color: t.status === "failed" ? "#ef4444" : t.status === "processing" ? "#2196F3" : "#4CAF50",
                  }}>{t.status}</span>
                </div>
                <div style={{ fontSize: "11px", color: "#666" }}>
                  {t.trigger_type} · {timeAgo(t.created_at)}
                  {t.retry_count > 0 && <span style={{ color: "#f97316" }}> · {t.retry_count} retries</span>}
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                  <button onClick={() => doAction("retry_trigger", { triggerId: t.id })} style={{
                    padding: "3px 8px", borderRadius: "4px", border: "1px solid #4CAF5044",
                    background: "rgba(76,175,80,0.1)", color: "#4CAF50", fontSize: "11px", cursor: "pointer",
                  }}>Retry</button>
                  <button onClick={() => doAction("cancel_trigger", { triggerId: t.id })} style={{
                    padding: "3px 8px", borderRadius: "4px", border: "1px solid #66666644",
                    background: "rgba(0,0,0,0.2)", color: "#888", fontSize: "11px", cursor: "pointer",
                  }}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── ERRORS ─── */}
        {activeSection === "errors" && (
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ fontWeight: 700, color: "#4CAF50", fontSize: "13px" }}>Error Log</div>
              <button onClick={() => doDiagAction("clear_resolved")} style={{
                padding: "4px 10px", borderRadius: "6px", border: "1px solid #66666644",
                background: "rgba(0,0,0,0.2)", color: "#888", fontSize: "11px", cursor: "pointer",
              }}>Clear Resolved</button>
            </div>
            {!errors.length ? (
              <div style={{ color: "#5a8a5a", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>No errors</div>
            ) : errors.map(err => (
              <div key={err.id} style={{
                padding: "10px 12px", borderRadius: "8px", marginBottom: "6px",
                background: err.resolved ? "rgba(0,0,0,0.2)" : "rgba(239,68,68,0.05)",
                border: `1px solid ${err.resolved ? "#1a3a1a" : "#ef444430"}`,
                opacity: err.resolved ? 0.5 : 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ fontWeight: 600, color: err.resolved ? "#666" : "#ef4444", fontSize: "12px" }}>{err.error_type}</span>
                  <span style={{ fontSize: "10px", color: "#555" }}>{timeAgo(err.created_at)}</span>
                </div>
                <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "6px" }}>{err.message.substring(0, 200)}</div>
                {!err.resolved && (
                  <button onClick={() => doDiagAction("resolve_error", { id: err.id })} style={{
                    padding: "2px 8px", borderRadius: "4px", border: "1px solid #66666644",
                    background: "rgba(0,0,0,0.2)", color: "#888", fontSize: "11px", cursor: "pointer",
                  }}>Mark Resolved</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── DEAD LETTERS ─── */}
        {activeSection === "dead_letters" && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, color: "#ef4444", marginBottom: "10px", fontSize: "13px" }}>Dead Letter Queue</div>
            {!data?.dead_letters?.length ? (
              <div style={{ color: "#5a8a5a", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>No dead letters</div>
            ) : data.dead_letters.map(dl => (
              <div key={dl.id} style={{
                padding: "10px 12px", borderRadius: "8px", marginBottom: "6px",
                background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 600, color: "#ef4444", fontSize: "12px" }}>Failed Delivery</span>
                  <span style={{ fontSize: "10px", color: "#555" }}>{timeAgo(dl.created_at)}</span>
                </div>
                {dl.context?.messageText && (
                  <div style={{
                    padding: "6px 10px", borderRadius: "6px", background: "rgba(0,0,0,0.3)",
                    fontSize: "12px", color: "#aaa", marginBottom: "6px",
                    maxHeight: "80px", overflow: "hidden",
                  }}>{String(dl.context.messageText).substring(0, 300)}</div>
                )}
                <div style={{ display: "flex", gap: "6px" }}>
                  {dl.context?.messageText && (
                    <button onClick={() => navigator.clipboard.writeText(String(dl.context.messageText))} style={{
                      padding: "3px 8px", borderRadius: "4px", border: "1px solid #4CAF5044",
                      background: "rgba(76,175,80,0.1)", color: "#4CAF50", fontSize: "11px", cursor: "pointer",
                    }}>Copy Message</button>
                  )}
                  <button onClick={() => doDiagAction("resolve_dead_letter", { id: dl.id })} style={{
                    padding: "3px 8px", borderRadius: "4px", border: "1px solid #66666644",
                    background: "rgba(0,0,0,0.2)", color: "#888", fontSize: "11px", cursor: "pointer",
                  }}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
