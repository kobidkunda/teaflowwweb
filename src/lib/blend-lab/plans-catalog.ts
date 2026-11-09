/**
 * TeaFloww Blend Lab — Authoritative Service Plans & Entitlements Catalog
 * Prices are strictly stored in integer INR paise.
 * Tax calculations follow B2B professional services (18% GST = 1800 basis points).
 * This module is pure TypeScript / arithmetic without database dependencies,
 * making it safe for both server components and client UI wizards.
 */

export type PlanCode = "MATCH_QUOTE" | "QUALITY_AUDIT" | "SIGNATURE";

export interface PlanEntitlements {
  inboundShipments: number;
  outboundShipments: number;
  detailedPdf: boolean;
  developmentIncluded: boolean;
  includedRevisionRounds: number;
  includedTrialCandidates: number;
  turnaroundDays: number;
  sampleWeightGrams: number;
}

export interface ServicePlan {
  code: PlanCode;
  title: string;
  eyebrow: string;
  tagline: string;
  description: string;
  totalPaise: number;
  taxRateBps: number;
  active?: boolean;
  highlighted?: boolean;
  badge?: string;
  features: readonly string[];
  exclusions: readonly string[];
  buttonLabel: string;
  entitlements: PlanEntitlements;
}

export interface UpsertPlanInput {
  code: PlanCode;
  title?: string;
  eyebrow?: string;
  tagline?: string;
  description?: string;
  totalPaise: number;
  taxRateBps?: number;
  active?: boolean;
  highlighted?: boolean;
  badge?: string;
  features?: string[];
  exclusions?: string[];
  buttonLabel?: string;
  entitlements?: Partial<PlanEntitlements>;
}

export const BLEND_LAB_PLANS: Record<PlanCode, ServicePlan> = {
  MATCH_QUOTE: {
    code: "MATCH_QUOTE",
    title: "Match & Quote",
    eyebrow: "START WITH A REFERENCE",
    tagline: "Commercial sourcing alternatives for your daily reference tea.",
    description: "Compare your current commercial blend against verified Himalayan single-estate and auction alternatives.",
    totalPaise: 29900,
    taxRateBps: 1800,
    features: [
      "Inbound courier pickup (up to 100g sample)",
      "Professional sensory reference cupping",
      "Bulk commercial sourcing price proposal",
      "Concise matching notes & garden recommendations",
    ],
    exclusions: [
      "No detailed PDF laboratory report",
      "No outbound physical trial samples",
      "No custom formulation development",
    ],
    buttonLabel: "Select Match & Quote",
    entitlements: {
      inboundShipments: 1,
      outboundShipments: 0,
      detailedPdf: false,
      developmentIncluded: false,
      includedRevisionRounds: 0,
      includedTrialCandidates: 0,
      turnaroundDays: 5,
      sampleWeightGrams: 100,
    },
  },
  QUALITY_AUDIT: {
    code: "QUALITY_AUDIT",
    title: "Tea Quality Audit",
    eyebrow: "UNDERSTAND YOUR CUP",
    tagline: "Objective sensory benchmarking and actionable cup diagnostics.",
    description: "Thorough multi-parameter sensory evaluation of leaf, liquor, infused leaf, and milk response with actionable guidance.",
    totalPaise: 199900,
    taxRateBps: 1800,
    features: [
      "Inbound courier pickup (up to 100g sample)",
      "Standardized 4-stage professional cupping protocol",
      "Comprehensive multi-page PDF evaluation report",
      "Leaf grading, liquor character & milk curdling analysis",
      "Actionable estate and lot recommendations",
    ],
    exclusions: [
      "No custom physical formulation trials",
      "No outbound trial samples shipped",
    ],
    buttonLabel: "Select Quality Audit",
    entitlements: {
      inboundShipments: 1,
      outboundShipments: 0,
      detailedPdf: true,
      developmentIncluded: false,
      includedRevisionRounds: 0,
      includedTrialCandidates: 0,
      turnaroundDays: 7,
      sampleWeightGrams: 100,
    },
  },
  SIGNATURE: {
    code: "SIGNATURE",
    title: "Signature Blend Lab",
    eyebrow: "COMPLETE BLEND ATELIER",
    tagline: "Full sensory formulation, trial batch shipment, and customer revision.",
    description: "End-to-end custom formulation targeting your exact taste profile, margin requirements, and brewing methods.",
    totalPaise: 299900,
    taxRateBps: 1800,
    highlighted: true,
    badge: "Most Complete",
    features: [
      "Inbound reference pickup (up to 200g sample)",
      "Comprehensive PDF evaluation report with provenance",
      "Custom recipe formulation (2 candidate variations)",
      "1 outbound physical trial shipment delivered to you",
      "1 defined feedback & refinement revision round",
      "Production-ready wholesale quotation (26 kg+ MOQ)",
    ],
    exclusions: [
      "Commercial volume production invoiced separately",
    ],
    buttonLabel: "Develop Signature Blend",
    entitlements: {
      inboundShipments: 1,
      outboundShipments: 1,
      detailedPdf: true,
      developmentIncluded: true,
      includedRevisionRounds: 1,
      includedTrialCandidates: 2,
      turnaroundDays: 14,
      sampleWeightGrams: 200,
    },
  },
} as const;

export const ORDERED_PLANS: readonly ServicePlan[] = [
  BLEND_LAB_PLANS.MATCH_QUOTE,
  BLEND_LAB_PLANS.QUALITY_AUDIT,
  BLEND_LAB_PLANS.SIGNATURE,
];

/**
 * Calculates tax breakdown for tax-inclusive pricing.
 * Server owns this logic to avoid client rounding discrepancies.
 */
export function splitTaxInclusive(totalPaise: number, taxRateBps: number = 1800) {
  if (!Number.isSafeInteger(totalPaise) || totalPaise < 0) {
    throw new Error("Invalid total paise");
  }
  if (!Number.isSafeInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10000) {
    throw new Error("Invalid tax rate basis points");
  }
  const basePaise = Math.round((totalPaise * 10000) / (10000 + taxRateBps));
  const taxPaise = totalPaise - basePaise;
  return { basePaise, taxPaise, totalPaise, taxRateBps };
}

export function formatInr(paise: number): string {
  if (!Number.isSafeInteger(paise)) throw new Error("Invalid paise amount");
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

/** Entitlement check: Does this plan grant access to the full PDF report? */
export function canDownloadPdfReport(planCode: string): boolean {
  if (planCode in BLEND_LAB_PLANS) {
    return Boolean(BLEND_LAB_PLANS[planCode as PlanCode].entitlements.detailedPdf);
  }
  return false;
}

/** Entitlement check: Does this plan include outbound trial blend dispatches? */
export function canRequestTrialBlend(planCode: string): boolean {
  if (planCode in BLEND_LAB_PLANS) {
    const plan = BLEND_LAB_PLANS[planCode as PlanCode];
    return Boolean(plan.entitlements.developmentIncluded && plan.entitlements.outboundShipments > 0);
  }
  return false;
}
