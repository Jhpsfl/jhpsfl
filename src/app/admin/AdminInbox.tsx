"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ───
interface EmailThread {
  thread_id: string;
  subject: string;
  to_email: string;
  from_email: string;
  latest_message: string;
  latest_body_preview: string;
  latest_direction: string;
  message_count: number;
  unread_count: number;
  lead_id: string | null;
  created_at: string;
  customer_name?: string;
}

interface EmailMessage {
  id: string;
  thread_id: string;
  lead_id: string | null;
  direction: "outbound" | "inbound";
  from_email: string;
  to_email: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  resend_message_id: string | null;
  read: boolean;
  created_at: string;
}

interface LeadInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string | null;
  state: string | null;
}

interface SmsThread {
  thread_id: string;
  to_phone: string;
  from_phone: string;
  latest_body: string;
  latest_direction: string;
  message_count: number;
  unread_count: number;
  lead_id: string | null;
  created_at: string;
  customer_name?: string;
}

type InboxTab = "email" | "sms";

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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function getInitials(name: string | undefined, email: string): string {
  if (name) return name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
  return email.split("@")[0].substring(0, 2).toUpperCase();
}

function formatPhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p;
}

/** Strip HTML to clean readable text — removes style/script blocks, converts structure to newlines */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── SVG Icons ───
const IconBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

const IconRefresh = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconCompose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const IconArchive = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
  </svg>
);

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconReply = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
);

const IconMore = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
  </svg>
);

// ─── Main Component ───
export default function AdminInbox({ userId, backRef, onNavigate }: { userId: string; backRef?: React.MutableRefObject<(() => boolean) | null>; onNavigate?: () => void }) {
  const [inboxTab, setInboxTab] = useState<InboxTab>("email");
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [smsThreads, setSmsThreads] = useState<SmsThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [collapsedMsgs, setCollapsedMsgs] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Close thread helper ───
  const closeThread = useCallback(() => {
    setSelectedThread(null);
    setMessages([]);
    setLeadInfo(null);
    setReplyText("");
    setCollapsedMsgs(new Set());
  }, []);

  // ─── Back button: updated synchronously every render (no useEffect timing gap) ───
  if (backRef) {
    backRef.current = () => {
      if (composeOpen) { setComposeOpen(false); return true; }
      if (selectedThread) { closeThread(); return true; }
      return false;
    };
  }

  // ─── Data fetching ───
  const fetchThreads = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    const res = await fetch(`/api/email/threads?clerk_user_id=${userId}`);
    if (res.ok) { setThreads((await res.json()).threads || []); }
    setLoading(false); setRefreshing(false);
  }, [userId]);

  const fetchSmsThreads = useCallback(async () => {
    const res = await fetch(`/api/sms/threads?clerk_user_id=${userId}`);
    if (res.ok) { setSmsThreads((await res.json()).threads || []); }
  }, [userId]);

  const fetchMessages = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/email/threads/${threadId}?clerk_user_id=${userId}`);
    if (res.ok) {
      const data = await res.json();
      const msgs: EmailMessage[] = data.messages || [];
      setMessages(msgs);
      setLeadInfo(data.lead || null);
      setSelectedThread(threadId);
      onNavigate?.(); // push sentinel during user gesture — non-skippable
      setReplyText("");
      // Gmail behavior: collapse all but last message
      if (msgs.length > 1) {
        setCollapsedMsgs(new Set(msgs.slice(0, -1).map(m => m.id)));
      } else {
        setCollapsedMsgs(new Set());
      }
      setThreads(prev => prev.map(t => t.thread_id === threadId ? { ...t, unread_count: 0 } : t));
    }
  }, [userId]);

  // ─── Actions ───
  const sendReply = async () => {
    if (!replyText.trim() || !selectedThread) return;
    const thread = threads.find(t => t.thread_id === selectedThread);
    if (!thread) return;
    setSending(true);
    const res = await fetch("/api/email/reply", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerk_user_id: userId, thread_id: selectedThread,
        to_email: thread.to_email, to_name: thread.customer_name || leadInfo?.name,
        subject: thread.subject, reply_body: replyText, lead_id: thread.lead_id,
      }),
    });
    if (res.ok) { showToast("Reply sent!"); setReplyText(""); fetchMessages(selectedThread); fetchThreads(true); }
    else { showToast("Failed to send reply", "error"); }
    setSending(false);
  };

  const sendCompose = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    const res = await fetch("/api/email/compose", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerk_user_id: userId, to_email: composeTo.trim(), subject: composeSubject.trim(), body: composeBody.trim() }),
    });
    if (res.ok) { showToast("Email sent!"); setComposeOpen(false); setComposeTo(""); setComposeSubject(""); setComposeBody(""); fetchThreads(true); }
    else { showToast("Failed to send email", "error"); }
    setComposeSending(false);
  };

  const deleteSelected = async () => {
    if (!selectedIds.size) return;
    setDeleting(true);
    const res = await fetch(`/api/email/threads?clerk_user_id=${userId}`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_ids: [...selectedIds] }),
    });
    if (res.ok) {
      showToast(`Deleted ${selectedIds.size} thread${selectedIds.size > 1 ? "s" : ""}`);
      if (selectedThread && selectedIds.has(selectedThread)) closeThread();
      setSelectedIds(new Set()); fetchThreads(true);
    } else { showToast("Delete failed", "error"); }
    setDeleting(false);
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredThreads.length && filteredThreads.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredThreads.map(t => t.thread_id)));
  };
  const toggleCollapse = (msgId: string) => {
    setCollapsedMsgs(prev => { const next = new Set(prev); next.has(msgId) ? next.delete(msgId) : next.add(msgId); return next; });
  };

  useEffect(() => { fetchThreads(); fetchSmsThreads(); }, [fetchThreads, fetchSmsThreads]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const filteredThreads = threads.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (t.customer_name || "").toLowerCase().includes(q) || t.to_email.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.latest_body_preview.toLowerCase().includes(q);
  });

  const totalUnreadEmail = threads.reduce((sum, t) => sum + t.unread_count, 0);
  const totalUnreadSms = smsThreads.reduce((sum, t) => sum + t.unread_count, 0);
  const selectedThreadData = threads.find(t => t.thread_id === selectedThread);
  const allSelected = filteredThreads.length > 0 && selectedIds.size === filteredThreads.length;
  const someSelected = selectedIds.size > 0;

  // ═══════════════════════
  // ─── RENDER ───
  // ═══════════════════════
  return (
    <div className="gmail-inbox-root">
      {/* ─── Scoped Styles ─── */}
      <style>{`
        .gmail-inbox-root {
          animation: gmailFadeIn 0.2s ease;
          margin: -16px;
          min-height: 100vh;
          background: #050e05;
          font-family: 'DM Sans', sans-serif;
        }
        @keyframes gmailFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gmailSpin { to { transform: rotate(360deg); } }

        /* Override parent admin-content-inner global styles */
        .gmail-inbox-root input,
        .gmail-inbox-root select,
        .gmail-inbox-root textarea {
          font-size: 14px !important;
          min-height: unset !important;
          padding: 0 !important;
        }
        .gmail-inbox-root button {
          min-height: unset !important;
          padding: 0 !important;
          font-family: 'DM Sans', sans-serif;
        }
        .gmail-inbox-root h1, .gmail-inbox-root h2, .gmail-inbox-root h3 { font-size: unset !important; }
        .gmail-inbox-root p, .gmail-inbox-root td { font-size: unset !important; }

        /* Thread rows */
        .gmail-thread-row { transition: background 0.1s; }
        .gmail-thread-row:active { background: rgba(76,175,80,0.1) !important; }

        /* Thread detail — fullscreen on mobile */
        @media (max-width: 900px) {
          .gmail-detail-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            z-index: 300 !important;
            background: #050e05 !important;
          }
        }

        /* Message cards */
        .gmail-msg-card { border-bottom: 1px solid #0d1a0d; }
        .gmail-msg-card:last-of-type { border-bottom: none; }
        .gmail-msg-collapsed { cursor: pointer; }
        .gmail-msg-collapsed:active { background: rgba(76,175,80,0.06); }

        /* Compose FAB — mobile only */
        .gmail-fab {
          position: fixed; bottom: 80px; right: 20px; z-index: 80;
          display: none; align-items: center; gap: 10px;
          padding: 14px 22px !important; border-radius: 16px; border: none;
          background: linear-gradient(135deg, #1a3a1a, #0d2a0d);
          color: #4CAF50; font-size: 14px; font-weight: 700;
          cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px #1a3a1a;
        }
        .gmail-fab:active { transform: scale(0.96); }
        @media (max-width: 900px) { .gmail-fab { display: flex; } }
      `}</style>

      {/* ─── Toast ─── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 10000, padding: "12px 20px",
          borderRadius: 8, background: toast.type === "success" ? "#2E7D32" : "#c62828",
          color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>{toast.type === "success" ? "✓" : "⚠"} {toast.message}</div>
      )}

      {/* ─── Compose Modal ─── */}
      {composeOpen && (
        <div onClick={() => setComposeOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 12, width: 520, maxWidth: "calc(100vw - 32px)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(76,175,80,0.06)", borderBottom: "1px solid #1a3a1a" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#e8f5e8" }}>New Message</span>
              <button onClick={() => setComposeOpen(false)} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "4px !important" }}>×</button>
            </div>
            <div style={{ padding: "10px 16px" }}>
              <input type="email" placeholder="To" value={composeTo} onChange={e => setComposeTo(e.target.value)}
                style={{ width: "100%", padding: "8px 0 !important", background: "transparent", border: "none", borderBottom: "1px solid #1a3a1a", color: "#e8f5e8", outline: "none" }} />
            </div>
            <div style={{ padding: "10px 16px" }}>
              <input type="text" placeholder="Subject" value={composeSubject} onChange={e => setComposeSubject(e.target.value)}
                style={{ width: "100%", padding: "8px 0 !important", background: "transparent", border: "none", borderBottom: "1px solid #1a3a1a", color: "#e8f5e8", outline: "none" }} />
            </div>
            <textarea placeholder="Write your message..." value={composeBody} onChange={e => setComposeBody(e.target.value)} rows={8}
              style={{ width: "100%", padding: "14px 16px !important", background: "transparent", border: "none", color: "#e8f5e8", outline: "none", resize: "none" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid #1a3a1a" }}>
              <span style={{ fontSize: 11, color: "#3a5a3a" }}>Sends as info@jhpsfl.com</span>
              <button onClick={sendCompose} disabled={composeSending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px !important", borderRadius: 8, border: "none", background: (composeTo && composeSubject && composeBody) ? "#2E7D32" : "rgba(76,175,80,0.1)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: composeSending ? 0.6 : 1 }}>
                <IconSend />{composeSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* ─── THREAD LIST VIEW ─── */}
      {/* ═══════════════════════════════════════════════ */}
      {!selectedThread && inboxTab === "email" && (
        <div>
          {/* Tab toggle */}
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px 0" }}>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 3, background: "#0a160a", borderRadius: 8, padding: 3, border: "1px solid #1a3a1a" }}>
              {(["email", "sms"] as InboxTab[]).map(tab => (
                <button key={tab} onClick={() => { setInboxTab(tab); setSelectedIds(new Set()); }}
                  style={{ padding: "6px 14px !important", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: inboxTab === tab ? "#2E7D32" : "transparent", color: inboxTab === tab ? "#fff" : "#5a8a5a", display: "flex", alignItems: "center", gap: 5 }}>
                  {tab === "email" ? "✉ Email" : "💬 SMS"}
                  {tab === "email" && totalUnreadEmail > 0 && <span style={{ background: "rgba(255,255,255,0.2)", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{totalUnreadEmail}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar — Gmail pill */}
          <div style={{ padding: "8px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 24, padding: "8px 16px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a8a5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Search in mail" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, background: "transparent", border: "none", color: "#e8f5e8", outline: "none", padding: "4px 0 !important" }} />
            </div>
          </div>

          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", borderBottom: "1px solid #0d1a0d" }}>
            <button onClick={toggleSelectAll} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: someSelected ? "#4CAF50" : "#3a5a3a" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {allSelected ? <><rect x="3" y="3" width="18" height="18" rx="3" fill="rgba(76,175,80,0.2)" stroke="#4CAF50" /><polyline points="9 12 11.5 14.5 15 9" /></> : someSelected ? <><rect x="3" y="3" width="18" height="18" rx="3" /><line x1="7" y1="12" x2="17" y2="12" /></> : <rect x="3" y="3" width="18" height="18" rx="3" />}
              </svg>
            </button>
            <button onClick={() => fetchThreads(true)} disabled={refreshing} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}>
              <span style={{ display: "inline-block", animation: refreshing ? "gmailSpin 1s linear infinite" : "none" }}><IconRefresh /></span>
            </button>
            {someSelected && (
              <button onClick={deleteSelected} disabled={deleting} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#7a4a4a" }}>
                <IconTrash />
              </button>
            )}
            <div style={{ flex: 1 }} />
            {someSelected && <span style={{ fontSize: 11, color: "#5a8a5a" }}>{selectedIds.size} selected</span>}
            <button onClick={() => { onNavigate?.(); setComposeOpen(true); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}>
              <IconCompose />
            </button>
          </div>

          {/* Thread rows */}
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#3a5a3a", fontSize: 13 }}>Loading...</div>
          ) : filteredThreads.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ color: "#3a5a3a", fontSize: 13 }}>{searchQuery ? "No matching threads" : "No emails yet"}</div>
            </div>
          ) : (
            filteredThreads.map(thread => {
              const isSelected = selectedIds.has(thread.thread_id);
              const isUnread = thread.unread_count > 0;
              const senderName = thread.customer_name || thread.to_email.split("@")[0];
              return (
                <div key={thread.thread_id} className="gmail-thread-row"
                  onClick={() => { if (!someSelected) fetchMessages(thread.thread_id); else { setSelectedIds(prev => { const n = new Set(prev); n.has(thread.thread_id) ? n.delete(thread.thread_id) : n.add(thread.thread_id); return n; }); } }}
                  style={{ display: "flex", alignItems: "center", gap: 0, padding: "12px 8px 12px 4px", borderBottom: "1px solid #0a160a", background: isSelected ? "rgba(76,175,80,0.06)" : "transparent", cursor: "pointer" }}>
                  {/* Checkbox */}
                  <div onClick={e => toggleSelect(thread.thread_id, e)} style={{ width: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#4CAF50" : "#2a4a2a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {isSelected ? <><rect x="3" y="3" width="18" height="18" rx="3" fill="rgba(76,175,80,0.2)" stroke="#4CAF50" /><polyline points="9 12 11.5 14.5 15 9" /></> : <rect x="3" y="3" width="18" height="18" rx="3" />}
                    </svg>
                  </div>
                  {/* Avatar */}
                  <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, marginRight: 12, background: isUnread ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "#1a2a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: isUnread ? "#fff" : "#5a8a5a" }}>
                    {getInitials(thread.customer_name, thread.to_email)}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: isUnread ? 700 : 400, color: isUnread ? "#e8f5e8" : "#a0b8a0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{senderName}</div>
                      <div style={{ fontSize: 11, color: isUnread ? "#4CAF50" : "#3a5a3a", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {timeAgo(thread.latest_message)}
                        {isUnread && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#4CAF50", marginLeft: 6, verticalAlign: "middle" }} />}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: isUnread ? 600 : 400, color: isUnread ? "#c8e0c8" : "#6a8a6a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{thread.subject}</div>
                    <div style={{ fontSize: 12, color: "#4a6a4a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                      {thread.latest_direction === "outbound" ? "You: " : ""}{thread.latest_body_preview}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Mobile FAB */}
          <button className="gmail-fab" onClick={() => { onNavigate?.(); setComposeOpen(true); }}><IconCompose /> Compose</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* ─── THREAD DETAIL VIEW ─── */}
      {/* ═══════════════════════════════════════════════ */}
      {selectedThread && inboxTab === "email" && (
        <div className="gmail-detail-overlay" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#050e05" }}>
          {/* Top toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "6px 4px", borderBottom: "1px solid #0d1a0d", background: "rgba(5,14,5,0.98)", flexShrink: 0 }}>
            <button onClick={closeThread} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#8ab88a" }}><IconBack /></button>
            <div style={{ flex: 1 }} />
            <button onClick={() => { if (selectedThread) { const ids = new Set([selectedThread]); setSelectedIds(ids); deleteSelected(); } }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}><IconArchive /></button>
            <button onClick={() => { if (selectedThread) { const ids = new Set([selectedThread]); setSelectedIds(ids); deleteSelected(); } }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}><IconTrash /></button>
          </div>

          {/* Subject */}
          <div style={{ padding: "14px 16px 6px", flexShrink: 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: 400, color: "#e8f5e8", lineHeight: 1.3, margin: 0 }}>
              {selectedThreadData?.subject || "Thread"}
            </h2>
            <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 4 }}>{messages.length} message{messages.length !== 1 ? "s" : ""}</div>
          </div>

          {/* Messages — scrollable */}
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {messages.map(msg => {
              const isOutbound = msg.direction === "outbound";
              const senderName = isOutbound ? "JHPS" : (selectedThreadData?.customer_name || msg.from_email.split("@")[0]);
              const senderEmail = isOutbound ? "info@jhpsfl.com" : msg.from_email;
              const initials = isOutbound ? "JP" : getInitials(selectedThreadData?.customer_name, msg.from_email);
              const isCollapsed = collapsedMsgs.has(msg.id);
              const bodyText = msg.body_text || (msg.body_html ? htmlToText(msg.body_html) : "—");

              // ── Collapsed row ──
              if (isCollapsed) {
                return (
                  <div key={msg.id} className="gmail-msg-card gmail-msg-collapsed" onClick={() => toggleCollapse(msg.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: isOutbound ? "#1a3a2a" : "#1a2a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isOutbound ? "#4CAF50" : "#6a8a6a" }}>{initials}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#a0b8a0", flexShrink: 0 }}>{senderName}</div>
                    <div style={{ flex: 1, fontSize: 12, color: "#4a6a4a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bodyText.substring(0, 80)}</div>
                    <div style={{ fontSize: 11, color: "#3a5a3a", flexShrink: 0 }}>{shortTime(msg.created_at)}</div>
                  </div>
                );
              }

              // ── Expanded card ──
              return (
                <div key={msg.id} className="gmail-msg-card" style={{ padding: "16px 16px 20px" }}>
                  {/* Sender header row */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: isOutbound ? "linear-gradient(135deg, #2E7D32, #1a4a1a)" : "#1a2a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: isOutbound ? "#4CAF50" : "#6a8a6a" }}>{initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#e8f5e8" }}>{senderName}</span>
                        <span style={{ fontSize: 12, color: "#4a6a4a" }}>&lt;{senderEmail}&gt;</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#4a6a4a", marginTop: 2 }}>to {isOutbound ? (selectedThreadData?.customer_name || selectedThreadData?.to_email || "recipient") : "me"}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: "#3a5a3a" }}>{formatDate(msg.created_at)}</span>
                      <div style={{ display: "flex", gap: 2 }}>
                        <button style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}><IconReply /></button>
                        <button style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}><IconMore /></button>
                      </div>
                    </div>
                  </div>
                  {isOutbound && msg.resend_message_id && <div style={{ fontSize: 11, color: "#2E7D32", marginBottom: 8, marginLeft: 52 }}>✓ Delivered</div>}
                  {/* Body */}
                  <div style={{ marginLeft: 52, fontSize: 14, lineHeight: 1.6, color: "#c8dcc8", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {bodyText}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply bar */}
          <div style={{ flexShrink: 0, padding: "10px 16px 16px", borderTop: "1px solid #0d1a0d", background: "rgba(5,14,5,0.98)" }}>
            <div style={{ border: "1px solid #1a3a1a", borderRadius: 10, overflow: "hidden", background: "#0a160a" }}>
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type your reply..." rows={2}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendReply(); } }}
                style={{ width: "100%", padding: "10px 14px !important", background: "transparent", border: "none", color: "#e8f5e8", outline: "none", resize: "none" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderTop: "1px solid #0d1a0d" }}>
                <span style={{ fontSize: 10, color: "#3a5a3a" }}>Ctrl+Enter to send</span>
                <button onClick={sendReply} disabled={sending || !replyText.trim()}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 18px !important", borderRadius: 20, border: "none", background: replyText.trim() ? "#2E7D32" : "rgba(76,175,80,0.1)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: replyText.trim() ? "pointer" : "default", opacity: sending ? 0.6 : 1 }}>
                  <IconSend />{sending ? "..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SMS TAB ═══ */}
      {inboxTab === "sms" && !selectedThread && (
        <div>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px 0" }}>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 3, background: "#0a160a", borderRadius: 8, padding: 3, border: "1px solid #1a3a1a" }}>
              {(["email", "sms"] as InboxTab[]).map(tab => (
                <button key={tab} onClick={() => { setInboxTab(tab); setSelectedIds(new Set()); }}
                  style={{ padding: "6px 14px !important", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: inboxTab === tab ? "#2E7D32" : "transparent", color: inboxTab === tab ? "#fff" : "#5a8a5a", display: "flex", alignItems: "center", gap: 5 }}>
                  {tab === "email" ? "✉ Email" : "💬 SMS"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <h3 style={{ fontSize: 18, color: "#e8f5e8", fontWeight: 600, marginBottom: 8, margin: "0 0 8px" }}>SMS Coming Soon</h3>
            <p style={{ color: "#5a8a5a", fontSize: 13, maxWidth: 360, margin: "0 auto" }}>Text message conversations with customers will appear here once connected.</p>
          </div>
        </div>
      )}
    </div>
  );
}
