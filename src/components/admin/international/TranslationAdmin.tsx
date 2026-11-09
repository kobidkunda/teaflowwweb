"use client";
import React, { useEffect, useState } from "react";
import { LANGUAGES } from "@/lib/international/models";
import type { Texts, Translation } from "@/lib/international/translations";
import { adminRequest, useOperation } from "./shared";
type Row = { resource: string; title: string; source: Texts; translation: Translation | null; status: string; error: string | null; jobId?: string | null };
type HistoryRow = { id: string; document: string; created_ms: number };
const CONTENT_TYPES = ["all", "product", "category", "page", "blog", "email", "interface", "homepage"] as const;
function getContentType(resource: string): string {
  if (resource === "interface" || resource === "homepage") return resource;
  return resource.split(":")[0] || "other";
}
export function TranslationAdmin() {
  const [locale, setLocale] = useState("hi"), [rows, setRows] = useState<Row[]>([]), [selected, setSelected] = useState<string[]>([]), [edit, setEdit] = useState<Row | null>(null), [texts, setTexts] = useState<Texts>({}), [history, setHistory] = useState<HistoryRow[]>([]), [filter, setFilter] = useState(""), [typeFilter, setTypeFilter] = useState<string>("all"), [loading, setLoading] = useState(true);
  const op = useOperation();
  async function refresh() { const result = await adminRequest(`translations?locale=${locale}`); setRows(result.resources); setLoading(false); }
  useEffect(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("search");
      if (q) setFilter(q);
    }
  }, []);
  useEffect(() => { setLoading(true); setEdit(null); refresh().catch(e => { op.setMessage(e.message); setLoading(false); }); }, [locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const queue = (resources: string[]) => op.run(async () => { await adminRequest("translate", { resources, locale }); await refresh(); });
  const retry = (jobId?: string | null, resource?: string) => op.run(async () => { if (jobId) await adminRequest("retry", { id: jobId }); else if (resource) await adminRequest("translate", { resources: [resource], locale }); await refresh(); });
  const save = (action: "draft" | "publish" | "unpublish") => op.run(async () => { await adminRequest("translation", { id: edit?.translation?.id, action, texts }); await refresh(); setEdit(null); });
  const openEdit = (r: Row) => {
    setEdit(r);
    setTexts(r.translation?.draft ? JSON.parse(r.translation.draft) : r.translation?.published ? JSON.parse(r.translation.published) : r.source);
    if (r.translation?.id) {
      adminRequest(`translations?locale=${locale}&translationId=${r.translation.id}`).then(res => setHistory(res.history || [])).catch(() => setHistory([]));
    } else { setHistory([]); }
  };
  const filteredRows = rows.filter(r => (typeFilter === "all" || getContentType(r.resource) === typeFilter) && `${r.title} ${r.resource}`.toLowerCase().includes(filter.toLowerCase()));
  return <div className="tf-ops"><div className="tf-ops-heading"><p className="eyebrow">LANGUAGE STUDIO</p><h1>Words that travel.</h1><p>Generate translations once, review every claim, and publish when ready. English remains the fallback.</p></div>
    <p role="status">{op.message}</p><section className="tf-ops-card"><div className="tf-market-pair"><label>Translation language<select value={locale} onChange={e => setLocale(e.target.value)}>{LANGUAGES.filter(l => l.code !== "en").map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label><label>Find a page or product<input type="search" value={filter} onChange={e => setFilter(e.target.value)} /></label></div>
    <div style={{ margin: "14px 0" }}><strong>Content type: </strong><div className="tf-ops-badges" style={{ display: "inline-flex", gap: "6px", margin: 0 }}>{CONTENT_TYPES.map(t => <button key={t} type="button" onClick={() => setTypeFilter(t)} style={{ background: typeFilter === t ? "#23483a" : "#ede9dd", color: typeFilter === t ? "#fff" : "#171713", border: "1px solid #d7d0bf", padding: "4px 8px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }}>{t} ({t === "all" ? rows.length : rows.filter(r => getContentType(r.resource) === t).length})</button>)}</div></div>
    <div className="tf-ops-badges">{["missing", "queued", "processing", "draft", "published", "stale", "failed"].map(s => <span key={s}>{s}: {rows.filter(r => r.status === s).length}</span>)}</div><div className="tf-ops-actions"><button disabled={op.busy || !selected.length} onClick={() => queue(selected)}>Translate selected</button><button disabled={op.busy} onClick={() => op.run(refresh)}>Refresh progress</button></div>
    {loading ? <p>Loading translation coverage…</p> : <div className="tf-ops-table"><table><thead><tr><th>Select</th><th>Type</th><th>Content</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredRows.map(r => <tr key={r.resource}><td><input type="checkbox" aria-label={`Select ${r.title}`} checked={selected.includes(r.resource)} onChange={e => setSelected(e.target.checked ? [...selected, r.resource] : selected.filter(v => v !== r.resource))} /></td><td><small>{getContentType(r.resource)}</small></td><td>{r.title}<small>{r.resource}</small></td><td>{r.status}<small>{r.error}</small></td><td>{r.status === "failed" ? <button disabled={op.busy} onClick={() => retry(r.jobId, r.resource)}>Retry</button> : <button disabled={op.busy || ["queued", "processing"].includes(r.status)} onClick={() => queue([r.resource])}>Translate</button>}<button disabled={!r.translation} onClick={() => openEdit(r)}>Review & edit</button></td></tr>)}</tbody></table></div>}</section>
    {edit && <section className="tf-ops-card"><h2>{edit.title} ({edit.resource})</h2><p>Compare source and translation. Numbers, units, brands and placeholders must remain unchanged. Policy translations require a human review before publication.</p>{Object.entries(edit.source).map(([key, value]) => <div className="tf-translation-row" key={key}><div lang="en"><strong>{key}</strong><p>{value}</p></div><label>{LANGUAGES.find(l => l.code === locale)?.name}<textarea lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} rows={Math.min(8, Math.max(2, Math.ceil(value.length / 70)))} value={texts[key] || ""} onChange={e => setTexts({ ...texts, [key]: e.target.value })} /></label></div>)}<div className="tf-ops-actions"><button disabled={op.busy} onClick={() => save("draft")}>Save draft</button><button disabled={op.busy} onClick={() => save("publish")}>Publish reviewed translation</button><button disabled={op.busy} onClick={() => save("unpublish")}>Unpublish</button><button onClick={() => setEdit(null)}>Close editor</button></div>
    {history.length > 0 && <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #d7d5c7" }}><h3>Revision history</h3><div className="tf-ops-table"><table><thead><tr><th>Time</th><th>Revision</th><th>Snapshot</th><th>Action</th></tr></thead><tbody>{history.map(h => { let doc: { revision?: number; draft?: string; published?: string } = {}; try { doc = JSON.parse(h.document); } catch {} return <tr key={h.id}><td>{new Date(h.created_ms).toLocaleString()}</td><td>Rev {doc.revision ?? "?"}</td><td><small>{doc.published ? "Published version" : doc.draft ? "Draft version" : "Snapshot"}</small></td><td><button type="button" onClick={() => { const snap = doc.draft || doc.published; if (snap) { try { setTexts(JSON.parse(snap)); op.setMessage(`Loaded text from Rev ${doc.revision}`); } catch {} } }}>Load revision</button></td></tr>; })}</tbody></table></div></div>}
    </section>}
  </div>;
}
