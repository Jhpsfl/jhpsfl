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

// ─── SVG Icons ───
const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconCompose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const IconMarkRead = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.87a16 16 0 0 0 6.22 6.22l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    <polyline points="16 2 18 4 22 0" />
  </svg>
);

const IconSend = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

// ─── Toolbar Icon Button ───
function IconBtn({
  onClick, title, disabled = false, active = false, danger = false, children,
}: {
  onClick: () => void; title: string; disabled?: boolean; active?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 34, height: 34, borderRadius: 8, border: "none",
        background: active ? "rgba(76,175,80,0.15)" : "transparent",
        color: disabled ? "#2a3a2a" : danger ? (active ? "#ef5350" : "#7a4a4a") : "#5a8a5a",
        cursor: disabled ? "default" : "pointer",
        transition: "all 0.15s",
      }}
      onMouseOver={e => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background =
          danger ? "rgba(239,83,80,0.12)" : "rgba(76,175,80,0.1)";
      }}
      onMouseOut={e => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background =
          active ? "rgba(76,175,80,0.15)" : "transparent";
      }}
    >
      {children}
    </button>
  );
}

// ─── Main Component ───
export default function AdminInbox({ userId }: { userId: string }) {
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

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Fetch email threads ───
  const fetchThreads = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    const res = await fetch(`/api/email/threads?clerk_user_id=${userId}`);
    if (res.ok) {
      const data = await res.json();
      setThreads(data.threads || []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  // ─── Fetch SMS threads ───
  const fetchSmsThreads = useCallback(async () => {
    const res = await fetch(`/api/sms/threads?clerk_user_id=${userId}`);
    if (res.ok) {
      const data = await res.json();
      setSmsThreads(data.threads || []);
    }
  }, [userId]);

  // ─── Fetch thread messages ───
  const fetchMessages = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/email/threads/${threadId}?clerk_user_id=${userId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages || []);
      setLeadInfo(data.lead || null);
      setSelectedThread(threadId);
      setReplyText("");
      setThreads(prev => prev.map(t => t.thread_id === threadId ? { ...t, unread_count: 0 } : t));
    }
  }, [userId]);

  // ─── Send reply ───
  const sendReply = async () => {
    if (!replyText.trim() || !selectedThread) return;
    const thread = threads.find(t => t.thread_id === selectedThread);
    if (!thread) return;
    setSending(true);
    const res = await fetch("/api/email/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerk_user_id: userId,
        thread_id: selectedThread,
        to_email: thread.to_email,
        to_name: thread.customer_name || leadInfo?.name,
        subject: thread.subject,
        reply_body: replyText,
        lead_id: thread.lead_id,
      }),
    });
    if (res.ok) {
      showToast("Reply sent!");
      setReplyText("");
      fetchMessages(selectedThread);
      fetchThreads(true);
    } else {
      showToast("Failed to send reply", "error");
    }
    setSending(false);
  };

  // ─── Send compose ───
  const sendCompose = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    const res = await fetch("/api/email/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerk_user_id: userId,
        to_email: composeTo.trim(),
        subject: composeSubject.trim(),
        body: composeBody.trim(),
      }),
    });
    if (res.ok) {
      showToast("Email sent!");
      setComposeOpen(false);
      setComposeTo(""); setComposeSubject(""); setComposeBody("");
      fetchThreads(true);
    } else {
      showToast("Failed to send email", "error");
    }
    setComposeSending(false);
  };

  // ─── Delete selected ───
  const deleteSelected = async () => {
    if (!selectedIds.size) return;
    setDeleting(true);
    const res = await fetch(`/api/email/threads?clerk_user_id=${userId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_ids: [...selectedIds] }),
    });
    if (res.ok) {
      showToast(`Deleted ${selectedIds.size} thread${selectedIds.size > 1 ? "s" : ""}`);
      if (selectedThread && selectedIds.has(selectedThread)) setSelectedThread(null);
      setSelectedIds(new Set());
      fetchThreads(true);
    } else {
      showToast("Delete failed", "error");
    }
    setDeleting(false);
  };

  // ─── Select helpers ───
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredThreads.length && filteredThreads.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredThreads.map(t => t.thread_id)));
    }
  };

  useEffect(() => { fetchThreads(); fetchSmsThreads(); }, [fetchThreads, fetchSmsThreads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredThreads = threads.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.customer_name || "").toLowerCase().includes(q) ||
      t.to_email.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.latest_body_preview.toLowerCase().includes(q)
    );
  });

  const totalUnreadEmail = threads.reduce((sum, t) => sum + t.unread_count, 0);
  const totalUnreadSms = smsThreads.reduce((sum, t) => sum + t.unread_count, 0);
  const selectedThreadData = threads.find(t => t.thread_id === selectedThread);
  const allSelected = filteredThreads.length > 0 && selectedIds.size === filteredThreads.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* ─── Toast ─── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 10000, padding: "14px 24px",
          borderRadius: 12,
          background: toast.type === "success"
            ? "linear-gradient(135deg, #4CAF50, #2E7D32)"
            : "linear-gradient(135deg, #ef5350, #c62828)",
          color: "#fff", fontSize: 14, fontWeight: 600, boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
        }}>
          {toast.type === "success" ? "✓" : "⚠"} {toast.message}
        </div>
      )}

      {/* ─── Compose Modal ─── */}
      {composeOpen && (
        <div
          onClick={() => setComposeOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9000,
            background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 20,
              width: 520, maxWidth: "calc(100vw - 48px)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}
          >
            {/* Compose header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", background: "rgba(76,175,80,0.08)",
              borderBottom: "1px solid #1a3a1a",
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#e8f5e8" }}>New Message</span>
              <button
                onClick={() => setComposeOpen(false)}
                style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
              >×</button>
            </div>

            {/* Fields */}
            <div style={{ padding: "12px 18px", borderBottom: "1px solid #0d1a0d" }}>
              <input
                type="email"
                placeholder="To"
                value={composeTo}
                onChange={e => setComposeTo(e.target.value)}
                style={{
                  width: "100%", padding: "8px 0", background: "transparent",
                  border: "none", borderBottom: "1px solid #1a3a1a", color: "#e8f5e8",
                  fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid #0d1a0d" }}>
              <input
                type="text"
                placeholder="Subject"
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                style={{
                  width: "100%", padding: "8px 0", background: "transparent",
                  border: "none", borderBottom: "1px solid #1a3a1a", color: "#e8f5e8",
                  fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>
            <textarea
              placeholder="Write your message..."
              value={composeBody}
              onChange={e => setComposeBody(e.target.value)}
              rows={8}
              style={{
                width: "100%", padding: "16px 18px", background: "transparent",
                border: "none", color: "#e8f5e8", fontSize: 14, outline: "none",
                fontFamily: "'DM Sans', sans-serif", resize: "none",
                boxSizing: "border-box",
              }}
            />

            {/* Compose footer */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 18px", borderTop: "1px solid #1a3a1a",
            }}>
              <span style={{ fontSize: 11, color: "#3a5a3a" }}>Sends as info@jhpsfl.com</span>
              <button
                onClick={sendCompose}
                disabled={composeSending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 10, border: "none",
                  background: (composeTo && composeSubject && composeBody)
                    ? "linear-gradient(135deg, #4CAF50, #2E7D32)"
                    : "rgba(76,175,80,0.1)",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: (composeTo && composeSubject && composeBody) ? "pointer" : "default",
                  opacity: composeSending ? 0.6 : 1,
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: (composeTo && composeSubject && composeBody) ? "0 4px 20px rgba(76,175,80,0.35)" : "none",
                }}
              >
                <IconSend />
                {composeSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Page Header ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 800 }}>
          Messages
        </h1>

        {/* Email / SMS toggle */}
        <div style={{ display: "flex", gap: 4, background: "#0a160a", borderRadius: 12, padding: 4, border: "1px solid #1a3a1a" }}>
          {(["email", "sms"] as InboxTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setInboxTab(tab); setSelectedThread(null); setSelectedIds(new Set()); }}
              style={{
                padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                background: inboxTab === tab ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "transparent",
                color: inboxTab === tab ? "#fff" : "#5a8a5a",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {tab === "email" ? "✉️ Email" : "💬 SMS"}
              {tab === "email" && totalUnreadEmail > 0 && (
                <span style={{
                  background: inboxTab === "email" ? "rgba(255,255,255,0.25)" : "rgba(76,175,80,0.2)",
                  padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                  color: inboxTab === "email" ? "#fff" : "#4CAF50",
                }}>{totalUnreadEmail}</span>
              )}
              {tab === "sms" && totalUnreadSms > 0 && (
                <span style={{
                  background: inboxTab === "sms" ? "rgba(255,255,255,0.25)" : "rgba(76,175,80,0.2)",
                  padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                  color: inboxTab === "sms" ? "#fff" : "#4CAF50",
                }}>{totalUnreadSms}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ EMAIL TAB ═══ */}
      {inboxTab === "email" && (
        <div style={{
          display: "grid",
          gridTemplateColumns: selectedThread ? "340px 1fr" : "1fr",
          gap: 0,
          background: "#091409",
          border: "1px solid #1a3a1a",
          borderRadius: 20,
          overflow: "hidden",
          minHeight: 600,
        }}>
          {/* ─── Thread List (Left Panel) ─── */}
          <div style={{
            borderRight: selectedThread ? "1px solid #1a3a1a" : "none",
            overflowY: "auto",
            maxHeight: "calc(100vh - 200px)",
          }}>
            {/* Search bar */}
            <div style={{ padding: "14px 14px 0" }}>
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: "100%", padding: "9px 14px", background: "#0d1a0d",
                  border: "1px solid #1a3a1a", borderRadius: 10, color: "#e8f5e8",
                  fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* ─── Toolbar ─── */}
            <div style={{
              display: "flex", alignItems: "center", gap: 2,
              padding: "8px 10px",
              borderBottom: "1px solid #0d1a0d",
            }}>
              {/* Select all checkbox */}
              <button
                onClick={toggleSelectAll}
                title={allSelected ? "Deselect all" : "Select all"}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: 8, border: "none",
                  background: "transparent", cursor: "pointer",
                  color: someSelected ? "#4CAF50" : "#3a5a3a",
                  transition: "all 0.15s",
                }}
                onMouseOver={e => (e.currentTarget.style.background = "rgba(76,175,80,0.1)")}
                onMouseOut={e => (e.currentTarget.style.background = "transparent")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  {allSelected
                    ? <><rect x="3" y="3" width="18" height="18" rx="3" fill="rgba(76,175,80,0.2)" stroke="#4CAF50" /><polyline points="9 12 11.5 14.5 15 9" /></>
                    : someSelected
                      ? <><rect x="3" y="3" width="18" height="18" rx="3" /><line x1="7" y1="12" x2="17" y2="12" /></>
                      : <rect x="3" y="3" width="18" height="18" rx="3" />
                  }
                </svg>
              </button>

              {/* Divider */}
              <div style={{ width: 1, height: 20, background: "#1a3a1a", margin: "0 2px" }} />

              {/* Refresh */}
              <IconBtn
                onClick={() => fetchThreads(true)}
                title="Refresh"
                disabled={refreshing}
                active={refreshing}
              >
                <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>
                  <IconRefresh />
                </span>
              </IconBtn>

              {/* Delete (active when items selected) */}
              <IconBtn
                onClick={deleteSelected}
                title="Delete selected"
                disabled={!someSelected || deleting}
                active={someSelected}
                danger
              >
                <IconTrash />
              </IconBtn>

              {/* Mark read (placeholder) */}
              <IconBtn
                onClick={() => {}}
                title="Mark read"
                disabled={!someSelected}
              >
                <IconMarkRead />
              </IconBtn>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Selected count */}
              {someSelected && (
                <span style={{ fontSize: 11, color: "#5a8a5a", marginRight: 4 }}>
                  {selectedIds.size} selected
                </span>
              )}

              {/* Divider */}
              <div style={{ width: 1, height: 20, background: "#1a3a1a", margin: "0 2px" }} />

              {/* Compose */}
              <IconBtn
                onClick={() => setComposeOpen(true)}
                title="New email"
              >
                <IconCompose />
              </IconBtn>
            </div>

            {/* ─── Thread rows ─── */}
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#3a5a3a", fontSize: 14 }}>
                Loading threads...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                <div style={{ color: "#3a5a3a", fontSize: 14 }}>
                  {searchQuery ? "No matching threads" : "No emails yet"}
                </div>
                <div style={{ color: "#2a4a2a", fontSize: 12, marginTop: 4 }}>
                  Send an estimate or quote to start a thread, or use the compose button above
                </div>
              </div>
            ) : (
              filteredThreads.map(thread => {
                const isSelected = selectedIds.has(thread.thread_id);
                const isOpen = selectedThread === thread.thread_id;
                return (
                  <div
                    key={thread.thread_id}
                    onClick={() => {
                      if (!someSelected) {
                        fetchMessages(thread.thread_id);
                      } else {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          next.has(thread.thread_id) ? next.delete(thread.thread_id) : next.add(thread.thread_id);
                          return next;
                        });
                      }
                    }}
                    className="inbox-thread-row"
                    style={{
                      padding: "12px 14px",
                      cursor: "pointer",
                      borderBottom: "1px solid #0d1a0d",
                      background: isOpen
                        ? "rgba(76,175,80,0.08)"
                        : isSelected
                          ? "rgba(76,175,80,0.05)"
                          : "transparent",
                      transition: "background 0.15s",
                      display: "flex", gap: 10, alignItems: "flex-start",
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      onClick={e => toggleSelect(thread.thread_id, e)}
                      style={{
                        flexShrink: 0, width: 18, height: 18, marginTop: 11,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#4CAF50" : "#2a4a2a"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transition: "stroke 0.15s" }}
                      >
                        {isSelected
                          ? <><rect x="3" y="3" width="18" height="18" rx="3" fill="rgba(76,175,80,0.2)" stroke="#4CAF50" /><polyline points="9 12 11.5 14.5 15 9" /></>
                          : <rect x="3" y="3" width="18" height="18" rx="3" />
                        }
                      </svg>
                    </div>

                    {/* Avatar */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                      background: thread.unread_count > 0
                        ? "linear-gradient(135deg, #4CAF50, #2E7D32)"
                        : "linear-gradient(135deg, #1a3a1a, #0d1f0d)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700,
                      color: thread.unread_count > 0 ? "#fff" : "#5a8a5a",
                    }}>
                      {getInitials(thread.customer_name, thread.to_email)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div style={{
                          fontSize: 14,
                          fontWeight: thread.unread_count > 0 ? 700 : 500,
                          color: thread.unread_count > 0 ? "#e8f5e8" : "#a0c0a0",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {thread.customer_name || thread.to_email}
                        </div>
                        <div style={{ fontSize: 11, color: "#3a5a3a", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {timeAgo(thread.latest_message)}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: thread.unread_count > 0 ? 600 : 400,
                        color: thread.unread_count > 0 ? "#c8e0c8" : "#5a8a5a",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2,
                      }}>
                        {thread.subject}
                      </div>
                      <div style={{
                        fontSize: 12, color: "#3a5a3a",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2,
                      }}>
                        {thread.latest_direction === "outbound" ? "You: " : ""}
                        {thread.latest_body_preview}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {thread.unread_count > 0 && (
                      <div style={{
                        width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                        background: "#4CAF50", boxShadow: "0 0 8px rgba(76,175,80,0.4)",
                        marginTop: 5,
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ─── Thread Detail (Right Panel) ─── */}
          {selectedThread && (
            <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
              {/* Thread header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a3a1a", background: "rgba(5,14,5,0.6)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    onClick={() => setSelectedThread(null)}
                    className="inbox-back-btn"
                    style={{ display: "none", background: "none", border: "none", color: "#5a8a5a", fontSize: 18, cursor: "pointer", padding: "4px 8px" }}
                  >←</button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#e8f5e8" }}>
                      {selectedThreadData?.customer_name || selectedThreadData?.to_email || "Thread"}
                    </div>
                    <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 2 }}>
                      {selectedThreadData?.subject}
                      {selectedThreadData && selectedThreadData.message_count > 1 && (
                        <span style={{ color: "#3a5a3a" }}> · {selectedThreadData.message_count} messages</span>
                      )}
                    </div>
                  </div>
                  {leadInfo && (
                    <a href={`tel:${leadInfo.phone}`} style={{
                      padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "rgba(76,175,80,0.08)", border: "1px solid #1a3a1a",
                      color: "#4CAF50", textDecoration: "none",
                    }}>📞 Call</a>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ display: "flex", justifyContent: msg.direction === "outbound" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "75%", padding: "14px 18px",
                      borderRadius: msg.direction === "outbound" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      background: msg.direction === "outbound"
                        ? "linear-gradient(135deg, rgba(76,175,80,0.15), rgba(46,125,50,0.1))"
                        : "rgba(255,255,255,0.04)",
                      border: msg.direction === "outbound" ? "1px solid rgba(76,175,80,0.2)" : "1px solid #1a3a1a",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: 0.5, color: msg.direction === "outbound" ? "#4CAF50" : "#5a8a5a" }}>
                        {msg.direction === "outbound" ? "JHPS" : (selectedThreadData?.customer_name || msg.from_email)}
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.6, color: msg.direction === "outbound" ? "#c8e0c8" : "#a0c0a0" }}>
                        {msg.body_text || (msg.body_html ? msg.body_html.replace(/<[^>]+>/g, "").substring(0, 500) : "—")}
                      </div>
                      <div style={{ fontSize: 11, color: "#3a5a3a", marginTop: 8, textAlign: msg.direction === "outbound" ? "right" : "left" }}>
                        {formatDate(msg.created_at)}
                        {msg.direction === "outbound" && msg.resend_message_id && (
                          <span style={{ marginLeft: 6, color: "#2a5a2a" }}>✓ Sent</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Box */}
              <div style={{ padding: "16px 20px", borderTop: "1px solid #1a3a1a", background: "rgba(5,14,5,0.6)" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    rows={3}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendReply(); } }}
                    style={{
                      flex: 1, padding: "12px 14px", background: "#0d1a0d",
                      border: "1px solid #1a3a1a", borderRadius: 12, color: "#e8f5e8",
                      fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif",
                      resize: "vertical", minHeight: 60,
                    }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={sending || !replyText.trim()}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "0 20px",
                      background: replyText.trim() ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "rgba(76,175,80,0.1)",
                      border: "none", borderRadius: 12, color: "#fff",
                      fontSize: 14, fontWeight: 700, cursor: replyText.trim() ? "pointer" : "default",
                      fontFamily: "'DM Sans', sans-serif",
                      opacity: sending ? 0.6 : 1,
                      boxShadow: replyText.trim() ? "0 4px 20px rgba(76,175,80,0.35)" : "none",
                      transition: "all 0.2s", whiteSpace: "nowrap",
                      alignSelf: "flex-end", minHeight: 44,
                    }}
                  >
                    <IconSend />
                    {sending ? "..." : "Send"}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "#2a4a2a", marginTop: 6 }}>Ctrl+Enter to send</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ SMS TAB ═══ */}
      {inboxTab === "sms" && (
        <div style={{ background: "#091409", border: "1px solid #1a3a1a", borderRadius: 20, overflow: "hidden", minHeight: 400 }}>
          {smsThreads.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#e8f5e8", fontWeight: 700, marginBottom: 8 }}>
                SMS Coming Soon
              </h3>
              <p style={{ color: "#5a8a5a", fontSize: 14, maxWidth: 400, margin: "0 auto 24px" }}>
                Text message conversations with customers will appear here once a phone messaging service is connected.
              </p>
              <div style={{
                display: "inline-flex", flexDirection: "column", gap: 8,
                background: "rgba(76,175,80,0.06)", border: "1px solid #1a3a1a",
                borderRadius: 16, padding: "20px 24px", textAlign: "left",
              }}>
                <div style={{ fontSize: 12, color: "#4CAF50", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Setup Needed</div>
                {["1. Choose a provider (Twilio, Vonage, etc.)", "2. Add API credentials to Vercel environment", "3. Configure inbound webhook → /api/sms/inbound", "4. SMS will auto-appear in this tab ✓"].map((s, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#5a8a5a" }}>{s}</div>
                ))}
              </div>
            </div>
          ) : (
            smsThreads.map(thread => (
              <div key={thread.thread_id} style={{ padding: "14px 16px", borderBottom: "1px solid #0d1a0d", display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: thread.unread_count > 0 ? "linear-gradient(135deg, #42a5f5, #1565c0)" : "linear-gradient(135deg, #1a3a1a, #0d1f0d)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff",
                }}>💬</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: thread.unread_count > 0 ? 700 : 500, color: "#e8f5e8" }}>
                      {thread.customer_name || formatPhone(thread.to_phone)}
                    </div>
                    <div style={{ fontSize: 11, color: "#3a5a3a" }}>{timeAgo(thread.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#5a8a5a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                    {thread.latest_direction === "outbound" ? "You: " : ""}{thread.latest_body}
                  </div>
                </div>
                {thread.unread_count > 0 && (
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#42a5f5", boxShadow: "0 0 8px rgba(66,165,245,0.4)", marginTop: 4 }} />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Styles ─── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .inbox-back-btn { display: flex !important; }
        }
        .inbox-thread-row:hover { background: rgba(76,175,80,0.04) !important; }
      `}</style>
    </div>
  );
}
