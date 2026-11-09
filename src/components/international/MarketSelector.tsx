"use client";
import React, { useRef, useState, useEffect, useId } from "react";
import { Globe2, X } from "lucide-react";
import { useInternational } from "./InternationalProvider";
export function MarketSelector() {
  const ctx = useInternational(), dialog = useRef<HTMLDialogElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const titleId = useId();
  useEffect(() => setHydrated(true), []);
  const [search, setSearch] = useState(""), [country, setCountry] = useState(ctx?.country || "IN"), [currency, setCurrency] = useState(ctx?.currency || "INR"), [locale, setLocale] = useState(ctx?.locale || "en"), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  if (!ctx) return <span>India (INR ₹)</span>;
  const t = (key: string) => ctx.texts[key] || key;
  const selected = ctx.markets.find(m => m.code === country);
  const currencies = Array.from(new Set(["INR", ctx.currency, currency, ...ctx.markets.map(m => m.currency), ...Object.keys(ctx.rates)])).sort();
  async function save() {
    setBusy(true); setStatus("");
    try {
      const r = await fetch("/api/commerce/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country, currency, locale }) });
      const result = await r.json(); if (!r.ok) throw new Error(result.error);
      const path = window.location.pathname.replace(/^\/(hi|bn|ar|fr|de|es|pt|ja|zh-CN)(?=\/|$)/, "") || "/";
      window.location.assign(`${locale === "en" ? "" : `/${locale}`}${path}${window.location.search}`);
    } catch (e) { setStatus(e instanceof Error ? e.message : "Unable to save preferences."); setBusy(false); }
  }
  return <>
    <button className="tf-market-trigger" disabled={!hydrated} type="button" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()} aria-label={`${t("deliver")} ${ctx.country} · ${ctx.currency} · ${ctx.locale}${ctx.rateStale && ctx.currency !== "INR" ? " · browsing estimate" : ""}`}><Globe2 size={15} aria-hidden="true" /><span>{ctx.country} · {ctx.currency} · {ctx.locale.toUpperCase()}{ctx.rateStale && ctx.currency !== "INR" ? " (est.)" : ""}</span></button>
    <dialog ref={dialog} className="tf-market-dialog" aria-labelledby={titleId} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); dialog.current?.close(); } }} onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}>
      <div className="tf-market-inner"><button type="button" className="tf-market-close" aria-label={t("close")} onClick={() => dialog.current?.close()}><X size={22} /></button>
        <p className="eyebrow">TEAFLOWW · A WORLD OF TEA</p><h2 id={titleId}>{t("deliver")}</h2>
        <label>{t("search")}<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <label>{t("country")}<select value={country} onChange={e => setCountry(e.target.value)}>{!ctx.markets.some(m => m.code === country) && <option value={country}>{country} — browsing only</option>}{ctx.markets.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.code === country).map(m => <option key={m.code} value={m.code}>{m.name}{m.available ? "" : " · browsing only"}</option>)}</select></label>
        <div className="tf-market-pair"><label>{t("currency")}<select value={currency} onChange={e => setCurrency(e.target.value)}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>{t("language")}<select value={locale} onChange={e => setLocale(e.target.value)}>{ctx.languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label></div>
        {!selected?.available && <p className="tf-market-note">{t("unavailable")}</p>}
        {ctx.rateStale && ctx.currency !== "INR" && <p className="tf-market-note" style={{ color: "#8a5314", background: "#fef3c7", padding: "8px 12px", borderRadius: "6px" }}>Exchange rates are awaiting provider refresh; prices shown are browsing estimates.</p>}
        <p className="tf-market-note">{currency !== "INR" && !ctx.rates[currency] ? "Conversion unavailable; prices remain in INR. " : ""}Delivery and the payable currency are confirmed before payment.</p>
        <p role="status">{status}</p><button type="button" className="button button-primary" disabled={busy} onClick={save}>{busy ? t("loading") : t("save")}</button>
      </div>
    </dialog>
  </>;
}
