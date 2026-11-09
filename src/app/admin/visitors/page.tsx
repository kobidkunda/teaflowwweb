"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Users,
  Eye,
  ShoppingBag,
  Clock,
  Compass,
  AlertCircle,
  Tag,
} from "lucide-react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";

type AnalyticsData = {
  period: string;
  total_visitors: number;
  total_pageviews: number;
  total_orders: number;
  total_revenue_paise: number;
  top_products: Array<{ path: string; views: number }>;
  top_pages: Array<{ path: string; views: number }>;
  referral_sources: Array<{ source: string; count: number }>;
  daily_traffic: Array<{ date: string; visitors: number; pageviews: number }>;
  conversion_funnel: {
    visitors: number;
    product_views: number;
    checkout_attempts: number;
    completed_orders: number;
    conversion_rate_percent: number;
  };
};

function formatRupees(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminVisitorsPage() {
  const [period, setPeriod] = useState<string>("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadStats() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/analytics?period=${encodeURIComponent(period)}`, {
          credentials: "same-origin",
        });
        if (res.status === 401) throw new Error("Session expired. Please sign in again.");
        if (res.status === 429) throw new Error("Too many requests. Wait a moment and retry.");
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Failed to load traffic analytics");
        }
        const json = (await res.json()) as AnalyticsData;
        if (mounted) {
          setData(json);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Error fetching analytics");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadStats();
    return () => {
      mounted = false;
    };
  }, [period]);

  const funnel = data?.conversion_funnel || {
    visitors: 0,
    product_views: 0,
    checkout_attempts: 0,
    completed_orders: 0,
    conversion_rate_percent: 0,
  };

  // Safe percentages calculation (zero-division guarded)
  const baseVisitors = funnel.visitors > 0 ? funnel.visitors : 0;
  const prodPct = baseVisitors > 0 ? ((funnel.product_views / baseVisitors) * 100).toFixed(1) : "0.0";
  const chkPct = baseVisitors > 0 ? ((funnel.checkout_attempts / baseVisitors) * 100).toFixed(1) : "0.0";
  const ordPct = baseVisitors > 0 ? ((funnel.completed_orders / baseVisitors) * 100).toFixed(1) : "0.0";

  return (
    <AdminAuthGate>
      <div className="visitors-page-root">
      {/* Header and Period Filter */}
      <div className="analytics-header">
        <div>
          <p className="eyebrow">Sales & Customers</p>
          <h1 className="analytics-title">Visitors & Traffic Analytics</h1>
          <p className="analytics-subtitle">
            Anonymized traffic metrics, high-intent product interest, referral channels, and order
            conversion funnel. Zero customer PII persisted.
          </p>
        </div>

        {/* Time Period Selector */}
        <div className="period-pill-group" role="group" aria-label="Select reporting period">
          <button
            type="button"
            className={`period-btn ${period === "7d" ? "active" : ""}`}
            onClick={() => setPeriod("7d")}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            className={`period-btn ${period === "30d" ? "active" : ""}`}
            onClick={() => setPeriod("30d")}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            className={`period-btn ${period === "all" ? "active" : ""}`}
            onClick={() => setPeriod("all")}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Marketing Tags & GTM Shortcut Banner */}
      <div className="flex items-center justify-between p-3.5 mb-6 bg-[#f6f3ea] border border-[#e2ddd0] rounded-lg text-xs">
        <div className="flex items-center gap-2 text-[#18231c]">
          <Tag className="w-4 h-4 text-[#2c4e38]" />
          <span>
            Manage external tags, <strong>Google Tag Manager</strong>, Meta Pixel & GA4.
          </span>
        </div>
        <Link
          href="/admin/tracking"
          className="font-bold text-[#2c4e38] hover:underline shrink-0"
        >
          Configure Marketing Pixels & GTM →
        </Link>
      </div>

      {error && (
        <div className="analytics-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="analytics-loading" role="status">
          <Clock className="spin" size={24} aria-hidden="true" />
          <span>Aggregating store traffic and conversion funnel...</span>
        </div>
      ) : (
        <div className="analytics-content-grid">
          {/* 4 KPI Cards */}
          <section className="kpi-grid" aria-label="Traffic and sales key performance indicators">
            <div className="kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-label">Unique Visitors</span>
                <Users size={18} className="text-pine" aria-hidden="true" />
              </div>
              <div className="kpi-value">{data?.total_visitors ?? 0}</div>
              <span className="kpi-sub">Distinct anonymous sessions</span>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-label">Total Pageviews</span>
                <Eye size={18} className="text-moss" aria-hidden="true" />
              </div>
              <div className="kpi-value">{data?.total_pageviews ?? 0}</div>
              <span className="kpi-sub">Total page impressions</span>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-label">Conversion Rate</span>
                <TrendingUp size={18} className="text-amber" aria-hidden="true" />
              </div>
              <div className="kpi-value">{funnel.conversion_rate_percent}%</div>
              <span className="kpi-sub">Visits to completed orders</span>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-label">Paid Volume</span>
                <ShoppingBag size={18} className="text-pine" aria-hidden="true" />
              </div>
              <div className="kpi-value">{formatRupees(data?.total_revenue_paise ?? 0)}</div>
              <span className="kpi-sub">{data?.total_orders ?? 0} total order registrations</span>
            </div>
          </section>

          {/* Conversion Funnel Section */}
          <section className="analytics-card" aria-label="Order conversion funnel">
            <div className="card-header-row">
              <div>
                <h2 className="card-title">Order Conversion Funnel</h2>
                <p className="card-subtitle">
                  Customer progression from initial store landing to final checkout completion.
                </p>
              </div>
              <div className="funnel-summary-badge">
                Overall: <strong>{funnel.conversion_rate_percent}%</strong> conversion
              </div>
            </div>

            <div className="funnel-steps-container">
              {/* Funnel Step 1: Sessions */}
              <div className="funnel-step">
                <div className="step-header">
                  <span className="step-num">1</span>
                  <span className="step-name">Store Visits</span>
                  <span className="step-val">{funnel.visitors} sessions</span>
                  <span className="step-pct">100%</span>
                </div>
                <div className="funnel-bar-track">
                  <div className="funnel-bar-fill step-1-fill" style={{ width: "100%" }} />
                </div>
              </div>

              {/* Funnel Step 2: Product Views */}
              <div className="funnel-step">
                <div className="step-header">
                  <span className="step-num">2</span>
                  <span className="step-name">Product Views</span>
                  <span className="step-val">{funnel.product_views} sessions</span>
                  <span className="step-pct">{prodPct}%</span>
                </div>
                <div className="funnel-bar-track">
                  <div
                    className="funnel-bar-fill step-2-fill"
                    style={{ width: `${Math.min(parseFloat(prodPct), 100)}%` }}
                  />
                </div>
              </div>

              {/* Funnel Step 3: Checkout Attempts */}
              <div className="funnel-step">
                <div className="step-header">
                  <span className="step-num">3</span>
                  <span className="step-name">Checkout Starts</span>
                  <span className="step-val">{funnel.checkout_attempts} sessions</span>
                  <span className="step-pct">{chkPct}%</span>
                </div>
                <div className="funnel-bar-track">
                  <div
                    className="funnel-bar-fill step-3-fill"
                    style={{ width: `${Math.min(parseFloat(chkPct), 100)}%` }}
                  />
                </div>
              </div>

              {/* Funnel Step 4: Completed Orders */}
              <div className="funnel-step">
                <div className="step-header">
                  <span className="step-num">4</span>
                  <span className="step-name">Completed Orders</span>
                  <span className="step-val">{funnel.completed_orders} orders</span>
                  <span className="step-pct">{ordPct}%</span>
                </div>
                <div className="funnel-bar-track">
                  <div
                    className="funnel-bar-fill step-4-fill"
                    style={{ width: `${Math.min(parseFloat(ordPct), 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Two-Column Breakdown: Top Products & Referral Sources */}
          <div className="tables-two-col">
            {/* Top Visited Teas */}
            <section className="analytics-card" aria-label="Top visited teas">
              <h2 className="card-title">Top Visited Tea Offerings</h2>
              <p className="card-subtitle">Highest engagement single-estate and blend pages.</p>

              {data?.top_products && data.top_products.length > 0 ? (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col" style={{ width: 40 }}>#</th>
                        <th scope="col">Tea Product Route</th>
                        <th scope="col" style={{ textAlign: "right" }}>Impressions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_products.map((item, idx) => (
                        <tr key={item.path}>
                          <td className="text-muted">{idx + 1}</td>
                          <td className="font-mono">
                            <a
                              href={item.path}
                              target="_blank"
                              rel="noreferrer"
                              className="text-link"
                            >
                              {item.path}
                            </a>
                          </td>
                          <td style={{ textAlign: "right" }} className="font-bold">
                            {item.views}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-sub-card">
                  <p>No tea product views recorded in this period.</p>
                </div>
              )}
            </section>

            {/* Referral Sources */}
            <section className="analytics-card" aria-label="Traffic referral channels">
              <h2 className="card-title">Traffic Referral Sources</h2>
              <p className="card-subtitle">Origins of inbound visitor sessions.</p>

              {data?.referral_sources && data.referral_sources.length > 0 ? (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">Channel / Source</th>
                        <th scope="col" style={{ textAlign: "right" }}>Sessions</th>
                        <th scope="col" style={{ textAlign: "right" }}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.referral_sources.map((item) => {
                        const share =
                          (data.total_pageviews || 0) > 0
                            ? (((item.count || 0) / data.total_pageviews) * 100).toFixed(1)
                            : "0";
                        return (
                          <tr key={item.source}>
                            <td>
                              <span className="source-badge">
                                <Compass size={12} aria-hidden="true" />
                                <span>{item.source}</span>
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }} className="font-bold">
                              {item.count}
                            </td>
                            <td style={{ textAlign: "right" }} className="text-muted">
                              {share}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-sub-card">
                  <p>No external referral records captured in this period.</p>
                </div>
              )}
            </section>
          </div>

          {/* Daily Traffic Breakdown Table */}
          <section className="analytics-card" aria-label="Daily traffic trend">
            <h2 className="card-title">Daily Traffic Log</h2>
            <p className="card-subtitle">Daily breakdown of unique visitors and total page impressions.</p>

            {data?.daily_traffic && data.daily_traffic.length > 0 ? (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col" style={{ textAlign: "right" }}>Unique Sessions</th>
                      <th scope="col" style={{ textAlign: "right" }}>Total Pageviews</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily_traffic.map((day) => (
                      <tr key={day.date}>
                        <td className="font-bold">
                          {new Date(day.date).toLocaleDateString("en-IN", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td style={{ textAlign: "right" }}>{day.visitors}</td>
                        <td style={{ textAlign: "right" }}>{day.pageviews}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-sub-card">
                <p>No daily visitor log entries recorded for this date range.</p>
              </div>
            )}
          </section>
        </div>
      )}

      <style jsx>{`
        .visitors-page-root {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .analytics-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }

        .analytics-title {
          font-size: clamp(28px, 3.5vw, 38px);
          font-family: Georgia, serif;
          color: var(--forest, #1d2a24);
          margin: 4px 0 8px;
        }

        .analytics-subtitle {
          color: #555850;
          font-size: 14px;
          margin: 0;
          max-width: 720px;
          line-height: 1.5;
        }

        .period-pill-group {
          display: inline-flex;
          background: #ede9df;
          border-radius: 6px;
          padding: 3px;
          border: 1px solid var(--admin-border, #d9d4c8);
        }

        .period-btn {
          border: none;
          background: transparent;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #555850;
          border-radius: 4px;
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease;
        }

        .period-btn.active {
          background: #ffffff;
          color: var(--forest, #1d2a24);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .analytics-content-grid {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .kpi-card {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 6px;
        }

        .kpi-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .kpi-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #6a6e64;
        }

        .kpi-value {
          font-size: 28px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
          line-height: 1.1;
        }

        .kpi-sub {
          font-size: 12px;
          color: #7b8075;
        }

        .analytics-card {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 22px;
        }

        .card-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .card-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
          margin: 0 0 4px;
        }

        .card-subtitle {
          font-size: 13px;
          color: #6a6e64;
          margin: 0;
        }

        .funnel-summary-badge {
          background: rgba(35, 72, 58, 0.1);
          color: var(--pine, #23483a);
          border: 1px solid rgba(35, 72, 58, 0.25);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
        }

        .funnel-steps-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .funnel-step {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }

        .step-num {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ede9df;
          color: #555850;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
        }

        .step-name {
          font-weight: 600;
          color: var(--forest, #1d2a24);
          flex: 1;
        }

        .step-val {
          color: #6a6e64;
        }

        .step-pct {
          font-weight: 700;
          color: var(--forest, #1d2a24);
          width: 48px;
          text-align: right;
        }

        .funnel-bar-track {
          width: 100%;
          height: 12px;
          background: #ede9df;
          border-radius: 6px;
          overflow: hidden;
        }

        .funnel-bar-fill {
          height: 100%;
          border-radius: 6px;
          transition: width 300ms ease;
        }

        .step-1-fill {
          background: var(--forest, #1d2a24);
        }

        .step-2-fill {
          background: var(--pine, #23483a);
        }

        .step-3-fill {
          background: var(--moss, #697a55);
        }

        .step-4-fill {
          background: var(--amber, #b36b3d);
        }

        .tables-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .table-responsive {
          overflow-x: auto;
          margin-top: 14px;
        }

        .source-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
        }

        .empty-sub-card {
          padding: 24px;
          text-align: center;
          color: #7b8075;
          font-size: 13px;
          background: #ede9df;
          border-radius: 6px;
          margin-top: 12px;
        }

        .analytics-loading,
        .analytics-error {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 64px 20px;
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          color: #6a6e64;
        }

        .analytics-error {
          color: #8f2f2a;
          background: #fdf2f2;
          border-color: #f8b4b4;
        }

        @media (max-width: 1024px) {
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .tables-two-col {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .kpi-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
    </AdminAuthGate>
  );
}
