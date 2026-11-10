"use client";

import { useMemo, useState, useEffect } from "react";
import { calculateMOQ, type MoqResult } from "@/lib/private-label/moq";
import type {
  ItemizedPriceBreakdown,
} from "@/lib/private-label/types";
import type {
  PublicTeaOptionDto,
  PublicPackagingVariantDto,
  PublicPrintMethodDto,
} from "@/lib/private-label/public-dto";

export interface QuoteEstimateInput {
  teaOption: (PublicTeaOptionDto & {
    base_cost_per_kg_paise?: number;
    baseCostPerKgPaise?: number;
    minBatchKg?: number;
    min_batch_kg?: number;
    teaCategory?: string;
  }) | null;
  packagingVariant: (PublicPackagingVariantDto & {
    unit_cost_paise?: number;
    unitCostPaise?: number;
    closureRatePaise?: number;
    closure_rate_paise?: number;
    tareWeightGrams?: number;
    tare_weight_grams?: number;
    packsPerCarton?: number;
    packs_per_carton?: number;
    moqUnits?: number;
    orderMultiple?: number;
  }) | null;
  printMethod: (PublicPrintMethodDto & {
    setup_fee_paise?: number;
    setupFeePaise?: number;
    cylinder_fee_per_color_paise?: number;
    cylinderFeePerColorPaise?: number;
    unit_cost_paise?: number;
    unitCostPaise?: number;
    minOrderUnits?: number;
  }) | null;
  fillWeightGrams: number;
  quantityUnits: number;
  colorCount: number;
  destinationZone?: "local" | "metro" | "national" | "international";
  isNitrogenFlushEnabled?: boolean;
}

export interface QuoteEstimateResult {
  moq: MoqResult | null;
  breakdown: ItemizedPriceBreakdown | null;
  isEligible: boolean;
  unitPriceInr: number;
  grandTotalInr: number;
  formattedUnitPrice: string;
  formattedGrandTotal: string;
  isLoadingServerQuote: boolean;
  serverQuoteError: string | null;
}

export function useQuoteEstimate(input: QuoteEstimateInput): QuoteEstimateResult {
  const {
    teaOption,
    packagingVariant,
    printMethod,
    fillWeightGrams,
    quantityUnits,
    colorCount,
    destinationZone = "metro",
    isNitrogenFlushEnabled = false,
  } = input;

  const [isLoadingServerQuote, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<ItemizedPriceBreakdown | null>(null);
  const [serverQuoteError, setError] = useState<string | null>(null);

  // 1. Live Multi-Dimensional MOQ calculation
  const moqResult = useMemo((): MoqResult | null => {
    if (!packagingVariant || !Number.isSafeInteger(quantityUnits) || quantityUnits < 1 || quantityUnits > 10000000 || !Number.isFinite(fillWeightGrams) || fillWeightGrams <= 0 || fillWeightGrams > 50000) return null;

    const netWeightGrams = fillWeightGrams > 0 ? fillWeightGrams : 100;
    const teaMinBatchKg = Number(
      teaOption?.min_batch_kg ?? teaOption?.minBatchKg ?? 5.0
    );
    const packagingMOQ = Number(
      packagingVariant?.moq_units ?? packagingVariant?.moqUnits ?? 500
    );
    const printMOQ = Number(
      printMethod?.min_order_units ?? printMethod?.minOrderUnits ?? 100
    );
    const orderMultiple = Number(
      packagingVariant?.order_multiple ?? packagingVariant?.orderMultiple ?? 50
    );

    return calculateMOQ({
      requestedUnits: quantityUnits > 0 ? quantityUnits : 1,
      netWeightGrams,
      teaMinBatchKg: teaOption ? teaMinBatchKg : 0,
      packagingMOQ,
      printMOQ: printMethod ? printMOQ : 1,
      fillingMOQ: 100,
      orderMultiple: orderMultiple > 0 ? orderMultiple : 1,
    });
  }, [teaOption, packagingVariant, printMethod, fillWeightGrams, quantityUnits]);

  // Fetch authoritative rates without sending supplier costs to the browser.
  const requestKey = JSON.stringify({
    teaOptionId: teaOption?.id, packagingVariantId: packagingVariant?.id,
    printMethodId: printMethod?.id, requestedUnits: quantityUnits,
    netWeightGrams: fillWeightGrams, colorCount, destinationZone, isNitrogenFlushEnabled,
  });
  const [resolvedKey, setResolvedKey] = useState("");
  useEffect(() => {
    setBreakdown(null);
    setError(null);
    if (!teaOption || !packagingVariant || !printMethod || !Number.isSafeInteger(quantityUnits) || quantityUnits < 1 || !Number.isFinite(fillWeightGrams) || fillWeightGrams <= 0) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/v1/private-label/quotes/calculate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: requestKey, signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result) throw new Error("Estimate unavailable. Please retry or request a consultation.");
        if (!result.breakdown) throw new Error("This configuration needs a managed quotation. Please request a consultation.");
        if (!controller.signal.aborted) {
          setBreakdown(result.breakdown);
          setResolvedKey(requestKey);
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Estimate unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [requestKey, teaOption, packagingVariant, printMethod, quantityUnits, fillWeightGrams]);

  const currentBreakdown = resolvedKey === requestKey ? breakdown : null;
  const isEligible = Boolean(moqResult?.eligible && currentBreakdown && !isLoadingServerQuote && !serverQuoteError);
  const unitPricePaise = currentBreakdown?.unitPricePaise ?? 0;
  const grandTotalPaise = currentBreakdown?.grandTotalPaise ?? 0;

  const unitPriceInr = unitPricePaise / 100;
  const grandTotalInr = grandTotalPaise / 100;

  const formattedUnitPrice = unitPriceInr > 0 ? `₹${unitPriceInr.toFixed(2)}` : "—";
  const formattedGrandTotal =
    grandTotalInr > 0
      ? `₹${grandTotalInr.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "—";

  return {
    moq: moqResult,
    breakdown: currentBreakdown,
    isEligible,
    unitPriceInr,
    grandTotalInr,
    formattedUnitPrice,
    formattedGrandTotal,
    isLoadingServerQuote,
    serverQuoteError,
  };
}
