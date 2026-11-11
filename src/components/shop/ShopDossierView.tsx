"use client";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { useDisplayMoney } from "@/components/international/InternationalProvider";

import React, { useState } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import type { Product, Variant } from "@/lib/products";
import { cupsFromGrams } from "@/lib/money";
import { AddToCart } from "@/components/AddToCart";
import { Eye, Droplets, Mountain } from "lucide-react";

export interface ShopDossierViewProps {
  products: Product[];
  onQuickView?: (product: Product) => void;
}

export function ShopDossierView({
  products,
  onQuickView,
}: ShopDossierViewProps) {
  return (
    <div className="shop-dossier-container">
      <div className="shop-dossier-table-wrap" role="region" aria-label="Tea cupping dossier comparison">
        <table className="shop-dossier-table">
          <thead>
            <tr>
              <th scope="col" className="col-tea"> <StorefrontText id="copy_77ebf26f5d0e2945" fallback="Single-Estate Harvest" /> </th>
              <th scope="col" className="col-terroir">Origin & Terroir</th>
              <th scope="col" className="col-sensory"> <StorefrontText id="copy_b8ee986d52a77914" fallback="Sensory Profile" /> </th>
              <th scope="col" className="col-cupping"> <StorefrontText id="copy_7306f62e8b7b07b2" fallback="Cupping Intensity" /> </th>
              <th scope="col" className="col-steep"> <StorefrontText id="copy_2199e82af3a928d4" fallback="Ritual" /> </th>
              <th scope="col" className="col-action">Format & Reserve</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <ShopDossierRow
                key={product.id}
                product={product}
                onQuickView={onQuickView}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShopDossierRow({
  product,
  onQuickView,
}: {
  product: Product;
  onQuickView?: (product: Product) => void;
}) {
  const formatINR = useDisplayMoney();

  const [selectedVariantId, setSelectedVariantId] = useState<number>(
    product.variants[0]?.id ?? 0
  );

  const activeVariant: Variant | undefined =
    product.variants.find((v) => v.id === selectedVariantId) ??
    product.variants[0];

  if (!activeVariant) return null;

  const colorClass = product.category.toLowerCase().replace(/[^a-z]/g, "");

  return (
    <tr className="shop-dossier-row" data-testid={`dossier-row-${product.slug}`}>
      {/* Product Thumb + Name */}
      <td className="col-tea">
        <div className="shop-dossier-cell-tea">
          <div className={`shop-dossier-thumb art-${colorClass}`}>
            {product.primary_image_url || activeVariant.product_image_url ? (
              <Image
                src={product.primary_image_url || activeVariant.product_image_url || ""}
                alt={product.name}
                width={56}
                height={64}
                sizes="56px"
                loading="lazy"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <svg
                role="img"
                aria-label={product.name}
                viewBox="0 0 56 64"
                width={56}
                height={64}
                style={{ width: "100%", height: "auto" }}
              >
                <rect width="56" height="64" fill="#ede9df" rx="4" />
                <rect x="8" y="12" width="40" height="40" rx="3" fill="#dfd8cb" />
              </svg>
            )}
          </div>
          <div>
            <span className="shop-dossier-cat-badge">{product.category} · {product.flush}</span>
            <h3 className="shop-dossier-title">
              <Link href={`/tea/${product.slug}`}>{product.name}</Link>
            </h3>
            <span className="shop-dossier-estate">{product.estate || "Estate Reserved"}</span>
          </div>
        </div>
      </td>

      {/* Terroir & Elevation */}
      <td className="col-terroir">
        <div className="shop-dossier-terroir-wrap">
          <strong>{product.origin}</strong>
          {product.elevation_display && (
            <span className="shop-dossier-elevation">
              <Mountain size={12} aria-hidden="true" /> {product.elevation_display}
            </span>
          )}
          {product.lot_number && (
            <small className="shop-dossier-lot"> <StorefrontText id="copy_6b3ed253964ddb2a" fallback="Lot:" /> {product.lot_number}</small>
          )}
        </div>
      </td>

      {/* Sensory & Liquor */}
      <td className="col-sensory">
        <div className="shop-dossier-sensory-wrap">
          <p className="shop-dossier-notes">{product.tasting_notes}</p>
          <div className="shop-dossier-liquor-indicator">
            <span
              className="shop-dossier-hue-dot"
              style={{ backgroundColor: product.liquor_hue_hex || "#b36b3d" }}
              aria-hidden="true"
            />
            <span className="shop-dossier-hue-name">
              {product.liquor_hue_name || "Infused amber"}
            </span>
          </div>
        </div>
      </td>

      {/* Cupping Score Bars */}
      <td className="col-cupping">
        <div className="shop-dossier-scores">
          <ScoreBar label="Floral" score={product.floral} />
          <ScoreBar label="Fruity" score={product.fruity} />
          <ScoreBar label="Malty" score={product.malty} />
          <ScoreBar label="Body" score={product.body} />
        </div>
      </td>

      {/* Steeping Ritual */}
      <td className="col-steep">
        <div className="shop-dossier-steep-wrap">
          <strong>
            <Droplets size={12} aria-hidden="true" /> {product.brew_temp}°C
          </strong>
          <span>{Math.floor(product.brew_seconds / 60)} <StorefrontText id="copy_1f6fa6f69d185e60" fallback="min" /> {product.brew_seconds % 60 ? `${product.brew_seconds % 60}s` : ""}</span>
          <small>{product.leaf_dose_grams ?? 2.5} <StorefrontText id="copy_f654f17957ad11c2" fallback="g /" /> {product.water_ml ?? 200}ml</small>
        </div>
      </td>

      {/* Action / Variant / Price */}
      <td className="col-action">
        <div className="shop-dossier-action-cell">
          <div className="shop-dossier-price-tag">
            <strong>{formatINR(activeVariant.price_paise)}</strong>
            <small>{activeVariant.grams} <StorefrontText id="copy_b4600249a21f32c0" fallback="g (~" /> {cupsFromGrams(activeVariant.grams)} <StorefrontText id="copy_6e868d2a7f1844fd" fallback="cups)" /> </small>
          </div>

          {product.variants.length > 1 && (
            <select
              aria-label={`Select format for ${product.name}`}
              className="shop-dossier-variant-select"
              value={activeVariant.id}
              onChange={(e) => setSelectedVariantId(Number(e.target.value))}
            >
              {product.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.grams}g ({v.packaging_format.replace(/_/g, " ")}) — {formatINR(v.price_paise)}
                </option>
              ))}
            </select>
          )}

          <div className="shop-dossier-btns">
            <AddToCart product={product} variant={activeVariant} disableModal={true} />
            {onQuickView && (
              <button
                type="button"
                className="shop-dossier-preview-btn"
                onClick={() => onQuickView(product)}
                aria-label={`View cupping dossier for ${product.name}`}
                title="Full cupping dossier"
              >
                <Eye size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.max(0, Math.min(100, (score / 5) * 100));
  return (
    <div className="shop-dossier-score-row" title={`${label}: ${score}/5`}>
      <span className="shop-dossier-score-label">{label}</span>
      <div className="shop-dossier-score-meter" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={5} aria-label={`${label} intensity ${score} out of 5`}>
        <div className="shop-dossier-score-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="shop-dossier-score-num">{score}</span>
    </div>
  );
}
