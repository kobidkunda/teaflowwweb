"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  Rocket,
  RotateCcw,
  Info,
} from "lucide-react";

interface PreviewError {
  row: number;
  variant_id: number | null;
  sku: string | null;
  field: string;
  message: string;
}

interface PreviewChange {
  variant_id: number;
  sku: string;
  product_name: string;
  grams: number;
  packaging_format: string;
  oldPricePaise: number;
  newPricePaise: number;
  oldMrpPaise: number | null;
  newMrpPaise: number | null;
  oldStock: number;
  newStock: number;
  oldDiscountPct: number;
  newDiscountPct: number;
  fields: string[];
  warnings: string[];
}

interface Preview {
  totalRows: number;
  changeCount: number;
  unchangedCount: number;
  errorCount: number;
  errors: PreviewError[];
  changes: PreviewChange[];
  gstRatePercent: number;
}

type Phase = "idle" | "verifying" | "previewed" | "publishing" | "published";

function formatInr(paise: number | null): string {
  if (paise == null) return "—";
  const inr = paise / 100;
  return `₹${inr.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(inr) ? 0 : 2 })}`;
}

const COLUMN_GUIDE: Array<{ name: string; mode: string; hint: string }> = [
  { name: "variant_id", mode: "Do not change", hint: "Row identity. Never edit or reorder." },
  { name: "sku", mode: "Do not change", hint: "Must match the template or the row is rejected." },
  { name: "product_name", mode: "Read-only", hint: "Reference only — ignored on upload." },
  { name: "product_slug", mode: "Read-only", hint: "Reference only — ignored on upload." },
  { name: "grams", mode: "Read-only", hint: "Pack size — ignored on upload." },
  { name: "packaging_format", mode: "Read-only", hint: "Pack format — ignored on upload." },
  { name: "price_inr", mode: "Editable", hint: "GST-inclusive selling price, e.g. 199 or 199.50." },
  { name: "mrp_inr", mode: "Editable", hint: "Strike-through MRP. Empty clears the discount badge." },
  { name: "discount_percent", mode: "Read-only", hint: "Recomputed from price vs MRP — ignored on upload." },
  { name: "stock", mode: "Editable", hint: "Whole units on hand. 0 hides the buy option." },
  { name: "gst_rate_percent", mode: "Read-only", hint: "Store GST rate — ignored on upload." },
  { name: "gst_amount_inr", mode: "Read-only", hint: "Tax already inside the price — ignored on upload." },
];

export default function AdminBulkPricingPage() {
  return (
    <AdminAuthGate>
      <BulkPricingContent />
    </AdminAuthGate>
  );
}

function BulkPricingContent() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [changesFilter, setChangesFilter] = useState<"all" | "warnings">("all");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const confirmId = useId();

  useEffect(() => {
    if (phase === "previewed" && preview && preview.errorCount > 0) {
      errorSummaryRef.current?.focus();
    } else if (phase === "previewed" || phase === "published") {
      statusRef.current?.focus();
    }
  }, [phase, preview]);

  const downloadTemplate = useCallback(async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/admin/bulk-pricing/template", { credentials: "same-origin" });
      if (res.status === 401) throw new Error("Your session expired. Sign in again, then retry the download.");
      if (!res.ok) throw new Error("Could not build the template. Check your connection and try again.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bulk-pricing-template.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Download failed. Try again.");
    } finally {
      setDownloading(false);
    }
  }, []);

  const pickFile = useCallback((f: File | null) => {
    setFile(f);
    setFormError(null);
    setPreview(null);
    setPublishError(null);
    setAppliedCount(0);
    setConfirmed(false);
    setPhase("idle");
  }, []);

  const verifyUpload = useCallback(async () => {
    if (!file) {
      setFormError("Choose the edited CSV file first.");
      fileInputRef.current?.focus();
      return;
    }
    setPhase("verifying");
    setFormError(null);
    setPublishError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/bulk-pricing/preview", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      if (res.status === 401) throw new Error("Your session expired. Sign in again, then retry the upload.");
      const data = (await res.json().catch(() => null)) as { preview?: Preview; error?: string } | null;
      if (!res.ok || !data?.preview) {
        const detail = (data as { detail?: { file?: string[] } } | null)?.detail?.file?.[0];
        throw new Error(detail || (data?.error ?? "Verification failed. Check the file and try again."));
      }
      setPreview(data.preview);
      setIdempotencyKey(crypto.randomUUID());
      setConfirmed(false);
      setPhase("previewed");
    } catch (e) {
      setPhase("idle");
      setFormError(e instanceof Error ? e.message : "Verification failed. Try again.");
    }
  }, [file]);

  const publishChanges = useCallback(async () => {
    if (!preview || preview.errorCount > 0 || preview.changeCount === 0 || !idempotencyKey) return;
    setPhase("publishing");
    setPublishError(null);
    try {
      const res = await fetch("/api/admin/bulk-pricing/apply", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: preview.changes.map((c) => ({
            variant_id: c.variant_id,
            price_paise: c.newPricePaise,
            compare_at_price_paise: c.newMrpPaise,
            stock: c.newStock,
          })),
          idempotencyKey,
        }),
      });
      if (res.status === 401) throw new Error("Your session expired. Sign in again, then retry publishing.");
      const data = (await res.json().catch(() => null)) as { applied?: number; error?: string } | null;
      if (!res.ok || typeof data?.applied !== "number") {
        throw new Error(data?.error ?? "Publishing failed. Nothing was changed — try again.");
      }
      setAppliedCount(data.applied);
      setPhase("published");
    } catch (e) {
      setPhase("previewed");
      setPublishError(e instanceof Error ? e.message : "Publishing failed. Nothing was changed.");
    }
  }, [preview, idempotencyKey]);

  const resetAll = useCallback(() => {
    setFile(null);
    setPreview(null);
    setFormError(null);
    setPublishError(null);
    setAppliedCount(0);
    setConfirmed(false);
    setChangesFilter("all");
    setPhase("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const stepIndex = phase === "idle" || phase === "verifying" ? 2 : phase === "previewed" ? 3 : 4;
  const visibleChanges =
    preview == null
      ? []
      : changesFilter === "warnings"
        ? preview.changes.filter((c) => c.warnings.length > 0)
        : preview.changes;

  return (
    <div className="bulk-pricing-root">
      {/* Header */}
      <div className="bulk-header">
        <div>
          <p className="eyebrow">Storefront &amp; Catalog</p>
          <h1>Bulk Pricing Update</h1>
          <p className="lede">
            Download the live price sheet, edit prices, MRPs and stock in your spreadsheet app, upload it for
            verification, then publish. Nothing goes live until you confirm the preview.
          </p>
        </div>
        <Link href="/admin/variants" className="button button-outline bulk-head-link">
          <Eye size={15} aria-hidden="true" />
          <span>View variants</span>
        </Link>
      </div>

      {/* Stepper */}
      <ol className="bulk-steps" aria-label="Bulk pricing steps">
        {["Download template", "Edit the CSV", "Upload & verify", "Preview", "Publish live"].map((label, i) => {
          const n = i + 1;
          const done = n <= stepIndex || (phase === "published" && n <= 5);
          const current = (n === 3 && (phase === "idle" || phase === "verifying")) || (n === 4 && phase === "previewed") || (n === 5 && (phase === "publishing" || phase === "published"));
          return (
            <li key={label} className={`bulk-step${done ? " is-done" : ""}${current ? " is-current" : ""}`} aria-current={current ? "step" : undefined}>
              <span className="bulk-step-num" aria-hidden="true">{done && !current ? "✓" : n}</span>
              <span className="bulk-step-label">{label}</span>
            </li>
          );
        })}
      </ol>

      <div ref={statusRef} tabIndex={-1} className="sr-only" aria-live="polite">
        {phase === "previewed" && preview
          ? `Verification complete: ${preview.changeCount} changes, ${preview.errorCount} errors.`
          : phase === "published"
            ? `Published ${appliedCount} SKU updates live.`
            : ""}
      </div>

      {/* Step 1 — Download */}
      <section className="bulk-card" aria-labelledby="bulk-dl-heading">
        <div className="bulk-card-head">
          <FileSpreadsheet size={20} aria-hidden="true" />
          <div>
            <h2 id="bulk-dl-heading">1. Download the live template</h2>
            <p>One row per SKU with current prices, MRPs, discount and stock. Prices are GST-inclusive.</p>
          </div>
        </div>
        {downloadError && (
          <p className="bulk-inline-error" role="alert">
            <XCircle size={15} aria-hidden="true" /> {downloadError}
          </p>
        )}
        <div className="bulk-row">
          <button type="button" onClick={() => void downloadTemplate()} disabled={downloading} className="button button-primary bulk-btn">
            <Download size={16} aria-hidden="true" />
            <span>{downloading ? "Preparing…" : "Download template (.csv)"}</span>
          </button>
          <p className="bulk-hint">Tip: after publishing, download again — the sheet always reflects live values.</p>
        </div>
        <div className="bulk-table-wrap">
          <table className="admin-table bulk-guide-table">
            <caption>What each column means and whether you may edit it</caption>
            <thead>
              <tr>
                <th scope="col">Column</th>
                <th scope="col">Edit?</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {COLUMN_GUIDE.map((c) => (
                <tr key={c.name}>
                  <td><code>{c.name}</code></td>
                  <td>
                    <span className={`bulk-pill ${c.mode === "Editable" ? "is-edit" : "is-ro"}`}>
                      {c.mode}
                    </span>
                  </td>
                  <td>{c.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Step 2+3 — Upload & verify */}
      <section className="bulk-card" aria-labelledby="bulk-up-heading">
        <div className="bulk-card-head">
          <Upload size={20} aria-hidden="true" />
          <div>
            <h2 id="bulk-up-heading">2. Upload the edited CSV for verification</h2>
            <p>Verification never changes live data — it only previews what would change.</p>
          </div>
        </div>
        <div
          className={`bulk-drop${isDragging ? " is-drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) pickFile(f);
          }}
        >
          <label htmlFor="bulk-file-input" className="bulk-drop-label">
            <strong>{file ? file.name : "Drop your .csv here, or click to choose a file"}</strong>
            <span>{file ? `${(file.size / 1024).toFixed(1)} KB — ready to verify` : "Comma-separated values, up to 1000 SKUs / 1 MB"}</span>
          </label>
          <input
            ref={fileInputRef}
            id="bulk-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {formError && (
          <p className="bulk-inline-error" role="alert">
            <XCircle size={15} aria-hidden="true" /> {formError}
          </p>
        )}
        <div className="bulk-row">
          <button
            type="button"
            onClick={() => void verifyUpload()}
            disabled={!file || phase === "verifying"}
            className="button button-primary bulk-btn"
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{phase === "verifying" ? "Verifying…" : "Verify & preview changes"}</span>
          </button>
          {(file || preview) && (
            <button type="button" onClick={resetAll} className="button button-outline bulk-btn">
              <RotateCcw size={15} aria-hidden="true" />
              <span>Start over</span>
            </button>
          )}
        </div>
      </section>

      {/* Step 4 — Preview */}
      {phase !== "idle" && phase !== "verifying" && preview && (
        <section className="bulk-card" aria-labelledby="bulk-prev-heading">
          <div className="bulk-card-head">
            <Eye size={20} aria-hidden="true" />
            <div>
              <h2 id="bulk-prev-heading">3. Review the preview</h2>
              <p>
                {preview.totalRows} rows read · {preview.changeCount} to update · {preview.unchangedCount} unchanged ·{" "}
                {preview.errorCount} errors · GST {preview.gstRatePercent}% (inclusive)
              </p>
            </div>
          </div>

          {preview.errorCount > 0 && (
            <div ref={errorSummaryRef} tabIndex={-1} className="bulk-error-summary" role="alert" aria-labelledby="bulk-err-title">
              <h3 id="bulk-err-title">
                <AlertTriangle size={17} aria-hidden="true" /> {preview.errorCount} problem{preview.errorCount === 1 ? "" : "s"} to fix before publishing
              </h3>
              <p>
                Fix these in your spreadsheet and upload again. Publishing stays disabled until every error is
                resolved — nothing is live yet.
              </p>
              <ul>
                {preview.errors.slice(0, 50).map((e, i) => (
                  <li key={`${e.row}-${e.field}-${i}`}>
                    <a href={`#bulk-row-${e.row}`}>
                      Row {e.row}
                    </a>
                    {" · "}
                    <strong>{e.field}</strong> — {e.message}
                  </li>
                ))}
              </ul>
              {preview.errors.length > 50 && <p>Showing 50 of {preview.errors.length} errors.</p>}
            </div>
          )}

          {preview.changeCount === 0 && preview.errorCount === 0 && (
            <p className="bulk-note" role="status">
              <Info size={15} aria-hidden="true" /> No changes detected — every editable value already matches the live
              catalogue. Edit the CSV and verify again, or start over.
            </p>
          )}

          {preview.changes.length > 0 && (
            <>
              <div className="bulk-kpis" role="list" aria-label="Preview summary">
                <div className="bulk-kpi" role="listitem"><span>{preview.changeCount}</span> SKUs to update</div>
                <div className="bulk-kpi" role="listitem"><span>{preview.changes.filter((c) => c.fields.includes("price_inr")).length}</span> price changes</div>
                <div className="bulk-kpi" role="listitem"><span>{preview.changes.filter((c) => c.fields.includes("mrp_inr")).length}</span> MRP changes</div>
                <div className="bulk-kpi" role="listitem"><span>{preview.changes.filter((c) => c.warnings.length > 0).length}</span> flagged for review</div>
              </div>
              <div className="bulk-row bulk-filter-row">
                <label htmlFor="bulk-changes-filter">Show:</label>
                <select id="bulk-changes-filter" value={changesFilter} onChange={(e) => setChangesFilter(e.target.value as "all" | "warnings")}>
                  <option value="all">All changes ({preview.changes.length})</option>
                  <option value="warnings">Flagged only ({preview.changes.filter((c) => c.warnings.length > 0).length})</option>
                </select>
              </div>
              <div className="bulk-table-wrap">
                <table className="admin-table">
                  <caption>Proposed changes — old live value → new value</caption>
                  <thead>
                    <tr>
                      <th scope="col">SKU</th>
                      <th scope="col">Price</th>
                      <th scope="col">MRP</th>
                      <th scope="col">Discount</th>
                      <th scope="col">Stock</th>
                      <th scope="col">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleChanges.map((c) => (
                      <tr key={c.variant_id}>
                        <td>
                          <strong>{c.sku}</strong>
                          <div className="bulk-sub">{c.product_name} · {c.grams}g</div>
                        </td>
                        <td>
                          <span className="bulk-old">{formatInr(c.oldPricePaise)}</span>
                          <span className="bulk-arrow" aria-hidden="true"> → </span>
                          <strong className={c.fields.includes("price_inr") ? "bulk-new" : ""}>{formatInr(c.newPricePaise)}</strong>
                        </td>
                        <td>
                          <span className="bulk-old">{formatInr(c.oldMrpPaise)}</span>
                          <span className="bulk-arrow" aria-hidden="true"> → </span>
                          <strong className={c.fields.includes("mrp_inr") ? "bulk-new" : ""}>{formatInr(c.newMrpPaise)}</strong>
                        </td>
                        <td>{c.oldDiscountPct}% → <strong>{c.newDiscountPct}%</strong></td>
                        <td>
                          <span className="bulk-old">{c.oldStock}</span>
                          <span className="bulk-arrow" aria-hidden="true"> → </span>
                          <strong className={c.fields.includes("stock") ? "bulk-new" : ""}>{c.newStock}</strong>
                        </td>
                        <td>
                          {c.warnings.length === 0 ? (
                            <span className="bulk-sub">—</span>
                          ) : (
                            <ul className="bulk-warn-list">
                              {c.warnings.map((w, i) => (
                                <li key={i}><AlertTriangle size={13} aria-hidden="true" /> {w}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {preview.errors.length > 0 && (
            <div className="bulk-table-wrap">
              <table className="admin-table bulk-error-table">
                <caption>Row-level errors — fix in the CSV and re-upload</caption>
                <thead>
                  <tr>
                    <th scope="col">Row</th>
                    <th scope="col">Variant</th>
                    <th scope="col">Field</th>
                    <th scope="col">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((e, i) => (
                    <tr key={`${e.row}-${e.field}-${i}`} id={`bulk-row-${e.row}`}>
                      <td>{e.row}</td>
                      <td>{e.variant_id != null ? `#${e.variant_id}` : "—"}{e.sku ? ` · ${e.sku}` : ""}</td>
                      <td><code>{e.field}</code></td>
                      <td>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Step 5 — Publish */}
      {preview && (phase === "previewed" || phase === "publishing" || phase === "published") && (
        <section className="bulk-card bulk-publish" aria-labelledby="bulk-pub-heading">
          <div className="bulk-card-head">
            <Rocket size={20} aria-hidden="true" />
            <div>
              <h2 id="bulk-pub-heading">4. Publish live</h2>
              <p>Applies all {preview.changeCount} changes at once. This cannot be undone in bulk — the template is your audit trail.</p>
            </div>
          </div>
          {publishError && (
            <p className="bulk-inline-error" role="alert">
              <XCircle size={15} aria-hidden="true" /> {publishError}
            </p>
          )}
          {phase === "published" ? (
            <p className="bulk-success" role="status">
              <CheckCircle2 size={17} aria-hidden="true" /> {appliedCount} SKU{appliedCount === 1 ? "" : "s"} published
              live. Prices update on the storefront immediately.
              {" "}
              <Link href="/admin/variants">Review variants →</Link>
            </p>
          ) : (
            <>
              <div className="bulk-confirm">
                <input
                  type="checkbox"
                  id={confirmId}
                  checked={confirmed}
                  disabled={preview.errorCount > 0 || preview.changeCount === 0}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <label htmlFor={confirmId}>
                  I reviewed the {preview.changeCount} change{preview.changeCount === 1 ? "" : "s"} above
                  {preview.errorCount > 0 ? ` (resolve ${preview.errorCount} error${preview.errorCount === 1 ? "" : "s"} first)` : ""} and want them live now.
                </label>
              </div>
              <div className="bulk-row">
                <button
                  type="button"
                  onClick={() => void publishChanges()}
                  disabled={preview.errorCount > 0 || preview.changeCount === 0 || !confirmed || phase === "publishing"}
                  className="button button-primary bulk-btn"
                >
                  <Rocket size={16} aria-hidden="true" />
                  <span>{phase === "publishing" ? "Publishing…" : `Publish ${preview.changeCount} change${preview.changeCount === 1 ? "" : "s"} live`}</span>
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <style>{`
        .bulk-pricing-root { display: flex; flex-direction: column; gap: 20px; max-width: 1100px; }
        .bulk-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
        .bulk-header .eyebrow { margin: 0 0 4px 0; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #6a6e64; font-weight: 700; }
        .bulk-header h1 { margin: 0 0 6px 0; font-size: 28px; color: #1d2a24; font-family: Georgia, serif; }
        .bulk-header .lede { margin: 0; color: #555850; font-size: 14px; max-width: 68ch; line-height: 1.55; }
        .bulk-head-link { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; white-space: nowrap; }
        .bulk-steps { list-style: none; margin: 0; padding: 0; display: flex; gap: 8px; flex-wrap: wrap; }
        .bulk-step { display: flex; align-items: center; gap: 8px; background: #fbf8f1; border: 1px solid #d9d4c8; border-radius: 20px; padding: 6px 14px 6px 6px; font-size: 12.5px; font-weight: 600; color: #6a6e64; }
        .bulk-step-num { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: #ede9df; color: #1d2a24; font-size: 12px; font-weight: 700; }
        .bulk-step.is-done { color: #23483a; border-color: #23483a; }
        .bulk-step.is-done .bulk-step-num { background: #23483a; color: #fff; }
        .bulk-step.is-current { outline: 2px solid #b39156; outline-offset: 1px; }
        .bulk-card { background: #fff; border: 1px solid #d9d4c8; border-radius: 10px; padding: 22px; }
        .bulk-card-head { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 14px; color: #23483a; }
        .bulk-card-head h2 { margin: 0 0 4px 0; font-size: 17px; color: #1d2a24; }
        .bulk-card-head p { margin: 0; font-size: 13px; color: #555850; }
        .bulk-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 14px; }
        .bulk-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; }
        .bulk-hint { margin: 0; font-size: 12.5px; color: #6a6e64; }
        .bulk-table-wrap { overflow-x: auto; margin-top: 14px; border: 1px solid #d9d4c8; border-radius: 8px; }
        .bulk-table-wrap .admin-table { margin: 0; }
        .bulk-pill { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 700; }
        .bulk-pill.is-edit { background: rgba(35,72,58,0.12); color: #23483a; }
        .bulk-pill.is-ro { background: #ede9df; color: #6a6e64; }
        .bulk-drop { margin-top: 4px; border: 2px dashed #c9c2b6; border-radius: 8px; background: #fbf8f1; padding: 26px 18px; text-align: center; transition: border-color 150ms ease, background 150ms ease; }
        .bulk-drop.is-drag { border-color: #23483a; background: rgba(35,72,58,0.06); }
        .bulk-drop-label { display: flex; flex-direction: column; gap: 4px; cursor: pointer; font-size: 14px; color: #1d2a24; }
        .bulk-drop-label span { font-size: 12.5px; color: #6a6e64; font-weight: 400; }
        .bulk-drop input[type="file"] { margin-top: 10px; font-size: 13px; }
        .bulk-inline-error { display: flex; align-items: flex-start; gap: 8px; background: #fdf3f2; border: 1px solid #e5b8b5; color: #8f2f2a; border-radius: 6px; padding: 10px 12px; font-size: 13px; margin: 12px 0 0 0; }
        .bulk-error-summary { background: #fdf3f2; border: 1px solid #e5b8b5; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        .bulk-error-summary h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 6px 0; font-size: 15px; color: #8f2f2a; }
        .bulk-error-summary p { margin: 0 0 8px 0; font-size: 13px; color: #6b3a37; }
        .bulk-error-summary ul { margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #6b3a37; display: flex; flex-direction: column; gap: 4px; }
        .bulk-error-summary a { color: #8f2f2a; font-weight: 700; }
        .bulk-note { display: flex; align-items: flex-start; gap: 8px; background: #f4f6f1; border: 1px solid #d9d4c8; border-radius: 6px; padding: 10px 12px; font-size: 13px; color: #3f4a42; }
        .bulk-kpis { display: flex; gap: 10px; flex-wrap: wrap; margin: 4px 0 0 0; }
        .bulk-kpi { background: #fbf8f1; border: 1px solid #d9d4c8; border-radius: 8px; padding: 10px 14px; font-size: 12.5px; color: #555850; }
        .bulk-kpi span { display: block; font-size: 20px; font-weight: 700; color: #1d2a24; }
        .bulk-filter-row label { font-size: 13px; font-weight: 600; color: #555850; }
        .bulk-filter-row select { padding: 8px 10px; border: 1px solid #c9c2b6; border-radius: 6px; font-size: 13px; background: #fff; min-height: 40px; }
        .bulk-sub { font-size: 11.5px; color: #6a6e64; margin-top: 2px; }
        .bulk-old { color: #6a6e64; }
        .bulk-arrow { color: #9ea399; }
        .bulk-new { color: #23483a; }
        .bulk-warn-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #9e6428; }
        .bulk-warn-list li { display: flex; align-items: flex-start; gap: 5px; }
        .bulk-error-table tr:target { outline: 2px solid #8f2f2a; outline-offset: -2px; }
        .bulk-confirm { display: flex; align-items: flex-start; gap: 10px; margin-top: 12px; font-size: 13.5px; color: #1d2a24; }
        .bulk-confirm input[type="checkbox"] { width: 22px; height: 22px; margin-top: 1px; accent-color: #23483a; flex-shrink: 0; }
        .bulk-success { display: flex; align-items: flex-start; gap: 8px; background: rgba(35,72,58,0.08); border: 1px solid #23483a; color: #23483a; border-radius: 6px; padding: 12px; font-size: 14px; font-weight: 600; margin: 12px 0 0 0; flex-wrap: wrap; }
        .bulk-success a { color: #23483a; }
        .bulk-publish { border-left: 4px solid #b39156; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
        @media (max-width: 640px) {
          .bulk-card { padding: 16px; }
          .bulk-header h1 { font-size: 23px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bulk-drop, .bulk-step { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
