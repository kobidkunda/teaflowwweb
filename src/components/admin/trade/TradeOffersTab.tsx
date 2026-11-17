"use client";

import React, { useRef, useState } from "react";
import { Package, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  formatRupees,
  useDialogLightDismiss,
  type AdminTradePayload,
  type StatusToast,
} from "./types";

interface TradeOffersTabProps {
  data: AdminTradePayload;
  onSaved: (toast: StatusToast) => Promise<void>;
  onError: (msg: string) => void;
}

export function TradeOffersTab({ data, onSaved, onError }: TradeOffersTabProps) {
  const [offerProductId, setOfferProductId] = useState<string>(() =>
    data.catalog.products[0] ? String(data.catalog.products[0].id) : ""
  );
  const [offerOrder, setOfferOrder] = useState("1");
  const [offerBadge, setOfferBadge] = useState("");
  const [offerPublished, setOfferPublished] = useState(true);
  const [offerEligibleVariants, setOfferEligibleVariants] = useState<number[]>([]);
  const [offerDefaultVariantId, setOfferDefaultVariantId] = useState("");
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<{
    productId: string;
    name: string;
  } | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null);
  const lightDismiss = useDialogLightDismiss(deleteDialogRef, () =>
    setPendingDelete(null)
  );

  const productVariants = data.catalog.variants.filter(
    (v) => String(v.product_id) === offerProductId
  );

  function loadOfferIntoForm(offer: Record<string, unknown>) {
    setOfferProductId(String(offer.product_id ?? ""));
    setOfferOrder(String(offer.featured_order ?? 1));
    setOfferBadge(offer.badge_text ? String(offer.badge_text) : "");
    setOfferPublished(Boolean(offer.published));
    const eligible = Array.isArray(offer.eligible_variant_ids)
      ? (offer.eligible_variant_ids as number[])
      : [];
    setOfferEligibleVariants(eligible);
    setOfferDefaultVariantId(
      offer.default_variant_id ? String(offer.default_variant_id) : ""
    );
  }

  async function saveOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!offerProductId) {
      onError("Select a product first.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/trade/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          product_id: Number(offerProductId),
          featured_order: Number(offerOrder) || 0,
          published: offerPublished,
          eligible_variant_ids: offerEligibleVariants,
          default_variant_id: offerDefaultVariantId
            ? Number(offerDefaultVariantId)
            : null,
          badge_text: offerBadge.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(json.error || "Failed to save trade offer.");
        return;
      }
      await onSaved({ kind: "ok", text: "Trade offer saved." });
    } catch {
      onError("Network error while saving trade offer.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemoveOffer() {
    if (!pendingDelete) return;
    try {
      const res = await fetch(
        `/api/admin/trade/offers?productId=${encodeURIComponent(
          pendingDelete.productId
        )}`,
        { method: "DELETE", credentials: "same-origin" }
      );
      if (!res.ok) {
        onError("Failed to remove trade offer.");
        return;
      }
      deleteDialogRef.current?.close();
      setPendingDelete(null);
      await onSaved({ kind: "ok", text: "Trade offer removed." });
    } catch {
      onError("Network error while removing trade offer.");
    }
  }

  return (
    <div className="tf-trade-stack">
      <form
        onSubmit={saveOffer}
        aria-labelledby="trade-offer-form-heading"
        className="tf-trade-card tf-trade-stack"
      >
        <div className="tf-trade-card-header" style={{ marginBottom: 0 }}>
          <div>
            <h2 id="trade-offer-form-heading" className="tf-trade-card-title">
              <Plus size={18} aria-hidden="true" />
              <span>Assign Product to Trade Channel</span>
            </h2>
            <p className="tf-trade-card-desc">
              Choose catalogue teas, pack variants, and display order for /tea-shops.
            </p>
          </div>
        </div>

        <div className="tf-trade-grid-3">
          <div className="tf-trade-field">
            <label htmlFor="offer-product" className="tf-trade-label">
              Catalogue Product
            </label>
            <select
              id="offer-product"
              className="tf-trade-select"
              value={offerProductId}
              onChange={(e) => {
                setOfferProductId(e.target.value);
                setOfferEligibleVariants([]);
                setOfferDefaultVariantId("");
              }}
            >
              {data.catalog.products.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} · {p.name} ({p.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="tf-trade-field">
            <label htmlFor="offer-order" className="tf-trade-label">
              Featured Order
            </label>
            <input
              id="offer-order"
              type="number"
              min={0}
              inputMode="numeric"
              className="tf-trade-input"
              value={offerOrder}
              onChange={(e) => setOfferOrder(e.target.value)}
            />
          </div>

          <div className="tf-trade-field">
            <label htmlFor="offer-badge" className="tf-trade-label">
              Badge Text
              <span className="tf-trade-optional-tag">Optional</span>
            </label>
            <input
              id="offer-badge"
              type="text"
              className="tf-trade-input"
              placeholder="e.g. Most ordered"
              value={offerBadge}
              onChange={(e) => setOfferBadge(e.target.value)}
            />
          </div>
        </div>

        <fieldset className="tf-trade-fieldset">
          <legend className="tf-trade-legend">
            Eligible Pack Variants (leave all unchecked to allow all variants)
          </legend>
          {productVariants.length === 0 ? (
            <p className="tf-trade-help">No variants found for this product.</p>
          ) : (
            <div className="tf-trade-chip-grid">
              {productVariants.map((v) => (
                <label key={v.id} className="tf-trade-check-pill">
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
                    {v.sku} · {v.grams / 1000} kg · {formatRupees(v.price_paise)} (stock:{" "}
                    {v.stock})
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="tf-trade-grid-2">
          <div className="tf-trade-field">
            <label htmlFor="offer-default-variant" className="tf-trade-label">
              Default Selected Variant
            </label>
            <select
              id="offer-default-variant"
              className="tf-trade-select"
              value={offerDefaultVariantId}
              onChange={(e) => setOfferDefaultVariantId(e.target.value)}
            >
              <option value="">Auto-select 25 kg pack</option>
              {productVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.sku} ({v.grams / 1000} kg · {formatRupees(v.price_paise)})
                </option>
              ))}
            </select>
          </div>

          <label htmlFor="offer-published" className="tf-trade-switch-card">
            <span className="tf-trade-switch-copy">
              <span className="tf-trade-switch-title">Published in /tea-shops</span>
              <span className="tf-trade-switch-sub">
                Show this product in the bulk wholesale catalogue.
              </span>
            </span>
            <input
              id="offer-published"
              type="checkbox"
              className="tf-trade-switch-input"
              checked={offerPublished}
              onChange={(e) => setOfferPublished(e.target.checked)}
              {...({ switch: "" } as Record<string, string>)}
            />
          </label>
        </div>

        <div className="tf-trade-form-actions">
          <button
            type="submit"
            className="tf-trade-btn tf-trade-btn--primary"
            disabled={saving}
          >
            <Package size={16} aria-hidden="true" />
            <span>{saving ? "Saving…" : "Assign / Update Offer"}</span>
          </button>
        </div>
      </form>

      {/* Offers Table */}
      <div className="tf-trade-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="trade-offers-table-caption"
          className="tf-trade-table-wrap"
          style={{ border: "none", borderRadius: 0 }}
        >
          <table className="tf-trade-table">
            <caption id="trade-offers-table-caption">
              Assigned trade channel offers
            </caption>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Order</th>
                <th scope="col">Badge</th>
                <th scope="col">Published</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.offers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="tf-trade-empty">
                    No trade offers configured yet. Assign a product above to publish it on /tea-shops.
                  </td>
                </tr>
              ) : (
                data.offers.map((o) => {
                  const pid = String(o.product_id);
                  const pname = String(o.product_name ?? "");
                  return (
                    <tr key={pid}>
                      <th scope="row">
                        #{pid} · {pname}
                      </th>
                      <td data-label="Order">{String(o.featured_order)}</td>
                      <td data-label="Badge">
                        {o.badge_text ? (
                          <span className="tf-badge tf-badge--info">
                            {String(o.badge_text)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td data-label="Published">
                        <span
                          className={`tf-badge ${
                            o.published ? "tf-badge--ok" : "tf-badge--warn"
                          }`}
                        >
                          {o.published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td data-label="Actions">
                        <div className="tf-trade-row-actions">
                          <button
                            type="button"
                            className="tf-trade-btn tf-trade-btn--sm"
                            onClick={() => loadOfferIntoForm(o)}
                          >
                            <Pencil size={13} aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="tf-trade-btn tf-trade-btn--sm tf-trade-btn--danger"
                            onClick={() => {
                              setPendingDelete({
                                productId: pid,
                                name: `#${pid} · ${pname}`,
                              });
                              deleteDialogRef.current?.showModal();
                            }}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                            <span>Remove</span>
                          </button>
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

      {/* Confirmation Dialog */}
      <dialog
        ref={deleteDialogRef}
        className="tf-trade-dialog"
        aria-labelledby="delete-offer-title"
        {...({ closedby: "any" } as Record<string, string>)}
        {...lightDismiss}
        onClose={() => setPendingDelete(null)}
      >
        <div className="tf-trade-dialog-head">
          <h3 id="delete-offer-title" className="tf-trade-dialog-title">
            Remove Trade Offer?
          </h3>
          <button
            type="button"
            className="tf-trade-btn tf-trade-btn--sm"
            aria-label="Close confirmation"
            onClick={() => deleteDialogRef.current?.close()}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="tf-trade-dialog-body">
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Remove <strong>{pendingDelete?.name}</strong> from the{" "}
            <code>/tea-shops</code> trade channel? The product remains in your main
            catalogue.
          </p>
        </div>
        <div className="tf-trade-dialog-foot">
          <button
            type="button"
            className="tf-trade-btn"
            autoFocus
            onClick={() => deleteDialogRef.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="tf-trade-btn tf-trade-btn--danger"
            onClick={() => void confirmRemoveOffer()}
          >
            Remove Offer
          </button>
        </div>
      </dialog>
    </div>
  );
}
