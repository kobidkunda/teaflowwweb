"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useId } from "react";
import {
  calculateCostPerCup,
  formatCostPerCup,
  calculateSavingsDelta,
  calculateKitCupYield,
  clampDoseGrams,
} from "@/lib/trials/storefront-helpers";

export interface TrialCostCalculatorProps {
  initialPricePerKg?: number; // e.g. ₹1000/kg for ₹200 200g kit, or bulk ₹430/kg
  initialDoseGrams?: number; // default 2.5g
  kitWeightGrams?: number; // default 200g
}

export function TrialCostCalculator({
  initialPricePerKg = 430,
  initialDoseGrams = 2.5,
  kitWeightGrams = 200,
}: TrialCostCalculatorProps) {
  // Benchmark tea defaults: ₹200/kg, 4g dose -> ₹0.80/cup
  const [currentPricePerKg, setCurrentPricePerKg] = useState<number>(200);
  const [currentDoseGrams, setCurrentDoseGrams] = useState<number>(4.0);

  // TeaFloww trial rate & dose
  const [trialPricePerKg, setTrialPricePerKg] = useState<number>(initialPricePerKg);
  const [doseGrams, setDoseGrams] = useState<number>(initialDoseGrams);

  const currentPriceId = useId();
  const currentDoseId = useId();
  const trialPriceId = useId();
  const trialDoseId = useId();

  // Evaluate costs
  const currentCost = calculateCostPerCup(currentPricePerKg, currentDoseGrams);
  const trialCost = calculateCostPerCup(trialPricePerKg, doseGrams);
  const delta = calculateSavingsDelta(currentCost, trialCost);
  const totalBrews = calculateKitCupYield(kitWeightGrams, doseGrams);

  const handleDoseChange = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) {
      setDoseGrams(2.5);
      return;
    }
    setDoseGrams(clampDoseGrams(val));
  };

  return (
    <div
      data-testid="cost-per-cup-calculator"
      className="cost-calculator calc border border-[#e6e0d4] bg-[#fffaf2] rounded-[22px] p-6 sm:p-8 shadow-[0_20px_40px_rgba(20,59,47,0.07)] text-[#0d0b0a]"
    >
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-[#ab7f4a] mb-1"><StorefrontText id="copy_258e522c23fe1682" fallback="TRUTHFUL COST-PER-CUP ARITHMETIC" />
        </div>
        <h2 className="font-serif text-[28px] sm:text-[36px] leading-tight font-normal"><StorefrontText id="copy_7e4e86fc8c43bd35" fallback="Numbers you can" /> <em className="italic text-[#ae8452]"><StorefrontText id="copy_cee30ce301610e97" fallback="actually verify." /></em>
        </h2>
        <p className="text-[#67756d] text-[13px] sm:text-[14px] mt-1 max-w-xl"><StorefrontText id="copy_4f5372e732d52b10" fallback="No automatic 50% savings assumption. Enter the leaf doses and real delivered rate measured for your stall." />
        </p>
      </div>

      {/* 4 Input Columns */}
      <div className="calcgrid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label htmlFor={currentPriceId} className="inputlabel text-[11px] font-bold text-[#486050] block mb-1.5"><StorefrontText id="copy_bfb82c55ddc20069" fallback="Your current tea ₹/kg" />
          </label>
          <input
            id={currentPriceId}
            type="number"
            min="0"
            step="1"
            value={currentPricePerKg}
            onChange={(e) => setCurrentPricePerKg(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-full border border-[#d3d7ca] bg-white rounded-xl p-3 text-[14px] text-[#1c362d] focus:outline-none focus:border-[#c86d3b] focus:ring-2 focus:ring-[#c86d3b33] transition-all"
          />
        </div>

        <div>
          <label htmlFor={currentDoseId} className="inputlabel text-[11px] font-bold text-[#486050] block mb-1.5"><StorefrontText id="copy_0f2c497474edc7c5" fallback="Your current dose g/cup" />
          </label>
          <input
            id={currentDoseId}
            type="number"
            min="0.5"
            max="15"
            step="0.1"
            value={currentDoseGrams}
            onChange={(e) => setCurrentDoseGrams(Math.max(0.5, parseFloat(e.target.value) || 0))}
            className="w-full border border-[#d3d7ca] bg-white rounded-xl p-3 text-[14px] text-[#1c362d] focus:outline-none focus:border-[#c86d3b] focus:ring-2 focus:ring-[#c86d3b33] transition-all"
          />
        </div>

        <div>
          <label htmlFor={trialPriceId} className="inputlabel text-[11px] font-bold text-[#486050] block mb-1.5"><StorefrontText id="copy_f5614aa4019c1a25" fallback="TeaFloww rate ₹/kg" />
          </label>
          <input
            id={trialPriceId}
            type="number"
            min="0"
            step="1"
            value={trialPricePerKg}
            onChange={(e) => setTrialPricePerKg(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-full border border-[#d3d7ca] bg-white rounded-xl p-3 text-[14px] text-[#1c362d] focus:outline-none focus:border-[#c86d3b] focus:ring-2 focus:ring-[#c86d3b33] transition-all"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={trialDoseId} className="inputlabel text-[11px] font-bold text-[#486050]"><StorefrontText id="copy_f04a5b99da3c3aa3" fallback="TeaFloww dose g/cup" />
            </label>
            <input
              id={trialDoseId}
              name="dose_grams"
              type="number"
              min="1.0"
              max="15.0"
              step="0.1"
              value={doseGrams}
              onChange={(e) => handleDoseChange(e.target.value)}
              className="w-20 border border-[#d3d7ca] bg-white rounded-lg px-2 py-0.5 text-[12px] font-mono text-[#ba8745] font-bold text-right"
            />
          </div>
          <input
            data-testid="dose-slider"
            type="range"
            min="1.0"
            max="15.0"
            step="0.1"
            value={doseGrams}
            onChange={(e) => handleDoseChange(e.target.value)}
            className="w-full accent-[#143b2f] h-2 bg-[#d9d2c2] rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Results Grid */}
      <div className="resultgrid grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Current Cost */}
        <div className="result bg-[#f1ede3] rounded-2xl p-4">
          <small className="block text-[11px] text-[#64716b] mb-1"><StorefrontText id="copy_0f24238254d594e1" fallback="Current tea cost / cup" />
          </small>
          <strong className="text-[24px] font-serif font-bold text-[#194234]">
            {formatCostPerCup(currentCost)}
          </strong>
        </div>

        {/* TeaFloww Cost */}
        <div className="result bg-[#f1ede3] rounded-2xl p-4">
          <small className="block text-[11px] text-[#64716b] mb-1"><StorefrontText id="copy_743a06584820a9b7" fallback="TeaFloww cost / cup" />
          </small>
          <strong
            data-testid="cost-per-cup-value"
            className="per-cup-val text-[24px] font-serif font-bold text-[#194234]"
          >
            {formatCostPerCup(trialCost)}
          </strong>
        </div>

        {/* Delta */}
        <div
          className={`result p-4 rounded-2xl transition-all ${
            delta.isSavings
              ? "bg-[#eaf4ed] border border-[#c2e4cc]"
              : "result negative bg-[#faede8] border border-[#f5cfc4]"
          }`}
        >
          <small className="block text-[11px] text-[#64716b] mb-1"><StorefrontText id="copy_0cb0bc903f5ca546" fallback="Actual difference / cup" />
          </small>
          <div className="flex items-center gap-2">
            <strong
              data-testid="savings-delta"
              className={`delta-pill text-[22px] font-serif font-bold ${
                delta.isSavings ? "text-[#1d5f38]" : "text-[#a8381b]"
              }`}
            >
              {delta.formatted}
            </strong>
            {delta.isSavings && (
              <span
                data-testid="calculator-savings"
                className="savings-badge bg-[#1d5f38] text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
              ><StorefrontText id="copy_3c980f65593d7650" fallback="Cheaper" />
              </span>
            )}
          </div>
        </div>

        {/* Total Brews Indicator */}
        <div className="result bg-[#f1ede3] rounded-2xl p-4">
          <small className="block text-[11px] text-[#64716b] mb-1"><StorefrontText id="copy_0e0be88eaaa0eef7" fallback="Yield from" /> {kitWeightGrams}<StorefrontText id="copy_f53f22f68b6e4597" fallback="g kit" />
          </small>
          <strong
            data-testid="total-brews-count"
            className="total-brews text-[24px] font-serif font-bold text-[#143b2f]"
          >
            {totalBrews} <StorefrontText id="copy_43b69e82bee632b3" fallback="cups" />
          </strong>
        </div>
      </div>

      <p className="text-[11px] text-[#858f87] mt-4 leading-relaxed"><StorefrontText id="copy_d3761d869c1282e8" fallback="Arithmetic formula:" /> <code>(Price per kg × Dose in grams) / 1000</code><StorefrontText id="copy_74cb8117cf252bcb" fallback=". Reflects measured dry leaf dosing in an authentic commercial brewing setup." />
      </p>
    </div>
  );
}
