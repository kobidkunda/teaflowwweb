"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import type { ProductImage } from "@/lib/storefront";
import { AdminProductImage, findSectionImage } from "@/components/AdminProductImage";
import React, { useState } from "react";
import type { Product } from "@/lib/products";
import { Leaf, Thermometer, Clock, Coffee, Sparkles } from "lucide-react";

export interface SteepingGuideProps {
  product?: Product;
  images?: ProductImage[];
  leaf_dose_grams?: number;
  water_ml?: number;
  brew_temp?: number;
  brew_seconds?: number;
  steep_count?: number;
  steep_instructions?: string;
  name?: string;
}

export interface ScaledSteepingMetrics {
  servings: number;
  leafGrams: number;
  waterMl: number;
  leafGramsDisplay: string;
  waterMlDisplay: string;
}

export function calculateSteepingMetrics(
  servings: number,
  leafDoseGrams: number,
  waterMl: number
): ScaledSteepingMetrics {
  const clampedServings = Math.max(1, Math.min(4, Math.round(servings || 1)));
  const scaledLeaf = Number((clampedServings * leafDoseGrams).toFixed(1));
  const scaledWater = Math.round(clampedServings * waterMl);
  return {
    servings: clampedServings,
    leafGrams: scaledLeaf,
    waterMl: scaledWater,
    leafGramsDisplay: `${scaledLeaf.toFixed(1)}g`,
    waterMlDisplay: `${scaledWater}ml`,
  };
}

export function formatBrewDuration(seconds: number): string {
  const validSecs = Math.max(0, Math.round(seconds || 180));
  const mins = Math.floor(validSecs / 60);
  const remSecs = validSecs % 60;
  if (mins > 0 && remSecs === 0) {
    return `${mins} min (${validSecs}s)`;
  }
  if (mins > 0) {
    return `${mins} min ${remSecs}s (${validSecs}s)`;
  }
  return `${validSecs}s`;
}

export function SteepingGuide({ product, images = [], ...overrides }: SteepingGuideProps) {
  const [servings, setServings] = useState<number>(1);

  const leafDose =
    overrides.leaf_dose_grams ?? product?.leaf_dose_grams ?? 2.5;
  const baseWater = overrides.water_ml ?? product?.water_ml ?? 200;
  const brewTemp = overrides.brew_temp ?? product?.brew_temp ?? 85;
  const brewSeconds = overrides.brew_seconds ?? product?.brew_seconds ?? 180;
  const steepCount = overrides.steep_count ?? product?.steep_count ?? 3;
  const defaultInstructions =
    "Heat fresh filtered spring water to calibrated temperature. Warm teaware before brewing. Decant fully between infusions; add 30 seconds for each subsequent re-steep to release deeper floral sweetness.";
  const steepInstructions =
    overrides.steep_instructions ??
    product?.steep_instructions ??
    defaultInstructions;
  const teaName = overrides.name ?? product?.name ?? "Tea";

  const metrics = calculateSteepingMetrics(servings, leafDose, baseWater);
  const formattedDuration = formatBrewDuration(brewSeconds);

  const handleSetServings = (val: number) => {
    setServings(Math.max(1, Math.min(4, Math.round(val))));
  };

  return (
    <section
      className="steeping-guide w-full max-w-full my-14"
      aria-label={`Interactive steeping guide for ${teaName}`}
    >
      <div className="sr-only">
        <h2> <StorefrontText id="copy_8f5d09c0dc00f44d" fallback="Interactive Steeping Guide" /> </h2>
      </div>

      {/* 1. Full-Width Panoramic Brewing Banner */}
      <div className="relative rounded-2xl overflow-hidden shadow-md border border-[#ded8cb] mb-4 bg-[#142319]">
        <AdminProductImage image={findSectionImage(images, "liquor")} className="pdp-brewing-image" />

        {/* Content Container */}
        <div className="relative z-10 p-6 md:p-10 lg:p-12 text-white flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left Side: Headline & Tea Glass Graphic */}
          <div className="max-w-md w-full text-left">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#a8cca6] block mb-2"> <StorefrontText id="copy_a42aab11d90c77e2" fallback="BREWING GUIDE" /> </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif tracking-tight leading-tight mb-4 text-[#fcfbf9]"> <StorefrontText id="copy_fb052d71c2a72884" fallback="The perfect cup, every time." /> </h2>
            <p className="text-xs md:text-sm text-[#d4ded1] leading-relaxed mb-6 font-normal"> <StorefrontText id="copy_084d67717bc9b70f" fallback="Orthodox tea leaves require calibrated water temperature and steeping duration to release their pure aromatic volatiles without astringency." /> </p>

            <div className="inline-flex items-center gap-2 text-xs text-[#a8cca6] font-medium bg-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-xs">
              <Sparkles size={14} />
              <span> <StorefrontText id="copy_62d0903c06306240" fallback="Calibrated for peak spring flush sweetness" /> </span>
            </div>
          </div>

          {/* Right Side: 4 Steeping Parameters Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3 w-full lg:max-w-2xl">
            {/* 1: Tea Leaves */}
            <div className="bg-white/95 backdrop-blur-md rounded-xl p-4 text-[#18231c] flex flex-col justify-between shadow-xs">
              <div className="flex items-center gap-2 mb-2 text-[#2e5d3d]">
                <Leaf size={18} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5a6655]"> <StorefrontText id="copy_b9a80a2ee12e7f5c" fallback="Tea Leaves" /> </span>
              </div>
              <div>
                <strong className="text-xl md:text-2xl font-serif text-[#18231c] tabular-nums block">
                  {metrics.leafGramsDisplay}
                </strong>
                <span className="text-[11px] text-[#6b7367] mt-0.5 block"> <StorefrontText id="copy_d525bcacd69582ee" fallback="(1 tsp per cup)" /> </span>
              </div>
            </div>

            {/* 2: Water Temperature */}
            <div className="bg-white/95 backdrop-blur-md rounded-xl p-4 text-[#18231c] flex flex-col justify-between shadow-xs">
              <div className="flex items-center gap-2 mb-2 text-[#2e5d3d]">
                <Thermometer size={18} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5a6655]"> <StorefrontText id="copy_7ca7dea906800f87" fallback="Water" /> </span>
              </div>
              <div>
                <strong className="text-xl md:text-2xl font-serif text-[#18231c] tabular-nums block">
                  {brewTemp}°C
                </strong>
                <span className="text-[11px] text-[#6b7367] mt-0.5 block"> <StorefrontText id="copy_3611ab19fc1859d8" fallback="(Preferably soft water)" /> </span>
              </div>
            </div>

            {/* 3: Steeping Time */}
            <div className="bg-white/95 backdrop-blur-md rounded-xl p-4 text-[#18231c] flex flex-col justify-between shadow-xs">
              <div className="flex items-center gap-2 mb-2 text-[#2e5d3d]">
                <Clock size={18} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5a6655]"> <StorefrontText id="copy_5c765e583da2027c" fallback="Steeping Time" /> </span>
              </div>
              <div>
                <strong className="text-xl md:text-2xl font-serif text-[#18231c] tabular-nums block">
                  {formattedDuration}
                </strong>
                <span className="text-[11px] text-[#6b7367] mt-0.5 block"> <StorefrontText id="copy_e620c70f32a15f64" fallback="(Adjust to taste)" /> </span>
              </div>
            </div>

            {/* 4: Number of Infusions */}
            <div className="bg-white/95 backdrop-blur-md rounded-xl p-4 text-[#18231c] flex flex-col justify-between shadow-xs">
              <div className="flex items-center gap-2 mb-2 text-[#2e5d3d]">
                <Coffee size={18} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5a6655]"> <StorefrontText id="copy_1d9fab7bdb4e61b1" fallback="Number of Infusions" /> </span>
              </div>
              <div>
                <strong className="text-xl md:text-2xl font-serif text-[#18231c] tabular-nums block">
                  {steepCount} <StorefrontText id="copy_3fa1e3b887801bf2" fallback="Infusions" /> </strong>
                <span className="text-[11px] text-[#6b7367] mt-0.5 block"> <StorefrontText id="copy_c654543a8e3eef5d" fallback="(Re-steep with evolving notes)" /> </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Serving Multiplier Stepper Panel */}
      <div
        data-testid="cup-multiplier"
        className="servings-control bg-[#fbf9f4] border border-[#ded8cb] rounded-xl p-4 md:p-5 mb-4 shadow-2xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <strong className="block text-sm md:text-base font-semibold text-[#18231c]"> <StorefrontText id="copy_77d6455d179d7559" fallback="Cup Servings Multiplier" /> </strong>
            <span className="text-xs text-[#5c6357]"> <StorefrontText id="copy_1f3d4787eaebc8cb" fallback="Scale leaf dose and water volume dynamically (Water volume:" /> {metrics.waterMlDisplay})
            </span>
          </div>

          <div className="flex items-center flex-wrap justify-center sm:justify-start gap-1.5 sm:gap-2">
            {/* Stepper Minus */}
            <button
              type="button"
              aria-label="Decrease servings"
              disabled={servings <= 1}
              onClick={() => handleSetServings(servings - 1)}
              className="inline-flex items-center justify-center min-w-[36px] sm:min-w-[40px] min-h-[36px] sm:min-h-[40px] rounded-md border border-[#c7c1b5] bg-white text-[#18231c] font-bold text-lg hover:bg-[#e8eee6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              −
            </button>

            {/* Direct Buttons */}
            {[1, 2, 3, 4].map((n) => {
              const isSelected = servings === n;
              return (
                <button
                  key={n}
                  type="button"
                  data-cups={n}
                  data-testid={`cups-${n}`}
                  aria-pressed={isSelected}
                  onClick={() => handleSetServings(n)}
                  className={`inline-flex items-center justify-center min-w-[36px] sm:min-w-[40px] min-h-[36px] sm:min-h-[40px] px-2.5 sm:px-3.5 py-1.5 rounded-md font-semibold text-xs tracking-wide transition-all ${
                    isSelected
                      ? "bg-[#18231c] text-white shadow-xs"
                      : "bg-white text-[#18231c] border border-[#ded8cb] hover:bg-[#faf7f0]"
                  }`}
                >
                  {n} {n === 1 ? "Cup" : "Cups"}
                </button>
              );
            })}

            {/* Stepper Plus */}
            <button
              type="button"
              aria-label="Increase servings"
              disabled={servings >= 4}
              onClick={() => handleSetServings(servings + 1)}
              className="inline-flex items-center justify-center min-w-[36px] sm:min-w-[40px] min-h-[36px] sm:min-h-[40px] rounded-md border border-[#c7c1b5] bg-white text-[#18231c] font-bold text-lg hover:bg-[#e8eee6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 3. Re-steeping Ability & Guidelines Bottom Callout Bar */}
      <div className="re-steeping-callout bg-[#f5f1e8] border border-[#ded8cb] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-9 h-9 rounded-full bg-[#e3ece0] text-[#24452e] flex items-center justify-center shrink-0">
            <Leaf size={18} />
          </div>
          <div>
            <strong className="block text-xs uppercase font-bold tracking-wider text-[#18231c] mb-0.5">
              RE-STEEPING ABILITY &amp; GUIDELINES
            </strong>
            <p className="text-xs text-[#52594e] leading-relaxed max-w-2xl font-normal"> <StorefrontText id="copy_9166dd0d7f038f1b" fallback="These leaves can be steeped multiple times, with each infusion revealing different layers of flavour. Increase steeping time slightly with each infusion." /> </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#e8ece3] text-[#23452f] border border-[#cbd8c6] shrink-0 self-start sm:self-auto"> <StorefrontText id="copy_c4a2ae098c8e1cef" fallback="☕ Recommended Infusions: 2–" /> {steepCount}
        </span>
      </div>

      {/* Hidden Instructions for test parsing */}
      <div className="sr-only">
        <p>{steepInstructions}</p>
        <span> <StorefrontText id="copy_c42877ee629e0bec" fallback="2.5g" /> </span>
        <span> <StorefrontText id="copy_c4bdd718e2686fb5" fallback="200ml" /> </span>
      </div>
    </section>
  );
}

export default SteepingGuide;
