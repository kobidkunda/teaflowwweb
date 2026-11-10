import type { StudioConfigData } from "../hooks/useStudioDraft";
import { validateCompatibility } from "@/lib/private-label/compatibility";

export function validateStudioStep(config: StudioConfigData, step: number): string | null {
  if (step === 1) {
    if (!config.teaOptionId) return "Please select an available tea to proceed.";
    if (!Number.isFinite(config.fillWeightGrams) || config.fillWeightGrams <= 0 || config.fillWeightGrams > 50000)
      return "Enter a fill weight between 1 and 50,000 grams.";
  }
  if (step === 2 && !config.packagingVariantId) return "Please select packaging to proceed.";
  if (step === 3) {
    if (!Number.isSafeInteger(config.colorCount) || config.colorCount < 1 || config.colorCount > 12) return "Choose between 1 and 12 print colors.";
    if (!config.printMethodId || !config.printMethodCode) return "Please select a compatible print method.";
    const compatibility = validateCompatibility({ familyCode: config.packagingFamily || "pouch", printMethodCode: config.printMethodCode, colorCount: config.colorCount });
    if (compatibility.maxColors && config.colorCount > compatibility.maxColors) return `This print method supports up to ${compatibility.maxColors} colors.`;
    if (!compatibility.compatible) return compatibility.reason || "This print method is incompatible.";
  }
  if (step === 4) {
    if (!config.brandName.trim() && !config.artworkUrl) return "Enter your brand name or upload artwork to proceed.";
    if (config.artworkUrl && !config.rightsAttested) return "Confirm that you have the rights to use this artwork.";
  }
  if (step === 5 && (!Number.isSafeInteger(config.quantityUnits) || config.quantityUnits < 1 || config.quantityUnits > 10000000)) return "Enter a positive whole number of units.";
  return null;
}

export function earliestIncompleteStep(config: StudioConfigData): 1 | 2 | 3 | 4 | 5 {
  for (const step of [1, 2, 3, 4] as const) if (validateStudioStep(config, step)) return step;
  return 5;
}

export function studioProjectPayload(config: StudioConfigData) {
  return {
    title: config.brandName.trim() ? `${config.brandName.trim()} Private Label` : "Untitled Private Label Project",
    notes: config.notes,
    draft_configuration: config,
    items: [{
      ...(config.teaOptionId ? { tea_option_id: config.teaOptionId } : {}),
      ...(config.packagingVariantId ? { packaging_variant_id: config.packagingVariantId } : {}),
      ...(config.printMethodId ? { print_method_id: config.printMethodId } : {}),
      fill_weight_grams: config.fillWeightGrams,
      quantity_units: config.quantityUnits,
      colorCount: config.colorCount,
    }],
  };
}
