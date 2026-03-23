"use client";

import { useState, useEffect } from "react";

interface EmailAccount {
  id: string;
  email: string;
  display_name: string;
  color: string;
  initials: string;
  is_default: boolean;
  active: boolean;
  created_at: string;
}

export default function AdminSettings() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [emailPrefix, setEmailPrefix] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [initials, setInitials] = useState("");
  const [color, setColor] = useState("#2E7D32");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/email-accounts")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAccounts(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const colorOptions = ["#2E7D32", "#1565C0", "#7B1FA2", "#C62828", "#EF6C00", "#00838F", "#4CAF50", "#F9A825"];

  const handleCreate = async () => {
    if (!emailPrefix) { setToast({ type: "error", text: "Enter an email address" }); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/email-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `${emailPrefix}@jhpsfl.com`,
          display_name: displayName || emailPrefix,
          color,
          initials: initials || emailPrefix.slice(0, 2).toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAccounts(prev => [...prev, data]);
      setShowCreate(false);
      setEmailPrefix("");
      setDisplayName("");
      setInitials("");
      setToast({ type: "success", text: `${emailPrefix}@jhpsfl.com created!` });
    } catch (e: unknown) {
      setToast({ type: "error", text: (e as Error).message || "Failed to create" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (acct: EmailAccount) => {
    if (!confirm(`Deactivate ${acct.email}? It will be removed from the inbox.`)) return;
    await fetch(`/api/admin/email-accounts?id=${acct.id}`, { method: "DELETE" });
    setAccounts(prev => prev.filter(a => a.id !== acct.id));
    setToast({ type: "success", text: `${acct.email} deactivated` });
  };

  return (
    <div style={{ padding: "24px 16px", maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e8f5e8", marginBottom: 24 }}>Settings</h1>

      {/* ── Email Accounts ── */}
      <div style={{ background: "#0a140a", border: "1px solid #1a3a1a", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #1a3a1a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, background: "rgba(46,125,50,0.15)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✉️</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e8f5e8" }}>Email Accounts</div>
              <div style={{ fontSize: 11, color: "#3a5a3a" }}>Manage @jhpsfl.com email addresses</div>
            </div>
          </div>
          <button onClick={() => { setShowCreate(true); setEmailPrefix(""); setDisplayName(""); setInitials(""); setColor("#2E7D32"); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 11, fontWeight: 600, color: "#4CAF50", background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.2)", borderRadius: 8, cursor: "pointer" }}>
            + New Account
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{ padding: "16px 20px", background: "rgba(255,255,255,0.01)", borderBottom: "1px solid #1a3a1a" }}>
            <div style={{ fontSize: 12, color: "#3a5a3a", marginBottom: 12 }}>Create a new @jhpsfl.com email. No DNS changes needed — it works instantly via Resend.</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, color: "#3a5a3a", marginBottom: 4 }}>Email Address</label>
              <div style={{ display: "flex" }}>
                <input type="text" placeholder="name" value={emailPrefix}
                  onChange={e => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "");
                    setEmailPrefix(val);
                    if (val && !initials) setInitials(val.slice(0, 2).toUpperCase());
                    if (val && !displayName) setDisplayName(val.charAt(0).toUpperCase() + val.slice(1) + " — JHPS");
                  }}
                  style={{ flex: 1, background: "#050e05", border: "1px solid #1a3a1a", borderRadius: "8px 0 0 8px", padding: "10px 14px", fontSize: 14, color: "#e8f5e8", outline: "none" }} />
                <span style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderLeft: "none", borderRadius: "0 8px 8px 0", padding: "10px 14px", fontSize: 14, color: "#3a5a3a" }}>@jhpsfl.com</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#3a5a3a", marginBottom: 4 }}>Display Name</label>
                <input type="text" placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)}
                  style={{ width: "100%", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#e8f5e8", outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#3a5a3a", marginBottom: 4 }}>Initials</label>
                <input type="text" maxLength={2} placeholder="JH" value={initials} onChange={e => setInitials(e.target.value.toUpperCase())}
                  style={{ width: "100%", background: "#050e05", border: "1px solid #1a3a1a", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#e8f5e8", outline: "none", textAlign: "center" }} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, color: "#3a5a3a", marginBottom: 6 }}>Color</label>
              <div style={{ display: "flex", gap: 6 }}>
                {colorOptions.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: color === c ? "2px solid #e8f5e8" : "2px solid transparent", cursor: "pointer" }} />
                ))}
              </div>
            </div>
            {/* Preview */}
            {emailPrefix && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#050e05", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{initials || "??"}</div>
                <div>
                  <div style={{ fontSize: 13, color: "#e8f5e8" }}>{displayName || emailPrefix}</div>
                  <div style={{ fontSize: 11, color: "#3a5a3a" }}>{emailPrefix}@jhpsfl.com</div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleCreate} disabled={creating || !emailPrefix}
                style={{ flex: 1, padding: "10px 0", background: "#2E7D32", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 8, cursor: "pointer", opacity: creating || !emailPrefix ? 0.5 : 1 }}>
                {creating ? "Creating..." : "+ Create Email Account"}
              </button>
              <button onClick={() => setShowCreate(false)}
                style={{ padding: "10px 16px", background: "none", color: "#3a5a3a", fontSize: 12, border: "none", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Account list */}
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#3a5a3a", fontSize: 13 }}>Loading...</div>
        ) : accounts.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#2a4a2a", fontSize: 13 }}>No email accounts configured</div>
        ) : (
          accounts.map(acct => (
            <div key={acct.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #0d1a0d" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: acct.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{acct.initials}</div>
                <div>
                  <div style={{ fontSize: 13, color: "#e8f5e8" }}>{acct.display_name}{acct.is_default ? <span style={{ fontSize: 10, color: "#4CAF50", marginLeft: 8 }}>DEFAULT</span> : ""}</div>
                  <div style={{ fontSize: 11, color: "#3a5a3a" }}>{acct.email}</div>
                </div>
              </div>
              {!acct.is_default && (
                <button onClick={() => handleDelete(acct)}
                  style={{ background: "none", border: "none", color: "#2a4a2a", cursor: "pointer", fontSize: 14, padding: 6 }}
                  title="Deactivate">🗑️</button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
          padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff",
          background: toast.type === "success" ? "#2E7D32" : "#C62828",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
