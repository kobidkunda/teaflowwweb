"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Briefcase,
  Boxes,
  FileSpreadsheet,
  FileText,
  Truck,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  History,
} from "lucide-react";

interface OverviewStats {
  teaCount: { total: number; published: number; draft: number };
  packagingCount: { total: number; published: number; draft: number; archived: number };
  printMethodCount: { total: number; active: number };
  priceBookCount: { total: number; active: number };
  quoteQueueCount: {
    total: number;
    pricingPending: number;
    estimated: number;
    firmIssued: number;
    accepted: number;
    converted: number;
  };
  jobQueueCount: {
    total: number;
    active: number;
    completed: number;
    qcPending: number;
  };
  recentAudit: Array<{
    id: string;
    entity_type: string;
    entity_id: string;
    revision: number;
    action: string;
    actor_type: string;
    actor_id: string;
    actor_email: string | null;
    diff_json: string;
    created_at: string;
  }>;
}

export function PrivateLabelOverviewClient() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/private-label/overview");
      if (!res.ok) {
        throw new Error("Failed to load Private Label overview statistics.");
      }
      const data = await res.json();
      setStats(data.stats || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1440, margin: "0 auto" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6a6e64",
              fontWeight: 600,
            }}
          >
            Private Label Studio
          </span>
          <h1
            style={{
              margin: "4px 0",
              fontSize: 28,
              fontWeight: 700,
              color: "var(--forest, #1d2a24)",
              fontFamily: "var(--font-serif, Georgia, serif)",
            }}
          >
            Studio Command Center
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#555850" }}>
            Real-time management for B2B tea catalogue, volume price books, quote review queue, and 7-stage QC pipeline.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => void fetchStats()}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #d9d4c8",
              background: "#ffffff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
            <span>Refresh</span>
          </button>
          <Link
            href="/admin/private-label/quotes"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              background: "#23483a",
              color: "#ffffff",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            <FileText size={16} />
            <span>Review Quote Queue</span>
          </Link>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 20,
            backgroundColor: "#fdf2f2",
            border: "1px solid #f8b4b4",
            borderRadius: 6,
            color: "#9b1c1c",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Metric Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {/* Pending Quotes */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "#6a6e64", fontWeight: 500 }}>Manual Quotes Pending</span>
            <AlertCircle size={18} color="#b78103" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#9e6428" }}>
            {stats ? stats.quoteQueueCount.pricingPending : "-"}
          </div>
          <div style={{ fontSize: 12, color: "#777c72", marginTop: 4 }}>
            Requires operator cost review
          </div>
        </div>

        {/* Active Production Jobs */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "#6a6e64", fontWeight: 500 }}>Active Jobs in Pipeline</span>
            <Truck size={18} color="#23483a" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#23483a" }}>
            {stats ? stats.jobQueueCount.active : "-"}
          </div>
          <div style={{ fontSize: 12, color: "#777c72", marginTop: 4 }}>
            Blending, printing, filling &amp; QC
          </div>
        </div>

        {/* Published Packaging SKUs */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "#6a6e64", fontWeight: 500 }}>Packaging Variants</span>
            <Boxes size={18} color="#23483a" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1d2a24" }}>
            {stats ? `${stats.packagingCount.published} / ${stats.packagingCount.total}` : "-"}
          </div>
          <div style={{ fontSize: 12, color: "#777c72", marginTop: 4 }}>
            Published packaging structures
          </div>
        </div>

        {/* Tea Options */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "#6a6e64", fontWeight: 500 }}>Tea Sourcing Catalog</span>
            <ShieldCheck size={18} color="#23483a" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1d2a24" }}>
            {stats ? `${stats.teaCount.published} / ${stats.teaCount.total}` : "-"}
          </div>
          <div style={{ fontSize: 12, color: "#777c72", marginTop: 4 }}>
            Verified single estate teas
          </div>
        </div>

        {/* Active Price Books */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "#6a6e64", fontWeight: 500 }}>Price Books</span>
            <FileSpreadsheet size={18} color="#23483a" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1d2a24" }}>
            {stats ? stats.priceBookCount.active : "-"}
          </div>
          <div style={{ fontSize: 12, color: "#777c72", marginTop: 4 }}>
            Active commercial rate books
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1d2a24", marginBottom: 12 }}>
        Studio Modules &amp; Workflows
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <Link
          href="/admin/private-label/catalogue"
          style={{
            display: "block",
            padding: "18px 20px",
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Boxes size={20} color="#23483a" />
            <span style={{ fontWeight: 600, fontSize: 16, color: "#1d2a24" }}>PL Catalogue</span>
            <ArrowRight size={14} style={{ marginLeft: "auto", color: "#6a6e64" }} />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#555850" }}>
            Manage pouch, tin &amp; jar specifications, print methods, and compatibility matrices.
          </p>
        </Link>

        <Link
          href="/admin/private-label/price-books"
          style={{
            display: "block",
            padding: "18px 20px",
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <FileSpreadsheet size={20} color="#23483a" />
            <span style={{ fontWeight: 600, fontSize: 16, color: "#1d2a24" }}>Price Books &amp; MOQs</span>
            <ArrowRight size={14} style={{ marginLeft: "auto", color: "#6a6e64" }} />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#555850" }}>
            Configure volume tier breaks, labor rates, contingency markups, and MOQ rules.
          </p>
        </Link>

        <Link
          href="/admin/private-label/quotes"
          style={{
            display: "block",
            padding: "18px 20px",
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <FileText size={20} color="#23483a" />
            <span style={{ fontWeight: 600, fontSize: 16, color: "#1d2a24" }}>Quote Queue</span>
            <ArrowRight size={14} style={{ marginLeft: "auto", color: "#6a6e64" }} />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#555850" }}>
            Review customer quote requests, apply line item price overrides, and issue firm quotes.
          </p>
        </Link>

        <Link
          href="/admin/private-label/jobs"
          style={{
            display: "block",
            padding: "18px 20px",
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Truck size={20} color="#23483a" />
            <span style={{ fontWeight: 600, fontSize: 16, color: "#1d2a24" }}>Production &amp; QC</span>
            <ArrowRight size={14} style={{ marginLeft: "auto", color: "#6a6e64" }} />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#555850" }}>
            Enforce release gates on deposit-paid orders and track 7 sequential quality milestones.
          </p>
        </Link>
      </div>

      {/* Recent Operational Audit Trail Feed */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          padding: "20px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <History size={18} color="#23483a" />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1d2a24" }}>
            Recent Operational Activity (pl_audit)
          </h2>
        </div>

        {stats && stats.recentAudit && stats.recentAudit.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#ede9df", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid #d9d4c8" }}>Timestamp</th>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid #d9d4c8" }}>Entity</th>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid #d9d4c8" }}>Action</th>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid #d9d4c8" }}>Actor</th>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid #d9d4c8" }}>Revision</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentAudit.map((rec) => (
                  <tr key={rec.id} style={{ borderBottom: "1px solid #f0ece1" }}>
                    <td style={{ padding: "8px 12px", color: "#666" }}>
                      {new Date(rec.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: "8px 12px", fontWeight: 500 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 12 }}>{rec.entity_type}</span>: {rec.entity_id}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "#e8f5e9",
                          color: "#1b5e20",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {rec.action}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "#555" }}>
                      {rec.actor_email || rec.actor_id}
                    </td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 12 }}>
                      v{rec.revision}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: "#777", fontSize: 13, padding: "12px 0" }}>
            No recent audit entries found.
          </div>
        )}
      </div>
    </div>
  );
}
