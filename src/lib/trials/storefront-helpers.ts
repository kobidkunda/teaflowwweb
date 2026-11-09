/**
 * TeaFloww Trials v3 — Storefront Calculation & Logic Helpers
 *
 * Pure, deterministic business logic and arithmetic functions for:
 * - Cost-per-cup calculations with half-up paise rounding (no floating-point drift)
 * - Positive savings vs. truthful negative delta comparisons
 * - Dose and steep duration clamping
 * - Pouch stage asset resolution & fallback handling
 * - Terroir provenance formatting with graceful fallbacks
 * - Keyboard navigation (roving tabindex with circular wrapping)
 * - Responsive catalogue filtering
 */

import type { TrialPublicDto } from "./types";

/**
 * Evaluates cost per cup in Indian Rupees (₹) from price per kg and leaf dose.
 * Formula: (pricePerKg * doseGrams) / 1000
 * Uses half-up paise rounding to avoid floating-point drift (e.g. 2.500000000000001).
 */
export function calculateCostPerCup(pricePerKg: number, doseGrams: number): number {
  if (!Number.isFinite(pricePerKg) || pricePerKg < 0) return 0;
  const clampedDose = clampDoseGrams(doseGrams);
  const rawCost = (pricePerKg * clampedDose) / 1000;
  return Math.round(rawCost * 100) / 100;
}

/**
 * Formats a Rupee value as ₹X.XX.
 */
export function formatCostPerCup(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "₹0.00";
  return `₹${value.toFixed(2)}`;
}

export interface SavingsDeltaResult {
  diff: number;
  isSavings: boolean;
  formatted: string;
}

/**
 * Compares benchmark tea cost per cup against trial tea cost per cup.
 * Returns truthful positive savings when cheaper, or truthful positive delta ("+₹X.XX more / cup") when more expensive.
 */
export function calculateSavingsDelta(currentCost: number, trialCost: number): SavingsDeltaResult {
  const c = Math.max(0, Number.isFinite(currentCost) ? currentCost : 0);
  const t = Math.max(0, Number.isFinite(trialCost) ? trialCost : 0);
  const diff = Math.round((c - t) * 100) / 100;

  if (Math.abs(diff) < 0.005) {
    return {
      diff: 0,
      isSavings: false,
      formatted: "No change",
    };
  }

  if (diff > 0) {
    return {
      diff,
      isSavings: true,
      formatted: `₹${diff.toFixed(2)} saved`,
    };
  }

  const more = Math.abs(diff);
  return {
    diff,
    isSavings: false,
    formatted: `+₹${more.toFixed(2)} more / cup`,
  };
}

/**
 * Calculates total brews yielded by the assortment kit.
 * Default 200g kit / 2.5g dose = 80 cups.
 */
export function calculateKitCupYield(kitWeightGrams = 200, doseGrams = 2.5): number {
  const weight = Math.max(0, Number.isFinite(kitWeightGrams) ? kitWeightGrams : 200);
  const dose = clampDoseGrams(doseGrams);
  return Math.floor(weight / dose);
}

/**
 * Clamps leaf dose input strictly into the safe range [1.0g, 15.0g].
 * Non-numeric, negative, or zero inputs fall back to 2.5g default.
 */
export function clampDoseGrams(dose: number): number {
  if (!Number.isFinite(dose) || dose <= 0) return 2.5;
  const rounded = Math.round(dose * 10) / 10;
  return Math.min(15.0, Math.max(1.0, rounded));
}

/**
 * Validates and clamps steeping duration in seconds between 30s and 1800s.
 */
export function clampBrewingDuration(timeSec: number): number {
  if (!Number.isFinite(timeSec) || timeSec <= 0) return 180;
  return Math.min(1800, Math.max(30, Math.round(timeSec)));
}

/**
 * Locates the specific stage photography asset for a given pouch slot index.
 * Returns null when asset is not attached or pending verification.
 */
export function resolvePouchAsset(
  components: TrialPublicDto["components"] | undefined,
  slotIndex: number,
  stage: string
): { url: string; alt_text: string } | null {
  if (!components || !Array.isArray(components)) return null;
  const comp = components.find((c) => c.slot_index === slotIndex);
  if (!comp || !Array.isArray(comp.assets)) return null;

  const normalizedStage = stage.toLowerCase().replace(/[\s_-]+/g, "_");
  const asset = comp.assets.find((a) => {
    const s = a.stage.toLowerCase().replace(/[\s_-]+/g, "_");
    return s === normalizedStage;
  });

  if (!asset || !asset.url) return null;
  return {
    url: asset.url,
    alt_text: asset.alt_text || `${comp.name} ${stage}`,
  };
}

export interface FormattedProvenance {
  estate: string;
  elevation: string;
  flush: string;
  grade: string;
  lot: string;
}

/**
 * Formats terroir provenance parameters, guaranteeing zero literal "null" or "undefined" displays.
 */
export function formatProvenance(
  estate?: string | null,
  elevation?: string | null,
  flush?: string | null,
  grade?: string | null,
  lot?: string | null
): FormattedProvenance {
  return {
    estate: estate?.trim() || "Single Estate Reserve",
    elevation: elevation?.trim() || "Estate reserve",
    flush: flush?.trim() || "Seasonal Harvest",
    grade: grade?.trim() || "Whole Leaf / CTC Standard",
    lot: lot?.trim() || "Direct Garden Invoiced Lot",
  };
}

/**
 * Circular roving tab index calculation for accessible keyboard navigation.
 */
export function getNextTab(currentIndex: number, direction: "next" | "prev", totalTabs: number): number {
  if (totalTabs <= 0) return 0;
  if (direction === "next") {
    return (currentIndex + 1) % totalTabs;
  }
  return (currentIndex - 1 + totalTabs) % totalTabs;
}

/**
 * Sticky action bar visibility predicate.
 */
export function shouldShowStickyBar(scrollY: number, thresholdY: number, isMobile: boolean): boolean {
  return isMobile && scrollY > thresholdY;
}

/**
 * Formats currency in Indian Rupee representation.
 */
export function formatINR(amount: number, isPaise = true): string {
  const rupees = isPaise ? Math.round(amount) / 100 : amount;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Client-side catalogue search and tag filtering helper.
 */
export function filterTrialCards(
  trials: TrialPublicDto[],
  tag = "all",
  searchQuery = ""
): TrialPublicDto[] {
  if (!Array.isArray(trials)) return [];
  const normalizedTag = tag.toLowerCase().trim();
  const normalizedSearch = searchQuery.toLowerCase().trim();

  return trials.filter((trial) => {
    // 1. Tag filter
    if (normalizedTag && normalizedTag !== "all") {
      const tagMatch =
        trial.slug.toLowerCase().includes(normalizedTag) ||
        trial.title.toLowerCase().includes(normalizedTag) ||
        (normalizedTag === "tea-stall" || normalizedTag === "stall"
          ? trial.title.toLowerCase().includes("stall") || trial.slug.toLowerCase().includes("stall")
          : false) ||
        (normalizedTag === "flavoured"
          ? trial.title.toLowerCase().includes("spice") ||
            trial.title.toLowerCase().includes("flavour") ||
            trial.components.some((c) => /elaichi|ginger|masala|cardamom|tulsi/i.test(c.name))
          : false) ||
        (normalizedTag === "cafe"
          ? trial.title.toLowerCase().includes("orthodox") ||
            trial.title.toLowerCase().includes("himalayan") ||
            trial.components.some((c) => /orthodox|ftgfop/i.test(c.grade))
          : false) ||
        trial.components.some(
          (c) =>
            c.name.toLowerCase().includes(normalizedTag) ||
            c.grade.toLowerCase().includes(normalizedTag) ||
            c.flush.toLowerCase().includes(normalizedTag)
        );
      if (!tagMatch) return false;
    }

    // 2. Search query filter
    if (normalizedSearch) {
      const searchMatch =
        trial.title.toLowerCase().includes(normalizedSearch) ||
        (trial.tagline && trial.tagline.toLowerCase().includes(normalizedSearch)) ||
        (trial.description && trial.description.toLowerCase().includes(normalizedSearch)) ||
        trial.sku.toLowerCase().includes(normalizedSearch) ||
        trial.components.some(
          (c) =>
            c.name.toLowerCase().includes(normalizedSearch) ||
            c.estate.toLowerCase().includes(normalizedSearch) ||
            c.grade.toLowerCase().includes(normalizedSearch) ||
            c.tasting_notes.some((n) => n.toLowerCase().includes(normalizedSearch))
        );
      if (!searchMatch) return false;
    }

    return true;
  });
}
