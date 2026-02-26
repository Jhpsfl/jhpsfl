"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
  useAuth,
} from "@clerk/nextjs";
import SquareCardForm, { type SquareCard } from "@/app/components/SquareCardForm";

// ─── Types ───
interface Customer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}
interface JobSite {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
}
interface Job {
  id: string;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  amount: number | null;
}
interface Payment {
  id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  payment_method: string | null;
  square_receipt_url: string | null;
}
interface Subscription {
  id: string;
  plan_name: string;
  service_type: string;
  frequency: string;
  amount: number;
  status: string;
  next_billing_date: string | null;
}
interface Invoice {
  id: string;
  invoice_number: string;
  subtotal: number;
  tax_rate: number | null;
  tax_amount: number | null;
  total: number;
  amount_paid: number | null;
  status: string;
  line_items: { description: string; amount: number }[] | null;
  payment_link: string | null;
  created_at: string;
}
interface StoredCard {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
}

interface DashboardData {
  customer: Customer | null;
  jobSites: JobSite[];
  jobs: Job[];
  payments: Payment[];
  subscriptions: Subscription[];
  invoices: Invoice[];
}

const clerkAppearance = {
  variables: {
    colorPrimary: "#4CAF50",
    colorBackground: "#0d1f0d",
    colorText: "#e8f5e8",
    colorInputBackground: "#0d1a0d",
    colorInputText: "#e8f5e8",
    borderRadius: "12px",
  },
  elements: {
    card: {
      background: "linear-gradient(160deg, #0d1f0d, #091409)",
      border: "1px solid #1a3a1a",
      borderRadius: "20px",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    },
    headerTitle: { color: "#e8f5e8", fontFamily: "'Playfair Display', serif" },
    headerSubtitle: { color: "#7a9a7a" },
    formButtonPrimary: {
      background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
      boxShadow: "0 4px 20px rgba(76,175,80,0.4)",
    },
    footerActionLink: { color: "#4CAF50" },
    formFieldInput: {
      background: "#0d1a0d",
      borderColor: "#1a3a1a",
      color: "#e8f5e8",
    },
    socialButtonsIconButton: { borderColor: "#1a3a1a" },
    dividerLine: { background: "#1a3a1a" },
    dividerText: { color: "#5a8a5a" },
  },
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    scheduled: { bg: "rgba(33,150,243,0.15)", text: "#42a5f5" },
    in_progress: { bg: "rgba(255,167,38,0.15)", text: "#ffa726" },
    completed: { bg: "rgba(76,175,80,0.15)", text: "#66bb6a" },
    cancelled: { bg: "rgba(239,83,80,0.1)", text: "#ef5350" },
    active: { bg: "rgba(76,175,80,0.15)", text: "#66bb6a" },
    pending: { bg: "rgba(255,167,38,0.15)", text: "#ffa726" },
    failed: { bg: "rgba(239,83,80,0.1)", text: "#ef5350" },
    paused: { bg: "rgba(255,167,38,0.15)", text: "#ffa726" },
    draft: { bg: "rgba(158,158,158,0.12)", text: "#9e9e9e" },
    sent: { bg: "rgba(33,150,243,0.15)", text: "#42a5f5" },
    paid: { bg: "rgba(76,175,80,0.15)", text: "#66bb6a" },
    overdue: { bg: "rgba(239,83,80,0.15)", text: "#ef5350" },
  };
  const c = colors[status] || { bg: "rgba(255,255,255,0.08)", text: "#aaa" };
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      letterSpacing: 0.8, textTransform: "uppercase",
      background: c.bg, color: c.text,
    }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// Build a /pay URL pre-filled with all customer info from the portal
function buildPayUrl(
  inv: Invoice,
  customer: Customer | null,
  jobSites: JobSite[],
): string {
  const params = new URLSearchParams();
  params.set("invoice", inv.invoice_number);
  params.set("amount", inv.total.toFixed(2));
  if (customer?.name) params.set("name", customer.name);
  if (customer?.email) params.set("email", customer.email);
  if (customer?.phone) params.set("phone", customer.phone);
  // Use primary job site address
  const site = jobSites[0];
  if (site?.address) params.set("address", site.address);
  if (site?.city) params.set("city", site.city);
  if (site?.zip) params.set("zip", site.zip);
  // Line item descriptions
  const lineDescs = (inv.line_items || []).map(l => l.description).filter(Boolean);
  if (lineDescs[0]) params.set("service", lineDescs[0]);
  if (lineDescs.length > 1) params.set("description", lineDescs.join(", "));
  return `/pay?${params.toString()}`;
}

function DashboardView() {
  const { userId } = useAuth();
  const { user } = useUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<StoredCard[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardFormCard, setCardFormCard] = useState<SquareCard | null>(null);
  const [cardSaving, setCardSaving] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardActionLoading, setCardActionLoading] = useState<string | null>(null);

  const fetchCards = () => {
    if (!userId) return;
    fetch(`/api/cards?clerk_user_id=${userId}`)
      .then((r) => r.json())
      .then((d) => setCards(d.cards || []))
      .catch(() => {});
  };

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/customer/dashboard?clerk_user_id=${userId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    fetchCards();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddCard = async () => {
    if (!cardFormCard || cardSaving || !userId) return;
    setCardSaving(true);
    setCardError(null);
    try {
      const tokenResult = await cardFormCard.tokenize();
      if (tokenResult.status !== "OK") {
        setCardError(tokenResult.errors?.map(e => e.message).join(", ") || "Card verification failed");
        setCardSaving(false);
        return;
      }
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerk_user_id: userId, cardToken: tokenResult.token }),
      });
      const result = await res.json();
      if (result.success) {
        fetchCards();
        setShowAddCard(false);
        setCardFormCard(null);
      } else {
        setCardError(result.error || "Failed to save card");
      }
    } catch {
      setCardError("An unexpected error occurred");
    } finally {
      setCardSaving(false);
    }
  };

  const handleRemoveCard = async (cardId: string) => {
    if (!userId) return;
    setCardActionLoading(cardId);
    try {
      const res = await fetch("/api/cards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerk_user_id: userId, cardId }),
      });
      const result = await res.json();
      if (result.success) fetchCards();
    } catch { /* ignore */ }
    setCardActionLoading(null);
  };

  const handleSetDefault = async (cardId: string) => {
    if (!userId) return;
    setCardActionLoading(cardId);
    try {
      const res = await fetch("/api/cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerk_user_id: userId, cardId }),
      });
      const result = await res.json();
      if (result.success) fetchCards();
    } catch { /* ignore */ }
    setCardActionLoading(null);
  };

  const displayName = data?.customer?.name || user?.fullName || "Customer";

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "#5a8a5a" }}>
        <div style={{ fontSize: 32, marginBottom: 12, animation: "pulse 2s infinite" }}>🌿</div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ animation: "slideUp 0.5s ease" }}>
      {/* Welcome header */}
      <div style={{
        background: "linear-gradient(160deg, #0d1f0d, #091409)",
        border: "1px solid #1a3a1a", borderRadius: 20,
        padding: "28px 32px", marginBottom: 24,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <p style={{ fontSize: 13, color: "#5a8a5a", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>WELCOME BACK</p>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 700, marginBottom: 4 }}>
            {displayName}
          </h2>
          <p style={{ color: "#5a8a5a", fontSize: 14 }}>{user?.emailAddresses[0]?.emailAddress}</p>
        </div>
        <UserButton appearance={{ elements: { avatarBox: { width: 52, height: 52 } } }} />
      </div>

      {/* Subscriptions */}
      {data?.subscriptions && data.subscriptions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, letterSpacing: 2, color: "#4CAF50", fontWeight: 700, marginBottom: 12 }}>ACTIVE PLANS</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.subscriptions.map((sub) => (
              <div key={sub.id} style={{
                background: "linear-gradient(160deg, #0d1f0d, #091409)",
                border: "1px solid #1a3a1a", borderRadius: 16, padding: "20px 24px",
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
              }}>
                <div>
                  <p style={{ color: "#e8f5e8", fontWeight: 700, marginBottom: 4 }}>{sub.plan_name}</p>
                  <p style={{ color: "#5a8a5a", fontSize: 13 }}>{sub.service_type} · {sub.frequency}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: "#4CAF50", fontWeight: 700, fontSize: 18 }}>${sub.amount}/mo</p>
                  <StatusBadge status={sub.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, letterSpacing: 2, color: "#4CAF50", fontWeight: 700, marginBottom: 12 }}>INVOICES</h3>
        {data?.invoices && data.invoices.length > 0 ? (
          <>
            {/* Pending / Sent / Overdue invoices first */}
            {data.invoices.filter(inv => ["sent", "overdue", "draft"].includes(inv.status)).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: "#ffa726", fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>PENDING</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.invoices.filter(inv => ["sent", "overdue", "draft"].includes(inv.status)).map((inv) => (
                    <div key={inv.id} style={{
                      background: "linear-gradient(160deg, #0d1f0d, #091409)",
                      border: inv.status === "overdue" ? "1px solid rgba(239,83,80,0.3)" : "1px solid #1a3a1a",
                      borderRadius: 14, padding: "16px 20px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                        <div>
                          <p style={{ color: "#e8f5e8", fontWeight: 700, marginBottom: 2 }}>Invoice #{inv.invoice_number}</p>
                          <p style={{ color: "#5a8a5a", fontSize: 12 }}>
                            {new Date(inv.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ color: "#ffa726", fontWeight: 700, fontSize: 18 }}>${inv.total.toFixed(2)}</p>
                          <StatusBadge status={inv.status} />
                        </div>
                      </div>
                      {inv.line_items && inv.line_items.length > 0 && (
                        <div style={{ borderTop: "1px solid #1a3a1a", paddingTop: 8, marginTop: 4 }}>
                          {inv.line_items.map((item, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5a8a5a", padding: "2px 0" }}>
                              <span>{item.description}</span>
                              <span>${item.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <a href={buildPayUrl(inv, data?.customer ?? null, data?.jobSites ?? [])} style={{
                        display: "inline-block", marginTop: 10,
                        background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
                        padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                        textDecoration: "none",
                      }}>
                        Pay Now
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Paid / Cancelled invoices */}
            {data.invoices.filter(inv => ["paid", "cancelled"].includes(inv.status)).length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: "#66bb6a", fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>COMPLETED</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.invoices.filter(inv => ["paid", "cancelled"].includes(inv.status)).map((inv) => (
                    <div key={inv.id} style={{
                      background: "linear-gradient(160deg, #0d1f0d, #091409)",
                      border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 20px",
                      display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
                    }}>
                      <div>
                        <p style={{ color: "#e8f5e8", fontWeight: 600, marginBottom: 2 }}>Invoice #{inv.invoice_number}</p>
                        <p style={{ color: "#5a8a5a", fontSize: 12 }}>{new Date(inv.created_at).toLocaleDateString()}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ color: "#4CAF50", fontWeight: 700 }}>${inv.total.toFixed(2)}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{
            background: "linear-gradient(160deg, #0d1f0d, #091409)",
            border: "1px solid #1a3a1a", borderRadius: 14, padding: "24px",
            textAlign: "center", color: "#3a5a3a",
          }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>📄</p>
            <p style={{ fontSize: 14 }}>No invoices yet.</p>
          </div>
        )}
      </div>

      {/* Payment Methods */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, letterSpacing: 2, color: "#4CAF50", fontWeight: 700 }}>PAYMENT METHODS</h3>
          {!showAddCard && (
            <button onClick={() => { setShowAddCard(true); setCardError(null); }} style={{
              background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.3)",
              borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600,
              color: "#4CAF50", cursor: "pointer", fontFamily: "inherit",
            }}>+ Add Card</button>
          )}
        </div>

        {cards.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cards.map((card) => (
              <div key={card.id} style={{
                background: "linear-gradient(160deg, #0d1f0d, #091409)",
                border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22 }}>💳</span>
                  <div>
                    <p style={{ color: "#e8f5e8", fontWeight: 600, marginBottom: 2 }}>
                      {card.brand || "Card"} ····{card.last4 || "????"}
                      {card.is_default && (
                        <span style={{
                          marginLeft: 8, padding: "2px 8px", background: "rgba(76,175,80,0.15)",
                          borderRadius: 10, fontSize: 10, fontWeight: 700, color: "#66bb6a", letterSpacing: 0.5,
                        }}>DEFAULT</span>
                      )}
                    </p>
                    <p style={{ color: "#5a8a5a", fontSize: 12 }}>
                      Expires {card.exp_month ? `${String(card.exp_month).padStart(2, "0")}/${card.exp_year}` : "—"}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!card.is_default && (
                    <button
                      onClick={() => handleSetDefault(card.id)}
                      disabled={cardActionLoading === card.id}
                      style={{
                        background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.2)",
                        borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 600,
                        color: "#4CAF50", cursor: "pointer", fontFamily: "inherit",
                        opacity: cardActionLoading === card.id ? 0.5 : 1,
                      }}
                    >Set Default</button>
                  )}
                  <button
                    onClick={() => handleRemoveCard(card.id)}
                    disabled={cardActionLoading === card.id}
                    style={{
                      background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.2)",
                      borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 600,
                      color: "#ef5350", cursor: "pointer", fontFamily: "inherit",
                      opacity: cardActionLoading === card.id ? 0.5 : 1,
                    }}
                  >Remove</button>
                </div>
              </div>
            ))}
          </div>
        ) : !showAddCard ? (
          <div style={{
            background: "linear-gradient(160deg, #0d1f0d, #091409)",
            border: "1px solid #1a3a1a", borderRadius: 14, padding: "24px",
            textAlign: "center", color: "#3a5a3a",
          }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>💳</p>
            <p style={{ fontSize: 14 }}>No cards on file. Add a card for faster payments.</p>
          </div>
        ) : null}

        {showAddCard && (
          <div style={{
            background: "linear-gradient(160deg, #0d1f0d, #091409)",
            border: "1px solid #1a3a1a", borderRadius: 16, padding: "24px",
            marginTop: cards.length > 0 ? 12 : 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#8aba8a" }}>Add New Card</span>
              <button onClick={() => { setShowAddCard(false); setCardError(null); setCardFormCard(null); }} style={{
                background: "none", border: "none", color: "#5a8a5a", fontSize: 18, cursor: "pointer",
              }}>✕</button>
            </div>

            <SquareCardForm
              containerId="sq-card-portal"
              onReady={(card) => setCardFormCard(card)}
              onError={(msg) => setCardError(msg)}
            />

            {cardError && (
              <div style={{
                marginTop: 12, padding: "10px 14px", background: "rgba(244,67,54,0.08)",
                borderRadius: 8, border: "1px solid rgba(244,67,54,0.2)",
                fontSize: 12, color: "#ef9a9a",
              }}>
                {cardError}
              </div>
            )}

            <button
              onClick={handleAddCard}
              disabled={!cardFormCard || cardSaving}
              style={{
                marginTop: 16, width: "100%", padding: "14px",
                background: cardFormCard && !cardSaving ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "#1a3a1a",
                color: cardFormCard && !cardSaving ? "#fff" : "#5a8a5a",
                border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
                cursor: cardFormCard && !cardSaving ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}
            >
              {cardSaving ? "Saving..." : "Save Card"}
            </button>
          </div>
        )}
      </div>

      {/* Job Sites */}
      {data?.jobSites && data.jobSites.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, letterSpacing: 2, color: "#4CAF50", fontWeight: 700, marginBottom: 12 }}>YOUR PROPERTIES</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.jobSites.map((site) => (
              <div key={site.id} style={{
                background: "linear-gradient(160deg, #0d1f0d, #091409)",
                border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 20px",
              }}>
                <p style={{ color: "#e8f5e8", fontWeight: 600 }}>{site.address}</p>
                <p style={{ color: "#5a8a5a", fontSize: 13 }}>{[site.city, site.state, site.zip].filter(Boolean).join(", ")}</p>
                {site.notes && <p style={{ color: "#4a7a4a", fontSize: 12, marginTop: 4 }}>{site.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, letterSpacing: 2, color: "#4CAF50", fontWeight: 700, marginBottom: 12 }}>RECENT JOBS</h3>
        {data?.jobs && data.jobs.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.jobs.map((job) => (
              <div key={job.id} style={{
                background: "linear-gradient(160deg, #0d1f0d, #091409)",
                border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
              }}>
                <div>
                  <p style={{ color: "#e8f5e8", fontWeight: 600, marginBottom: 4 }}>{job.service_type}</p>
                  <p style={{ color: "#5a8a5a", fontSize: 12 }}>
                    {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : "Date TBD"}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {job.amount && <span style={{ color: "#4CAF50", fontWeight: 700 }}>${job.amount}</span>}
                  <StatusBadge status={job.status} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: "linear-gradient(160deg, #0d1f0d, #091409)",
            border: "1px solid #1a3a1a", borderRadius: 14, padding: "24px",
            textAlign: "center", color: "#3a5a3a",
          }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>📋</p>
            <p style={{ fontSize: 14 }}>No jobs yet. We&apos;ll list your service visits here.</p>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 13, letterSpacing: 2, color: "#4CAF50", fontWeight: 700, marginBottom: 12 }}>PAYMENT HISTORY</h3>
        {data?.payments && data.payments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.payments.map((pmt) => (
              <div key={pmt.id} style={{
                background: "linear-gradient(160deg, #0d1f0d, #091409)",
                border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
              }}>
                <div>
                  <p style={{ color: "#e8f5e8", fontWeight: 700, fontSize: 18 }}>${pmt.amount}</p>
                  <p style={{ color: "#5a8a5a", fontSize: 12 }}>
                    {pmt.paid_at ? new Date(pmt.paid_at).toLocaleDateString() : "Pending"}{pmt.payment_method ? ` · ${pmt.payment_method}` : ""}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StatusBadge status={pmt.status} />
                  {pmt.square_receipt_url && (
                    <a href={pmt.square_receipt_url} target="_blank" rel="noreferrer" style={{ color: "#4CAF50", fontSize: 12, fontWeight: 600 }}>Receipt ↗</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: "linear-gradient(160deg, #0d1f0d, #091409)",
            border: "1px solid #1a3a1a", borderRadius: 14, padding: "24px",
            textAlign: "center", color: "#3a5a3a",
          }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>💰</p>
            <p style={{ fontSize: 14 }}>No payments recorded yet.</p>
          </div>
        )}
      </div>

      {/* Quick Pay CTA */}
      <div style={{ textAlign: "center" }}>
        <Link href={(() => {
          const params = new URLSearchParams();
          if (data?.customer?.name) params.set("name", data.customer.name);
          if (data?.customer?.email) params.set("email", data.customer.email);
          if (data?.customer?.phone) params.set("phone", data.customer.phone);
          const site = data?.jobSites?.[0];
          if (site?.address) params.set("address", site.address);
          if (site?.city) params.set("city", site.city);
          if (site?.zip) params.set("zip", site.zip);
          const q = params.toString();
          return q ? `/pay?${q}` : "/pay";
        })()} style={{
          background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
          padding: "16px 40px", borderRadius: 14, fontSize: 16, fontWeight: 700,
          textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
          boxShadow: "0 4px 20px rgba(76,175,80,0.35)",
        }}>
          💳 Make a Payment
        </Link>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Playfair+Display:wght@400;600;700;800&display=swap');

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: #050e05; color: #c8e0c8; overflow-x: hidden; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: none; } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

        .nav-blur { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }

        .tab-btn {
          flex: 1; padding: 12px 20px; border: none; font-size: 15px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.3s;
          border-radius: 10px; background: transparent; color: #5a8a5a;
        }
        .tab-btn.active {
          background: linear-gradient(135deg, rgba(76,175,80,0.15), rgba(46,125,50,0.1));
          color: #4CAF50;
          box-shadow: inset 0 0 0 1px rgba(76,175,80,0.3);
        }

        .mobile-menu {
          position: fixed; inset: 0; z-index: 9997;
          background: rgba(5,14,5,0.98); backdrop-filter: blur(20px);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px;
          animation: fadeIn 0.3s ease;
        }
        .mobile-menu a { color: #e8f5e8; font-size: 28px; font-weight: 600; text-decoration: none; font-family: 'Playfair Display', serif; }

        .noise-overlay {
          position: fixed; inset: 0; pointer-events: none; z-index: 9990; opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        /* Clerk component overrides */
        .cl-rootBox { width: 100%; }
        .cl-card { background: transparent !important; box-shadow: none !important; border: none !important; }

        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-hamburger { display: flex !important; }
        }
      `}</style>

      <div className="noise-overlay" />

      {/* ─── NAVIGATION ─── */}
      <nav className="nav-blur" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9996,
        background: "rgba(5,14,5,0.92)",
        borderBottom: "1px solid rgba(76,175,80,0.15)",
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jhps-nav-logo.svg" alt="JHPS Florida" style={{ maxWidth: 200, height: "auto", maxHeight: 44 }} />
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 28 }} className="desktop-nav">
            <Link href="/" style={{ color: "#8aba8a", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>← Home</Link>
            <Link href="/pay" style={{ color: "#8aba8a", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>Make Payment</Link>
            <SignedIn>
              <UserButton afterSignOutUrl="/account" />
            </SignedIn>
            <SignedOut>
              <a href="tel:4076869817" style={{
                background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
                padding: "10px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none",
              }}>📞 Call Us</a>
            </SignedOut>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            display: "none", background: "none", border: "none", cursor: "pointer",
            flexDirection: "column", gap: 5, padding: 8,
          }} className="mobile-hamburger">
            <span style={{ width: 24, height: 2, background: "#4CAF50", borderRadius: 2, display: "block" }} />
            <span style={{ width: 24, height: 2, background: "#4CAF50", borderRadius: 2, display: "block" }} />
            <span style={{ width: 24, height: 2, background: "#4CAF50", borderRadius: 2, display: "block" }} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="mobile-menu">
          <button onClick={() => setMenuOpen(false)} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", color: "#4CAF50", fontSize: 32, cursor: "pointer" }}>✕</button>
          <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/pay" onClick={() => setMenuOpen(false)}>Make Payment</Link>
          <a href="tel:4076869817">📞 407-686-9817</a>
        </div>
      )}

      {/* ─── MAIN ─── */}
      <main style={{ minHeight: "100vh", paddingTop: 72, background: "linear-gradient(170deg, #050e05 0%, #081808 40%, #050e05 100%)" }}>
        <div style={{ position: "fixed", top: "15%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(76,175,80,0.04), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "fixed", bottom: "10%", left: "-10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(46,125,50,0.03), transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px 80px", position: "relative", zIndex: 1 }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 40, animation: "slideUp 0.6s ease" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px",
              background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.2)",
              borderRadius: 40, marginBottom: 20,
            }}>
              <span style={{ fontSize: 16 }}>👤</span>
              <span style={{ fontSize: 13, color: "#4CAF50", fontWeight: 600, letterSpacing: 1 }}>CUSTOMER PORTAL</span>
            </div>
            <h1 style={{
              fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 800,
              color: "#e8f5e8", lineHeight: 1.15, marginBottom: 12,
            }}>
              Your{" "}
              <span style={{
                background: "linear-gradient(135deg, #4CAF50, #81C784, #4CAF50)",
                backgroundSize: "200% 200%", animation: "gradientShift 4s ease infinite",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Account</span>
            </h1>
          </div>

          {/* ─── SIGNED OUT: Buttons to dedicated auth pages ─── */}
          <SignedOut>
            <div style={{ animation: "slideUp 0.7s ease 0.1s both" }}>
              <div style={{
                background: "linear-gradient(160deg, #0d1f0d, #091409)",
                border: "1px solid #1a3a1a", borderRadius: 20, padding: "40px 32px",
                textAlign: "center",
              }}>
                <p style={{ color: "#7a9a7a", fontSize: 15, marginBottom: 32 }}>
                  Sign in to view your jobs, payments, and service history.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Link href="/sign-in" style={{
                    background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
                    padding: "16px", borderRadius: 14, fontSize: 16, fontWeight: 700,
                    textDecoration: "none", display: "block",
                    boxShadow: "0 4px 20px rgba(76,175,80,0.35)",
                  }}>
                    Sign In
                  </Link>
                  <Link href="/sign-up" style={{
                    background: "transparent", color: "#4CAF50",
                    border: "1px solid #2a5a2a",
                    padding: "15px", borderRadius: 14, fontSize: 16, fontWeight: 600,
                    textDecoration: "none", display: "block",
                  }}>
                    Create Account
                  </Link>
                </div>
              </div>

              <p style={{ textAlign: "center", color: "#3a5a3a", fontSize: 13, marginTop: 24 }}>
                Need help?{" "}
                <a href="tel:4076869817" style={{ color: "#4CAF50", textDecoration: "none", fontWeight: 600 }}>Call us at 407-686-9817</a>
              </p>
            </div>
          </SignedOut>

          {/* ─── SIGNED IN: Dashboard ─── */}
          <SignedIn>
            <DashboardView />
          </SignedIn>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: "#030a03", borderTop: "1px solid #1a3a1a", padding: "40px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jhps-nav-logo.svg" alt="JHPS" style={{ maxWidth: 160, height: "auto", maxHeight: 36, opacity: 0.7 }} />
          </Link>
          <div style={{ display: "flex", gap: 24 }}>
            <a href="tel:4076869817" style={{ color: "#4CAF50", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>📞 407-686-9817</a>
            <a href="mailto:Info@jhpsfl.com" style={{ color: "#4CAF50", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>✉️ Email</a>
          </div>
          <div style={{ color: "#2a4a2a", fontSize: 12, width: "100%", textAlign: "center", marginTop: 16 }}>
            © 2025 Jenkins Home & Property Solutions. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
