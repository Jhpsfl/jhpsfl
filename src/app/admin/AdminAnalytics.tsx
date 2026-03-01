"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

// ─── Types ───────────────────────────────────────────────────
interface Payment { amount: number; status: string; payment_method: string | null; created_at: string; paid_at: string | null; }
interface Invoice { amount_due: number; amount_paid: number; status: string; created_at: string; paid_at: string | null; }
interface Quote { id: string; status: string; total: number; created_at: string; is_commercial: boolean; }
interface Job { id: string; status: string; service_type: string; amount: number | null; created_at: string; completed_date: string | null; }
interface Customer { id: string; customer_type: string | null; created_at: string; }
interface FeedbackRequest { id: string; type: string; status: string; sent_at: string; responded_at: string | null; }
interface FeedbackResponse { id: string; rating: number | null; lost_estimate_reason: string | null; google_review_clicked: boolean; resolution_requested: boolean; }

interface AnalyticsData {
  payments: Payment[];
  invoices: Invoice[];
  quotes: Quote[];
  jobs: Job[];
  customers: Customer[];
  feedbackRequests: FeedbackRequest[];
  feedbackResponses: FeedbackResponse[];
}

// ─── Helpers ─────────────────────────────────────────────────
function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

function formatCurrency(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pct(n: number, d: number): string {
  if (d === 0) return "0%";
  return Math.round((n / d) * 100) + "%";
}

// ─── Component ───────────────────────────────────────────────
export default function AdminAnalytics() {
  const { userId } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"30" | "90" | "all">("all");

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/data?resource=analytics`, { headers: { "x-clerk-user-id": userId } });
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: "60px 20px", color: "#5a8a5a" }}>Loading analytics...</div>;
  }

  if (!data) {
    return <div style={{ textAlign: "center", padding: "60px 20px", color: "#5a3a3a" }}>Failed to load analytics data</div>;
  }

  // ─── Filter by time range ───
  const now = new Date();
  const cutoff = timeRange === "30" ? new Date(now.getTime() - 30 * 86400000)
    : timeRange === "90" ? new Date(now.getTime() - 90 * 86400000)
    : new Date(0);
  const cutoffStr = cutoff.toISOString();

  const payments = data.payments.filter(p => p.created_at >= cutoffStr);
  const invoices = data.invoices.filter(i => i.created_at >= cutoffStr);
  const quotes = data.quotes.filter(q => q.created_at >= cutoffStr);
  const jobs = data.jobs.filter(j => j.created_at >= cutoffStr);
  const customers = data.customers.filter(c => c.created_at >= cutoffStr);

  // ─── Revenue calculations ───
  const totalPaymentRevenue = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalInvoiceRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount_paid || 0), 0);
  const totalRevenue = totalPaymentRevenue + totalInvoiceRevenue;

  // Revenue by month
  const revenueByMonth: Record<string, number> = {};
  payments.forEach(p => {
    const k = getMonthKey(p.paid_at || p.created_at);
    revenueByMonth[k] = (revenueByMonth[k] || 0) + (p.amount || 0);
  });
  invoices.filter(i => i.status === "paid").forEach(i => {
    const k = getMonthKey(i.paid_at || i.created_at);
    revenueByMonth[k] = (revenueByMonth[k] || 0) + (i.amount_paid || 0);
  });
  const revMonths = Object.keys(revenueByMonth).sort();

  // ─── Quote conversion ───
  const totalQuotes = quotes.length;
  const acceptedQuotes = quotes.filter(q => q.status === "accepted").length;
  const declinedQuotes = quotes.filter(q => q.status === "declined").length;
  const expiredQuotes = quotes.filter(q => q.status === "expired").length;
  const pendingQuotes = quotes.filter(q => q.status === "sent" || q.status === "draft").length;
  const conversionRate = totalQuotes > 0 ? (acceptedQuotes / (acceptedQuotes + declinedQuotes + expiredQuotes)) : 0;

  // Quote value analysis
  const acceptedValue = quotes.filter(q => q.status === "accepted").reduce((s, q) => s + (q.total || 0), 0);
  const lostValue = quotes.filter(q => q.status === "declined" || q.status === "expired").reduce((s, q) => s + (q.total || 0), 0);

  // Commercial vs residential quotes
  const commercialQuotes = quotes.filter(q => q.is_commercial);
  const residentialQuotes = quotes.filter(q => !q.is_commercial);

  // ─── Jobs by service type ───
  const serviceTypes: Record<string, { count: number; revenue: number }> = {};
  jobs.forEach(j => {
    const t = j.service_type || "Other";
    if (!serviceTypes[t]) serviceTypes[t] = { count: 0, revenue: 0 };
    serviceTypes[t].count++;
    serviceTypes[t].revenue += j.amount || 0;
  });
  const sortedServices = Object.entries(serviceTypes).sort((a, b) => b[1].revenue - a[1].revenue);

  // ─── Customer growth ───
  const customersByMonth: Record<string, number> = {};
  data.customers.forEach(c => {
    const k = getMonthKey(c.created_at);
    customersByMonth[k] = (customersByMonth[k] || 0) + 1;
  });
  const custMonths = Object.keys(customersByMonth).sort();

  // Commercial vs residential customers
  const commercialCustomers = customers.filter(c => c.customer_type === "commercial").length;
  const residentialCustomers = customers.length - commercialCustomers;

  // ─── Feedback stats ───
  const fbRequests = data.feedbackRequests;
  const fbResponses = data.feedbackResponses;
  const postServiceReqs = fbRequests.filter(f => f.type === "post_service");
  const lostEstimateReqs = fbRequests.filter(f => f.type === "lost_estimate");
  const respondedPostService = postServiceReqs.filter(f => f.status === "responded").length;
  const respondedLostEstimate = lostEstimateReqs.filter(f => f.status === "responded").length;
  const ratings = fbResponses.filter(r => r.rating !== null).map(r => r.rating as number);
  const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;
  const lostReasons: Record<string, number> = {};
  fbResponses.filter(r => r.lost_estimate_reason).forEach(r => {
    lostReasons[r.lost_estimate_reason!] = (lostReasons[r.lost_estimate_reason!] || 0) + 1;
  });

  // ─── Payment methods ───
  const paymentMethods: Record<string, number> = {};
  payments.forEach(p => {
    const m = p.payment_method || "other";
    paymentMethods[m] = (paymentMethods[m] || 0) + 1;
  });

  // ─── Job statuses ───
  const jobCompleted = jobs.filter(j => j.status === "completed").length;
  const jobScheduled = jobs.filter(j => j.status === "scheduled").length;
  const jobInProgress = jobs.filter(j => j.status === "in_progress").length;
  const jobCancelled = jobs.filter(j => j.status === "cancelled").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#e8f5e8", fontWeight: 800, margin: 0 }}>Business Analytics</h2>
        <div style={{ display: "flex", gap: 4 }}>
          {(["30", "90", "all"] as const).map(r => (
            <button key={r} onClick={() => setTimeRange(r)} style={{
              padding: "6px 14px", borderRadius: 8, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: timeRange === r ? "rgba(76,175,80,0.15)" : "transparent",
              borderColor: timeRange === r ? "#4CAF50" : "#1a3a1a",
              color: timeRange === r ? "#4CAF50" : "#5a8a5a",
            }}>{r === "30" ? "30 Days" : r === "90" ? "90 Days" : "All Time"}</button>
          ))}
        </div>
      </div>

      {/* ═══ TOP KPI CARDS ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        <KpiCard label="TOTAL REVENUE" value={formatCurrency(totalRevenue)} color="#4CAF50" />
        <KpiCard label="ESTIMATES" value={String(totalQuotes)} sub={`${pct(conversionRate, 1)} win rate`} color="#42a5f5" />
        <KpiCard label="JOBS" value={String(jobs.length)} sub={`${jobCompleted} completed`} color="#66bb6a" />
        <KpiCard label="CUSTOMERS" value={String(customers.length)} sub={`${commercialCustomers} commercial`} color="#FFB74D" />
        <KpiCard label="AVG RATING" value={avgRating > 0 ? avgRating.toFixed(1) + "★" : "—"} sub={`${ratings.length} ratings`} color="#FFD700" />
        <KpiCard label="WON VALUE" value={formatCurrency(acceptedValue)} sub={formatCurrency(lostValue) + " lost"} color="#26a69a" />
      </div>

      {/* ═══ REVENUE TREND ═══ */}
      {revMonths.length > 1 && (
        <Section title="Revenue Trend" color="#4CAF50">
          <BarChart data={revMonths.map(k => ({ label: getMonthLabel(k), value: revenueByMonth[k] || 0 }))} color="#4CAF50" formatValue={formatCurrency} />
        </Section>
      )}

      {/* ═══ ESTIMATE PIPELINE ═══ */}
      <Section title="Estimate Pipeline" color="#42a5f5">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
          <MiniStat label="Accepted" value={acceptedQuotes} total={totalQuotes} color="#4CAF50" />
          <MiniStat label="Declined" value={declinedQuotes} total={totalQuotes} color="#EF5350" />
          <MiniStat label="Expired" value={expiredQuotes} total={totalQuotes} color="#FF8A65" />
          <MiniStat label="Pending" value={pendingQuotes} total={totalQuotes} color="#42a5f5" />
        </div>
        {commercialQuotes.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", gap: 16, fontSize: 12, color: "#5a8a5a" }}>
            <span>🏢 Commercial: <strong style={{ color: "#42a5f5" }}>{commercialQuotes.length}</strong> ({formatCurrency(commercialQuotes.reduce((s, q) => s + (q.total || 0), 0))})</span>
            <span>🏠 Residential: <strong style={{ color: "#66bb6a" }}>{residentialQuotes.length}</strong> ({formatCurrency(residentialQuotes.reduce((s, q) => s + (q.total || 0), 0))})</span>
          </div>
        )}
      </Section>

      {/* ═══ SERVICES BREAKDOWN ═══ */}
      {sortedServices.length > 0 && (
        <Section title="Services by Revenue" color="#66bb6a">
          {sortedServices.map(([name, s]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "#e8f5e8", fontWeight: 600, textTransform: "capitalize" }}>{name.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: 12, color: "#4CAF50", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{formatCurrency(s.revenue)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "#1a3a1a", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg, #2E7D32, #4CAF50)", width: `${sortedServices[0][1].revenue > 0 ? (s.revenue / sortedServices[0][1].revenue) * 100 : 0}%`, transition: "width 0.5s" }} />
                </div>
              </div>
              <span style={{ fontSize: 11, color: "#3a5a3a", minWidth: 40, textAlign: "right" }}>{s.count} jobs</span>
            </div>
          ))}
        </Section>
      )}

      {/* ═══ CUSTOMER GROWTH ═══ */}
      {custMonths.length > 1 && (
        <Section title="Customer Growth" color="#FFB74D">
          <BarChart data={custMonths.map(k => ({ label: getMonthLabel(k), value: customersByMonth[k] || 0 }))} color="#FFB74D" />
          <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 12, color: "#5a8a5a" }}>
            <span>🏠 Residential: <strong>{residentialCustomers}</strong></span>
            <span>🏢 Commercial: <strong>{commercialCustomers}</strong></span>
          </div>
        </Section>
      )}

      {/* ═══ JOB STATUS ═══ */}
      <Section title="Job Status" color="#66bb6a">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10 }}>
          <MiniStat label="Completed" value={jobCompleted} total={jobs.length} color="#4CAF50" />
          <MiniStat label="Scheduled" value={jobScheduled} total={jobs.length} color="#42a5f5" />
          <MiniStat label="In Progress" value={jobInProgress} total={jobs.length} color="#FFB74D" />
          <MiniStat label="Cancelled" value={jobCancelled} total={jobs.length} color="#EF5350" />
        </div>
      </Section>

      {/* ═══ PAYMENT METHODS ═══ */}
      {Object.keys(paymentMethods).length > 0 && (
        <Section title="Payment Methods" color="#26a69a">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Object.entries(paymentMethods).sort((a, b) => b[1] - a[1]).map(([method, count]) => (
              <div key={method} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#e8f5e8" }}>{count}</div>
                <div style={{ fontSize: 10, color: "#5a8a5a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{method === "card" ? "💳 Card" : method === "cash" ? "💵 Cash" : method}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ FEEDBACK INSIGHTS ═══ */}
      {fbRequests.length > 0 && (
        <Section title="Feedback Insights" color="#FFD700">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.1)" }}>
              <div style={{ fontSize: 10, color: "#5a8a5a", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>SERVICE FEEDBACK</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#FFD700" }}>{respondedPostService}/{postServiceReqs.length}</div>
              <div style={{ fontSize: 11, color: "#3a5a3a" }}>{pct(respondedPostService, postServiceReqs.length)} response rate</div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(66,165,245,0.04)", border: "1px solid rgba(66,165,245,0.1)" }}>
              <div style={{ fontSize: 10, color: "#5a8a5a", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>LOST ESTIMATE</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#42a5f5" }}>{respondedLostEstimate}/{lostEstimateReqs.length}</div>
              <div style={{ fontSize: 11, color: "#3a5a3a" }}>{pct(respondedLostEstimate, lostEstimateReqs.length)} response rate</div>
            </div>
            {avgRating > 0 && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.1)" }}>
                <div style={{ fontSize: 10, color: "#5a8a5a", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>AVG RATING</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#FFD700" }}>{"⭐".repeat(Math.round(avgRating))} {avgRating.toFixed(1)}</div>
                <div style={{ fontSize: 11, color: "#3a5a3a" }}>{ratings.length} total ratings</div>
              </div>
            )}
          </div>

          {/* Lost estimate reasons */}
          {Object.keys(lostReasons).length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: "#5a8a5a", fontWeight: 700, marginBottom: 8 }}>Why Estimates Were Lost:</div>
              {Object.entries(lostReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => {
                const labels: Record<string, string> = { price: "💰 Budget", timing: "📅 Timing", postponed: "⏸️ Postponed", reviews: "⭐ Reviews", proposal: "📋 Proposal detail", other: "💬 Other" };
                return (
                  <div key={reason} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "#8aaa8a", minWidth: 120 }}>{labels[reason] || reason}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#1a3a1a", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: "#42a5f5", width: `${(count / Object.values(lostReasons).reduce((a, b) => a + b, 0)) * 100}%` }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#42a5f5", fontWeight: 700, minWidth: 20, textAlign: "right" }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* ═══ EXTERNAL LINKS ═══ */}
      <Section title="External Analytics" color="#9575cd">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="https://vercel.com/jhpsfl/jhpsfl/analytics" target="_blank" rel="noopener noreferrer" style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 10,
            background: "rgba(255,255,255,0.04)", border: "1px solid #1a3a1a", color: "#e8f5e8",
            textDecoration: "none", fontSize: 13, fontWeight: 600,
          }}>
            <span style={{ fontSize: 16 }}>▲</span> Vercel Analytics
            <span style={{ fontSize: 10, color: "#5a8a5a" }}>↗</span>
          </a>
          <a href="https://search.google.com/search-console?resource_id=sc-domain%3Ajhpsfl.com" target="_blank" rel="noopener noreferrer" style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 10,
            background: "rgba(255,255,255,0.04)", border: "1px solid #1a3a1a", color: "#e8f5e8",
            textDecoration: "none", fontSize: 13, fontWeight: 600,
          }}>
            <span style={{ fontSize: 16 }}>🔍</span> Search Console
            <span style={{ fontSize: 10, color: "#5a8a5a" }}>↗</span>
          </a>
        </div>
        <p style={{ fontSize: 11, color: "#3a5a3a", marginTop: 10 }}>Google Search Console & Vercel Web Analytics data can be integrated directly into this dashboard when API access is configured.</p>
      </Section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ padding: "16px 14px", borderRadius: 14, background: "linear-gradient(160deg, #0d1f0d, #091409)", border: "1px solid #1a3a1a", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 9, color: "#3a5a3a", fontWeight: 700, letterSpacing: 1, marginTop: 4, textTransform: "uppercase" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#5a8a5a", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24, padding: "18px 16px", borderRadius: 16, background: "rgba(255,255,255,0.01)", border: "1px solid #1a3a1a" }}>
      <h3 style={{ fontSize: 13, color, fontWeight: 700, letterSpacing: 1.5, marginBottom: 14, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 4, height: 16, borderRadius: 2, background: color, display: "inline-block" }} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function MiniStat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div style={{ padding: "12px 10px", borderRadius: 10, background: `${color}08`, border: `1px solid ${color}18`, textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#5a8a5a", fontWeight: 600, marginTop: 2 }}>{label}</div>
      {total > 0 && <div style={{ fontSize: 10, color: "#3a5a3a", marginTop: 2 }}>{pct(value, total)}</div>}
    </div>
  );
}

function BarChart({ data, color, formatValue }: { data: Array<{ label: string; value: number }>; color: string; formatValue?: (n: number) => string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 9, color: "#5a8a5a", fontFamily: "'JetBrains Mono', monospace" }}>
            {formatValue ? formatValue(d.value) : d.value}
          </span>
          <div style={{
            width: "100%", maxWidth: 40, borderRadius: "4px 4px 0 0",
            background: `linear-gradient(180deg, ${color}, ${color}88)`,
            height: `${Math.max((d.value / max) * 80, 2)}px`,
            transition: "height 0.5s",
          }} />
          <span style={{ fontSize: 8, color: "#3a5a3a", whiteSpace: "nowrap" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}
