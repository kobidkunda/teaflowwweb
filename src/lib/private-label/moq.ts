/**
 * TeaFloww Private Label Studio — Multi-Dimensional MOQ Engine
 * Milestone M1: Shared Architecture and Data Models
 */

import { moqInputSchema } from "./schemas";
import type { MoqEvaluationParams, MoqEvaluationResult } from "./types";

export type MoqInput = MoqEvaluationParams;
export type MoqResult = MoqEvaluationResult;

/**
 * Evaluates multi-dimensional MOQ constraints across tea batch mass (kg),
 * primary packaging, print method, factory filling minimums, order multiples,
 * and minimum order values.
 */
export function calculateMOQ(raw: MoqInput): MoqResult {
  const parsed = moqInputSchema.parse(raw);
  const {
    requestedUnits: Q,
    netWeightGrams: W,
    teaMinBatchKg: M_tea,
    packagingMOQ: M_pack,
    printMOQ: M_print,
    fillingMOQ = 100,
    orderMultiple: K = 1,
    minOrderValuePaise = 0,
    unitEstimatedPricePaise = 0,
  } = parsed;

  const safeK = K > 0 ? K : 1;
  const teaUnitsRequired = M_tea > 0 && W > 0 ? Math.ceil((M_tea * 1000) / W) : 0;
  const rawBase = Math.max(teaUnitsRequired, M_pack, M_print, fillingMOQ, 1);
  const minUnits = Math.ceil(rawBase / safeK) * safeK;
  const nextValidUnits = Math.ceil(Math.max(Q, rawBase) / safeK) * safeK;

  const reasons: string[] = [];

  if (Q < teaUnitsRequired) {
    reasons.push(
      `Requested quantity (${Q}) is below minimum tea blending batch (requires at least ${teaUnitsRequired} units for ${M_tea}kg blend at ${W}g/pack)`
    );
  }
  if (Q < M_pack) {
    reasons.push(`Requested quantity (${Q}) is below primary packaging MOQ of ${M_pack} units`);
  }
  if (Q < M_print) {
    reasons.push(`Requested quantity (${Q}) is below printing method MOQ of ${M_print} units`);
  }
  if (Q < fillingMOQ) {
    reasons.push(`Requested quantity (${Q}) is below factory filling batch minimum of ${fillingMOQ} units`);
  }
  if (safeK > 1 && Q % safeK !== 0) {
    reasons.push(`Quantity (${Q}) must be an exact multiple of ${safeK} (next valid quantity is ${nextValidUnits})`);
  }
  if (minOrderValuePaise > 0 && unitEstimatedPricePaise > 0) {
    const estimatedValue = Q * unitEstimatedPricePaise;
    if (estimatedValue < minOrderValuePaise) {
      reasons.push(
        `Estimated order value (₹${(estimatedValue / 100).toFixed(2)}) is below minimum order value of ₹${(
          minOrderValuePaise / 100
        ).toFixed(2)}`
      );
    }
  }

  return {
    eligible: reasons.length === 0,
    minUnits,
    nextValidUnits,
    teaUnitsRequired,
    reasons,
    constraints: {
      teaBatchUnits: teaUnitsRequired,
      packagingMOQ: M_pack,
      printMOQ: M_print,
      fillingMOQ,
      orderMultiple: safeK,
      minOrderValuePaise: minOrderValuePaise || undefined,
    },
  };
}

// Alias for compatibility
export const evaluateMoq = calculateMOQ;
