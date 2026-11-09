"use client";

import React, { useState, useEffect } from "react";
import { Save, AlertCircle, TrendingUp, Info } from "lucide-react";
import type { TrialWithDetails } from "@/lib/trials/types";
import { formatPaise } from "./TrialListingClient";

export interface TrialTabIdentityProps {
  trial: TrialWithDetails;
  onChange: (updated: Partial<TrialWithDetails>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  errors?: Record<string, string>;
}

export function calculateGrossMargin(
  pricePaise: number | null | undefined,
  costPaise: number | null | undefined
): { percent: number | null; label: string } {
  if (
    pricePaise == null ||
    costPaise == null ||
    !Number.isFinite(pricePaise) ||
    !Number.isFinite(costPaise) ||
    pricePaise <= 0 ||
    costPaise < 0
  ) {
    return { percent: null, label: "Unknown / COGS not set" };
  }
  const margin = ((pricePaise - costPaise) / pricePaise) * 100;
  return {
    percent: Number(margin.toFixed(1)),
    label: `${margin.toFixed(1)}%`,
  };
}

export function TrialTabIdentity({
  trial,
  onChange,
  onSave,
  saving,
  errors = {},
}: TrialTabIdentityProps) {
  const [priceRupees, setPriceRupees] = useState<string>(
    trial.price_paise ? (trial.price_paise / 100).toFixed(2) : "200.00"
  );
  const [compareAtRupees, setCompareAtRupees] = useState<string>(
    trial.compare_at_price_paise ? (trial.compare_at_price_paise / 100).toFixed(2) : ""
  );
  const [costRupees, setCostRupees] = useState<string>(
    trial.cost_paise ? (trial.cost_paise / 100).toFixed(2) : ""
  );

  // Sync rupees state if parent trial changes (e.g. discard server changes)
  useEffect(() => {
    setPriceRupees(trial.price_paise ? (trial.price_paise / 100).toFixed(2) : "200.00");
    setCompareAtRupees(trial.compare_at_price_paise ? (trial.compare_at_price_paise / 100).toFixed(2) : "");
    setCostRupees(trial.cost_paise ? (trial.cost_paise / 100).toFixed(2) : "");
  }, [trial.price_paise, trial.compare_at_price_paise, trial.cost_paise]);

  const margin = calculateGrossMargin(trial.price_paise, trial.cost_paise);

  function handlePriceChange(val: string) {
    setPriceRupees(val);
    const num = Number(val);
    if (!isNaN(num) && num >= 0) {
      onChange({ price_paise: Math.round(num * 100) });
    }
  }

  function handleCompareAtChange(val: string) {
    setCompareAtRupees(val);
    if (!val.trim()) {
      onChange({ compare_at_price_paise: null });
      return;
    }
    const num = Number(val);
    if (!isNaN(num) && num >= 0) {
      onChange({ compare_at_price_paise: Math.round(num * 100) });
    }
  }

  function handleCostChange(val: string) {
    setCostRupees(val);
    if (!val.trim()) {
      onChange({ cost_paise: null });
      return;
    }
    const num = Number(val);
    if (!isNaN(num) && num >= 0) {
      onChange({ cost_paise: Math.round(num * 100) });
    }
  }

  return (
    <div className="trial-tab-identity-root" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Save Action Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 20px",
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>
            Identity, Economics &amp; Inventory
          </h3>
          <span style={{ fontSize: 12, color: "#6a6e64" }}>
            Core merchandising, landed price waterfall, and inventory policy.
          </span>
        </div>

        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="button button-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 600,
            background: "#23483a",
            color: "#ffffff",
            borderRadius: 6,
            border: "none",
            cursor: saving ? "wait" : "pointer",
          }}
        >
          <Save size={15} />
          <span>{saving ? "Saving…" : "Save Identity Changes"}</span>
        </button>
      </div>

      {/* Main Form Sections */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 24,
        }}
      >
        {/* Card 1: Core Merchandising */}
        <div
          style={{
            background: "#ffffff",
            padding: 24,
            borderRadius: 8,
            border: "1px solid #d9d4c8",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <h4 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700, color: "#1d2a24" }}>
            Merchandising Information
          </h4>

          {/* Title */}
          <div>
            <label
              htmlFor="identity-title"
              style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
            >
              Title <span style={{ color: "#8f2f2a" }}>*</span>
            </label>
            <input
              id="identity-title"
              type="text"
              name="title"
              data-testid="input-trial-title"
              value={trial.title || ""}
              onChange={(e) => onChange({ title: e.target.value })}
              required
              minLength={3}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 14,
                borderRadius: 6,
                border: errors.title ? "1px solid #8f2f2a" : "1px solid #c9c2b6",
                boxSizing: "border-box",
              }}
            />
            {errors.title && (
              <span style={{ fontSize: 12, color: "#8f2f2a", marginTop: 4, display: "block" }}>
                {errors.title}
              </span>
            )}
          </div>

          {/* Slug */}
          <div>
            <label
              htmlFor="identity-slug"
              style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
            >
              URL Slug <span style={{ color: "#8f2f2a" }}>*</span>
            </label>
            <input
              id="identity-slug"
              type="text"
              name="slug"
              value={trial.slug || ""}
              onChange={(e) => onChange({ slug: e.target.value })}
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                borderRadius: 6,
                border: errors.slug ? "1px solid #8f2f2a" : "1px solid #c9c2b6",
                boxSizing: "border-box",
              }}
            />
            {errors.slug && (
              <span style={{ fontSize: 12, color: "#8f2f2a", marginTop: 4, display: "block" }}>
                {errors.slug}
              </span>
            )}
          </div>

          {/* Tagline */}
          <div>
            <label
              htmlFor="identity-tagline"
              style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
            >
              Tagline
            </label>
            <input
              id="identity-tagline"
              type="text"
              name="tagline"
              value={trial.tagline || ""}
              onChange={(e) => onChange({ tagline: e.target.value })}
              placeholder="e.g. Four exceptional micro-lots from Darjeeling"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid #c9c2b6",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="identity-description"
              style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
            >
              Description
            </label>
            <textarea
              id="identity-description"
              name="description"
              rows={4}
              value={trial.description || ""}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Detailed editorial copy detailing the harvest season, terroirs, and tasting arc..."
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid #c9c2b6",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Pack Format & SKU */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label
                htmlFor="identity-sku"
                style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
              >
                SKU
              </label>
              <input
                id="identity-sku"
                type="text"
                name="sku"
                value={trial.sku || ""}
                onChange={(e) => onChange({ sku: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #c9c2b6",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
              >
                Pack Format
              </label>
              <input
                type="text"
                readOnly
                disabled
                value="4x50g_sachets (200g)"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #d9d4c8",
                  background: "#f6f1e7",
                  boxSizing: "border-box",
                  color: "#6a6e64",
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Pricing, COGS & Economics */}
        <div
          style={{
            background: "#ffffff",
            padding: 24,
            borderRadius: 8,
            border: "1px solid #d9d4c8",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <h4 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700, color: "#1d2a24" }}>
            Economics &amp; Gross Margin
          </h4>

          {/* Price (Rupees) */}
          <div>
            <label
              htmlFor="identity-price"
              style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
            >
              Selling Price (₹) <span style={{ color: "#8f2f2a" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontWeight: 700,
                  color: "#6a6e64",
                }}
              >
                ₹
              </span>
              <input
                id="identity-price"
                type="number"
                name="price_rupees"
                step="0.01"
                min="0"
                value={priceRupees}
                onChange={(e) => handlePriceChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 26px",
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: errors.price_paise ? "1px solid #8f2f2a" : "1px solid #c9c2b6",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {errors.price_paise && (
              <span style={{ fontSize: 12, color: "#8f2f2a", marginTop: 4, display: "block" }}>
                {errors.price_paise}
              </span>
            )}
          </div>

          {/* Compare-at Price & COGS */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label
                htmlFor="identity-compare-price"
                style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
              >
                Compare-at Price (₹)
              </label>
              <input
                id="identity-compare-price"
                type="number"
                name="compare_at_price_rupees"
                step="0.01"
                min="0"
                placeholder="Optional strike"
                value={compareAtRupees}
                onChange={(e) => handleCompareAtChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #c9c2b6",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="identity-cost"
                style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
              >
                Estimated COGS (₹)
              </label>
              <input
                id="identity-cost"
                type="number"
                name="cost_rupees"
                step="0.01"
                min="0"
                placeholder="Kit total BOM"
                value={costRupees}
                onChange={(e) => handleCostChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #c9c2b6",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Margin Preview Inspector */}
          <div
            style={{
              padding: "14px 16px",
              background: "#f0f6f2",
              borderRadius: 8,
              border: "1px solid #c2dbcd",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <TrendingUp size={22} color="#23483a" />
            <div>
              <span style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#23483a" }}>
                Gross Contribution Margin
              </span>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#143c31" }}>
                {margin.label}
              </div>
              <span style={{ fontSize: 11, color: "#555850" }}>
                Formula: (Price − COGS) ÷ Price · Confidential internal metric
              </span>
            </div>
          </div>

          {/* Inventory Policy & Quantity */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            <div>
              <label
                htmlFor="identity-policy"
                style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
              >
                Inventory Policy
              </label>
              <select
                id="identity-policy"
                name="inventory_policy"
                value={trial.inventory_policy || "track"}
                onChange={(e) => onChange({ inventory_policy: e.target.value as "track" | "continue" })}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #c9c2b6",
                  background: "#ffffff",
                  boxSizing: "border-box",
                }}
              >
                <option value="track">Track Inventory</option>
                <option value="continue">Allow Backorders (Continue)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="identity-stock"
                style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
              >
                Stock Quantity
              </label>
              <input
                id="identity-stock"
                type="number"
                name="inventory_quantity"
                min="0"
                step="1"
                value={trial.inventory_quantity ?? 0}
                onChange={(e) => onChange({ inventory_quantity: Number(e.target.value) || 0 })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #c9c2b6",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
