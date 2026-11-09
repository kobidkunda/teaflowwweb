"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import type { TrialPublicDto } from "@/lib/trials/types";
import { resolvePouchAsset, getNextTab } from "@/lib/trials/storefront-helpers";
import { getTrialText, type TrialLocale } from "@/lib/trials/i18n";

export interface TrialOpticalStudioProps {
  components: TrialPublicDto["components"];
  activePouchIndex?: number;
  onPouchChange?: (index: number) => void;
  locale?: TrialLocale;
  heroImage?: { url: string; alt_text: string } | null;
  galleryImages?: Array<{ url: string; alt_text: string }>;
}

export const OPTICAL_STAGES = [
  { id: "packaging", labelKey: "stage_packaging", fallback: "Packaging" },
  { id: "dry_leaf", labelKey: "stage_dry_leaf", fallback: "Dry Leaf" },
  { id: "infused_leaf", labelKey: "stage_infused_leaf", fallback: "Wet Leaf" },
  { id: "liquor", labelKey: "stage_liquor", fallback: "Raw Liquor" },
  { id: "milk_tea", labelKey: "stage_milk_tea", fallback: "Milk Tea" },
] as const;

export function TrialOpticalStudio({
  components,
  activePouchIndex: controlledPouchIndex,
  onPouchChange,
  locale = "en",
  heroImage,
  galleryImages = [],
}: TrialOpticalStudioProps) {
  const [internalPouchIndex, setInternalPouchIndex] = useState(0);
  const [selectedStage, setSelectedStage] = useState<string>("milk_tea");
  const [selectedGalleryIdx, setSelectedGalleryIdx] = useState<number | null>(null);

  const activePouchIndex =
    typeof controlledPouchIndex === "number" ? controlledPouchIndex : internalPouchIndex;

  const handleSelectPouch = useCallback(
    (index: number) => {
      setInternalPouchIndex(index);
      setSelectedGalleryIdx(null);
      onPouchChange?.(index);
    },
    [onPouchChange]
  );

  const activePouch = components[activePouchIndex] || components[0] || {
    slot_index: 0,
    name: "Strong Milk Chai",
    estate: "Assam Estate",
    grade: "CTC BP",
    flush: "Second Flush",
    elevation: null,
    weight_g: 50,
    tasting_notes: [],
    brewing: { temp_c: 95, time_sec: 180, dose_g: 2.5 },
    bulk_link: null,
    assets: [],
  };

  const resolvedAsset = resolvePouchAsset(components, activePouch.slot_index, selectedStage);
  const packagingAsset = resolvePouchAsset(components, activePouch.slot_index, "packaging");

  const activeGalleryAsset =
    selectedGalleryIdx !== null && galleryImages[selectedGalleryIdx]
      ? galleryImages[selectedGalleryIdx]
      : null;

  // Keyboard navigation for pouch tabs
  const pouchTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stageTabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handlePouchKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIdx = getNextTab(index, "next", components.length);
      handleSelectPouch(nextIdx);
      pouchTabRefs.current[nextIdx]?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIdx = getNextTab(index, "prev", components.length);
      handleSelectPouch(prevIdx);
      pouchTabRefs.current[prevIdx]?.focus();
    }
  };

  const handleStageKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIdx = getNextTab(index, "next", OPTICAL_STAGES.length);
      setSelectedStage(OPTICAL_STAGES[nextIdx].id);
      setSelectedGalleryIdx(null);
      stageTabRefs.current[nextIdx]?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIdx = getNextTab(index, "prev", OPTICAL_STAGES.length);
      setSelectedStage(OPTICAL_STAGES[prevIdx].id);
      setSelectedGalleryIdx(null);
      stageTabRefs.current[prevIdx]?.focus();
    }
  };

  return (
    <div className="optical border border-[#d59e5b30] rounded-[23px] bg-[#171311] p-5 sm:p-7 shadow-[0_30px_72px_rgba(0,0,0,0.24)] text-[#f7f2eb]">
      <div className="text-[10px] uppercase tracking-[0.23em] font-extrabold text-[#e5b869] mb-1">
        TEAPILOT OPTICAL STUDIO — VERIFIED SAMPLES
      </div>
      <p className="text-[#a89a8e] text-[12px] mb-5">
        Choose a sachet and camera stage. Photography captures authentic garden leaf color and liquor extraction.
      </p>

      {/* 4 Pouch Tabs */}
      <div
        className="tabs grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5"
        role="tablist"
        aria-label="Pouch sachets"
      >
        {components.map((c, idx) => {
          const isSelected = activePouchIndex === idx;
          return (
            <button
              key={c.slot_index ?? idx}
              id={`pouch-tab-${idx}`}
              aria-controls="optical-studio-panel"
              ref={(el) => {
                pouchTabRefs.current[idx] = el;
              }}
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              data-testid="optical-pouch-tab"
              data-pouch-index={idx}
              onClick={() => handleSelectPouch(idx)}
              onKeyDown={(e) => handlePouchKeyDown(e, idx)}
              className={`text-left p-3 rounded-[10px] border transition-all ${
                isSelected
                  ? "bg-[#3a291e] border-[#e5b869] text-[#ffecba] shadow-sm"
                  : "bg-[#261e19] border-[#544537] text-[#c5ad94] hover:border-[#8c745f]"
              }`}
            >
              <span className="block text-[9px] uppercase tracking-[0.12em] text-[#e5b869] font-bold mb-1">
                POUCH 0{idx + 1} · {c.weight_g}G
              </span>
              <strong className="block text-[13px] font-serif font-normal truncate">
                {c.name}
              </strong>
            </button>
          );
        })}
      </div>

      {/* Visual Photo Studio Display */}
      <div
        id="optical-studio-panel"
        role="tabpanel"
        aria-labelledby={`pouch-tab-${activePouchIndex}`}
        className="orbscene relative border border-[#4d332a] bg-[radial-gradient(ellipse_at_50%_48%,#72331f55,#100e0d_67%)] min-h-[300px] sm:min-h-[340px] rounded-[17px] flex flex-col justify-center items-center text-center overflow-hidden p-6"
      >
        {activeGalleryAsset ? (
          <div className="relative w-full h-[220px] sm:h-[260px] flex items-center justify-center">
            <Image
              key={`gallery-${selectedGalleryIdx}-${activeGalleryAsset.url}`}
              src={activeGalleryAsset.url}
              alt={activeGalleryAsset.alt_text || "TeaFloww Discovery Kit Mockup"}
              fill
              className="optical-stage-img object-contain transition-opacity duration-200"
              sizes="(max-width: 630px) 100vw, 600px"
              priority
            />
          </div>
        ) : resolvedAsset ? (
          <div className="relative w-full h-[220px] sm:h-[260px] flex items-center justify-center">
            <Image
              key={`stage-${activePouchIndex}-${selectedStage}-${resolvedAsset.url}`}
              src={resolvedAsset.url}
              alt={resolvedAsset.alt_text || `${activePouch.name} ${selectedStage}`}
              fill
              className="optical-stage-img object-contain transition-opacity duration-200"
              data-testid="optical-stage-image"
              sizes="(max-width: 630px) 100vw, 600px"
            />
          </div>
        ) : (
          <div
            data-testid="missing-photo-fallback"
            className="photo-pending flex flex-col items-center justify-center py-8"
          >
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#e5b86966] bg-[#221a16] flex items-center justify-center mb-3">
              <span className="text-[#e5b869] text-2xl font-serif">❖</span>
            </div>
            <strong className="block font-serif text-[18px] text-[#f7eedb] mb-1">
              Photo pending verification
            </strong>
            <p className="text-[11px] text-[#a89a8e] max-w-xs mb-3">
              Batch photo for {activePouch.name} ({selectedStage.replace("_", " ")}) is undergoing spectral verification.
            </p>
            {packagingAsset && (
              <button
                type="button"
                onClick={() => {
                  setSelectedStage("packaging");
                  setSelectedGalleryIdx(null);
                }}
                className="text-[11px] text-[#e5b869] font-semibold underline hover:text-[#ffd68a] transition-colors"
              >
                View {activePouch.name} pouch artwork →
              </button>
            )}
          </div>
        )}

        <div className="mt-3">
          <strong className="block font-serif text-[18px] text-[#f7eedb]">
            {activeGalleryAsset ? "TeaFloww Discovery Flight" : activePouch.name}
          </strong>
          <span className="text-[10px] uppercase tracking-[0.16em] text-[#e5b869] font-bold">
            {activeGalleryAsset
              ? `PACK OVERVIEW · PHOTO ${selectedGalleryIdx! + 1} OF ${galleryImages.length}`
              : `STAGE · ${selectedStage.toUpperCase().replace("_", " ")}`}
          </span>
        </div>
      </div>

      {/* 5 Stage Tabs */}
      <div
        className="stages flex gap-2 flex-wrap mt-4"
        role="tablist"
        aria-label="Optical photography stages"
      >
        {OPTICAL_STAGES.map((s, idx) => {
          const isSelected = selectedGalleryIdx === null && selectedStage === s.id;
          const stageLabel = getTrialText(s.labelKey, locale) || s.fallback;
          const hasPhoto = Boolean(resolvePouchAsset(components, activePouch.slot_index, s.id));
          return (
            <button
              key={s.id}
              aria-controls="optical-studio-panel"
              ref={(el) => {
                stageTabRefs.current[idx] = el;
              }}
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              data-testid="optical-stage-tab"
              onClick={() => {
                setSelectedStage(s.id);
                setSelectedGalleryIdx(null);
              }}
              onKeyDown={(e) => handleStageKeyDown(e, idx)}
              className={`flex-1 min-w-[85px] py-2 px-2.5 rounded-[9px] border text-[11px] font-bold text-center transition-all inline-flex items-center justify-center gap-1.5 ${
                isSelected
                  ? "border-[#e5b869] bg-[#634127] text-white shadow-sm"
                  : "border-[#514238] bg-[#221a16] text-[#bba79a] hover:border-[#8c745f]"
              }`}
            >
              <span>{stageLabel}</span>
              {hasPhoto && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#34d399] shrink-0"
                  aria-label="Verified sample photo available"
                  title="Photo available"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Discovery Pack Gallery Strip */}
      {galleryImages.length > 0 && (
        <div className="kit-gallery-strip mt-6 pt-5 border-t border-[#4d332a]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-[0.16em] text-[#e5b869] font-bold">
              DISCOVERY PACK GALLERY ({galleryImages.length} VIEWS)
            </span>
            <span className="text-[11px] text-[#a89a8e]">
              Click thumbnail to preview box &amp; lifestyle mockups
            </span>
          </div>
          <div
            className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin"
            role="tablist"
            aria-label="Discovery pack mockup gallery"
          >
            {galleryImages.map((img, idx) => {
              const isSelected = selectedGalleryIdx === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedGalleryIdx(idx)}
                  className={`relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg overflow-hidden border transition-all ${
                    isSelected
                      ? "border-[#e5b869] ring-2 ring-[#e5b869] ring-opacity-50"
                      : "border-[#4d332a] opacity-75 hover:opacity-100 hover:border-[#8c745f]"
                  }`}
                  title={img.alt_text || `Pack view ${idx + 1}`}
                >
                  <Image
                    src={img.url}
                    alt={img.alt_text || `Pack view ${idx + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
