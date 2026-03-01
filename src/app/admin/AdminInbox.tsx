"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";

// ─── Types ───
type EmailFolder = "inbox" | "sent" | "drafts" | "trash" | "spam" | "starred";

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
  starred: boolean;
  has_attachments: boolean;
  lead_id: string | null;
  created_at: string;
  customer_name?: string;
}

interface EmailAttachment {
  id: string;
  message_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  s3_key: string;
  s3_url: string;
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
  starred: boolean;
  folder: string;
  has_attachments: boolean;
  is_draft: boolean;
  created_at: string;
  attachments?: EmailAttachment[];
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

interface EmailContact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  category: string;
  notes: string | null;
  starred: boolean;
}

interface PendingAttachment {
  filename: string;
  content_type: string;
  size_bytes: number;
  s3_key: string;
  s3_url: string;
}

interface FolderCounts {
  inbox: number;
  sent: number;
  starred: number;
  drafts: number;
  trash: number;
  spam: number;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

// File extension to icon mapping
function fileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "\u{1F5BC}";
  if (["pdf"].includes(ext)) return "\u{1F4C4}";
  if (["doc", "docx"].includes(ext)) return "\u{1F4DD}";
  if (["xls", "xlsx", "csv"].includes(ext)) return "\u{1F4CA}";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "\u{1F4E6}";
  return "\u{1F4CE}";
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
const IconStar = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "#FFD700" : "none"} stroke={filled ? "#FFD700" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconAttach = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);
const IconContacts = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconDownload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Folder icons
const folderIcons: Record<string, string> = {
  inbox: "\u2709",
  starred: "\u2B50",
  sent: "\u{1F4E8}",
  drafts: "\u{1F4DD}",
  spam: "\u26A0",
  trash: "\u{1F5D1}",
};

// ─── Tiptap Editor Toolbar ───
function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const btn = (active: boolean, onClick: () => void, label: string) => (
    <button key={label} onClick={onClick} type="button"
      style={{ padding: "4px 8px", borderRadius: 4, border: "none", background: active ? "rgba(76,175,80,0.2)" : "transparent", color: active ? "#4CAF50" : "#5a8a5a", cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 400, fontFamily: "inherit", lineHeight: 1 }}>
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 2, padding: "6px 8px", borderBottom: "1px solid #1a3a1a", background: "rgba(10,22,10,0.5)" }}>
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "B")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "I")}
      {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "U")}
      {btn(editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "S")}
      <span style={{ width: 1, background: "#1a3a1a", margin: "0 4px" }} />
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "\u2022 List")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "1. List")}
      {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "\u201C Quote")}
      <span style={{ width: 1, background: "#1a3a1a", margin: "0 4px" }} />
      {btn(editor.isActive("link"), () => {
        if (editor.isActive("link")) { editor.chain().focus().unsetLink().run(); return; }
        const url = window.prompt("Enter URL:");
        if (url) editor.chain().focus().setLink({ href: url }).run();
      }, "\u{1F517} Link")}
    </div>
  );
}


// ─── Main Component ───
export default function AdminInbox({ userId, backRef, onNavigate }: { userId: string; backRef?: React.MutableRefObject<(() => boolean) | null>; onNavigate?: () => void }) {
  // ─── State ───
  const [activeFolder, setActiveFolder] = useState<EmailFolder>("inbox");
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [folderCounts, setFolderCounts] = useState<FolderCounts>({ inbox: 0, sent: 0, starred: 0, drafts: 0, trash: 0, spam: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedMsgs, setCollapsedMsgs] = useState<Set<string>>(new Set());
  const [mobileSidebar, setMobileSidebar] = useState(false);

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [composeAttachments, setComposeAttachments] = useState<PendingAttachment[]>([]);
  const [composeUploading, setComposeUploading] = useState(false);
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);
  const [showCc, setShowCc] = useState(false);
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");

  // Contacts state
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactFilter, setContactFilter] = useState("all");
  const [contactModal, setContactModal] = useState<EmailContact | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", company: "", category: "other", notes: "" });
  const [contactSaving, setContactSaving] = useState(false);

  // Contact suggestions for compose
  const [toSuggestions, setToSuggestions] = useState<EmailContact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Reply state
  const [replyText, setReplyText] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tiptap editors
  const composeEditor = useEditor({
    extensions: [
      StarterKit, Underline, Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Write your message..." }),
      TextStyle, Color,
    ],
    content: "",
    editorProps: {
      attributes: { style: "min-height:120px;outline:none;color:#e8f5e8;font-size:14px;line-height:1.6;padding:12px 14px;" },
    },
  });

  const replyEditor = useEditor({
    extensions: [
      StarterKit, Underline, Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Type your reply..." }),
      TextStyle, Color,
    ],
    content: "",
    editorProps: {
      attributes: { style: "min-height:60px;outline:none;color:#e8f5e8;font-size:14px;line-height:1.6;padding:10px 14px;" },
    },
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Close thread ───
  const closeThread = useCallback(() => {
    setSelectedThread(null);
    setMessages([]);
    setLeadInfo(null);
    setReplyText("");
    setReplyAttachments([]);
    setCollapsedMsgs(new Set());
    replyEditor?.commands.clearContent();
  }, [replyEditor]);

  // ─── Back button ───
  if (backRef) {
    backRef.current = () => {
      if (contactsOpen) { setContactsOpen(false); return true; }
      if (composeOpen) { setComposeOpen(false); return true; }
      if (selectedThread) { closeThread(); return true; }
      return false;
    };
  }


  // ─── Data fetching ───
  const fetchThreads = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    try {
      const res = await fetch(`/api/email/threads?clerk_user_id=${userId}&folder=${activeFolder}`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
        if (data.folderCounts) setFolderCounts(data.folderCounts);
      }
    } catch (e) { console.error("Failed to fetch threads:", e); }
    setLoading(false); setRefreshing(false);
  }, [userId, activeFolder]);

  const fetchMessages = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/email/threads/${threadId}?clerk_user_id=${userId}`);
    if (res.ok) {
      const data = await res.json();
      const msgs: EmailMessage[] = data.messages || [];
      setMessages(msgs);
      setLeadInfo(data.lead || null);
      setSelectedThread(threadId);
      onNavigate?.();
      setReplyText("");
      replyEditor?.commands.clearContent();
      setReplyAttachments([]);
      if (msgs.length > 1) {
        setCollapsedMsgs(new Set(msgs.slice(0, -1).map(m => m.id)));
      } else {
        setCollapsedMsgs(new Set());
      }
      setThreads(prev => prev.map(t => t.thread_id === threadId ? { ...t, unread_count: 0 } : t));
    }
  }, [userId, onNavigate, replyEditor]);

  const fetchContacts = useCallback(async (q?: string) => {
    const params = new URLSearchParams({ clerk_user_id: userId });
    if (q) params.set("q", q);
    const res = await fetch(`/api/email/contacts?${params}`);
    if (res.ok) { const data = await res.json(); setContacts(data.contacts || []); }
  }, [userId]);

  // ─── Thread actions ───
  const threadAction = useCallback(async (threadIds: string[], action: string, value?: string) => {
    await fetch(`/api/email/threads?clerk_user_id=${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_ids: threadIds, action, value }),
    });
  }, [userId]);

  const toggleStar = async (threadId: string, currentStarred: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setThreads(prev => prev.map(t => t.thread_id === threadId ? { ...t, starred: !currentStarred } : t));
    await threadAction([threadId], currentStarred ? "unstar" : "star");
  };

  const moveToTrash = async (threadIds: string[]) => {
    await threadAction(threadIds, "trash");
    if (selectedThread && threadIds.includes(selectedThread)) closeThread();
    setSelectedIds(new Set());
    showToast(`Moved ${threadIds.length} thread${threadIds.length > 1 ? "s" : ""} to trash`);
    fetchThreads(true);
  };

  const restoreFromTrash = async (threadIds: string[]) => {
    await threadAction(threadIds, "restore");
    setSelectedIds(new Set());
    showToast("Restored from trash");
    fetchThreads(true);
  };

  const permanentDelete = async (threadIds: string[]) => {
    await fetch(`/api/email/threads?clerk_user_id=${userId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_ids: threadIds, permanent: true }),
    });
    if (selectedThread && threadIds.includes(selectedThread)) closeThread();
    setSelectedIds(new Set());
    showToast("Permanently deleted");
    fetchThreads(true);
  };

  const bulkMarkRead = async (read: boolean) => {
    await threadAction([...selectedIds], read ? "mark_read" : "mark_unread");
    setSelectedIds(new Set());
    showToast(read ? "Marked as read" : "Marked as unread");
    fetchThreads(true);
  };

  const bulkStar = async (star: boolean) => {
    await threadAction([...selectedIds], star ? "star" : "unstar");
    setSelectedIds(new Set());
    showToast(star ? "Starred" : "Unstarred");
    fetchThreads(true);
  };

  // ─── Compose: send ───
  const sendCompose = async () => {
    if (!composeTo.trim() || !composeSubject.trim()) return;
    const html = composeEditor?.getHTML() || "";
    if (!html || html === "<p></p>") return;
    setComposeSending(true);
    const res = await fetch("/api/email/compose", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerk_user_id: userId,
        to_email: composeTo.trim(),
        subject: composeSubject.trim(),
        body_html: html,
        body: composeEditor?.getText() || "",
        draft_id: composeDraftId,
        cc_emails: showCc && composeCc.trim() ? composeCc.split(",").map(e => e.trim()).filter(Boolean) : undefined,
        bcc_emails: showCc && composeBcc.trim() ? composeBcc.split(",").map(e => e.trim()).filter(Boolean) : undefined,
        attachments: composeAttachments.length ? composeAttachments : undefined,
      }),
    });
    if (res.ok) {
      showToast("Email sent!");
      closeCompose();
      fetchThreads(true);
    } else { showToast("Failed to send email", "error"); }
    setComposeSending(false);
  };

  const closeCompose = () => {
    setComposeOpen(false);
    setComposeTo("");
    setComposeSubject("");
    composeEditor?.commands.clearContent();
    setComposeAttachments([]);
    setComposeDraftId(null);
    setShowCc(false);
    setComposeCc("");
    setComposeBcc("");
    setShowSuggestions(false);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
  };

  // ─── Compose: draft auto-save ───
  const saveDraft = useCallback(async () => {
    if (!composeOpen) return;
    const html = composeEditor?.getHTML() || "";
    const res = await fetch("/api/email/drafts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerk_user_id: userId, draft_id: composeDraftId,
        to_email: composeTo, subject: composeSubject || "(no subject)",
        body_html: html, body_text: composeEditor?.getText() || "",
        cc_emails: composeCc.split(",").map(e => e.trim()).filter(Boolean),
        bcc_emails: composeBcc.split(",").map(e => e.trim()).filter(Boolean),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.draft?.id && !composeDraftId) setComposeDraftId(data.draft.id);
    }
  }, [composeOpen, composeTo, composeSubject, composeCc, composeBcc, composeDraftId, userId, composeEditor]);

  // Auto-save draft every 30s
  useEffect(() => {
    if (!composeOpen) return;
    draftTimerRef.current = setInterval(() => { saveDraft(); }, 30000);
    return () => { if (draftTimerRef.current) clearInterval(draftTimerRef.current); };
  }, [composeOpen, saveDraft]);

  // ─── Compose: file upload ───
  const uploadFile = async (file: File, target: "compose" | "reply") => {
    if (file.size > 10 * 1024 * 1024) { showToast("File too large (max 10MB)", "error"); return; }
    if (target === "compose") setComposeUploading(true);
    const formData = new FormData();
    formData.append("clerk_user_id", userId);
    formData.append("file", file);
    const res = await fetch("/api/email/attachments", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      if (target === "compose") {
        setComposeAttachments(prev => [...prev, data.attachment]);
      } else {
        setReplyAttachments(prev => [...prev, data.attachment]);
      }
    } else { showToast("Upload failed", "error"); }
    if (target === "compose") setComposeUploading(false);
  };

  // ─── Reply: send ───
  const sendReply = async () => {
    const html = replyEditor?.getHTML() || "";
    const text = replyEditor?.getText() || replyText;
    if ((!text.trim() && (!html || html === "<p></p>")) || !selectedThread) return;
    const thread = threads.find(t => t.thread_id === selectedThread);
    if (!thread) return;
    setSending(true);
    const res = await fetch("/api/email/reply", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerk_user_id: userId, thread_id: selectedThread,
        to_email: thread.to_email, to_name: thread.customer_name || leadInfo?.name,
        subject: thread.subject,
        reply_html: html, reply_body: text,
        lead_id: thread.lead_id,
        attachments: replyAttachments.length ? replyAttachments : undefined,
      }),
    });
    if (res.ok) {
      showToast("Reply sent!");
      replyEditor?.commands.clearContent();
      setReplyText("");
      setReplyAttachments([]);
      fetchMessages(selectedThread);
      fetchThreads(true);
    } else { showToast("Failed to send reply", "error"); }
    setSending(false);
  };

  // ─── Contact suggestions for To field ───
  const searchContacts = async (q: string) => {
    if (q.length < 2) { setToSuggestions([]); setShowSuggestions(false); return; }
    const res = await fetch(`/api/email/contacts?clerk_user_id=${userId}&q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      setToSuggestions(data.contacts || []);
      setShowSuggestions((data.contacts || []).length > 0);
    }
  };

  // ─── Contact CRUD ───
  const saveContact = async () => {
    setContactSaving(true);
    const res = await fetch("/api/email/contacts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerk_user_id: userId,
        action: contactModal?.id ? "update" : "create",
        contact: { ...contactForm, id: contactModal?.id },
      }),
    });
    if (res.ok) { showToast("Contact saved!"); setContactModal(null); fetchContacts(); }
    else { showToast("Failed to save contact", "error"); }
    setContactSaving(false);
  };

  const deleteContact = async (id: string) => {
    const res = await fetch("/api/email/contacts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerk_user_id: userId, action: "delete", contact: { id, name: "", email: "" } }),
    });
    if (res.ok) { showToast("Contact deleted"); fetchContacts(); }
  };

  // ─── Open draft for editing ───
  const openDraft = (thread: EmailThread) => {
    // Load the draft message and populate compose
    fetch(`/api/email/threads/${thread.thread_id}?clerk_user_id=${userId}`)
      .then(r => r.json())
      .then(data => {
        const draft = (data.messages || [])[0];
        if (draft) {
          setComposeTo(draft.to_email || "");
          setComposeSubject(draft.subject || "");
          composeEditor?.commands.setContent(draft.body_html || draft.body_text || "");
          setComposeDraftId(draft.id);
          setComposeOpen(true);
          onNavigate?.();
        }
      });
  };

  // ─── Selection helpers ───
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const filteredThreads = threads.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (t.customer_name || "").toLowerCase().includes(q) || t.to_email.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.latest_body_preview.toLowerCase().includes(q);
  });

  const allSelected = filteredThreads.length > 0 && selectedIds.size === filteredThreads.length;
  const someSelected = selectedIds.size > 0;
  const selectedThreadData = threads.find(t => t.thread_id === selectedThread);

  // ─── Effects ───
  useEffect(() => { fetchThreads(); setSelectedIds(new Set()); }, [fetchThreads]);
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => { messagesContainerRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); });
    }
  }, [messages]);
  useEffect(() => { if (contactsOpen) fetchContacts(); }, [contactsOpen, fetchContacts]);


  const categoryColors: Record<string, string> = {
    vendor: "#2196F3", customer: "#4CAF50", supplier: "#FF9800", contractor: "#9C27B0", other: "#607D8B",
  };

  // ═══════════════════════
  // ─── RENDER ───
  // ═══════════════════════
  return (
    <div className="gmail-inbox-root">
      <style>{`
        .gmail-inbox-root {
          animation: gmailFadeIn 0.2s ease;
          margin: -16px;
          min-height: 100vh;
          background: #050e05;
          font-family: 'DM Sans', sans-serif;
          display: flex;
        }
        @keyframes gmailFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gmailSpin { to { transform: rotate(360deg); } }
        .gmail-inbox-root input, .gmail-inbox-root select, .gmail-inbox-root textarea {
          font-size: 14px !important; min-height: unset !important; padding: 0 !important;
        }
        .gmail-inbox-root button { min-height: unset !important; padding: 0 !important; font-family: 'DM Sans', sans-serif; }
        .gmail-inbox-root h1, .gmail-inbox-root h2, .gmail-inbox-root h3 { font-size: unset !important; }
        .gmail-inbox-root p, .gmail-inbox-root td { font-size: unset !important; }
        .gmail-thread-row { transition: background 0.1s; }
        .gmail-thread-row:active { background: rgba(76,175,80,0.1) !important; }
        .gmail-msg-card { border-bottom: 1px solid #0d1a0d; }
        .gmail-msg-card:last-of-type { border-bottom: none; }
        .gmail-msg-collapsed { cursor: pointer; }
        .gmail-msg-collapsed:active { background: rgba(76,175,80,0.06); }
        .gmail-folder-btn { transition: background 0.15s; cursor: pointer; }
        .gmail-folder-btn:hover { background: rgba(76,175,80,0.08) !important; }
        .tiptap-editor .ProseMirror { min-height: 80px; }
        .tiptap-editor .ProseMirror p { margin: 0 0 4px; }
        .tiptap-editor .ProseMirror ul, .tiptap-editor .ProseMirror ol { padding-left: 20px; margin: 4px 0; }
        .tiptap-editor .ProseMirror blockquote { border-left: 3px solid #2E7D32; padding-left: 12px; margin: 8px 0; color: #8ab88a; }
        .tiptap-editor .ProseMirror a { color: #4CAF50; text-decoration: underline; }
        .tiptap-editor .ProseMirror:focus { outline: none; }
        .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder); color: #3a5a3a; pointer-events: none; float: left; height: 0;
        }
        .gmail-fab {
          position: fixed; bottom: 80px; right: 20px; z-index: 80;
          display: none; align-items: center; gap: 10px;
          padding: 14px 22px !important; border-radius: 16px; border: none;
          background: linear-gradient(135deg, #1a3a1a, #0d2a0d);
          color: #4CAF50; font-size: 14px; font-weight: 700;
          cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px #1a3a1a;
        }
        .gmail-fab:active { transform: scale(0.96); }
        @media (max-width: 900px) {
          .gmail-fab { display: flex; }
          .gmail-sidebar { display: none !important; }
          .gmail-sidebar.open { display: flex !important; position: fixed; top: 0; left: 0; bottom: 0; z-index: 500; }
          .gmail-detail-overlay {
            position: fixed !important; top: 0 !important; left: 0 !important;
            right: 0 !important; bottom: 0 !important; z-index: 300 !important; background: #050e05 !important;
          }
        }
      `}</style>

      {/* ─── Toast ─── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 10000, padding: "12px 20px",
          borderRadius: 8, background: toast.type === "success" ? "#2E7D32" : "#c62828",
          color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>{toast.type === "success" ? "\u2713" : "\u26A0"} {toast.message}</div>
      )}

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" multiple style={{ display: "none" }}
        onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(f => uploadFile(f, "compose")); e.target.value = ""; }} />
      <input ref={replyFileInputRef} type="file" multiple style={{ display: "none" }}
        onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(f => uploadFile(f, "reply")); e.target.value = ""; }} />


      {/* ═══ FOLDER SIDEBAR ═══ */}
      <div className={`gmail-sidebar${mobileSidebar ? " open" : ""}`}
        style={{ width: 220, flexShrink: 0, background: "#0a160a", borderRight: "1px solid #1a3a1a", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
        {/* Compose button */}
        <div style={{ padding: "16px 12px 8px" }}>
          <button onClick={() => { setComposeOpen(true); setMobileSidebar(false); onNavigate?.(); }}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 20px !important", borderRadius: 16, border: "1px solid #1a3a1a", background: "linear-gradient(135deg, #1a3a1a, #0d2a0d)", color: "#4CAF50", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            <IconCompose /> Compose
          </button>
        </div>

        {/* Folder list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
          {(["inbox", "starred", "sent", "drafts", "spam", "trash"] as EmailFolder[]).map(folder => {
            const isActive = activeFolder === folder;
            const count = folderCounts[folder] || 0;
            return (
              <button key={folder} className="gmail-folder-btn"
                onClick={() => { setActiveFolder(folder); setSelectedIds(new Set()); setSelectedThread(null); setMobileSidebar(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px !important",
                  borderRadius: 20, border: "none", fontSize: 13, fontWeight: isActive ? 700 : 400,
                  background: isActive ? "rgba(76,175,80,0.12)" : "transparent",
                  color: isActive ? "#4CAF50" : "#8ab88a", textAlign: "left",
                }}>
                <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{folderIcons[folder]}</span>
                <span style={{ flex: 1, textTransform: "capitalize" }}>{folder}</span>
                {count > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? "#4CAF50" : "#5a8a5a",
                    background: isActive ? "rgba(76,175,80,0.15)" : "rgba(90,138,90,0.1)",
                    padding: "2px 8px", borderRadius: 10 }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Contacts button */}
        <div style={{ padding: "8px 12px 16px", borderTop: "1px solid #1a3a1a" }}>
          <button onClick={() => { setContactsOpen(true); setMobileSidebar(false); }}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px !important",
              borderRadius: 20, border: "none", background: "transparent", color: "#5a8a5a", fontSize: 13, cursor: "pointer" }}>
            <IconContacts /> Contacts
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebar && <div onClick={() => setMobileSidebar(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 499 }} />}

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>


        {/* ═══ THREAD LIST VIEW ═══ */}
        {!selectedThread && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Search bar + mobile menu */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
              {/* Mobile hamburger */}
              <button onClick={() => setMobileSidebar(true)}
                style={{ display: "none", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}
                className="gmail-mobile-menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 24, padding: "8px 16px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a8a5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input type="text" placeholder={`Search in ${activeFolder}`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  style={{ flex: 1, background: "transparent", border: "none", color: "#e8f5e8", outline: "none", padding: "4px 0 !important" }} />
              </div>
            </div>
            <style>{`.gmail-mobile-menu { display: none !important; } @media (max-width: 900px) { .gmail-mobile-menu { display: flex !important; } }`}</style>

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", borderBottom: "1px solid #0d1a0d" }}>
              {/* Select all */}
              <button onClick={() => {
                if (allSelected) setSelectedIds(new Set());
                else setSelectedIds(new Set(filteredThreads.map(t => t.thread_id)));
              }} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: someSelected ? "#4CAF50" : "#3a5a3a" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {allSelected ? <><rect x="3" y="3" width="18" height="18" rx="3" fill="rgba(76,175,80,0.2)" stroke="#4CAF50" /><polyline points="9 12 11.5 14.5 15 9" /></> : someSelected ? <><rect x="3" y="3" width="18" height="18" rx="3" /><line x1="7" y1="12" x2="17" y2="12" /></> : <rect x="3" y="3" width="18" height="18" rx="3" />}
                </svg>
              </button>
              {/* Refresh */}
              <button onClick={() => fetchThreads(true)} disabled={refreshing} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}>
                <span style={{ display: "inline-block", animation: refreshing ? "gmailSpin 1s linear infinite" : "none" }}><IconRefresh /></span>
              </button>

              {/* Bulk actions */}
              {someSelected && (
                <>
                  <button onClick={() => bulkStar(true)} title="Star" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#FFD700" }}>
                    <IconStar filled={false} />
                  </button>
                  <button onClick={() => bulkMarkRead(true)} title="Mark read" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                  </button>
                  {activeFolder === "trash" ? (
                    <>
                      <button onClick={() => restoreFromTrash([...selectedIds])} title="Restore" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#4CAF50" }}>
                        <IconReply />
                      </button>
                      <button onClick={() => permanentDelete([...selectedIds])} title="Delete permanently" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#ef5350" }}>
                        <IconTrash />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => moveToTrash([...selectedIds])} title="Move to trash" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#7a4a4a" }}>
                      <IconTrash />
                    </button>
                  )}
                </>
              )}
              <div style={{ flex: 1 }} />
              {someSelected && <span style={{ fontSize: 11, color: "#5a8a5a" }}>{selectedIds.size} selected</span>}
            </div>

            {/* Thread rows */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: "center", color: "#3a5a3a", fontSize: 13 }}>Loading...</div>
              ) : filteredThreads.length === 0 ? (
                <div style={{ padding: 60, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>{folderIcons[activeFolder] || "\u{1F4ED}"}</div>
                  <div style={{ color: "#3a5a3a", fontSize: 13 }}>
                    {searchQuery ? "No matching threads" : `No emails in ${activeFolder}`}
                  </div>
                </div>
              ) : (
                filteredThreads.map(thread => {
                  const isSelected = selectedIds.has(thread.thread_id);
                  const isUnread = thread.unread_count > 0;
                  const senderName = thread.customer_name || thread.to_email.split("@")[0];
                  const isDraft = activeFolder === "drafts";
                  return (
                    <div key={thread.thread_id} className="gmail-thread-row"
                      onClick={() => {
                        if (someSelected) {
                          setSelectedIds(prev => { const n = new Set(prev); n.has(thread.thread_id) ? n.delete(thread.thread_id) : n.add(thread.thread_id); return n; });
                        } else if (isDraft) {
                          openDraft(thread);
                        } else {
                          fetchMessages(thread.thread_id);
                        }
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 0, padding: "10px 8px 10px 4px", borderBottom: "1px solid #0a160a", background: isSelected ? "rgba(76,175,80,0.06)" : "rgba(13,26,13,0.6)", borderRadius: 4, margin: "2px 6px", cursor: "pointer" }}>
                      {/* Checkbox */}
                      <div onClick={e => toggleSelect(thread.thread_id, e)} style={{ width: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#4CAF50" : "#2a4a2a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {isSelected ? <><rect x="3" y="3" width="18" height="18" rx="3" fill="rgba(76,175,80,0.2)" stroke="#4CAF50" /><polyline points="9 12 11.5 14.5 15 9" /></> : <rect x="3" y="3" width="18" height="18" rx="3" />}
                        </svg>
                      </div>
                      {/* Star */}
                      <div onClick={e => toggleStar(thread.thread_id, thread.starred, e)} style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <IconStar filled={thread.starred} />
                      </div>
                      {/* Avatar */}
                      <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, marginRight: 10, background: isUnread ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "#1a2a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: isUnread ? "#fff" : "#5a8a5a" }}>
                        {isDraft ? "\u{1F4DD}" : getInitials(thread.customer_name, thread.to_email)}
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: isUnread ? 700 : 400, color: isUnread ? "#e8f5e8" : "#a0b8a0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {isDraft ? <span style={{ color: "#ef5350" }}>Draft</span> : senderName}
                          </div>
                          <div style={{ fontSize: 11, color: isUnread ? "#4CAF50" : "#3a5a3a", whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                            {thread.has_attachments && <IconAttach />}
                            {timeAgo(thread.latest_message)}
                            {isUnread && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#4CAF50", marginLeft: 4 }} />}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: isUnread ? 600 : 400, color: isUnread ? "#c8e0c8" : "#6a8a6a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{thread.subject}</div>
                        <div style={{ fontSize: 11, color: "#4a6a4a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                          {thread.latest_direction === "outbound" ? "You: " : ""}{thread.latest_body_preview}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Mobile FAB */}
        <button className="gmail-fab" onClick={() => { onNavigate?.(); setComposeOpen(true); }}><IconCompose /> Compose</button>


        {/* ═══ THREAD DETAIL VIEW ═══ */}
        {selectedThread && (
          <div className="gmail-detail-overlay" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#050e05" }}>
            {/* Top toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "6px 4px", borderBottom: "1px solid #0d1a0d", background: "rgba(5,14,5,0.98)", flexShrink: 0 }}>
              <button onClick={closeThread} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#8ab88a" }}><IconBack /></button>
              <div style={{ flex: 1 }} />
              {selectedThreadData && (
                <button onClick={e => toggleStar(selectedThreadData.thread_id, selectedThreadData.starred, e)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer" }}>
                  <IconStar filled={selectedThreadData.starred} />
                </button>
              )}
              <button onClick={() => { if (selectedThread) moveToTrash([selectedThread]); }}
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
            <div ref={messagesContainerRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
              {messages.map(msg => {
                const isOutbound = msg.direction === "outbound";
                const senderName = isOutbound ? "JHPS" : (selectedThreadData?.customer_name || msg.from_email.split("@")[0]);
                const senderEmail = isOutbound ? "info@jhpsfl.com" : msg.from_email;
                const initials = isOutbound ? "JP" : getInitials(selectedThreadData?.customer_name, msg.from_email);
                const isCollapsed = collapsedMsgs.has(msg.id);
                const bodyText = msg.body_text || (msg.body_html ? htmlToText(msg.body_html) : "\u2014");
                const hasHtml = !!msg.body_html;
                const attachments = msg.attachments || [];

                if (isCollapsed) {
                  return (
                    <div key={msg.id} className="gmail-msg-card gmail-msg-collapsed" onClick={() => setCollapsedMsgs(prev => { const n = new Set(prev); n.delete(msg.id); return n; })}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#0d1a0d", margin: "4px 8px", borderRadius: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: isOutbound ? "#1a3a2a" : "#1a2a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isOutbound ? "#4CAF50" : "#6a8a6a" }}>{initials}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#a0b8a0", flexShrink: 0 }}>{senderName}</div>
                      <div style={{ flex: 1, fontSize: 12, color: "#4a6a4a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bodyText.substring(0, 80)}</div>
                      {attachments.length > 0 && <span style={{ color: "#5a8a5a" }}><IconAttach /></span>}
                      <div style={{ fontSize: 11, color: "#3a5a3a", flexShrink: 0 }}>{shortTime(msg.created_at)}</div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="gmail-msg-card" style={{ padding: "16px 16px 20px", background: "#0a140a", margin: "4px 8px", borderRadius: 8, border: "1px solid #1a2a1a" }}>
                    {/* Sender header */}
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
                          <button onClick={() => setCollapsedMsgs(prev => { const n = new Set(prev); n.add(msg.id); return n; })}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a", fontSize: 12 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    {isOutbound && msg.resend_message_id && <div style={{ fontSize: 11, color: "#2E7D32", marginBottom: 8 }}>{"\u2713"} Delivered</div>}

                    {/* Body: render HTML in sandboxed iframe, fallback to plain text */}
                    <div style={{ marginTop: 8 }}>
                      {hasHtml ? (
                        <iframe
                          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:12px;font-family:-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#c8dcc8;background:#0a160a;}img{max-width:100%;height:auto;}a{color:#4CAF50;}table{max-width:100%!important;width:100%!important;}td{background:transparent!important;}h1,h2,h3,p,div,span{color:#c8dcc8!important;background:transparent!important;}strong,b{color:#e8f5e8!important;}a{color:#4CAF50!important;}</style></head><body>${msg.body_html}</body></html>`}
                          sandbox="allow-same-origin"
                          style={{ width: "100%", minHeight: 120, border: "1px solid #1a3a1a", borderRadius: 8, background: "#0a160a" }}
                          onLoad={e => {
                            const iframe = e.target as HTMLIFrameElement;
                            if (iframe.contentDocument?.body) {
                              iframe.style.height = Math.max(120, iframe.contentDocument.body.scrollHeight + 20) + "px";
                            }
                          }}
                        />
                      ) : (
                        <div style={{ fontSize: 14, lineHeight: 1.6, color: "#c8dcc8", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{bodyText}</div>
                      )}
                    </div>

                    {/* Attachments */}
                    {attachments.length > 0 && (
                      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {attachments.map(att => (
                          <a key={att.id} href={att.s3_url} target="_blank" rel="noopener noreferrer"
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, border: "1px solid #1a3a1a", background: "#0d1a0d", color: "#8ab88a", textDecoration: "none", fontSize: 12 }}>
                            <span>{fileIcon(att.filename)}</span>
                            <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.filename}</span>
                            <span style={{ color: "#3a5a3a" }}>({formatFileSize(att.size_bytes)})</span>
                            <IconDownload />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reply bar with Tiptap */}
            <div style={{ flexShrink: 0, padding: "10px 16px 16px", borderTop: "1px solid #0d1a0d", background: "rgba(5,14,5,0.98)" }}>
              <div style={{ border: "1px solid #1a3a1a", borderRadius: 10, overflow: "hidden", background: "#0a160a" }}>
                <EditorToolbar editor={replyEditor} />
                <div className="tiptap-editor">
                  <EditorContent editor={replyEditor} />
                </div>
                {/* Reply attachments */}
                {replyAttachments.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 10px", borderTop: "1px solid #0d1a0d" }}>
                    {replyAttachments.map((att, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: "#0d1a0d", border: "1px solid #1a3a1a", fontSize: 11, color: "#8ab88a" }}>
                        {fileIcon(att.filename)} {att.filename} ({formatFileSize(att.size_bytes)})
                        <button onClick={() => setReplyAttachments(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#5a4a4a", padding: "2px !important" }}><IconX /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderTop: "1px solid #0d1a0d" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => replyFileInputRef.current?.click()}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}><IconAttach /></button>
                  </div>
                  <button onClick={sendReply} disabled={sending}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 18px !important", borderRadius: 20, border: "none", background: "#2E7D32", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
                    <IconSend />{sending ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


      {/* ═══ COMPOSE MODAL ═══ */}
      {composeOpen && (
        <div onClick={() => { saveDraft(); closeCompose(); }} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 12, width: 580, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 48px)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(76,175,80,0.06)", borderBottom: "1px solid #1a3a1a" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#e8f5e8" }}>
                {composeDraftId ? "Edit Draft" : "New Message"}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={saveDraft} title="Save draft" style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 12, cursor: "pointer", padding: "4px 8px !important" }}>Save</button>
                <button onClick={() => { saveDraft(); closeCompose(); }} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "4px !important" }}>{"\u00D7"}</button>
              </div>
            </div>

            {/* To field with suggestions */}
            <div style={{ padding: "8px 16px", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#5a8a5a", flexShrink: 0 }}>To</span>
                <input type="email" value={composeTo}
                  onChange={e => { setComposeTo(e.target.value); searchContacts(e.target.value); }}
                  onFocus={() => { if (toSuggestions.length) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  style={{ flex: 1, padding: "8px 0 !important", background: "transparent", border: "none", borderBottom: "1px solid #1a3a1a", color: "#e8f5e8", outline: "none" }} />
                <button onClick={() => setShowCc(!showCc)} style={{ background: "none", border: "none", color: "#3a5a3a", fontSize: 12, cursor: "pointer", padding: "4px !important" }}>
                  {showCc ? "Hide" : "Cc/Bcc"}
                </button>
              </div>
              {/* Suggestions dropdown */}
              {showSuggestions && toSuggestions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 16, right: 16, background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                  {toSuggestions.map(c => (
                    <div key={c.id} onClick={() => { setComposeTo(c.email); setShowSuggestions(false); }}
                      style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #0a160a", display: "flex", alignItems: "center", gap: 10 }}
                      onMouseOver={e => (e.currentTarget.style.background = "rgba(76,175,80,0.06)")}
                      onMouseOut={e => (e.currentTarget.style.background = "transparent")}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a2a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#5a8a5a" }}>{getInitials(c.name, c.email)}</div>
                      <div>
                        <div style={{ fontSize: 13, color: "#e8f5e8", fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "#5a8a5a" }}>{c.email}</div>
                      </div>
                      {c.category !== "other" && (
                        <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 8, background: `${categoryColors[c.category] || "#607D8B"}20`, color: categoryColors[c.category] || "#607D8B" }}>{c.category}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CC / BCC */}
            {showCc && (
              <>
                <div style={{ padding: "4px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#5a8a5a", flexShrink: 0 }}>Cc</span>
                  <input type="text" placeholder="Comma-separated emails" value={composeCc} onChange={e => setComposeCc(e.target.value)}
                    style={{ flex: 1, padding: "6px 0 !important", background: "transparent", border: "none", borderBottom: "1px solid #0d1a0d", color: "#e8f5e8", outline: "none" }} />
                </div>
                <div style={{ padding: "4px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#5a8a5a", flexShrink: 0 }}>Bcc</span>
                  <input type="text" placeholder="Comma-separated emails" value={composeBcc} onChange={e => setComposeBcc(e.target.value)}
                    style={{ flex: 1, padding: "6px 0 !important", background: "transparent", border: "none", borderBottom: "1px solid #0d1a0d", color: "#e8f5e8", outline: "none" }} />
                </div>
              </>
            )}

            {/* Subject */}
            <div style={{ padding: "8px 16px" }}>
              <input type="text" placeholder="Subject" value={composeSubject} onChange={e => setComposeSubject(e.target.value)}
                style={{ width: "100%", padding: "8px 0 !important", background: "transparent", border: "none", borderBottom: "1px solid #1a3a1a", color: "#e8f5e8", outline: "none" }} />
            </div>

            {/* Tiptap editor */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <EditorToolbar editor={composeEditor} />
              <div className="tiptap-editor" style={{ minHeight: 160 }}>
                <EditorContent editor={composeEditor} />
              </div>
            </div>

            {/* Attachments */}
            {composeAttachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 16px", borderTop: "1px solid #0d1a0d" }}>
                {composeAttachments.map((att, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#0a160a", border: "1px solid #1a3a1a", fontSize: 12, color: "#8ab88a" }}>
                    {fileIcon(att.filename)} {att.filename} ({formatFileSize(att.size_bytes)})
                    <button onClick={() => setComposeAttachments(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#5a4a4a", padding: "2px !important" }}><IconX /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid #1a3a1a" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => fileInputRef.current?.click()} disabled={composeUploading}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 50, border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}>
                  {composeUploading ? <span style={{ animation: "gmailSpin 1s linear infinite", display: "inline-block" }}><IconAttach /></span> : <IconAttach />}
                </button>
                <span style={{ fontSize: 11, color: "#3a5a3a" }}>Sends as info@jhpsfl.com</span>
              </div>
              <button onClick={sendCompose} disabled={composeSending || !composeTo.trim() || !composeSubject.trim()}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px !important", borderRadius: 8, border: "none", background: (composeTo && composeSubject) ? "#2E7D32" : "rgba(76,175,80,0.1)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: composeSending ? 0.6 : 1 }}>
                <IconSend />{composeSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ═══ CONTACTS PANEL ═══ */}
      {contactsOpen && (
        <div onClick={() => setContactsOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 8000, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 400, maxWidth: "100vw", background: "#0a160a", borderLeft: "1px solid #1a3a1a", display: "flex", flexDirection: "column", height: "100vh", boxShadow: "-8px 0 40px rgba(0,0,0,0.3)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #1a3a1a" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#e8f5e8" }}>Contacts</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setContactModal({ id: "", name: "", email: "", phone: null, company: null, category: "other", notes: null, starred: false } as EmailContact); setContactForm({ name: "", email: "", phone: "", company: "", category: "other", notes: "" }); }}
                  style={{ padding: "6px 14px !important", borderRadius: 8, border: "1px solid #1a3a1a", background: "rgba(76,175,80,0.1)", color: "#4CAF50", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ New</button>
                <button onClick={() => setContactsOpen(false)} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 20, cursor: "pointer", padding: "4px !important" }}>{"\u00D7"}</button>
              </div>
            </div>

            {/* Search + filter */}
            <div style={{ padding: "10px 16px", display: "flex", gap: 8 }}>
              <input type="text" placeholder="Search contacts..." value={contactSearch}
                onChange={e => { setContactSearch(e.target.value); fetchContacts(e.target.value); }}
                style={{ flex: 1, padding: "8px 12px !important", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
              <select value={contactFilter} onChange={e => setContactFilter(e.target.value)}
                style={{ padding: "8px 10px !important", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none", fontSize: 12 }}>
                <option value="all">All</option>
                <option value="customer">Customers</option>
                <option value="vendor">Vendors</option>
                <option value="supplier">Suppliers</option>
                <option value="contractor">Contractors</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Contact list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {contacts.filter(c => contactFilter === "all" || c.category === contactFilter).map(contact => (
                <div key={contact.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #0d1a0d", cursor: "pointer" }}
                  onClick={() => { setContactModal(contact); setContactForm({ name: contact.name, email: contact.email, phone: contact.phone || "", company: contact.company || "", category: contact.category, notes: contact.notes || "" }); }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${categoryColors[contact.category] || "#607D8B"}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: categoryColors[contact.category] || "#607D8B" }}>
                    {getInitials(contact.name, contact.email)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#e8f5e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contact.name}</div>
                    <div style={{ fontSize: 12, color: "#5a8a5a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contact.email}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: `${categoryColors[contact.category] || "#607D8B"}15`, color: categoryColors[contact.category] || "#607D8B", textTransform: "capitalize" }}>{contact.category}</span>
                </div>
              ))}
              {contacts.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#3a5a3a", fontSize: 13 }}>No contacts yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CONTACT EDIT MODAL ═══ */}
      {contactModal && (
        <div onClick={() => setContactModal(null)} style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 12, width: 420, maxWidth: "calc(100vw - 32px)", padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#e8f5e8" }}>
              {contactModal.id ? "Edit Contact" : "New Contact"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="text" placeholder="Name *" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                style={{ padding: "10px 14px !important", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
              <input type="email" placeholder="Email *" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                style={{ padding: "10px 14px !important", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
              <input type="tel" placeholder="Phone" value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))}
                style={{ padding: "10px 14px !important", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
              <input type="text" placeholder="Company" value={contactForm.company} onChange={e => setContactForm(p => ({ ...p, company: e.target.value }))}
                style={{ padding: "10px 14px !important", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
              <select value={contactForm.category} onChange={e => setContactForm(p => ({ ...p, category: e.target.value }))}
                style={{ padding: "10px 14px !important", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }}>
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
                <option value="supplier">Supplier</option>
                <option value="contractor">Contractor</option>
                <option value="other">Other</option>
              </select>
              <textarea placeholder="Notes" value={contactForm.notes} onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                style={{ padding: "10px 14px !important", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none", resize: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}>
              <div>
                {contactModal.id && (
                  <button onClick={() => { deleteContact(contactModal.id); setContactModal(null); }}
                    style={{ padding: "8px 16px !important", borderRadius: 8, border: "1px solid rgba(239,83,80,0.3)", background: "rgba(239,83,80,0.08)", color: "#ef5350", fontSize: 13, cursor: "pointer" }}>Delete</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setContactModal(null)}
                  style={{ padding: "8px 16px !important", borderRadius: 8, border: "1px solid #1a3a1a", background: "transparent", color: "#5a8a5a", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                <button onClick={saveContact} disabled={contactSaving || !contactForm.name || !contactForm.email}
                  style={{ padding: "8px 20px !important", borderRadius: 8, border: "none", background: "#2E7D32", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: contactSaving ? 0.6 : 1 }}>
                  {contactSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>{/* end main content */}
    </div>
  );
}
