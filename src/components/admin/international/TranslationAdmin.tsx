"use client";

import React, { useEffect, useState, useMemo } from "react";
import { LANGUAGES } from "@/lib/international/models";
import type { Texts, Translation } from "@/lib/international/translations";
import { tradeDefaults } from "@/lib/trade/baseCopy";
import { adminRequest, useOperation } from "./shared";
import { PAN_INDIA_ITEMS, getLocaleDictionary } from "@/lib/international/panIndiaDictionary";
import { Search, Save, Globe, RefreshCw, CheckCircle, ArrowLeft } from "lucide-react";

type Row = {
  resource: string;
  title: string;
  source: Texts;
  translation: Translation | null;
  status: string;
  error: string | null;
  jobId?: string | null;
};

type HistoryRow = { id: string; document: string; created_ms: number };

const CONTENT_TYPES = [
  "all",
  "trade",
  "tea-traders",
  "interface",
  "homepage",
  "shell",
  "product",
  "category",
  "page",
  "blog",
  "email",
] as const;

const UI_CATEGORIES = [
  { id: "all", label: "All Strings" },
  { id: "nav", label: "Header & Navigation" },
  { id: "cart", label: "Cart & Bag" },
  { id: "checkout", label: "Checkout & Payments" },
  { id: "common", label: "Buttons & Badges" },
  { id: "forms", label: "Forms & Fields" },
  { id: "footer", label: "Footer & Legal" },
] as const;

function getContentType(resource: string): string {
  if (resource === "interface" || resource === "homepage" || resource === "shell" || resource === "trade") return resource;
  return resource.split(":")[0] || "other";
}

function getItemCategory(key: string): string {
  const panItem = PAN_INDIA_ITEMS.find((item) => item.id === key);
  if (panItem) return panItem.category;
  if (key.startsWith("nav_") || key.includes("announcement")) return "nav";
  if (key.includes("bag") || key.includes("cart") || key.includes("coupon") || key.includes("subtotal")) return "cart";
  if (key.includes("step_") || key.includes("pay") || key.includes("cod") || key.includes("checkout")) return "checkout";
  if (key.includes("policy") || key.includes("footer") || key.includes("gstin") || key.includes("terms")) return "footer";
  if (key.includes("name") || key.includes("phone") || key.includes("email") || key.includes("line") || key.includes("city") || key.includes("postcode")) return "forms";
  return "common";
}

export function TranslationAdmin() {
  const [locale, setLocale] = useState("hi");
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [edit, setEdit] = useState<Row | null>(null);
  const [texts, setTexts] = useState<Texts>({});
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [uiCategoryFilter, setUiCategoryFilter] = useState<string>("all");
  const [editorSearch, setEditorSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const op = useOperation();

  async function refresh() {
    const result = await adminRequest(`translations?locale=${locale}`);
    setRows(result.resources || []);
    setLoading(false);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("search");
      if (q) setFilter(q);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setEdit(null);
    refresh().catch((e) => {
      op.setMessage(e.message);
      setLoading(false);
    });
  }, [locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const queue = (resources: string[]) =>
    op.run(async () => {
      await adminRequest("translate", { resources, locale });
      await refresh();
    });

  const retry = (jobId?: string | null, resource?: string) =>
    op.run(async () => {
      if (jobId) await adminRequest("retry", { id: jobId });
      else if (resource) await adminRequest("translate", { resources: [resource], locale });
      await refresh();
    });

  const save = (action: "draft" | "publish" | "unpublish") =>
    op.run(async () => {
      await adminRequest("translation", {
        id: edit?.translation?.id,
        resource: edit?.resource,
        locale,
        action,
        texts,
      });
      op.setMessage(`Successfully saved and ${action}ed translations!`);
      await refresh();
      setEdit(null);
    });

  const prefillPanIndiaDefaults = () => {
    const defaults = getLocaleDictionary(locale);
    setTexts((prev) => ({ ...prev, ...defaults }));
    op.setMessage(`Pre-filled standard ${LANGUAGES.find((l) => l.code === locale)?.name} translations! Click 'Publish' to save.`);
  };

  const openEdit = (r: Row) => {
    setEdit(r);
    setEditorSearch("");
    setUiCategoryFilter("all");
    let currentTexts: Texts = {};
    if (r.translation?.draft) {
      try {
        currentTexts = JSON.parse(r.translation.draft);
      } catch {}
    } else if (r.translation?.published) {
      try {
        currentTexts = JSON.parse(r.translation.published);
      } catch {}
    }
    // If interface and empty, merge pan-india defaults
    if (r.resource === "interface" && Object.keys(currentTexts).length === 0) {
      currentTexts = getLocaleDictionary(locale);
    }
    if (r.resource === "trade") currentTexts = { ...r.source, ...tradeDefaults(locale), ...currentTexts };
    setTexts(currentTexts);

    if (r.translation?.id) {
      adminRequest(`translations?locale=${locale}&translationId=${r.translation.id}`)
        .then((res) => setHistory(res.history || []))
        .catch(() => setHistory([]));
    } else {
      setHistory([]);
    }
  };

  const filteredRows = rows.filter(
    (r) =>
      (typeFilter === "all" || getContentType(r.resource) === typeFilter) &&
      `${r.title} ${r.resource}`.toLowerCase().includes(filter.toLowerCase())
  );

  // Editor entries filter
  const editorEntries = useMemo(() => {
    if (!edit) return [];
    // If interface, show all PAN_INDIA_ITEMS first, then any other keys in edit.source
    let allKeys = Object.keys(edit.source);
    if (edit.resource === "interface") {
      const panKeys = PAN_INDIA_ITEMS.map((item) => item.id);
      allKeys = Array.from(new Set([...panKeys, ...allKeys]));
    }

    return allKeys
      .map((key) => {
        const panItem = PAN_INDIA_ITEMS.find((item) => item.id === key);
        const englishSource = panItem?.en || edit.source[key] || key;
        const currentTranslation = texts[key] || (panItem as unknown as Record<string, string>)?.[locale] || "";
        const cat = getItemCategory(key);
        return { key, englishSource, currentTranslation, cat };
      })
      .filter((entry) => {
        const matchesCategory = uiCategoryFilter === "all" || entry.cat === uiCategoryFilter;
        const query = editorSearch.toLowerCase().trim();
        const matchesSearch =
          !query ||
          entry.key.toLowerCase().includes(query) ||
          entry.englishSource.toLowerCase().includes(query) ||
          entry.currentTranslation.toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
      });
  }, [edit, texts, locale, uiCategoryFilter, editorSearch]);

  const currentLangObj = LANGUAGES.find((l) => l.code === locale);

  return (
    <div className="tf-ops">
      <div className="tf-ops-heading">
        <div className="flex items-center gap-3">
          <Globe className="text-[#23483a]" size={32} />
          <div>
            <p className="eyebrow">PAN-INDIA & MULTILINGUAL STUDIO</p>
            <h1>Storefront Language Translations</h1>
          </div>
        </div>
        <p className="mt-2 text-[#46524a]">
          Translate and customize storefront navigation, shopping bag, checkout steps, announcements, buttons, and legal footer across India. Products and tea provenance dossiers remain in English.
        </p>
      </div>

      <p role="status" className="font-semibold text-[#23483a] my-2">
        {op.message}
      </p>

      {!edit ? (
        <section className="tf-ops-card">
          <div className="tf-market-pair">
            <label>
              <strong>Active Language:</strong>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="font-medium text-base"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} ({l.code.toUpperCase()})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <strong>Find Resource or Page:</strong>
              <input
                type="search"
                placeholder="e.g. interface, shell, homepage..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
          </div>

          <div style={{ margin: "14px 0" }}>
            <strong>Content Type: </strong>
            <div className="tf-ops-badges" style={{ display: "inline-flex", gap: "6px", margin: 0 }}>
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  style={{
                    background: typeFilter === t ? "#23483a" : "#ede9dd",
                    color: typeFilter === t ? "#fff" : "#171713",
                    border: "1px solid #d7d0bf",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  {t} ({t === "all" ? rows.length : rows.filter((r) => getContentType(r.resource) === t).length})
                </button>
              ))}
            </div>
          </div>

          <div className="tf-ops-badges">
            {["published", "draft", "missing", "queued", "processing", "stale", "failed"].map((s) => (
              <span key={s} data-ready={s === "published"}>
                {s}: {rows.filter((r) => r.status === s).length}
              </span>
            ))}
          </div>

          <div className="tf-ops-actions">
            <button
              disabled={op.busy || !selected.length}
              onClick={() => queue(selected)}
              className="button"
            >
              Translate Selected via AI
            </button>
            <button
              disabled={op.busy}
              onClick={() => op.run(refresh)}
              className="button"
            >
              <RefreshCw size={14} className="inline mr-1" />
              Refresh Coverage
            </button>
          </div>

          {loading ? (
            <p>Loading translation resources…</p>
          ) : (
            <div className="tf-ops-table">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>Select</th>
                    <th>Type</th>
                    <th>Content Resource</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.resource}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.title}`}
                          checked={selected.includes(r.resource)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, r.resource]
                                : selected.filter((v) => v !== r.resource)
                            )
                          }
                        />
                      </td>
                      <td>
                        <small>{getContentType(r.resource)}</small>
                      </td>
                      <td>
                        <strong>{r.title}</strong>
                        <small className="text-[#64748b]">{r.resource}</small>
                      </td>
                      <td>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            r.status === "published"
                              ? "bg-green-100 text-green-800"
                              : r.status === "draft"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.error && <small className="text-red-600">{r.error}</small>}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="button font-semibold"
                            style={{ background: "#23483a", color: "#fff", padding: "6px 12px" }}
                          >
                            Edit & Publish
                          </button>
                          {r.status === "failed" && (
                            <button
                              disabled={op.busy}
                              onClick={() => retry(r.jobId, r.resource)}
                              className="button"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        /* Translation Editor View */
        <section className="tf-ops-card">
          <div className="flex items-center justify-between border-b border-[#d7d5c7] pb-4 mb-4">
            <button
              type="button"
              onClick={() => setEdit(null)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#23483a] hover:underline"
            >
              <ArrowLeft size={16} /> Back to Resource List
            </button>
            <div className="flex items-center gap-2">
              {edit.resource === "interface" && (
                <button
                  type="button"
                  onClick={prefillPanIndiaDefaults}
                  className="button text-xs"
                  style={{ background: "#e9f2eb", color: "#23483a", border: "1px solid #23483a" }}
                  title="Loads recommended translations for this language"
                >
                  Load Pan-India Defaults
                </button>
              )}
              <button
                type="button"
                disabled={op.busy}
                onClick={() => save("publish")}
                className="button font-semibold flex items-center gap-1.5"
                style={{ background: "#23483a", color: "#fff" }}
              >
                <Save size={14} /> Publish Translations
              </button>
            </div>
          </div>

          <div className="mb-4">
            <h2>
              {edit.title} ({edit.resource}) — {currentLangObj?.name}
            </h2>
            <p className="text-sm text-[#57534e]">
              Directly edit or customize translations below. Missing phrases automatically fallback to English on the storefront.
            </p>
          </div>

          {/* Section Category Filters */}
          {edit.resource === "interface" && (
            <div className="flex flex-wrap gap-2 mb-4">
              {UI_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setUiCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    uiCategoryFilter === cat.id
                      ? "bg-[#23483a] text-white border-[#23483a]"
                      : "bg-[#f5f2ea] text-[#1d2a24] border-[#d7d0bf] hover:bg-[#eae4d3]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Search Box in Editor */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                placeholder="Search phrase in English or translation..."
                value={editorSearch}
                onChange={(e) => setEditorSearch(e.target.value)}
                className="pl-9 text-sm"
                style={{ width: "100%", paddingLeft: "34px" }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Showing {editorEntries.length} phrase(s)
            </p>
          </div>

          {/* Dictionary Edit Rows */}
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 border border-[#e5e0d4] rounded-lg p-3 bg-white">
            {editorEntries.length === 0 ? (
              <p className="p-4 text-center text-gray-500">
                No matching phrases found for &quot;{editorSearch}&quot;.
              </p>
            ) : (
              editorEntries.map((entry) => (
                <div
                  key={entry.key}
                  className="p-3 border-b border-[#f0ece1] last:border-b-0 grid grid-cols-1 md:grid-cols-2 gap-4 items-center"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono bg-[#f4f2ea] px-1.5 py-0.5 rounded text-gray-600">
                        {entry.key}
                      </span>
                      <span className="text-[10px] uppercase font-semibold text-gray-400">
                        {entry.cat}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {entry.englishSource}
                    </p>
                  </div>

                  <div>
                    <input
                      type="text"
                      lang={locale}
                      dir={currentLangObj?.dir || "ltr"}
                      placeholder={`Translate to ${currentLangObj?.name}...`}
                      value={texts[entry.key] || ""}
                      onChange={(e) =>
                        setTexts((prev) => ({ ...prev, [entry.key]: e.target.value }))
                      }
                      className="w-full text-sm font-medium"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Actions */}
          <div className="tf-ops-actions mt-4 pt-4 border-t border-[#d7d5c7] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setEdit(null)}
              className="button"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={op.busy}
                onClick={() => save("draft")}
                className="button"
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={op.busy}
                onClick={() => save("publish")}
                className="button font-semibold flex items-center gap-1.5"
                style={{ background: "#23483a", color: "#fff" }}
              >
                <CheckCircle size={14} /> Publish Reviewed Translations
              </button>
            </div>
          </div>

          {/* Revision History */}
          {history.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[#d7d5c7]">
              <h3 className="font-semibold text-base mb-2">Revision History</h3>
              <div className="tf-ops-table">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Revision</th>
                      <th>Snapshot</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      let doc: { revision?: number; draft?: string; published?: string } = {};
                      try {
                        doc = JSON.parse(h.document);
                      } catch {}
                      return (
                        <tr key={h.id}>
                          <td>{new Date(h.created_ms).toLocaleString()}</td>
                          <td>Rev {doc.revision ?? "?"}</td>
                          <td>
                            <small>
                              {doc.published ? "Published version" : doc.draft ? "Draft version" : "Snapshot"}
                            </small>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => {
                                const snap = doc.draft || doc.published;
                                if (snap) {
                                  try {
                                    setTexts(JSON.parse(snap));
                                    op.setMessage(`Loaded text from Rev ${doc.revision}`);
                                  } catch {}
                                }
                              }}
                            >
                              Load Revision
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
