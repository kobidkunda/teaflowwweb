"use client";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { useDisplayMoney } from "@/components/international/InternationalProvider";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import type { Product, Variant } from "@/lib/products";
import { cupsFromGrams } from "@/lib/money";
import { formatPackWeight } from "@/lib/packSize";
import { AddToCart } from "@/components/AddToCart";
import { X, Droplets, Mountain, Sparkles, ArrowRight } from "lucide-react";

export interface ShopQuickViewModalProps {
  product: Product | null;
  onClose: () => void;
}

export function ShopQuickViewModal({
  product,
  onClose,
}: ShopQuickViewModalProps) {
  const formatINR = useDisplayMoney();

  const dialogRef = useRef<HTMLDivElement>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<number>(0);

  useEffect(() => {
    if (product) {
      setSelectedVariantId(product.variants[0]?.id ?? 0);
    }
  }, [product]);

  useEffect(() => {
    if (!product) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    // Lock body scroll when open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    // Focus inside modal
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [product, onClose]);

  if (!product) return null;

  const activeVariant: Variant | undefined =
    product.variants.find((v) => v.id === selectedVariantId) ??
    product.variants[0];

  const colorClass = product.category.toLowerCase().replace(/[^a-z]/g, "");

  const cuppingScores = [
    { label: "Floral", value: product.floral },
    { label: "Fruity", value: product.fruity },
    { label: "Malty", value: product.malty },
    { label: "Body", value: product.body },
    { label: "Sweetness", value: product.sweetness },
    { label: "Earthy", value: product.earthy },
  ];

  return (
    <div
      className="shop-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="shop-modal-content"
        ref={dialogRef}
        tabIndex={-1}
        role="document"
      >
        {/* Close Button */}
        <button
          type="button"
          className="shop-modal-close"
          onClick={onClose}
          aria-label="Close cupping preview"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="shop-modal-grid">
          {/* Left Visual Column */}
          <div className={`shop-modal-visual art-${colorClass}`}>
            {product.primary_image_url || activeVariant.product_image_url ? (
              <Image
                src={product.primary_image_url || activeVariant.product_image_url || ""}
                alt={`Tea photography for ${product.name}`}
                width={260}
                height={300}
                sizes="260px"
                priority
                className="shop-modal-tin"
                style={{ objectFit: "contain" }}
              />
            ) : (
              <svg
                role="img"
                aria-label={`Artisanal ${product.name} packaging`}
                viewBox="0 0 260 300"
                width={260}
                height={300}
                className="shop-modal-tin"
              >
                <title>{product.name}</title>
                <rect width="260" height="300" fill="#ede9df" rx="10" />
                <rect x="50" y="60" width="160" height="180" rx="6" fill="#dfd8cb" />
                <circle cx="130" cy="150" r="35" fill="#23483a" opacity="0.2" />
              </svg>
            )}
            <div className="shop-modal-liquor-card">
              <div
                className="shop-modal-liquor-dot"
                style={{ backgroundColor: product.liquor_hue_hex || "#b36b3d" }}
                aria-hidden="true"
              />
              <div>
                <strong>{product.liquor_hue_name || "Infused Liquor"}</strong>
                <span>{product.liquor_hue_hex || "#b36b3d"}</span>
              </div>
            </div>
          </div>

          {/* Right Dossier Column */}
          <div className="shop-modal-details">
            <div className="shop-modal-meta">
              <p className="eyebrow">
                {product.origin} · {product.category}
              </p>
              {product.featured === 1 && (
                <span className="shop-card-reserve-badge">
                  <Sparkles size={11} aria-hidden="true" /> Curator&apos;s Reserve
                </span>
              )}
            </div>

            <h2 id="quick-view-title" className="shop-modal-title">
              {product.name}
            </h2>

            <p className="shop-modal-tasting">{product.tasting_notes}</p>

            {/* Terroir & Garden Spec */}
            <div className="shop-modal-spec-grid">
              <div>
                <span className="spec-label"> <StorefrontText id="copy_d1573b54e2cc35e8" fallback="Estate / Garden" /> </span>
                <strong>{product.estate || "Single Origin Garden"}</strong>
              </div>
              <div>
                <span className="spec-label"> <StorefrontText id="copy_8a7d4c8ec4585554" fallback="Elevation" /> </span>
                <strong>
                  <Mountain size={11} aria-hidden="true" />{" "}
                  {product.elevation_display || "High Alpine"}
                </strong>
              </div>
              {product.cultivar && (
                <div>
                  <span className="spec-label"> <StorefrontText id="copy_6df16014f3b39552" fallback="Cultivar" /> </span>
                  <strong>{product.cultivar}</strong>
                </div>
              )}
              {product.lot_number && (
                <div>
                  <span className="spec-label"> <StorefrontText id="copy_1a1d4025ef7c27dd" fallback="Invoice / Lot" /> </span>
                  <strong>{product.lot_number}</strong>
                </div>
              )}
            </div>

            {/* 6-Axis Cupping Radar Scores */}
            <div className="shop-modal-cupping-section">
              <h3 className="shop-modal-subheading"> <StorefrontText id="copy_64c0446d886b9bf8" fallback="Sensory Cupping Radar" /> </h3>
              <div className="shop-modal-radar-grid">
                {cuppingScores.map(({ label, value }) => {
                  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
                  return (
                    <div key={label} className="shop-modal-radar-item">
                      <div className="radar-header">
                        <span>{label}</span>
                        <strong>{value}/5</strong>
                      </div>
                      <div
                        className="radar-track"
                        role="meter"
                        aria-valuenow={value}
                        aria-valuemin={0}
                        aria-valuemax={5}
                        aria-label={`${label} intensity ${value} of 5`}
                      >
                        <div className="radar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Steeping Ritual Guide */}
            <div className="shop-modal-steep-banner">
              <div className="steep-item">
                <span className="steep-label"> <StorefrontText id="copy_0fc4ba1b38380d98" fallback="Water Temp" /> </span>
                <strong>
                  <Droplets size={12} aria-hidden="true" /> {product.brew_temp}°C
                </strong>
              </div>
              <div className="steep-item">
                <span className="steep-label"> <StorefrontText id="copy_caeda362d54d0a03" fallback="Infusion Time" /> </span>
                <strong>
                  {Math.floor(product.brew_seconds / 60)}m{" "}
                  {product.brew_seconds % 60 ? `${product.brew_seconds % 60}s` : ""}
                </strong>
              </div>
              <div className="steep-item">
                <span className="steep-label"> <StorefrontText id="copy_1bafe6aea1c88b15" fallback="Leaf Dose" /> </span>
                <strong>{product.leaf_dose_grams ?? 2.5}g</strong>
              </div>
              <div className="steep-item">
                <span className="steep-label"> <StorefrontText id="copy_005929eb3c739cab" fallback="Water Ratio" /> </span>
                <strong>{product.water_ml ?? 200}ml</strong>
              </div>
            </div>

            {/* Packaging & Pricing Section */}
            {activeVariant && (
              <div className="shop-modal-purchase">
                {product.variants.length > 1 && (
                  <div className="shop-modal-variants">
                    <span className="spec-label">
                      <StorefrontText id="copy_65357f21fdcb965e" fallback="Select Pack Size" />
                    </span>
                    <div className="shop-card-variant-pills">
                      {product.variants.map((v) => {
                        const isSelected = v.id === activeVariant.id;
                        const weightStr = formatPackWeight(v.grams);
                        const formatStr =
                          v.packaging_format === "luxury_tin"
                            ? "Tin"
                            : v.packaging_format === "pyramid_bags"
                            ? "Bags"
                            : "Pouch";
                        const cups = cupsFromGrams(v.grams);
                        return (
                          <button
                            key={v.id}
                            type="button"
                            className={`shop-card-variant-btn ${
                              isSelected ? "active" : ""
                            }`}
                            onClick={() => setSelectedVariantId(v.id)}
                            aria-pressed={isSelected}
                            style={{
                              display: "inline-flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              gap: "2px",
                              padding: "6px 10px",
                              minHeight: "48px",
                              textAlign: "left",
                            }}
                          >
                            <span style={{ fontWeight: 600, fontSize: "12px", lineHeight: 1.2 }}>
                              {weightStr} <span style={{ opacity: 0.75, fontWeight: 400 }}>({formatStr})</span>
                            </span>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: isSelected ? "#1b3022" : "#23483a", lineHeight: 1.2 }}>
                              {formatINR(v.price_paise)}
                              <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: "4px", fontSize: "10px" }}>
                                ~{cups.toLocaleString("en-IN")} cups
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="shop-modal-price-row">
                  <div>
                    <strong className="shop-modal-price">
                      {formatINR(activeVariant.price_paise)}
                    </strong>
                    <span className="shop-modal-yield">
                      {formatPackWeight(activeVariant.grams)} · ~{cupsFromGrams(activeVariant.grams).toLocaleString("en-IN")}{" "}
                      <StorefrontText id="copy_43b69e82bee632b3" fallback="cups" />
                    </span>
                  </div>
                  <div className="shop-modal-cta-group">
                    <AddToCart product={product} variant={activeVariant} disableModal={true} />
                    <Link
                      href={`/tea/${product.slug}`}
                      className="button button-cream"
                      onClick={onClose}
                    > <StorefrontText id="copy_2058e82caa5929c0" fallback="Full Passport" /> <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
