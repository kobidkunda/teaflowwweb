/**
 * TeaFloww Private Label Studio — Packaging & Print Compatibility Matrix
 * Milestone M1: Shared Architecture and Data Models
 */

import { compatibilityInputSchema } from "./schemas";
import type { CompatibilityResult } from "./types";

export interface CompatibilityInput {
  familyCode: string;
  variantSubstrate?: string;
  printMethodCode: string;
  colorCount?: number;
  requestedUnits?: number;
}

export interface SafeZoneMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SafeZoneResult {
  labelSafeWidthMm: number;
  labelSafeHeightMm: number;
  marginsMm: SafeZoneMargins;
  bleedMm: number;
}

/**
 * Validates physical and chemical manufacturing compatibility between
 * packaging family/substrate and print method.
 */
export function validateCompatibility(raw: CompatibilityInput): CompatibilityResult {
  const parsed = compatibilityInputSchema.parse(raw);
  const { familyCode, printMethodCode, colorCount = 1 } = parsed;

  switch (familyCode) {
    case "pouch":
      if (printMethodCode === "screen_print") {
        return {
          compatible: false,
          reason: "Screen printing is not supported on flexible pouches due to ink cracking and barrier failure on flexible film.",
        };
      }
      if (printMethodCode === "sleeve") {
        return {
          compatible: false,
          reason: "Shrink sleeves cannot be heat-shrunk over flexible pouches without barrier distortion.",
        };
      }
      if (printMethodCode === "paper_label") {
        return { compatible: true, maxColors: 4, notes: "Face paper label with permanent adhesive" };
      }
      if (printMethodCode === "bopp_label") {
        return { compatible: true, maxColors: 6, notes: "Moisture-resistant BOPP roll label" };
      }
      if (printMethodCode === "direct_digital") {
        return { compatible: true, maxColors: 8, notes: "High-resolution digital pouch conversion" };
      }
      if (printMethodCode === "gravure") {
        return { compatible: true, maxColors: 10, notes: "High-volume rotogravure film conversion (1 cylinder/color)" };
      }
      break;

    case "tin":
      if (printMethodCode === "direct_digital") {
        return {
          compatible: false,
          reason: "Direct UV flatbed digital print is not feasible on pre-formed cylindrical tins.",
        };
      }
      if (printMethodCode === "gravure") {
        return {
          compatible: false,
          reason: "Rotogravure printing requires flexible film rolls and cannot feed pre-formed metal tins.",
        };
      }
      if (printMethodCode === "paper_label") {
        return { compatible: true, maxColors: 4, notes: "Wrap-around or face paper label" };
      }
      if (printMethodCode === "bopp_label") {
        return { compatible: true, maxColors: 6, notes: "High-tack BOPP label" };
      }
      if (printMethodCode === "screen_print") {
        if (colorCount > 3) {
          return {
            compatible: false,
            reason: `Direct rotary screen printing on tins supports maximum 3 spot colors (requested: ${colorCount}).`,
          };
        }
        return { compatible: true, maxColors: 3, notes: "Rotary spot screen print with heat-cure lacquer" };
      }
      if (printMethodCode === "sleeve") {
        return { compatible: true, maxColors: 8, notes: "Full body shrink sleeve" };
      }
      break;

    case "jar":
      if (printMethodCode === "direct_digital") {
        return {
          compatible: false,
          reason: "Direct digital printing cannot print cylindrical glass or plastic jars.",
        };
      }
      if (printMethodCode === "gravure") {
        return {
          compatible: false,
          reason: "Rotogravure printing requires flexible film rolls and cannot feed pre-formed rigid jars.",
        };
      }
      if (printMethodCode === "paper_label") {
        return { compatible: true, maxColors: 4, notes: "Straight wall paper label" };
      }
      if (printMethodCode === "bopp_label") {
        return { compatible: true, maxColors: 6, notes: "Clear or metallic BOPP label" };
      }
      if (printMethodCode === "screen_print") {
        if (colorCount > 3) {
          return {
            compatible: false,
            reason: `Cylindrical screen printing on jars supports maximum 3 spot colors (requested: ${colorCount}).`,
          };
        }
        return { compatible: true, maxColors: 3, notes: "Direct cylindrical screen print" };
      }
      if (printMethodCode === "sleeve") {
        return { compatible: true, maxColors: 8, notes: "Tamper-evident shrink sleeve" };
      }
      break;

    case "box":
    case "carton":
      if (printMethodCode === "gravure") {
        return {
          compatible: false,
          reason: "Rotogravure printing requires flexible film rolls; folding cartons use sheetfed offset/digital.",
        };
      }
      if (printMethodCode === "paper_label") {
        return { compatible: true, maxColors: 4, notes: "Carton sticker / box seal" };
      }
      if (printMethodCode === "bopp_label") {
        return { compatible: true, maxColors: 6, notes: "High gloss seal wafer" };
      }
      if (printMethodCode === "direct_digital") {
        return { compatible: true, maxColors: 6, notes: "Sheet-fed digital carton printing" };
      }
      if (printMethodCode === "sleeve") {
        return { compatible: true, maxColors: 8, notes: "Outer sliding belly band / sleeve" };
      }
      break;

    default:
      if (printMethodCode === "paper_label" || printMethodCode === "bopp_label") {
        return { compatible: true, maxColors: 4 };
      }
  }

  return {
    compatible: false,
    reason: `Combination of packaging family '${familyCode}' and print method '${printMethodCode}' is not supported.`,
  };
}

export const validatePackagingPrintCompatibility = validateCompatibility;

/**
 * Calculates mechanical label safe-zone margins and bleed in mm based on packaging family.
 */
export function calculateSafeZone(
  familyCode: string,
  widthMm: number,
  heightMm: number
): SafeZoneResult {
  let margins: SafeZoneMargins;
  let bleedMm = 0;

  switch (familyCode) {
    case "pouch":
      // Top 35mm reserve for tear notch and zipper heat seal; bottom 15mm for bottom gusset weld; 10mm side seals
      margins = { top: 35, bottom: 15, left: 10, right: 10 };
      bleedMm = 3;
      break;
    case "tin":
      // 10mm top/bottom lip clearance, 5mm seam clearance
      margins = { top: 10, bottom: 10, left: 5, right: 5 };
      bleedMm = 2;
      break;
    case "jar":
      // 12mm top shoulder clearance, 8mm bottom base clearance, 4mm sides
      margins = { top: 12, bottom: 8, left: 4, right: 4 };
      bleedMm = 2;
      break;
    case "box":
    case "carton":
      margins = { top: 8, bottom: 8, left: 8, right: 8 };
      bleedMm = 3;
      break;
    default:
      margins = { top: 10, bottom: 10, left: 10, right: 10 };
      bleedMm = 2;
  }

  const labelSafeWidthMm = Math.max(10, widthMm - (margins.left + margins.right));
  const labelSafeHeightMm = Math.max(10, heightMm - (margins.top + margins.bottom));

  return { labelSafeWidthMm, labelSafeHeightMm, marginsMm: margins, bleedMm };
}
