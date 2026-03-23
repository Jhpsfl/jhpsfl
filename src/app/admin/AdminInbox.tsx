"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";

// ── Types ──
interface Thread {
  thread_id: string; subject: string; to_email: string; from_email: string;
  latest_message: string; latest_body_preview: string; latest_direction: string;
  message_count: number; unread_count: number; starred: boolean;
  has_attachments: boolean; lead_id: string | null; created_at: string;
  customer_name?: string;
}
interface Message {
  id: string; thread_id: string; direction: string; from_email: string;
  to_email: string; subject: string; body_html: string | null;
  body_text: string | null; read: boolean; starred: boolean;
  folder: string; created_at: string; cc_emails: string[]; bcc_emails: string[];
  has_attachments: boolean; is_draft: boolean; resend_message_id: string | null;
  attachments: { id: string; filename: string; content_type: string; size_bytes: number; s3_key: string; s3_url: string }[];
}
interface LeadInfo {
  id: string; name: string; email: string; phone: string; address: string; city: string | null; state: string | null;
}
interface EmailAccount { id?: string; email: string; display_name: string; color: string; initials: string; is_default?: boolean; }
interface EmailContact {
  id: string; name: string; email: string; phone: string | null; company: string | null;
  category: string; notes: string | null; starred: boolean;
}
interface PendingAttachment {
  filename: string; content_type: string; size_bytes: number; s3_key: string; s3_url: string;
}

type Folder = "inbox" | "sent" | "drafts" | "starred" | "trash" | "spam" | "yelp";
type ComposeMode = "new" | "reply" | "forward" | null;
type View = "list" | "thread" | "compose" | "accounts";

const FOLDERS: { key: Folder; label: string; icon: string }[] = [
  { key: "inbox", label: "Inbox", icon: "\u2709" },
  { key: "starred", label: "Starred", icon: "\u2B50" },
  { key: "sent", label: "Sent", icon: "\uD83D\uDCE8" },
  { key: "yelp", label: "Yelp", icon: "\uD83D\uDFE1" },
  { key: "drafts", label: "Drafts", icon: "\uD83D\uDCDD" },
  { key: "trash", label: "Trash", icon: "\uD83D\uDDD1" },
  { key: "spam", label: "Spam", icon: "\u26A0" },
];

function getInitials(name: string | undefined, email: string): string {
  if (name) return name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
  return email.split("@")[0].substring(0, 2).toUpperCase();
}
function avatarColor(email: string): string {
  const colors = ["#2E7D32", "#4CAF50", "#3b8dd4", "#22C55E", "#EC4899", "#8B5CF6", "#EF4444", "#06B6D4", "#66BB6A", "#43A047"];
  let h = 0; for (let i = 0; i < email.length; i++) h = email.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days}d`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function shortTime(d: string) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function htmlToText(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<\/div>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/\n{3,}/g, "\n\n").trim();
}
function fileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "\uD83D\uDDBC";
  if (["pdf"].includes(ext)) return "\uD83D\uDCC4";
  if (["doc", "docx"].includes(ext)) return "\uD83D\uDCDD";
  if (["xls", "xlsx", "csv"].includes(ext)) return "\uD83D\uDCCA";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "\uD83D\uDCE6";
  return "\uD83D\uDCCE";
}

// ── SVG Icons ──
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
const IconForward = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 17 20 12 15 7" /><path d="M4 18v-2a4 4 0 0 1 4-4h12" />
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
const IconMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a8a5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const IconMoreVertical = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
  </svg>
);
const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);
const IconChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ── Tiptap Toolbar ──
function EditorToolbar({ editor }: { editor: any }) {
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
      }, "\uD83D\uDD17 Link")}
    </div>
  );
}

// ── Attachment Preview ──
function AttachmentPreview({ attachments }: { attachments: Message["attachments"] }) {
  const [previewAtt, setPreviewAtt] = useState<Message["attachments"][0] | null>(null);

  function isPreviewable(ct: string) {
    return ct.startsWith("image/") || ct === "application/pdf";
  }

  return (
    <>
      <div style={{ marginTop: 16, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <IconAttach />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
            {attachments.length} attachment{attachments.length > 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "grid", gap: 0 }}>
          {attachments.map(att => (
            <div key={att.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              {att.content_type.startsWith("image/") ? (
                <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", background: "rgba(255,255,255,0.05)", flexShrink: 0, cursor: "pointer" }}
                  onClick={() => setPreviewAtt(att)}>
                  <img src={att.s3_url} alt={att.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>
                  {fileIcon(att.filename)}
                </div>
              )}
              <div style={{ minWidth: 0, flex: "1 1 0", maxWidth: "calc(100% - 120px)" }}>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{att.filename}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>{formatFileSize(att.size_bytes)}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0, marginLeft: "auto" }}>
                {isPreviewable(att.content_type) && (
                  <button onClick={() => setPreviewAtt(att)}
                    style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}
                    title="Preview">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                )}
                <a href={att.s3_url} download={att.filename} target="_blank" rel="noopener noreferrer"
                  style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>
                  <IconDownload />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {previewAtt && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.9)", display: "flex", flexDirection: "column" }}
          onClick={() => setPreviewAtt(null)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(0,0,0,0.5)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <span style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewAtt.filename}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{formatFileSize(previewAtt.size_bytes)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <a href={previewAtt.s3_url} download={previewAtt.filename} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: 13 }}
                onClick={e => e.stopPropagation()}>
                <IconDownload /> Download
              </a>
              <button onClick={() => setPreviewAtt(null)}
                style={{ padding: 8, borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", marginLeft: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 16 }}
            onClick={e => e.stopPropagation()}>
            {previewAtt.content_type.startsWith("image/") ? (
              <img src={previewAtt.s3_url} alt={previewAtt.filename} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
            ) : previewAtt.content_type === "application/pdf" ? (
              <iframe src={previewAtt.s3_url} title={previewAtt.filename} style={{ width: "100%", height: "100%", borderRadius: 8, background: "#fff", maxWidth: 900, border: "none" }} />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function AdminInbox({ userId, backRef, onNavigate }: { userId: string; backRef?: React.MutableRefObject<(() => boolean) | null>; onNavigate?: () => void }) {
  // ── Device detection ──
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── State ──
  const [view, setView] = useState<View>("list");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [search, setSearch] = useState("");

  const [composeMode, setComposeMode] = useState<ComposeMode>(null);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [composeAttachments, setComposeAttachments] = useState<PendingAttachment[]>([]);
  const [composeUploading, setComposeUploading] = useState(false);
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<EmailAccount | null>(null);
  const [fromAccount, setFromAccount] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Multi-select ──
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const longPressTriggered = useRef(false);

  // ── Dropdown menus ──
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [msgMenuOpenId, setMsgMenuOpenId] = useState<string | null>(null);
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);
  const [collapsedMsgs, setCollapsedMsgs] = useState<Set<string>>(new Set());
  const threadMenuRef = useRef<HTMLDivElement>(null);
  const msgMenuRef = useRef<HTMLDivElement>(null);

  // ── Contacts ──
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactFilter, setContactFilter] = useState("all");
  const [contactModal, setContactModal] = useState<EmailContact | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", company: "", category: "other", notes: "" });
  const [contactSaving, setContactSaving] = useState(false);
  const [toSuggestions, setToSuggestions] = useState<EmailContact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ── Reply ──
  const [replyAttachments, setReplyAttachments] = useState<PendingAttachment[]>([]);

  // ── Refs ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const persistInitialized = useRef(false);

  // ── Editors ──
  const editor = useEditor({
    extensions: [
      StarterKit, Underline, Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Compose email..." }),
      TextStyle, Color,
    ],
    editorProps: {
      attributes: { style: "min-height:200px;outline:none;color:#e8f5e8;font-size:15px;line-height:1.6;padding:12px 16px;" },
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

  // ── localStorage persistence ──
  useEffect(() => {
    if (persistInitialized.current) return;
    try {
      const saved = localStorage.getItem("jhps_inbox_state_" + userId);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.folder && FOLDERS.some(f => f.key === parsed.folder)) setFolder(parsed.folder);
        if (parsed.accountEmail) (window as any).__jhps_inbox_saved_account = parsed.accountEmail;
      }
    } catch { /* ignore */ }
    persistInitialized.current = true;
  }, [userId]);

  useEffect(() => {
    if (!persistInitialized.current) return;
    try {
      localStorage.setItem("jhps_inbox_state_" + userId, JSON.stringify({
        accountEmail: activeAccount?.email || null, folder,
      }));
    } catch { /* ignore */ }
  }, [userId, activeAccount, folder]);

  // ── Close menus on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (threadMenuOpen && threadMenuRef.current && !threadMenuRef.current.contains(e.target as Node)) setThreadMenuOpen(false);
      if (msgMenuOpenId && msgMenuRef.current && !msgMenuRef.current.contains(e.target as Node)) setMsgMenuOpenId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [threadMenuOpen, msgMenuOpenId]);

  // ── Back button integration ──
  const closeThread = useCallback(() => {
    setSelectedThread(null);
    setMessages([]);
    setLeadInfo(null);
    setReplyAttachments([]);
    setCollapsedMsgs(new Set());
    setThreadMenuOpen(false);
    replyEditor?.commands.clearContent();
    setView("list");
  }, [replyEditor]);

  const closeCompose = useCallback(() => {
    setComposeMode(null);
    setComposeTo("");
    setComposeSubject("");
    editor?.commands.clearContent();
    setComposeAttachments([]);
    setComposeDraftId(null);
    setShowCcBcc(false);
    setComposeCc("");
    setComposeBcc("");
    setShowSuggestions(false);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
  }, [editor]);

  useEffect(() => {
    if (!backRef) return;
    backRef.current = () => {
      if (contactsOpen) { setContactsOpen(false); return true; }
      if (view === "compose") { closeCompose(); setView(selectedThread ? "thread" : "list"); return true; }
      if (view === "thread") { closeThread(); return true; }
      if (view === "accounts") { setView("list"); return true; }
      return false;
    };
  }, [backRef, contactsOpen, view, selectedThread, closeCompose, closeThread]);

  // ── Fetch accounts ──
  const fetchAccounts = async () => {
    const res = await fetch("/api/admin/email-accounts");
    if (!res.ok) return;
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.accounts || []);
    if (list.length) {
      setAccounts(list);
      if (!activeAccount) {
        const savedEmail = (window as any).__jhps_inbox_saved_account || localStorage.getItem("jhps_inbox_account");
        if (savedEmail) {
          const saved = list.find((a: EmailAccount) => a.email === savedEmail);
          if (saved) { setActiveAccount(saved); setFromAccount(saved.email); return; }
        }
        const def = list.find((a: EmailAccount) => a.is_default) || list[0];
        setActiveAccount(def);
        setFromAccount(def.email);
      }
    }
  };
  useEffect(() => { fetchAccounts(); }, []);

  // ── Fetch threads ──
  const fetchThreads = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const params = new URLSearchParams({ folder });
    if (activeAccount) params.set("account", activeAccount.email);
    const res = await fetch(`/api/email/threads?${params}`);
    if (res.ok) {
      const data = await res.json();
      setThreads(data.threads || []);
      setFolderCounts(data.folderCounts || {});
    }
    setLoading(false);
  }, [folder, activeAccount]);
  useEffect(() => { fetchThreads(); setSelectedIds(new Set()); }, [fetchThreads]);

  // ── Open thread ──
  const openThread = async (thread: Thread) => {
    setSelectedThread(thread);
    setView("thread");
    setLoadingThread(true);
    const res = await fetch(`/api/email/threads/${thread.thread_id}`);
    if (res.ok) {
      const data = await res.json();
      const msgs: Message[] = data.messages || [];
      setMessages(msgs);
      setLeadInfo(data.lead || null);
      onNavigate?.();
      replyEditor?.commands.clearContent();
      setReplyAttachments([]);
      if (msgs.length > 1) {
        setCollapsedMsgs(new Set(msgs.slice(0, -1).map(m => m.id)));
      } else {
        setCollapsedMsgs(new Set());
      }
    }
    setLoadingThread(false);
    setThreads(prev => prev.map(t => t.thread_id === thread.thread_id ? { ...t, unread_count: 0 } : t));
  };

  // ── Open draft for editing ──
  const openDraft = (thread: Thread) => {
    fetch(`/api/email/threads/${thread.thread_id}`)
      .then(r => r.json())
      .then(data => {
        const draft = (data.messages || [])[0];
        if (draft) {
          setComposeTo(draft.to_email || "");
          setComposeSubject(draft.subject || "");
          editor?.commands.setContent(draft.body_html || draft.body_text || "");
          setComposeDraftId(draft.id);
          setComposeMode("new");
          setView("compose");
          onNavigate?.();
        }
      });
  };

  // ── Thread actions ──
  const threadAction = async (action: string, threadIds?: string[]) => {
    const ids = threadIds || (selectedThread ? [selectedThread.thread_id] : []);
    if (!ids.length) return;
    await fetch("/api/email/threads", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_ids: ids, action }),
    });
    const toastMap: Record<string, string> = {
      trash: "Moved to trash", star: "Starred", unstar: "Unstarred",
      mark_unread: "Marked as unread", spam: "Moved to spam", mark_read: "Marked as read",
      restore: "Restored from trash",
    };
    showToast(toastMap[action] || "Updated");
    if ((action === "trash" || action === "mark_unread") && view === "thread") closeThread();
    fetchThreads(true);
  };

  const permanentDelete = async (threadIds: string[]) => {
    await fetch("/api/email/threads", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_ids: threadIds, permanent: true }),
    });
    if (selectedThread && threadIds.includes(selectedThread.thread_id)) closeThread();
    setSelectedIds(new Set());
    showToast("Permanently deleted");
    fetchThreads(true);
  };

  const toggleStar = async (threadId: string, currentStarred: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setThreads(prev => prev.map(t => t.thread_id === threadId ? { ...t, starred: !currentStarred } : t));
    await threadAction(currentStarred ? "unstar" : "star", [threadId]);
  };

  // ── Multi-select helpers ──
  const enterSelectMode = (threadId: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([threadId]));
  };

  const toggleSelect = (threadId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId); else next.add(threadId);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const batchAction = async (action: string) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    await threadAction(action, ids);
    exitSelectMode();
  };

  // ── Long press ──
  const handlePointerDown = (threadId: string) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      enterSelectMode(threadId);
    }, 500);
  };
  const handlePointerUp = () => { clearTimeout(longPressTimer.current); };
  const handlePointerCancel = () => { clearTimeout(longPressTimer.current); };

  const handleThreadClick = (thread: Thread) => {
    if (longPressTriggered.current) { longPressTriggered.current = false; return; }
    if (selectMode) { toggleSelect(thread.thread_id); }
    else if (folder === "drafts") { openDraft(thread); }
    else { openThread(thread); }
  };

  // ── Compose ──
  const startCompose = (mode: ComposeMode, replyMsg?: Message) => {
    setComposeMode(mode);
    setFromAccount(activeAccount?.email || accounts[0]?.email || "");
    if (mode === "new") {
      setComposeTo(""); setComposeSubject("");
      editor?.commands.setContent("");
    } else if (mode === "reply" && replyMsg) {
      setComposeTo(replyMsg.direction === "inbound" ? replyMsg.from_email : replyMsg.to_email);
      setComposeSubject(replyMsg.subject.startsWith("Re:") ? replyMsg.subject : `Re: ${replyMsg.subject}`);
      editor?.commands.setContent("");
    } else if (mode === "forward" && replyMsg) {
      setComposeTo("");
      setComposeSubject(`Fwd: ${replyMsg.subject.replace(/^Fwd:\s*/i, "")}`);
      const fwdBody = `<br><br><p style="color:#888">---------- Forwarded message ----------</p><p style="color:#888">From: ${replyMsg.from_email}<br>Date: ${new Date(replyMsg.created_at).toLocaleString()}<br>Subject: ${replyMsg.subject}</p><br>${replyMsg.body_html || replyMsg.body_text || ""}`;
      editor?.commands.setContent(fwdBody);
      const fwdAtts: PendingAttachment[] = (replyMsg.attachments || []).map(a => ({ filename: a.filename, content_type: a.content_type, size_bytes: a.size_bytes, s3_key: a.s3_key, s3_url: a.s3_url }));
      setComposeAttachments(fwdAtts);
    }
    setShowCcBcc(false); setComposeCc(""); setComposeBcc("");
    setView("compose");
    onNavigate?.();
  };

  const handleSend = async () => {
    if (!composeTo || !composeSubject) return;
    setSending(true);
    const html = editor?.getHTML() || "";
    const text = editor?.getText() || "";
    const isReply = composeMode === "reply" && selectedThread;
    const endpoint = isReply ? "/api/email/reply" : "/api/email/compose";
    const payload = isReply
      ? { thread_id: selectedThread!.thread_id, to_email: composeTo, subject: composeSubject, reply_html: html, reply_body: text, from_email: fromAccount, attachments: composeAttachments.length ? composeAttachments : undefined }
      : { to_email: composeTo, subject: composeSubject, body_html: html, body: text, from_email: fromAccount, cc_emails: composeCc ? composeCc.split(",").map(e => e.trim()) : [], bcc_emails: composeBcc ? composeBcc.split(",").map(e => e.trim()) : [], draft_id: composeDraftId, attachments: composeAttachments.length ? composeAttachments : undefined };
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSending(false);
    if (res.ok) {
      showToast("Email sent");
      closeCompose();
      setView("list");
      fetchThreads(true);
    } else { showToast("Failed to send", "error"); }
  };

  // ── Reply send ──
  const sendReply = async () => {
    const html = replyEditor?.getHTML() || "";
    const text = replyEditor?.getText() || "";
    if ((!text.trim() && (!html || html === "<p></p>")) || !selectedThread) return;
    setSending(true);
    const res = await fetch("/api/email/reply", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thread_id: selectedThread.thread_id, to_email: selectedThread.to_email,
        subject: selectedThread.subject, reply_html: html, reply_body: text,
        from_email: fromAccount || activeAccount?.email,
        attachments: replyAttachments.length ? replyAttachments : undefined,
      }),
    });
    if (res.ok) {
      showToast("Reply sent!");
      replyEditor?.commands.clearContent();
      setReplyAttachments([]);
      openThread(selectedThread);
      fetchThreads(true);
    } else { showToast("Failed to send reply", "error"); }
    setSending(false);
  };

  // ── Draft auto-save ──
  const saveDraft = useCallback(async () => {
    if (view !== "compose") return;
    const html = editor?.getHTML() || "";
    const res = await fetch("/api/email/drafts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerk_user_id: userId, draft_id: composeDraftId,
        to_email: composeTo, subject: composeSubject || "(no subject)",
        body_html: html, body_text: editor?.getText() || "",
        cc_emails: composeCc.split(",").map(e => e.trim()).filter(Boolean),
        bcc_emails: composeBcc.split(",").map(e => e.trim()).filter(Boolean),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.draft?.id && !composeDraftId) setComposeDraftId(data.draft.id);
    }
  }, [view, composeTo, composeSubject, composeCc, composeBcc, composeDraftId, userId, editor]);

  useEffect(() => {
    if (view !== "compose") return;
    draftTimerRef.current = setInterval(() => { saveDraft(); }, 30000);
    return () => { if (draftTimerRef.current) clearInterval(draftTimerRef.current); };
  }, [view, saveDraft]);

  // ── File upload ──
  const uploadFile = async (file: File, target: "compose" | "reply") => {
    if (file.size > 10 * 1024 * 1024) { showToast("File too large (max 10MB)", "error"); return; }
    if (target === "compose") setComposeUploading(true);
    const formData = new FormData();
    formData.append("clerk_user_id", userId);
    formData.append("file", file);
    const res = await fetch("/api/email/attachments", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      if (target === "compose") setComposeAttachments(prev => [...prev, data.attachment]);
      else setReplyAttachments(prev => [...prev, data.attachment]);
    } else { showToast("Upload failed", "error"); }
    if (target === "compose") setComposeUploading(false);
  };

  // ── Contacts ──
  const fetchContacts = useCallback(async (q?: string) => {
    const params = new URLSearchParams({ clerk_user_id: userId });
    if (q) params.set("q", q);
    const res = await fetch(`/api/email/contacts?${params}`);
    if (res.ok) { const data = await res.json(); setContacts(data.contacts || []); }
  }, [userId]);

  useEffect(() => { if (contactsOpen) fetchContacts(); }, [contactsOpen, fetchContacts]);

  const saveContact = async () => {
    setContactSaving(true);
    const res = await fetch("/api/email/contacts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerk_user_id: userId, action: contactModal?.id ? "update" : "create", contact: { ...contactForm, id: contactModal?.id } }),
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

  const searchContacts = async (q: string) => {
    if (q.length < 2) { setToSuggestions([]); setShowSuggestions(false); return; }
    const res = await fetch(`/api/email/contacts?clerk_user_id=${userId}&q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      setToSuggestions(data.contacts || []);
      setShowSuggestions((data.contacts || []).length > 0);
    }
  };

  const categoryColors: Record<string, string> = {
    vendor: "#2196F3", customer: "#4CAF50", supplier: "#FF9800", contractor: "#9C27B0", other: "#607D8B",
  };

  // ── Scroll to top on message load ──
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => { messagesContainerRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); });
    }
  }, [messages]);

  const filtered = threads.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (t.customer_name || "").toLowerCase().includes(s) || t.subject.toLowerCase().includes(s) || t.to_email.toLowerCase().includes(s) || t.from_email.toLowerCase().includes(s) || t.latest_body_preview.toLowerCase().includes(s);
  });

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0;

  // ═══════════════════════════════════════════
  // ACCOUNTS — Full screen (mobile only)
  // ═══════════════════════════════════════════
  if (view === "accounts" && !isDesktop) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "#050e05", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #1a3a1a" }}>
          {activeAccount && (
            <>
              <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, backgroundColor: activeAccount.color + "25", color: activeAccount.color }}>
                {activeAccount.initials}
              </div>
              <span style={{ flex: 1, fontSize: 15, color: "#e8f5e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeAccount.email}</span>
            </>
          )}
          <button onClick={() => setView("list")} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: "#e8f5e8" }}>Switch account</span>
          </div>
          <button onClick={() => { setActiveAccount(null); localStorage.removeItem("jhps_inbox_account"); setView("list"); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderTop: "1px solid rgba(26,58,26,0.4)", background: !activeAccount ? "rgba(76,175,80,0.05)" : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1a2a1a", border: "1px solid #1a3a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconMail />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#e8f5e8", margin: 0 }}>All Accounts</p>
              <p style={{ fontSize: 14, color: "#5a8a5a", margin: 0 }}>View all inboxes</p>
            </div>
          </button>
          {accounts.map(account => (
            <button key={account.email} onClick={() => { setActiveAccount(account); setFromAccount(account.email); localStorage.setItem("jhps_inbox_account", account.email); setView("list"); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderTop: "1px solid rgba(26,58,26,0.4)", background: activeAccount?.email === account.email ? "rgba(76,175,80,0.05)" : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, flexShrink: 0, backgroundColor: account.color + "25", color: account.color }}>
                {account.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#e8f5e8", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.display_name}</p>
                <p style={{ fontSize: 14, color: "#5a8a5a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.email}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // COMPOSE — Full screen (mobile only)
  // ═══════════════════════════════════════════
  if (view === "compose" && !isDesktop) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "#050e05", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid #1a3a1a" }}>
          <button onClick={() => { saveDraft(); closeCompose(); setView(selectedThread ? "thread" : "list"); }}
            style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <h2 style={{ fontWeight: 600, fontSize: 17, color: "#e8f5e8", flex: 1, margin: 0 }}>
            {composeMode === "new" ? "Compose" : composeMode === "reply" ? "Reply" : "Forward"}
          </h2>
          <button onClick={handleSend} disabled={sending || !composeTo || !composeSubject}
            style={{ padding: "8px 24px", background: "#2E7D32", color: "#fff", fontWeight: 700, fontSize: 15, borderRadius: 20, border: "none", cursor: "pointer", opacity: (sending || !composeTo || !composeSubject) ? 0.4 : 1 }}>
            {sending ? "..." : "Send"}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {accounts.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #1a3a1a" }}>
              <span style={{ color: "#5a8a5a", fontSize: 15, width: 64 }}>From</span>
              <select value={fromAccount} onChange={e => setFromAccount(e.target.value)}
                style={{ flex: 1, background: "transparent", fontSize: 15, color: "#e8f5e8", border: "none", outline: "none" }}>
                {accounts.map(a => <option key={a.email} value={a.email}>{a.display_name} &lt;{a.email}&gt;</option>)}
              </select>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #1a3a1a" }}>
            <span style={{ color: "#5a8a5a", fontSize: 15, width: 64 }}>To</span>
            <input type="email" value={composeTo} onChange={e => { setComposeTo(e.target.value); searchContacts(e.target.value); }} placeholder="Recipient"
              style={{ flex: 1, background: "transparent", fontSize: 15, color: "#e8f5e8", border: "none", outline: "none" }} />
            {!showCcBcc && <button onClick={() => setShowCcBcc(true)} style={{ fontSize: 13, color: "#3a5a3a", background: "none", border: "none", cursor: "pointer", padding: "0 8px" }}>Cc/Bcc</button>}
          </div>
          {showSuggestions && toSuggestions.length > 0 && (
            <div style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 8, margin: "0 20px", maxHeight: 160, overflowY: "auto", zIndex: 10 }}>
              {toSuggestions.map(c => (
                <div key={c.id} onClick={() => { setComposeTo(c.email); setShowSuggestions(false); }}
                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #0a160a", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "#e8f5e8", fontWeight: 600 }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: "#5a8a5a" }}>{c.email}</span>
                </div>
              ))}
            </div>
          )}
          {showCcBcc && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #1a3a1a" }}>
                <span style={{ color: "#5a8a5a", fontSize: 15, width: 64 }}>Cc</span>
                <input type="text" value={composeCc} onChange={e => setComposeCc(e.target.value)}
                  style={{ flex: 1, background: "transparent", fontSize: 15, color: "#e8f5e8", border: "none", outline: "none" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #1a3a1a" }}>
                <span style={{ color: "#5a8a5a", fontSize: 15, width: 64 }}>Bcc</span>
                <input type="text" value={composeBcc} onChange={e => setComposeBcc(e.target.value)}
                  style={{ flex: 1, background: "transparent", fontSize: 15, color: "#e8f5e8", border: "none", outline: "none" }} />
              </div>
            </>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #1a3a1a" }}>
            <span style={{ color: "#5a8a5a", fontSize: 15, width: 64 }}>Subject</span>
            <input type="text" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject"
              style={{ flex: 1, background: "transparent", fontSize: 15, color: "#e8f5e8", border: "none", outline: "none" }} />
          </div>
          <EditorToolbar editor={editor} />
          <div className="tiptap-editor">
            <EditorContent editor={editor} />
          </div>
          {composeAttachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 16px", borderTop: "1px solid #0d1a0d" }}>
              {composeAttachments.map((att, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#0a160a", border: "1px solid #1a3a1a", fontSize: 12, color: "#8ab88a" }}>
                  {fileIcon(att.filename)} {att.filename} ({formatFileSize(att.size_bytes)})
                  <button onClick={() => setComposeAttachments(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#5a4a4a", padding: 2 }}><IconX /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: "8px 16px", borderTop: "1px solid #1a3a1a", display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => fileInputRef.current?.click()} disabled={composeUploading}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", color: "#5a8a5a", border: "none", cursor: "pointer", fontSize: 13 }}>
              {composeUploading ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}><IconAttach /></span> : <IconAttach />}
              Attach file
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // THREAD VIEW — Full screen (mobile only)
  // ═══════════════════════════════════════════
  if (view === "thread" && selectedThread && !isDesktop) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "#050e05", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 4px", borderBottom: "1px solid #1a3a1a" }}>
          <button onClick={closeThread} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#8ab88a", cursor: "pointer" }}>
            <IconBack />
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => threadAction("trash")} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}><IconTrash /></button>
          <button onClick={() => threadAction(selectedThread.starred ? "unstar" : "star")} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer" }}>
            <IconStar filled={selectedThread.starred} />
          </button>
          <div style={{ position: "relative" }} ref={threadMenuRef}>
            <button onClick={() => setThreadMenuOpen(!threadMenuOpen)} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}>
              <IconMoreVertical />
            </button>
            {threadMenuOpen && (
              <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, width: 208, background: "#1a2a1a", border: "1px solid #1a3a1a", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.4)", zIndex: 50, overflow: "hidden" }}>
                <button onClick={() => { setThreadMenuOpen(false); threadAction("mark_unread"); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", fontSize: 15, color: "#c8e0c8", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                  <IconEyeOff /> Mark as unread
                </button>
                <button onClick={() => { setThreadMenuOpen(false); threadAction("spam"); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", fontSize: 15, color: "#c8e0c8", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 16 }}>{"\u26A0"}</span> Move to spam
                </button>
                <button onClick={() => { setThreadMenuOpen(false); threadAction("trash"); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", fontSize: 15, color: "#c8e0c8", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                  <IconTrash /> Move to trash
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "16px 20px 12px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <h1 style={{ flex: 1, fontSize: 22, fontWeight: 700, color: "#e8f5e8", lineHeight: 1.3, margin: 0 }}>{selectedThread.subject}</h1>
          </div>
          <span style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 600, color: "#5a8a5a", background: "rgba(255,255,255,0.05)", border: "1px solid #1a3a1a", borderRadius: 4, padding: "2px 10px" }}>
            {folder.charAt(0).toUpperCase() + folder.slice(1)}
          </span>
        </div>

        <div ref={messagesContainerRef} style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
          {loadingThread ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "64px 0", color: "#4CAF50" }}>Loading...</div>
          ) : messages.map(msg => {
            const isOutbound = msg.direction === "outbound";
            const senderName = isOutbound ? "JHPS" : (selectedThread.customer_name || msg.from_email.split("@")[0]);
            const initials = isOutbound ? "JP" : getInitials(selectedThread.customer_name, msg.from_email);
            const isCollapsed = collapsedMsgs.has(msg.id);
            const bodyText = msg.body_text || (msg.body_html ? htmlToText(msg.body_html) : "\u2014");

            if (isCollapsed) {
              return (
                <div key={msg.id} onClick={() => setCollapsedMsgs(prev => { const n = new Set(prev); n.delete(msg.id); return n; })}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#0d1a0d", margin: "4px 0", borderRadius: 8, cursor: "pointer" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: isOutbound ? "#1a3a2a" : "#1a2a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isOutbound ? "#4CAF50" : "#6a8a6a" }}>{initials}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#a0b8a0", flexShrink: 0 }}>{senderName}</div>
                  <div style={{ flex: 1, fontSize: 12, color: "#4a6a4a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bodyText.substring(0, 80)}</div>
                  <div style={{ fontSize: 11, color: "#3a5a3a", flexShrink: 0 }}>{shortTime(msg.created_at)}</div>
                </div>
              );
            }

            return (
              <div key={msg.id} style={{ background: "#0a140a", borderRadius: 16, padding: 20, marginBottom: 12, border: "1px solid #1a2a1a" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, flexShrink: 0, background: isOutbound ? "linear-gradient(135deg, #2E7D32, #1a4a1a)" : avatarColor(msg.from_email) + "30", color: isOutbound ? "#4CAF50" : avatarColor(msg.from_email) }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: "#e8f5e8" }}>{senderName}</span>
                      <span style={{ fontSize: 13, color: "#4a6a4a" }}>{shortTime(msg.created_at)}</span>
                    </div>
                    <button onClick={() => setExpandedMsgId(expandedMsgId === msg.id ? null : msg.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#4a6a4a", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      to {isOutbound ? (selectedThread.customer_name || msg.to_email) : "me"}
                      <IconChevronDown />
                    </button>
                    {expandedMsgId === msg.id && (
                      <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}><span style={{ color: "#4a6a4a", width: 48, flexShrink: 0 }}>From</span><span style={{ color: "#8ab88a" }}>{msg.from_email}</span></div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}><span style={{ color: "#4a6a4a", width: 48, flexShrink: 0 }}>To</span><span style={{ color: "#8ab88a" }}>{msg.to_email}</span></div>
                        {msg.cc_emails?.length > 0 && <div style={{ display: "flex", gap: 8, marginBottom: 6 }}><span style={{ color: "#4a6a4a", width: 48, flexShrink: 0 }}>CC</span><span style={{ color: "#8ab88a" }}>{msg.cc_emails.join(", ")}</span></div>}
                        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}><span style={{ color: "#4a6a4a", width: 48, flexShrink: 0 }}>Date</span><span style={{ color: "#8ab88a" }}>{formatDate(msg.created_at)}</span></div>
                        <div style={{ display: "flex", gap: 8 }}><span style={{ color: "#4a6a4a", width: 48, flexShrink: 0 }}>Subject</span><span style={{ color: "#8ab88a" }}>{msg.subject}</span></div>
                      </div>
                    )}
                  </div>
                  <button onClick={() => startCompose("reply", msg)} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}><IconReply /></button>
                  <div style={{ position: "relative" }} ref={msgMenuOpenId === msg.id ? msgMenuRef : undefined}>
                    <button onClick={() => setMsgMenuOpenId(msgMenuOpenId === msg.id ? null : msg.id)} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}>
                      <IconMoreVertical />
                    </button>
                    {msgMenuOpenId === msg.id && (
                      <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, width: 192, background: "#1a2a1a", border: "1px solid #1a3a1a", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.4)", zIndex: 50, overflow: "hidden" }}>
                        <button onClick={() => { setMsgMenuOpenId(null); startCompose("reply", msg); }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", fontSize: 15, color: "#c8e0c8", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                          <IconReply /> Reply
                        </button>
                        <button onClick={() => { setMsgMenuOpenId(null); startCompose("forward", msg); }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", fontSize: 15, color: "#c8e0c8", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                          <IconForward /> Forward
                        </button>
                        <button onClick={() => { setMsgMenuOpenId(null); threadAction("mark_unread"); }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", fontSize: 15, color: "#c8e0c8", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                          <IconEyeOff /> Mark as unread
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {msg.body_html ? (
                  <iframe
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;font-family:-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#c8dcc8;background:#0a160a;overflow-wrap:break-word;word-break:break-word;}img{max-width:100%;height:auto;}a{color:#4CAF50;}*{max-width:100%!important;box-sizing:border-box!important;}</style></head><body>${msg.body_html}</body></html>`}
                    sandbox="allow-same-origin"
                    style={{ width: "100%", minHeight: 120, border: "1px solid #1a3a1a", borderRadius: 8, background: "#0a160a" }}
                    onLoad={e => {
                      const iframe = e.target as HTMLIFrameElement;
                      if (iframe.contentDocument?.body) iframe.style.height = Math.max(120, iframe.contentDocument.body.scrollHeight + 20) + "px";
                    }}
                  />
                ) : (
                  <pre style={{ fontSize: 15, color: "#c8dcc8", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6, margin: 0 }}>{bodyText}</pre>
                )}
                {msg.attachments?.length > 0 && <AttachmentPreview attachments={msg.attachments} />}
              </div>
            );
          })}
        </div>

        {/* Reply bar */}
        <div style={{ flexShrink: 0, padding: "10px 16px 16px", borderTop: "1px solid #0d1a0d", background: "rgba(5,14,5,0.98)" }}>
          <div style={{ border: "1px solid #1a3a1a", borderRadius: 10, overflow: "hidden", background: "#0a160a" }}>
            <EditorToolbar editor={replyEditor} />
            <div className="tiptap-editor"><EditorContent editor={replyEditor} /></div>
            {replyAttachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 10px", borderTop: "1px solid #0d1a0d" }}>
                {replyAttachments.map((att, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: "#0d1a0d", border: "1px solid #1a3a1a", fontSize: 11, color: "#8ab88a" }}>
                    {fileIcon(att.filename)} {att.filename} ({formatFileSize(att.size_bytes)})
                    <button onClick={() => setReplyAttachments(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#5a4a4a", padding: 2 }}><IconX /></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderTop: "1px solid #0d1a0d" }}>
              <button onClick={() => replyFileInputRef.current?.click()}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}><IconAttach /></button>
              <button onClick={sendReply} disabled={sending}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 18px", borderRadius: 20, border: "none", background: "#2E7D32", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
                <IconSend />{sending ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // DESKTOP SPLIT-PANE LAYOUT
  // ═══════════════════════════════════════════
  if (isDesktop) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", background: "#050e05" }}>
        <style>{`
          .jhps-tiptap .ProseMirror { min-height: 80px; outline: none; }
          .jhps-tiptap .ProseMirror p { margin: 0 0 4px; }
          .jhps-tiptap .ProseMirror ul, .jhps-tiptap .ProseMirror ol { padding-left: 20px; margin: 4px 0; }
          .jhps-tiptap .ProseMirror blockquote { border-left: 3px solid #2E7D32; padding-left: 12px; margin: 8px 0; color: #8ab88a; }
          .jhps-tiptap .ProseMirror a { color: #4CAF50; text-decoration: underline; }
          .jhps-tiptap .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #3a5a3a; pointer-events: none; float: left; height: 0; }
        `}</style>

        {/* Toast */}
        {toast && (
          <div style={{ position: "fixed", top: 20, right: 20, zIndex: 10000, padding: "12px 20px", borderRadius: 8, background: toast.type === "success" ? "#2E7D32" : "#c62828", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
            {toast.type === "success" ? "\u2713" : "\u26A0"} {toast.message}
          </div>
        )}

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" multiple style={{ display: "none" }}
          onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(f => uploadFile(f, "compose")); e.target.value = ""; }} />
        <input ref={replyFileInputRef} type="file" multiple style={{ display: "none" }}
          onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(f => uploadFile(f, "reply")); e.target.value = ""; }} />

        {/* Left: Folder sidebar */}
        <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid #1a3a1a", display: "flex", flexDirection: "column", background: "#0a160a" }}>
          <div style={{ padding: "16px 12px 8px" }}>
            <button onClick={() => startCompose("new")}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 20px", borderRadius: 16, border: "1px solid #1a3a1a", background: "linear-gradient(135deg, #1a3a1a, #0d2a0d)", color: "#4CAF50", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              <IconCompose /> Compose
            </button>
          </div>
          <nav style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
            {FOLDERS.map(f => {
              const isActive = folder === f.key;
              const count = folderCounts[f.key] || 0;
              return (
                <button key={f.key} onClick={() => { setFolder(f.key); setSelectedThread(null); setMessages([]); setView("list"); setSelectedIds(new Set()); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: isActive ? 700 : 400, background: isActive ? "rgba(76,175,80,0.12)" : "transparent", color: isActive ? "#4CAF50" : "#8ab88a", textAlign: "left", cursor: "pointer", marginBottom: 2 }}>
                  <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{f.icon}</span>
                  <span style={{ flex: 1 }}>{f.label}</span>
                  {count > 0 && f.key !== "sent" && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? "#4CAF50" : "#5a8a5a", background: isActive ? "rgba(76,175,80,0.15)" : "rgba(90,138,90,0.1)", padding: "2px 8px", borderRadius: 10 }}>{count}</span>
                  )}
                </button>
              );
            })}
          </nav>
          <div style={{ padding: "8px 12px 16px", borderTop: "1px solid #1a3a1a" }}>
            <button onClick={() => setContactsOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", borderRadius: 20, border: "none", background: "transparent", color: "#5a8a5a", fontSize: 13, cursor: "pointer" }}>
              <IconContacts /> Contacts
            </button>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Top toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderBottom: "1px solid #1a3a1a" }}>
            {selectedThread && messages.length > 0 ? (
              <>
                <button onClick={closeThread} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}>
                  <IconBack />
                </button>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "#c8e0c8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{selectedThread.subject}</h2>
                <button onClick={() => startCompose("reply", messages[messages.length - 1])} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }} title="Reply"><IconReply /></button>
                <button onClick={() => startCompose("forward", messages[messages.length - 1])} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }} title="Forward"><IconForward /></button>
                <button onClick={() => threadAction("trash")} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }} title="Trash"><IconTrash /></button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#0d1a0d", borderRadius: 24, border: "1px solid #1a3a1a", maxWidth: 560 }}>
                  <IconSearch />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mail..."
                    style={{ flex: 1, background: "transparent", fontSize: 14, color: "#e8f5e8", border: "none", outline: "none" }} />
                  {search && <button onClick={() => setSearch("")} style={{ color: "#3a5a3a", background: "none", border: "none", cursor: "pointer" }}><IconX /></button>}
                </div>
                {/* Account dropdown */}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setView(view === "accounts" ? "list" : "accounts" as any)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 20, border: "1px solid #1a3a1a", background: "transparent", color: activeAccount ? activeAccount.color : "#5a8a5a", cursor: "pointer", fontSize: 13 }}>
                    {activeAccount ? (
                      <><div style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, backgroundColor: activeAccount.color + "25" }}>{activeAccount.initials}</div> {activeAccount.email.split("@")[0]}</>
                    ) : (
                      <><IconMail /> All Mail</>
                    )}
                    <IconChevronDown />
                  </button>
                  {view === "accounts" && (
                    <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, width: 224, background: "#1a2a1a", border: "1px solid #1a3a1a", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.4)", zIndex: 50, overflow: "hidden" }}>
                      <button onClick={() => { setActiveAccount(null); localStorage.removeItem("jhps_inbox_account"); setView("list"); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", fontSize: 13, color: !activeAccount ? "#4CAF50" : "#8ab88a", background: !activeAccount ? "rgba(76,175,80,0.05)" : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                        <IconMail /> All Mail
                      </button>
                      {accounts.map(a => (
                        <button key={a.email} onClick={() => { setActiveAccount(a); setFromAccount(a.email); localStorage.setItem("jhps_inbox_account", a.email); setView("list"); }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", fontSize: 13, borderTop: "1px solid rgba(26,58,26,0.3)", color: activeAccount?.email === a.email ? "#4CAF50" : "#8ab88a", background: activeAccount?.email === a.email ? "rgba(76,175,80,0.05)" : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, backgroundColor: a.color + "25", color: a.color }}>{a.initials}</div>
                          {a.email}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Content area */}
          {view === "compose" ? (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ maxWidth: 640, margin: "24px auto", padding: "0 16px" }}>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1a3a1a", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #1a3a1a" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e8f5e8", margin: 0 }}>{composeMode === "reply" ? "Reply" : composeMode === "forward" ? "Forward" : composeDraftId ? "Edit Draft" : "New Message"}</h3>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={saveDraft} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 12, cursor: "pointer" }}>Save</button>
                      <button onClick={() => { saveDraft(); closeCompose(); setView("list"); }} style={{ padding: 4, borderRadius: 8, border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}><IconX /></button>
                    </div>
                  </div>
                  <div style={{ padding: "12px 20px", borderBottom: "1px solid #1a3a1a" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, position: "relative" }}>
                      <span style={{ fontSize: 13, color: "#5a8a5a", width: 48 }}>To</span>
                      <input value={composeTo} onChange={e => { setComposeTo(e.target.value); searchContacts(e.target.value); }}
                        onFocus={() => { if (toSuggestions.length) setShowSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="recipient@email.com"
                        style={{ flex: 1, background: "transparent", fontSize: 14, color: "#e8f5e8", border: "none", outline: "none", padding: "4px 0" }} />
                      {!showCcBcc && <button onClick={() => setShowCcBcc(true)} style={{ fontSize: 12, color: "#3a5a3a", background: "none", border: "none", cursor: "pointer" }}>Cc/Bcc</button>}
                    </div>
                    {showSuggestions && toSuggestions.length > 0 && (
                      <div style={{ position: "absolute", left: 20, right: 20, background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                        {toSuggestions.map(c => (
                          <div key={c.id} onClick={() => { setComposeTo(c.email); setShowSuggestions(false); }}
                            style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #0a160a", display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 13, color: "#e8f5e8", fontWeight: 600 }}>{c.name}</span>
                            <span style={{ fontSize: 11, color: "#5a8a5a" }}>{c.email}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {showCcBcc && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, color: "#5a8a5a", width: 48 }}>Cc</span>
                          <input value={composeCc} onChange={e => setComposeCc(e.target.value)} style={{ flex: 1, background: "transparent", fontSize: 14, color: "#e8f5e8", border: "none", outline: "none", padding: "4px 0" }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, color: "#5a8a5a", width: 48 }}>Bcc</span>
                          <input value={composeBcc} onChange={e => setComposeBcc(e.target.value)} style={{ flex: 1, background: "transparent", fontSize: 14, color: "#e8f5e8", border: "none", outline: "none", padding: "4px 0" }} />
                        </div>
                      </>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: "#5a8a5a", width: 48 }}>Subject</span>
                      <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject"
                        style={{ flex: 1, background: "transparent", fontSize: 14, color: "#e8f5e8", border: "none", outline: "none", padding: "4px 0" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 13, color: "#5a8a5a", width: 48 }}>From</span>
                      <select value={fromAccount} onChange={e => setFromAccount(e.target.value)}
                        style={{ flex: 1, background: "transparent", fontSize: 14, color: "#e8f5e8", border: "none", outline: "none" }}>
                        {accounts.map(a => <option key={a.email} value={a.email}>{a.email}</option>)}
                      </select>
                    </div>
                  </div>
                  <EditorToolbar editor={editor} />
                  <div className="jhps-tiptap"><EditorContent editor={editor} /></div>
                  {composeAttachments.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 16px", borderTop: "1px solid #0d1a0d" }}>
                      {composeAttachments.map((att, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#0a160a", border: "1px solid #1a3a1a", fontSize: 12, color: "#8ab88a" }}>
                          {fileIcon(att.filename)} {att.filename} ({formatFileSize(att.size_bytes)})
                          <button onClick={() => setComposeAttachments(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#5a4a4a", padding: 2 }}><IconX /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid #1a3a1a" }}>
                    <button onClick={handleSend} disabled={sending}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 20, border: "none", background: "#2E7D32", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
                      {sending ? "..." : <><IconSend /> Send</>}
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={composeUploading}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}>
                      <IconAttach />
                    </button>
                    <span style={{ fontSize: 11, color: "#3a5a3a" }}>Sends as {fromAccount || "info@jhpsfl.com"}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedThread && messages.length > 0 ? (
            /* Thread detail */
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div ref={messagesContainerRef} style={{ flex: 1, overflowY: "auto" }}>
                <div style={{ maxWidth: 768, margin: "0 auto", padding: "16px 24px" }}>
                  {loadingThread ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "64px 0", color: "#4CAF50" }}>Loading...</div>
                  ) : messages.map(msg => {
                    const isOutbound = msg.direction === "outbound";
                    const senderName = isOutbound ? "JHPS" : (selectedThread.customer_name || msg.from_email.split("@")[0]);
                    const initials = isOutbound ? "JP" : getInitials(selectedThread.customer_name, msg.from_email);
                    const isCollapsed = collapsedMsgs.has(msg.id);
                    const bodyText = msg.body_text || (msg.body_html ? htmlToText(msg.body_html) : "\u2014");

                    if (isCollapsed) {
                      return (
                        <div key={msg.id} onClick={() => setCollapsedMsgs(prev => { const n = new Set(prev); n.delete(msg.id); return n; })}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#0d1a0d", marginBottom: 4, borderRadius: 8, cursor: "pointer" }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: isOutbound ? "#1a3a2a" : "#1a2a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isOutbound ? "#4CAF50" : "#6a8a6a" }}>{initials}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#a0b8a0", flexShrink: 0 }}>{senderName}</div>
                          <div style={{ flex: 1, fontSize: 12, color: "#4a6a4a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bodyText.substring(0, 80)}</div>
                          {msg.attachments?.length > 0 && <span style={{ color: "#5a8a5a" }}><IconAttach /></span>}
                          <div style={{ fontSize: 11, color: "#3a5a3a", flexShrink: 0 }}>{shortTime(msg.created_at)}</div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 20, marginBottom: 12, border: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0, background: isOutbound ? "linear-gradient(135deg, #2E7D32, #1a4a1a)" : avatarColor(msg.from_email) + "30", color: isOutbound ? "#4CAF50" : avatarColor(msg.from_email) }}>
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: "#e8f5e8" }}>{senderName}</span>
                              <span style={{ fontSize: 12, color: "#4a6a4a" }}>&lt;{msg.from_email}&gt;</span>
                            </div>
                            <p style={{ fontSize: 12, color: "#4a6a4a", margin: 0 }}>to {isOutbound ? (selectedThread.customer_name || msg.to_email) : "me"} · {formatDate(msg.created_at)}</p>
                          </div>
                          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                            <button onClick={() => startCompose("reply", msg)} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}><IconReply /></button>
                            <button onClick={() => startCompose("forward", msg)} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}><IconForward /></button>
                            <button onClick={() => setCollapsedMsgs(prev => { const n = new Set(prev); n.add(msg.id); return n; })}
                              style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                            </button>
                          </div>
                        </div>
                        {isOutbound && msg.resend_message_id && <div style={{ fontSize: 11, color: "#2E7D32", marginBottom: 8 }}>{"\u2713"} Delivered</div>}
                        {msg.body_html ? (
                          <iframe
                            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;font-family:-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#c8dcc8;background:#0a160a;overflow-wrap:break-word;word-break:break-word;}img{max-width:100%;height:auto;}a{color:#4CAF50;}*{max-width:100%!important;box-sizing:border-box!important;}</style></head><body>${msg.body_html}</body></html>`}
                            sandbox="allow-same-origin"
                            style={{ width: "100%", minHeight: 120, border: "1px solid #1a3a1a", borderRadius: 8, background: "#0a160a" }}
                            onLoad={e => {
                              const iframe = e.target as HTMLIFrameElement;
                              if (iframe.contentDocument?.body) iframe.style.height = Math.max(120, iframe.contentDocument.body.scrollHeight + 20) + "px";
                            }}
                          />
                        ) : (
                          <pre style={{ fontSize: 14, color: "#c8dcc8", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6, margin: 0 }}>{bodyText}</pre>
                        )}
                        {msg.attachments?.length > 0 && <AttachmentPreview attachments={msg.attachments} />}
                      </div>
                    );
                  })}
                  {/* Reply/Forward bar */}
                  {messages.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
                      <button onClick={() => startCompose("reply", messages[messages.length - 1])}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 20, border: "1px solid #1a3a1a", background: "transparent", color: "#8ab88a", fontSize: 14, cursor: "pointer" }}>
                        <IconReply /> Reply
                      </button>
                      <button onClick={() => startCompose("forward", messages[messages.length - 1])}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 20, border: "1px solid #1a3a1a", background: "transparent", color: "#8ab88a", fontSize: 14, cursor: "pointer" }}>
                        <IconForward /> Forward
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Inline reply bar */}
              <div style={{ flexShrink: 0, padding: "10px 24px 16px", borderTop: "1px solid #0d1a0d", background: "rgba(5,14,5,0.98)" }}>
                <div style={{ maxWidth: 768, margin: "0 auto", border: "1px solid #1a3a1a", borderRadius: 10, overflow: "hidden", background: "#0a160a" }}>
                  <EditorToolbar editor={replyEditor} />
                  <div className="jhps-tiptap"><EditorContent editor={replyEditor} /></div>
                  {replyAttachments.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 10px", borderTop: "1px solid #0d1a0d" }}>
                      {replyAttachments.map((att, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: "#0d1a0d", border: "1px solid #1a3a1a", fontSize: 11, color: "#8ab88a" }}>
                          {fileIcon(att.filename)} {att.filename} ({formatFileSize(att.size_bytes)})
                          <button onClick={() => setReplyAttachments(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#5a4a4a", padding: 2 }}><IconX /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderTop: "1px solid #0d1a0d" }}>
                    <button onClick={() => replyFileInputRef.current?.click()}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}><IconAttach /></button>
                    <button onClick={sendReply} disabled={sending}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 18px", borderRadius: 20, border: "none", background: "#2E7D32", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
                      <IconSend />{sending ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Thread list */
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Toolbar */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", borderBottom: "1px solid #0d1a0d" }}>
                <button onClick={() => {
                  if (allSelected) setSelectedIds(new Set());
                  else setSelectedIds(new Set(filtered.map(t => t.thread_id)));
                }} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: someSelected ? "#4CAF50" : "#3a5a3a" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {allSelected ? <><rect x="3" y="3" width="18" height="18" rx="3" fill="rgba(76,175,80,0.2)" stroke="#4CAF50" /><polyline points="9 12 11.5 14.5 15 9" /></> : someSelected ? <><rect x="3" y="3" width="18" height="18" rx="3" /><line x1="7" y1="12" x2="17" y2="12" /></> : <rect x="3" y="3" width="18" height="18" rx="3" />}
                  </svg>
                </button>
                <button onClick={() => fetchThreads(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}>
                  <IconRefresh />
                </button>
                {someSelected && (
                  <>
                    <button onClick={() => batchAction("star")} title="Star" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "#FFD700" }}>
                      <IconStar filled={false} />
                    </button>
                    <button onClick={() => batchAction("mark_read")} title="Mark read" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "#5a8a5a" }}>
                      <IconMail />
                    </button>
                    {folder === "trash" ? (
                      <>
                        <button onClick={() => batchAction("restore")} title="Restore" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "#4CAF50" }}>
                          <IconReply />
                        </button>
                        <button onClick={() => permanentDelete(Array.from(selectedIds))} title="Delete permanently" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "#ef5350" }}>
                          <IconTrash />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => batchAction("trash")} title="Move to trash" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "#7a4a4a" }}>
                        <IconTrash />
                      </button>
                    )}
                  </>
                )}
                <div style={{ flex: 1 }} />
                {someSelected && <span style={{ fontSize: 11, color: "#5a8a5a" }}>{selectedIds.size} selected</span>}
              </div>
              {/* Folder label */}
              <div style={{ padding: "8px 20px 4px", fontSize: 13, color: "#3a5a3a", fontWeight: 500, textTransform: "capitalize" }}>{folder}</div>
              {/* Thread rows */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {loading ? (
                  <div style={{ padding: 40, textAlign: "center", color: "#3a5a3a", fontSize: 13 }}>Loading...</div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: 60, textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>{FOLDERS.find(f => f.key === folder)?.icon || "\uD83D\uDCED"}</div>
                    <div style={{ color: "#3a5a3a", fontSize: 13 }}>{search ? "No matching threads" : `No emails in ${folder}`}</div>
                  </div>
                ) : filtered.map(thread => {
                  const senderEmail = folder === "sent" ? thread.to_email : thread.from_email;
                  const senderName = thread.customer_name || senderEmail.split("@")[0];
                  const isSelected = selectedIds.has(thread.thread_id);
                  const isUnread = thread.unread_count > 0;
                  const isDraft = folder === "drafts";
                  return (
                    <div key={thread.thread_id} onClick={() => handleThreadClick(thread)}
                      style={{ display: "flex", alignItems: "center", gap: 0, padding: "10px 8px 10px 4px", borderBottom: "1px solid #0a160a", background: isSelected ? "rgba(76,175,80,0.06)" : "rgba(13,26,13,0.6)", borderRadius: 4, margin: "2px 6px", cursor: "pointer" }}>
                      {/* Checkbox */}
                      <div onClick={e => { e.stopPropagation(); toggleSelect(thread.thread_id); }} style={{ width: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
                        {isDraft ? "\uD83D\uDCDD" : getInitials(thread.customer_name, senderEmail)}
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: isUnread ? 700 : 400, color: isUnread ? "#e8f5e8" : "#a0b8a0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {isDraft ? <span style={{ color: "#ef5350" }}>Draft</span> : senderName}
                            {thread.message_count > 1 && <span style={{ color: "#4a6a4a", fontWeight: 400, fontSize: 11, marginLeft: 4 }}>({thread.message_count})</span>}
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
                })}
              </div>
            </div>
          )}
        </div>

        {/* Contacts panel */}
        {contactsOpen && (
          <div onClick={() => setContactsOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 8000, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "flex-end" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 400, maxWidth: "100vw", background: "#0a160a", borderLeft: "1px solid #1a3a1a", display: "flex", flexDirection: "column", height: "100vh", boxShadow: "-8px 0 40px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #1a3a1a" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#e8f5e8" }}>Contacts</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setContactModal({ id: "", name: "", email: "", phone: null, company: null, category: "other", notes: null, starred: false } as EmailContact); setContactForm({ name: "", email: "", phone: "", company: "", category: "other", notes: "" }); }}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #1a3a1a", background: "rgba(76,175,80,0.1)", color: "#4CAF50", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ New</button>
                  <button onClick={() => setContactsOpen(false)} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 20, cursor: "pointer", padding: 4 }}>{"\u00D7"}</button>
                </div>
              </div>
              <div style={{ padding: "10px 16px", display: "flex", gap: 8 }}>
                <input type="text" placeholder="Search contacts..." value={contactSearch}
                  onChange={e => { setContactSearch(e.target.value); fetchContacts(e.target.value); }}
                  style={{ flex: 1, padding: "8px 12px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
                <select value={contactFilter} onChange={e => setContactFilter(e.target.value)}
                  style={{ padding: "8px 10px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none", fontSize: 12 }}>
                  <option value="all">All</option>
                  <option value="customer">Customers</option>
                  <option value="vendor">Vendors</option>
                  <option value="supplier">Suppliers</option>
                  <option value="contractor">Contractors</option>
                  <option value="other">Other</option>
                </select>
              </div>
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
                {contacts.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#3a5a3a", fontSize: 13 }}>No contacts yet</div>}
              </div>
            </div>
          </div>
        )}

        {/* Contact edit modal */}
        {contactModal && (
          <div onClick={() => setContactModal(null)} style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 12, width: 420, maxWidth: "calc(100vw - 32px)", padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
              <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#e8f5e8" }}>{contactModal.id ? "Edit Contact" : "New Contact"}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="text" placeholder="Name *" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                  style={{ padding: "10px 14px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
                <input type="email" placeholder="Email *" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                  style={{ padding: "10px 14px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
                <input type="tel" placeholder="Phone" value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))}
                  style={{ padding: "10px 14px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
                <input type="text" placeholder="Company" value={contactForm.company} onChange={e => setContactForm(p => ({ ...p, company: e.target.value }))}
                  style={{ padding: "10px 14px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
                <select value={contactForm.category} onChange={e => setContactForm(p => ({ ...p, category: e.target.value }))}
                  style={{ padding: "10px 14px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }}>
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor</option>
                  <option value="supplier">Supplier</option>
                  <option value="contractor">Contractor</option>
                  <option value="other">Other</option>
                </select>
                <textarea placeholder="Notes" value={contactForm.notes} onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                  style={{ padding: "10px 14px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none", resize: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}>
                <div>
                  {contactModal.id && (
                    <button onClick={() => { deleteContact(contactModal.id); setContactModal(null); }}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(239,83,80,0.3)", background: "rgba(239,83,80,0.08)", color: "#ef5350", fontSize: 13, cursor: "pointer" }}>Delete</button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setContactModal(null)}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #1a3a1a", background: "transparent", color: "#5a8a5a", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  <button onClick={saveContact} disabled={contactSaving || !contactForm.name || !contactForm.email}
                    style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#2E7D32", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: contactSaving ? 0.6 : 1 }}>
                    {contactSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // MOBILE: Sidebar overlay
  // ═══════════════════════════════════════════
  const MobileSidebar = () => (
    <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={() => setSidebarOpen(false)}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div style={{ position: "absolute", inset: "0 auto 0 0", width: "82%", maxWidth: 320, background: "#0a160a", display: "flex", flexDirection: "column", animation: "slideInLeft 0.25s ease-out" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px" }}>
          <span style={{ fontWeight: 700, fontSize: 20, color: "#4CAF50" }}>JHPS Mail</span>
          {activeAccount && (
            <button onClick={() => { setSidebarOpen(false); setView("accounts"); }}
              style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", backgroundColor: activeAccount.color + "25", color: activeAccount.color }}>
              {activeAccount.initials}
            </button>
          )}
        </div>
        <nav style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
          {FOLDERS.map(f => (
            <button key={f.key} onClick={() => { setFolder(f.key); setSidebarOpen(false); setSelectedThread(null); setView("list"); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "14px 16px", borderRadius: 20, fontSize: 16, fontWeight: folder === f.key ? 600 : 400, border: "none", background: folder === f.key ? "rgba(76,175,80,0.1)" : "transparent", color: folder === f.key ? "#4CAF50" : "#8ab88a", marginBottom: 2, cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 18 }}>{f.icon}</span>
              <span style={{ flex: 1 }}>{f.label}</span>
              {(folderCounts[f.key] || 0) > 0 && f.key !== "sent" && <span style={{ fontSize: 15 }}>{folderCounts[f.key]}</span>}
            </button>
          ))}
          <div style={{ height: 1, background: "#1a3a1a", margin: "12px 16px" }} />
          <button onClick={() => { setSidebarOpen(false); setContactsOpen(true); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "14px 16px", borderRadius: 20, fontSize: 16, fontWeight: 400, border: "none", background: "transparent", color: "#8ab88a", cursor: "pointer", textAlign: "left" }}>
            <IconContacts /> <span style={{ flex: 1 }}>Contacts</span>
          </button>
        </nav>
      </div>
      <style>{`@keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
    </div>
  );

  // ═══════════════════════════════════════════
  // MOBILE: MAIN LIST VIEW
  // ═══════════════════════════════════════════
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#050e05", position: "relative" }}>
      <style>{`
        .jhps-tiptap .ProseMirror { min-height: 80px; outline: none; }
        .jhps-tiptap .ProseMirror p { margin: 0 0 4px; }
        .jhps-tiptap .ProseMirror ul, .jhps-tiptap .ProseMirror ol { padding-left: 20px; margin: 4px 0; }
        .jhps-tiptap .ProseMirror blockquote { border-left: 3px solid #2E7D32; padding-left: 12px; margin: 8px 0; color: #8ab88a; }
        .jhps-tiptap .ProseMirror a { color: #4CAF50; text-decoration: underline; }
        .jhps-tiptap .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #3a5a3a; pointer-events: none; float: left; height: 0; }
        @keyframes jhpsSpin { to { transform: rotate(360deg); } }
      `}</style>

      {sidebarOpen && <MobileSidebar />}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 10000, padding: "12px 20px", borderRadius: 8, background: toast.type === "success" ? "#2E7D32" : "#c62828", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
          {toast.type === "success" ? "\u2713" : "\u26A0"} {toast.message}
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" multiple style={{ display: "none" }}
        onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(f => uploadFile(f, "compose")); e.target.value = ""; }} />
      <input ref={replyFileInputRef} type="file" multiple style={{ display: "none" }}
        onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(f => uploadFile(f, "reply")); e.target.value = ""; }} />

      {/* Batch action bar */}
      {selectMode && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "#0a160a", borderBottom: "1px solid #1a3a1a" }}>
          <button onClick={exitSelectMode} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#e8f5e8" }}>{selectedIds.size} selected</span>
          <button onClick={() => {
            if (selectedIds.size === filtered.length) setSelectedIds(new Set());
            else setSelectedIds(new Set(filtered.map(t => t.thread_id)));
          }} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "#5a8a5a", border: "1px solid #1a3a1a", background: "transparent", cursor: "pointer", marginLeft: 4 }}>
            {selectedIds.size === filtered.length ? "None" : "All"}
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => batchAction("mark_read")} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }} title="Mark read"><IconMail /></button>
          <button onClick={() => batchAction("mark_unread")} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#4CAF50", cursor: "pointer" }} title="Mark unread"><IconEyeOff /></button>
          <button onClick={() => batchAction((() => { const allStarred = filtered.filter(t => selectedIds.has(t.thread_id)).every(t => t.starred); return allStarred ? "unstar" : "star"; })())}
            style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#FFD700", cursor: "pointer" }} title="Star/Unstar">
            <IconStar filled={false} />
          </button>
          <button onClick={() => batchAction("trash")} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#ef5350", cursor: "pointer" }} title="Trash"><IconTrash /></button>
        </div>
      )}

      {/* Top bar */}
      {!selectMode && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
          <button onClick={() => setSidebarOpen(true)} style={{ padding: 8, borderRadius: "50%", border: "none", background: "transparent", color: "#5a8a5a", cursor: "pointer" }}>
            <IconMenu />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#0d1a0d", borderRadius: 24, border: "1px solid #1a3a1a" }}>
              <IconSearch />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search in mail"
                style={{ flex: 1, background: "transparent", fontSize: 15, color: "#e8f5e8", border: "none", outline: "none" }} />
            </div>
          </div>
          <button onClick={() => setView("accounts")}
            style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, border: "none", cursor: "pointer", ...(activeAccount ? { backgroundColor: activeAccount.color + "25", color: activeAccount.color } : { backgroundColor: "#1a2a1a", color: "#5a8a5a" }) }}>
            {activeAccount ? activeAccount.initials : "All"}
          </button>
        </div>
      )}

      {/* Folder label */}
      {!selectMode && (
        <div style={{ padding: "4px 20px 6px" }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "#4a6a4a", textTransform: "capitalize" }}>{folder}</span>
        </div>
      )}

      {/* Thread list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "64px 0", color: "#4CAF50" }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 16, opacity: 0.3 }}>{FOLDERS.find(f => f.key === folder)?.icon || "\uD83D\uDCED"}</div>
            <p style={{ color: "#4a6a4a", fontSize: 16 }}>{search ? "No emails match your search." : "No emails in this folder."}</p>
          </div>
        ) : filtered.map(thread => {
          const senderEmail = folder === "sent" ? thread.to_email : thread.from_email;
          const senderName = thread.customer_name || senderEmail.split("@")[0];
          const isSelected = selectedIds.has(thread.thread_id);
          return (
            <button key={thread.thread_id}
              onPointerDown={() => handlePointerDown(thread.thread_id)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onContextMenu={e => { e.preventDefault(); if (!selectMode) enterSelectMode(thread.thread_id); }}
              onClick={() => handleThreadClick(thread)}
              style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 20px", textAlign: "left", border: "none", borderBottom: "1px solid rgba(26,58,26,0.3)", background: isSelected ? "rgba(76,175,80,0.08)" : thread.unread_count > 0 ? "rgba(76,175,80,0.02)" : "transparent", cursor: "pointer" }}>
              {/* Avatar */}
              <div onClick={e => { e.stopPropagation(); if (selectMode) toggleSelect(thread.thread_id); else enterSelectMode(thread.thread_id); }}
                style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2, ...(isSelected
                  ? { border: "2px solid #4CAF50", backgroundColor: "rgba(76,175,80,0.1)" }
                  : selectMode
                    ? { border: "2px solid rgba(255,255,255,0.15)", backgroundColor: "transparent" }
                    : { backgroundColor: avatarColor(senderEmail) + "25", color: avatarColor(senderEmail) }
                ) }}>
                {isSelected ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  : selectMode ? <span style={{ width: 20, height: 20 }} />
                  : <span style={{ fontSize: 15, fontWeight: 700 }}>{getInitials(thread.customer_name, senderEmail)}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: thread.unread_count > 0 ? 700 : 500, color: thread.unread_count > 0 ? "#e8f5e8" : "#a0b8a0" }}>
                    {senderName}
                  </span>
                  {thread.message_count > 1 && <span style={{ fontSize: 13, color: "#4a6a4a" }}>{thread.message_count}</span>}
                  <span style={{ marginLeft: "auto", fontSize: 13, color: "#4a6a4a", flexShrink: 0 }}>{timeAgo(thread.latest_message)}</span>
                  {thread.unread_count > 0 && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4CAF50", flexShrink: 0 }} />}
                </div>
                <p style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2, margin: 0, fontWeight: thread.unread_count > 0 ? 600 : 400, color: thread.unread_count > 0 ? "#e8f5e8" : "#6a8a6a" }}>
                  {thread.subject}
                </p>
                <p style={{ fontSize: 14, color: "#4a6a4a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2, margin: 0 }}>{thread.latest_body_preview}</p>
              </div>
              {!selectMode && (
                <button onClick={e => { e.stopPropagation(); toggleStar(thread.thread_id, thread.starred, e); }}
                  style={{ marginTop: 6, flexShrink: 0, padding: 4, background: "none", border: "none", cursor: "pointer" }}>
                  <IconStar filled={thread.starred} />
                </button>
              )}
            </button>
          );
        })}
      </div>

      {/* FAB Compose */}
      {!selectMode && (
        <button onClick={() => startCompose("new")}
          style={{ position: "fixed", bottom: 80, right: 20, zIndex: 30, display: "flex", alignItems: "center", gap: 8, padding: "14px 22px", background: "linear-gradient(135deg, #1a3a1a, #0d2a0d)", border: "none", borderRadius: 16, color: "#4CAF50", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px #1a3a1a" }}>
          <IconCompose /> Compose
        </button>
      )}

      {/* Mobile contacts panel */}
      {contactsOpen && (
        <div onClick={() => setContactsOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 8000, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 400, maxWidth: "100vw", background: "#0a160a", borderLeft: "1px solid #1a3a1a", display: "flex", flexDirection: "column", height: "100vh", boxShadow: "-8px 0 40px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #1a3a1a" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#e8f5e8" }}>Contacts</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setContactModal({ id: "", name: "", email: "", phone: null, company: null, category: "other", notes: null, starred: false } as EmailContact); setContactForm({ name: "", email: "", phone: "", company: "", category: "other", notes: "" }); }}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #1a3a1a", background: "rgba(76,175,80,0.1)", color: "#4CAF50", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ New</button>
                <button onClick={() => setContactsOpen(false)} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 20, cursor: "pointer", padding: 4 }}>{"\u00D7"}</button>
              </div>
            </div>
            <div style={{ padding: "10px 16px", display: "flex", gap: 8 }}>
              <input type="text" placeholder="Search contacts..." value={contactSearch}
                onChange={e => { setContactSearch(e.target.value); fetchContacts(e.target.value); }}
                style={{ flex: 1, padding: "8px 12px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
            </div>
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
                </div>
              ))}
              {contacts.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#3a5a3a", fontSize: 13 }}>No contacts yet</div>}
            </div>
          </div>
        </div>
      )}

      {/* Mobile contact edit modal */}
      {contactModal && (
        <div onClick={() => setContactModal(null)} style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 12, width: 420, maxWidth: "calc(100vw - 32px)", padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#e8f5e8" }}>{contactModal.id ? "Edit Contact" : "New Contact"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="text" placeholder="Name *" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                style={{ padding: "10px 14px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
              <input type="email" placeholder="Email *" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                style={{ padding: "10px 14px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
              <input type="tel" placeholder="Phone" value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))}
                style={{ padding: "10px 14px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
              <input type="text" placeholder="Company" value={contactForm.company} onChange={e => setContactForm(p => ({ ...p, company: e.target.value }))}
                style={{ padding: "10px 14px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }} />
              <select value={contactForm.category} onChange={e => setContactForm(p => ({ ...p, category: e.target.value }))}
                style={{ padding: "10px 14px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none" }}>
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
                <option value="supplier">Supplier</option>
                <option value="contractor">Contractor</option>
                <option value="other">Other</option>
              </select>
              <textarea placeholder="Notes" value={contactForm.notes} onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                style={{ padding: "10px 14px", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, color: "#e8f5e8", outline: "none", resize: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}>
              <div>
                {contactModal.id && (
                  <button onClick={() => { deleteContact(contactModal.id); setContactModal(null); }}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(239,83,80,0.3)", background: "rgba(239,83,80,0.08)", color: "#ef5350", fontSize: 13, cursor: "pointer" }}>Delete</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setContactModal(null)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #1a3a1a", background: "transparent", color: "#5a8a5a", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                <button onClick={saveContact} disabled={contactSaving || !contactForm.name || !contactForm.email}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#2E7D32", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: contactSaving ? 0.6 : 1 }}>
                  {contactSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
