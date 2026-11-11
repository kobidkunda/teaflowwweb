"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { PackagingDielineAction } from "./detail/PackagingDielineAction";
import React, { useState, useEffect, useId } from "react";
import { calculateSafeZone } from "@/lib/private-label/compatibility";
import type { PackagingFamilyCode } from "@/lib/private-label/types";

export type PhysicalSilhouette =
  | "stand_up_pouch"
  | "side_gusset_pouch"
  | "flat_bottom_pouch"
  | "tin_canister"
  | "kraft_box";

export interface ArtworkPlacement {
  xMm: number; // offset from center in mm
  yMm: number; // offset from center in mm
  scale: number; // multiplier 0.2 to 2.5
  rotationDeg: number; // 0, 90, 180, 270
}

export interface StudioCanvas2DProps {
  packagingVariant?: {
    id?: string;
    slug?: string;
    name?: string;
    title?: string;
    family_id?: string;
    category?: string;
    family?: string;
    width_mm?: number;
    height_mm?: number;
    depth_mm?: number | null;
    finish?: string;
    material?: string;
    dieline_url?: string | null;
    dimensions_mm?: { width: number; height: number; depth?: number | null };
  } | null;
  brandName?: string;
  fillWeightGrams?: number;
  artworkUrl?: string | null;
  artworkDpi?: number | null;
  artworkFilename?: string | null;
  activeView?: "front" | "back" | "top" | "dieline";
  onViewChange?: (view: "front" | "back" | "top" | "dieline") => void;
  guidesVisible?: boolean;
  onToggleGuides?: () => void;
  placement?: ArtworkPlacement;
  onPlacementChange?: (placement: ArtworkPlacement) => void;
  onBreachChange?: (isBreached: boolean) => void;
  className?: string;
}

export function resolvePackagingSilhouette(variant?: {
  slug?: string;
  category?: string;
  family?: string;
  title?: string;
  name?: string;
} | null): PhysicalSilhouette {
  const text = `${variant?.slug || ""} ${variant?.category || ""} ${variant?.family || ""} ${
    variant?.title || ""
  } ${variant?.name || ""}`.toLowerCase();

  if (
    text.includes("side-gusset") ||
    text.includes("side gusset") ||
    text.includes("quad-seal") ||
    text.includes("quad seal")
  ) {
    return "side_gusset_pouch";
  }
  if (
    text.includes("flat-bottom") ||
    text.includes("flat bottom") ||
    text.includes("box pouch") ||
    text.includes("block bottom")
  ) {
    return "flat_bottom_pouch";
  }
  if (
    text.includes("tin") ||
    text.includes("caddy") ||
    text.includes("canister") ||
    text.includes("metal")
  ) {
    return "tin_canister";
  }
  if (
    text.includes("box") ||
    text.includes("carton") ||
    text.includes("kraft") ||
    text.includes("rigid")
  ) {
    return "kraft_box";
  }
  return "stand_up_pouch";
}

export function StudioCanvas2D({
  packagingVariant,
  brandName = "",
  fillWeightGrams = 100,
  artworkUrl,
  artworkDpi,
  artworkFilename,
  activeView: controlledActiveView,
  onViewChange,
  guidesVisible: controlledGuidesVisible,
  onToggleGuides,
  placement: controlledPlacement,
  onPlacementChange,
  onBreachChange,
  className = "",
}: StudioCanvas2DProps) {
  const [internalView, setInternalView] = useState<"front" | "back" | "top" | "dieline">("front");
  const [internalGuides, setInternalGuides] = useState<boolean>(true);
  const [internalPlacement, setInternalPlacement] = useState<ArtworkPlacement>({
    xMm: 0,
    yMm: 0,
    scale: 1.0,
    rotationDeg: 0,
  });
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>("");

  const liveRegionId = useId();

  const activeView = controlledActiveView ?? internalView;
  const guidesVisible = controlledGuidesVisible ?? internalGuides;
  const currentPlacement = controlledPlacement ?? internalPlacement;

  const familyCode: PackagingFamilyCode =
    (packagingVariant?.family || packagingVariant?.category || "pouch") as PackagingFamilyCode;
  const packName = packagingVariant?.name || packagingVariant?.title || "Stand-Up Pouch";
  const silhouette = resolvePackagingSilhouette(packagingVariant);
  const isDarkSilhouette =
    silhouette === "stand_up_pouch" ||
    silhouette === "side_gusset_pouch" ||
    silhouette === "flat_bottom_pouch";

  // Physical Dimensions in mm
  const widthMm = Number(packagingVariant?.width_mm || 160);
  const heightMm = Number(packagingVariant?.height_mm || 230);

  // Safe zones margins & bleed
  const safeZone = calculateSafeZone(familyCode, widthMm, heightMm);

  // Mathematical Safe-Zone Breach Detection
  const safeLeft = safeZone.marginsMm.left;
  const safeRight = widthMm - safeZone.marginsMm.right;
  const safeTop = safeZone.marginsMm.top;
  const safeBottom = heightMm - safeZone.marginsMm.bottom;

  // Natural base dimensions of artwork on package (approx 45% width)
  const baseArtW = widthMm * 0.45;
  const baseArtH = baseArtW * 0.75;
  const scaledW = baseArtW * currentPlacement.scale;
  const scaledH = baseArtH * currentPlacement.scale;

  // Center is (widthMm / 2, heightMm / 2) offset by xMm, yMm
  const artCenterX = widthMm / 2 + currentPlacement.xMm;
  const artCenterY = heightMm / 2 + currentPlacement.yMm;

  const artLeft = artCenterX - scaledW / 2;
  const artRight = artCenterX + scaledW / 2;
  const artTop = artCenterY - scaledH / 2;
  const artBottom = artCenterY + scaledH / 2;

  const hasPlacedContent = Boolean(artworkUrl || (brandName && brandName.trim().length > 0));
  const isSafeZoneBreached = hasPlacedContent
    ? artLeft < safeLeft || artRight > safeRight || artTop < safeTop || artBottom > safeBottom
    : false;

  useEffect(() => {
    onBreachChange?.(isSafeZoneBreached);
  }, [isSafeZoneBreached, onBreachChange]);

  const handleViewClick = (view: "front" | "back" | "top" | "dieline") => {
    if (onViewChange) {
      onViewChange(view);
    } else {
      setInternalView(view);
    }
  };

  const handleToggleGuides = () => {
    if (onToggleGuides) {
      onToggleGuides();
    } else {
      setInternalGuides((prev) => !prev);
    }
  };

  const updatePlacement = (next: ArtworkPlacement) => {
    if (onPlacementChange) {
      onPlacementChange(next);
    } else {
      setInternalPlacement(next);
    }
  };

  // WCAG 2.2 AA Keyboard placement controls
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
    const isScale = ["+", "=", "-", "_"].includes(e.key);
    const isReset = e.key.toLowerCase() === "r";

    if (!isArrow && !isScale && !isReset) return;

    e.preventDefault();
    const step = e.shiftKey ? 10 : 1; // 10mm jump on Shift, 1mm nudge otherwise

    let next = { ...currentPlacement };

    if (e.key === "ArrowUp") next.yMm -= step;
    if (e.key === "ArrowDown") next.yMm += step;
    if (e.key === "ArrowLeft") next.xMm -= step;
    if (e.key === "ArrowRight") next.xMm += step;

    if (e.key === "+" || e.key === "=") {
      next.scale = Math.min(2.5, Math.round((next.scale + 0.05) * 100) / 100);
    }
    if (e.key === "-" || e.key === "_") {
      next.scale = Math.max(0.2, Math.round((next.scale - 0.05) * 100) / 100);
    }
    if (isReset) {
      next = { xMm: 0, yMm: 0, scale: 1.0, rotationDeg: 0 };
    }

    updatePlacement(next);
    setAriaAnnouncement(
      `Artwork moved to X ${next.xMm}mm, Y ${next.yMm}mm, scale ${Math.round(next.scale * 100)}%`
    );
  };

  // Resolution check: < 300 DPI triggers warning
  const isLowRes = typeof artworkDpi === "number" && artworkDpi > 0 && artworkDpi < 300;

  // Aspect ratio
  const aspectRatio = `${widthMm} / ${heightMm}`;
  const canvasAriaLabel = `2D preview of ${packName} ${activeView} view with ${
    brandName ? brandName + " artwork" : "custom brand design"
  }. Use arrow keys to nudge placement by 1mm, Shift+Arrow for 10mm, plus and minus keys to zoom.`;

  // Silhouette style generator
  const getSilhouetteStyle = (): React.CSSProperties => {
    switch (silhouette) {
      case "tin_canister":
        return {
          background:
            "linear-gradient(90deg, #A8B2AE 0%, #DDE4DC 22%, #FFFFFF 48%, #CBD5D0 74%, #9BA5A1 100%)",
          borderRadius: "16px",
          border: "1px solid #8E9E96",
          boxShadow:
            "0 12px 32px rgba(20, 60, 49, 0.16), inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -4px 8px rgba(0,0,0,0.15)",
        };
      case "kraft_box":
        return {
          background: "linear-gradient(135deg, #E6D7C3 0%, #DFCEB7 50%, #D8C3A8 100%)",
          borderRadius: "4px",
          border: "1px solid #C4AE91",
          boxShadow: "0 10px 28px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.4)",
        };
      case "side_gusset_pouch":
        return {
          background: isDarkSilhouette
            ? "linear-gradient(90deg, #0D1412 0%, #1A2622 15%, #141F1B 85%, #0D1412 100%)"
            : "linear-gradient(90deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0) 12%, #F4EFE6 15%, #ECE5DA 85%, rgba(0,0,0,0) 88%, rgba(0,0,0,0.06) 100%)",
          borderRadius: "4px 4px 8px 8px",
          border: isDarkSilhouette ? "1px solid rgba(215, 180, 116, 0.2)" : "1px solid rgba(0,0,0,0.1)",
          boxShadow: isDarkSilhouette ? "0 12px 32px rgba(0, 0, 0, 0.3)" : "0 12px 32px rgba(20, 60, 49, 0.12)",
        };
      case "flat_bottom_pouch":
        return {
          background: isDarkSilhouette
            ? "linear-gradient(180deg, #1A2622 0%, #121B18 70%, #0B110E 100%)"
            : "linear-gradient(180deg, #F0ECE1 0%, #E8E2D4 70%, #DDD5C4 100%)",
          borderRadius: "6px 6px 4px 4px",
          border: isDarkSilhouette ? "1.5px solid rgba(215, 180, 116, 0.2)" : "1.5px solid rgba(0,0,0,0.08)",
          boxShadow: isDarkSilhouette
            ? "0 14px 34px rgba(0, 0, 0, 0.35), inset 0 -3px 0 rgba(0,0,0,0.2)"
            : "0 14px 34px rgba(20, 60, 49, 0.12), inset 0 -3px 0 rgba(0,0,0,0.06)",
        };
      case "stand_up_pouch":
      default:
        return {
          background:
            familyCode === "jar"
              ? "linear-gradient(180deg, rgba(200,215,210,0.4) 0%, rgba(180,200,195,0.7) 100%)"
              : isDarkSilhouette
              ? "linear-gradient(180deg, #1C2823 0%, #121C18 50%, #0B110F 100%)"
              : "linear-gradient(180deg, #F0ECE1 0%, #E2DCCF 50%, #D5CEBF 100%)",
          borderRadius: "6px 6px 18px 18px",
          border: isDarkSilhouette ? "1px solid rgba(215, 180, 116, 0.25)" : "1px solid rgba(0,0,0,0.08)",
          boxShadow: isDarkSilhouette
            ? "0 14px 34px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255,255,255,0.08)"
            : "0 12px 32px rgba(20, 60, 49, 0.12), 0 2px 6px rgba(0,0,0,0.06)",
        };
    }
  };

  return (
    <div
      className={`studio-canvas-container ${className}`}
      style={{
        background: "#FFFFFF",
        borderRadius: "12px",
        border: "1px solid #DDE4DC",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Screen Reader Live Announcement */}
      <div
        id={liveRegionId}
        aria-live="polite"
        style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0,0,0,0)" }}
      >
        {ariaAnnouncement}
      </div>

      {/* Top Controls: View Tabs & Toggle Guides */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          borderBottom: "1px solid #ECEEEA",
          paddingBottom: "8px",
        }}
      >
        {/* Orientation Tabs */}
        <div
          role="tablist"
          aria-label="Package orientations"
          style={{ display: "flex", gap: "4px" }}
        >
          {(["front", "back", "top", "dieline"] as const).map((view) => {
            const isActive = activeView === view;
            const label = view.charAt(0).toUpperCase() + view.slice(1);
            return (
              <button
                key={view}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid="view-tab"
                onClick={() => handleViewClick(view)}
                style={{
                  minHeight: "36px",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "none",
                  background: isActive ? "#143C31" : "#F4F6F4",
                  color: isActive ? "#FFFCF7" : "#171713",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            data-testid="toggle-guides"
            aria-label="Toggle safe-zone guides"
            aria-pressed={guidesVisible}
            onClick={handleToggleGuides}
            style={{
              minHeight: "36px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #DDE4DC",
              background: guidesVisible ? "#EAF2EE" : "#FFFFFF",
              color: "#143C31",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {guidesVisible ? "Hide Safe Zones" : "Show Safe Zones"}
          </button>

          <PackagingDielineAction dielineUrl={packagingVariant?.dieline_url} variantTitle={packName} />
        </div>
      </div>

      {/* Low-Resolution DPI Warning Banner */}
      {isLowRes && (
        <div
          data-testid="dpi-warning"
          className="low-res-warning"
          role="alert"
          style={{
            background: "#FFF4E5",
            border: "1px solid #FFCC80",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "0.8125rem",
            color: "#B25E00",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span aria-hidden="true">⚠️</span>
          <span>
            <strong><StorefrontText id="copy_a7109a775d0ad5fe" fallback="Resolution Warning:" /></strong> <StorefrontText id="copy_ad2f53d3ef955a71" fallback="Artwork is" /> {artworkDpi} <StorefrontText id="copy_c1dbfa3221530793" fallback="DPI (recommended: 300 DPI). Preflight verification will require high-resolution vector or 300 DPI artwork prior to plate production." />
          </span>
        </div>
      )}

      {/* Safe-Zone Boundary Breach Warning */}
      {isSafeZoneBreached && (
        <div
          data-testid="safe-zone-warning"
          className="boundary-warning"
          role="alert"
          style={{
            background: "#FFEBEE",
            border: "1px solid #FFCDD2",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "0.8125rem",
            color: "#C62828",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span aria-hidden="true">🚫</span>
          <span>
            <strong><StorefrontText id="copy_e191792a36d0bd0d" fallback="Safe-Zone Breach:" /></strong><StorefrontText id="copy_8e5db3aa41e55d32" fallback="Elements extend beyond printable margins into seal or zipper areas." />
          </span>
        </div>
      )}

      {/* Mockup Preview Stage */}
      <div
        data-testid="mockup-canvas"
        className="studio-canvas mockup-stage"
        role="img"
        aria-label={canvasAriaLabel}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          position: "relative",
          width: "100%",
          minHeight: "360px",
          background: "radial-gradient(circle at center, #F8FAF7 0%, #ECEEEA 100%)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
          overflow: "hidden",
          outline: "none",
        }}
      >
        {activeView === "dieline" ? (
          /* Technical Dieline CAD Preview */
          <div
            style={{
              width: "100%",
              maxWidth: "440px",
              height: "270px",
              border: "2px dashed #65746D",
              background: "#FFFFFF",
              position: "relative",
              padding: "16px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#65746D" }}>
              <strong><StorefrontText id="copy_08c831e901f04a9e" fallback="TECHNICAL DIE CUT TEMPLATE" /></strong> &bull; {widthMm}mm &times; {heightMm}mm
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                height: "100%",
                paddingTop: "8px",
              }}
            >
              <div
                style={{
                  border: "1px dotted #B45309",
                  padding: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  color: "#B45309",
                }}
              ><StorefrontText id="copy_1e58e2761d8b24bf" fallback="Front Face (" />{safeZone.labelSafeWidthMm}<StorefrontText id="copy_faeae1a8b921c5e6" fallback="mm)" />
              </div>
              <div
                style={{
                  border: "1px dotted #B45309",
                  padding: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  color: "#B45309",
                }}
              ><StorefrontText id="copy_1ddaac32de542b8a" fallback="Back Face + Legal Reserve" />
              </div>
            </div>
            <div style={{ fontSize: "0.6875rem", color: "#8E9E96", textAlign: "right" }}><StorefrontText id="copy_b8f5cc2b2aec5a8b" fallback="Bleed:" /> {safeZone.bleedMm}mm &bull; Scale 1:1
            </div>
          </div>
        ) : (
          /* 2D Package Silhouette Stage */
          <div
            style={{
              position: "relative",
              width: "min(100%, 260px)",
              aspectRatio: aspectRatio,
              maxHeight: "390px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "16px",
              boxSizing: "border-box",
              transition: "aspect-ratio 0.25s ease, background 0.25s ease",
              ...getSilhouetteStyle(),
            }}
          >
            {/* Top Zipper / Seal Indentation Indicator for Stand-up Pouches */}
            {silhouette === "stand_up_pouch" && (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: "14px",
                  left: "12px",
                  right: "12px",
                  height: "2px",
                  background: "rgba(0,0,0,0.15)",
                  borderRadius: "1px",
                }}
              />
            )}

            {/* Tin Lid Seam Line for Tin Canisters */}
            {silhouette === "tin_canister" && (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: "22px",
                  left: 0,
                  right: 0,
                  height: "2px",
                  background: "rgba(0,0,0,0.2)",
                  boxShadow: "0 1px 2px rgba(255,255,255,0.8)",
                }}
              />
            )}

            {/* 4-Layer Guide Overlays */}
            {guidesVisible && activeView === "front" && (
              <div
                data-testid="safe-zone-overlay-container"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  zIndex: 3,
                }}
              >
                {/* 1. Bleed Line Guide (+3mm outer perimeter) */}
                <div
                  data-testid="bleed-guide"
                  style={{
                    position: "absolute",
                    inset: "-3px",
                    border: "1px dotted #DC2626",
                    borderRadius: "inherit",
                    opacity: 0.75,
                  }}
                />

                {/* 2. Cut / Trim Line (0mm physical perimeter) */}
                <div
                  data-testid="cut-line-guide"
                  style={{
                    position: "absolute",
                    inset: 0,
                    border: "1px solid rgba(23, 23, 19, 0.4)",
                    borderRadius: "inherit",
                  }}
                />

                {/* 3. Safe Zone Margin Line (Inner Printable Area) */}
                <div
                  data-testid="safe-zone-guide"
                  className="safe-zone"
                  style={{
                    position: "absolute",
                    top: `${(safeZone.marginsMm.top / heightMm) * 100}%`,
                    bottom: `${(safeZone.marginsMm.bottom / heightMm) * 100}%`,
                    left: `${(safeZone.marginsMm.left / widthMm) * 100}%`,
                    right: `${(safeZone.marginsMm.right / widthMm) * 100}%`,
                    border: isSafeZoneBreached ? "1.5px dashed #DC2626" : "1.5px dashed #143C31",
                    boxSizing: "border-box",
                    background: isSafeZoneBreached ? "rgba(220, 38, 38, 0.04)" : "rgba(20, 60, 49, 0.02)",
                  }}
                />

                {/* 4. Top Zipper / Seal Exclusion Zone (Hatches) */}
                <div
                  data-testid="top-seal-exclusion"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${(safeZone.marginsMm.top / heightMm) * 100}%`,
                    background: `repeating-linear-gradient(
                      -45deg,
                      rgba(220, 38, 38, 0.06),
                      rgba(220, 38, 38, 0.06) 6px,
                      rgba(220, 38, 38, 0.14) 6px,
                      rgba(220, 38, 38, 0.14) 12px
                    )`,
                    borderBottom: "1px dashed #DC2626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.5625rem",
                      color: "#B91C1C",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                    }}
                  ><StorefrontText id="copy_e3b02066588eda6c" fallback="SEAL RESERVE" />
                  </span>
                </div>

                {/* Side Seal Exclusion Zones */}
                <div
                  style={{
                    position: "absolute",
                    top: `${(safeZone.marginsMm.top / heightMm) * 100}%`,
                    bottom: `${(safeZone.marginsMm.bottom / heightMm) * 100}%`,
                    left: 0,
                    width: `${(safeZone.marginsMm.left / widthMm) * 100}%`,
                    background: "rgba(220, 38, 38, 0.04)",
                    borderRight: "1px dashed rgba(220, 38, 38, 0.3)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: `${(safeZone.marginsMm.top / heightMm) * 100}%`,
                    bottom: `${(safeZone.marginsMm.bottom / heightMm) * 100}%`,
                    right: 0,
                    width: `${(safeZone.marginsMm.right / widthMm) * 100}%`,
                    background: "rgba(220, 38, 38, 0.04)",
                    borderLeft: "1px dashed rgba(220, 38, 38, 0.3)",
                  }}
                />
              </div>
            )}

            {/* Front & Top View Custom Artwork / Brand Display */}
            {activeView === "front" || activeView === "top" ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: "8px",
                  zIndex: 2,
                  transform: `translate(${currentPlacement.xMm * 1.5}px, ${currentPlacement.yMm * 1.5}px) scale(${currentPlacement.scale})`,
                  transition: "transform 0.1s ease-out",
                }}
              >
                {artworkUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={artworkUrl}
                    alt={artworkFilename || "Uploaded artwork"}
                    style={{
                      maxWidth: "85%",
                      maxHeight: "130px",
                      objectFit: "contain",
                      marginBottom: "8px",
                      outline: isSafeZoneBreached ? "2px dashed #DC2626" : "none",
                    }}
                  />
                ) : null}

                <div
                  style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    color: isDarkSilhouette ? "#D7B474" : "#143C31",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    wordBreak: "break-word",
                  }}
                >
                  {brandName || "YOUR BRAND"}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    letterSpacing: "0.08em",
                    color: isDarkSilhouette ? "#DDE4DC" : "#65746D",
                    marginTop: "4px",
                  }}
                ><StorefrontText id="copy_a55677cea7d2ae1d" fallback="SINGLE ESTATE ARTISANAL TEA" />
                </div>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: isDarkSilhouette ? "#D7B474" : "#143C31",
                    marginTop: "8px",
                    padding: "2px 8px",
                    background: isDarkSilhouette ? "rgba(215, 180, 116, 0.15)" : "rgba(20, 60, 49, 0.08)",
                    border: isDarkSilhouette ? "1px solid rgba(215, 180, 116, 0.4)" : "none",
                    borderRadius: "4px",
                  }}
                ><StorefrontText id="copy_c33335cd55af1f5b" fallback="Net Wt:" /> {fillWeightGrams}g
                </div>
              </div>
            ) : null}

            {/* Back View: Specifications & Mandatory FSSAI Legal Reserve */}
            {activeView === "back" ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "4px",
                  zIndex: 2,
                }}
              >
                <div style={{ fontSize: "0.75rem", color: isDarkSilhouette ? "#FFFCF7" : "#171713" }}>
                  <strong><StorefrontText id="copy_cd7e8e0392a17ce0" fallback="Steeping Ritual:" /></strong>
                  <br />
                  2.5g &bull; 90&deg;C &bull; 3 mins
                </div>

                {/* Mandatory Legal Label Reserve Zone */}
                <div
                  data-testid="legal-label-zone"
                  className="legal-reserve"
                  style={{
                    border: "1px solid #143C31",
                    background: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "4px",
                    padding: "6px",
                    fontSize: "0.625rem",
                    lineHeight: "1.25",
                    color: "#171713",
                  }}
                >
                  <div style={{ fontWeight: "bold", color: "#143C31" }}><StorefrontText id="copy_e7b02084ca7378df" fallback="FSSAI Lic No: 19CTHPK8646J2ZY" />
                  </div>
                  <div>
                    <strong>Blended &amp; Packed by:</strong><StorefrontText id="copy_0930702caacf8c53" fallback="Nirva, 00, Fulbari Ghoshpukur Bypass, Fulbari, Binnaguri, Dist Jalpaiguri City Siliguri , West Bengal, 734015" />
                  </div>
                  <div style={{ marginTop: "2px", display: "flex", justifyContent: "space-between" }}>
                    <span><StorefrontText id="copy_c33335cd55af1f5b" fallback="Net Wt:" /> {fillWeightGrams}g</span>
                    <span><StorefrontText id="copy_7f745873dd828a54" fallback="Batch: TF-2601" /></span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Packaging Bottom Accent */}
            <div
              style={{
                height: "6px",
                background: "rgba(0,0,0,0.06)",
                borderRadius: "3px",
              }}
            />
          </div>
        )}
      </div>

      {/* Illustrative Only Disclosure Label */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.75rem",
          color: "#8E9E96",
          padding: "4px 8px",
        }}
      >
        <span role="note"><StorefrontText id="copy_7e061867d601dee9" fallback="Digital Mockup — Illustrative Only" /></span>
        <span>
          {packName} &bull; {widthMm} &times; {heightMm} mm
        </span>
      </div>
    </div>
  );
}
