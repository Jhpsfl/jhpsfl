"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useYelpRealtime } from "@/lib/supabase-realtime";
import { temperatureColor, stageLabel, formatSilentTime } from "@/lib/yelp-intelligence";

// ─── Types ───
interface YelpMessage {
  role: "customer" | "ai" | "admin" | "system";
  text: string;
  ts: string;
}

interface ProjectDetail {
  q?: string;
  a?: string;
}

interface QuickReply {
  id: string;
  label: string;
  body: string;
  sort_order: number;
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
  lead_score: number | null;
  lead_temperature: string | null;
  conversation_stage: string | null;
  sentiment: string | null;
  pinned: boolean | null;
  starred: boolean | null;
  last_admin_read_at: string | null;
  draft_text: string | null;
  yelp_masked_email: string | null;
  delivery_status: string | null;
  updated_at: string | null;
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

function hasUnread(conv: YelpConversation) {
  const msgs = conv.messages || [];
  if (msgs.length === 0) return false;
  const last = msgs[msgs.length - 1];
  if (last.role !== "customer") return false;
  if (!conv.last_admin_read_at) return true;
  return new Date(last.ts) > new Date(conv.last_admin_read_at);
}

function tempBadge(temp: string | null) {
  if (!temp) return null;
  const color = temperatureColor(temp);
  const label = temp === "hot" ? "🔥 Hot" : temp === "warm" ? "☀ Warm" : "❄ Cold";
  return { color, label };
}

// ─── Component ───
export default function AdminYelpLeads({
  userId,
  backRef,
  onNavigate,
  pendingReply,
  onPendingReplyConsumed,
  onShowDiagnostics,
}: {
  userId: string;
  backRef?: React.MutableRefObject<(() => boolean) | null>;
  onNavigate?: () => void;
  pendingReply?: { conversation_id: string; message: string; customer_name: string } | null;
  onPendingReplyConsumed?: () => void;
  onShowDiagnostics?: () => void;
}) {
  const [conversations, setConversations] = useState<YelpConversation[]>([]);
  const [selected, setSelected] = useState<YelpConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YelpConversation[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [proofreading, setProofreading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [draftSaving, setDraftSaving] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const prevMsgCountRef = useRef<number>(0);
  const selectedRef = useRef<YelpConversation | null>(null);
  const filterRef = useRef(filter);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { filterRef.current = filter; }, [filter]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), toast.type === "error" ? 6000 : 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Back navigation
  useEffect(() => {
    if (backRef) {
      backRef.current = () => {
        if (showQuickReplies) { setShowQuickReplies(false); return true; }
        if (showInfo) { setShowInfo(false); return true; }
        if (selected) { setSelected(null); return true; }
        return false;
      };
    }
  }, [backRef, selected, showInfo, showQuickReplies]);

  const fetchConversations = useCallback(async (showLoading?: boolean) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/yelp-leads?status=${filterRef.current}`);
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data);
      const sel = selectedRef.current;
      if (sel) {
        const updated = data.find((c: YelpConversation) => c.id === sel.id);
        if (updated) setSelected(updated);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  // Realtime subscription
  const { connected: realtimeConnected } = useYelpRealtime(
    useCallback(() => {
      // A conversation changed — refetch list
      fetchConversations();
    }, [fetchConversations])
  );

  useEffect(() => { fetchConversations(true); }, [filter, fetchConversations]);

  // Fallback polling every 60s (realtime covers most updates)
  useEffect(() => {
    pollRef.current = setInterval(() => fetchConversations(), 60000);
    return () => clearInterval(pollRef.current);
  }, [fetchConversations]);

  // Load quick reply templates
  useEffect(() => {
    fetch("/api/yelp-leads/templates")
      .then(r => r.ok ? r.json() : [])
      .then(data => setQuickReplies(data || []))
      .catch(() => {});
  }, []);

  // Handle pendingReply prop
  useEffect(() => {
    if (!pendingReply?.conversation_id || !pendingReply?.message) return;
    fetchConversations(true);
  }, [pendingReply]);

  useEffect(() => {
    if (!pendingReply?.conversation_id || !pendingReply?.message) return;
    if (conversations.length === 0) return;
    const conv = conversations.find(c => c.id === pendingReply.conversation_id);
    if (conv) {
      setSelected(conv);
      setReplyText(pendingReply.message);
      setTimeout(() => textareaRef.current?.focus(), 300);
      onPendingReplyConsumed?.();
    }
  }, [conversations, pendingReply]);

  // Scroll to bottom
  useEffect(() => {
    const count = selected?.messages?.length || 0;
    if (count !== prevMsgCountRef.current) {
      prevMsgCountRef.current = count;
      messagesEndRef.current?.scrollIntoView({ behavior: count === 0 ? "instant" : "smooth" });
    }
  }, [selected?.messages?.length]);

  // Search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/yelp-leads/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) setSearchResults(await res.json());
      } catch { /* silent */ }
      setSearchLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Draft auto-save (debounce 1s)
  const saveDraft = useCallback((id: string, text: string) => {
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(async () => {
      setDraftSaving(true);
      try {
        await fetch("/api/yelp-leads/draft", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, draft_text: text || null }),
        });
      } catch { /* silent */ }
      setDraftSaving(false);
    }, 1000);
  }, []);

  const doAction = async (action: string) => {
    if (!selected) return;
    if (action === "complete" && !confirm("Mark this lead as done?")) return;
    setActionLoading(action);
    try {
      const res = await fetch("/api/yelp-leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action }),
      });
      if (res.ok) {
        const data = await res.json();
        if (action === "complete") setSelected(null);
        else setSelected(prev => prev ? { ...prev, status: data.status } : null);
        fetchConversations();
      }
    } catch { /* silent */ }
    setActionLoading("");
  };

  const toggleStar = async (field: "pinned" | "starred", value: boolean) => {
    if (!selected) return;
    try {
      await fetch("/api/yelp-leads/star", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, field, value }),
      });
      setSelected(prev => prev ? { ...prev, [field]: value } : null);
      fetchConversations();
    } catch { /* silent */ }
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim() || sending) return;
    setSending(true);
    // Clear draft
    clearTimeout(draftTimerRef.current);
    try {
      const res = await fetch("/api/yelp-leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action: "send_reply", message: replyText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.messages) setSelected(prev => prev ? { ...prev, messages: data.messages, status: "taken_over" } : null);
        setReplyText("");
        // Clear saved draft
        fetch("/api/yelp-leads/draft", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, draft_text: null }) });
        setToast({ message: "Sending to Yelp...", type: "success" });
        fetchConversations();

        if (data.triggerId) {
          let polls = 0;
          const poller = setInterval(async () => {
            polls++;
            try {
              const statusRes = await fetch(`/api/yelp-leads?triggerId=${data.triggerId}`);
              if (statusRes.ok) {
                const trigger = await statusRes.json();
                if (trigger.status === "completed") {
                  clearInterval(poller);
                  setToast({ message: "Message delivered", type: "success" });
                  fetchConversations();
                } else if (trigger.status === "failed") {
                  clearInterval(poller);
                  setToast({ message: "Failed to deliver — try resending", type: "error" });
                }
              }
            } catch { /* silent */ }
            if (polls >= 40) clearInterval(poller);
          }, 3000);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setToast({ message: `Failed: ${err.error || res.statusText}`, type: "error" });
      }
    } catch { setToast({ message: "Network error", type: "error" }); }
    setSending(false);
  };

  const proofreadReply = async () => {
    if (!selected || !replyText.trim() || proofreading) return;
    setProofreading(true);
    try {
      const res = await fetch("/api/yelp-leads/proofread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: replyText.trim(),
          customerName: selected.customer_name,
          service: (selected.services || []).join(", "),
          conversationHistory: selected.messages || [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.proofread) {
          if (data.mode === "suggestion") { setSuggestion(data.proofread); setSuggestDismissed(false); }
          else { setReplyText(data.proofread); textareaRef.current?.focus(); }
        }
      }
    } catch { /* silent */ }
    setProofreading(false);
  };

  const syncThread = async () => {
    if (!selected || syncing) return;
    setSyncing(true);
    try {
      await fetch("/api/yelp-leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action: "sync_thread" }),
      });
      let polls = 0;
      const poller = setInterval(async () => {
        polls++;
        await fetchConversations();
        if (polls >= 10) { clearInterval(poller); setSyncing(false); }
      }, 3000);
      setTimeout(() => setSyncing(false), 30000);
    } catch { setSyncing(false); }
  };

  const fetchSuggestion = useCallback(async (convId: string) => {
    setSuggestLoading(true);
    setSuggestion("");
    setSuggestDismissed(false);
    try {
      const res = await fetch("/api/yelp-leads/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.suggestion) setSuggestion(data.suggestion);
      }
    } catch { /* silent */ }
    setSuggestLoading(false);
  }, []);

  const openConversation = (conv: YelpConversation) => {
    prevMsgCountRef.current = 0;
    setSelected(conv);
    setShowInfo(false);
    setShowQuickReplies(false);
    setSuggestion("");
    setSuggestDismissed(false);
    // Restore draft
    setReplyText(conv.draft_text || "");
    onNavigate?.();
    // Mark as read
    fetch("/api/yelp-leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: conv.id, action: "mark_read" }),
    }).catch(() => {});
    // Auto-fetch suggestion
    const msgs = conv.messages || [];
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg?.role === "customer" && conv.status !== "completed") {
      fetchSuggestion(conv.id);
    }
  };

  // The list to display (search results or filtered conversations)
  const displayList = searchResults !== null ? searchResults : [...conversations].sort((a, b) => {
    // Pinned first
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    // Starred second
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    // Then by last message time
    return new Date(lastMessageTime(b)).getTime() - new Date(lastMessageTime(a)).getTime();
  });

  // ─── THREAD LIST VIEW ───
  const renderList = () => (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Search bar */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #1a3a1a", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, service, message..."
            style={{
              width: "100%", padding: "8px 12px 8px 32px", borderRadius: "20px",
              border: "1px solid #2a4a2a", background: "#0d1f0d", color: "#ddd",
              fontSize: "14px", outline: "none", boxSizing: "border-box",
            }}
          />
          <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#5a8a5a", fontSize: "14px" }}>⌕</span>
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSearchResults(null); }}
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#5a8a5a", cursor: "pointer", fontSize: "16px" }}>×</button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: "flex", gap: "6px", padding: "8px 12px", overflowX: "auto",
        borderBottom: "1px solid #1a3a1a", flexShrink: 0, alignItems: "center",
      }}>
        {[
          { key: "all", label: "All" },
          { key: "ai_active", label: "AI" },
          { key: "needs_attention", label: "Attention" },
          { key: "taken_over", label: "Manual" },
          { key: "completed", label: "Done" },
        ].map(f => (
          <button key={f.key} onClick={() => { setFilter(f.key); setSearchQuery(""); setSearchResults(null); }} style={{
            padding: "5px 12px", borderRadius: "16px", border: "none", fontSize: "12px",
            fontWeight: filter === f.key ? 700 : 500, whiteSpace: "nowrap",
            background: filter === f.key ? "#4CAF50" : "rgba(76,175,80,0.1)",
            color: filter === f.key ? "#fff" : "#8ab88a", cursor: "pointer",
          }}>{f.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        {/* Realtime indicator */}
        <span title={realtimeConnected ? "Live" : "Polling"} style={{
          width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
          background: realtimeConnected ? "#4CAF50" : "#888",
          boxShadow: realtimeConnected ? "0 0 4px #4CAF50" : "none",
        }} />
        {onShowDiagnostics && (
          <button onClick={onShowDiagnostics} style={{
            padding: "4px 10px", borderRadius: "6px", border: "1px solid #2a4a2a",
            background: "none", color: "#5a8a5a", fontSize: "11px", cursor: "pointer",
          }}>System</button>
        )}
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {loading && !searchQuery ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#5a8a5a" }}>Loading...</div>
        ) : searchLoading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#5a8a5a" }}>Searching...</div>
        ) : displayList.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#5a8a5a" }}>
            {searchQuery ? "No results found" : "No leads found"}
          </div>
        ) : displayList.map(conv => {
          const unread = hasUnread(conv);
          const badge = tempBadge(conv.lead_temperature);
          return (
            <button key={conv.id} onClick={() => openConversation(conv)} style={{
              display: "flex", alignItems: "center", gap: "12px", width: "100%",
              padding: "13px 16px", border: "none", borderBottom: "1px solid #1a3a1a",
              background: unread ? "rgba(255,152,0,0.06)" : "transparent",
              cursor: "pointer", textAlign: "left",
            }}>
              {/* Avatar */}
              <div style={{
                width: "42px", height: "42px", borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg, ${statusColor(conv.status)}33, ${statusColor(conv.status)}11)`,
                border: `2px solid ${statusColor(conv.status)}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", fontWeight: 700, color: statusColor(conv.status), position: "relative",
              }}>
                {getInitials(conv.customer_name)}
                {conv.pinned && <span style={{ position: "absolute", top: "-4px", right: "-4px", fontSize: "10px" }}>📌</span>}
                {conv.starred && !conv.pinned && <span style={{ position: "absolute", top: "-4px", right: "-4px", fontSize: "10px" }}>⭐</span>}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                  <span style={{
                    fontWeight: unread ? 700 : 600, fontSize: "14px",
                    color: unread ? "#fff" : "#ccc",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {conv.customer_name || "Unknown"}
                  </span>
                  <span style={{ fontSize: "11px", color: "#5a8a5a", flexShrink: 0, marginLeft: "8px" }}>
                    {timeAgo(lastMessageTime(conv))}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                  <span style={{ fontSize: "12px", color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {(conv.services || []).join(", ") || "—"}
                  </span>
                  {badge && (
                    <span style={{
                      fontSize: "10px", padding: "1px 6px", borderRadius: "8px", flexShrink: 0,
                      background: `${badge.color}22`, color: badge.color,
                      border: `1px solid ${badge.color}44`,
                    }}>{badge.label}</span>
                  )}
                </div>
                <div style={{
                  fontSize: "12px", color: unread ? "#999" : "#555",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {lastMessagePreview(conv.messages || [])}
                </div>
              </div>

              {/* Unread dot */}
              {unread && (
                <div style={{
                  width: "9px", height: "9px", borderRadius: "50%", flexShrink: 0,
                  background: "#FF9800", boxShadow: "0 0 5px #FF9800",
                }} />
              )}
              {!unread && (
                <div style={{
                  width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                  background: statusColor(conv.status),
                  boxShadow: conv.status === "ai_active" ? `0 0 5px ${statusColor(conv.status)}` : "none",
                  opacity: 0.6,
                }} />
              )}
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
          padding: "10px 14px", borderBottom: "1px solid #1a3a1a", flexShrink: 0,
          background: "rgba(5,14,5,0.95)", backdropFilter: "blur(10px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button onClick={() => setSelected(null)} style={{
              background: "none", border: "none", color: "#4CAF50", fontSize: "20px",
              cursor: "pointer", padding: "2px 6px",
            }}>&larr;</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "15px", color: "#fff", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                {selected.customer_name || "Unknown"}
                <span
                  onClick={syncThread}
                  title={syncing ? "Syncing..." : "Sync thread"}
                  style={{
                    width: "7px", height: "7px", borderRadius: "50%", display: "inline-block",
                    background: syncing ? "#4CAF50" : "#2a4a2a", cursor: "pointer",
                    transition: "all 0.3s",
                    animation: syncing ? "pulse 1s infinite" : "none",
                    flexShrink: 0,
                  }}
                />
                {selected.conversation_stage && selected.conversation_stage !== "new" && (
                  <span style={{
                    fontSize: "10px", padding: "1px 6px", borderRadius: "8px",
                    background: "rgba(76,175,80,0.15)", color: "#4CAF50",
                    border: "1px solid rgba(76,175,80,0.3)",
                  }}>{stageLabel(selected.conversation_stage)}</span>
                )}
              </div>
              <div style={{ fontSize: "11px", color: "#5a8a5a" }}>
                {(selected.services || []).join(", ")} {selected.zip_code ? `| ${selected.zip_code}` : ""}
                {selected.last_customer_message_at && (
                  <span style={{ marginLeft: "8px", color: "#3a5a3a" }}>
                    {formatSilentTime(selected.last_customer_message_at)}
                  </span>
                )}
              </div>
            </div>
            {/* Pin / Star buttons */}
            <button
              onClick={() => toggleStar("starred", !selected.starred)}
              title={selected.starred ? "Unstar" : "Star"}
              style={{ background: "none", border: "none", fontSize: "16px", cursor: "pointer", opacity: selected.starred ? 1 : 0.3 }}
            >⭐</button>
            <button
              onClick={() => toggleStar("pinned", !selected.pinned)}
              title={selected.pinned ? "Unpin" : "Pin"}
              style={{ background: "none", border: "none", fontSize: "16px", cursor: "pointer", opacity: selected.pinned ? 1 : 0.3 }}
            >📌</button>
            <button onClick={() => setShowInfo(!showInfo)} style={{
              background: showInfo ? "rgba(76,175,80,0.2)" : "none",
              border: "1px solid #2a4a2a", borderRadius: "6px",
              color: "#4CAF50", fontSize: "13px", padding: "5px 9px", cursor: "pointer",
            }}>Info</button>
          </div>

          {/* Status + actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "7px", flexWrap: "wrap" }}>
            <span style={{
              fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px",
              background: `${statusColor(selected.status)}22`, color: statusColor(selected.status),
              border: `1px solid ${statusColor(selected.status)}44`,
            }}>{statusLabel(selected.status)}</span>
            <span style={{ fontSize: "11px", color: "#5a8a5a" }}>{selected.ai_exchange_count} AI</span>
            {selected.lead_score != null && (
              <span style={{ fontSize: "11px", color: "#5a8a5a" }}>Score: {selected.lead_score}</span>
            )}
            {selected.lead_temperature && tempBadge(selected.lead_temperature) && (
              <span style={{
                fontSize: "10px", padding: "1px 6px", borderRadius: "8px",
                background: `${temperatureColor(selected.lead_temperature)}22`,
                color: temperatureColor(selected.lead_temperature),
                border: `1px solid ${temperatureColor(selected.lead_temperature)}44`,
              }}>{tempBadge(selected.lead_temperature)!.label}</span>
            )}
            <div style={{ flex: 1 }} />
            {selected.status === "ai_active" && (
              <button onClick={() => doAction("take_over")} disabled={!!actionLoading} style={{
                fontSize: "11px", padding: "3px 10px", borderRadius: "6px", border: "none",
                background: "#2196F3", color: "#fff", cursor: "pointer", fontWeight: 600,
                opacity: actionLoading ? 0.5 : 1,
              }}>Take Over</button>
            )}
            {selected.status === "taken_over" && (
              <button onClick={() => doAction("resume_ai")} disabled={!!actionLoading} style={{
                fontSize: "11px", padding: "3px 10px", borderRadius: "6px", border: "none",
                background: "#4CAF50", color: "#fff", cursor: "pointer", fontWeight: 600,
                opacity: actionLoading ? 0.5 : 1,
              }}>Resume AI</button>
            )}
            {selected.status === "completed" && (
              <button onClick={() => doAction("take_over")} disabled={!!actionLoading} style={{
                fontSize: "11px", padding: "3px 10px", borderRadius: "6px", border: "none",
                background: "#FF9800", color: "#fff", cursor: "pointer", fontWeight: 600,
                opacity: actionLoading ? 0.5 : 1,
              }}>Reopen</button>
            )}
            {selected.status !== "completed" && (
              <button onClick={() => doAction("complete")} disabled={!!actionLoading} style={{
                fontSize: "11px", padding: "3px 10px", borderRadius: "6px",
                border: "1px solid #333", background: "transparent",
                color: "#888", cursor: "pointer", fontWeight: 600,
                opacity: actionLoading ? 0.5 : 1,
              }}>Done</button>
            )}
          </div>
        </div>

        {/* Info panel */}
        {showInfo && (
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid #1a3a1a",
            background: "rgba(20,40,20,0.5)", fontSize: "13px", color: "#aaa",
          }}>
            {selected.urgency && <div style={{ marginBottom: "4px" }}><span style={{ color: "#5a8a5a" }}>Timeline:</span> {selected.urgency}</div>}
            {selected.zip_code && <div style={{ marginBottom: "4px" }}><span style={{ color: "#5a8a5a" }}>Location:</span> {selected.zip_code}</div>}
            {selected.yelp_masked_email && <div style={{ marginBottom: "4px" }}><span style={{ color: "#5a8a5a" }}>Email path:</span> <span style={{ fontSize: "11px", color: "#4CAF50" }}>✓ Email fast path available</span></div>}
            {(selected.project_details || []).length > 0 && (
              <div>
                <div style={{ color: "#5a8a5a", marginBottom: "3px" }}>Project Details:</div>
                {(selected.project_details || []).map((d, i) => (
                  <div key={i} style={{ marginLeft: "8px", marginBottom: "2px", fontSize: "12px" }}>
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
          flex: 1, overflowY: "auto", padding: "14px 10px",
          WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", gap: "6px",
        }}>
          {msgs.length === 0 ? (
            <div style={{ textAlign: "center", color: "#5a8a5a", padding: "40px 0" }}>No messages yet</div>
          ) : msgs.map((msg, i) => {
            const isCustomer = msg.role === "customer";
            const isAI = msg.role === "ai";
            const isAdmin = msg.role === "admin";
            const isSystem = msg.role === "system";
            const isOutgoing = isAI || isAdmin;

            if (isSystem) {
              return (
                <div key={i} style={{
                  alignSelf: "center", maxWidth: "92%", textAlign: "center",
                  padding: "8px 14px", borderRadius: "12px",
                  background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.15)",
                  fontSize: "12px", lineHeight: "1.5", color: "#8aba8a", whiteSpace: "pre-wrap",
                }}>
                  {msg.text}
                </div>
              );
            }

            return (
              <div key={i} style={{
                display: "flex", flexDirection: "column",
                alignItems: isOutgoing ? "flex-end" : "flex-start",
                maxWidth: "85%", alignSelf: isOutgoing ? "flex-end" : "flex-start",
                animation: "msgSlide 0.15s ease",
              }}>
                <div style={{
                  fontSize: "10px", color: "#5a8a5a", marginBottom: "2px",
                  paddingLeft: isCustomer ? "10px" : "0",
                  paddingRight: isOutgoing ? "10px" : "0",
                }}>
                  {isCustomer ? (selected.customer_name?.split(" ")[0] || "Customer") : isAI ? "AI Bot" : "You"}
                </div>
                <div style={{
                  padding: "9px 13px",
                  borderRadius: isOutgoing ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: isCustomer ? "#1a2e1a" : isAI ? "#1a3a2a" : "#1a2a4a",
                  border: `1px solid ${isCustomer ? "#2a4a2a" : isAI ? "#2a5a3a" : "#2a3a6a"}`,
                  color: "#ddd", fontSize: "14px", lineHeight: "1.45",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {msg.text}
                </div>
                <div style={{
                  fontSize: "10px", color: "#444", marginTop: "2px",
                  paddingLeft: isCustomer ? "10px" : "0",
                  paddingRight: isOutgoing ? "10px" : "0",
                }}>
                  {shortTime(msg.ts)}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Delivery Status Bar */}
        {selected.delivery_status && selected.delivery_status !== "none" && selected.delivery_status !== "sent" && (
          <div style={{
            padding: "6px 14px", flexShrink: 0, display: "flex", alignItems: "center", gap: "8px",
            background: selected.delivery_status === "failed"
              ? "rgba(239,68,68,0.08)" : "rgba(76,175,80,0.06)",
            borderTop: `1px solid ${selected.delivery_status === "failed" ? "#ef444430" : "#2a4a2a"}`,
          }}>
            {selected.delivery_status === "failed" ? (
              <>
                <span style={{ fontSize: "12px", color: "#ef4444" }}>⚠ Last message failed to deliver</span>
              </>
            ) : selected.delivery_status === "queued_quiet_hours" ? (
              <span style={{ fontSize: "12px", color: "#888" }}>🌙 Queued — will send at 7 AM ET</span>
            ) : (
              <span style={{ fontSize: "12px", color: "#5a8a5a" }}>
                <span style={{ display: "inline-block", animation: "pulse 1s infinite" }}>●</span>
                {" "}Sending...
              </span>
            )}
          </div>
        )}
        {selected.delivery_status === "sent" && selected.updated_at &&
          Date.now() - new Date(selected.updated_at).getTime() < 60000 && (
          <div style={{
            padding: "4px 14px", flexShrink: 0,
            background: "rgba(76,175,80,0.06)", borderTop: "1px solid #2a4a2a",
          }}>
            <span style={{ fontSize: "11px", color: "#4CAF50" }}>✓ Delivered</span>
          </div>
        )}

        {/* AI Suggestion */}
        {selected.status !== "completed" && !suggestDismissed && (suggestion || suggestLoading) && (
          <div style={{
            padding: "10px 12px", borderTop: "1px solid #1a3a1a",
            background: "rgba(25,45,60,0.4)", flexShrink: 0,
          }}>
            {suggestLoading ? (
              <div style={{ fontSize: "13px", color: "#6ba3c7", textAlign: "center", padding: "6px 0" }}>
                AI is composing...
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <span style={{ fontSize: "11px", color: "#6ba3c7", fontWeight: 600 }}>AI Suggested Reply</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => fetchSuggestion(selected.id)} style={{
                      fontSize: "11px", padding: "2px 7px", borderRadius: "4px",
                      border: "1px solid #2a4a5a", background: "transparent", color: "#6ba3c7", cursor: "pointer",
                    }}>Retry</button>
                    <button onClick={() => setSuggestDismissed(true)} style={{
                      fontSize: "11px", padding: "2px 7px", borderRadius: "4px",
                      border: "1px solid #333", background: "transparent", color: "#666", cursor: "pointer",
                    }}>Dismiss</button>
                  </div>
                </div>
                <button
                  onClick={() => { setReplyText(suggestion); setSuggestDismissed(true); textareaRef.current?.focus(); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "9px 12px", borderRadius: "12px",
                    background: "rgba(30,60,80,0.4)",
                    border: "1px solid rgba(70,130,180,0.3)",
                    color: "#b0d4e8", fontSize: "14px", lineHeight: "1.45",
                    cursor: "pointer", whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}
                >
                  {suggestion}
                </button>
                <div style={{ fontSize: "10px", color: "#4a7a9a", marginTop: "3px", textAlign: "center" }}>
                  Tap to use — you can edit before sending
                </div>
              </>
            )}
          </div>
        )}

        {/* Quick reply templates overlay */}
        {showQuickReplies && quickReplies.length > 0 && (
          <div style={{
            position: "absolute", bottom: "120px", left: "8px", right: "8px",
            background: "#0d1f0d", border: "1px solid #2a4a2a", borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)", zIndex: 100, overflow: "hidden",
          }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #1a3a1a", fontSize: "11px", color: "#5a8a5a", fontWeight: 600 }}>
              Quick Replies
            </div>
            {quickReplies.map(qr => (
              <button key={qr.id} onClick={() => {
                setReplyText(qr.body);
                setShowQuickReplies(false);
                textareaRef.current?.focus();
              }} style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 14px", border: "none", borderBottom: "1px solid #1a3a1a",
                background: "transparent", color: "#ddd", cursor: "pointer",
                fontSize: "13px",
              }}>
                <div style={{ fontWeight: 600, color: "#4CAF50", marginBottom: "2px", fontSize: "12px" }}>{qr.label}</div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#aaa" }}>{qr.body}</div>
              </button>
            ))}
            <button onClick={() => setShowQuickReplies(false)} style={{
              display: "block", width: "100%", padding: "8px", border: "none",
              background: "transparent", color: "#5a8a5a", cursor: "pointer", fontSize: "12px",
            }}>Cancel</button>
          </div>
        )}

        {/* Reply input */}
        {selected.status !== "completed" && (
          <div style={{
            padding: "8px 10px", borderTop: "1px solid #1a3a1a",
            background: "rgba(5,14,5,0.95)", flexShrink: 0, position: "relative",
            paddingBottom: "max(8px, env(safe-area-inset-bottom))",
          }}>
            {draftSaving && <div style={{ fontSize: "10px", color: "#3a5a3a", textAlign: "right", marginBottom: "2px" }}>Saving draft...</div>}
            <div style={{ display: "flex", gap: "7px", alignItems: "flex-end" }}>
              {/* Quick replies button */}
              <button
                onClick={() => setShowQuickReplies(!showQuickReplies)}
                disabled={sending}
                title="Quick replies"
                style={{
                  width: "38px", height: "38px", borderRadius: "50%", border: "1px solid #2a4a2a",
                  background: showQuickReplies ? "rgba(76,175,80,0.2)" : "#0d1f0d",
                  color: showQuickReplies ? "#4CAF50" : "#5a8a5a",
                  fontSize: "16px", cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >⚡</button>
              <textarea
                ref={textareaRef}
                value={replyText}
                onChange={e => {
                  setReplyText(e.target.value);
                  if (selected) saveDraft(selected.id, e.target.value);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
                }}
                placeholder="Type a reply..."
                rows={1}
                style={{
                  flex: 1, resize: "none", padding: "10px 13px", borderRadius: "20px",
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
                onClick={proofreadReply}
                disabled={!replyText.trim() || proofreading || sending}
                title="AI Proofread"
                style={{
                  width: "38px", height: "38px", borderRadius: "50%", border: "none",
                  background: replyText.trim() && !proofreading ? "#1a3a5a" : "#1a2a1a",
                  color: replyText.trim() && !proofreading ? "#6ba3c7" : "#3a5a3a",
                  fontSize: "15px", cursor: replyText.trim() ? "pointer" : "default",
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s",
                }}
              >{proofreading ? "..." : "Aa"}</button>
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || sending}
                style={{
                  width: "38px", height: "38px", borderRadius: "50%", border: "none",
                  background: replyText.trim() ? "#4CAF50" : "#1a3a1a",
                  color: replyText.trim() ? "#fff" : "#5a8a5a",
                  fontSize: "17px", cursor: replyText.trim() ? "pointer" : "default",
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s",
                }}
              >{sending ? "..." : "↑"}</button>
            </div>
            {selected.status === "ai_active" && (
              <div style={{ fontSize: "11px", color: "#FF9800", textAlign: "center", marginTop: "5px", opacity: 0.8 }}>
                AI is handling this. Sending a reply will take over.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ height: "calc(100vh - 140px)", display: "flex", flexDirection: "column", position: "relative" }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.5); } }
        @keyframes toastSlide { from { transform: translateY(-20px) translateX(-50%); opacity: 0; } to { transform: translateY(0) translateX(-50%); opacity: 1; } }
        @keyframes msgSlide { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {toast && (
        <div onClick={() => setToast(null)} style={{
          position: "fixed", top: 16, left: "50%", zIndex: 10000,
          padding: "10px 20px", borderRadius: "12px", cursor: "pointer",
          background: toast.type === "success" ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "linear-gradient(135deg, #c62828, #8b0000)",
          color: "#fff", fontSize: "13px", fontWeight: 600,
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          animation: "toastSlide 0.3s ease",
          maxWidth: "min(400px, 90vw)", textAlign: "center",
        }}>
          {toast.type === "success" ? "✓ " : "⚠ "}{toast.message}
        </div>
      )}
      {selected ? renderChat() : renderList()}
    </div>
  );
}
