"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/layout/AdminShell";
import {
  DISQUALIFICATION_REASONS,
  LEAD_STATUSES,
  type BusinessLeadStatus,
  type BusinessLocale,
  type OfferCode,
  type Segment,
} from "@/lib/business/schema";
import type {
  B2BClaimRecord,
  B2BLeadRecord,
  B2BOfferRecord,
  B2BOutboxRecord,
  B2BPageContentRecord,
  B2BSettings,
} from "@/lib/business/repository";

type TabId = "overview" | "offers" | "content" | "claims" | "leads" | "outbox";

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
  const [tab, setTab] = useState<TabId>("overview");
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

  // Lead filter, detail & quote modal state
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("");
  const [selectedLeadDetail, setSelectedLeadDetail] = useState<{
    lead: B2BLeadRecord;
    events: Array<{ id: string; type: string; actor_id: string | null; event_time: string; metadata: Record<string, unknown> | null }>;
    quotes: Array<{ id: string; quote_number: string; version: number; total_paise: number; status: string; freight_terms: string; created_at: string }>;
  } | null>(null);
  const [quoteLead, setQuoteLead] = useState<B2BLeadRecord | null>(null);
  const [quoteDesc, setQuoteDesc] = useState("Assam CTC Bulk 25kg Sack");
  const [quoteFormat, setQuoteFormat] = useState("25kg sack");
  const [quoteQtyLabel, setQuoteQtyLabel] = useState("100 kg");
  const [quoteUnitPaise, setQuoteUnitPaise] = useState("28000");
  const [quoteFreightPaise, setQuoteFreightPaise] = useState("180000");
  const [quoteTaxPaise, setQuoteTaxPaise] = useState("140000");
  const [quoteFreightTerms, setQuoteFreightTerms] = useState("Surface transport to destination pincode, subject to final dispatch confirmation.");

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
      setStatusMsg({ kind: "ok", text: "B2B settings updated." });
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
      setStatusMsg({ kind: "ok", text: `Offer '${offerDraft.code}' saved.` });
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
        text: `Page content '${contentDraft.segment}:${contentDraft.locale}' saved.`,
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
      setStatusMsg({ kind: "ok", text: `Claim '${claimDraft.claim_key}' saved.` });
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
      setStatusMsg({ kind: "ok", text: `Lead updated to '${status}'.` });
      await loadData();
    } catch (err) {
      setStatusMsg({ kind: "err", text: err instanceof Error ? err.message : "Transition failed." });
    } finally {
      setSaving(false);
    }
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
        text: `Quote ${json.quote?.quote_number ?? ""} created for ${quoteLead.reference}.`,
      });
      setQuoteLead(null);
      await loadData();
    } catch (err) {
      setStatusMsg({ kind: "err", text: err instanceof Error ? err.message : "Quote failed." });
    } finally {
      setSaving(false);
    }
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
      setStatusMsg({ kind: "ok", text: "Outbox item requeued." });
      await loadData();
    } catch (err) {
      setStatusMsg({ kind: "err", text: err instanceof Error ? err.message : "Retry failed." });
    } finally {
      setSaving(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #d9d4c8",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #c9c2b6",
    fontSize: 14,
  };

  const filteredLeads =
    data?.leads.filter((l) => (!leadStatusFilter ? true : l.status === leadStatusFilter)) ?? [];

  return (
    <AdminShell>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: "#1d2a24" }}>
              B2B Acquisition &amp; Lead CRM
            </h1>
            <p style={{ margin: "4px 0 0", color: "#5c645e", fontSize: 14 }}>
              Manage <code>/start-tea-business</code> and <code>/tea-traders</code> content, offers, claims, leads &amp; quotes.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/start-tea-business" target="_blank" rel="noreferrer" className="button button-outline" style={{ textDecoration: "none", padding: "8px 14px" }}>
              View Starter Page ↗
            </a>
            <a href="/tea-traders" target="_blank" rel="noreferrer" className="button button-outline" style={{ textDecoration: "none", padding: "8px 14px" }}>
              View Trader Page ↗
            </a>
          </div>
        </div>

        {statusMsg ? (
          <div
            role="status"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              marginBottom: 16,
              background: statusMsg.kind === "ok" ? "#e6f2ec" : "#fdecea",
              color: statusMsg.kind === "ok" ? "#1d4e38" : "#8f2f2a",
              border: `1px solid ${statusMsg.kind === "ok" ? "#9ccbb2" : "#e5a6a1"}`,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {statusMsg.text}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {(
            [
              ["overview", "Overview & Settings"],
              ["offers", "Offers (3 Formats)"],
              ["content", "Page Content (EN/HI)"],
              ["claims", "Approved Claims"],
              ["leads", `Leads & Quotes (${data?.funnelSummary.totalLeads ?? 0})`],
              ["outbox", `CRM Outbox (${data?.funnelSummary.pendingOutbox ?? 0})`],
            ] as Array<[TabId, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                padding: "9px 15px",
                borderRadius: 8,
                border: "1px solid #c9c2b6",
                background: tab === id ? "#1d2a24" : "#fff",
                color: tab === id ? "#fff" : "#1d2a24",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading || !data ? (
          <div style={cardStyle}>Loading B2B Acquisition workspace…</div>
        ) : null}

        {!loading && data && tab === "overview" && settingsDraft ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
              <div style={cardStyle}>
                <div style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>TOTAL B2B LEADS</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1d2a24" }}>{data.funnelSummary.totalLeads}</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>STARTER / TRADER</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1d2a24" }}>
                  {data.funnelSummary.bySegment.starter ?? 0} / {data.funnelSummary.bySegment.trader ?? 0}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>QUALIFIED / WON</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1d2a24" }}>
                  {data.funnelSummary.byStatus.qualified ?? 0} / {data.funnelSummary.byStatus.won ?? 0}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>OUTBOX PENDING</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1d2a24" }}>{data.funnelSummary.pendingOutbox}</div>
              </div>
            </div>

            <form onSubmit={saveSettings} style={cardStyle}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Channel &amp; Feature Controls</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={settingsDraft.business_landing_enabled}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, business_landing_enabled: e.target.checked })
                    }
                  />
                  Landing pages enabled (/start-tea-business &amp; /tea-traders)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={settingsDraft.leads_enabled}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, leads_enabled: e.target.checked })}
                  />
                  Lead intake form enabled (POST /api/business-leads)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={settingsDraft.whatsapp_enabled}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, whatsapp_enabled: e.target.checked })
                    }
                  />
                  Show verified WhatsApp CTA
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={settingsDraft.crm_webhook_enabled}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, crm_webhook_enabled: e.target.checked })
                    }
                  />
                  CRM webhook forwarding enabled
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 16 }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    Verified WhatsApp E.164 (digits only)
                  </label>
                  <input
                    style={inputStyle}
                    value={settingsDraft.whatsapp_e164 ?? ""}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, whatsapp_e164: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    Support Hours
                  </label>
                  <input
                    style={inputStyle}
                    value={settingsDraft.support_hours}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, support_hours: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    Starter Hero Image URL
                  </label>
                  <input
                    style={inputStyle}
                    value={settingsDraft.starter_hero_image_url}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, starter_hero_image_url: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    Trader Hero Image URL
                  </label>
                  <input
                    style={inputStyle}
                    value={settingsDraft.trader_hero_image_url}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, trader_hero_image_url: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    Proof Image 1 URL
                  </label>
                  <input
                    style={inputStyle}
                    value={settingsDraft.proof_image_1_url}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, proof_image_1_url: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    Proof Image 2 URL
                  </label>
                  <input
                    style={inputStyle}
                    value={settingsDraft.proof_image_2_url}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, proof_image_2_url: e.target.value })
                    }
                  />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <button type="submit" disabled={saving} className="button button-primary" style={{ padding: "10px 20px" }}>
                  {saving ? "Saving…" : "Save Settings"}
                </button>
              </div>
            </form>
          </>
        ) : null}

        {!loading && data && tab === "offers" && offerDraft ? (
          <form onSubmit={(e) => saveOffer(e)} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Edit Commercial Offer</h2>
              <select
                style={{ ...inputStyle, width: "auto" }}
                value={selectedOfferCode}
                onChange={(e) => {
                  const code = e.target.value as OfferCode;
                  setSelectedOfferCode(code);
                  const found = data.offers.find((o) => o.code === code);
                  if (found) setOfferDraft(found);
                }}
              >
                {data.offers.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.code} — {o.title_en}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Eyebrow (EN)</label>
                <input style={inputStyle} value={offerDraft.eyebrow_en} onChange={(e) => setOfferDraft({ ...offerDraft, eyebrow_en: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Eyebrow (HI)</label>
                <input style={inputStyle} value={offerDraft.eyebrow_hi} onChange={(e) => setOfferDraft({ ...offerDraft, eyebrow_hi: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Title (EN)</label>
                <input style={inputStyle} value={offerDraft.title_en} onChange={(e) => setOfferDraft({ ...offerDraft, title_en: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Title (HI)</label>
                <input style={inputStyle} value={offerDraft.title_hi} onChange={(e) => setOfferDraft({ ...offerDraft, title_hi: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Description (EN)</label>
                <textarea rows={3} style={inputStyle} value={offerDraft.description_en} onChange={(e) => setOfferDraft({ ...offerDraft, description_en: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Description (HI)</label>
                <textarea rows={3} style={inputStyle} value={offerDraft.description_hi} onChange={(e) => setOfferDraft({ ...offerDraft, description_hi: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>CTA Label (EN)</label>
                <input style={inputStyle} value={offerDraft.cta_label_en} onChange={(e) => setOfferDraft({ ...offerDraft, cta_label_en: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>CTA Label (HI)</label>
                <input style={inputStyle} value={offerDraft.cta_label_hi} onChange={(e) => setOfferDraft({ ...offerDraft, cta_label_hi: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>MOQ Disclosure (EN)</label>
                <input style={inputStyle} value={offerDraft.moq_text_en ?? ""} onChange={(e) => setOfferDraft({ ...offerDraft, moq_text_en: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>MOQ Disclosure (HI)</label>
                <input style={inputStyle} value={offerDraft.moq_text_hi ?? ""} onChange={(e) => setOfferDraft({ ...offerDraft, moq_text_hi: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Image URL</label>
                <input style={inputStyle} value={offerDraft.image_url ?? ""} onChange={(e) => setOfferDraft({ ...offerDraft, image_url: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Sort Order</label>
                <input type="number" style={inputStyle} value={offerDraft.sort_order} onChange={(e) => setOfferDraft({ ...offerDraft, sort_order: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Image Alt (EN)</label>
                <input style={inputStyle} value={offerDraft.image_alt_en ?? ""} onChange={(e) => setOfferDraft({ ...offerDraft, image_alt_en: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Image Alt (HI)</label>
                <input style={inputStyle} value={offerDraft.image_alt_hi ?? ""} onChange={(e) => setOfferDraft({ ...offerDraft, image_alt_hi: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Linked SKU IDs (comma-separated)</label>
                <input
                  style={inputStyle}
                  value={offerDraft.sku_ids.join(", ")}
                  onChange={(e) =>
                    setOfferDraft({
                      ...offerDraft,
                      sku_ids: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Service Scope (comma-separated)</label>
                <input
                  style={inputStyle}
                  value={offerDraft.service_scope.join(", ")}
                  onChange={(e) =>
                    setOfferDraft({
                      ...offerDraft,
                      service_scope: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Pricing Mode</label>
                <select
                  style={inputStyle}
                  value={offerDraft.pricing_mode}
                  onChange={(e) =>
                    setOfferDraft({
                      ...offerDraft,
                      pricing_mode: e.target.value as B2BOfferRecord["pricing_mode"],
                    })
                  }
                >
                  <option value="request_quote">request_quote</option>
                  <option value="approved_display_price">approved_display_price</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 22 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                  <input type="checkbox" checked={offerDraft.active} onChange={(e) => setOfferDraft({ ...offerDraft, active: e.target.checked })} />
                  Active on Public Pages
                </label>
              </div>
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button type="submit" disabled={saving} className="button button-primary" style={{ padding: "10px 20px" }}>
                {saving ? "Saving…" : "Save & Approve Offer"}
              </button>
            </div>
          </form>
        ) : null}

        {!loading && data && tab === "content" && contentDraft ? (
          <form onSubmit={saveContent} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Edit Segment &amp; Locale Page Content</h2>
              <select
                style={{ ...inputStyle, width: "auto" }}
                value={contentKey}
                onChange={(e) => {
                  const key = e.target.value;
                  setContentKey(key);
                  const [seg, loc] = key.split(":") as [Segment, BusinessLocale];
                  const found = data.pageContent.find((c) => c.segment === seg && c.locale === loc);
                  if (found) setContentDraft(found);
                }}
              >
                {data.pageContent.map((c) => (
                  <option key={`${c.segment}:${c.locale}`} value={`${c.segment}:${c.locale}`}>
                    {c.segment.toUpperCase()} ({c.locale.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Eyebrow</label>
                  <input style={inputStyle} value={contentDraft.eyebrow} onChange={(e) => setContentDraft({ ...contentDraft, eyebrow: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Hero Image URL</label>
                  <input style={inputStyle} value={contentDraft.hero_image_url} onChange={(e) => setContentDraft({ ...contentDraft, hero_image_url: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Headline (H1)</label>
                <input style={inputStyle} value={contentDraft.headline} onChange={(e) => setContentDraft({ ...contentDraft, headline: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Intro Copy</label>
                <textarea rows={2} style={inputStyle} value={contentDraft.intro} onChange={(e) => setContentDraft({ ...contentDraft, intro: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Primary CTA</label>
                  <input style={inputStyle} value={contentDraft.primary_cta} onChange={(e) => setContentDraft({ ...contentDraft, primary_cta: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Secondary CTA</label>
                  <input style={inputStyle} value={contentDraft.secondary_cta} onChange={(e) => setContentDraft({ ...contentDraft, secondary_cta: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Form Heading</label>
                  <input style={inputStyle} value={contentDraft.form_heading} onChange={(e) => setContentDraft({ ...contentDraft, form_heading: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>SEO Title</label>
                  <input style={inputStyle} value={contentDraft.seo_title} onChange={(e) => setContentDraft({ ...contentDraft, seo_title: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>SEO Description</label>
                <input style={inputStyle} value={contentDraft.seo_description} onChange={(e) => setContentDraft({ ...contentDraft, seo_description: e.target.value })} />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <button type="submit" disabled={saving} className="button button-primary" style={{ padding: "10px 20px" }}>
                {saving ? "Saving…" : "Save & Approve Content"}
              </button>
            </div>
          </form>
        ) : null}

        {!loading && data && tab === "claims" && claimDraft ? (
          <form onSubmit={saveClaim} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Approved Commercial Claims</h2>
              <select
                style={{ ...inputStyle, width: "auto" }}
                value={selectedClaimKey}
                onChange={(e) => {
                  const key = e.target.value;
                  setSelectedClaimKey(key);
                  const found = data.claims.find((c) => c.claim_key === key);
                  if (found) setClaimDraft(found);
                }}
              >
                {data.claims.map((c) => (
                  <option key={c.claim_key} value={c.claim_key}>
                    {c.claim_key}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Exact Copy (EN)</label>
                <textarea rows={2} style={inputStyle} value={claimDraft.exact_copy_en} onChange={(e) => setClaimDraft({ ...claimDraft, exact_copy_en: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Exact Copy (HI)</label>
                <textarea rows={2} style={inputStyle} value={claimDraft.exact_copy_hi} onChange={(e) => setClaimDraft({ ...claimDraft, exact_copy_hi: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Evidence Source</label>
                  <input style={inputStyle} value={claimDraft.evidence_source} onChange={(e) => setClaimDraft({ ...claimDraft, evidence_source: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Evidence Owner</label>
                  <input style={inputStyle} value={claimDraft.evidence_owner} onChange={(e) => setClaimDraft({ ...claimDraft, evidence_owner: e.target.value })} />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                <input type="checkbox" checked={claimDraft.active} onChange={(e) => setClaimDraft({ ...claimDraft, active: e.target.checked })} />
                Active
              </label>
            </div>

            <div style={{ marginTop: 16 }}>
              <button type="submit" disabled={saving} className="button button-primary" style={{ padding: "10px 20px" }}>
                {saving ? "Saving…" : "Save Claim"}
              </button>
            </div>
          </form>
        ) : null}

        {!loading && data && tab === "leads" ? (
          <>
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>Inbound B2B Leads</h2>
                <select
                  style={{ ...inputStyle, width: "auto" }}
                  value={leadStatusFilter}
                  onChange={(e) => setLeadStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {filteredLeads.length === 0 ? (
                <p style={{ color: "#666" }}>No B2B leads match this filter yet.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#ede9df", textAlign: "left" }}>
                        <th style={{ padding: 10 }}>Ref</th>
                        <th style={{ padding: 10 }}>Stage / Interest</th>
                        <th style={{ padding: 10 }}>Buyer</th>
                        <th style={{ padding: 10 }}>Qty / Pin</th>
                        <th style={{ padding: 10 }}>Campaign</th>
                        <th style={{ padding: 10 }}>Status</th>
                        <th style={{ padding: 10 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id} style={{ borderBottom: "1px solid #e6e2d8" }}>
                          <td style={{ padding: 10, fontWeight: 700 }}>{lead.reference}</td>
                          <td style={{ padding: 10 }}>
                            <div>{lead.segment}</div>
                            <div style={{ color: "#666" }}>{lead.interest}</div>
                          </td>
                          <td style={{ padding: 10 }}>
                            <div>{lead.name}</div>
                            <div style={{ color: "#666" }}>{lead.phone}</div>
                          </td>
                          <td style={{ padding: 10 }}>
                            <div>{lead.quantity_band} kg</div>
                            <div style={{ color: "#666" }}>{lead.pincode}</div>
                          </td>
                          <td style={{ padding: 10, color: "#555" }}>
                            {lead.utm_campaign || lead.utm_source || "direct"}
                          </td>
                          <td style={{ padding: 10, fontWeight: 700 }}>{lead.status}</td>
                          <td style={{ padding: 10 }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {lead.status === "new" ? (
                                <button
                                  type="button"
                                  onClick={() => transitionLead(lead.id, "contact_attempted")}
                                  style={{ padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                                >
                                  Mark Contacted
                                </button>
                              ) : null}
                              {lead.status === "contact_attempted" ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => transitionLead(lead.id, "qualified")}
                                    style={{ padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                                  >
                                    Qualify
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      transitionLead(lead.id, "disqualified", {
                                        qualification_reason: DISQUALIFICATION_REASONS[0],
                                      })
                                    }
                                    style={{ padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                                  >
                                    Disqualify
                                  </button>
                                </>
                              ) : null}
                              {lead.status === "qualified" || lead.status === "quote_sent" ? (
                                <button
                                  type="button"
                                  onClick={() => setQuoteLead(lead)}
                                  style={{ padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                                >
                                  Create Quote
                                </button>
                              ) : null}
                              {lead.status === "quote_sent" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const orderId = window.prompt("Enter verified paid Order ID:");
                                    if (orderId) {
                                      void transitionLead(lead.id, "won", { first_order_id: orderId });
                                    }
                                  }}
                                  style={{ padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                                >
                                  Mark Won
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {quoteLead ? (
              <form onSubmit={submitQuote} style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>
                  Create Commercial Quote for {quoteLead.reference} ({quoteLead.name})
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>Line Item Description</label>
                    <input style={inputStyle} value={quoteDesc} onChange={(e) => setQuoteDesc(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>Pack Format</label>
                    <input style={inputStyle} value={quoteFormat} onChange={(e) => setQuoteFormat(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>Quantity Label</label>
                    <input style={inputStyle} value={quoteQtyLabel} onChange={(e) => setQuoteQtyLabel(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>Goods Total (Paise)</label>
                    <input style={inputStyle} value={quoteUnitPaise} onChange={(e) => setQuoteUnitPaise(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>Freight (Paise)</label>
                    <input style={inputStyle} value={quoteFreightPaise} onChange={(e) => setQuoteFreightPaise(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>Tax (Paise)</label>
                    <input style={inputStyle} value={quoteTaxPaise} onChange={(e) => setQuoteTaxPaise(e.target.value)} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>Freight Terms</label>
                  <input style={inputStyle} value={quoteFreightTerms} onChange={(e) => setQuoteFreightTerms(e.target.value)} />
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                  <button type="submit" disabled={saving} className="button button-primary" style={{ padding: "8px 18px" }}>
                    Save &amp; Mark Quote Sent
                  </button>
                  <button type="button" onClick={() => setQuoteLead(null)} className="button button-outline" style={{ padding: "8px 18px" }}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </>
        ) : null}

        {!loading && data && tab === "outbox" ? (
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>CRM Integration Outbox</h2>
            {data.outbox.length === 0 ? (
              <p style={{ color: "#666" }}>Outbox is empty.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#ede9df", textAlign: "left" }}>
                      <th style={{ padding: 10 }}>Topic</th>
                      <th style={{ padding: 10 }}>Aggregate</th>
                      <th style={{ padding: 10 }}>Status</th>
                      <th style={{ padding: 10 }}>Attempts</th>
                      <th style={{ padding: 10 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.outbox.map((item) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #e6e2d8" }}>
                        <td style={{ padding: 10, fontWeight: 600 }}>{item.topic}</td>
                        <td style={{ padding: 10 }}>{item.aggregate_id}</td>
                        <td style={{ padding: 10 }}>{item.status}</td>
                        <td style={{ padding: 10 }}>{item.attempt}</td>
                        <td style={{ padding: 10 }}>
                          {item.status !== "done" ? (
                            <button type="button" onClick={() => retryOutbox(item.id)} style={{ padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>
                              Retry
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
