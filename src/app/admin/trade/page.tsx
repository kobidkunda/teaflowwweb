"use client";

import "./admin-trade.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Layers,
  MessageSquare,
  PackageCheck,
  RefreshCw,
  Store,
  Truck,
  X,
} from "lucide-react";
import { TradeSettingsTab } from "@/components/admin/trade/TradeSettingsTab";
import { TradeOffersTab } from "@/components/admin/trade/TradeOffersTab";
import { TradeLanesTab } from "@/components/admin/trade/TradeLanesTab";
import { TradeContentTab } from "@/components/admin/trade/TradeContentTab";
import { TradeEnquiriesTab } from "@/components/admin/trade/TradeEnquiriesTab";
import { TradeOrdersTab } from "@/components/admin/trade/TradeOrdersTab";
import { TradePilotsTab } from "@/components/admin/trade/TradePilotsTab";
import {
  formatRupees,
  type AdminTradePayload,
  type StatusToast,
  type TabId,
  type TradeSettingsState,
} from "@/components/admin/trade/types";

export default function AdminTradePage() {
  const [tab, setTab] = useState<TabId>("settings");
  const [data, setData] = useState<AdminTradePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<StatusToast | null>(null);
  const [settingsForm, setSettingsForm] = useState<TradeSettingsState | null>(
    null
  );

  const tablistRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/trade", {
        credentials: "same-origin",
      });
      if (!res.ok) {
        throw new Error("Failed to load TeaFloww Trade console data.");
      }
      const json = (await res.json()) as AdminTradePayload;
      setData(json);
      setSettingsForm(json.settings);
    } catch (err) {
      setStatusMsg({
        kind: "err",
        text:
          err instanceof Error
            ? err.message
            : "Failed to load TeaFloww Trade console.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Auto-dismiss success toast after 4.5s
  useEffect(() => {
    if (statusMsg?.kind === "ok") {
      const timer = setTimeout(() => setStatusMsg(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // IntersectionObserver fallback for tablist edge-fade mask when scroll-driven animations are unsupported
  useEffect(() => {
    const scroller = tablistRef.current;
    if (!scroller || typeof window === "undefined") return;
    if (typeof CSS !== "undefined" && CSS.supports("animation-timeline", "scroll()")) {
      return;
    }
    const first = scroller.firstElementChild;
    const last = scroller.lastElementChild;
    if (!first || !last) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, intersectionRatio } of entries) {
          if (target === first) {
            scroller.classList.toggle("more-start", intersectionRatio < 1);
          }
          if (target === last) {
            scroller.classList.toggle("more-end", intersectionRatio < 1);
          }
        }
      },
      { root: scroller, threshold: 1, rootMargin: "1px" }
    );
    observer.observe(first);
    observer.observe(last);
    return () => observer.disconnect();
  }, [data]);

  async function handleSaved(toast: StatusToast) {
    setStatusMsg(toast);
    await loadData();
  }

  function handleError(msg: string) {
    setStatusMsg({ kind: "err", text: msg });
  }

  const publishedOffersCount =
    data?.offers.filter((o) => Boolean(o.published)).length ?? 0;
  const activeLanesCount =
    data?.lanes.filter((l) => Boolean(l.is_active)).length ?? 0;
  const newEnquiriesCount =
    data?.enquiries.filter((e) => String(e.status) === "new").length ?? 0;
  const totalOrderValuePaise =
    data?.orders.reduce(
      (sum, o) => sum + (Number(o.total_paise ?? 0) || 0),
      0
    ) ?? 0;

  const tabDefs: Array<{ id: TabId; label: string; badge?: number }> = [
    { id: "settings", label: "Settings & Funnel" },
    { id: "offers", label: "Offers", badge: data?.offers.length },
    { id: "lanes", label: "Lanes & PIN Preview", badge: data?.lanes.length },
    {
      id: "content",
      label: "Localisation & Audio",
      badge: data?.localizedContent.length,
    },
    { id: "enquiries", label: "Enquiries", badge: data?.enquiries.length },
    { id: "orders", label: "Orders", badge: data?.orders.length },
    { id: "pilots", label: "Shared Pilots", badge: data?.sharedPilots.length },
  ];

  function selectTab(nextId: TabId, focus = false) {
    setTab(nextId);
    const el = document.getElementById(`tf-trade-tab-${nextId}`);
    if (focus) el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return (
    <div className="tf-trade-wrap">
      {/* Header */}
      <header className="tf-trade-header">
        <div>
          <div className="tf-trade-eyebrow">TeaFloww Wholesale Operations</div>
          <div className="tf-trade-title-row">
            <h1 className="tf-trade-title">TeaFloww Trade</h1>
            <span className="tf-trade-route-pill">/tea-shops</span>
          </div>
          <p className="tf-trade-subtitle">
            Manage wholesale offers, storefront imagery, versioned freight lanes,
            depots, localized copy &amp; audio, enquiries, shared town pilots, and
            order reconciliation.
          </p>
        </div>

        <div className="tf-trade-header-actions">
          <button
            type="button"
            className="tf-trade-btn"
            disabled={loading}
            onClick={() => void loadData()}
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={loading ? "animate-spin" : ""}
            />
            <span>Refresh</span>
          </button>
          <a
            href="/tea-shops"
            target="_blank"
            rel="noopener noreferrer"
            className="tf-trade-btn tf-trade-btn--primary"
          >
            <span>Open /tea-shops</span>
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
      </header>

      {/* KPI Summary Strip */}
      {data && settingsForm ? (
        <div className="tf-trade-kpi-grid">
          <div className="tf-trade-kpi tf-trade-kpi--pine">
            <div className="tf-trade-kpi-head">
              <span className="tf-trade-kpi-label">Channel Status</span>
              <Store size={16} aria-hidden="true" color="#23483a" />
            </div>
            <div className="tf-trade-kpi-value">
              {settingsForm.channel_enabled ? "Live" : "Paused"}
            </div>
            <div className="tf-trade-kpi-meta">
              {settingsForm.enabled_locales.length} languages enabled
            </div>
          </div>

          <div className="tf-trade-kpi tf-trade-kpi--gold">
            <div className="tf-trade-kpi-head">
              <span className="tf-trade-kpi-label">Catalogue &amp; Lanes</span>
              <Truck size={16} aria-hidden="true" color="#9f6500" />
            </div>
            <div className="tf-trade-kpi-value">
              {publishedOffersCount} / {activeLanesCount}
            </div>
            <div className="tf-trade-kpi-meta">
              Published offers / active lanes
            </div>
          </div>

          <div className="tf-trade-kpi tf-trade-kpi--amber">
            <div className="tf-trade-kpi-head">
              <span className="tf-trade-kpi-label">Enquiries</span>
              <MessageSquare size={16} aria-hidden="true" color="#b36b3d" />
            </div>
            <div className="tf-trade-kpi-value">{data.enquiries.length}</div>
            <div className="tf-trade-kpi-meta">
              {newEnquiriesCount} awaiting follow-up
            </div>
          </div>

          <div className="tf-trade-kpi">
            <div className="tf-trade-kpi-head">
              <span className="tf-trade-kpi-label">Trade Orders</span>
              <PackageCheck size={16} aria-hidden="true" color="#1d2a24" />
            </div>
            <div className="tf-trade-kpi-value">{data.orders.length}</div>
            <div className="tf-trade-kpi-meta">
              {formatRupees(totalOrderValuePaise)} gross value
            </div>
          </div>
        </div>
      ) : null}

      {/* Status Toast */}
      {statusMsg ? (
        <div
          role={statusMsg.kind === "err" ? "alert" : "status"}
          aria-live={statusMsg.kind === "err" ? "assertive" : "polite"}
          className={`tf-trade-toast ${
            statusMsg.kind === "ok"
              ? "tf-trade-toast--ok"
              : "tf-trade-toast--err"
          }`}
        >
          <div className="tf-trade-toast-inner">
            {statusMsg.kind === "ok" ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <AlertCircle size={18} aria-hidden="true" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            type="button"
            className="tf-trade-btn tf-trade-btn--sm"
            aria-label="Dismiss notification"
            onClick={() => setStatusMsg(null)}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Accessible Single-Row Tablist */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="TeaFloww Trade workspace sections"
        className="tf-trade-tablist"
        onKeyDown={(e) => {
          const currentIndex = tabDefs.findIndex((t) => t.id === tab);
          let nextIndex = -1;
          if (e.key === "ArrowRight")
            nextIndex = (currentIndex + 1) % tabDefs.length;
          else if (e.key === "ArrowLeft")
            nextIndex = (currentIndex - 1 + tabDefs.length) % tabDefs.length;
          else if (e.key === "Home") nextIndex = 0;
          else if (e.key === "End") nextIndex = tabDefs.length - 1;
          if (nextIndex >= 0) {
            e.preventDefault();
            selectTab(tabDefs[nextIndex].id, true);
          }
        }}
      >
        {tabDefs.map((t) => (
          <button
            key={t.id}
            id={`tf-trade-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            className="tf-trade-tab"
            onClick={() => selectTab(t.id)}
          >
            <span>{t.label}</span>
            {t.badge !== undefined ? (
              <span className="tf-trade-tab-badge">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && !data ? (
        <div
          className="tf-trade-card"
          style={{ textAlign: "center", padding: "48px 24px" }}
        >
          <Layers
            size={26}
            aria-hidden="true"
            style={{ margin: "0 auto 10px", color: "#5e6862" }}
          />
          <div style={{ fontWeight: 700, color: "#1d2a24" }}>
            Loading TeaFloww Trade console…
          </div>
          <progress
            className="tf-trade-progress"
            style={{ maxWidth: 240, margin: "12px auto 0", display: "block" }}
            aria-label="Loading trade console"
          />
        </div>
      ) : null}

      {/* Active Tab Panel */}
      {data ? (
        <section
          role="tabpanel"
          aria-labelledby={`tf-trade-tab-${tab}`}
          tabIndex={0}
        >
          {tab === "settings" && settingsForm ? (
            <TradeSettingsTab
              data={data}
              settingsForm={settingsForm}
              setSettingsForm={setSettingsForm}
              onSaved={handleSaved}
              onError={handleError}
            />
          ) : null}

          {tab === "offers" ? (
            <TradeOffersTab
              data={data}
              onSaved={handleSaved}
              onError={handleError}
            />
          ) : null}

          {tab === "lanes" ? (
            <TradeLanesTab
              data={data}
              onSaved={handleSaved}
              onError={handleError}
            />
          ) : null}

          {tab === "content" ? (
            <TradeContentTab
              data={data}
              onSaved={handleSaved}
              onError={handleError}
            />
          ) : null}

          {tab === "enquiries" ? (
            <TradeEnquiriesTab
              data={data}
              onSaved={handleSaved}
              onError={handleError}
            />
          ) : null}

          {tab === "orders" ? (
            <TradeOrdersTab
              data={data}
              onSaved={handleSaved}
              onError={handleError}
            />
          ) : null}

          {tab === "pilots" ? (
            <TradePilotsTab
              data={data}
              onSaved={handleSaved}
              onError={handleError}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
