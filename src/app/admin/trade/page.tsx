"use client";

import React, { useCallback, useEffect, useState } from "react";

type TabId =
  | "settings"
  | "offers"
  | "lanes"
  | "content"
  | "enquiries"
  | "orders"
  | "pilots";

type AdminTradePayload = {
  settings: {
    channel_enabled: boolean;
    enabled_locales: string[];
    staged_locales: string[];
    featured_trial_id: string | null;
    trial_parcel_rate_paise: number;
    trial_credit_paise: number;
    trial_credit_min_qty_kg: number;
    trial_credit_expiry_days: number;
    whatsapp_number: string;
    support_hours: string;
    dispatch_cutoff_label: string;
    hero_image_url: string;
    hero_video_url: string | null;
    hero_video_poster_url: string | null;
    trial_image_url: string;
  };
  offers: Array<Record<string, unknown>>;
  lanes: Array<Record<string, unknown>>;
  enquiries: Array<Record<string, unknown>>;
  localizedContent: Array<Record<string, unknown>>;
  sharedPilots: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  funnelSummary: {
    eventCounts: Array<{ event_name: string; count: number; total_paise: number }>;
    quoteStats: Array<{ kind: string; count: number }>;
    enquiryStats: Array<{ status: string; count: number }>;
  };
  catalog: {
    products: Array<{ id: number; slug: string; name: string; enabled: number }>;
    variants: Array<{
      id: number;
      product_id: number;
      sku: string;
      grams: number;
      price_paise: number;
      stock: number;
    }>;
    trials: Array<{ id: string; slug: string; title: string; status: string }>;
  };
};

export default function AdminTradePage() {
  const [tab, setTab] = useState<TabId>("settings");
  const [data, setData] = useState<AdminTradePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<AdminTradePayload["settings"] | null>(
    null
  );

  // Offer form state
  const [offerProductId, setOfferProductId] = useState("");
  const [offerOrder, setOfferOrder] = useState("1");
  const [offerBadge, setOfferBadge] = useState("");
  const [offerPublished, setOfferPublished] = useState(true);
  const [offerEligibleVariants, setOfferEligibleVariants] = useState<number[]>([]);
  const [offerDefaultVariantId, setOfferDefaultVariantId] = useState("");

  // Lane form state
  const [laneCode, setLaneCode] = useState("NEW-LANE");
  const [pinStart, setPinStart] = useState("734001");
  const [pinEnd, setPinEnd] = useState("734099");
  const [serviceCode, setServiceCode] = useState("surface_doorstep");
  const [serviceLabel, setServiceLabel] = useState("Local Doorstep");
  const [handoverKind, setHandoverKind] = useState<"doorstep" | "depot">("doorstep");
  const [localityLabel, setLocalityLabel] = useState("Siliguri");
  const [depotName, setDepotName] = useState("");
  const [depotAddress, setDepotAddress] = useState("");
  const [onwardIncluded, setOnwardIncluded] = useState(false);
  const [baseFreightPaise, setBaseFreightPaise] = useState("90000");
  const [perKgFreightPaise, setPerKgFreightPaise] = useState("0");
  const [lastMilePaise, setLastMilePaise] = useState("0");
  const [extraTaxBps, setExtraTaxBps] = useState("0");
  const [otherFeesPaise, setOtherFeesPaise] = useState("0");
  const [tareGrams, setTareGrams] = useState("600");
  const [dimDivisor, setDimDivisor] = useState("5000");
  const [billingIncGrams, setBillingIncGrams] = useState("1000");
  const [maxNetGrams, setMaxNetGrams] = useState("30000");
  const [maxBilledGrams, setMaxBilledGrams] = useState("30000");
  const [etaLabel, setEtaLabel] = useState("2-4 business days");
  const [operatorName, setOperatorName] = useState("");
  const [codAllowed, setCodAllowed] = useState(true);
  const [codFeePaise, setCodFeePaise] = useState("9000");
  const [codMaxTotalPaise, setCodMaxTotalPaise] = useState("");
  const [advanceAllowed, setAdvanceAllowed] = useState(true);

  // Preview PIN state
  const [previewPin, setPreviewPin] = useState("734001");
  const [previewVariantId, setPreviewVariantId] = useState("");
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  // Content form state
  const [contentKey, setContentKey] = useState("hero.intro");
  const [contentLocale, setContentLocale] = useState("bn");
  const [contentText, setContentText] = useState("");
  const [contentAudioUrl, setContentAudioUrl] = useState("");
  const [contentTranscript, setContentTranscript] = useState("");
  const [contentStatus, setContentStatus] = useState<"draft" | "reviewed" | "needs_review">("reviewed");

  // Pilot form state
  const [pilotId, setPilotId] = useState("");
  const [pilotTown, setPilotTown] = useState("");
  const [pilotPinPrefix, setPilotPinPrefix] = useState("734");
  const [pilotPoint, setPilotPoint] = useState("");
  const [pilotAddr, setPilotAddr] = useState("");
  const [pilotLocalFeePaise, setPilotLocalFeePaise] = useState("0");
  const [pilotTargetKg, setPilotTargetKg] = useState("200");
  const [pilotBookedKg, setPilotBookedKg] = useState("0");
  const [pilotStatus, setPilotStatus] = useState<"active" | "paused" | "dispatched" | "cancelled">("active");
  const [pilotPartner, setPilotPartner] = useState("");
  const [pilotSchedule, setPilotSchedule] = useState("Every Tuesday");
  const [pilotCutoff, setPilotCutoff] = useState("2026-12-01T18:00:00Z");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/trade", { credentials: "same-origin" });
      if (res.ok) {
        const json = (await res.json()) as AdminTradePayload;
        setData(json);
        setSettingsForm(json.settings);
        if (!offerProductId && json.catalog.products[0]) {
          setOfferProductId(String(json.catalog.products[0].id));
        }
        if (!previewVariantId && json.catalog.variants[0]) {
          setPreviewVariantId(String(json.catalog.variants[0].id));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [offerProductId, previewVariantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settingsForm) return;
    const res = await fetch("/api/admin/trade", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(settingsForm),
    });
    if (res.ok) {
      setStatusMsg("Trade settings saved.");
      await loadData();
    } else {
      setStatusMsg("Failed to save settings.");
    }
  }

  async function saveOffer(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/trade/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        product_id: Number(offerProductId),
        featured_order: Number(offerOrder) || 0,
        published: offerPublished,
        eligible_variant_ids: offerEligibleVariants,
        default_variant_id: offerDefaultVariantId ? Number(offerDefaultVariantId) : null,
        badge_text: offerBadge || null,
      }),
    });
    if (res.ok) {
      setStatusMsg("Trade offer saved.");
      await loadData();
    }
  }

  async function saveLane(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/trade/lanes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        lane_code: laneCode,
        is_active: true,
        pin_start: pinStart,
        pin_end: pinEnd,
        service_code: serviceCode,
        service_label: serviceLabel,
        handover_kind: handoverKind,
        locality_label: localityLabel,
        depot_name: handoverKind === "depot" ? depotName : null,
        depot_address: handoverKind === "depot" ? depotAddress : null,
        onward_included: onwardIncluded,
        base_freight_paise: Number(baseFreightPaise) || 0,
        per_kg_freight_paise: Number(perKgFreightPaise) || 0,
        last_mile_paise: Number(lastMilePaise) || 0,
        extra_tax_bps: Number(extraTaxBps) || 0,
        other_fees_paise: Number(otherFeesPaise) || 0,
        tare_grams: Number(tareGrams) || 600,
        dim_divisor: Number(dimDivisor) || 5000,
        billing_increment_grams: Number(billingIncGrams) || 1000,
        max_net_grams: Number(maxNetGrams) || 30000,
        max_billed_grams: Number(maxBilledGrams) || 30000,
        eta_label: etaLabel,
        operator_name: operatorName || null,
        cod_allowed: codAllowed,
        cod_fee_paise: Number(codFeePaise) || 0,
        cod_max_total_paise: codMaxTotalPaise ? Number(codMaxTotalPaise) : null,
        freight_advance_allowed: advanceAllowed,
      }),
    });
    if (res.ok) {
      setStatusMsg("Versioned lane saved.");
      await loadData();
    }
  }

  async function runPreviewQuote(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/trade/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "trade",
        quoteType: "bulk",
        locale: "en",
        destinationPin: previewPin,
        lines: [{ variantId: Number(previewVariantId), quantity: 1 }],
        payment: "prepaid",
      }),
    });
    const json = await res.json();
    setPreviewResult(JSON.stringify(json, null, 2));
  }

  async function saveContent(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/trade/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        resource_key: contentKey,
        locale: contentLocale,
        text_value: contentText,
        audio_url: contentAudioUrl || null,
        transcript: contentTranscript || null,
        review_status: contentStatus,
        updated_by: "admin",
      }),
    });
    if (res.ok) {
      setStatusMsg("Localized content saved.");
      await loadData();
    }
  }

  async function savePilot(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/trade/pilots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        ...(pilotId ? { id: pilotId } : {}),
        town_name: pilotTown,
        pin_prefix: pilotPinPrefix,
        collection_point: pilotPoint,
        collection_address: pilotAddr,
        local_fee_paise: Number(pilotLocalFeePaise) || 0,
        target_kg: Number(pilotTargetKg) || 200,
        booked_kg: Number(pilotBookedKg) || 0,
        dispatch_partner: pilotPartner,
        dispatch_schedule: pilotSchedule,
        cutoff_at: pilotCutoff,
        status: pilotStatus,
      }),
    });
    if (res.ok) {
      setStatusMsg("Shared pilot saved.");
      await loadData();
    }
  }

  if (loading && !data) {
    return <div style={{ padding: 24 }}>Loading TeaFloww Trade console…</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>TeaFloww Trade (/tea-shops)</h1>
      <p style={{ color: "#4e6057", marginBottom: 16 }}>
        Manage trade offers, versioned freight lanes, depots, localized copy/audio,
        enquiries, shared town pilots, and order reconciliation.
      </p>

      {statusMsg ? (
        <div
          role="status"
          style={{
            padding: "10px 14px",
            background: "#e8eddf",
            border: "1px solid #23483a",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          {statusMsg}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {(
          [
            ["settings", "Settings & Funnel"],
            ["offers", "Offers"],
            ["lanes", "Lanes & PIN Preview"],
            ["content", "Localisation & Audio"],
            ["enquiries", "Enquiries"],
            ["orders", "Orders"],
            ["pilots", "Shared Pilots"],
          ] as Array<[TabId, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`button ${tab === id ? "button-primary" : "button-outline"}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "settings" && settingsForm && data ? (
        <div style={{ display: "grid", gap: 20 }}>
          <form
            onSubmit={saveSettings}
            style={{
              background: "#fbf8f1",
              padding: 20,
              borderRadius: 10,
              border: "1px solid #d9d4c8",
              display: "grid",
              gap: 12,
            }}
          >
            <h2 style={{ fontSize: 20 }}>Channel & Trial Configuration</h2>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={settingsForm.channel_enabled}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, channel_enabled: e.target.checked })
                }
              />
              <span>Trade channel enabled (/tea-shops)</span>
            </label>
            <label>
              Featured Published Trial
              <select
                value={settingsForm.featured_trial_id ?? ""}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    featured_trial_id: e.target.value || null,
                  })
                }
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              >
                <option value="">Auto-select latest published trial</option>
                {data.catalog.trials.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.slug})
                  </option>
                ))}
              </select>
            </label>
            <label>
              WhatsApp Support Number
              <input
                value={settingsForm.whatsapp_number}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, whatsapp_number: e.target.value })
                }
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              Support Hours
              <input
                value={settingsForm.support_hours}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, support_hours: e.target.value })
                }
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              Dispatch Cutoff Label
              <input
                value={settingsForm.dispatch_cutoff_label}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    dispatch_cutoff_label: e.target.value,
                  })
                }
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              Trial Parcel Rate (paise)
              <input
                type="number"
                value={settingsForm.trial_parcel_rate_paise}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    trial_parcel_rate_paise: Number(e.target.value) || 0,
                  })
                }
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <label>
                Trial Credit (paise)
                <input
                  type="number"
                  value={settingsForm.trial_credit_paise}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      trial_credit_paise: Number(e.target.value) || 0,
                    })
                  }
                  style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
                />
              </label>
              <label>
                Credit Min Qty (kg)
                <input
                  type="number"
                  value={settingsForm.trial_credit_min_qty_kg}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      trial_credit_min_qty_kg: Number(e.target.value) || 1,
                    })
                  }
                  style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
                />
              </label>
              <label>
                Credit Expiry (days)
                <input
                  type="number"
                  value={settingsForm.trial_credit_expiry_days}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      trial_credit_expiry_days: Number(e.target.value) || 1,
                    })
                  }
                  style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
                />
              </label>
            </div>
            <label>
              Enabled Locales (comma-separated, e.g. en,bn,hi,gu,mr)
              <input
                value={settingsForm.enabled_locales.join(",")}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    enabled_locales: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              Hero Image URL
              <input
                value={settingsForm.hero_image_url}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, hero_image_url: e.target.value })
                }
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              Hero Brew Video URL (optional)
              <input
                value={settingsForm.hero_video_url ?? ""}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    hero_video_url: e.target.value || null,
                  })
                }
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              Trial Image URL
              <input
                value={settingsForm.trial_image_url}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, trial_image_url: e.target.value })
                }
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <button type="submit" className="button button-primary">
              Save Trade Settings
            </button>
          </form>

          <div
            style={{
              background: "#fbf8f1",
              padding: 20,
              borderRadius: 10,
              border: "1px solid #d9d4c8",
            }}
          >
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Funnel Summary</h2>
            <pre style={{ fontSize: 12, overflowX: "auto" }}>
              {JSON.stringify(data.funnelSummary, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}

      {tab === "offers" && data ? (
        <div style={{ display: "grid", gap: 20 }}>
          <form
            onSubmit={saveOffer}
            style={{
              background: "#fbf8f1",
              padding: 20,
              borderRadius: 10,
              border: "1px solid #d9d4c8",
              display: "grid",
              gap: 10,
            }}
          >
            <h2 style={{ fontSize: 20 }}>Assign Product to Trade Channel</h2>
            <select
              value={offerProductId}
              onChange={(e) => setOfferProductId(e.target.value)}
              style={{ padding: 8 }}
            >
              {data.catalog.products.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} · {p.name} ({p.slug})
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Featured order"
              value={offerOrder}
              onChange={(e) => setOfferOrder(e.target.value)}
              style={{ padding: 8 }}
            />
            <input
              placeholder="Badge text (optional)"
              value={offerBadge}
              onChange={(e) => setOfferBadge(e.target.value)}
              style={{ padding: 8 }}
            />
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={offerPublished}
                onChange={(e) => setOfferPublished(e.target.checked)}
              />
              <span>Published in /tea-shops</span>
            </label>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Eligible Variants (leave all unchecked for all variants)
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {data.catalog.variants
                  .filter((v) => String(v.product_id) === offerProductId)
                  .map((v) => (
                    <label key={v.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={offerEligibleVariants.includes(v.id)}
                        onChange={(e) =>
                          setOfferEligibleVariants((prev) =>
                            e.target.checked
                              ? [...prev, v.id]
                              : prev.filter((id) => id !== v.id)
                          )
                        }
                      />
                      <span>
                        {v.sku} ({v.grams / 1000} kg)
                      </span>
                    </label>
                  ))}
              </div>
            </div>
            <select
              value={offerDefaultVariantId}
              onChange={(e) => setOfferDefaultVariantId(e.target.value)}
              style={{ padding: 8 }}
            >
              <option value="">Default variant (auto-select 25 kg)</option>
              {data.catalog.variants
                .filter((v) => String(v.product_id) === offerProductId)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    Default: {v.sku} ({v.grams / 1000} kg)
                  </option>
                ))}
            </select>
            <button type="submit" className="button button-primary">
              Assign / Update Offer
            </button>
          </form>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Order</th>
                <th>Published</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.offers.map((o) => (
                <tr key={String(o.product_id)}>
                  <td>
                    #{String(o.product_id)} · {String(o.product_name)}
                  </td>
                  <td>{String(o.featured_order)}</td>
                  <td>{o.published ? "Yes" : "No"}</td>
                  <td>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={async () => {
                        await fetch(
                          `/api/admin/trade/offers?productId=${String(o.product_id)}`,
                          { method: "DELETE", credentials: "same-origin" }
                        );
                        await loadData();
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "lanes" && data ? (
        <div style={{ display: "grid", gap: 20 }}>
          <form
            onSubmit={saveLane}
            style={{
              background: "#fbf8f1",
              padding: 20,
              borderRadius: 10,
              border: "1px solid #d9d4c8",
              display: "grid",
              gap: 10,
            }}
          >
            <h2 style={{ fontSize: 20 }}>Create Versioned Lane</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <input
                placeholder="Lane code"
                value={laneCode}
                onChange={(e) => setLaneCode(e.target.value)}
                style={{ padding: 8 }}
                required
              />
              <input
                placeholder="PIN start (e.g. 734001)"
                value={pinStart}
                onChange={(e) => setPinStart(e.target.value)}
                style={{ padding: 8 }}
                required
              />
              <input
                placeholder="PIN end (e.g. 734099)"
                value={pinEnd}
                onChange={(e) => setPinEnd(e.target.value)}
                style={{ padding: 8 }}
                required
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <input
                placeholder="Service code"
                value={serviceCode}
                onChange={(e) => setServiceCode(e.target.value)}
                style={{ padding: 8 }}
                required
              />
              <input
                placeholder="Service label"
                value={serviceLabel}
                onChange={(e) => setServiceLabel(e.target.value)}
                style={{ padding: 8 }}
                required
              />
              <select
                value={handoverKind}
                onChange={(e) =>
                  setHandoverKind(e.target.value as "doorstep" | "depot")
                }
                style={{ padding: 8 }}
              >
                <option value="doorstep">Doorstep</option>
                <option value="depot">Depot</option>
              </select>
            </div>
            <input
              placeholder="Locality label"
              value={localityLabel}
              onChange={(e) => setLocalityLabel(e.target.value)}
              style={{ padding: 8 }}
            />
            {handoverKind === "depot" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  placeholder="Depot name"
                  value={depotName}
                  onChange={(e) => setDepotName(e.target.value)}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Depot address"
                  value={depotAddress}
                  onChange={(e) => setDepotAddress(e.target.value)}
                  style={{ padding: 8 }}
                />
              </div>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <input
                type="number"
                placeholder="Base freight (paise)"
                value={baseFreightPaise}
                onChange={(e) => setBaseFreightPaise(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="Per-kg freight (paise)"
                value={perKgFreightPaise}
                onChange={(e) => setPerKgFreightPaise(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="Last-mile (paise)"
                value={lastMilePaise}
                onChange={(e) => setLastMilePaise(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="Extra tax (bps)"
                value={extraTaxBps}
                onChange={(e) => setExtraTaxBps(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="Other fees (paise)"
                value={otherFeesPaise}
                onChange={(e) => setOtherFeesPaise(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="COD fee (paise)"
                value={codFeePaise}
                onChange={(e) => setCodFeePaise(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="Tare (g)"
                value={tareGrams}
                onChange={(e) => setTareGrams(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="Dim divisor"
                value={dimDivisor}
                onChange={(e) => setDimDivisor(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="Billing increment (g)"
                value={billingIncGrams}
                onChange={(e) => setBillingIncGrams(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="Max net (g)"
                value={maxNetGrams}
                onChange={(e) => setMaxNetGrams(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="Max billed (g)"
                value={maxBilledGrams}
                onChange={(e) => setMaxBilledGrams(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="COD max total (paise, optional)"
                value={codMaxTotalPaise}
                onChange={(e) => setCodMaxTotalPaise(e.target.value)}
                style={{ padding: 8 }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                placeholder="ETA label (e.g. 2-4 business days)"
                value={etaLabel}
                onChange={(e) => setEtaLabel(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                placeholder="Operator / carrier name"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                style={{ padding: 8 }}
              />
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <label>
                <input
                  type="checkbox"
                  checked={codAllowed}
                  onChange={(e) => setCodAllowed(e.target.checked)}
                />{" "}
                COD Allowed
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={advanceAllowed}
                  onChange={(e) => setAdvanceAllowed(e.target.checked)}
                />{" "}
                Freight Advance Allowed
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={onwardIncluded}
                  onChange={(e) => setOnwardIncluded(e.target.checked)}
                />{" "}
                Onward Included (Depot)
              </label>
            </div>
            <button type="submit" className="button button-primary">
              Publish New Lane Version
            </button>
          </form>

          <form
            onSubmit={runPreviewQuote}
            style={{
              background: "#e8eddf",
              padding: 16,
              borderRadius: 10,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <strong>Preview PIN Quote:</strong>
            <input
              value={previewPin}
              onChange={(e) => setPreviewPin(e.target.value)}
              placeholder="PIN"
              style={{ padding: 8, width: 120 }}
            />
            <select
              value={previewVariantId}
              onChange={(e) => setPreviewVariantId(e.target.value)}
              style={{ padding: 8 }}
            >
              {data.catalog.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  #{v.id} · {v.sku} ({v.grams / 1000} kg)
                </option>
              ))}
            </select>
            <button type="submit" className="button button-primary">
              Test Quote
            </button>
            {previewResult ? (
              <pre style={{ width: "100%", fontSize: 12, marginTop: 8 }}>
                {previewResult}
              </pre>
            ) : null}
          </form>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Code (Ver)</th>
                <th>PIN Range</th>
                <th>Handover</th>
                <th>Base Freight</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.lanes.map((l) => (
                <tr key={String(l.id)}>
                  <td>
                    {String(l.lane_code)} (v{String(l.version)})
                  </td>
                  <td>
                    {String(l.pin_start)} – {String(l.pin_end)}
                  </td>
                  <td>{String(l.handover_kind)}</td>
                  <td>₹{Number(l.base_freight_paise) / 100}</td>
                  <td>{l.is_active ? "Active" : "Paused"}</td>
                  <td>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={async () => {
                        await fetch("/api/admin/trade/lanes", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          credentials: "same-origin",
                          body: JSON.stringify({
                            id: l.id,
                            is_active: !Boolean(l.is_active),
                          }),
                        });
                        await loadData();
                      }}
                    >
                      {l.is_active ? "Pause" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "content" && data ? (
        <div style={{ display: "grid", gap: 20 }}>
          <form
            onSubmit={saveContent}
            style={{
              background: "#fbf8f1",
              padding: 20,
              borderRadius: 10,
              border: "1px solid #d9d4c8",
              display: "grid",
              gap: 10,
            }}
          >
            <h2 style={{ fontSize: 20 }}>Update Localised Copy, Audio & Transcript</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <input
                placeholder="Resource key (e.g. hero.intro)"
                value={contentKey}
                onChange={(e) => setContentKey(e.target.value)}
                style={{ padding: 8 }}
                required
              />
              <select
                value={contentLocale}
                onChange={(e) => setContentLocale(e.target.value)}
                style={{ padding: 8 }}
              >
                {["en", "bn", "hi", "gu", "mr", "pa", "ta", "te", "kn"].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                value={contentStatus}
                onChange={(e) =>
                  setContentStatus(
                    e.target.value as "draft" | "reviewed" | "needs_review"
                  )
                }
                style={{ padding: 8 }}
              >
                <option value="reviewed">reviewed</option>
                <option value="draft">draft</option>
                <option value="needs_review">needs_review</option>
              </select>
            </div>
            <textarea
              placeholder="Translated text"
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              style={{ padding: 8, minHeight: 70 }}
              required
            />
            <input
              placeholder="Audio URL (optional)"
              value={contentAudioUrl}
              onChange={(e) => setContentAudioUrl(e.target.value)}
              style={{ padding: 8 }}
            />
            <textarea
              placeholder="Audio transcript (optional)"
              value={contentTranscript}
              onChange={(e) => setContentTranscript(e.target.value)}
              style={{ padding: 8 }}
            />
            <button type="submit" className="button button-primary">
              Save Content Override
            </button>
          </form>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Locale</th>
                <th>Status</th>
                <th>Text</th>
              </tr>
            </thead>
            <tbody>
              {data.localizedContent.map((c) => (
                <tr key={String(c.id)}>
                  <td>{String(c.resource_key)}</td>
                  <td>{String(c.locale)}</td>
                  <td>{String(c.review_status)}</td>
                  <td>{String(c.text_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "enquiries" && data ? (
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>PIN / Locale</th>
              <th>Phone / Hours</th>
              <th>Status / Owner / Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.enquiries.map((eq) => (
              <tr key={String(eq.id)}>
                <td>{String(eq.id)}</td>
                <td>
                  {String(eq.destination_pin)} ({String(eq.locale)})
                </td>
                <td>
                  {String(eq.contact_phone)} · {String(eq.preferred_hours || "Any")}
                </td>
                <td>
                  <div>
                    <strong>{String(eq.status)}</strong>
                    {eq.assigned_owner ? ` · ${String(eq.assigned_owner)}` : ""}
                  </div>
                  {eq.converted_quote_id ? (
                    <div style={{ fontSize: 12 }}>Quote: {String(eq.converted_quote_id)}</div>
                  ) : null}
                  {eq.notes ? <div style={{ fontSize: 12 }}>{String(eq.notes)}</div> : null}
                </td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <select
                    defaultValue={String(eq.status)}
                    aria-label={`Status for ${String(eq.id)}`}
                    onChange={async (e) => {
                      await fetch("/api/admin/trade/enquiries", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        credentials: "same-origin",
                        body: JSON.stringify({ id: eq.id, status: e.target.value }),
                      });
                      setStatusMsg(`Enquiry ${String(eq.id)} updated.`);
                      await loadData();
                    }}
                    style={{ padding: 6 }}
                  >
                    <option value="new">new</option>
                    <option value="assigned">assigned</option>
                    <option value="quoted">quoted</option>
                    <option value="closed">closed</option>
                  </select>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={async () => {
                      const owner = window.prompt("Assigned owner:", String(eq.assigned_owner || ""));
                      if (owner === null) return;
                      const notes = window.prompt("Notes:", String(eq.notes || ""));
                      await fetch("/api/admin/trade/enquiries", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        credentials: "same-origin",
                        body: JSON.stringify({
                          id: eq.id,
                          assigned_owner: owner || null,
                          notes: notes || null,
                        }),
                      });
                      setStatusMsg(`Enquiry ${String(eq.id)} owner/notes saved.`);
                      await loadData();
                    }}
                  >
                    Edit Owner/Notes
                  </button>
                  {previewVariantId ? (
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={async () => {
                        const res = await fetch("/api/admin/trade/enquiries", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "same-origin",
                          body: JSON.stringify({
                            enquiryId: eq.id,
                            assignedOwner: eq.assigned_owner ? String(eq.assigned_owner) : "ops",
                            quoteRequest: {
                              channel: "trade",
                              quoteType: "bulk",
                              locale: String(eq.locale || "en"),
                              destinationPin: String(eq.destination_pin),
                              lines: [{ variantId: Number(previewVariantId), quantity: 1 }],
                              payment: "prepaid",
                            },
                          }),
                        });
                        if (res.ok) {
                          setStatusMsg(`Converted ${String(eq.id)} to confirmed quote.`);
                          await loadData();
                        } else {
                          setStatusMsg(`Could not auto-quote ${String(eq.id)} (check lane/PIN).`);
                        }
                      }}
                    >
                      Convert to Quote
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {tab === "orders" && data ? (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>PIN / Mode</th>
              <th>Total / Due Now / Later</th>
              <th>Remittance & Dispatch</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.map((ord) => (
              <tr key={String(ord.order_id)}>
                <td>{String(ord.order_id)}</td>
                <td>
                  {String(ord.destination_pin)} · {String(ord.payment_mode)}
                </td>
                <td>
                  ₹{Number(ord.total_paise) / 100} / ₹{Number(ord.due_now_paise) / 100} /
                  ₹{Number(ord.due_later_paise) / 100}
                </td>
                <td>
                  {String(ord.remittance_status)} (₹{Number(ord.remitted_paise || 0) / 100}) ·{" "}
                  {String(ord.dispatch_status || "pending")}
                </td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <select
                    defaultValue={String(ord.dispatch_status || "pending")}
                    aria-label={`Dispatch status for ${String(ord.order_id)}`}
                    onChange={async (e) => {
                      await fetch("/api/admin/trade/orders", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        credentials: "same-origin",
                        body: JSON.stringify({
                          order_id: ord.order_id,
                          dispatch_status: e.target.value,
                        }),
                      });
                      setStatusMsg(`Order ${String(ord.order_id)} dispatch updated.`);
                      await loadData();
                    }}
                    style={{ padding: 6 }}
                  >
                    <option value="pending">pending</option>
                    <option value="packed">packed</option>
                    <option value="dispatched">dispatched</option>
                    <option value="delivered">delivered</option>
                  </select>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={async () => {
                      await fetch("/api/admin/trade/orders", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        credentials: "same-origin",
                        body: JSON.stringify({
                          order_id: ord.order_id,
                          remittance_status: "remitted",
                          remitted_paise: ord.due_later_paise,
                        }),
                      });
                      setStatusMsg(`Order ${String(ord.order_id)} marked remitted.`);
                      await loadData();
                    }}
                  >
                    Mark Remitted
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {tab === "pilots" && data ? (
        <div style={{ display: "grid", gap: 20 }}>
          <form
            onSubmit={savePilot}
            style={{
              background: "#fbf8f1",
              padding: 20,
              borderRadius: 10,
              border: "1px solid #d9d4c8",
              display: "grid",
              gap: 10,
            }}
          >
            <h2 style={{ fontSize: 20 }}>
              {pilotId ? `Update Pilot (${pilotId})` : "Create Shared-Load Town Pilot"}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                placeholder="Town name"
                value={pilotTown}
                onChange={(e) => setPilotTown(e.target.value)}
                style={{ padding: 8 }}
                required
              />
              <input
                placeholder="PIN prefix (e.g. 734)"
                value={pilotPinPrefix}
                onChange={(e) => setPilotPinPrefix(e.target.value)}
                style={{ padding: 8 }}
                required
              />
              <input
                placeholder="Collection point"
                value={pilotPoint}
                onChange={(e) => setPilotPoint(e.target.value)}
                style={{ padding: 8 }}
                required
              />
              <input
                placeholder="Collection address"
                value={pilotAddr}
                onChange={(e) => setPilotAddr(e.target.value)}
                style={{ padding: 8 }}
                required
              />
              <input
                type="number"
                placeholder="Local fee (paise)"
                value={pilotLocalFeePaise}
                onChange={(e) => setPilotLocalFeePaise(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="Target kg"
                value={pilotTargetKg}
                onChange={(e) => setPilotTargetKg(e.target.value)}
                style={{ padding: 8 }}
              />
              <input
                type="number"
                placeholder="Booked kg"
                value={pilotBookedKg}
                onChange={(e) => setPilotBookedKg(e.target.value)}
                style={{ padding: 8 }}
              />
              <select
                value={pilotStatus}
                onChange={(e) =>
                  setPilotStatus(
                    e.target.value as "active" | "paused" | "dispatched" | "cancelled"
                  )
                }
                style={{ padding: 8 }}
              >
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="dispatched">dispatched</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
            <input
              placeholder="Dispatch partner"
              value={pilotPartner}
              onChange={(e) => setPilotPartner(e.target.value)}
              style={{ padding: 8 }}
              required
            />
            <input
              placeholder="Dispatch schedule"
              value={pilotSchedule}
              onChange={(e) => setPilotSchedule(e.target.value)}
              style={{ padding: 8 }}
              required
            />
            <input
              placeholder="Cutoff ISO"
              value={pilotCutoff}
              onChange={(e) => setPilotCutoff(e.target.value)}
              style={{ padding: 8 }}
              required
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="button button-primary">
                Save Town Pilot
              </button>
              {pilotId ? (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setPilotId("")}
                >
                  New Pilot
                </button>
              ) : null}
            </div>
          </form>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Town</th>
                <th>Collection Point</th>
                <th>Booked / Target</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.sharedPilots.map((p) => (
                <tr key={String(p.id)}>
                  <td>{String(p.town_name)}</td>
                  <td>{String(p.collection_point)}</td>
                  <td>
                    {String(p.booked_kg)} / {String(p.target_kg)} kg
                  </td>
                  <td>{String(p.status)}</td>
                  <td>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => {
                        setPilotId(String(p.id));
                        setPilotTown(String(p.town_name));
                        setPilotPinPrefix(String(p.pin_prefix));
                        setPilotPoint(String(p.collection_point));
                        setPilotAddr(String(p.collection_address));
                        setPilotLocalFeePaise(String(p.local_fee_paise ?? 0));
                        setPilotTargetKg(String(p.target_kg ?? 200));
                        setPilotBookedKg(String(p.booked_kg ?? 0));
                        setPilotPartner(String(p.dispatch_partner));
                        setPilotSchedule(String(p.dispatch_schedule));
                        setPilotCutoff(String(p.cutoff_at));
                        setPilotStatus(
                          String(p.status) as
                            | "active"
                            | "paused"
                            | "dispatched"
                            | "cancelled"
                        );
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
