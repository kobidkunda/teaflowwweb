"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  FileCheck2,
  Pencil,
  Search,
  X,
} from "lucide-react";
import {
  formatDateTime,
  formatRupees,
  useDialogLightDismiss,
  type AdminTradePayload,
  type StatusToast,
} from "./types";

interface TradeEnquiriesTabProps {
  data: AdminTradePayload;
  onSaved: (toast: StatusToast) => Promise<void>;
  onError: (msg: string) => void;
}

export function TradeEnquiriesTab({
  data,
  onSaved,
  onError,
}: TradeEnquiriesTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Edit Owner & Notes <dialog>
  const editDialogRef = useRef<HTMLDialogElement | null>(null);
  const editLightDismiss = useDialogLightDismiss(editDialogRef, () =>
    setEditingEnquiry(null)
  );
  const [editingEnquiry, setEditingEnquiry] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [ownerInput, setOwnerInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Convert to Quote <dialog>
  const convertDialogRef = useRef<HTMLDialogElement | null>(null);
  const convertLightDismiss = useDialogLightDismiss(convertDialogRef, () =>
    setConvertingEnquiry(null)
  );
  const [convertingEnquiry, setConvertingEnquiry] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [quoteVariantId, setQuoteVariantId] = useState<string>(() =>
    data.catalog.variants[0] ? String(data.catalog.variants[0].id) : ""
  );
  const [quoteQty, setQuoteQty] = useState("1");
  const [quotePayment, setQuotePayment] = useState<
    "prepaid" | "cod" | "freight_advance"
  >("prepaid");
  const [converting, setConverting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.enquiries.filter((eq) => {
      if (statusFilter && String(eq.status) !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        eq.id,
        eq.destination_pin,
        eq.contact_name,
        eq.contact_phone,
        eq.assigned_owner,
        eq.utm_source,
        eq.utm_campaign,
      ]
        .map((v) => String(v ?? ""))
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data.enquiries, search, statusFilter]);

  function openEditDialog(eq: Record<string, unknown>) {
    setEditingEnquiry(eq);
    setOwnerInput(String(eq.assigned_owner ?? ""));
    setNotesInput(String(eq.notes ?? ""));
    editDialogRef.current?.showModal();
  }

  async function submitEditNotes(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEnquiry) return;
    setSavingNotes(true);
    try {
      const res = await fetch("/api/admin/trade/enquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          id: editingEnquiry.id,
          assigned_owner: ownerInput.trim() || null,
          notes: notesInput.trim() || null,
        }),
      });
      if (!res.ok) {
        onError("Failed to save enquiry owner/notes.");
        return;
      }
      const idStr = String(editingEnquiry.id);
      editDialogRef.current?.close();
      setEditingEnquiry(null);
      await onSaved({
        kind: "ok",
        text: `Enquiry ${idStr} owner/notes saved.`,
      });
    } catch {
      onError("Network error while saving enquiry notes.");
    } finally {
      setSavingNotes(false);
    }
  }

  function openConvertDialog(eq: Record<string, unknown>) {
    setConvertingEnquiry(eq);
    if (!quoteVariantId && data.catalog.variants[0]) {
      setQuoteVariantId(String(data.catalog.variants[0].id));
    }
    setQuoteQty("1");
    setQuotePayment("prepaid");
    convertDialogRef.current?.showModal();
  }

  async function submitConvertQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!convertingEnquiry || !quoteVariantId) return;
    setConverting(true);
    try {
      const res = await fetch("/api/admin/trade/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          enquiryId: convertingEnquiry.id,
          assignedOwner: convertingEnquiry.assigned_owner
            ? String(convertingEnquiry.assigned_owner)
            : "ops",
          quoteRequest: {
            channel: "trade",
            quoteType: "bulk",
            locale: String(convertingEnquiry.locale || "en"),
            destinationPin: String(convertingEnquiry.destination_pin),
            lines: [
              {
                variantId: Number(quoteVariantId),
                quantity: Math.max(1, Number(quoteQty) || 1),
              },
            ],
            payment: quotePayment,
          },
        }),
      });
      const idStr = String(convertingEnquiry.id);
      if (!res.ok) {
        onError(`Could not auto-quote ${idStr} (check active lane for PIN).`);
        return;
      }
      convertDialogRef.current?.close();
      setConvertingEnquiry(null);
      await onSaved({
        kind: "ok",
        text: `Converted ${idStr} to confirmed quote.`,
      });
    } catch {
      onError("Network error while converting enquiry to quote.");
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="tf-trade-stack">
      <search className="tf-trade-toolbar">
        <div className="tf-trade-toolbar-group">
          <div className="tf-trade-search-wrap">
            <Search size={15} className="tf-trade-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="tf-trade-input tf-trade-search-input"
              aria-label="Search trade enquiries"
              placeholder="Search by ID, shop name, phone, PIN, or UTM…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="tf-trade-select"
            style={{ width: "auto", minWidth: 160 }}
            aria-label="Filter enquiries by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="assigned">Assigned</option>
            <option value="quoted">Quoted</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <span className="tf-trade-help">
          Showing {filtered.length} of {data.enquiries.length} enquiries
        </span>
      </search>

      <div className="tf-trade-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="trade-enquiries-table-caption"
          className="tf-trade-table-wrap"
          style={{ border: "none", borderRadius: 0 }}
        >
          <table className="tf-trade-table">
            <caption id="trade-enquiries-table-caption">
              Trade shop enquiries and WhatsApp follow-ups
            </caption>
            <thead>
              <tr>
                <th scope="col">Enquiry</th>
                <th scope="col">PIN / Locale</th>
                <th scope="col">Contact &amp; Draft</th>
                <th scope="col">UTM &amp; CTA</th>
                <th scope="col">Status / Owner</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tf-trade-empty">
                    No trade enquiries match your current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((eq) => {
                  const idStr = String(eq.id);
                  const statusStr = String(eq.status ?? "new");
                  const utmParts = [
                    eq.utm_source ? `src:${String(eq.utm_source)}` : null,
                    eq.utm_medium ? `med:${String(eq.utm_medium)}` : null,
                    eq.utm_campaign ? `cmp:${String(eq.utm_campaign)}` : null,
                    eq.utm_term ? `term:${String(eq.utm_term)}` : null,
                  ].filter(Boolean);
                  const cleanPhone = String(eq.contact_phone || "").replace(
                    /[^0-9]/g,
                    ""
                  );

                  return (
                    <tr key={idStr}>
                      <th scope="row">
                        <div className="tf-trade-single-line" style={{ maxWidth: 160 }} title={idStr}>
                          {idStr}
                        </div>
                        {eq.created_at ? (
                          <div className="tf-trade-help">
                            {formatDateTime(eq.created_at)}
                          </div>
                        ) : null}
                      </th>
                      <td data-label="PIN / Locale">
                        <strong>{String(eq.destination_pin)}</strong>{" "}
                        <span className="tf-badge">{String(eq.locale)}</span>
                      </td>
                      <td data-label="Contact">
                        <div>
                          <strong>
                            {String(eq.contact_name || "Shop Owner")}
                          </strong>{" "}
                          ·{" "}
                          {cleanPhone ? (
                            <a
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tf-trade-text-link"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <span>{String(eq.contact_phone)}</span>
                              <ExternalLink size={12} aria-hidden="true" />
                            </a>
                          ) : (
                            String(eq.contact_phone)
                          )}
                        </div>
                        <div className="tf-trade-help">
                          Hours: {String(eq.preferred_hours || "Any")}
                        </div>
                        {eq.whatsapp_draft ? (
                          <details style={{ marginTop: 4 }}>
                            <summary
                              style={{
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#23483a",
                              }}
                            >
                              View WhatsApp draft
                            </summary>
                            <p
                              style={{
                                margin: "6px 0 0",
                                fontSize: 12,
                                color: "#3b4540",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {String(eq.whatsapp_draft)}
                            </p>
                          </details>
                        ) : null}
                      </td>
                      <td data-label="Attribution">
                        {utmParts.length > 0 ? (
                          <div className="tf-trade-chip-grid">
                            {utmParts.map((part) => (
                              <span key={String(part)} className="tf-badge">
                                {String(part)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="tf-trade-help">Direct / organic</span>
                        )}
                        {eq.cta_source ? (
                          <div className="tf-trade-help" style={{ marginTop: 4 }}>
                            CTA: {String(eq.cta_source)}
                          </div>
                        ) : null}
                      </td>
                      <td data-label="Status / Owner">
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <span
                            className={`tf-badge ${
                              statusStr === "quoted"
                                ? "tf-badge--ok"
                                : statusStr === "new"
                                ? "tf-badge--warn"
                                : statusStr === "assigned"
                                ? "tf-badge--info"
                                : ""
                            }`}
                          >
                            {statusStr}
                          </span>
                          {eq.assigned_owner ? (
                            <span className="tf-trade-help">
                              Owner: <strong>{String(eq.assigned_owner)}</strong>
                            </span>
                          ) : null}
                        </div>
                        {eq.converted_quote_id ? (
                          <div className="tf-trade-help" style={{ marginTop: 4 }}>
                            Quote: <code>{String(eq.converted_quote_id)}</code>
                          </div>
                        ) : null}
                        {eq.notes ? (
                          <div className="tf-trade-help" style={{ marginTop: 4 }}>
                            {String(eq.notes)}
                          </div>
                        ) : null}
                      </td>
                      <td data-label="Actions">
                        <div className="tf-trade-row-actions">
                          <select
                            value={statusStr}
                            aria-label={`Status for ${idStr}`}
                            className="tf-trade-select"
                            style={{
                              width: "auto",
                              minHeight: 36,
                              padding: "4px 10px",
                              fontSize: 12.5,
                            }}
                            onChange={async (e) => {
                              const nextStatus = e.target.value;
                              const res = await fetch(
                                "/api/admin/trade/enquiries",
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  credentials: "same-origin",
                                  body: JSON.stringify({
                                    id: eq.id,
                                    status: nextStatus,
                                  }),
                                }
                              );
                              if (!res.ok) {
                                onError(`Failed to update enquiry ${idStr}.`);
                                return;
                              }
                              await onSaved({
                                kind: "ok",
                                text: `Enquiry ${idStr} updated.`,
                              });
                            }}
                          >
                            <option value="new">new</option>
                            <option value="assigned">assigned</option>
                            <option value="quoted">quoted</option>
                            <option value="closed">closed</option>
                          </select>

                          <button
                            type="button"
                            className="tf-trade-btn tf-trade-btn--sm"
                            onClick={() => openEditDialog(eq)}
                          >
                            <Pencil size={13} aria-hidden="true" />
                            <span>Edit Owner/Notes</span>
                          </button>

                          {data.catalog.variants.length > 0 ? (
                            <button
                              type="button"
                              className="tf-trade-btn tf-trade-btn--sm tf-trade-btn--primary"
                              onClick={() => openConvertDialog(eq)}
                            >
                              <FileCheck2 size={13} aria-hidden="true" />
                              <span>Convert to Quote</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Native <dialog> for Editing Owner & Notes */}
      <dialog
        ref={editDialogRef}
        className="tf-trade-dialog"
        aria-labelledby="edit-enquiry-dialog-title"
        {...({ closedby: "any" } as Record<string, string>)}
        {...editLightDismiss}
        onClose={() => setEditingEnquiry(null)}
      >
        <div className="tf-trade-dialog-head">
          <h3 id="edit-enquiry-dialog-title" className="tf-trade-dialog-title">
            Edit Enquiry Owner &amp; Notes
          </h3>
          <button
            type="button"
            className="tf-trade-btn tf-trade-btn--sm"
            aria-label="Close dialog"
            onClick={() => editDialogRef.current?.close()}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={submitEditNotes}>
          <div className="tf-trade-dialog-body">
            {editingEnquiry ? (
              <p className="tf-trade-help" style={{ margin: 0 }}>
                Enquiry <code>{String(editingEnquiry.id)}</code> · PIN{" "}
                <strong>{String(editingEnquiry.destination_pin)}</strong>
              </p>
            ) : null}
            <div className="tf-trade-field">
              <label htmlFor="enquiry-owner-input" className="tf-trade-label">
                Assigned Owner
              </label>
              <input
                id="enquiry-owner-input"
                type="text"
                autoFocus
                className="tf-trade-input"
                placeholder="e.g. siliguri-desk"
                value={ownerInput}
                onChange={(e) => setOwnerInput(e.target.value)}
              />
            </div>
            <div className="tf-trade-field">
              <label htmlFor="enquiry-notes-input" className="tf-trade-label">
                Internal Follow-up Notes
              </label>
              <textarea
                id="enquiry-notes-input"
                className="tf-trade-textarea"
                placeholder="Call outcome, requested sample blend, transport preference…"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
              />
            </div>
          </div>
          <div className="tf-trade-dialog-foot">
            <button
              type="button"
              className="tf-trade-btn"
              onClick={() => editDialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="tf-trade-btn tf-trade-btn--primary"
              disabled={savingNotes}
            >
              {savingNotes ? "Saving…" : "Save Owner & Notes"}
            </button>
          </div>
        </form>
      </dialog>

      {/* Native <dialog> for Converting Enquiry to Quote */}
      <dialog
        ref={convertDialogRef}
        className="tf-trade-dialog"
        aria-labelledby="convert-enquiry-dialog-title"
        {...({ closedby: "any" } as Record<string, string>)}
        {...convertLightDismiss}
        onClose={() => setConvertingEnquiry(null)}
      >
        <div className="tf-trade-dialog-head">
          <h3 id="convert-enquiry-dialog-title" className="tf-trade-dialog-title">
            Convert Enquiry to Confirmed Quote
          </h3>
          <button
            type="button"
            className="tf-trade-btn tf-trade-btn--sm"
            aria-label="Close dialog"
            onClick={() => convertDialogRef.current?.close()}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={submitConvertQuote}>
          <div className="tf-trade-dialog-body">
            {convertingEnquiry ? (
              <p className="tf-trade-help" style={{ margin: 0 }}>
                Destination PIN:{" "}
                <strong>{String(convertingEnquiry.destination_pin)}</strong> ·
                Locale: <strong>{String(convertingEnquiry.locale)}</strong>
              </p>
            ) : null}
            <div className="tf-trade-field">
              <label htmlFor="convert-variant" className="tf-trade-label">
                Tea Pack Variant
              </label>
              <select
                id="convert-variant"
                autoFocus
                className="tf-trade-select"
                value={quoteVariantId}
                onChange={(e) => setQuoteVariantId(e.target.value)}
              >
                {data.catalog.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku} · {v.grams / 1000} kg ({formatRupees(v.price_paise)})
                  </option>
                ))}
              </select>
            </div>
            <div className="tf-trade-grid-2">
              <div className="tf-trade-field">
                <label htmlFor="convert-qty" className="tf-trade-label">
                  Quantity
                </label>
                <input
                  id="convert-qty"
                  type="number"
                  min={1}
                  max={999}
                  inputMode="numeric"
                  className="tf-trade-input"
                  value={quoteQty}
                  onChange={(e) => setQuoteQty(e.target.value)}
                />
              </div>
              <div className="tf-trade-field">
                <label htmlFor="convert-payment" className="tf-trade-label">
                  Payment Mode
                </label>
                <select
                  id="convert-payment"
                  className="tf-trade-select"
                  value={quotePayment}
                  onChange={(e) =>
                    setQuotePayment(
                      e.target.value as "prepaid" | "cod" | "freight_advance"
                    )
                  }
                >
                  <option value="prepaid">Prepaid</option>
                  <option value="cod">Cash on Delivery</option>
                  <option value="freight_advance">Freight Advance</option>
                </select>
              </div>
            </div>
          </div>
          <div className="tf-trade-dialog-foot">
            <button
              type="button"
              className="tf-trade-btn"
              onClick={() => convertDialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="tf-trade-btn tf-trade-btn--primary"
              disabled={converting}
            >
              {converting ? "Generating Quote…" : "Generate Confirmed Quote"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
