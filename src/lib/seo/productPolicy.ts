import { getDynamicSiteConfig, getSiteUrl } from "./site";
import {
  getApprovedReviewSummary,
  type ReviewEntityType,
  type ReviewSummary,
} from "@/lib/reviews";

export interface ProductPolicyOverrides {
  shipping_fee_paise_override?: number | null;
  handling_days_min_override?: number | null;
  handling_days_max_override?: number | null;
  transit_days_min_override?: number | null;
  transit_days_max_override?: number | null;
  return_window_days_override?: number | null;
  return_fees_override?: string | null;
}

export interface ResolvedProductCommercePolicy {
  brandName: string;
  sellerName: string;
  sellerLegalName: string;
  currency: string;
  applicableCountry: string;
  handlingDaysMin: number;
  handlingDaysMax: number;
  transitDaysMin: number;
  transitDaysMax: number;
  totalDeliveryDaysMin: number;
  totalDeliveryDaysMax: number;
  deliveryWindowLabel: string;
  flatShippingPaise: number;
  hasExplicitShippingOverride: boolean;
  freeShippingEnabled: boolean;
  freeShippingThresholdPaise: number;
  returnWindowDays: number;
  returnMethod: "ReturnByMail" | "ReturnInStore" | "ReturnAtKiosk";
  returnFees: "FreeReturn" | "ReturnShippingFees" | "ReturnFeesCustomerResponsibility";
  returnPolicyLabel: string;
  returnPolicyUrl: string;
  reviewSummary: ReviewSummary | null;
  computeShippingRatePaise: (itemPricePaise: number) => number;
}

export interface ClientCommercePolicy {
  deliveryWindowLabel: string;
  flatShippingPaise: number;
  hasExplicitShippingOverride: boolean;
  freeShippingEnabled: boolean;
  freeShippingThresholdPaise: number;
  returnWindowDays: number;
  returnMethod: "ReturnByMail" | "ReturnInStore" | "ReturnAtKiosk";
  returnFees: "FreeReturn" | "ReturnShippingFees" | "ReturnFeesCustomerResponsibility";
  reviewSummary: ReviewSummary | null;
}

export function toClientCommercePolicy(
  policy: ResolvedProductCommercePolicy
): ClientCommercePolicy {
  return {
    deliveryWindowLabel: policy.deliveryWindowLabel,
    flatShippingPaise: policy.flatShippingPaise,
    hasExplicitShippingOverride: policy.hasExplicitShippingOverride,
    freeShippingEnabled: policy.freeShippingEnabled,
    freeShippingThresholdPaise: policy.freeShippingThresholdPaise,
    returnWindowDays: policy.returnWindowDays,
    returnMethod: policy.returnMethod,
    returnFees: policy.returnFees,
    reviewSummary: policy.reviewSummary,
  };
}

export function normalizeReturnFees(
  raw: string | null | undefined
): "FreeReturn" | "ReturnShippingFees" | "ReturnFeesCustomerResponsibility" {
  switch (raw) {
    case "ReturnShippingFees":
      return "ReturnShippingFees";
    case "ReturnFeesCustomerResponsibility":
      return "ReturnFeesCustomerResponsibility";
    case "FreeReturn":
    default:
      return "FreeReturn";
  }
}

export function normalizeReturnMethod(
  raw: string | null | undefined
): "ReturnByMail" | "ReturnInStore" | "ReturnAtKiosk" {
  switch (raw) {
    case "ReturnInStore":
      return "ReturnInStore";
    case "ReturnAtKiosk":
      return "ReturnAtKiosk";
    case "ReturnByMail":
    default:
      return "ReturnByMail";
  }
}

function toOptionalNonNegativeInt(val: number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/**
 * Resolves effective shipping cost, delivery window, return policy, and verified review
 * aggregate for any catalog product, trial kit, or private-label packaging item.
 */
export function resolveProductCommercePolicy(options?: {
  entityType?: ReviewEntityType;
  entityId?: string | number;
  overrides?: ProductPolicyOverrides | null;
  extraHandlingDays?: number;
  reviewSummary?: ReviewSummary | null;
  siteUrlOverride?: string;
}): ResolvedProductCommercePolicy {
  const config = getDynamicSiteConfig();
  const siteUrl = (options?.siteUrlOverride || getSiteUrl()).replace(/\/+$/, "");
  const ov = options?.overrides || {};

  const storeShipping = config.shipping;
  const storeReturns = config.returns;

  const extraHandling = Math.max(0, Math.floor(options?.extraHandlingDays || 0));

  const ovHandlingMin = toOptionalNonNegativeInt(ov.handling_days_min_override);
  const ovHandlingMax = toOptionalNonNegativeInt(ov.handling_days_max_override);
  const ovTransitMin = toOptionalNonNegativeInt(ov.transit_days_min_override);
  const ovTransitMax = toOptionalNonNegativeInt(ov.transit_days_max_override);

  const baseHandlingMin = ovHandlingMin ?? ("handlingDaysMin" in storeShipping ? storeShipping.handlingDaysMin : 1);
  const baseHandlingMax = Math.max(
    baseHandlingMin,
    ovHandlingMax ?? ("handlingDaysMax" in storeShipping ? storeShipping.handlingDaysMax : 2)
  );

  const handlingDaysMin = baseHandlingMin + extraHandling;
  const handlingDaysMax = Math.max(handlingDaysMin, baseHandlingMax + extraHandling);

  const transitDaysMin = ovTransitMin ?? ("transitDaysMin" in storeShipping ? storeShipping.transitDaysMin : 2);
  const transitDaysMax = Math.max(
    transitDaysMin,
    ovTransitMax ?? ("transitDaysMax" in storeShipping ? storeShipping.transitDaysMax : 5)
  );

  const totalDeliveryDaysMin = handlingDaysMin + transitDaysMin;
  const totalDeliveryDaysMax = handlingDaysMax + transitDaysMax;
  const deliveryWindowLabel =
    totalDeliveryDaysMin === totalDeliveryDaysMax
      ? `${totalDeliveryDaysMin}-day delivery`
      : `${totalDeliveryDaysMin}–${totalDeliveryDaysMax} day delivery`;

  const ovShippingPaise = toOptionalNonNegativeInt(ov.shipping_fee_paise_override);
  const hasExplicitShippingOverride = ovShippingPaise !== null;
  const flatShippingPaise = ovShippingPaise ?? storeShipping.flatRatePaise;
  const freeShippingEnabled =
    "freeShippingEnabled" in storeShipping ? Boolean(storeShipping.freeShippingEnabled) : true;
  const freeShippingThresholdPaise = storeShipping.freeShippingThresholdPaise;

  const ovReturnDays = toOptionalNonNegativeInt(ov.return_window_days_override);
  const returnWindowDays =
    ovReturnDays !== null && ovReturnDays > 0
      ? ovReturnDays
      : Math.max(1, storeReturns.windowDays || 14);

  const returnFees = normalizeReturnFees(
    ov.return_fees_override || ("returnFees" in storeReturns ? storeReturns.returnFees : "FreeReturn")
  );
  const returnMethod = normalizeReturnMethod(
    "returnMethod" in storeReturns ? storeReturns.returnMethod : "ReturnByMail"
  );
  const returnPolicyLabel =
    ("returnPolicyLabel" in storeReturns ? storeReturns.returnPolicyLabel : "") || "";

  let reviewSummary: ReviewSummary | null = null;
  if (options?.reviewSummary !== undefined) {
    reviewSummary =
      options.reviewSummary && options.reviewSummary.reviewCount > 0
        ? options.reviewSummary
        : null;
  } else if (options?.entityType && options?.entityId !== undefined) {
    reviewSummary = getApprovedReviewSummary(options.entityType, options.entityId);
  }

  const rawBrand = config.brand || config.name || "TeaFloww";
  const brandName = rawBrand.toUpperCase() === "TEAFLOWW" ? "TeaFloww" : rawBrand;
  const rawSeller = config.name || config.brand || "TeaFloww";
  const normalizedSeller = rawSeller.toUpperCase() === "TEAFLOWW" ? "TeaFloww" : rawSeller;
  const sellerName =
    normalizedSeller === "Himalayan Tea House" && brandName === "TeaFloww"
      ? "TeaFloww"
      : normalizedSeller;

  return {
    brandName,
    sellerName,
    sellerLegalName: config.legalName || "Nirva",
    currency: config.currency || "INR",
    applicableCountry: config.address?.addressCountry || "IN",
    handlingDaysMin,
    handlingDaysMax,
    transitDaysMin,
    transitDaysMax,
    totalDeliveryDaysMin,
    totalDeliveryDaysMax,
    deliveryWindowLabel,
    flatShippingPaise,
    hasExplicitShippingOverride,
    freeShippingEnabled,
    freeShippingThresholdPaise,
    returnWindowDays,
    returnMethod,
    returnFees,
    returnPolicyLabel,
    returnPolicyUrl: `${siteUrl}/returns`,
    reviewSummary,
    computeShippingRatePaise: (itemPricePaise: number) => {
      if (hasExplicitShippingOverride) return flatShippingPaise;
      if (freeShippingEnabled && itemPricePaise >= freeShippingThresholdPaise) {
        return 0;
      }
      return flatShippingPaise;
    },
  };
}
