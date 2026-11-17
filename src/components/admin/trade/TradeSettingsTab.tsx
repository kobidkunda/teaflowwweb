"use client";

import React, { useState } from "react";
import {
  Activity,
  Film,
  Globe,
  Image as ImageIcon,
  Phone,
  Save,
  Settings2,
} from "lucide-react";
import { TradeMediaField } from "@/components/trade/TradeMediaField";
import {
  TRADE_LOCALE_OPTIONS,
  formatRupees,
  type AdminTradePayload,
  type StatusToast,
  type TradeSettingsState,
} from "./types";

interface TradeSettingsTabProps {
  data: AdminTradePayload;
  settingsForm: TradeSettingsState;
  setSettingsForm: React.Dispatch<React.SetStateAction<TradeSettingsState | null>>;
  onSaved: (toast: StatusToast) => Promise<void>;
  onError: (msg: string) => void;
}

export function TradeSettingsTab({
  data,
  settingsForm,
  setSettingsForm,
  onSaved,
  onError,
}: TradeSettingsTabProps) {
  const [saving, setSaving] = useState(false);

  function toggleLocale(code: string) {
    const exists = settingsForm.enabled_locales.includes(code);
    const next = exists
      ? settingsForm.enabled_locales.filter((c) => c !== code)
      : [...settingsForm.enabled_locales, code];
    if (next.length === 0) {
      onError("At least one enabled locale is required.");
      return;
    }
    setSettingsForm({ ...settingsForm, enabled_locales: next });
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/trade", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(settingsForm),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: unknown };
      if (!res.ok) {
        onError(
          typeof json.detail === "string"
            ? json.detail
            : json.error || "Failed to save settings."
        );
        return;
      }
      await onSaved({ kind: "ok", text: "Trade settings saved." });
    } catch {
      onError("Network error while saving trade settings.");
    } finally {
      setSaving(false);
    }
  }

  const maxEventCount = Math.max(
    1,
    ...data.funnelSummary.eventCounts.map((ev) => ev.count)
  );

  return (
    <div className="tf-trade-stack">
      <form
        onSubmit={saveSettings}
        aria-labelledby="trade-settings-heading"
        className="tf-trade-stack"
      >
        {/* 1. Channel & Trial Configuration */}
        <section className="tf-trade-card">
          <div className="tf-trade-card-header">
            <div>
              <h2 id="trade-settings-heading" className="tf-trade-card-title">
                <Settings2 size={18} aria-hidden="true" />
                <span>Channel &amp; Trial Configuration</span>
              </h2>
              <p className="tf-trade-card-desc">
                Control public visibility of /tea-shops, sample trial pricing, bulk credit rules, and WhatsApp operations.
              </p>
            </div>
          </div>

          <div className="tf-trade-stack">
            <label htmlFor="trade-channel-enabled" className="tf-trade-switch-card">
              <span className="tf-trade-switch-copy">
                <span className="tf-trade-switch-title">
                  Trade channel enabled (/tea-shops)
                </span>
                <span className="tf-trade-switch-sub">
                  When disabled, /tea-shops shows an offline notice and halts new quotes.
                </span>
              </span>
              <input
                id="trade-channel-enabled"
                type="checkbox"
                className="tf-trade-switch-input"
                checked={settingsForm.channel_enabled}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    channel_enabled: e.target.checked,
                  })
                }
                {...({ switch: "" } as Record<string, string>)}
              />
            </label>

            <div className="tf-trade-grid-2">
              <div className="tf-trade-field">
                <label htmlFor="trade-featured-trial" className="tf-trade-label">
                  Featured Published Trial
                </label>
                <select
                  id="trade-featured-trial"
                  className="tf-trade-select"
                  value={settingsForm.featured_trial_id ?? ""}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      featured_trial_id: e.target.value || null,
                    })
                  }
                >
                  <option value="">Auto-select latest published trial</option>
                  {data.catalog.trials.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.slug})
                    </option>
                  ))}
                </select>
                <span className="tf-trade-help">
                  Displayed as the sample trial pack for new tea shop owners.
                </span>
              </div>

              <div className="tf-trade-field">
                <label htmlFor="trade-dispatch-cutoff" className="tf-trade-label">
                  Dispatch Cutoff Label
                </label>
                <input
                  id="trade-dispatch-cutoff"
                  type="text"
                  className="tf-trade-input"
                  value={settingsForm.dispatch_cutoff_label}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      dispatch_cutoff_label: e.target.value,
                    })
                  }
                  required
                />
                <span className="tf-trade-help">
                  Shown on quotes and checkout confirmation screens.
                </span>
              </div>
            </div>

            <div className="tf-trade-grid-2">
              <div className="tf-trade-field">
                <label htmlFor="trade-whatsapp" className="tf-trade-label">
                  <Phone size={14} aria-hidden="true" />
                  <span>WhatsApp Support Number</span>
                </label>
                <input
                  id="trade-whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="tf-trade-input"
                  value={settingsForm.whatsapp_number}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      whatsapp_number: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="tf-trade-field">
                <label htmlFor="trade-support-hours" className="tf-trade-label">
                  Support Hours
                </label>
                <input
                  id="trade-support-hours"
                  type="text"
                  className="tf-trade-input"
                  value={settingsForm.support_hours}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      support_hours: e.target.value,
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="tf-trade-grid-4">
              <div className="tf-trade-field">
                <label htmlFor="trade-parcel-rate" className="tf-trade-label">
                  Trial Parcel Rate (paise)
                </label>
                <input
                  id="trade-parcel-rate"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="tf-trade-input"
                  value={settingsForm.trial_parcel_rate_paise}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      trial_parcel_rate_paise: Number(e.target.value) || 0,
                    })
                  }
                />
                <span className="tf-trade-help">
                  Equals{" "}
                  <span className="tf-trade-money-hint">
                    {formatRupees(settingsForm.trial_parcel_rate_paise)}
                  </span>
                </span>
              </div>

              <div className="tf-trade-field">
                <label htmlFor="trade-credit-paise" className="tf-trade-label">
                  Trial Credit (paise)
                </label>
                <input
                  id="trade-credit-paise"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="tf-trade-input"
                  value={settingsForm.trial_credit_paise}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      trial_credit_paise: Number(e.target.value) || 0,
                    })
                  }
                />
                <span className="tf-trade-help">
                  Equals{" "}
                  <span className="tf-trade-money-hint">
                    {formatRupees(settingsForm.trial_credit_paise)}
                  </span>
                </span>
              </div>

              <div className="tf-trade-field">
                <label htmlFor="trade-credit-min-kg" className="tf-trade-label">
                  Credit Min Qty (kg)
                </label>
                <input
                  id="trade-credit-min-kg"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  className="tf-trade-input"
                  value={settingsForm.trial_credit_min_qty_kg}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      trial_credit_min_qty_kg: Number(e.target.value) || 1,
                    })
                  }
                />
                <span className="tf-trade-help">Minimum bulk order weight</span>
              </div>

              <div className="tf-trade-field">
                <label htmlFor="trade-credit-expiry" className="tf-trade-label">
                  Credit Expiry (days)
                </label>
                <input
                  id="trade-credit-expiry"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  className="tf-trade-input"
                  value={settingsForm.trial_credit_expiry_days}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      trial_credit_expiry_days: Number(e.target.value) || 1,
                    })
                  }
                />
                <span className="tf-trade-help">Days after trial delivery</span>
              </div>
            </div>

            <fieldset className="tf-trade-fieldset">
              <legend className="tf-trade-legend">
                <Globe size={13} aria-hidden="true" style={{ display: "inline", marginRight: 6 }} />
                Enabled Storefront Languages ({settingsForm.enabled_locales.length})
              </legend>
              <div className="tf-trade-chip-grid">
                {TRADE_LOCALE_OPTIONS.map((loc) => {
                  const checked = settingsForm.enabled_locales.includes(loc.code);
                  return (
                    <label key={loc.code} className="tf-trade-check-pill">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLocale(loc.code)}
                      />
                      <span>
                        {loc.label} ({loc.code})
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </section>

        {/* 2. Storefront Media & Video */}
        <section className="tf-trade-card">
          <div className="tf-trade-card-header">
            <div>
              <h2 className="tf-trade-card-title">
                <ImageIcon size={18} aria-hidden="true" />
                <span>Storefront Photography &amp; Video</span>
              </h2>
              <p className="tf-trade-card-desc">
                Upload new WebP/JPEG/PNG assets directly, drag and drop onto a preview frame, or pick from the Media Library.
              </p>
            </div>
          </div>

          <div className="tf-trade-grid-2">
            <TradeMediaField
              label="Hero image"
              value={settingsForm.hero_image_url}
              onChange={(url) =>
                setSettingsForm({ ...settingsForm, hero_image_url: url })
              }
              aspectRatio="16 / 9"
              recommendation="1920 × 1080 WebP. Keep the left half dark and clear for the heading; chai subject on the right. Under 350 KB recommended."
            />

            <TradeMediaField
              label="Trial pouch image"
              value={settingsForm.trial_image_url}
              onChange={(url) =>
                setSettingsForm({ ...settingsForm, trial_image_url: url })
              }
              aspectRatio="16 / 9"
              recommendation="1600 × 650 WebP, four fully visible branded pouches. Under 250 KB recommended. Weights and names are displayed from the catalogue."
            />
          </div>

          <div className="tf-trade-grid-2" style={{ marginTop: 16 }}>
            <div className="tf-trade-media-card">
              <div className="tf-trade-field">
                <label htmlFor="trade-hero-video-url" className="tf-trade-label">
                  <Film size={14} aria-hidden="true" />
                  <span>Hero Brew Video URL</span>
                  <span className="tf-trade-optional-tag">Optional</span>
                </label>
                <input
                  id="trade-hero-video-url"
                  type="text"
                  className="tf-trade-input"
                  placeholder="/uploads/brew-loop.mp4"
                  value={settingsForm.hero_video_url ?? ""}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      hero_video_url: e.target.value || null,
                    })
                  }
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                <span className="tf-trade-help">
                  MP4/WebM brew proof video shown in the trade walkthrough modal.
                </span>
              </div>
              {settingsForm.hero_video_url ? (
                <video
                  controls
                  muted
                  preload="metadata"
                  poster={settingsForm.hero_video_poster_url || undefined}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    maxHeight: 200,
                    background: "#171713",
                  }}
                >
                  <source src={settingsForm.hero_video_url} />
                </video>
              ) : null}
            </div>

            <TradeMediaField
              label="Hero video poster image"
              value={settingsForm.hero_video_poster_url ?? ""}
              onChange={(url) =>
                setSettingsForm({
                  ...settingsForm,
                  hero_video_poster_url: url || null,
                })
              }
              aspectRatio="16 / 9"
              allowClear
              optional
              recommendation="Optional still frame shown before the brew video plays. Falls back to the hero image if left empty."
            />
          </div>

          <div className="tf-trade-form-actions" style={{ marginTop: 16 }}>
            <button
              type="submit"
              className="tf-trade-btn tf-trade-btn--primary"
              disabled={saving}
            >
              <Save size={16} aria-hidden="true" />
              <span>{saving ? "Saving…" : "Save Trade Settings"}</span>
            </button>
          </div>
        </section>
      </form>

      {/* 3. Funnel Summary */}
      <section className="tf-trade-card" aria-labelledby="trade-funnel-heading">
        <div className="tf-trade-card-header">
          <div>
            <h2 id="trade-funnel-heading" className="tf-trade-card-title">
              <Activity size={18} aria-hidden="true" />
              <span>Funnel &amp; Pipeline Summary</span>
            </h2>
            <p className="tf-trade-card-desc">
              Live telemetry from /tea-shops quote calculator, checkout, and enquiry submissions.
            </p>
          </div>
        </div>

        <div className="tf-trade-grid-3">
          <div className="tf-trade-fieldset">
            <h3 style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 800 }}>
              Funnel Events
            </h3>
            {data.funnelSummary.eventCounts.length === 0 ? (
              <p className="tf-trade-help">No funnel events recorded yet.</p>
            ) : (
              <div className="tf-trade-funnel-list">
                {data.funnelSummary.eventCounts.map((ev) => {
                  const pct = Math.round((ev.count / maxEventCount) * 100);
                  return (
                    <div key={ev.event_name} className="tf-trade-funnel-row">
                      <div className="tf-trade-funnel-meta">
                        <span>{ev.event_name}</span>
                        <span>
                          {ev.count}
                          {ev.total_paise > 0
                            ? ` · ${formatRupees(ev.total_paise)}`
                            : ""}
                        </span>
                      </div>
                      <div className="tf-trade-funnel-track" aria-hidden="true">
                        <div
                          className="tf-trade-funnel-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="tf-trade-fieldset">
            <h3 style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 800 }}>
              Quote Resolution
            </h3>
            {data.funnelSummary.quoteStats.length === 0 ? (
              <p className="tf-trade-help">No quotes generated yet.</p>
            ) : (
              <div className="tf-trade-chip-grid">
                {data.funnelSummary.quoteStats.map((qs) => (
                  <span
                    key={qs.kind}
                    className={`tf-badge ${
                      qs.kind === "confirmed"
                        ? "tf-badge--ok"
                        : qs.kind === "manual"
                        ? "tf-badge--warn"
                        : "tf-badge--danger"
                    }`}
                  >
                    {qs.kind}: {qs.count}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="tf-trade-fieldset">
            <h3 style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 800 }}>
              Enquiries by Status
            </h3>
            {data.funnelSummary.enquiryStats.length === 0 ? (
              <p className="tf-trade-help">No enquiries yet.</p>
            ) : (
              <div className="tf-trade-chip-grid">
                {data.funnelSummary.enquiryStats.map((es) => (
                  <span key={es.status} className="tf-badge tf-badge--info">
                    {es.status}: {es.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
