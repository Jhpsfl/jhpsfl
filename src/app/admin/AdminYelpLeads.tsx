"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ───
interface YelpMessage {
  role: "customer" | "ai" | "admin";
  text: string;
  ts: string;
}

interface ProjectDetail {
  q?: string;
  a?: string;
}

interface YelpConversation {
  id: string;
  yelp_thread_id: string;
  customer_name: string | null;
  services: string[] | null;
  zip_code: string | null;
  urgency: string | null;
  status: string;
  ai_exchange_count: number;
  messages: YelpMessage[];
  thread_href: string | null;
  last_customer_message_at: string | null;
  last_ai_reply_at: string | null;
  created_at: string;
  project_details: ProjectDetail[] | null;
}

// ─── Helpers ───
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortTime(d: string) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function statusColor(s: string) {
  switch (s) {
    case "ai_active": return "#4CAF50";
    case "needs_attention": return "#FF9800";
    case "taken_over": return "#2196F3";
    case "completed": return "#666";
    default: return "#888";
  }
}

function statusLabel(s: string) {
  switch (s) {
    case "ai_active": return "AI Active";
    case "needs_attention": return "Needs Attention";
    case "taken_over": return "Manual";
    case "completed": return "Completed";
    default: return s;
  }
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
}

function lastMessagePreview(msgs: YelpMessage[]) {
  if (!msgs || msgs.length === 0) return "No messages yet";
  const last = msgs[msgs.length - 1];
  const prefix = last.role === "customer" ? "" : last.role === "ai" ? "AI: " : "You: ";
  const text = last.text.length > 60 ? last.text.substring(0, 60) + "..." : last.text;
  return prefix + text;
}

function lastMessageTime(conv: YelpConversation) {
  const msgs = conv.messages || [];
  if (msgs.length === 0) return conv.created_at;
  return msgs[msgs.length - 1].ts;
}

// ─── Component ───
export default function AdminYelpLeads({
  userId,
  backRef,
  onNavigate,
}: {
  userId: string;
  backRef?: React.MutableRefObject<(() => boolean) | null>;
  onNavigate?: () => void;
}) {
  const [conversations, setConversations] = useState<YelpConversation[]>([]);
  const [selected, setSelected] = useState<YelpConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const prevMsgCountRef = useRef<number>(0);

  // Back navigation for mobile
  useEffect(() => {
    if (backRef) {
      backRef.current = () => {
        if (showInfo) { setShowInfo(false); return true; }
        if (selected) { setSelected(null); return true; }
        return false;
      };
    }
  }, [backRef, selected, showInfo]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/yelp-leads?status=${filter}`);
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data);
      // Refresh selected conversation if open
      if (selected) {
        const updated = data.find((c: YelpConversation) => c.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [filter, selected]);

  useEffect(() => {
    setLoading(true);
    fetchConversations();
  }, [filter, fetchConversations]);

  // Poll every 15s
  useEffect(() => {
    pollRef.current = setInterval(fetchConversations, 60000);
    return () => clearInterval(pollRef.current);
  }, [fetchConversations]);

  // Scroll to bottom only when a new message arrives or conversation first opens
  useEffect(() => {
    const count = selected?.messages?.length || 0;
    if (count !== prevMsgCountRef.current) {
      prevMsgCountRef.current = count;
      messagesEndRef.current?.scrollIntoView({ behavior: count === 0 ? "instant" : "smooth" });
    }
  }, [selected?.messages?.length]);

  const doAction = async (action: string) => {
    if (!selected) return;
    setActionLoading(action);
    try {
      const res = await fetch("/api/yelp-leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelected(prev => prev ? { ...prev, status: data.status } : null);
        fetchConversations();
      }
    } catch { /* silent */ }
    setActionLoading("");
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/yelp-leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action: "send_reply", message: replyText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setSelected(prev => prev ? { ...prev, messages: data.messages, status: "taken_over" } : null);
        }
        setReplyText("");
        fetchConversations();
      }
    } catch { /* silent */ }
    setSending(false);
  };

  const openConversation = (conv: YelpConversation) => {
    prevMsgCountRef.current = 0; // reset so it scrolls to bottom on open
    setSelected(conv);
    setShowInfo(false);
    onNavigate?.();
  };

  // ─── THREAD LIST VIEW ───
  const renderList = () => (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Filter bar */}
      <div style={{
        display: "flex", gap: "6px", padding: "12px", overflowX: "auto",
        borderBottom: "1px solid #1a3a1a", flexShrink: 0,
      }}>
        {[
          { key: "all", label: "All" },
          { key: "ai_active", label: "AI Active" },
          { key: "needs_attention", label: "Attention" },
          { key: "taken_over", label: "Manual" },
          { key: "completed", label: "Done" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "6px 14px", borderRadius: "16px", border: "none", fontSize: "13px",
            fontWeight: filter === f.key ? 700 : 500, whiteSpace: "nowrap",
            background: filter === f.key ? "#4CAF50" : "rgba(76,175,80,0.1)",
            color: filter === f.key ? "#fff" : "#8ab88a", cursor: "pointer",
          }}>{f.label}</button>
        ))}
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#5a8a5a" }}>Loading...</div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#5a8a5a" }}>No leads found</div>
        ) : conversations.map(conv => {
          const hasUnread = conv.status === "needs_attention";
          return (
            <button key={conv.id} onClick={() => openConversation(conv)} style={{
              display: "flex", alignItems: "center", gap: "12px", width: "100%",
              padding: "14px 16px", border: "none", borderBottom: "1px solid #1a3a1a",
              background: hasUnread ? "rgba(255,152,0,0.06)" : "transparent",
              cursor: "pointer", textAlign: "left",
            }}>
              {/* Avatar */}
              <div style={{
                width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg, ${statusColor(conv.status)}33, ${statusColor(conv.status)}11)`,
                border: `2px solid ${statusColor(conv.status)}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "14px", fontWeight: 700, color: statusColor(conv.status),
              }}>
                {getInitials(conv.customer_name)}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                  <span style={{
                    fontWeight: hasUnread ? 700 : 600, fontSize: "15px",
                    color: hasUnread ? "#fff" : "#ccc",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {conv.customer_name || "Unknown"}
                  </span>
                  <span style={{ fontSize: "12px", color: "#5a8a5a", flexShrink: 0, marginLeft: "8px" }}>
                    {timeAgo(lastMessageTime(conv))}
                  </span>
                </div>
                <div style={{
                  fontSize: "13px", color: hasUnread ? "#aaa" : "#666",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {(conv.services || []).join(", ") || "—"}
                </div>
                <div style={{
                  fontSize: "12px", color: hasUnread ? "#999" : "#555", marginTop: "2px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {lastMessagePreview(conv.messages || [])}
                </div>
              </div>

              {/* Status dot */}
              <div style={{
                width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
                background: statusColor(conv.status),
                boxShadow: conv.status === "ai_active" ? `0 0 6px ${statusColor(conv.status)}` : "none",
              }} />
            </button>
          );
        })}
      </div>
    </div>
  );

  // ─── CHAT VIEW ───
  const renderChat = () => {
    if (!selected) return null;
    const msgs = selected.messages || [];

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0a1a0a" }}>
        {/* Header */}
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid #1a3a1a", flexShrink: 0,
          background: "rgba(5,14,5,0.95)", backdropFilter: "blur(10px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => setSelected(null)} style={{
              background: "none", border: "none", color: "#4CAF50", fontSize: "20px",
              cursor: "pointer", padding: "4px",
            }}>&larr;</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "16px", color: "#fff" }}>
                {selected.customer_name || "Unknown"}
              </div>
              <div style={{ fontSize: "12px", color: "#5a8a5a" }}>
                {(selected.services || []).join(", ")} {selected.zip_code ? `| ${selected.zip_code}` : ""}
              </div>
            </div>
            <button onClick={() => setShowInfo(!showInfo)} style={{
              background: showInfo ? "rgba(76,175,80,0.2)" : "none",
              border: "1px solid #2a4a2a", borderRadius: "8px",
              color: "#4CAF50", fontSize: "14px", padding: "6px 10px", cursor: "pointer",
            }}>Info</button>
          </div>

          {/* Status bar + actions */}
          <div style={{
            display: "flex", alignItems: "center", gap: "8px", marginTop: "8px",
            flexWrap: "wrap",
          }}>
            <span style={{
              fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "10px",
              background: `${statusColor(selected.status)}22`,
              color: statusColor(selected.status),
              border: `1px solid ${statusColor(selected.status)}44`,
            }}>
              {statusLabel(selected.status)}
            </span>
            <span style={{ fontSize: "11px", color: "#5a8a5a" }}>
              {selected.ai_exchange_count} AI replies
            </span>
            <div style={{ flex: 1 }} />
            {selected.status === "ai_active" && (
              <button onClick={() => doAction("take_over")} disabled={!!actionLoading} style={{
                fontSize: "12px", padding: "4px 12px", borderRadius: "6px", border: "none",
                background: "#2196F3", color: "#fff", cursor: "pointer", fontWeight: 600,
                opacity: actionLoading ? 0.5 : 1,
              }}>Take Over</button>
            )}
            {selected.status === "taken_over" && (
              <button onClick={() => doAction("resume_ai")} disabled={!!actionLoading} style={{
                fontSize: "12px", padding: "4px 12px", borderRadius: "6px", border: "none",
                background: "#4CAF50", color: "#fff", cursor: "pointer", fontWeight: 600,
                opacity: actionLoading ? 0.5 : 1,
              }}>Resume AI</button>
            )}
            {selected.status !== "completed" && (
              <button onClick={() => doAction("complete")} disabled={!!actionLoading} style={{
                fontSize: "12px", padding: "4px 12px", borderRadius: "6px",
                border: "1px solid #333", background: "transparent",
                color: "#888", cursor: "pointer", fontWeight: 600,
                opacity: actionLoading ? 0.5 : 1,
              }}>Done</button>
            )}
          </div>
        </div>

        {/* Info panel (slide down) */}
        {showInfo && (
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid #1a3a1a",
            background: "rgba(20,40,20,0.5)", fontSize: "13px", color: "#aaa",
          }}>
            {selected.urgency && (
              <div style={{ marginBottom: "6px" }}>
                <span style={{ color: "#5a8a5a" }}>Timeline:</span> {selected.urgency}
              </div>
            )}
            {selected.zip_code && (
              <div style={{ marginBottom: "6px" }}>
                <span style={{ color: "#5a8a5a" }}>Location:</span> {selected.zip_code}
              </div>
            )}
            {(selected.project_details || []).length > 0 && (
              <div>
                <div style={{ color: "#5a8a5a", marginBottom: "4px" }}>Project Details:</div>
                {(selected.project_details || []).map((d, i) => (
                  <div key={i} style={{ marginLeft: "8px", marginBottom: "3px", fontSize: "12px" }}>
                    {d.q ? <><span style={{ color: "#666" }}>{d.q}</span> <span style={{ color: "#ccc" }}>{d.a}</span></> : d.a}
                  </div>
                ))}
              </div>
            )}
            {selected.thread_href && (
              <div style={{ marginTop: "8px" }}>
                <a href={selected.thread_href} target="_blank" rel="noopener noreferrer"
                  style={{ color: "#4CAF50", fontSize: "12px" }}>Open on Yelp &rarr;</a>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "16px 12px",
          WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", gap: "8px",
        }}>
          {msgs.length === 0 ? (
            <div style={{ textAlign: "center", color: "#5a8a5a", padding: "40px 0" }}>
              No messages yet
            </div>
          ) : msgs.map((msg, i) => {
            const isCustomer = msg.role === "customer";
            const isAI = msg.role === "ai";
            const isAdmin = msg.role === "admin";
            const isOutgoing = isAI || isAdmin;

            return (
              <div key={i} style={{
                display: "flex", flexDirection: "column",
                alignItems: isOutgoing ? "flex-end" : "flex-start",
                maxWidth: "85%", alignSelf: isOutgoing ? "flex-end" : "flex-start",
              }}>
                {/* Role label */}
                <div style={{
                  fontSize: "10px", color: "#5a8a5a", marginBottom: "2px",
                  paddingLeft: isCustomer ? "12px" : "0",
                  paddingRight: isOutgoing ? "12px" : "0",
                }}>
                  {isCustomer ? (selected.customer_name?.split(" ")[0] || "Customer") : isAI ? "AI Bot" : "You"}
                </div>
                {/* Bubble */}
                <div style={{
                  padding: "10px 14px",
                  borderRadius: isOutgoing ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: isCustomer ? "#1a2e1a" : isAI ? "#1a3a2a" : "#1a2a4a",
                  border: `1px solid ${isCustomer ? "#2a4a2a" : isAI ? "#2a5a3a" : "#2a3a6a"}`,
                  color: "#ddd", fontSize: "14px", lineHeight: "1.45",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {msg.text}
                </div>
                {/* Timestamp */}
                <div style={{
                  fontSize: "10px", color: "#444", marginTop: "2px",
                  paddingLeft: isCustomer ? "12px" : "0",
                  paddingRight: isOutgoing ? "12px" : "0",
                }}>
                  {shortTime(msg.ts)}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply input */}
        {selected.status !== "completed" && (
          <div style={{
            padding: "10px 12px", borderTop: "1px solid #1a3a1a",
            background: "rgba(5,14,5,0.95)", flexShrink: 0,
            paddingBottom: "max(10px, env(safe-area-inset-bottom))",
          }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <textarea
                ref={textareaRef}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="Type a reply..."
                rows={1}
                style={{
                  flex: 1, resize: "none", padding: "10px 14px", borderRadius: "20px",
                  border: "1px solid #2a4a2a", background: "#0d1f0d", color: "#ddd",
                  fontSize: "15px", fontFamily: "inherit", outline: "none",
                  maxHeight: "100px", lineHeight: "1.4",
                }}
                onInput={e => {
                  const ta = e.currentTarget;
                  ta.style.height = "auto";
                  ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
                }}
              />
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || sending}
                style={{
                  width: "44px", height: "44px", borderRadius: "50%", border: "none",
                  background: replyText.trim() ? "#4CAF50" : "#1a3a1a",
                  color: replyText.trim() ? "#fff" : "#5a8a5a",
                  fontSize: "18px", cursor: replyText.trim() ? "pointer" : "default",
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s",
                }}
              >
                {sending ? "..." : "\u2191"}
              </button>
            </div>
            {selected.status === "ai_active" && (
              <div style={{
                fontSize: "11px", color: "#FF9800", textAlign: "center",
                marginTop: "6px", opacity: 0.8,
              }}>
                AI is handling this conversation. Sending a reply will take over.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── RENDER ───
  return (
    <div style={{ height: "calc(100vh - 140px)", display: "flex", flexDirection: "column" }}>
      {selected ? renderChat() : renderList()}
    </div>
  );
}
