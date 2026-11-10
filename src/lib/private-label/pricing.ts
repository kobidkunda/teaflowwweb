/**
 * TeaFloww Private Label Studio — 12-Component Tiered Price Book Calculation Engine
 * Milestone M1 & M4: Shared Architecture, 12-Component Cost Breakdown & Dual-Rate GST
 */

import type {
  PriceBreakdown,
  PriceEstimateResult,
  PricingCalculationParams,
  DetailedPricingParams,
  ItemizedPriceBreakdown,
  ItemizedPriceEstimateResult,
  PrintMethodCode,
} from "./types";

function asRec(obj: unknown): Record<string, unknown> | null {
  return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
}

/**
 * Calculates a fully itemized 12-component quote with dual-rate Indian GST (5% tea vs 18% services/materials).
 * Backward-compatible calculation engine used by Milestone M1-M3 unit tests.
 */
export function calculateQuote(params: PricingCalculationParams): PriceEstimateResult {
  const {
    requestedUnits: Q,
    netWeightGrams: W,
    teaOption,
    packagingVariant,
    printMethod,
    colorCount = 1,
    priceBook,
    destinationZone = "metro",
  } = params;

  // Rate verification & missing data checks
  const missingRates: string[] = [];

  const teaRate = Number(
    teaOption?.baseCostPerKgPaise ?? asRec(teaOption)?.base_cost_per_kg_paise ?? 0
  );
  const packRate = Number(
    packagingVariant?.unitCostPaise ?? asRec(packagingVariant)?.unit_cost_paise ?? 0
  );

  if (!teaOption || Number.isNaN(teaRate) || teaRate <= 0) {
    missingRates.push("tea_base_cost_unverified");
  }
  if (!packagingVariant || Number.isNaN(packRate) || packRate <= 0) {
    missingRates.push("packaging_unit_cost_unverified");
  }
  if (destinationZone === "international") {
    missingRates.push("international_freight_requires_quote");
  }

  if (missingRates.length > 0) {
    return {
      status: "manual_quote_required",
      requiresOperatorReview: true,
      missingRates,
    };
  }

  // 1. Direct Tea Leaf Cost (incorporates loss allowance)
  const lossAllowanceRate = Number(
    priceBook?.lossAllowanceRate ?? asRec(priceBook)?.loss_allowance_rate ?? 0.03
  ); // default 3%
  const netKg = (Q * W) / 1000;
  const grossKg = netKg * (1 + lossAllowanceRate);
  const teaCostPaise = Math.round(grossKg * teaRate);

  // 2. Primary Packaging Cost
  const packagingCostPaise = Q * packRate;

  // 3. Printing Run Cost (piece-rate if applicable)
  const printingCostPaise = 0;

  // 4. Closures / Liners / Degassing Valves
  const closureRatePaise = Number(
    packagingVariant.closureRatePaise ?? asRec(packagingVariant)?.closure_rate_paise ?? 0
  );
  const closureCostPaise = Q * closureRatePaise;

  // 5. Label Material Substrate Cost
  const labelCostPaise = 0;

  // 6. Prepress & Machine Run Setup Fee
  const setupFeePaise = Number(
    printMethod.setupFeePaise ?? asRec(printMethod)?.setup_fee_paise ?? 0
  );

  // 7. Gravure Steel Cylinder Tooling (strictly for rotogravure)
  let gravureCylinderFeePaise = 0;
  if (printMethod.code === "gravure") {
    const cylinderRate = Number(
      printMethod.cylinderFeePerColorPaise ??
        asRec(printMethod)?.cylinder_fee_per_color_paise ??
        0
    );
    gravureCylinderFeePaise = colorCount * cylinderRate;
  }

  // 8. Cleanroom Filling & Packaging Labor
  const laborRatePaise = Number(
    priceBook?.fillingLaborPaisePerUnit ??
      asRec(priceBook)?.filling_labor_paise_per_unit ??
      300
  ); // default ₹3.00/unit
  const laborCostPaise = Q * laborRatePaise;

  // 9. Quality Control & Retention Cupping
  const qcCostPaise = Number(
    priceBook?.qcChargePaisePerBatch ??
      asRec(priceBook)?.qc_charge_paise_per_batch ??
      250000
  ); // default ₹2,500/batch

  // 10. Master Shipper Cartons & Packaging Consumables
  const rawPacksPerCarton = Number(
    packagingVariant.packsPerCarton ?? asRec(packagingVariant)?.packs_per_carton ?? 24
  );
  const packsPerCarton = rawPacksPerCarton > 0 ? rawPacksPerCarton : 24;
  const cartons = Math.ceil(Q / packsPerCarton);
  const cartonRatePaise = 6000; // ₹60.00 / 5-ply carton
  const cartonCostPaise = cartons * cartonRatePaise;

  // 11. Freight & Logistics Estimate (volumetric + deadweight)
  const tareWeightGrams = Number(
    packagingVariant.tareWeightGrams ?? asRec(packagingVariant)?.tare_weight_grams ?? 15
  );
  const totalWeightKg = Math.ceil(grossKg + (Q * tareWeightGrams) / 1000 + cartons * 0.8);

  let baseFreightPaise = 35000; // Metro base ₹350
  let perKgFreightPaise = 5500; // Metro ₹55/kg
  if (destinationZone === "local") {
    baseFreightPaise = 20000;
    perKgFreightPaise = 2500;
  } else if (destinationZone === "national") {
    baseFreightPaise = 45000;
    perKgFreightPaise = 7500;
  }
  const freightPaise = baseFreightPaise + totalWeightKg * perKgFreightPaise;

  // Direct Costs Subtotal
  const subtotalPaise =
    teaCostPaise +
    packagingCostPaise +
    printingCostPaise +
    closureCostPaise +
    labelCostPaise +
    laborCostPaise +
    qcCostPaise +
    cartonCostPaise +
    freightPaise;

  // 12. Commercial Margin
  const marginRate = Number(
    priceBook?.marginRate ?? asRec(priceBook)?.margin_rate ?? 0.25
  ); // default 25%
  const marginPaise = Math.round(subtotalPaise * marginRate);

  // 13. Dual-Rate Indian GST (5% tea vs 18% services & materials)
  const teaGstPaise = Math.round(teaCostPaise * 0.05);
  const taxableNonTea =
    subtotalPaise - teaCostPaise + setupFeePaise + gravureCylinderFeePaise + marginPaise;
  const nonTeaGstPaise = Math.round(taxableNonTea * 0.18);
  const taxPaise = teaGstPaise + nonTeaGstPaise;

  // 14. Grand Total & Unit Price
  const grandTotalPaise =
    subtotalPaise + setupFeePaise + gravureCylinderFeePaise + marginPaise + taxPaise;
  const unitPricePaise = Q > 0 ? Math.round(grandTotalPaise / Q) : 0;

  const breakdown: PriceBreakdown = {
    teaCostPaise,
    packagingCostPaise,
    printingCostPaise,
    closureCostPaise,
    labelCostPaise,
    setupFeePaise,
    gravureCylinderFeePaise,
    laborCostPaise,
    qcCostPaise,
    cartonCostPaise,
    freightPaise,
    subtotalPaise,
    marginPaise,
    taxPaise,
    taxDetails: {
      teaGstPaise,
      nonTeaGstPaise,
    },
    grandTotalPaise,
    unitPricePaise,
  };

  return {
    status: "firm_issued",
    requiresOperatorReview: false,
    missingRates: [],
    breakdown,
  };
}

export const calculateItemizedQuote = calculateQuote;

/**
 * Calculates a fully itemized 12-component quote with active tier lookups,
 * process piece-rate printing, nitrogen flushing, palletizing, and dual-rate Indian GST.
 * Follows the M4 Pricing Engine Specification.
 */
export function calculateItemized12ComponentQuote(
  params: DetailedPricingParams
): ItemizedPriceEstimateResult {
  const {
    requestedUnits: Q,
    netWeightGrams: W,
    teaOption,
    packagingVariant,
    printMethod,
    colorCount = 1,
    isNitrogenFlushEnabled = false,
    priceBook,
    destinationZone = "metro",
    activeTiers = [],
  } = params;

  // Rate verification & missing data checks
  const missingRates: string[] = [];

  const teaRate = Number(
    teaOption?.baseCostPerKgPaise ?? asRec(teaOption)?.base_cost_per_kg_paise ?? 0
  );
  const packBaseRate = Number(
    packagingVariant?.unitCostPaise ?? asRec(packagingVariant)?.unit_cost_paise ?? 0
  );

  if (!teaOption || Number.isNaN(teaRate) || teaRate <= 0) {
    missingRates.push("tea_base_cost_unverified");
  }
  if (!packagingVariant || Number.isNaN(packBaseRate) || packBaseRate <= 0) {
    missingRates.push("packaging_unit_cost_unverified");
  }
  if (destinationZone === "international") {
    missingRates.push("international_freight_requires_quote");
  }

  if (missingRates.length > 0) {
    return {
      status: "manual_quote_required",
      requiresOperatorReview: true,
      missingRates,
    };
  }

  // Tier lookups
  const packTier = activeTiers.find(
    (t) =>
      t.item_type === "packaging" &&
      t.item_id === packagingVariant.id &&
      Q >= t.min_qty &&
      (t.max_qty === null || Q <= t.max_qty)
  );
  const packRate = packTier ? packTier.unit_price_paise : packBaseRate;

  const printTier = activeTiers.find(
    (t) =>
      t.item_type === "print_method" &&
      t.item_id === printMethod.id &&
      Q >= t.min_qty &&
      (t.max_qty === null || Q <= t.max_qty)
  );
  const defaultPrintRateMap: Record<PrintMethodCode, number> = {
    paper_label: 150,
    bopp_label: 250,
    direct_digital: 450,
    gravure: 120,
    screen_print: 300,
    sleeve: 350,
  };
  const printRunRate = Number(
    printTier
      ? printTier.unit_price_paise
      : printMethod.unitCostPaise ??
          asRec(printMethod)?.unit_cost_paise ??
          defaultPrintRateMap[printMethod.code] ??
          250
  );

  // 1. Base tea leaf cost (incorporates loss allowance)
  const lossAllowanceRate = Number(
    priceBook?.lossAllowanceRate ?? asRec(priceBook)?.loss_allowance_rate ?? 0.03
  );
  const netTeaKg = (Q * W) / 1000;
  const grossTeaKg = netTeaKg * (1 + lossAllowanceRate);
  const teaCostPaise = Math.round(grossTeaKg * teaRate);

  // 2. Primary packaging structure cost
  const packagingCostPaise = Q * packRate;

  // 3. Print method run cost
  const printingCostPaise = Q * printRunRate;

  // 4. Tooling / cylinder / die setup charges
  const setupFeePaise = Number(
    printMethod.setupFeePaise ?? asRec(printMethod)?.setup_fee_paise ?? 0
  );
  let gravureCylinderFeePaise = 0;
  if (printMethod.code === "gravure") {
    const cylinderRate = Number(
      printMethod.cylinderFeePerColorPaise ??
        asRec(printMethod)?.cylinder_fee_per_color_paise ??
        0
    );
    gravureCylinderFeePaise = colorCount * cylinderRate;
  }
  const toolingSetupPaise = setupFeePaise + gravureCylinderFeePaise;

  // 5. Closures & label application finishing
  const closureRatePaise = Number(
    packagingVariant.closureRatePaise ?? asRec(packagingVariant)?.closure_rate_paise ?? 0
  );
  const labelAppRatePaise =
    printMethod.code === "paper_label" || printMethod.code === "bopp_label" ? 50 : 0;
  const closureFinishingCostPaise = Q * (closureRatePaise + labelAppRatePaise);

  // 6. Nitrogen flushing & modified atmosphere sealing
  const nitrogenFlushRatePaise = 75; // ₹0.75 per pack
  const nitrogenFlushingCostPaise = isNitrogenFlushEnabled ? Q * nitrogenFlushRatePaise : 0;

  // 7. Manual packing & cleanroom labor
  const laborRatePaise = Number(
    priceBook?.fillingLaborPaisePerUnit ??
      asRec(priceBook)?.filling_labor_paise_per_unit ??
      300
  );
  const laborCostPaise = Q * laborRatePaise;

  // 8. QC, organoleptic tasting & lab testing
  const minBatchKg = Number(teaOption.minBatchKg ?? asRec(teaOption)?.min_batch_kg ?? 10);
  const batchCount = Math.max(1, Math.ceil(grossTeaKg / Math.max(minBatchKg, 10)));
  const qcRatePaise = Number(
    priceBook?.qcChargePaisePerBatch ?? asRec(priceBook)?.qc_charge_paise_per_batch ?? 250000
  );
  const qcCostPaise = batchCount * qcRatePaise;

  // 9. Secondary corrugated shipper cartons (5-ply)
  const rawPacksPerCarton = Number(
    packagingVariant.packsPerCarton ?? asRec(packagingVariant)?.packs_per_carton ?? 24
  );
  const packsPerCarton = rawPacksPerCarton > 0 ? rawPacksPerCarton : 24;
  const cartonCount = Math.ceil(Q / packsPerCarton);
  const cartonRatePaise = 6000; // ₹60.00 / 5-ply carton
  const cartonCostPaise = cartonCount * cartonRatePaise;

  // 10. Palletizing, strapping & moisture barrier wrapping
  const cartonsPerPallet = 40;
  const palletCount = Math.ceil(cartonCount / cartonsPerPallet);
  const palletUnitRatePaise = 75000; // ₹750.00 / pallet
  const palletizingCostPaise =
    cartonCount >= 20 ? palletCount * palletUnitRatePaise : Math.max(5000, cartonCount * 300);

  // 11. Logistics / freight within India
  const tareWeightGrams = Number(
    packagingVariant.tareWeightGrams ?? asRec(packagingVariant)?.tare_weight_grams ?? 15
  );
  const totalWeightKg = Math.ceil(
    grossTeaKg +
      (Q * tareWeightGrams) / 1000 +
      cartonCount * 0.8 +
      (cartonCount >= 20 ? palletCount * 18 : 0)
  );

  let baseFreightPaise = 35000; // Metro base ₹350
  let perKgFreightPaise = 5500; // Metro ₹55/kg
  if (destinationZone === "local") {
    baseFreightPaise = 20000;
    perKgFreightPaise = 2500;
  } else if (destinationZone === "national") {
    baseFreightPaise = 45000;
    perKgFreightPaise = 7500;
  }
  const freightCostPaise = baseFreightPaise + totalWeightKg * perKgFreightPaise;

  // Direct operational subtotal
  const subtotalDirectPaise =
    teaCostPaise +
    packagingCostPaise +
    printingCostPaise +
    toolingSetupPaise +
    closureFinishingCostPaise +
    nitrogenFlushingCostPaise +
    laborCostPaise +
    qcCostPaise +
    cartonCostPaise +
    palletizingCostPaise +
    freightCostPaise;

  // Commercial margin
  const marginRate = Number(
    priceBook?.marginRate ?? asRec(priceBook)?.margin_rate ?? 0.25
  );
  const marginPaise = Math.round(subtotalDirectPaise * marginRate);

  // 12. Dual-rate Indian GST (5% tea vs 18% non-tea)
  const teaTaxableBasePaise = Math.round(teaCostPaise * (1 + marginRate));
  const nonTeaTaxableBasePaise = subtotalDirectPaise + marginPaise - teaTaxableBasePaise;

  const teaGstPaise = Math.round(teaTaxableBasePaise * 0.05);
  const nonTeaGstPaise = Math.round(nonTeaTaxableBasePaise * 0.18);
  const taxPaise = teaGstPaise + nonTeaGstPaise;

  // Grand total & unit price
  const grandTotalPaise = subtotalDirectPaise + marginPaise + taxPaise;
  const unitPricePaise = Q > 0 ? Math.round(grandTotalPaise / Q) : 0;

  const breakdown: ItemizedPriceBreakdown = {
    teaCostPaise,
    packagingCostPaise,
    printingCostPaise,
    toolingSetupPaise,
    closureFinishingCostPaise,
    nitrogenFlushingCostPaise,
    laborCostPaise,
    qcCostPaise,
    cartonCostPaise,
    palletizingCostPaise,
    freightCostPaise,
    subtotalDirectPaise,
    marginPaise,
    taxPaise,
    grandTotalPaise,
    unitPricePaise,
    taxDetails: {
      teaTaxableBasePaise,
      teaGstPaise,
      nonTeaTaxableBasePaise,
      nonTeaGstPaise,
    },
    metrics: {
      netTeaKg,
      grossTeaKg,
      cartonCount,
      palletCount,
      totalWeightKg,
      batchCount,
    },
    appliedTiers: {
      packagingTierPricePaise: packTier ? packTier.unit_price_paise : undefined,
      printMethodTierPricePaise: printTier ? printTier.unit_price_paise : undefined,
    },
  };

  return {
    status: "firm_issued",
    requiresOperatorReview: false,
    missingRates: [],
    breakdown,
  };
}
