"use client";

import React, { useMemo, useState } from "react";
import { Languages, Pencil, Save, Search, Volume2 } from "lucide-react";
import {
  TRADE_LOCALE_OPTIONS,
  type AdminTradePayload,
  type StatusToast,
} from "./types";

interface TradeContentTabProps {
  data: AdminTradePayload;
  onSaved: (toast: StatusToast) => Promise<void>;
  onError: (msg: string) => void;
}

const COMMON_KEYS = [
  "hero.title",
  "hero.intro",
  "hero.ctaTrial",
  "hero.ctaBulk",
  "trial.title",
  "calc.demand",
  "ui.pay",
  "ui.consent",
];

export function TradeContentTab({
  data,
  onSaved,
  onError,
}: TradeContentTabProps) {
  const [contentKey, setContentKey] = useState("hero.intro");
  const [contentLocale, setContentLocale] = useState("bn");
  const [contentText, setContentText] = useState("");
  const [contentAudioUrl, setContentAudioUrl] = useState("");
  const [contentTranscript, setContentTranscript] = useState("");
  const [contentStatus, setContentStatus] = useState<
    "draft" | "reviewed" | "needs_review"
  >("reviewed");
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [localeFilter, setLocaleFilter] = useState("");

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.localizedContent.filter((c) => {
      if (localeFilter && String(c.locale) !== localeFilter) return false;
      if (!q) return true;
      return `${String(c.resource_key ?? "")} ${String(c.text_value ?? "")}`
        .toLowerCase()
        .includes(q);
    });
  }, [data.localizedContent, search, localeFilter]);

  async function saveContent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/trade/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          resource_key: contentKey,
          locale: contentLocale,
          text_value: contentText,
          audio_url: contentAudioUrl.trim() || null,
          transcript: contentTranscript.trim() || null,
          review_status: contentStatus,
          updated_by: "admin",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(json.error || "Failed to save localized content.");
        return;
      }
      await onSaved({ kind: "ok", text: "Localized content saved." });
    } catch {
      onError("Network error while saving localized content.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tf-trade-stack">
      <form
        onSubmit={saveContent}
        aria-labelledby="trade-content-form-heading"
        className="tf-trade-card tf-trade-stack"
      >
        <div className="tf-trade-card-header" style={{ marginBottom: 0 }}>
          <div>
            <h2 id="trade-content-form-heading" className="tf-trade-card-title">
              <Languages size={18} aria-hidden="true" />
              <span>Update Localised Copy, Audio &amp; Transcript</span>
            </h2>
            <p className="tf-trade-card-desc">
              Attach regional voice-guide audio and transcripts. Page text is edited only in Admin → Translations.
            </p>
          </div>
        </div>

        <div className="tf-trade-grid-3">
          <div className="tf-trade-field">
            <label htmlFor="content-key" className="tf-trade-label">
              Resource Key
            </label>
            <input
              id="content-key"
              list="trade-common-keys"
              type="text"
              className="tf-trade-input"
              placeholder="e.g. hero.intro"
              value={contentKey}
              onChange={(e) => setContentKey(e.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <datalist id="trade-common-keys">
              {COMMON_KEYS.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </div>

          <div className="tf-trade-field">
            <label htmlFor="content-locale" className="tf-trade-label">
              Locale
            </label>
            <select
              id="content-locale"
              className="tf-trade-select"
              value={contentLocale}
              onChange={(e) => setContentLocale(e.target.value)}
            >
              {TRADE_LOCALE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label} ({l.code})
                </option>
              ))}
            </select>
          </div>

          <div className="tf-trade-field">
            <label htmlFor="content-status" className="tf-trade-label">
              Review Status
            </label>
            <select
              id="content-status"
              className="tf-trade-select"
              value={contentStatus}
              onChange={(e) =>
                setContentStatus(
                  e.target.value as "draft" | "reviewed" | "needs_review"
                )
              }
            >
              <option value="reviewed">Reviewed</option>
              <option value="draft">Draft</option>
              <option value="needs_review">Needs review</option>
            </select>
          </div>
        </div>

        {/* First textarea in this panel */}
        <div className="tf-trade-field">
          <label htmlFor="content-text" className="tf-trade-label">
            Translated Text
          </label>
          <textarea
            id="content-text"
            className="tf-trade-textarea"
            placeholder="Enter localized copy…"
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            required
          />
        </div>

        <div className="tf-trade-grid-2">
          <div className="tf-trade-field">
            <label htmlFor="content-audio-url" className="tf-trade-label">
              <Volume2 size={14} aria-hidden="true" />
              <span>Audio URL</span>
              <span className="tf-trade-optional-tag">Optional</span>
            </label>
            <input
              id="content-audio-url"
              type="text"
              className="tf-trade-input"
              placeholder="/audio/trade-bn-intro.mp3"
              value={contentAudioUrl}
              onChange={(e) => setContentAudioUrl(e.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            {contentAudioUrl.trim() ? (
              <audio
                controls
                preload="none"
                src={contentAudioUrl.trim()}
                style={{ width: "100%", marginTop: 6 }}
              />
            ) : null}
          </div>

          <div className="tf-trade-field">
            <label htmlFor="content-transcript" className="tf-trade-label">
              Audio Transcript
              <span className="tf-trade-optional-tag">Optional</span>
            </label>
            <textarea
              id="content-transcript"
              className="tf-trade-textarea"
              placeholder="Verbatim transcript for accessibility…"
              value={contentTranscript}
              onChange={(e) => setContentTranscript(e.target.value)}
            />
          </div>
        </div>

        <div className="tf-trade-form-actions">
          <button
            type="submit"
            className="tf-trade-btn tf-trade-btn--primary"
            disabled={saving}
          >
            <Save size={16} aria-hidden="true" />
            <span>{saving ? "Saving…" : "Save Content Override"}</span>
          </button>
        </div>
      </form>

      {/* Filter Toolbar */}
      <search className="tf-trade-toolbar">
        <div className="tf-trade-toolbar-group">
          <div className="tf-trade-search-wrap">
            <Search size={15} className="tf-trade-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="tf-trade-input tf-trade-search-input"
              aria-label="Search localized content"
              placeholder="Search by key or translated text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="tf-trade-select"
            style={{ width: "auto", minWidth: 160 }}
            aria-label="Filter by locale"
            value={localeFilter}
            onChange={(e) => setLocaleFilter(e.target.value)}
          >
            <option value="">All locales</option>
            {TRADE_LOCALE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label} ({l.code})
              </option>
            ))}
          </select>
        </div>
      </search>

      {/* Localized Content Table */}
      <div className="tf-trade-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="trade-content-table-caption"
          className="tf-trade-table-wrap"
          style={{ border: "none", borderRadius: 0 }}
        >
          <table className="tf-trade-table">
            <caption id="trade-content-table-caption">
              Localized trade copy and audio overrides
            </caption>
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Locale</th>
                <th scope="col">Status</th>
                <th scope="col">Text</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="tf-trade-empty">
                    No localized overrides match your filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((c) => {
                  const statusStr = String(c.review_status ?? "draft");
                  return (
                    <tr key={String(c.id)}>
                      <th scope="row">
                        <code>{String(c.resource_key)}</code>
                      </th>
                      <td data-label="Locale">
                        <span className="tf-badge">{String(c.locale)}</span>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`tf-badge ${
                            statusStr === "reviewed"
                              ? "tf-badge--ok"
                              : statusStr === "needs_review"
                              ? "tf-badge--warn"
                              : ""
                          }`}
                        >
                          {statusStr}
                        </span>
                      </td>
                      <td data-label="Text">
                        <div>{String(c.text_value)}</div>
                        {c.audio_url ? (
                          <div className="tf-trade-help" style={{ marginTop: 4 }}>
                            Audio: {String(c.audio_url)}
                          </div>
                        ) : null}
                      </td>
                      <td data-label="Action">
                        <button
                          type="button"
                          className="tf-trade-btn tf-trade-btn--sm"
                          onClick={() => {
                            setContentKey(String(c.resource_key ?? ""));
                            setContentLocale(String(c.locale ?? "en"));
                            setContentText(String(c.text_value ?? ""));
                            setContentAudioUrl(
                              c.audio_url ? String(c.audio_url) : ""
                            );
                            setContentTranscript(
                              c.transcript ? String(c.transcript) : ""
                            );
                            setContentStatus(
                              (statusStr as
                                | "draft"
                                | "reviewed"
                                | "needs_review") || "reviewed"
                            );
                          }}
                        >
                          <Pencil size={13} aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
