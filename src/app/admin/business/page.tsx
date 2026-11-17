"use client";
import { TraderPageEditor } from "@/components/admin/TraderPageEditor";

import "./admin-business.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BusinessMediaField } from "@/components/admin/BusinessMediaField";
import {
  DISQUALIFICATION_REASONS,
  LEAD_STATUSES,
  type BusinessLeadStatus,
  type OfferCode,
} from "@/lib/business/schema";
import type {
  B2BClaimRecord,
  B2BLeadRecord,
  B2BOfferRecord,
  B2BOutboxRecord,
  B2BPageContentRecord,
  B2BSettings,
} from "@/lib/business/repository";
import {
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Search,
  Filter,
  Phone,
  Building2,
  Layers,
  FileText,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Send,
  Eye,
  Check,
  Tag,
  TrendingUp,
  DollarSign,
} from "lucide-react";

type TabId = "traders" | "overview" | "offers" | "content" | "claims" | "leads" | "outbox";

type OverviewPayload = {
  settings: B2BSettings;
  offers: B2BOfferRecord[];
  pageContent: B2BPageContentRecord[];
  claims: B2BClaimRecord[];
  leads: B2BLeadRecord[];
  outbox: B2BOutboxRecord[];
  funnelSummary: {
    totalLeads: number;
    byStatus: Record<string, number>;
    bySegment: Record<string, number>;
    pendingOutbox: number;
  };
};

export default function AdminBusinessPage() {
  const [tab, setTab] = useState<TabId>("traders");
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Settings draft
  const [settingsDraft, setSettingsDraft] = useState<B2BSettings | null>(null);

  // Offer editor state
  const [selectedOfferCode, setSelectedOfferCode] = useState<OfferCode>("bulk_supply");
  const [offerDraft, setOfferDraft] = useState<B2BOfferRecord | null>(null);

  // Page content editor state
  const [contentKey, setContentKey] = useState<string>("starter:en");
  const [contentDraft, setContentDraft] = useState<B2BPageContentRecord | null>(null);

  // Claim editor state
  const [selectedClaimKey, setSelectedClaimKey] = useState<string>("siliguri_origin");
  const [claimDraft, setClaimDraft] = useState<B2BClaimRecord | null>(null);
  const [isNewClaim, setIsNewClaim] = useState(false);

  // Lead search & filters
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("");
  const [leadSegmentFilter, setLeadSegmentFilter] = useState<string>("");

  // Modals & Dialog refs (Native <dialog> with Modern Web Guidance)
  const leadDetailDialogRef = useRef<HTMLDialogElement | null>(null);
  const quoteDialogRef = useRef<HTMLDialogElement | null>(null);
  const markWonDialogRef = useRef<HTMLDialogElement | null>(null);

  const [selectedLeadDetail, setSelectedLeadDetail] = useState<{
    lead: B2BLeadRecord;
    events: Array<{ id: string; type: string; actor_id: string | null; event_time: string; metadata: Record<string, unknown> | null }>;
    quotes: Array<{ id: string; quote_number: string; version: number; total_paise: number; status: string; freight_terms: string; created_at: string }>;
  } | null>(null);

  // Quote form state
  const [quoteLead, setQuoteLead] = useState<B2BLeadRecord | null>(null);
  const [quoteDesc, setQuoteDesc] = useState("Assam CTC Bulk 25kg Sack");
  const [quoteFormat, setQuoteFormat] = useState("25kg sack");
  const [quoteQtyLabel, setQuoteQtyLabel] = useState("100 kg");
  const [quoteUnitPaise, setQuoteUnitPaise] = useState("28000");
  const [quoteFreightPaise, setQuoteFreightPaise] = useState("180000");
  const [quoteTaxPaise, setQuoteTaxPaise] = useState("140000");
  const [quoteFreightTerms, setQuoteFreightTerms] = useState(
    "Surface transport to destination pincode, subject to final dispatch confirmation."
  );

  // Mark Won modal state
  const [wonLead, setWonLead] = useState<B2BLeadRecord | null>(null);
  const [wonOrderId, setWonOrderId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/business", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load B2B admin data.");
      const json = (await res.json()) as OverviewPayload;
      setData(json);
      setSettingsDraft(json.settings);

      const matchedOffer = json.offers.find((o) => o.code === selectedOfferCode) ?? json.offers[0] ?? null;
      if (matchedOffer) setOfferDraft(matchedOffer);

      const matchedContent =
        json.pageContent.find((c) => `${c.segment}:${c.locale}` === contentKey) ??
        json.pageContent[0] ??
        null;
      if (matchedContent) setContentDraft(matchedContent);

      const matchedClaim =
        json.claims.find((c) => c.claim_key === selectedClaimKey) ?? json.claims[0] ?? null;
      if (matchedClaim) setClaimDraft(matchedClaim);
    } catch (err) {
      setStatusMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to load B2B admin data.",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedOfferCode, contentKey, selectedClaimKey]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Auto-dismiss success status toast
  useEffect(() => {
    if (statusMsg?.kind === "ok") {
      const timer = setTimeout(() => setStatusMsg(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // Backdrop light dismiss helper for native <dialog>
  const handleDialogBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = e.currentTarget;
    const rect = dialog.getBoundingClientRect();
    const isOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (isOutside) {
      dialog.close();
    }
  };

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settingsDraft) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          business_landing_enabled: settingsDraft.business_landing_enabled,
          leads_enabled: settingsDraft.leads_enabled,
          whatsapp_enabled: settingsDraft.whatsapp_enabled,
          whatsapp_e164: settingsDraft.whatsapp_e164 || null,
          support_hours: settingsDraft.support_hours,
          starter_hero_image_url: settingsDraft.starter_hero_image_url,
          trader_hero_image_url: settingsDraft.trader_hero_image_url,
          proof_image_1_url: settingsDraft.proof_image_1_url,
          proof_image_2_url: settingsDraft.proof_image_2_url,
          crm_webhook_enabled: settingsDraft.crm_webhook_enabled,
        }),
      });
      const json = (await res.json()) as { settings?: B2BSettings; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save settings.");
      setStatusMsg({ kind: "ok", text: "B2B commercial settings updated successfully." });
      await loadData();
    } catch (err) {
      setStatusMsg({ kind: "err", text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  async function saveOffer(e: React.FormEvent, approveFlag?: boolean) {
    e.preventDefault();
    if (!offerDraft) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/business/offers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          code: offerDraft.code,
          eyebrow_en: offerDraft.eyebrow_en,
          eyebrow_hi: offerDraft.eyebrow_hi,
          title_en: offerDraft.title_en,
          title_hi: offerDraft.title_hi,
          description_en: offerDraft.description_en,
          description_hi: offerDraft.description_hi,
          cta_label_en: offerDraft.cta_label_en,
          cta_label_hi: offerDraft.cta_label_hi,
          icon: offerDraft.icon,
          image_url: offerDraft.image_url || null,
          image_alt_en: offerDraft.image_alt_en || null,
          image_alt_hi: offerDraft.image_alt_hi || null,
          sku_ids: offerDraft.sku_ids,
          moq_text_en: offerDraft.moq_text_en || null,
          moq_text_hi: offerDraft.moq_text_hi || null,
          pricing_mode: offerDraft.pricing_mode,
          service_scope: offerDraft.service_scope,
          active: offerDraft.active,
          sort_order: offerDraft.sort_order,
          ...(approveFlag !== undefined ? { approve: approveFlag } : {}),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save offer.");
      setStatusMsg({ kind: "ok", text: `Offer '${offerDraft.code}' saved & approved.` });
      await loadData();
    } catch (err) {
      setStatusMsg({ kind: "err", text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  async function saveContent(e: React.FormEvent) {
    e.preventDefault();
    if (!contentDraft) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/business/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          segment: contentDraft.segment,
          locale: contentDraft.locale,
          eyebrow: contentDraft.eyebrow,
          headline: contentDraft.headline,
          intro: contentDraft.intro,
          primary_cta: contentDraft.primary_cta,
          secondary_cta: contentDraft.secondary_cta,
          hero_image_url: contentDraft.hero_image_url,
          hero_image_alt: contentDraft.hero_image_alt,
          process_intro: contentDraft.process_intro,
          steps: contentDraft.steps,
          proof_title: contentDraft.proof_title,
          proof_body: contentDraft.proof_body,
          proof_items: contentDraft.proof_items,
          form_heading: contentDraft.form_heading,
          form_subhead: contentDraft.form_subhead,
          faq: contentDraft.faq,
          seo_title: contentDraft.seo_title,
          seo_description: contentDraft.seo_description,
          approve: true,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save page content.");
      setStatusMsg({
        kind: "ok",
        text: `Page content '${contentDraft.segment}:${contentDraft.locale}' saved & approved.`,
      });
      await loadData();
    } catch (err) {
      setStatusMsg({ kind: "err", text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  async function saveClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!claimDraft) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/business/claims", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          claim_key: claimDraft.claim_key,
          exact_copy_en: claimDraft.exact_copy_en,
          exact_copy_hi: claimDraft.exact_copy_hi,
          evidence_source: claimDraft.evidence_source,
          evidence_owner: claimDraft.evidence_owner,
          allowed_channels: claimDraft.allowed_channels,
          active: claimDraft.active,
          valid_until: claimDraft.valid_until || null,
          approve: true,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save claim.");
      setStatusMsg({ kind: "ok", text: `Claim '${claimDraft.claim_key}' saved & approved.` });
      setIsNewClaim(false);
      setSelectedClaimKey(claimDraft.claim_key);
      await loadData();
    } catch (err) {
      setStatusMsg({ kind: "err", text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  async function openLeadDetail(leadId: string) {
    try {
      const res = await fetch(`/api/admin/business/leads/${leadId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load lead detail.");
      const json = await res.json();
      setSelectedLeadDetail(json);
      leadDetailDialogRef.current?.showModal();
    } catch (err) {
      setStatusMsg({ kind: "err", text: err instanceof Error ? err.message : "Failed to load lead detail." });
    }
  }

  async function transitionLead(
    leadId: string,
    status: BusinessLeadStatus,
    extra?: { qualification_reason?: string; first_order_id?: string }
  ) {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/admin/business/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status, ...extra }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to transition lead.");
      setStatusMsg({ kind: "ok", text: `Lead status updated to '${status.replace(/_/g, " ")}'.` });
      if (selectedLeadDetail && selectedLeadDetail.lead.id === leadId) {
        await openLeadDetail(leadId);
      }
      await loadData();
    } catch (err) {
      setStatusMsg({ kind: "err", text: err instanceof Error ? err.message : "Transition failed." });
    } finally {
      setSaving(false);
    }
  }

  function handleOpenQuoteModal(lead: B2BLeadRecord) {
    setQuoteLead(lead);
    setQuoteDesc(`Assam CTC Commercial Supply (${lead.quantity_band || "100"} kg)`);
    setQuoteQtyLabel(`${lead.quantity_band || "100"} kg`);
    quoteDialogRef.current?.showModal();
  }

  async function submitQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!quoteLead) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const unitPaise = Number(quoteUnitPaise) || 0;
      const freightPaise = Number(quoteFreightPaise) || 0;
      const taxPaise = Number(quoteTaxPaise) || 0;
      const res = await fetch("/api/admin/business/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          lead_id: quoteLead.id,
          line_items: [
            {
              description: quoteDesc,
              format: quoteFormat,
              quantity_label: quoteQtyLabel,
              unit_price_paise: unitPaise,
              line_total_paise: unitPaise,
            },
          ],
          freight_paise: freightPaise,
          tax_paise: taxPaise,
          freight_terms: quoteFreightTerms,
          mark_sent: true,
        }),
      });
      const json = (await res.json()) as { quote?: { quote_number: string }; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to create quote.");
      setStatusMsg({
        kind: "ok",
        text: `Commercial Quote ${json.quote?.quote_number ?? ""} generated for ${quoteLead.reference}.`,
      });
      quoteDialogRef.current?.close();
      setQuoteLead(null);
      await loadData();
    } catch (err) {
      setStatusMsg({ kind: "err", text: err instanceof Error ? err.message : "Quote creation failed." });
    } finally {
      setSaving(false);
    }
  }

  function handleOpenWonModal(lead: B2BLeadRecord) {
    setWonLead(lead);
    setWonOrderId("");
    markWonDialogRef.current?.showModal();
  }

  async function handleConfirmWon(e: React.FormEvent) {
    e.preventDefault();
    if (!wonLead || !wonOrderId.trim()) return;
    markWonDialogRef.current?.close();
    await transitionLead(wonLead.id, "won", { first_order_id: wonOrderId.trim() });
    setWonLead(null);
    setWonOrderId("");
  }

  async function retryOutbox(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/business/outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to retry outbox item.");
      setStatusMsg({ kind: "ok", text: "Outbox item requeued for immediate dispatch." });
      await loadData();
    } catch (err) {
      setStatusMsg({ kind: "err", text: err instanceof Error ? err.message : "Retry failed." });
    } finally {
      setSaving(false);
    }
  }

  // Filter leads client-side
  const filteredLeads = (data?.leads ?? []).filter((l) => {
    if (leadStatusFilter && l.status !== leadStatusFilter) return false;
    if (leadSegmentFilter && l.segment !== leadSegmentFilter) return false;
    if (leadSearch.trim()) {
      const q = leadSearch.toLowerCase().trim();
      const matchRef = l.reference.toLowerCase().includes(q);
      const matchName = l.name.toLowerCase().includes(q);
      const matchPhone = l.phone.includes(q);
      const matchCompany = l.company ? l.company.toLowerCase().includes(q) : false;
      const matchPin = l.pincode.includes(q);
      const matchCampaign = (l.utm_campaign || "").toLowerCase().includes(q);
      if (!matchRef && !matchName && !matchPhone && !matchCompany && !matchPin && !matchCampaign) {
        return false;
      }
    }
    return true;
  });

  const tabDefs: Array<{ id: TabId; label: string; badge?: number }> = [
    { id: "traders", label: "Tea Traders · Slider & Shop" },
    { id: "overview", label: "Overview & Settings" },
    { id: "offers", label: "Offers (3 Formats)" },
    { id: "content", label: "Starter / Legacy Content (EN/HI)" },
    { id: "claims", label: "Approved Claims" },
    { id: "leads", label: "Leads & Quotes", badge: data?.funnelSummary.totalLeads ?? 0 },
    { id: "outbox", label: "CRM Outbox", badge: data?.funnelSummary.pendingOutbox ?? 0 },
  ];

  const grandTotalPaise =
    (Number(quoteUnitPaise) || 0) + (Number(quoteFreightPaise) || 0) + (Number(quoteTaxPaise) || 0);

  return (
    <>
      <div className="tf-admin-wrap">
        {/* Workspace Header */}
        <header className="tf-admin-header">
          <div>
            <div className="tf-admin-eyebrow">TeaFloww Commercial Operations</div>
            <h1 className="tf-admin-title">B2B Acquisition &amp; Lead CRM</h1>
            <p className="tf-admin-subtitle">
              Manage <code>/start-tea-business</code> and <code>/tea-traders</code> campaigns, commercial offers, claims &amp; quotes.
            </p>
          </div>
          <div className="tf-admin-header-actions">
            <a
              href="/start-tea-business"
              target="_blank"
              rel="noreferrer"
              className="tf-admin-btn"
              title="Open public Tea Business Starter landing page in new tab"
            >
              <span>View Starter Page</span>
              <ExternalLink size={14} />
            </a>
            <a
              href="/tea-traders"
              target="_blank"
              rel="noreferrer"
              className="tf-admin-btn"
              title="Open public Tea Traders & Wholesalers landing page in new tab"
            >
              <span>View Trader Page</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </header>

        {/* Status Toast */}
        {statusMsg ? (
          <div
            role="status"
            aria-live="polite"
            className={`tf-admin-toast ${statusMsg.kind === "ok" ? "tf-admin-toast--ok" : "tf-admin-toast--err"}`}
          >
            <div className="tf-admin-toast-inner">
              {statusMsg.kind === "ok" ? (
                <CheckCircle2 size={18} className="text-emerald-700" />
              ) : (
                <AlertCircle size={18} className="text-rose-700" />
              )}
              <span>{statusMsg.text}</span>
            </div>
            <button
              type="button"
              className="tf-admin-btn tf-admin-btn--sm"
              onClick={() => setStatusMsg(null)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {/* Accessible Tablist with Arrow Keys Navigation */}
        <div
          role="tablist"
          aria-label="B2B Commercial Workspace Sections"
          className="tf-admin-tablist"
          onKeyDown={(e) => {
            const currentIndex = tabDefs.findIndex((t) => t.id === tab);
            let nextIndex = -1;
            if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabDefs.length;
            else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabDefs.length) % tabDefs.length;
            else if (e.key === "Home") nextIndex = 0;
            else if (e.key === "End") nextIndex = tabDefs.length - 1;
            if (nextIndex >= 0) {
              e.preventDefault();
              const nextId = tabDefs[nextIndex].id;
              setTab(nextId);
              const nextEl = document.getElementById(`tf-admin-tab-${nextId}`);
              nextEl?.focus();
              nextEl?.scrollIntoView({ block: "nearest", inline: "nearest" });
            }
          }}
        >
          {tabDefs.map((t) => (
            <button
              key={t.id}
              id={`tf-admin-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`tf-admin-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className="tf-admin-tab"
              onClick={(e) => {
                setTab(t.id);
                e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
              }}
            >
              <span>{t.label}</span>
              {t.badge !== undefined ? (
                <span className="tf-tab-badge">{t.badge}</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Loading Skeleton */}
        {loading && !data ? (
          <div className="tf-admin-card" style={{ textAlign: "center", padding: "48px 24px" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px", color: "#8c9b88" }} />
            <div style={{ fontWeight: 600, color: "#4a554f" }}>Loading commercial acquisition workspace…</div>
          </div>
        ) : null}

        {tab === "traders" && <section id="tf-admin-panel-traders" role="tabpanel" aria-labelledby="tf-admin-tab-traders"><TraderPageEditor /></section>}
        {/* TAB 1: OVERVIEW & SETTINGS */}
        {!loading && data && (
          <section
            id="tf-admin-panel-overview"
            role="tabpanel"
            aria-labelledby="tf-admin-tab-overview"
            hidden={tab !== "overview"}
          >
            {settingsDraft ? (
              <>
                {/* KPI Metrics */}
                <div className="tf-admin-kpi-grid">
                  <div className="tf-admin-kpi">
                    <div className="tf-admin-kpi-header">
                      <span className="tf-admin-kpi-label">Total Inbound Leads</span>
                      <Layers size={18} className="tf-admin-kpi-icon" />
                    </div>
                    <div className="tf-admin-kpi-value">{data.funnelSummary.totalLeads}</div>
                    <div className="tf-admin-kpi-meta">Across all attribution channels</div>
                  </div>

                  <div className="tf-admin-kpi tf-admin-kpi--gold">
                    <div className="tf-admin-kpi-header">
                      <span className="tf-admin-kpi-label">Starter / Trader</span>
                      <TrendingUp size={18} className="tf-admin-kpi-icon" />
                    </div>
                    <div className="tf-admin-kpi-value">
                      {data.funnelSummary.bySegment.starter ?? 0} <span style={{ fontSize: 18, color: "#8b948f" }}>/</span> {data.funnelSummary.bySegment.trader ?? 0}
                    </div>
                    <div className="tf-admin-kpi-meta">New business vs wholesale trade</div>
                  </div>

                  <div className="tf-admin-kpi tf-admin-kpi--green">
                    <div className="tf-admin-kpi-header">
                      <span className="tf-admin-kpi-label">Qualified &amp; Won</span>
                      <CheckCircle2 size={18} className="tf-admin-kpi-icon" />
                    </div>
                    <div className="tf-admin-kpi-value">
                      {data.funnelSummary.byStatus.qualified ?? 0} <span style={{ fontSize: 18, color: "#8c9b88" }}>/</span> {data.funnelSummary.byStatus.won ?? 0}
                    </div>
                    <div className="tf-admin-kpi-meta">Commercial pipeline conversion</div>
                  </div>

                  <div className="tf-admin-kpi">
                    <div className="tf-admin-kpi-header">
                      <span className="tf-admin-kpi-label">Outbox Pending</span>
                      <Clock size={18} className="tf-admin-kpi-icon" />
                    </div>
                    <div className="tf-admin-kpi-value">{data.funnelSummary.pendingOutbox}</div>
                    <div className="tf-admin-kpi-meta">CRM webhook event queue</div>
                  </div>
                </div>

                {/* Settings Form */}
                <form onSubmit={saveSettings} className="tf-admin-card">
                  <div className="tf-admin-card-header">
                    <div>
                      <h2 className="tf-admin-card-title">
                        <Tag size={18} />
                        Channel &amp; Feature Controls
                      </h2>
                      <p className="tf-admin-card-desc">
                        Manage public routing, lead forms, verified WhatsApp touchpoints, and CRM webhooks.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switches */}
                  <div className="tf-admin-grid-2" style={{ marginBottom: 20 }}>
                    <label className="tf-admin-toggle-card">
                      <input
                        type="checkbox"
                        className="tf-admin-toggle-input"
                        checked={settingsDraft.business_landing_enabled}
                        onChange={(e) =>
                          setSettingsDraft({ ...settingsDraft, business_landing_enabled: e.target.checked })
                        }
                      />
                      <span className="tf-admin-toggle-switch" aria-hidden="true" />
                      <span className="tf-admin-toggle-label">
                        <span className="tf-admin-toggle-title">Landing Pages Active</span>
                        <span className="tf-admin-toggle-subtitle">
                          Enables public access to /start-tea-business and /tea-traders.
                        </span>
                      </span>
                    </label>

                    <label className="tf-admin-toggle-card">
                      <input
                        type="checkbox"
                        className="tf-admin-toggle-input"
                        checked={settingsDraft.leads_enabled}
                        onChange={(e) =>
                          setSettingsDraft({ ...settingsDraft, leads_enabled: e.target.checked })
                        }
                      />
                      <span className="tf-admin-toggle-switch" aria-hidden="true" />
                      <span className="tf-admin-toggle-label">
                        <span className="tf-admin-toggle-title">Lead Intake Form Enabled</span>
                        <span className="tf-admin-toggle-subtitle">
                          Accepts verified form submissions to POST /api/business-leads.
                        </span>
                      </span>
                    </label>

                    <label className="tf-admin-toggle-card">
                      <input
                        type="checkbox"
                        className="tf-admin-toggle-input"
                        checked={settingsDraft.whatsapp_enabled}
                        onChange={(e) =>
                          setSettingsDraft({ ...settingsDraft, whatsapp_enabled: e.target.checked })
                        }
                      />
                      <span className="tf-admin-toggle-switch" aria-hidden="true" />
                      <span className="tf-admin-toggle-label">
                        <span className="tf-admin-toggle-title">Verified WhatsApp CTA</span>
                        <span className="tf-admin-toggle-subtitle">
                          Renders verified direct WhatsApp deep-links with context parameters.
                        </span>
                      </span>
                    </label>

                    <label className="tf-admin-toggle-card">
                      <input
                        type="checkbox"
                        className="tf-admin-toggle-input"
                        checked={settingsDraft.crm_webhook_enabled}
                        onChange={(e) =>
                          setSettingsDraft({ ...settingsDraft, crm_webhook_enabled: e.target.checked })
                        }
                      />
                      <span className="tf-admin-toggle-switch" aria-hidden="true" />
                      <span className="tf-admin-toggle-label">
                        <span className="tf-admin-toggle-title">CRM Webhook Forwarding</span>
                        <span className="tf-admin-toggle-subtitle">
                          Dispatches outbox event notifications to configured CRM endpoints.
                        </span>
                      </span>
                    </label>
                  </div>

                  {/* Contact & Support Configuration */}
                  <div className="tf-admin-grid-2" style={{ marginBottom: 20 }}>
                    <div className="tf-admin-field">
                      <label htmlFor="settings-whatsapp" className="tf-admin-label">
                        Verified WhatsApp E.164 (digits only)
                      </label>
                      <input
                        id="settings-whatsapp"
                        className="tf-admin-input"
                        placeholder="e.g. 917001304853"
                        value={settingsDraft.whatsapp_e164 ?? ""}
                        onChange={(e) =>
                          setSettingsDraft({ ...settingsDraft, whatsapp_e164: e.target.value })
                        }
                      />
                      <span className="tf-admin-help">Format: country code + subscriber digits (no +, -, or spaces)</span>
                    </div>

                    <div className="tf-admin-field">
                      <label htmlFor="settings-support-hours" className="tf-admin-label">
                        Operational Support Hours
                      </label>
                      <input
                        id="settings-support-hours"
                        className="tf-admin-input"
                        value={settingsDraft.support_hours}
                        onChange={(e) =>
                          setSettingsDraft({ ...settingsDraft, support_hours: e.target.value })
                        }
                      />
                      <span className="tf-admin-help">Publicly displayed response SLA on commercial landing pages</span>
                    </div>
                  </div>

                  {/* Brand & Proof Media URLs with Thumbnails */}
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: "20px 0 12px", color: "#1d2a24" }}>
                    Landing Page Media Assets
                  </h3>
                  <div className="tf-admin-grid-2">
                    {([
                      ["starter_hero_image_url", "Starter Hero Image"],
                      ["trader_hero_image_url", "Trader Hero Image"],
                      ["proof_image_1_url", "Proof Gallery Image 1"],
                      ["proof_image_2_url", "Proof Gallery Image 2"],
                    ] as const).map(([field, label]) => <BusinessMediaField key={field} label={label} value={settingsDraft[field]} onChange={url => setSettingsDraft(current => current ? { ...current, [field]: url } : current)} />)}
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e6e1d6" }}>
                    <button type="submit" disabled={saving} className="tf-admin-btn tf-admin-btn--primary">
                      {saving ? "Saving Changes…" : "Save Commercial Settings"}
                    </button>
                  </div>
                </form>
              </>
            ) : null}
          </section>
        )}

        {/* TAB 2: OFFERS (3 FORMATS) */}
        {!loading && data && (
          <section
            id="tf-admin-panel-offers"
            role="tabpanel"
            aria-labelledby="tf-admin-tab-offers"
            hidden={tab !== "offers"}
          >
            {offerDraft ? (
              <form onSubmit={(e) => saveOffer(e)} className="tf-admin-card">
                <div className="tf-admin-card-header">
                  <div>
                    <h2 className="tf-admin-card-title">Commercial Format Offers</h2>
                    <p className="tf-admin-card-desc">
                      Select an offer format to configure its messaging, MOQ thresholds, pricing mode, and linked SKUs.
                    </p>
                  </div>

                  {/* Visual Offer Selector */}
                  <div className="tf-offer-pill-group" aria-label="Commercial offer formats">
                    {data.offers.map((o) => (
                      <button
                        key={o.code}
                        type="button"
                        aria-pressed={selectedOfferCode === o.code}
                        className="tf-offer-pill"
                        onClick={() => {
                          setSelectedOfferCode(o.code);
                          setOfferDraft(o);
                        }}
                      >
                        <span>{o.title_en}</span>
                        <span className={`tf-badge tf-badge--${o.active ? "ok" : "lost"}`}>
                          {o.active ? "Active" : "Inactive"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Offer Fields Grid */}
                <div className="tf-admin-grid-2" style={{ marginBottom: 16 }}>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Eyebrow (English)</label>
                    <input
                      className="tf-admin-input"
                      value={offerDraft.eyebrow_en}
                      onChange={(e) => setOfferDraft({ ...offerDraft, eyebrow_en: e.target.value })}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Eyebrow (Hindi)</label>
                    <input
                      className="tf-admin-input"
                      value={offerDraft.eyebrow_hi}
                      onChange={(e) => setOfferDraft({ ...offerDraft, eyebrow_hi: e.target.value })}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Title (English)</label>
                    <input
                      className="tf-admin-input"
                      value={offerDraft.title_en}
                      onChange={(e) => setOfferDraft({ ...offerDraft, title_en: e.target.value })}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Title (Hindi)</label>
                    <input
                      className="tf-admin-input"
                      value={offerDraft.title_hi}
                      onChange={(e) => setOfferDraft({ ...offerDraft, title_hi: e.target.value })}
                    />
                  </div>
                </div>

                <div className="tf-admin-grid-2" style={{ marginBottom: 16 }}>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Description (English)</label>
                    <textarea
                      rows={3}
                      className="tf-admin-textarea"
                      value={offerDraft.description_en}
                      onChange={(e) => setOfferDraft({ ...offerDraft, description_en: e.target.value })}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Description (Hindi)</label>
                    <textarea
                      rows={3}
                      className="tf-admin-textarea"
                      value={offerDraft.description_hi}
                      onChange={(e) => setOfferDraft({ ...offerDraft, description_hi: e.target.value })}
                    />
                  </div>
                </div>

                <div className="tf-admin-grid-2" style={{ marginBottom: 16 }}>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">CTA Button Label (English)</label>
                    <input
                      className="tf-admin-input"
                      value={offerDraft.cta_label_en}
                      onChange={(e) => setOfferDraft({ ...offerDraft, cta_label_en: e.target.value })}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">CTA Button Label (Hindi)</label>
                    <input
                      className="tf-admin-input"
                      value={offerDraft.cta_label_hi}
                      onChange={(e) => setOfferDraft({ ...offerDraft, cta_label_hi: e.target.value })}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">MOQ Disclosure (English)</label>
                    <input
                      className="tf-admin-input"
                      placeholder="e.g. Minimum order: 25 kg sack"
                      value={offerDraft.moq_text_en ?? ""}
                      onChange={(e) => setOfferDraft({ ...offerDraft, moq_text_en: e.target.value })}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">MOQ Disclosure (Hindi)</label>
                    <input
                      className="tf-admin-input"
                      placeholder="e.g. न्यूनतम ऑर्डर: 25 किग्रा"
                      value={offerDraft.moq_text_hi ?? ""}
                      onChange={(e) => setOfferDraft({ ...offerDraft, moq_text_hi: e.target.value })}
                    />
                  </div>
                </div>

                <div className="tf-admin-grid-2" style={{ marginBottom: 16 }}>
                  <BusinessMediaField key={offerDraft.code} label="Offer Image" value={offerDraft.image_url ?? ""} optional onChange={url => setOfferDraft(current => current?.code === offerDraft.code ? { ...current, image_url: url } : current)} />
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Sort Order (display sequence)</label>
                    <input
                      type="number"
                      className="tf-admin-input"
                      value={offerDraft.sort_order}
                      onChange={(e) => setOfferDraft({ ...offerDraft, sort_order: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="tf-admin-grid-2" style={{ marginBottom: 16 }}>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Linked SKU IDs (comma-separated)</label>
                    <input
                      className="tf-admin-input"
                      placeholder="e.g. CTC-ASSAM-25KG, CTC-DOOARS-25KG"
                      value={offerDraft.sku_ids.join(", ")}
                      onChange={(e) =>
                        setOfferDraft({
                          ...offerDraft,
                          sku_ids: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        })
                      }
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Service Scope Tags (comma-separated)</label>
                    <input
                      className="tf-admin-input"
                      placeholder="e.g. door_delivery, gst_invoice, lab_test_report"
                      value={offerDraft.service_scope.join(", ")}
                      onChange={(e) =>
                        setOfferDraft({
                          ...offerDraft,
                          service_scope: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="tf-admin-grid-2" style={{ marginBottom: 20 }}>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Commercial Pricing Mode</label>
                    <select
                      className="tf-admin-select"
                      value={offerDraft.pricing_mode}
                      onChange={(e) =>
                        setOfferDraft({
                          ...offerDraft,
                          pricing_mode: e.target.value as B2BOfferRecord["pricing_mode"],
                        })
                      }
                    >
                      <option value="request_quote">Request Commercial Quote (Lead CRM)</option>
                      <option value="approved_display_price">Approved Display Price</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <label className="tf-admin-toggle-card" style={{ width: "100%" }}>
                      <input
                        type="checkbox"
                        className="tf-admin-toggle-input"
                        checked={offerDraft.active}
                        onChange={(e) => setOfferDraft({ ...offerDraft, active: e.target.checked })}
                      />
                      <span className="tf-admin-toggle-switch" aria-hidden="true" />
                      <span className="tf-admin-toggle-label">
                        <span className="tf-admin-toggle-title">Active on Public Pages</span>
                        <span className="tf-admin-toggle-subtitle">Visible on commercial landing pages</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e6e1d6", display: "flex", gap: 10 }}>
                  <button type="submit" disabled={saving} className="tf-admin-btn tf-admin-btn--primary">
                    {saving ? "Saving Offer…" : "Save & Approve Offer"}
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        )}

        {/* TAB 3: PAGE CONTENT (EN/HI) */}
        {!loading && data && (
          <section
            id="tf-admin-panel-content"
            role="tabpanel"
            aria-labelledby="tf-admin-tab-content"
            hidden={tab !== "content"}
          >
            {contentDraft ? (
              <form onSubmit={saveContent} className="tf-admin-card">
                <div className="tf-admin-card-header">
                  <div>
                    <h2 className="tf-admin-card-title">Localized Landing Page Content</h2>
                    <p className="tf-admin-card-desc">
                      Select target segment and locale to edit headlines, process steps, proof gallery items, and FAQs.
                    </p>
                  </div>

                  <div className="tf-offer-pill-group" aria-label="Segment and locale page content">
                    {data.pageContent.map((c) => {
                      const key = `${c.segment}:${c.locale}`;
                      const isSel = contentKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          className="tf-offer-pill"
                          aria-pressed={isSel}
                          onClick={() => {
                            setContentKey(key);
                            setContentDraft(c);
                          }}
                        >
                          <span>{c.segment === "starter" ? "Starter" : "Trader"} ({c.locale.toUpperCase()})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hero & Intro */}
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: "10px 0 12px", color: "#1d2a24" }}>
                  Hero &amp; Introductions
                </h3>
                <div className="tf-admin-grid-2" style={{ marginBottom: 14 }}>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Eyebrow</label>
                    <input
                      className="tf-admin-input"
                      value={contentDraft.eyebrow}
                      onChange={(e) => setContentDraft({ ...contentDraft, eyebrow: e.target.value })}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Headline (H1)</label>
                    <input
                      className="tf-admin-input"
                      value={contentDraft.headline}
                      onChange={(e) => setContentDraft({ ...contentDraft, headline: e.target.value })}
                    />
                  </div>
                </div>

                <div className="tf-admin-field" style={{ marginBottom: 14 }}>
                  <label className="tf-admin-label">Intro Copy</label>
                  <textarea
                    rows={2}
                    className="tf-admin-textarea"
                    value={contentDraft.intro}
                    onChange={(e) => setContentDraft({ ...contentDraft, intro: e.target.value })}
                  />
                </div>

                <div className="tf-admin-grid-2" style={{ marginBottom: 14 }}>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Primary CTA Label</label>
                    <input
                      className="tf-admin-input"
                      value={contentDraft.primary_cta}
                      onChange={(e) => setContentDraft({ ...contentDraft, primary_cta: e.target.value })}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Secondary CTA Label</label>
                    <input
                      className="tf-admin-input"
                      value={contentDraft.secondary_cta}
                      onChange={(e) => setContentDraft({ ...contentDraft, secondary_cta: e.target.value })}
                    />
                  </div>
                </div>

                <div className="tf-admin-grid-2" style={{ marginBottom: 14 }}>
                  <BusinessMediaField key={`${contentDraft.segment}:${contentDraft.locale}`} label="Hero Image" value={contentDraft.hero_image_url} onChange={url => setContentDraft(current => current?.segment === contentDraft.segment && current?.locale === contentDraft.locale ? { ...current, hero_image_url: url } : current)} />
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Hero Image Alt Text</label>
                    <input
                      className="tf-admin-input"
                      value={contentDraft.hero_image_alt}
                      onChange={(e) => setContentDraft({ ...contentDraft, hero_image_alt: e.target.value })}
                    />
                  </div>
                </div>

                {/* Form & SEO */}
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: "20px 0 12px", color: "#1d2a24" }}>
                  Lead Intake Form &amp; SEO Metadata
                </h3>
                <div className="tf-admin-grid-2" style={{ marginBottom: 14 }}>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Form Heading</label>
                    <input
                      className="tf-admin-input"
                      value={contentDraft.form_heading}
                      onChange={(e) => setContentDraft({ ...contentDraft, form_heading: e.target.value })}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Form Subhead</label>
                    <input
                      className="tf-admin-input"
                      value={contentDraft.form_subhead}
                      onChange={(e) => setContentDraft({ ...contentDraft, form_subhead: e.target.value })}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">SEO Page Title</label>
                    <input
                      className="tf-admin-input"
                      value={contentDraft.seo_title}
                      onChange={(e) => setContentDraft({ ...contentDraft, seo_title: e.target.value })}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">SEO Meta Description</label>
                    <input
                      className="tf-admin-input"
                      value={contentDraft.seo_description}
                      onChange={(e) => setContentDraft({ ...contentDraft, seo_description: e.target.value })}
                    />
                  </div>
                </div>

                {/* Process Steps */}
                <div style={{ marginTop: 24, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "#1d2a24" }}>
                        Process Steps ({contentDraft.steps.length})
                      </h3>
                      <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#667069" }}>
                        Explain how commercial fulfillment and dispatch works for buyers.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setContentDraft({
                          ...contentDraft,
                          steps: [...contentDraft.steps, { title: "New step", body: "Step description" }],
                        })
                      }
                      className="tf-admin-btn tf-admin-btn--sm"
                    >
                      <Plus size={14} />
                      <span>Add Step</span>
                    </button>
                  </div>

                  {contentDraft.steps.map((step, idx) => (
                    <div key={idx} className="tf-item-row">
                      <div className="tf-item-header">
                        <span className="tf-item-num">Step {idx + 1}</span>
                        <button
                          type="button"
                          disabled={contentDraft.steps.length <= 1}
                          onClick={() =>
                            setContentDraft({
                              ...contentDraft,
                              steps: contentDraft.steps.filter((_, i) => i !== idx),
                            })
                          }
                          className="tf-admin-btn tf-admin-btn--sm tf-admin-btn--danger"
                          title="Remove step"
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      </div>
                      <div className="tf-admin-grid-2">
                        <div className="tf-admin-field">
                          <label className="tf-admin-label">Step Title</label>
                          <input
                            className="tf-admin-input"
                            value={step.title}
                            placeholder="Step Title"
                            onChange={(e) => {
                              const next = [...contentDraft.steps];
                              next[idx] = { ...step, title: e.target.value };
                              setContentDraft({ ...contentDraft, steps: next });
                            }}
                          />
                        </div>
                        <div className="tf-admin-field">
                          <label className="tf-admin-label">Step Description</label>
                          <input
                            className="tf-admin-input"
                            value={step.body}
                            placeholder="Step Description"
                            onChange={(e) => {
                              const next = [...contentDraft.steps];
                              next[idx] = { ...step, body: e.target.value };
                              setContentDraft({ ...contentDraft, steps: next });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Proof Gallery Items */}
                <div style={{ marginTop: 24, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "#1d2a24" }}>
                        Proof Gallery Items ({contentDraft.proof_items.length})
                      </h3>
                      <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#667069" }}>
                        Genuine origin proofs, batch tasting records, and warehouse dispatch images.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setContentDraft({
                          ...contentDraft,
                          proof_items: [
                            ...contentDraft.proof_items,
                            {
                              title: "New Proof Item",
                              caption: "Batch record verified at Siliguri hub",
                              imageUrl: "/images/orthodox-vs-ctc.webp",
                              alt: "Siliguri tea batch proof",
                              sourceOwner: "TeaFloww Commercial Ops",
                            },
                          ],
                        })
                      }
                      className="tf-admin-btn tf-admin-btn--sm"
                    >
                      <Plus size={14} />
                      <span>Add Proof Item</span>
                    </button>
                  </div>

                  {contentDraft.proof_items.map((item, idx) => (
                    <div key={idx} className="tf-item-row">
                      <div className="tf-item-header">
                        <span className="tf-item-num">Proof Item {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setContentDraft({
                              ...contentDraft,
                              proof_items: contentDraft.proof_items.filter((_, i) => i !== idx),
                            })
                          }
                          className="tf-admin-btn tf-admin-btn--sm tf-admin-btn--danger"
                          title="Remove proof"
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      </div>
                      <div className="tf-admin-grid-2" style={{ marginBottom: 10 }}>
                        <div className="tf-admin-field">
                          <label className="tf-admin-label">Proof Title</label>
                          <input
                            className="tf-admin-input"
                            value={item.title}
                            placeholder="Title"
                            onChange={(e) => {
                              const next = [...contentDraft.proof_items];
                              next[idx] = { ...item, title: e.target.value };
                              setContentDraft({ ...contentDraft, proof_items: next });
                            }}
                          />
                        </div>
                        <div className="tf-admin-field">
                          <label className="tf-admin-label">Caption</label>
                          <input
                            className="tf-admin-input"
                            value={item.caption}
                            placeholder="Caption"
                            onChange={(e) => {
                              const next = [...contentDraft.proof_items];
                              next[idx] = { ...item, caption: e.target.value };
                              setContentDraft({ ...contentDraft, proof_items: next });
                            }}
                          />
                        </div>
                      </div>
                      <div className="tf-admin-grid-2">
                        <BusinessMediaField key={`${contentDraft.segment}:${contentDraft.locale}:${idx}`} label={`Proof Image ${idx + 1}`} value={item.imageUrl} onChange={url => setContentDraft(current => current?.segment === contentDraft.segment && current?.locale === contentDraft.locale ? { ...current, proof_items: current.proof_items.map((proof, i) => i === idx ? { ...proof, imageUrl: url } : proof) } : current)} />
                        <div className="tf-admin-field">
                          <label className="tf-admin-label">Alt Text</label>
                          <input
                            className="tf-admin-input"
                            value={item.alt}
                            placeholder="Alt text"
                            onChange={(e) => {
                              const next = [...contentDraft.proof_items];
                              next[idx] = { ...item, alt: e.target.value };
                              setContentDraft({ ...contentDraft, proof_items: next });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* FAQ Items */}
                <div style={{ marginTop: 24, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "#1d2a24" }}>
                        FAQ Items ({contentDraft.faq.length})
                      </h3>
                      <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#667069" }}>
                        Frequently asked questions regarding MOQ, sample dispatches, and GST invoicing.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setContentDraft({
                          ...contentDraft,
                          faq: [...contentDraft.faq, { q: "New Question?", a: "Detailed answer." }],
                        })
                      }
                      className="tf-admin-btn tf-admin-btn--sm"
                    >
                      <Plus size={14} />
                      <span>Add FAQ</span>
                    </button>
                  </div>

                  {contentDraft.faq.map((faqItem, idx) => (
                    <div key={idx} className="tf-item-row">
                      <div className="tf-item-header">
                        <span className="tf-item-num">Q{idx + 1}</span>
                        <button
                          type="button"
                          disabled={contentDraft.faq.length <= 1}
                          onClick={() =>
                            setContentDraft({
                              ...contentDraft,
                              faq: contentDraft.faq.filter((_, i) => i !== idx),
                            })
                          }
                          className="tf-admin-btn tf-admin-btn--sm tf-admin-btn--danger"
                          title="Remove question"
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      </div>
                      <div className="tf-admin-field" style={{ marginBottom: 8 }}>
                        <label className="tf-admin-label">Question</label>
                        <input
                          className="tf-admin-input"
                          value={faqItem.q}
                          placeholder="Question"
                          onChange={(e) => {
                            const next = [...contentDraft.faq];
                            next[idx] = { ...faqItem, q: e.target.value };
                            setContentDraft({ ...contentDraft, faq: next });
                          }}
                        />
                      </div>
                      <div className="tf-admin-field">
                        <label className="tf-admin-label">Answer</label>
                        <textarea
                          rows={2}
                          className="tf-admin-textarea"
                          value={faqItem.a}
                          placeholder="Answer details"
                          onChange={(e) => {
                            const next = [...contentDraft.faq];
                            next[idx] = { ...faqItem, a: e.target.value };
                            setContentDraft({ ...contentDraft, faq: next });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e6e1d6" }}>
                  <button type="submit" disabled={saving} className="tf-admin-btn tf-admin-btn--primary">
                    {saving ? "Saving Content…" : "Save & Approve Content"}
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        )}

        {/* TAB 4: APPROVED CLAIMS */}
        {!loading && data && (
          <section
            id="tf-admin-panel-claims"
            role="tabpanel"
            aria-labelledby="tf-admin-tab-claims"
            hidden={tab !== "claims"}
          >
            {claimDraft ? (
              <form onSubmit={saveClaim} className="tf-admin-card">
                <div className="tf-admin-card-header">
                  <div>
                    <h2 className="tf-admin-card-title">Commercial Sourcing &amp; Quality Claims</h2>
                    <p className="tf-admin-card-desc">
                      Pre-approved claims with verifiable evidence sources and explicit authorized marketing channels.
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <select
                      className="tf-admin-select"
                      style={{ width: "auto" }}
                      value={isNewClaim ? "__new__" : selectedClaimKey}
                      onChange={(e) => {
                        const key = e.target.value;
                        if (key === "__new__") return;
                        setIsNewClaim(false);
                        setSelectedClaimKey(key);
                        const found = data.claims.find((c) => c.claim_key === key);
                        if (found) setClaimDraft(found);
                      }}
                    >
                      {data.claims.map((c) => (
                        <option key={c.claim_key} value={c.claim_key}>
                          {c.claim_key} {c.active ? "✓" : "(inactive)"}
                        </option>
                      ))}
                      {isNewClaim ? <option value="__new__">(New Claim)</option> : null}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setIsNewClaim(true);
                        setClaimDraft({
                          claim_key: "",
                          exact_copy_en: "",
                          exact_copy_hi: "",
                          evidence_source: "",
                          evidence_owner: "",
                          allowed_channels: ["web", "sales"],
                          active: true,
                          approved_at: null,
                          valid_until: null,
                          updated_at: new Date().toISOString(),
                        });
                      }}
                      className="tf-admin-btn"
                    >
                      <Plus size={14} />
                      <span>New Claim</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 16 }}>
                  {isNewClaim ? (
                    <div className="tf-admin-field">
                      <label className="tf-admin-label">Claim Identifier Key (lowercase snake_case)</label>
                      <input
                        className="tf-admin-input"
                        placeholder="e.g. direct_auction_sourcing"
                        value={claimDraft.claim_key}
                        onChange={(e) => setClaimDraft({ ...claimDraft, claim_key: e.target.value })}
                      />
                    </div>
                  ) : null}

                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Exact Copy (English)</label>
                    <textarea
                      rows={2}
                      className="tf-admin-textarea"
                      value={claimDraft.exact_copy_en}
                      onChange={(e) => setClaimDraft({ ...claimDraft, exact_copy_en: e.target.value })}
                    />
                  </div>

                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Exact Copy (Hindi)</label>
                    <textarea
                      rows={2}
                      className="tf-admin-textarea"
                      value={claimDraft.exact_copy_hi}
                      onChange={(e) => setClaimDraft({ ...claimDraft, exact_copy_hi: e.target.value })}
                    />
                  </div>

                  <div className="tf-admin-grid-3">
                    <div className="tf-admin-field">
                      <label className="tf-admin-label">Evidence Source Document / URL</label>
                      <input
                        className="tf-admin-input"
                        placeholder="e.g. Tea Board Invoice TB-2026-99"
                        value={claimDraft.evidence_source}
                        onChange={(e) => setClaimDraft({ ...claimDraft, evidence_source: e.target.value })}
                      />
                    </div>
                    <div className="tf-admin-field">
                      <label className="tf-admin-label">Evidence Owner (Responsible Role)</label>
                      <input
                        className="tf-admin-input"
                        placeholder="e.g. TeaFloww Quality Team"
                        value={claimDraft.evidence_owner}
                        onChange={(e) => setClaimDraft({ ...claimDraft, evidence_owner: e.target.value })}
                      />
                    </div>
                    <div className="tf-admin-field">
                      <label className="tf-admin-label">Valid Until (ISO date or blank for indefinite)</label>
                      <input
                        className="tf-admin-input"
                        placeholder="2027-12-31T23:59:59Z"
                        value={claimDraft.valid_until ?? ""}
                        onChange={(e) =>
                          setClaimDraft({ ...claimDraft, valid_until: e.target.value || null })
                        }
                      />
                    </div>
                  </div>

                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Authorized Distribution Channels</label>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {(["web", "meta", "google", "sales"] as const).map((ch) => {
                        const checked = claimDraft.allowed_channels.includes(ch);
                        return (
                          <label key={ch} className="tf-admin-toggle-card" style={{ padding: "8px 14px" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? Array.from(new Set([...claimDraft.allowed_channels, ch]))
                                  : claimDraft.allowed_channels.filter((x) => x !== ch);
                                if (next.length > 0) setClaimDraft({ ...claimDraft, allowed_channels: next });
                              }}
                              style={{ width: 16, height: 16, accentColor: "#1d2a24" }}
                            />
                            <span style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>{ch}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="tf-admin-toggle-card" style={{ maxWidth: 320 }}>
                      <input
                        type="checkbox"
                        className="tf-admin-toggle-input"
                        checked={claimDraft.active}
                        onChange={(e) => setClaimDraft({ ...claimDraft, active: e.target.checked })}
                      />
                      <span className="tf-admin-toggle-switch" aria-hidden="true" />
                      <span className="tf-admin-toggle-label">
                        <span className="tf-admin-toggle-title">Claim Active</span>
                        <span className="tf-admin-toggle-subtitle">Eligible for public rendering</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e6e1d6" }}>
                  <button type="submit" disabled={saving} className="tf-admin-btn tf-admin-btn--primary">
                    {saving ? "Saving Claim…" : "Save & Approve Claim"}
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        )}

        {/* TAB 5: LEADS & QUOTES (CRM) */}
        {!loading && data && (
          <section
            id="tf-admin-panel-leads"
            role="tabpanel"
            aria-labelledby="tf-admin-tab-leads"
            hidden={tab !== "leads"}
          >
            <div className="tf-admin-card">
              <div className="tf-admin-card-header">
                <div>
                  <h2 className="tf-admin-card-title">Commercial Lead CRM &amp; Pipeline</h2>
                  <p className="tf-admin-card-desc">
                    Inbound business inquiries, lifecycle state transitions, customer details, and quote creation.
                  </p>
                </div>
              </div>

              {/* Filter Toolbar */}
              <div className="tf-admin-toolbar">
                <div className="tf-admin-toolbar-group">
                  {/* Search Input */}
                  <div className="tf-admin-search-wrap">
                    <Search size={16} className="tf-admin-search-icon" />
                    <input
                      type="search"
                      className="tf-admin-input tf-admin-search-input"
                      placeholder="Search ref, buyer, phone, company, pin…"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                    />
                  </div>

                  {/* Segment Filter */}
                  <select
                    className="tf-admin-select"
                    style={{ width: "auto" }}
                    value={leadSegmentFilter}
                    onChange={(e) => setLeadSegmentFilter(e.target.value)}
                  >
                    <option value="">All Segments</option>
                    <option value="starter">Starter (/start-tea-business)</option>
                    <option value="trader">Trader (/tea-traders)</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    className="tf-admin-select"
                    style={{ width: "auto" }}
                    value={leadStatusFilter}
                    onChange={(e) => setLeadStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses ({data.leads.length})</option>
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")} ({data.leads.filter((l) => l.status === s).length})
                      </option>
                    ))}
                  </select>

                  {leadSearch || leadStatusFilter || leadSegmentFilter ? (
                    <button
                      type="button"
                      className="tf-admin-btn tf-admin-btn--sm"
                      onClick={() => {
                        setLeadSearch("");
                        setLeadStatusFilter("");
                        setLeadSegmentFilter("");
                      }}
                    >
                      Clear Filters
                    </button>
                  ) : null}
                </div>

                <div style={{ fontSize: 13, color: "#646d67", fontWeight: 600 }}>
                  Showing {filteredLeads.length} of {data.leads.length} leads
                </div>
              </div>

              {/* Responsive Data Table (Modern Web Guidance) */}
              {filteredLeads.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px", color: "#646d67" }}>
                  <Filter size={24} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No B2B leads match this search or filter.</p>
                </div>
              ) : (
                <div
                  tabIndex={0}
                  role="region"
                  aria-labelledby="tf-leads-caption"
                  className="tf-admin-table-wrap"
                >
                  <table className="tf-admin-table">
                    <caption id="tf-leads-caption">Commercial Inbound Leads and Pipeline</caption>
                    <thead>
                      <tr>
                        <th scope="col">Reference</th>
                        <th scope="col">Segment / Interest</th>
                        <th scope="col">Buyer Contact</th>
                        <th scope="col">Volume &amp; Pin</th>
                        <th scope="col">Attribution</th>
                        <th scope="col">Status</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id}>
                          <th scope="row">
                            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{lead.reference}</span>
                          </th>
                          <td data-label="Segment / Interest">
                            <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{lead.segment}</div>
                            <div style={{ color: "#667069", fontSize: 12 }}>{lead.interest.replace(/_/g, " ")}</div>
                          </td>
                          <td data-label="Buyer Contact">
                            <div style={{ fontWeight: 700 }}>{lead.name}</div>
                            <div style={{ color: "#555", fontSize: 12 }}>
                              <a href={`tel:${lead.phone}`} style={{ color: "inherit", textDecoration: "none" }}>
                                {lead.phone}
                              </a>
                            </div>
                            {lead.company ? (
                              <div style={{ color: "#8b5e3c", fontSize: 11.5, fontWeight: 600 }}>{lead.company}</div>
                            ) : null}
                          </td>
                          <td data-label="Volume & Pin">
                            <div style={{ fontWeight: 700 }}>{lead.quantity_band} kg</div>
                            <div style={{ color: "#667069", fontSize: 12 }}>PIN: {lead.pincode}</div>
                          </td>
                          <td data-label="Attribution">
                            <div style={{ fontSize: 12, fontWeight: 600 }}>
                              {lead.utm_campaign || lead.utm_source || "direct"}
                            </div>
                            <div style={{ fontSize: 11, color: "#8c948f" }}>
                              {lead.utm_source ? `via ${lead.utm_source}` : "organic / direct"}
                            </div>
                          </td>
                          <td data-label="Status">
                            <span className={`tf-badge tf-badge--${lead.status}`}>
                              {lead.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td data-label="Actions">
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {/* New -> Contact Attempted */}
                              {lead.status === "new" ? (
                                <button
                                  type="button"
                                  onClick={() => transitionLead(lead.id, "contact_attempted")}
                                  className="tf-admin-btn tf-admin-btn--sm"
                                  title="Mark contacted"
                                >
                                  <Phone size={12} />
                                  <span>Contacted</span>
                                </button>
                              ) : null}

                              {/* Contact Attempted -> Qualify / Disqualify */}
                              {lead.status === "contact_attempted" ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => transitionLead(lead.id, "qualified")}
                                    className="tf-admin-btn tf-admin-btn--sm tf-admin-btn--primary"
                                    title="Qualify lead"
                                  >
                                    <Check size={12} />
                                    <span>Qualify</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      transitionLead(lead.id, "disqualified", {
                                        qualification_reason: DISQUALIFICATION_REASONS[0],
                                      })
                                    }
                                    className="tf-admin-btn tf-admin-btn--sm tf-admin-btn--danger"
                                    title="Disqualify lead"
                                  >
                                    <X size={12} />
                                    <span>Disqualify</span>
                                  </button>
                                </>
                              ) : null}

                              {/* Qualified / Quote Sent -> Create Quote */}
                              {lead.status === "qualified" || lead.status === "quote_sent" ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuoteModal(lead)}
                                  className="tf-admin-btn tf-admin-btn--sm tf-admin-btn--primary"
                                  title="Draft commercial quote"
                                >
                                  <FileText size={12} />
                                  <span>Quote</span>
                                </button>
                              ) : null}

                              {/* Quote Sent -> Mark Won */}
                              {lead.status === "quote_sent" ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenWonModal(lead)}
                                  className="tf-admin-btn tf-admin-btn--sm tf-admin-btn--primary"
                                  title="Mark order paid and won"
                                >
                                  <CheckCircle2 size={12} />
                                  <span>Mark Won</span>
                                </button>
                              ) : null}

                              {/* Qualified / Quote Sent -> Mark Lost */}
                              {lead.status === "qualified" || lead.status === "quote_sent" ? (
                                <button
                                  type="button"
                                  onClick={() => void transitionLead(lead.id, "lost")}
                                  className="tf-admin-btn tf-admin-btn--sm tf-admin-btn--danger"
                                  title="Mark opportunity lost"
                                >
                                  <span>Lost</span>
                                </button>
                              ) : null}

                              {/* Details button always available */}
                              <button
                                type="button"
                                onClick={() => void openLeadDetail(lead.id)}
                                className="tf-admin-btn tf-admin-btn--sm"
                                title="View full history and quotes"
                              >
                                <Eye size={12} />
                                <span>Details</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 6: CRM OUTBOX */}
        {!loading && data && (
          <section
            id="tf-admin-panel-outbox"
            role="tabpanel"
            aria-labelledby="tf-admin-tab-outbox"
            hidden={tab !== "outbox"}
          >
            <div className="tf-admin-card">
              <div className="tf-admin-card-header">
                <div>
                  <h2 className="tf-admin-card-title">Integration Outbox &amp; Webhook Events</h2>
                  <p className="tf-admin-card-desc">
                    Asynchronous event queue delivering lead lifecycle and quote events to external CRM integrations.
                  </p>
                </div>
              </div>

              {data.outbox.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px", color: "#646d67" }}>
                  <CheckCircle2 size={24} style={{ margin: "0 auto 8px", color: "#2f6f4e" }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>Outbox queue is empty. All CRM events delivered.</p>
                </div>
              ) : (
                <div
                  tabIndex={0}
                  role="region"
                  aria-labelledby="tf-outbox-caption"
                  className="tf-admin-table-wrap"
                >
                  <table className="tf-admin-table">
                    <caption id="tf-outbox-caption">CRM Integration Outbox Delivery Queue</caption>
                    <thead>
                      <tr>
                        <th scope="col">Topic</th>
                        <th scope="col">Aggregate ID</th>
                        <th scope="col">Status</th>
                        <th scope="col">Attempts</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.outbox.map((item) => (
                        <tr key={item.id}>
                          <th scope="row">
                            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{item.topic}</span>
                          </th>
                          <td data-label="Aggregate ID">{item.aggregate_id}</td>
                          <td data-label="Status">
                            <span className={`tf-badge tf-badge--${item.status}`}>
                              {item.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td data-label="Attempts">{item.attempt}</td>
                          <td data-label="Action">
                            {item.status !== "done" ? (
                              <button
                                type="button"
                                onClick={() => retryOutbox(item.id)}
                                disabled={saving}
                                className="tf-admin-btn tf-admin-btn--sm"
                              >
                                <RefreshCw size={12} className={saving ? "animate-spin" : ""} />
                                <span>Retry Dispatch</span>
                              </button>
                            ) : (
                              <span style={{ color: "#2f6f4e", fontSize: 12, fontWeight: 700 }}>Delivered</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* DIALOG 1: LEAD DETAILS MODAL (Native <dialog> with Modern Web Guidance) */}
        <dialog
          ref={leadDetailDialogRef}
          id="lead-details-dialog"
          className="tf-admin-dialog"
          aria-labelledby="lead-details-title"
          onClick={handleDialogBackdropClick}
        >
          {selectedLeadDetail ? (
            <div>
              <div className="tf-dialog-header">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h3 id="lead-details-title" className="tf-dialog-title">
                      {selectedLeadDetail.lead.reference} — {selectedLeadDetail.lead.name}
                    </h3>
                    <span className={`tf-badge tf-badge--${selectedLeadDetail.lead.status}`}>
                      {selectedLeadDetail.lead.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#646d67", marginTop: 2 }}>
                    Captured: {selectedLeadDetail.lead.created_at.slice(0, 16).replace("T", " ")}
                  </div>
                </div>
                <button
                  type="button"
                  className="tf-dialog-close"
                  onClick={() => leadDetailDialogRef.current?.close()}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="tf-dialog-body">
                <div className="tf-lead-profile-grid">
                  {/* Left Column: Buyer Profile */}
                  <div>
                    <div className="tf-detail-card" style={{ marginBottom: 16 }}>
                      <div className="tf-detail-card-title">
                        <Building2 size={14} />
                        <span>Buyer Profile</span>
                      </div>
                      <div className="tf-prop-row">
                        <span className="tf-prop-label">Full Name</span>
                        <span className="tf-prop-val">{selectedLeadDetail.lead.name}</span>
                      </div>
                      <div className="tf-prop-row">
                        <span className="tf-prop-label">Phone</span>
                        <span className="tf-prop-val">
                          <a href={`tel:${selectedLeadDetail.lead.phone}`} style={{ color: "#1d2a24" }}>
                            {selectedLeadDetail.lead.phone}
                          </a>
                        </span>
                      </div>
                      <div className="tf-prop-row">
                        <span className="tf-prop-label">Company</span>
                        <span className="tf-prop-val">{selectedLeadDetail.lead.company || "—"}</span>
                      </div>
                      <div className="tf-prop-row">
                        <span className="tf-prop-label">Pincode</span>
                        <span className="tf-prop-val">{selectedLeadDetail.lead.pincode}</span>
                      </div>
                      <div className="tf-prop-row">
                        <span className="tf-prop-label">Segment</span>
                        <span className="tf-prop-val" style={{ textTransform: "capitalize" }}>
                          {selectedLeadDetail.lead.segment}
                        </span>
                      </div>
                      <div className="tf-prop-row">
                        <span className="tf-prop-label">Interest</span>
                        <span className="tf-prop-val">
                          {selectedLeadDetail.lead.interest.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="tf-prop-row">
                        <span className="tf-prop-label">Est. Quantity</span>
                        <span className="tf-prop-val">{selectedLeadDetail.lead.quantity_band} kg</span>
                      </div>
                      <div className="tf-prop-row">
                        <span className="tf-prop-label">Attribution</span>
                        <span className="tf-prop-val">
                          {selectedLeadDetail.lead.utm_source || "direct"} /{" "}
                          {selectedLeadDetail.lead.utm_campaign || "organic"}
                        </span>
                      </div>

                      {/* Direct WhatsApp Action Link */}
                      <div style={{ marginTop: 14 }}>
                        <a
                          href={`https://wa.me/91${selectedLeadDetail.lead.phone}?text=${encodeURIComponent(
                            `Hello ${selectedLeadDetail.lead.name}, regarding your tea business inquiry ${selectedLeadDetail.lead.reference} on TeaFloww...`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="tf-admin-btn tf-admin-btn--sm tf-admin-btn--primary"
                          style={{ width: "100%" }}
                        >
                          <Send size={12} />
                          <span>Message Buyer on WhatsApp</span>
                        </a>
                      </div>
                    </div>

                    {selectedLeadDetail.lead.note ? (
                      <div className="tf-detail-card">
                        <div className="tf-detail-card-title">
                          <FileText size={14} />
                          <span>Buyer Requirements Note</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: "#313b35", lineHeight: 1.5 }}>
                          {selectedLeadDetail.lead.note}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* Right Column: Quotes & Audit Events */}
                  <div>
                    {/* Quotes History */}
                    <div className="tf-detail-card" style={{ marginBottom: 16 }}>
                      <div className="tf-detail-card-title">
                        <DollarSign size={14} />
                        <span>Commercial Quotes ({selectedLeadDetail.quotes.length})</span>
                      </div>
                      {selectedLeadDetail.quotes.length === 0 ? (
                        <p style={{ margin: 0, fontSize: 13, color: "#646d67" }}>No quotes drafted yet.</p>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {selectedLeadDetail.quotes.map((q) => (
                            <div
                              key={q.id}
                              style={{
                                padding: "10px 12px",
                                borderRadius: 8,
                                background: "#ffffff",
                                border: "1px solid #e2ddd2",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontWeight: 800, fontFamily: "monospace", fontSize: 13 }}>
                                  {q.quote_number} (v{q.version})
                                </span>
                                <span className={`tf-badge tf-badge--${q.status}`}>{q.status}</span>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: "#1d2a24", margin: "4px 0" }}>
                                ₹{(q.total_paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </div>
                              <div style={{ fontSize: 11.5, color: "#667069" }}>{q.freight_terms}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Audit Trail */}
                    <div className="tf-detail-card">
                      <div className="tf-detail-card-title">
                        <Clock size={14} />
                        <span>Audit Timeline ({selectedLeadDetail.events.length})</span>
                      </div>
                      <ul className="tf-timeline">
                        {selectedLeadDetail.events.map((ev) => (
                          <li key={ev.id} className="tf-timeline-item">
                            <div className="tf-timeline-title">{ev.type.replace(/_/g, " ")}</div>
                            <div className="tf-timeline-meta">
                              by {ev.actor_id || "system"} · {ev.event_time.slice(0, 16).replace("T", " ")}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="tf-dialog-footer">
                <button
                  type="button"
                  className="tf-admin-btn"
                  onClick={() => leadDetailDialogRef.current?.close()}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="tf-admin-btn tf-admin-btn--primary"
                  onClick={() => {
                    leadDetailDialogRef.current?.close();
                    handleOpenQuoteModal(selectedLeadDetail.lead);
                  }}
                >
                  <FileText size={14} />
                  <span>Create Quote</span>
                </button>
              </div>
            </div>
          ) : null}
        </dialog>

        {/* DIALOG 2: CREATE COMMERCIAL QUOTE MODAL */}
        <dialog
          ref={quoteDialogRef}
          id="quote-modal-dialog"
          className="tf-admin-dialog"
          aria-labelledby="quote-modal-title"
          onClick={handleDialogBackdropClick}
        >
          {quoteLead ? (
            <form onSubmit={submitQuote}>
              <div className="tf-dialog-header">
                <div>
                  <h3 id="quote-modal-title" className="tf-dialog-title">
                    Commercial Quote for {quoteLead.reference}
                  </h3>
                  <div style={{ fontSize: 12.5, color: "#646d67", marginTop: 2 }}>
                    Buyer: {quoteLead.name} ({quoteLead.phone}) · PIN: {quoteLead.pincode}
                  </div>
                </div>
                <button
                  type="button"
                  className="tf-dialog-close"
                  onClick={() => quoteDialogRef.current?.close()}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="tf-dialog-body">
                <div className="tf-admin-grid-2" style={{ marginBottom: 14 }}>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Line Item Description</label>
                    <input
                      className="tf-admin-input"
                      value={quoteDesc}
                      onChange={(e) => setQuoteDesc(e.target.value)}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Pack Format</label>
                    <input
                      className="tf-admin-input"
                      placeholder="e.g. 25kg bulk sack"
                      value={quoteFormat}
                      onChange={(e) => setQuoteFormat(e.target.value)}
                    />
                  </div>
                </div>

                <div className="tf-admin-grid-3" style={{ marginBottom: 14 }}>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Quantity Label</label>
                    <input
                      className="tf-admin-input"
                      value={quoteQtyLabel}
                      onChange={(e) => setQuoteQtyLabel(e.target.value)}
                    />
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Goods Subtotal (Paise)</label>
                    <input
                      className="tf-admin-input"
                      value={quoteUnitPaise}
                      onChange={(e) => setQuoteUnitPaise(e.target.value)}
                    />
                    <span className="tf-admin-help">
                      = ₹{(Number(quoteUnitPaise || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Freight (Paise)</label>
                    <input
                      className="tf-admin-input"
                      value={quoteFreightPaise}
                      onChange={(e) => setQuoteFreightPaise(e.target.value)}
                    />
                    <span className="tf-admin-help">
                      = ₹{(Number(quoteFreightPaise || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="tf-admin-grid-2" style={{ marginBottom: 14 }}>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Applicable Tax (Paise)</label>
                    <input
                      className="tf-admin-input"
                      value={quoteTaxPaise}
                      onChange={(e) => setQuoteTaxPaise(e.target.value)}
                    />
                    <span className="tf-admin-help">
                      = ₹{(Number(quoteTaxPaise || 0) / 100).toFixed(2)} (GST 5%)
                    </span>
                  </div>
                  <div className="tf-admin-field">
                    <label className="tf-admin-label">Freight &amp; Delivery Terms</label>
                    <input
                      className="tf-admin-input"
                      value={quoteFreightTerms}
                      onChange={(e) => setQuoteFreightTerms(e.target.value)}
                    />
                  </div>
                </div>

                {/* Live Grand Total Price Calculation Box */}
                <div className="tf-quote-preview-box">
                  <div className="tf-quote-calc-row">
                    <span>Goods Subtotal:</span>
                    <span>₹{(Number(quoteUnitPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="tf-quote-calc-row">
                    <span>Logistics / Surface Freight:</span>
                    <span>₹{(Number(quoteFreightPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="tf-quote-calc-row">
                    <span>GST &amp; Statutory Taxes:</span>
                    <span>₹{(Number(quoteTaxPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="tf-quote-calc-row tf-quote-calc-total">
                    <span>Grand Commercial Total:</span>
                    <span>₹{(grandTotalPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="tf-dialog-footer">
                <button
                  type="button"
                  className="tf-admin-btn"
                  onClick={() => quoteDialogRef.current?.close()}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="tf-admin-btn tf-admin-btn--primary"
                >
                  {saving ? "Generating Quote…" : "Save & Mark Quote Sent"}
                </button>
              </div>
            </form>
          ) : null}
        </dialog>

        {/* DIALOG 3: MARK WON MODAL (Replaces legacy window.prompt) */}
        <dialog
          ref={markWonDialogRef}
          id="mark-won-dialog"
          className="tf-admin-dialog tf-admin-dialog--sm"
          aria-labelledby="mark-won-title"
          onClick={handleDialogBackdropClick}
        >
          {wonLead ? (
            <form onSubmit={handleConfirmWon}>
              <div className="tf-dialog-header">
                <div>
                  <h3 id="mark-won-title" className="tf-dialog-title">
                    Mark Opportunity as Won
                  </h3>
                  <div style={{ fontSize: 12.5, color: "#646d67", marginTop: 2 }}>
                    Lead: {wonLead.reference} ({wonLead.name})
                  </div>
                </div>
                <button
                  type="button"
                  className="tf-dialog-close"
                  onClick={() => markWonDialogRef.current?.close()}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="tf-dialog-body">
                <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "#313b35", lineHeight: 1.5 }}>
                  Enter the verified paid Order ID or Tax Invoice Number to finalize this commercial opportunity and record first-order attribution.
                </p>
                <div className="tf-admin-field">
                  <label className="tf-admin-label">Verified Order ID</label>
                  <input
                    required
                    autoFocus
                    className="tf-admin-input"
                    placeholder="e.g. TF-ORD-202611-987"
                    value={wonOrderId}
                    onChange={(e) => setWonOrderId(e.target.value)}
                  />
                  <span className="tf-admin-help">Must match verified gateway transaction or accounting ledger ID.</span>
                </div>
              </div>

              <div className="tf-dialog-footer">
                <button
                  type="button"
                  className="tf-admin-btn"
                  onClick={() => markWonDialogRef.current?.close()}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!wonOrderId.trim() || saving}
                  className="tf-admin-btn tf-admin-btn--primary"
                >
                  {saving ? "Updating…" : "Confirm Won Status"}
                </button>
              </div>
            </form>
          ) : null}
        </dialog>
      </div>
    </>
  );
}
