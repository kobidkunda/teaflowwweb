import React from "react";
import type { TrialPublicDto } from "@/lib/trials/types";
import { clampBrewingDuration } from "@/lib/trials/storefront-helpers";

export interface TrialKettleGuideProps {
  brewing?: TrialPublicDto["components"][0]["brewing"];
  teaName?: string;
}

export function TrialKettleGuide({ brewing, teaName = "Craft Milk Chai" }: TrialKettleGuideProps) {
  const dose = brewing?.dose_g || 2.5;
  const temp = brewing?.temp_c || 95;
  const steepSec = clampBrewingDuration(brewing?.time_sec || 180);
  const minutes = Math.floor(steepSec / 60);
  const remainderSeconds = steepSec % 60;
  const timeFormatted =
    remainderSeconds > 0 ? `${minutes}m ${remainderSeconds}s` : `${minutes} minutes`;

  return (
    <div
      data-testid="kettle-guide"
      className="kettle-guide bg-[#0d0b0a] text-[#f7f2eb] rounded-[22px] p-6 sm:p-8 border border-[#ffffff15] shadow-xl"
    >
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-[#e5b869] mb-1">
          A SIMPLE BREWING PROTOCOL
        </div>
        <h2 className="font-serif text-[28px] sm:text-[34px] leading-tight font-normal">
          Your kettle. <em className="italic text-[#e5b869]">Your own verdict.</em>
        </h2>
        <p className="text-[#a89a8e] text-[13px] mt-1">
          Recommended extraction protocol for {teaName}. Test under uniform conditions for fair evaluation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Step 1: Measure */}
        <div
          data-testid="kettle-step-1"
          className="kettle-step bg-[#171311] border border-[#d59e5b22] rounded-xl p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-serif text-[28px] text-[#e5b869] leading-none select-none">
                01
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#d59e5b] bg-[#3a291e] px-2 py-0.5 rounded">
                MEASURE
              </span>
            </div>
            <strong className="block text-[16px] text-white font-semibold mb-2">
              Weigh Leaf Dose ({dose}g)
            </strong>
            <p className="text-[13px] text-[#aa9e92] leading-relaxed">
              Weigh exactly {dose}g of leaf into 100ml to 150ml boiling water. Use calibrated scales rather than unverified spoons.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#ffffff10] text-[12px] text-[#e5b869]">
            Ratio: {dose}g leaf / 150ml water + 100ml milk
          </div>
        </div>

        {/* Step 2: Temperature & Milk */}
        <div
          data-testid="kettle-step-2"
          className="kettle-step bg-[#171311] border border-[#d59e5b22] rounded-xl p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-serif text-[28px] text-[#e5b869] leading-none select-none">
                02
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#d59e5b] bg-[#3a291e] px-2 py-0.5 rounded">
                HEAT
              </span>
            </div>
            <strong className="block text-[16px] text-white font-semibold mb-2">
              Rolling Boil ({temp}°C)
            </strong>
            <p className="text-[13px] text-[#aa9e92] leading-relaxed">
              Bring water to a vigorous rolling boil ({temp}°C). Add milk and simmer gently until foam rises twice in the pan.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#ffffff10] text-[12px] text-[#e5b869]">
            Water temp: 90-95°C · Double foam rise
          </div>
        </div>

        {/* Step 3: Steep & Strain */}
        <div
          data-testid="kettle-step-3"
          className="kettle-step bg-[#171311] border border-[#d59e5b22] rounded-xl p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-serif text-[28px] text-[#e5b869] leading-none select-none">
                03
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#d59e5b] bg-[#3a291e] px-2 py-0.5 rounded">
                JUDGE
              </span>
            </div>
            <strong className="block text-[16px] text-white font-semibold mb-2">
              Steeping ({timeFormatted})
            </strong>
            <p className="text-[13px] text-[#aa9e92] leading-relaxed">
              Maintain rolling simmer for {timeFormatted}. Strain through fine wire mesh. Judge color, aroma, and resteep potential.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#ffffff10] text-[12px] text-[#e5b869]">
            Duration: {steepSec}s · Decant immediately
          </div>
        </div>
      </div>
    </div>
  );
}
