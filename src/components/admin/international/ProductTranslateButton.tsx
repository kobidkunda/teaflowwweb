"use client";
import React, { useState } from "react";
import { LANGUAGES } from "@/lib/international/models";
import { adminRequest } from "./shared";
export function ProductTranslateButton({ productId }: { productId: number }) {
  const [locale, setLocale] = useState("hi"), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  return <div className="tf-ops-card"><h2>Translate product</h2><label>Language <select value={locale} onChange={e => setLocale(e.target.value)}>{LANGUAGES.filter(l => l.code !== "en").map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label><button type="button" disabled={busy} className="button button-primary" onClick={async () => { setBusy(true); try { await adminRequest("translate", { resources: [`product:${productId}`], locale }); setMessage("Translation queued as a draft. Review it in Translation Studio."); } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to queue translation."); } finally { setBusy(false); } }}>Translate to draft</button><a href="/admin/translations" style={{ marginInlineStart: 14 }}>Review translations →</a><p role="status">{message}</p></div>;
}
