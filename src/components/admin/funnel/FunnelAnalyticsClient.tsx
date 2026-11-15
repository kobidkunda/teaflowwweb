"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Download,
  Filter,
  MessageCircle,
  RefreshCw,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { FUNNEL_LABELS } from "@/lib/funnel/types";

type TouchModel = "last" | "first";
type BreakdownDimension =
  | "campaign"
  | "source_medium"
  | "keyword"
  | "content"
  | "landing_page"
  | "funnel";
type ActiveTab = "breakdown" | "activity" | "audiences";
type RemarketingSegment =
  | "abandoned_carts_unconverted"
  | "leads_unconverted"
  | "whatsapp_no_order"
  | "b2b_wholesale_prospects"
  | "all_purchasers"
  | "high_value_repeat_buyers"
  | "newsletter_non_buyers";

interface FunnelStageRow {
  stage: string;
  label: string;
  rank: number;
  sessions: number;
  events: number;
  valuePaise: number;
  conversionPct: number;
}

interface BreakdownRow {
  primaryKey: string;
  secondaryKey: string;
  sessions: number;
  productViews: number;
  addToCarts: number;
  leadsAndForms: number;
  conversations: number;
  checkoutStarts: number;
  orders: number;
  paidOrders: number;
  revenuePaise: number;
  conversionRatePct: number;
  aovPaise: number;
}

interface FunnelAnalyticsResponse {
  ok: boolean;
  period: string;
  touchModel: TouchModel;
  dimension: BreakdownDimension;
  kpis: {
    totalSessions: number;
    totalLeadsAndForms: number;
    totalConversations: number;
    totalAbandonedCarts: number;
    recoverableCartValuePaise: number;
    checkoutStarts: number;
    ordersPlaced: number;
    paidOrders: number;
    paidRevenuePaise: number;
    overallConversionPct: number;
  };
  stages: FunnelStageRow[];
  breakdown: BreakdownRow[];
  filters: {
    sources: string[];
    campaigns: string[];
  };
  recentEvents: Array<Record<string, unknown>>;
  recentConversations: Array<Record<string, unknown>>;
}

interface AudienceRecord {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  valueRupees: number;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  funnelName: string;
  segment: RemarketingSegment;
  lastActivityAt: string;
}

const SEGMENT_META: Array<{ id: RemarketingSegment; label: string; description: string }> = [
  {
    id: "abandoned_carts_unconverted",
    label: "Abandoned Carts (Unconverted)",
    description: "Drop-offs with bag value who have NOT placed a paid/active order",
  },
  {
    id: "leads_unconverted",
    label: "Leads & Inquiries (Unconverted)",
    description: "Lead captures, wholesale & contact forms with zero completed orders",
  },
  {
    id: "whatsapp_no_order",
    label: "WhatsApp & Chat Initiations (No Order)",
    description: "Visitors who opened a WhatsApp/enquiry conversation without ordering",
  },
  {
    id: "b2b_wholesale_prospects",
    label: "B2B Wholesale & Private Label Prospects",
    description: "Wholesale form submissions and B2B leads for high-ticket remarketing",
  },
  {
    id: "newsletter_non_buyers",
    label: "Newsletter Subscribers (Non-Buyers)",
    description: "Subscribers who haven't converted into customers yet",
  },
  {
    id: "all_purchasers",
    label: "All Purchasers (Lookalike / Exclusion Seed)",
    description: "Converted customers for Meta/Google Lookalike audiences or exclusion lists",
  },
  {
    id: "high_value_repeat_buyers",
    label: "VIP & High-Value Buyers (₹2,000+)",
    description: "Top spenders and repeat buyers for VIP upsell & subscription campaigns",
  },
];

const DIMENSION_TABS: Array<{ id: BreakdownDimension; label: string; colTitle: string; subTitle: string }> = [
  { id: "campaign", label: "Campaigns", colTitle: "Campaign (utm_campaign)", subTitle: "Source" },
  { id: "source_medium", label: "Source / Medium", colTitle: "Source (utm_source)", subTitle: "Medium" },
  { id: "keyword", label: "Keywords (utm_term)", colTitle: "Keyword / Search Term", subTitle: "Campaign" },
  { id: "content", label: "Ad Content (utm_content)", colTitle: "Ad / Creative Variant", subTitle: "Campaign" },
  { id: "landing_page", label: "Landing Pages", colTitle: "Entry URL / Path", subTitle: "Source" },
  { id: "funnel", label: "By Funnel", colTitle: "Funnel", subTitle: "Primary Source" },
];

function formatInr(paise: number): string {
  return (
    "₹" +
    Math.round(paise / 100).toLocaleString("en-IN")
  );
}

export function FunnelAnalyticsClient() {
  const [period, setPeriod] = useState<string>("30d");
  const [funnelName, setFunnelName] = useState<string>("all");
  const [touchModel, setTouchModel] = useState<TouchModel>("last");
  const [dimension, setDimension] = useState<BreakdownDimension>("campaign");
  const [utmSource, setUtmSource] = useState<string>("");
  const [utmCampaign, setUtmCampaign] = useState<string>("");
  const [utmTerm, setUtmTerm] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("breakdown");

  const [data, setData] = useState<FunnelAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Audience tab state
  const [segment, setSegment] = useState<RemarketingSegment>("abandoned_carts_unconverted");
  const [audienceRecords, setAudienceRecords] = useState<AudienceRecord[]>([]);
  const [audienceLoading, setAudienceLoading] = useState<boolean>(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        period,
        funnel: funnelName,
        touch: touchModel,
        dimension,
      });
      if (utmSource) qs.set("utm_source", utmSource);
      if (utmCampaign) qs.set("utm_campaign", utmCampaign);
      if (utmTerm.trim()) qs.set("utm_term", utmTerm.trim());

      const res = await fetch(`/api/admin/funnel?${qs.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to load funnel attribution data.");
      }
      const json = (await res.json()) as FunnelAnalyticsResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading funnel analytics.");
    } finally {
      setLoading(false);
    }
  }, [period, funnelName, touchModel, dimension, utmSource, utmCampaign, utmTerm]);

  const loadAudiences = useCallback(async () => {
    setAudienceLoading(true);
    try {
      const qs = new URLSearchParams({
        segment,
        period: period === "7d" || period === "30d" ? "90d" : period,
        funnel: funnelName,
      });
      if (utmSource) qs.set("utm_source", utmSource);
      if (utmCampaign) qs.set("utm_campaign", utmCampaign);
      if (utmTerm.trim()) qs.set("utm_term", utmTerm.trim());

      const res = await fetch(`/api/admin/funnel/audiences?${qs.toString()}`, {
        credentials: "same-origin",
      });
      if (res.ok) {
        const json = (await res.json()) as { records?: AudienceRecord[] };
        setAudienceRecords(json.records || []);
      }
    } finally {
      setAudienceLoading(false);
    }
  }, [segment, period, funnelName, utmSource, utmCampaign, utmTerm]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    if (activeTab === "audiences") {
      void loadAudiences();
    }
  }, [activeTab, loadAudiences]);

  async function handleExportCsv(format: "meta_hashed" | "google_customer_match" | "crm_plain") {
    setExportingFormat(format);
    try {
      const res = await fetch("/api/admin/funnel/audiences", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment,
          format,
          period: period === "7d" || period === "30d" ? "90d" : period,
          funnelName,
          utmSource,
          utmCampaign,
          utmTerm: utmTerm.trim(),
        }),
      });
      if (!res.ok) {
        alert("Unable to export audience CSV.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] || `teafloww-${segment}-${format}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExportingFormat(null);
    }
  }

  const activeDimMeta = DIMENSION_TABS.find((t) => t.id === dimension) || DIMENSION_TABS[0];
  const kpis = data?.kpis;
  const maxStageSessions = Math.max(
    1,
    ...(data?.stages || []).map((s) => s.sessions)
  );

  return (
    <div style={{ maxWidth: 1380, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#2c4e38", letterSpacing: "0.06em" }}>
            First-Party Ads &amp; Conversion Intelligence
          </p>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: "#1d2a24", display: "flex", alignItems: "center", gap: 10 }}>
            <Target size={24} /> Funnel, UTM &amp; Remarketing Hub
          </h1>
          <p style={{ margin: 0, color: "#5f665c", fontSize: 14 }}>
            Unified first-touch &amp; last-touch attribution across visits, leads, forms, WhatsApp chats, abandoned carts, and orders.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/admin/tracking" className="button button-outline" style={{ fontSize: 12, padding: "7px 12px" }}>
            Pixel &amp; CAPI Settings
          </Link>
          <button
            type="button"
            onClick={() => void loadAnalytics()}
            className="button button-primary"
            style={{ fontSize: 12, padding: "7px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <section
        aria-label="Attribution Filters"
        style={{
          background: "#fff",
          border: "1px solid #e2ddd0",
          borderRadius: 10,
          padding: 14,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={14} style={{ color: "#2c4e38" }} />
          <select
            aria-label="Date range"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ padding: "7px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d1ccc0", background: "#fff" }}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>

        <select
          aria-label="Funnel filter"
          value={funnelName}
          onChange={(e) => setFunnelName(e.target.value)}
          style={{ padding: "7px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d1ccc0", background: "#fff" }}
        >
          <option value="all">All Funnels</option>
          {Object.entries(FUNNEL_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {/* First vs Last Touch Toggle */}
        <div
          role="group"
          aria-label="Attribution touch model"
          style={{ display: "inline-flex", border: "1px solid #d1ccc0", borderRadius: 6, overflow: "hidden" }}
        >
          <button
            type="button"
            onClick={() => setTouchModel("last")}
            style={{
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: touchModel === "last" ? "#23483a" : "#fff",
              color: touchModel === "last" ? "#fff" : "#374151",
            }}
          >
            Last Touch
          </button>
          <button
            type="button"
            onClick={() => setTouchModel("first")}
            style={{
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              borderLeft: "1px solid #d1ccc0",
              cursor: "pointer",
              background: touchModel === "first" ? "#23483a" : "#fff",
              color: touchModel === "first" ? "#fff" : "#374151",
            }}
          >
            First Touch
          </button>
        </div>

        <select
          aria-label="UTM Source filter"
          value={utmSource}
          onChange={(e) => setUtmSource(e.target.value)}
          style={{ padding: "7px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d1ccc0", background: "#fff" }}
        >
          <option value="">All Sources</option>
          {(data?.filters.sources || []).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          aria-label="UTM Campaign filter"
          value={utmCampaign}
          onChange={(e) => setUtmCampaign(e.target.value)}
          style={{ padding: "7px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d1ccc0", background: "#fff" }}
        >
          <option value="">All Campaigns</option>
          {(data?.filters.campaigns || []).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <input
          type="text"
          aria-label="Filter by keyword"
          placeholder="Filter keyword (utm_term)..."
          value={utmTerm}
          onChange={(e) => setUtmTerm(e.target.value)}
          style={{ padding: "7px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d1ccc0", minWidth: 180, flex: 1 }}
        />

        {(utmSource || utmCampaign || utmTerm || funnelName !== "all") && (
          <button
            type="button"
            onClick={() => {
              setUtmSource("");
              setUtmCampaign("");
              setUtmTerm("");
              setFunnelName("all");
            }}
            style={{ fontSize: 12, color: "#991b1b", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            Clear Filters
          </button>
        )}
      </section>

      {error && (
        <div role="alert" style={{ padding: 14, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* 6 KPI Cards */}
      <section aria-label="Funnel KPIs" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))", gap: 14 }}>
        <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e2ddd0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#666" }}>
            <span>Tracked Sessions</span>
            <Users size={16} style={{ color: "#2c4e38" }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#1d2a24", marginTop: 6 }}>
            {loading ? "—" : (kpis?.totalSessions ?? 0).toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
            Model: {touchModel === "first" ? "First-Touch" : "Last-Touch"}
          </div>
        </div>

        <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e2ddd0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#666" }}>
            <span>Leads &amp; Forms</span>
            <Activity size={16} style={{ color: "#2c4e38" }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#1d2a24", marginTop: 6 }}>
            {loading ? "—" : (kpis?.totalLeadsAndForms ?? 0).toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
            Modal, Contact, Wholesale, Newsletter, PL
          </div>
        </div>

        <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e2ddd0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#666" }}>
            <span>Conversations</span>
            <MessageCircle size={16} style={{ color: "#166534" }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#166534", marginTop: 6 }}>
            {loading ? "—" : (kpis?.totalConversations ?? 0).toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
            WhatsApp clicks, forms &amp; inbox threads
          </div>
        </div>

        <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e2ddd0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#666" }}>
            <span>Abandoned Carts</span>
            <ShoppingCart size={16} style={{ color: "#b45309" }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#b45309", marginTop: 6 }}>
            {loading ? "—" : (kpis?.totalAbandonedCarts ?? 0).toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
            Recoverable: {formatInr(kpis?.recoverableCartValuePaise ?? 0)}
          </div>
        </div>

        <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e2ddd0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#666" }}>
            <span>Orders / Paid</span>
            <TrendingUp size={16} style={{ color: "#059669" }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#059669", marginTop: 6 }}>
            {loading ? "—" : `${kpis?.ordersPlaced ?? 0} / ${kpis?.paidOrders ?? 0}`}
          </div>
          <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
            Conv Rate: {kpis?.overallConversionPct ?? 0}%
          </div>
        </div>

        <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e2ddd0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#666" }}>
            <span>Attributed Revenue</span>
            <TrendingUp size={16} style={{ color: "#23483a" }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#1d2a24", marginTop: 6 }}>
            {loading ? "—" : formatInr(kpis?.paidRevenuePaise ?? 0)}
          </div>
          <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
            Checkouts started: {kpis?.checkoutStarts ?? 0}
          </div>
        </div>
      </section>

      {/* Visual Stage-by-Stage Funnel */}
      <section aria-label="Stage by Stage Conversion Funnel" style={{ background: "#fff", border: "1px solid #e2ddd0", borderRadius: 10, padding: 18 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>
          Stage-by-Stage Conversion Funnel
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(data?.stages || []).map((st) => {
            const widthPct = Math.max(2, Math.round((st.sessions / maxStageSessions) * 100));
            return (
              <div key={st.stage} style={{ display: "grid", gridTemplateColumns: "180px 1fr 150px", gap: 12, alignItems: "center", fontSize: 13 }}>
                <div style={{ fontWeight: 600, color: "#1d2a24" }}>{st.label}</div>
                <div style={{ background: "#f3f1ea", borderRadius: 6, height: 22, overflow: "hidden", position: "relative" }}>
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: "100%",
                      background: st.stage === "order_paid" ? "#059669" : st.stage === "cart_abandoned" ? "#d97706" : "#2c4e38",
                      borderRadius: 6,
                    }}
                  />
                </div>
                <div style={{ textAlign: "right", fontSize: 12, color: "#46524a", fontVariantNumeric: "tabular-nums" }}>
                  <strong>{st.sessions}</strong> sess ({st.conversionPct}%) · {st.events} ev
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Navigation Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e2ddd0", paddingBottom: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setActiveTab("breakdown")}
          className={`button ${activeTab === "breakdown" ? "button-primary" : "button-outline"}`}
          style={{ fontSize: 13, padding: "8px 14px" }}
        >
          UTM, Keyword &amp; Campaign Attribution
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("activity")}
          className={`button ${activeTab === "activity" ? "button-primary" : "button-outline"}`}
          style={{ fontSize: 13, padding: "8px 14px" }}
        >
          Live Leads, Forms &amp; Conversations ({(data?.recentEvents.length ?? 0) + (data?.recentConversations.length ?? 0)})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("audiences")}
          className={`button ${activeTab === "audiences" ? "button-primary" : "button-outline"}`}
          style={{ fontSize: 13, padding: "8px 14px" }}
        >
          Remarketing Audiences &amp; CSV Export
        </button>
      </div>

      {/* Tab 1: Breakdown */}
      {activeTab === "breakdown" && (
        <section style={{ background: "#fff", border: "1px solid #e2ddd0", borderRadius: 10, padding: 18 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {DIMENSION_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDimension(t.id)}
                className={`button ${dimension === t.id ? "button-primary" : "button-outline"}`}
                style={{ fontSize: 12, padding: "6px 12px" }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#fbf9f4", borderBottom: "1px solid #e2ddd0", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px" }}>{activeDimMeta.colTitle}</th>
                  <th style={{ padding: "10px 12px" }}>{activeDimMeta.subTitle}</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Sessions</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Add to Cart</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Leads/Forms</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Chats</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Checkouts</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Orders</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Revenue</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Conv %</th>
                </tr>
              </thead>
              <tbody>
                {!data || data.breakdown.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#777" }}>
                      No attributed sessions found in this period yet. Traffic arriving with UTM tags, click IDs, or referrals will appear here automatically.
                    </td>
                  </tr>
                ) : (
                  data.breakdown.map((row, idx) => (
                    <tr key={`${row.primaryKey}-${row.secondaryKey}-${idx}`} style={{ borderBottom: "1px solid #f0ece1" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1d2a24" }}>
                        {row.primaryKey}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#5f665c" }}>{row.secondaryKey}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>{row.sessions}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>{row.addToCarts}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>{row.leadsAndForms}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>{row.conversations}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>{row.checkoutStarts}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                        {row.orders} ({row.paidOrders} paid)
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: "#059669" }}>
                        {formatInr(row.revenuePaise)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>{row.conversionRatePct}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 2: Live Activity & Conversations */}
      {activeTab === "activity" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: 16 }}>
          <section style={{ background: "#fff", border: "1px solid #e2ddd0", borderRadius: 10, padding: 18 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>
              Recent Funnel Events
            </h2>
            <div style={{ maxHeight: 520, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {(data?.recentEvents || []).length === 0 ? (
                <p style={{ color: "#777", fontSize: 13 }}>No funnel events recorded for the selected filters.</p>
              ) : (
                (data?.recentEvents || []).map((ev) => (
                  <div
                    key={String(ev.id)}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #ede9df",
                      background: "#fbf9f4",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: "#23483a" }}>
                        {String(ev.event_name || ev.funnel_stage)} ({String(ev.funnel_name || "retail")})
                      </span>
                      <span style={{ color: "#777", fontSize: 11 }}>{String(ev.created_at || "")}</span>
                    </div>
                    <div style={{ color: "#374151" }}>
                      {Boolean(ev.customer_name || ev.customer_email || ev.customer_phone) && (
                        <div>
                          <strong>Customer:</strong>{" "}
                          {[ev.customer_name, ev.customer_email, ev.customer_phone].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div>
                        <strong>Path:</strong> {String(ev.path || "/")}
                        {Number(ev.value_paise || 0) > 0 && ` · Value: ${formatInr(Number(ev.value_paise))}`}
                      </div>
                      {(Boolean(ev.utm_source) || Boolean(ev.utm_campaign) || Boolean(ev.utm_term)) && (
                        <div style={{ marginTop: 4, color: "#2c4e38", fontSize: 11 }}>
                          UTM: {[ev.utm_source, ev.utm_medium, ev.utm_campaign, ev.utm_term ? `kw:${ev.utm_term}` : ""].filter(Boolean).join(" / ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section style={{ background: "#fff", border: "1px solid #e2ddd0", borderRadius: 10, padding: 18 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>
              Captured Conversations (WhatsApp, Forms &amp; Inbox)
            </h2>
            <div style={{ maxHeight: 520, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {(data?.recentConversations || []).length === 0 ? (
                <p style={{ color: "#777", fontSize: 13 }}>No conversations recorded for the selected filters.</p>
              ) : (
                (data?.recentConversations || []).map((c) => (
                  <div
                    key={String(c.id)}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #ede9df",
                      background: "#f4f7f4",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: "#166534", textTransform: "uppercase", fontSize: 11 }}>
                        {String(c.channel || "whatsapp")} {c.reference_code ? `· ${String(c.reference_code)}` : ""}
                      </span>
                      <span style={{ color: "#777", fontSize: 11 }}>{String(c.created_at || "")}</span>
                    </div>
                    {Boolean(c.customer_name || c.customer_email || c.customer_phone) && (
                      <div style={{ fontWeight: 600, color: "#1d2a24", marginBottom: 2 }}>
                        {[c.customer_name, c.customer_email, c.customer_phone].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {Boolean(c.message_preview) && (
                      <div style={{ color: "#374151", marginBottom: 4 }}>{String(c.message_preview)}</div>
                    )}
                    <div style={{ fontSize: 11, color: "#5f665c" }}>
                      Page: {String(c.source_page || "/")}
                      {(Boolean(c.resolved_utm_source) || Boolean(c.resolved_utm_campaign) || Boolean(c.resolved_utm_term)) &&
                        ` · Attribution: ${[c.resolved_utm_source, c.resolved_utm_campaign, c.resolved_utm_term ? `kw:${c.resolved_utm_term}` : ""].filter(Boolean).join(" / ")}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* Tab 3: Remarketing Audiences & CSV Export */}
      {activeTab === "audiences" && (
        <section style={{ background: "#fff", border: "1px solid #e2ddd0", borderRadius: 10, padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#1d2a24" }}>
                Remarketing Audience Builder &amp; Export
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "#5f665c" }}>
                Automatically excludes paid buyers from unconverted remarketing segments and applies formula-safe CSV quoting + SHA-256 hashing for ad platforms.
              </p>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#23483a", background: "#eef5ed", padding: "8px 14px", borderRadius: 8 }}>
              {audienceLoading ? "Querying..." : `${audienceRecords.length} Matching Contacts`}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
            {SEGMENT_META.map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => setSegment(seg.id)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 8,
                  border: segment === seg.id ? "2px solid #23483a" : "1px solid #e2ddd0",
                  background: segment === seg.id ? "#f4f7f4" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2a24" }}>{seg.label}</div>
                <div style={{ fontSize: 11, color: "#5f665c", marginTop: 3 }}>{seg.description}</div>
              </button>
            ))}
          </div>

          {/* Export Buttons */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: 14, background: "#fbf9f4", borderRadius: 8, border: "1px solid #ede9df" }}>
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => void handleExportCsv("meta_hashed")}
              className="button button-primary"
              style={{ fontSize: 12, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} />
              {exportingFormat === "meta_hashed" ? "Exporting..." : "Export Meta Custom Audience (SHA-256)"}
            </button>
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => void handleExportCsv("google_customer_match")}
              className="button button-outline"
              style={{ fontSize: 12, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} />
              {exportingFormat === "google_customer_match" ? "Exporting..." : "Export Google Ads Customer Match (SHA-256)"}
            </button>
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => void handleExportCsv("crm_plain")}
              className="button button-outline"
              style={{ fontSize: 12, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} />
              {exportingFormat === "crm_plain" ? "Exporting..." : "Export CRM / Email CSV (With UTMs & Keywords)"}
            </button>
          </div>

          {/* Preview Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#fbf9f4", borderBottom: "1px solid #e2ddd0", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px" }}>Contact</th>
                  <th style={{ padding: "8px 10px" }}>Phone / Email</th>
                  <th style={{ padding: "8px 10px" }}>Location</th>
                  <th style={{ padding: "8px 10px" }}>Funnel</th>
                  <th style={{ padding: "8px 10px" }}>UTM Source / Campaign</th>
                  <th style={{ padding: "8px 10px" }}>Keyword</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Value (INR)</th>
                  <th style={{ padding: "8px 10px" }}>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {audienceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 28, textAlign: "center", color: "#777" }}>
                      {audienceLoading ? "Loading matching contacts..." : "No matching contacts found in this segment."}
                    </td>
                  </tr>
                ) : (
                  audienceRecords.slice(0, 100).map((r, i) => (
                    <tr key={`${r.email}-${r.phone}-${i}`} style={{ borderBottom: "1px solid #f0ece1" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                        {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div>{r.phone || "—"}</div>
                        <div style={{ color: "#5f665c" }}>{r.email || "—"}</div>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {[r.city, r.state, r.country].filter(Boolean).join(", ") || "IN"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>{r.funnelName}</td>
                      <td style={{ padding: "8px 10px" }}>
                        {[r.utmSource, r.utmCampaign].filter(Boolean).join(" / ") || "direct"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>{r.utmTerm || "—"}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>
                        {r.valueRupees > 0 ? `₹${r.valueRupees.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#5f665c" }}>{r.lastActivityAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
