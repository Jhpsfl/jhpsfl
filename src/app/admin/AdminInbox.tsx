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
  if (name) {
    return name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
  }
  return email.split("@")[0].substring(0, 2).toUpperCase();
}

function formatPhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p;
}

// ─── Main Component ───
export default function AdminInbox({ userId }: { userId: string }) {
  const [inboxTab, setInboxTab] = useState<InboxTab>("email");
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [smsThreads, setSmsThreads] = useState<SmsThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Fetch email threads ───
  const fetchThreads = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/email/threads?clerk_user_id=${userId}`);
    if (res.ok) {
      const data = await res.json();
      setThreads(data.threads || []);
    }
    setLoading(false);
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

      // Update thread unread count locally
      setThreads(prev => prev.map(t =>
        t.thread_id === threadId ? { ...t, unread_count: 0 } : t
      ));
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
      fetchThreads();
    } else {
      showToast("Failed to send reply", "error");
    }
    setSending(false);
  };

  useEffect(() => { fetchThreads(); fetchSmsThreads(); }, [fetchThreads, fetchSmsThreads]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Filter threads by search
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

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* Toast */}
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

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 800 }}>
          Messages
        </h1>

        {/* Email / SMS toggle */}
        <div style={{ display: "flex", gap: 4, background: "#0a160a", borderRadius: 12, padding: 4, border: "1px solid #1a3a1a" }}>
          <button
            onClick={() => { setInboxTab("email"); setSelectedThread(null); }}
            style={{
              padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
              background: inboxTab === "email" ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "transparent",
              color: inboxTab === "email" ? "#fff" : "#5a8a5a",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            ✉️ Email
            {totalUnreadEmail > 0 && (
              <span style={{
                background: inboxTab === "email" ? "rgba(255,255,255,0.25)" : "rgba(76,175,80,0.2)",
                padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                color: inboxTab === "email" ? "#fff" : "#4CAF50",
              }}>{totalUnreadEmail}</span>
            )}
          </button>
          <button
            onClick={() => { setInboxTab("sms"); setSelectedThread(null); }}
            style={{
              padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
              background: inboxTab === "sms" ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "transparent",
              color: inboxTab === "sms" ? "#fff" : "#5a8a5a",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            💬 SMS
            {totalUnreadSms > 0 && (
              <span style={{
                background: inboxTab === "sms" ? "rgba(255,255,255,0.25)" : "rgba(76,175,80,0.2)",
                padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                color: inboxTab === "sms" ? "#fff" : "#4CAF50",
              }}>{totalUnreadSms}</span>
            )}
          </button>
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
            display: selectedThread ? undefined : "block",
            overflowY: "auto",
            maxHeight: "calc(100vh - 200px)",
          }}>
            {/* Search */}
            <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #0d1a0d" }}>
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", background: "#0d1a0d",
                  border: "1px solid #1a3a1a", borderRadius: 10, color: "#e8f5e8",
                  fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>

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
                  Emails will appear here once estimates or quotes are sent
                </div>
              </div>
            ) : (
              filteredThreads.map(thread => (
                <div
                  key={thread.thread_id}
                  onClick={() => fetchMessages(thread.thread_id)}
                  style={{
                    padding: "14px 16px",
                    cursor: "pointer",
                    borderBottom: "1px solid #0d1a0d",
                    background: selectedThread === thread.thread_id
                      ? "rgba(76,175,80,0.08)"
                      : "transparent",
                    transition: "background 0.15s",
                    display: "flex", gap: 12, alignItems: "flex-start",
                  }}
                  onMouseOver={e => {
                    if (selectedThread !== thread.thread_id)
                      (e.currentTarget as HTMLElement).style.background = "rgba(76,175,80,0.04)";
                  }}
                  onMouseOut={e => {
                    if (selectedThread !== thread.thread_id)
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: thread.unread_count > 0
                      ? "linear-gradient(135deg, #4CAF50, #2E7D32)"
                      : "linear-gradient(135deg, #1a3a1a, #0d1f0d)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700,
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
                      <div style={{
                        fontSize: 11, color: "#3a5a3a", whiteSpace: "nowrap", flexShrink: 0,
                      }}>
                        {timeAgo(thread.latest_message)}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: thread.unread_count > 0 ? 600 : 400,
                      color: thread.unread_count > 0 ? "#c8e0c8" : "#5a8a5a",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginTop: 2,
                    }}>
                      {thread.subject}
                    </div>
                    <div style={{
                      fontSize: 12, color: "#3a5a3a",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginTop: 2,
                    }}>
                      {thread.latest_direction === "outbound" ? "You: " : ""}
                      {thread.latest_body_preview}
                    </div>
                  </div>

                  {/* Unread dot */}
                  {thread.unread_count > 0 && (
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                      background: "#4CAF50", boxShadow: "0 0 8px rgba(76,175,80,0.4)",
                      marginTop: 4,
                    }} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* ─── Thread Detail (Right Panel) ─── */}
          {selectedThread && (
            <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
              {/* Thread header */}
              <div style={{
                padding: "16px 20px", borderBottom: "1px solid #1a3a1a",
                background: "rgba(5,14,5,0.6)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Mobile back button */}
                  <button
                    onClick={() => setSelectedThread(null)}
                    className="inbox-back-btn"
                    style={{
                      display: "none", background: "none", border: "none",
                      color: "#5a8a5a", fontSize: 18, cursor: "pointer", padding: "4px 8px",
                    }}
                  >
                    ←
                  </button>
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
                  {/* Lead info */}
                  {leadInfo && (
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <a href={`tel:${leadInfo.phone}`} style={{
                        padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: "rgba(76,175,80,0.08)", border: "1px solid #1a3a1a",
                        color: "#4CAF50", textDecoration: "none",
                      }}>📞 Call</a>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div style={{
                flex: 1, overflowY: "auto", padding: "20px",
                display: "flex", flexDirection: "column", gap: 16,
              }}>
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      justifyContent: msg.direction === "outbound" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div style={{
                      maxWidth: "75%",
                      padding: "14px 18px",
                      borderRadius: msg.direction === "outbound"
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                      background: msg.direction === "outbound"
                        ? "linear-gradient(135deg, rgba(76,175,80,0.15), rgba(46,125,50,0.1))"
                        : "rgba(255,255,255,0.04)",
                      border: msg.direction === "outbound"
                        ? "1px solid rgba(76,175,80,0.2)"
                        : "1px solid #1a3a1a",
                    }}>
                      {/* Direction label */}
                      <div style={{
                        fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: 0.5,
                        color: msg.direction === "outbound" ? "#4CAF50" : "#5a8a5a",
                      }}>
                        {msg.direction === "outbound" ? "JHPS" : (selectedThreadData?.customer_name || msg.from_email)}
                      </div>

                      {/* Body */}
                      <div style={{
                        fontSize: 14, lineHeight: 1.6,
                        color: msg.direction === "outbound" ? "#c8e0c8" : "#a0c0a0",
                      }}>
                        {msg.body_text || (msg.body_html
                          ? msg.body_html.replace(/<[^>]+>/g, '').substring(0, 500)
                          : "—"
                        )}
                      </div>

                      {/* Timestamp */}
                      <div style={{
                        fontSize: 11, color: "#3a5a3a", marginTop: 8,
                        textAlign: msg.direction === "outbound" ? "right" : "left",
                      }}>
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
              <div style={{
                padding: "16px 20px", borderTop: "1px solid #1a3a1a",
                background: "rgba(5,14,5,0.6)",
              }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    rows={3}
                    onKeyDown={e => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
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
                      padding: "0 24px",
                      background: replyText.trim()
                        ? "linear-gradient(135deg, #4CAF50, #2E7D32)"
                        : "rgba(76,175,80,0.1)",
                      border: "none", borderRadius: 12, color: "#fff",
                      fontSize: 14, fontWeight: 700, cursor: replyText.trim() ? "pointer" : "default",
                      fontFamily: "'DM Sans', sans-serif",
                      opacity: sending ? 0.6 : 1,
                      boxShadow: replyText.trim() ? "0 4px 20px rgba(76,175,80,0.35)" : "none",
                      transition: "all 0.2s", whiteSpace: "nowrap",
                      alignSelf: "flex-end", minHeight: 44,
                    }}
                  >
                    {sending ? "Sending..." : "Send ↑"}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "#2a4a2a", marginTop: 6 }}>
                  Sends branded JHPS email · Ctrl+Enter to send
                </div>
              </div>
            </div>
          )}

          {/* Empty state when no thread selected on desktop */}
          {!selectedThread && filteredThreads.length > 0 && (
            <div style={{
              display: "none", /* shown via CSS on desktop when threads exist */
            }} className="inbox-empty-detail">
              <div style={{ textAlign: "center", color: "#3a5a3a" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Select a conversation</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Choose a thread from the left to view messages</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ SMS TAB (Placeholder) ═══ */}
      {inboxTab === "sms" && (
        <div style={{
          background: "#091409", border: "1px solid #1a3a1a",
          borderRadius: 20, overflow: "hidden", minHeight: 400,
        }}>
          {smsThreads.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
              <h3 style={{
                fontFamily: "'Playfair Display', serif", fontSize: 22,
                color: "#e8f5e8", fontWeight: 700, marginBottom: 8,
              }}>
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
                <div style={{ fontSize: 12, color: "#4CAF50", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
                  Setup Needed
                </div>
                <div style={{ fontSize: 13, color: "#5a8a5a" }}>
                  1. Choose a provider (Twilio, Vonage, etc.)
                </div>
                <div style={{ fontSize: 13, color: "#5a8a5a" }}>
                  2. Add API credentials to Vercel environment
                </div>
                <div style={{ fontSize: 13, color: "#5a8a5a" }}>
                  3. Configure inbound webhook → <code style={{ color: "#4CAF50", fontSize: 12 }}>/api/sms/inbound</code>
                </div>
                <div style={{ fontSize: 13, color: "#5a8a5a" }}>
                  4. SMS will auto-appear in this tab ✓
                </div>
              </div>
            </div>
          ) : (
            // SMS threads list (same layout as email, ready to use)
            <div>
              {smsThreads.map(thread => (
                <div
                  key={thread.thread_id}
                  style={{
                    padding: "14px 16px", borderBottom: "1px solid #0d1a0d",
                    display: "flex", gap: 12, alignItems: "flex-start",
                    cursor: "pointer",
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: thread.unread_count > 0
                      ? "linear-gradient(135deg, #42a5f5, #1565c0)"
                      : "linear-gradient(135deg, #1a3a1a, #0d1f0d)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, color: "#fff",
                  }}>
                    💬
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{
                        fontSize: 14, fontWeight: thread.unread_count > 0 ? 700 : 500,
                        color: "#e8f5e8",
                      }}>
                        {thread.customer_name || formatPhone(thread.to_phone)}
                      </div>
                      <div style={{ fontSize: 11, color: "#3a5a3a" }}>{timeAgo(thread.created_at)}</div>
                    </div>
                    <div style={{
                      fontSize: 13, color: "#5a8a5a", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2,
                    }}>
                      {thread.latest_direction === "outbound" ? "You: " : ""}
                      {thread.latest_body}
                    </div>
                  </div>
                  {thread.unread_count > 0 && (
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#42a5f5", boxShadow: "0 0 8px rgba(66,165,245,0.4)",
                      marginTop: 4,
                    }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Responsive Styles ─── */}
      <style>{`
        @media (max-width: 768px) {
          .inbox-back-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
