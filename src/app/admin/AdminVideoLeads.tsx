"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ───
interface VideoLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  property_type: string;
  service_requested: string;
  modifier_data: Record<string, unknown>;
  customer_notes: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  lead_media?: { id: string; media_type: string; storage_path: string }[];
}

interface LeadMedia {
  id: string;
  lead_id: string;
  media_type: string;
  storage_path: string;
  thumbnail_path: string | null;
  original_filename: string | null;
  content_type: string | null;
  file_size_bytes: number;
  duration_seconds: number | null;
  capture_context: string | null;
  sort_order: number;
  created_at: string;
}

interface LeadQuote {
  id: string;
  lead_id: string;
  quoted_by: string;
  line_items: Array<{ service: string; description?: string; quantity: number; unit_price: number }>;
  subtotal: number;
  total_low: number;
  total_high: number;
  notes_to_customer: string | null;
  internal_notes: string | null;
  valid_until: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
}

// ─── Helpers ───
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatPhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    new: { bg: "rgba(0,188,212,0.12)", text: "#26c6da" },
    reviewing: { bg: "rgba(255,167,38,0.12)", text: "#ffa726" },
    quoted: { bg: "rgba(33,150,243,0.12)", text: "#42a5f5" },
    accepted: { bg: "rgba(76,175,80,0.12)", text: "#66bb6a" },
    converted: { bg: "rgba(76,175,80,0.2)", text: "#4CAF50" },
    declined: { bg: "rgba(239,83,80,0.08)", text: "#ef5350" },
    expired: { bg: "rgba(158,158,158,0.1)", text: "#9e9e9e" },
  };
  const c = colors[status] || { bg: "rgba(255,255,255,0.06)", text: "#888" };
  return (
    <span style={{
      padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      letterSpacing: 0.8, textTransform: "uppercase",
      background: c.bg, color: c.text, whiteSpace: "nowrap",
    }}>{status}</span>
  );
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Main Component ───
export default function AdminVideoLeads({ userId }: { userId: string }) {
  const [leads, setLeads] = useState<VideoLead[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [leadDetail, setLeadDetail] = useState<{ lead: VideoLead; media: LeadMedia[]; quotes: LeadQuote[] } | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [editingQuote, setEditingQuote] = useState<LeadQuote | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Fetch leads list ───
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ clerk_user_id: userId });
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/leads?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLeads(data.leads || []);
      setCounts(data.counts || {});
    }
    setLoading(false);
  }, [userId, statusFilter]);

  // ─── Fetch single lead detail ───
  const fetchLeadDetail = useCallback(async (leadId: string) => {
    const params = new URLSearchParams({ clerk_user_id: userId, lead_id: leadId });
    const res = await fetch(`/api/leads?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLeadDetail(data);
      setSelectedLead(leadId);
      setShowQuoteBuilder(false);
      setEditingQuote(null);
    }
  }, [userId]);

  // ─── Get signed URL for media ───
  const getMediaUrl = useCallback(async (storagePath: string): Promise<string> => {
    if (mediaUrls[storagePath]) return mediaUrls[storagePath];
    const params = new URLSearchParams({ clerk_user_id: userId, media_key: storagePath });
    const res = await fetch(`/api/leads?${params}`);
    if (res.ok) {
      const data = await res.json();
      setMediaUrls((prev) => ({ ...prev, [storagePath]: data.url }));
      return data.url;
    }
    return "";
  }, [userId, mediaUrls]);

  // ─── Admin actions ───
  const updateStatus = async (leadId: string, status: string) => {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerk_user_id: userId, action: "update_status", payload: { lead_id: leadId, status } }),
    });
    if (res.ok) {
      showToast(`Lead marked as ${status}`);
      fetchLeads();
      if (selectedLead === leadId) fetchLeadDetail(leadId);
    }
  };

  const convertToJob = async (leadId: string) => {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerk_user_id: userId, action: "convert_to_job", payload: { lead_id: leadId } }),
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`Lead converted to job! Job ID: ${data.jobId?.slice(0, 8)}`);
      fetchLeads();
    }
  };

  // ─── Delete entire lead ───
  const deleteLead = async (leadId: string) => {
    if (!window.confirm("Delete this entire lead? This will permanently delete:\n• All media files\n• All quotes\n• The lead record\n\nThis action cannot be undone.")) {
      return;
    }

    const res = await fetch("/api/leads/delete-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerk_user_id: userId, lead_id: leadId }),
    });

    if (res.ok) {
      showToast("Lead and all media deleted successfully");
      // Go back to leads list
      setSelectedLead(null);
      setLeadDetail(null);
      // Refresh the leads list
      fetchLeads();
    } else {
      try {
        const error = await res.json();
        showToast(`Failed to delete lead: ${error.error || "Unknown error"}`, "error");
      } catch {
        showToast("Failed to delete lead: Network error", "error");
      }
    }
  };

  // ─── Delete media ───
  const deleteMedia = async (mediaId: string) => {
    const res = await fetch("/api/leads/delete-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerk_user_id: userId, media_id: mediaId }),
    });

    if (res.ok) {
      const data = await res.json();
      showToast("Media file deleted successfully");
      
      // Update local state immediately for better UX
      if (leadDetail) {
        setLeadDetail({
          ...leadDetail,
          media: leadDetail.media.filter(m => m.id !== mediaId)
        });
      }
      // Also update the leads list to reflect the change
      setLeads(prevLeads => 
        prevLeads.map(lead => {
          if (lead.id === selectedLead && lead.lead_media) {
            return {
              ...lead,
              lead_media: lead.lead_media.filter(m => m.id !== mediaId)
            };
          }
          return lead;
        })
      );
    } else {
      try {
        const error = await res.json();
        showToast(`Failed to delete: ${error.error || "Unknown error"}`, "error");
      } catch {
        showToast("Failed to delete media: Network error", "error");
      }
    }
  };

  // ─── Send an existing draft quote ───
  const sendExistingQuote = async (quoteId: string, leadId: string) => {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerk_user_id: userId,
        action: "send_quote",
        payload: { quote_id: quoteId, lead_id: leadId },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const msg = data.message || "Quote sent!";
      showToast(msg.includes("email failed") ? `${msg} — check Resend logs` : "Quote sent! Customer email delivered.");
      fetchLeads();
      fetchLeadDetail(leadId);
    } else {
      showToast("Failed to send quote", "error");
    }
  };

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ─── RENDER: Lead Detail View ───
  if (selectedLead && leadDetail) {
    return (
      <div style={{ animation: "fadeIn 0.3s ease" }}>
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

        <button onClick={() => { setSelectedLead(null); setLeadDetail(null); }} style={{
          background: "none", border: "none", color: "#5a8a5a", fontSize: 14,
          cursor: "pointer", fontFamily: "inherit", marginBottom: 16, display: "flex", alignItems: "center", gap: 6,
        }}>← Back to Leads</button>

        {/* Lead header card */}
        <div style={{
          background: "linear-gradient(160deg, #0d1f0d, #091409)", border: "1px solid #1a3a1a",
          borderRadius: 20, padding: "24px 28px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#e8f5e8", fontWeight: 800 }}>
                  {leadDetail.lead.name}
                </h2>
                <StatusBadge status={leadDetail.lead.status} />
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14 }}>
                <a href={`tel:${leadDetail.lead.phone}`} style={{ color: "#4CAF50", textDecoration: "none" }}>📞 {formatPhone(leadDetail.lead.phone)}</a>
                <a href={`mailto:${leadDetail.lead.email}`} style={{ color: "#4CAF50", textDecoration: "none" }}>✉️ {leadDetail.lead.email}</a>
              </div>
              <div style={{ color: "#5a8a5a", fontSize: 13, marginTop: 6 }}>
                📍 {leadDetail.lead.address}, {[leadDetail.lead.city, leadDetail.lead.state, leadDetail.lead.zip].filter(Boolean).join(", ")}
              </div>
              <div style={{ color: "#3a5a3a", fontSize: 12, marginTop: 4 }}>Submitted {formatDate(leadDetail.lead.created_at)}</div>
            </div>

            {/* Quick actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {leadDetail.lead.status === "new" && (
                <button onClick={() => updateStatus(leadDetail.lead.id, "reviewing")} style={{
                  padding: "8px 16px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #ffa726, #e65100)", color: "#fff",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Start Reviewing</button>
              )}
              {["new", "reviewing"].includes(leadDetail.lead.status) && (
                <button onClick={() => updateStatus(leadDetail.lead.id, "quoted")} style={{
                  padding: "8px 16px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #42a5f5, #1565c0)", color: "#fff",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Mark Quoted</button>
              )}
              {leadDetail.lead.status === "quoted" && (
                <button onClick={() => updateStatus(leadDetail.lead.id, "accepted")} style={{
                  padding: "8px 16px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #66bb6a, #2E7D32)", color: "#fff",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Mark Accepted</button>
              )}
              {leadDetail.lead.status === "accepted" && (
                <button onClick={() => convertToJob(leadDetail.lead.id)} style={{
                  padding: "8px 16px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 2px 12px rgba(76,175,80,0.3)",
                }}>🔧 Convert to Job</button>
              )}
              {leadDetail.lead.status !== "declined" && leadDetail.lead.status !== "converted" && (
                <button onClick={() => updateStatus(leadDetail.lead.id, "declined")} style={{
                  padding: "8px 16px", borderRadius: 10, border: "1px solid #1a3a1a",
                  background: "transparent", color: "#ef5350", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Decline</button>
              )}
              
              {/* Delete Lead Button */}
              <button onClick={() => deleteLead(leadDetail.lead.id)} style={{
                padding: "8px 16px", borderRadius: 10, border: "1px solid #1a3a1a",
                background: "transparent", color: "#ef5350", fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                🗑️ Delete Lead
              </button>
            </div>
          </div>

          {/* Google Maps link */}
          {leadDetail.lead.latitude && leadDetail.lead.longitude && (
            <a href={`https://maps.google.com/?q=${leadDetail.lead.latitude},${leadDetail.lead.longitude}`}
              target="_blank" rel="noreferrer"
              style={{ display: "inline-block", marginTop: 12, padding: "6px 14px", background: "rgba(76,175,80,0.08)", border: "1px solid #1a3a1a", borderRadius: 8, color: "#4CAF50", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              🗺️ Open in Google Maps ↗
            </a>
          )}
        </div>

        {/* Service & Modifiers - "Kitchen Ticket" */}
        <div style={{
          background: "linear-gradient(160deg, #0d1f0d, #091409)", border: "1px solid rgba(76,175,80,0.2)",
          borderRadius: 16, padding: "20px 24px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, color: "#4CAF50", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>
            🎫 Service Ticket
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#e8f5e8", marginBottom: 4 }}>
            {leadDetail.lead.service_requested}
          </div>
          <div style={{ fontSize: 13, color: "#5a8a5a", marginBottom: 12 }}>
            {leadDetail.lead.property_type === "commercial" ? "🏢 Commercial" : "🏡 Residential"}
          </div>

          {Object.entries(leadDetail.lead.modifier_data).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(leadDetail.lead.modifier_data).map(([key, val]) => (
                <div key={key} style={{
                  padding: "6px 12px", background: "rgba(76,175,80,0.08)", border: "1px solid #1a3a1a",
                  borderRadius: 8, fontSize: 13,
                }}>
                  <span style={{ color: "#5a8a5a" }}>{key.replace(/_/g, " ")}: </span>
                  <span style={{ color: "#e8f5e8", fontWeight: 600 }}>{String(val)}</span>
                </div>
              ))}
            </div>
          )}

          {leadDetail.lead.customer_notes && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, fontSize: 14, color: "#c8e0c8", fontStyle: "italic" }}>
              &ldquo;{leadDetail.lead.customer_notes}&rdquo;
            </div>
          )}
        </div>

        {/* Media Gallery */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#4CAF50", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>
            📹 Media ({leadDetail.media.length} files)
          </div>

          {leadDetail.media.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#3a5a3a", border: "1px dashed #1a3a1a", borderRadius: 14 }}>
              No media uploaded with this lead
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {leadDetail.media.map((m) => (
                <MediaCard key={m.id} media={m} getUrl={getMediaUrl} onDelete={deleteMedia} />
              ))}
            </div>
          )}
        </div>

        {/* Quotes section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#4CAF50", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
              📋 Quotes ({leadDetail.quotes.length})
            </div>
            {!showQuoteBuilder && (
              <button onClick={() => { setEditingQuote(null); setShowQuoteBuilder(true); }} style={{
                padding: "6px 14px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>
                + Create Quote
              </button>
            )}
          </div>

          {/* Existing quotes */}
          {leadDetail.quotes.map((q) => (
            <div key={q.id} style={{
              background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 14,
              padding: "16px 20px", marginBottom: 8,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: "#4CAF50" }}>
                      ${q.total_low.toFixed(0)} — ${q.total_high.toFixed(0)}
                    </span>
                    <StatusBadge status={q.status} />
                  </div>
                  {q.notes_to_customer && (
                    <div style={{ marginTop: 6, fontSize: 13, color: "#5a8a5a" }}>{q.notes_to_customer}</div>
                  )}
                  {q.sent_at && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "#3a5a3a" }}>Sent {formatDate(q.sent_at)}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#3a5a3a" }}>{formatDate(q.created_at)}</span>
                  {q.status === "draft" && !showQuoteBuilder && (
                    <>
                      <button onClick={() => { setEditingQuote(q); setShowQuoteBuilder(true); }} style={{
                        padding: "5px 12px", borderRadius: 8, border: "1px solid #2E7D32",
                        background: "transparent", color: "#4CAF50", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}>Edit</button>
                      <button onClick={() => sendExistingQuote(q.id, leadDetail.lead.id)} style={{
                        padding: "5px 12px", borderRadius: 8, border: "none",
                        background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
                        fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}>📧 Send</button>
                    </>
                  )}
                </div>
              </div>

              {/* Line items preview */}
              {q.line_items && q.line_items.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1a3a1a" }}>
                  {q.line_items.map((li, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5a8a5a", marginBottom: 2 }}>
                      <span>{li.service}{li.description ? ` — ${li.description}` : ""} × {li.quantity}</span>
                      <span style={{ color: "#e8f5e8", fontWeight: 600 }}>${(li.unit_price * li.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {leadDetail.quotes.length === 0 && !showQuoteBuilder && (
            <div style={{ padding: "24px", textAlign: "center", color: "#3a5a3a", border: "1px dashed #1a3a1a", borderRadius: 14, fontSize: 13 }}>
              No quotes yet — click <strong style={{ color: "#4CAF50" }}>+ Create Quote</strong> to build one
            </div>
          )}
        </div>

        {/* Quote Builder (inline) */}
        {showQuoteBuilder && (
          <QuoteBuilder
            leadId={leadDetail.lead.id}
            userId={userId}
            existingQuote={editingQuote || undefined}
            onSaved={() => {
              showToast(editingQuote ? "Quote saved!" : "Quote saved as draft");
              fetchLeadDetail(leadDetail.lead.id);
            }}
            onClose={() => { setShowQuoteBuilder(false); setEditingQuote(null); }}
          />
        )}

        {/* Danger Zone */}
        <div style={{
          marginTop: 32, padding: "20px 24px", background: "rgba(239,83,80,0.05)",
          border: "1px solid rgba(239,83,80,0.2)", borderRadius: 16,
        }}>
          <div style={{ fontSize: 12, color: "#ef5350", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>
            ⚠️ Danger Zone
          </div>
          <div style={{ color: "#c8e0c8", fontSize: 14, marginBottom: 16 }}>
            Permanently delete this lead and all associated media files. This action cannot be undone.
          </div>
          <button onClick={() => {
            if (window.confirm("⚠️ WARNING: This will permanently delete:\n\n• All media files (videos/photos)\n• All quotes\n• The lead record\n\nThis action cannot be undone. Type 'DELETE' to confirm:")) {
              const userInput = prompt("Type 'DELETE' to confirm permanent deletion:");
              if (userInput === "DELETE") {
                deleteLead(leadDetail.lead.id);
              } else {
                showToast("Deletion cancelled", "error");
              }
            }
          }} style={{
            padding: "10px 20px", borderRadius: 10, border: "1px solid #ef5350",
            background: "transparent", color: "#ef5350", fontSize: 14, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            🗑️ Delete Entire Lead
          </button>
        </div>
      </div>
    );
  }

  // ─── RENDER: Lead List View ───
  return (
    <div>
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 800 }}>
          Video Quotes
        </h1>

        {/* Status filter chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { value: "", label: "All", count: Object.values(counts).reduce((a, b) => a + b, 0) },
            { value: "new", label: "New", count: counts["new"] || 0 },
            { value: "reviewing", label: "Reviewing", count: counts["reviewing"] || 0 },
            { value: "quoted", label: "Quoted", count: counts["quoted"] || 0 },
            { value: "accepted", label: "Accepted", count: counts["accepted"] || 0 },
          ].map((f) => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)} style={{
              padding: "6px 14px", borderRadius: 20, border: `1px solid ${statusFilter === f.value ? "#4CAF50" : "#1a3a1a"}`,
              background: statusFilter === f.value ? "rgba(76,175,80,0.12)" : "transparent",
              color: statusFilter === f.value ? "#4CAF50" : "#5a8a5a",
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {f.label}
              {f.count > 0 && (
                <span style={{
                  background: statusFilter === f.value ? "#4CAF50" : "#1a3a1a",
                  color: statusFilter === f.value ? "#fff" : "#5a8a5a",
                  padding: "1px 6px", borderRadius: 10, fontSize: 10, fontWeight: 800,
                }}>{f.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#3a5a3a" }}>Loading leads...</div>
      ) : leads.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px", border: "1px dashed #1a3a1a",
          borderRadius: 16, color: "#3a5a3a",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📹</div>
          <div style={{ fontSize: 16, color: "#5a8a5a", marginBottom: 8 }}>No video quote leads yet</div>
          <div style={{ fontSize: 13 }}>
            Share <span style={{ color: "#4CAF50", fontWeight: 600 }}>jhpsfl.com/get-quote</span> to start receiving leads
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {leads.map((lead) => (
            <div key={lead.id} onClick={() => fetchLeadDetail(lead.id)} style={{
              background: "linear-gradient(160deg, #0d1f0d, #091409)", border: "1px solid #1a3a1a",
              borderRadius: 14, padding: "16px 20px", cursor: "pointer", transition: "all 0.2s",
              borderLeft: lead.status === "new" ? "3px solid #26c6da" : lead.status === "reviewing" ? "3px solid #ffa726" : "3px solid transparent",
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#4CAF50"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = "#1a3a1a"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#e8f5e8" }}>{lead.name}</span>
                    <StatusBadge status={lead.status} />
                  </div>
                  <div style={{ fontSize: 13, color: "#5a8a5a" }}>
                    {lead.service_requested} · {lead.property_type} · {lead.address}
                  </div>
                  <div style={{ fontSize: 12, color: "#3a5a3a", marginTop: 4 }}>
                    {timeAgo(lead.created_at)}
                    {lead.lead_media && lead.lead_media.length > 0 && (
                      <span> · 📎 {lead.lead_media.length} file{lead.lead_media.length > 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
                <span style={{ color: "#4CAF50", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>View →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Quote Builder ───
interface LineItemRow {
  service: string;
  description: string;
  quantity: number;
  unit_price: number;
}

const emptyRow = (): LineItemRow => ({ service: "", description: "", quantity: 1, unit_price: 0 });

function QuoteBuilder({
  leadId,
  userId,
  existingQuote,
  onSaved,
  onClose,
}: {
  leadId: string;
  userId: string;
  existingQuote?: LeadQuote;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<LineItemRow[]>(
    existingQuote?.line_items?.length
      ? existingQuote.line_items.map((li) => ({
          service: li.service,
          description: li.description || "",
          quantity: li.quantity,
          unit_price: li.unit_price,
        }))
      : [emptyRow()]
  );
  const [totalLow, setTotalLow] = useState(existingQuote?.total_low?.toString() || "");
  const [totalHigh, setTotalHigh] = useState(existingQuote?.total_high?.toString() || "");
  const [notes, setNotes] = useState(existingQuote?.notes_to_customer || "");
  const [internalNotes, setInternalNotes] = useState(existingQuote?.internal_notes || "");
  const [validUntil, setValidUntil] = useState(
    existingQuote?.valid_until ? existingQuote.valid_until.split("T")[0] : ""
  );
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to form on mount
  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const subtotal = rows.reduce((sum, r) => sum + r.unit_price * (r.quantity || 1), 0);

  const updateRow = (i: number, field: keyof LineItemRow, val: string | number) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const buildPayload = () => ({
    clerk_user_id: userId,
    action: "create_quote",
    payload: {
      lead_id: leadId,
      line_items: rows.filter((r) => r.service.trim()),
      total_low: parseFloat(totalLow) || 0,
      total_high: parseFloat(totalHigh) || 0,
      notes_to_customer: notes.trim() || null,
      internal_notes: internalNotes.trim() || null,
      valid_until: validUntil || null,
    },
  });

  const saveDraft = async () => {
    if (!rows.some((r) => r.service.trim())) return;
    setSaving(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (res.ok) { onSaved(); onClose(); }
    } finally {
      setSaving(false);
    }
  };

  const sendQuote = async () => {
    if (!rows.some((r) => r.service.trim())) return;
    setSending(true);
    try {
      // Create the quote first
      const createRes = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!createRes.ok) { setSending(false); return; }
      const { data: newQuote } = await createRes.json();

      // Then send it
      const sendRes = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_user_id: userId,
          action: "send_quote",
          payload: { quote_id: newQuote.id, lead_id: leadId },
        }),
      });
      if (sendRes.ok) { onSaved(); onClose(); }
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 8,
    color: "#e8f5e8", fontSize: 13, padding: "7px 10px", outline: "none",
    fontFamily: "inherit", width: "100%", boxSizing: "border-box",
  };

  return (
    <div ref={formRef} style={{
      background: "linear-gradient(160deg, #0a1f0a, #061206)",
      border: "1px solid rgba(76,175,80,0.35)", borderRadius: 16,
      padding: "20px 24px", marginBottom: 20, animation: "fadeIn 0.25s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: "#4CAF50", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {existingQuote ? "✏️ Edit Quote" : "📝 New Quote"}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a8a5a", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>

      {/* Line items table */}
      <div style={{ marginBottom: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr>
              {["Service", "Description", "Qty", "Unit Price", "Line Total", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", fontSize: 11, color: "#4CAF50", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", padding: "4px 6px", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={{ padding: "4px 6px 4px 0", width: "25%" }}>
                  <input value={row.service} onChange={(e) => updateRow(i, "service", e.target.value)}
                    placeholder="Service name" style={inputStyle} />
                </td>
                <td style={{ padding: "4px 6px", width: "30%" }}>
                  <input value={row.description} onChange={(e) => updateRow(i, "description", e.target.value)}
                    placeholder="Optional detail" style={inputStyle} />
                </td>
                <td style={{ padding: "4px 6px", width: "8%" }}>
                  <input type="number" min="1" value={row.quantity} onChange={(e) => updateRow(i, "quantity", parseInt(e.target.value) || 1)}
                    style={{ ...inputStyle, textAlign: "center" }} />
                </td>
                <td style={{ padding: "4px 6px", width: "16%" }}>
                  <input type="number" min="0" step="0.01" value={row.unit_price || ""} onChange={(e) => updateRow(i, "unit_price", parseFloat(e.target.value) || 0)}
                    placeholder="0.00" style={{ ...inputStyle, textAlign: "right" }} />
                </td>
                <td style={{ padding: "4px 6px", width: "14%", color: "#e8f5e8", fontSize: 13, fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>
                  ${(row.unit_price * (row.quantity || 1)).toFixed(2)}
                </td>
                <td style={{ padding: "4px 0 4px 6px", width: "7%" }}>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "#ef5350", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button onClick={addRow} style={{
          marginTop: 8, padding: "5px 14px", background: "transparent",
          border: "1px dashed #1a3a1a", borderRadius: 8, color: "#5a8a5a",
          fontSize: 12, cursor: "pointer", fontFamily: "inherit",
        }}>+ Add line item</button>
      </div>

      {/* Subtotal indicator */}
      <div style={{ fontSize: 13, color: "#5a8a5a", marginBottom: 16, textAlign: "right" }}>
        Subtotal: <span style={{ color: "#e8f5e8", fontWeight: 700 }}>${subtotal.toFixed(2)}</span>
      </div>

      {/* Price range */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>
            Total Low ($)
          </label>
          <input type="number" min="0" step="1" value={totalLow} onChange={(e) => setTotalLow(e.target.value)}
            placeholder="e.g. 350" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>
            Total High ($)
          </label>
          <input type="number" min="0" step="1" value={totalHigh} onChange={(e) => setTotalHigh(e.target.value)}
            placeholder="e.g. 450" style={inputStyle} />
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>
          Notes to Customer <span style={{ color: "#3a5a3a", fontWeight: 400 }}>(appears in email)</span>
        </label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Any details, conditions, or context you want the customer to see..."
          rows={3} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>
          Internal Notes <span style={{ color: "#3a5a3a", fontWeight: 400 }}>(admin only — never emailed)</span>
        </label>
        <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="Notes for the team only..."
          rows={2} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 11, color: "#5a8a5a", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>
          Valid Until
        </label>
        <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
          style={{ ...inputStyle, width: "auto", minWidth: 180 }} />
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={saveDraft} disabled={saving || sending} style={{
          padding: "10px 22px", borderRadius: 10, border: "1px solid #2E7D32",
          background: "transparent", color: "#4CAF50", fontSize: 13, fontWeight: 700,
          cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: "inherit",
        }}>
          {saving ? "Saving..." : "💾 Save Draft"}
        </button>

        <button onClick={sendQuote} disabled={saving || sending} style={{
          padding: "10px 22px", borderRadius: 10, border: "none",
          background: saving || sending ? "#1a3a1a" : "linear-gradient(135deg, #4CAF50, #2E7D32)",
          color: "#fff", fontSize: 13, fontWeight: 700,
          cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1, fontFamily: "inherit",
          boxShadow: "0 2px 12px rgba(76,175,80,0.3)",
        }}>
          {sending ? "Sending email..." : "📧 Send to Customer"}
        </button>

        <button onClick={onClose} style={{
          padding: "10px 22px", borderRadius: 10, border: "1px solid #1a3a1a",
          background: "transparent", color: "#5a8a5a", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
        }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Media Card (loads signed URL on demand) ───
function MediaCard({ media, getUrl, onDelete }: { 
  media: LeadMedia; 
  getUrl: (path: string) => Promise<string>;
  onDelete: (mediaId: string) => Promise<void>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadUrl = async () => {
    if (url || loading) return;
    setLoading(true);
    const signed = await getUrl(media.storage_path);
    setUrl(signed);
    setLoading(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(media.id);
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div style={{
      background: "#0a160a", border: "1px solid #1a3a1a", borderRadius: 14,
      overflow: "hidden", position: "relative",
    }}>
      {/* Delete button overlay */}
      <button
        onClick={() => setShowConfirm(true)}
        style={{
          position: "absolute", top: 8, right: 8, zIndex: 10,
          background: "rgba(239,83,80,0.9)", color: "#fff",
          border: "none", borderRadius: "50%", width: 28, height: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 14, fontWeight: "bold",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
        title="Delete media"
      >
        ×
      </button>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 20,
          background: "rgba(5,14,5,0.95)", display: "flex",
          flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: 20, gap: 12,
        }}>
          <div style={{ color: "#e8f5e8", fontSize: 14, fontWeight: 600, textAlign: "center" }}>
            Delete this media file?
          </div>
          <div style={{ color: "#5a8a5a", fontSize: 12, textAlign: "center" }}>
            This cannot be undone. The file will be removed from storage.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: "6px 16px", background: "#ef5350", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: deleting ? "not-allowed" : "pointer",
                opacity: deleting ? 0.7 : 1,
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={deleting}
              style={{
                padding: "6px 16px", background: "transparent", color: "#5a8a5a",
                border: "1px solid #1a3a1a", borderRadius: 8, fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ position: "relative", aspectRatio: "16/9", background: "#050e05" }}>
        {!url ? (
          <button onClick={loadUrl} style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8,
            background: "none", border: "none", cursor: "pointer", color: "#4CAF50",
          }}>
            <span style={{ fontSize: 32 }}>{media.media_type === "video" ? "▶" : "🖼"}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              {loading ? "Loading..." : "Click to load"}
            </span>
          </button>
        ) : media.media_type === "video" ? (
          <video src={url} controls playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={media.capture_context || "Lead media"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>
      <div style={{ padding: "10px 14px" }}>
        <div style={{ fontSize: 12, color: "#5a8a5a", fontWeight: 600 }}>
          {media.capture_context?.replace(/_/g, " ") || media.media_type}
          {media.media_type === "video" && media.duration_seconds && ` · ${media.duration_seconds}s`}
        </div>
        <div style={{ fontSize: 11, color: "#3a5a3a" }}>
          {media.original_filename} · {fileSize(media.file_size_bytes)}
        </div>
      </div>
    </div>
  );
}
