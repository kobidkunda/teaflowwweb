"use client";

import Image from "next/image";
import React, { useState } from "react";
import type { PublicPackagingVariantDto } from "@/lib/private-label/public-dto";

import type { PackagingFamilyCode } from "@/lib/private-label/types";

export interface StudioPackagingVariant extends PublicPackagingVariantDto {
  width_mm?: number;
  height_mm?: number;
  depth_mm?: number | null;
  unit_cost_paise?: number;
}

export interface Step2PackagingSelectionProps {
  packagingVariants: StudioPackagingVariant[];
  selectedVariantId: string | null;
  onSelectVariant: (variantId: string, slug?: string, family?: PackagingFamilyCode) => void;
  onNext: () => void;
  onPrev?: () => void;
  deepLinkSlug?: string | null;
  validationError?: string | null;
}

export function Step2PackagingSelection({
  packagingVariants = [],
  selectedVariantId,
  onSelectVariant,
  onNext,
  onPrev,
  deepLinkSlug: _deepLinkSlug,
  validationError,
}: Step2PackagingSelectionProps) {
  const [selectedFamily, setSelectedFamily] = useState<string>("all");

  const families = ["all", "pouch", "tin", "jar", "carton", "sachet"];

  const filteredVariants = packagingVariants.filter((variant) => {
    if (selectedFamily === "all") return true;
    const cat = (variant.category || variant.family || "").toLowerCase();
    return cat === selectedFamily;
  });

  return (
    <section
      data-testid="step-pack"
      data-step="2"
      aria-labelledby="step-2-title"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <h2
          id="step-2-title" tabIndex={-1}
          style={{
            margin: "0 0 6px 0",
            fontSize: "1.5rem",
            fontFamily: 'Georgia, "Times New Roman", serif',
            color: "#143C31",
          }}
        >
          Step 2: Choose Primary Packaging Structure
        </h2>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#65746D" }}>
          Select food-safe, high-barrier packaging designed specifically to preserve delicate tea
          volatiles against humidity, light, and oxygen.
        </p>
      </div>

      {/* Structure Family Filter Pills */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }} role="group" aria-label="Packaging types">
        {families.map((fam) => (
          <button
            key={fam}
            type="button"
            onClick={() => setSelectedFamily(fam)}
            style={{
              minHeight: "36px",
              padding: "6px 14px",
              borderRadius: "20px",
              border: selectedFamily === fam ? "1px solid #143C31" : "1px solid #DDE4DC",
              background: selectedFamily === fam ? "#143C31" : "#FFFFFF",
              color: selectedFamily === fam ? "#FFFCF7" : "#171713",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {fam}
          </button>
        ))}
      </div>

      {/* Packaging Variants Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
          gap: "16px",
        }}
      >
        {filteredVariants.map((variant) => {
          const isSelected = variant.id === selectedVariantId;
          const family = variant.category || variant.family || "pouch";
          const capacity =
            variant.capacity_description ||
            (variant.net_weight_capacity_grams ? `${variant.net_weight_capacity_grams}g` : "");

          return (
            <div
              key={variant.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              data-testid="pack-option"
              className="packaging-choice"
              onClick={() => onSelectVariant(variant.id, variant.slug, family as PackagingFamilyCode)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectVariant(variant.id, variant.slug, family as PackagingFamilyCode);
                }
              }}
              style={{
                borderRadius: "10px",
                border: isSelected ? "2px solid #143C31" : "1px solid #DDE4DC",
                background: isSelected ? "#F2F8F4" : "#FFFFFF",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "12px",
                cursor: "pointer",
                transition: "border-color 0.15s ease, background 0.15s ease",
              }}
            >
              <div>
                {variant.hero_image_url && (
                  <div style={{ width: "100%", height: 220, position: "relative", marginBottom: "8px", borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(20, 60, 49, 0.04)" }}>
                    <Image
                      src={variant.hero_image_url}
                      alt={`${variant.title} — ${variant.image_illustrative ? "illustrative concept" : "packaging"}`}
                      fill
                      sizes="(max-width: 768px) 90vw, 360px"
                      style={{ objectFit: "contain", padding: "8px" }}
                    />
                  </div>
                )}
                {variant.image_illustrative && <p style={{ fontSize: 12, color: "#65746D" }}>Illustrative packaging concept</p>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#143C31",
                      background: "#EAF2EE",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {family} {capacity && `\u2022 ${capacity}`}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        background: "#143C31",
                        color: "#FFFCF7",
                        borderRadius: "50%",
                        width: "18px",
                        height: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.625rem",
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>

                <h3
                  style={{
                    margin: "8px 0 4px 0",
                    fontSize: "1rem",
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    color: "#143C31",
                  }}
                >
                  {variant.name || variant.title}
                </h3>

                <div style={{ fontSize: "0.8125rem", color: "#65746D", display: "flex", flexDirection: "column", gap: "2px" }}>
                  {variant.material && <div>Material: <strong>{variant.material}</strong></div>}
                  {variant.finish && <div>Finish: {variant.finish}</div>}
                  {variant.closure_type && <div>Closure: {variant.closure_type}</div>}
                  {variant.width_mm && variant.height_mm && (
                    <div>
                      Dimensions: {variant.width_mm} &times; {variant.height_mm} mm
                    </div>
                  )}
                </div>

                {variant.barrier_properties && (
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "8px" }}>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        background: "#FFF8E7",
                        color: "#B45309",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        border: "1px solid #FFE4A3",
                      }}
                    >
                      Ultra-High Barrier
                    </span>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid #ECEEEA",
                  paddingTop: "8px",
                  fontSize: "0.8125rem",
                }}
              >
                <span style={{ color: "#65746D" }}>
                  MOQ: <strong>{variant.moq_units || 500}</strong> units
                </span>
                <span style={{ fontWeight: 700, color: "#143C31" }}>
                  {variant.starting_price?.formatted_unit_price || "Tiered Rates"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div
          role="alert"
          style={{
            background: "#FFEBEE",
            border: "1px solid #FFCDD2",
            borderRadius: "6px",
            padding: "10px 14px",
            color: "#C62828",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          {validationError}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {onPrev && (
          <button
            type="button"
            onClick={onPrev}
            style={{
              minHeight: "44px",
              padding: "10px 20px",
              background: "#FFFFFF",
              color: "#143C31",
              borderRadius: "6px",
              border: "1px solid #DDE4DC",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            &lsaquo; Back to Tea
          </button>
        )}

        <button
          type="button"
          data-testid="step-next-btn"
          onClick={onNext}
          style={{
            minHeight: "48px",
            padding: "12px 28px",
            background: "#143C31",
            color: "#FFFCF7",
            borderRadius: "6px",
            border: "none",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.2s ease",
            marginLeft: "auto",
          }}
        >
          Continue to Print Method &rsaquo;
        </button>
      </div>
    </section>
  );
}
