import { Text as StorefrontText } from "@/components/international/InternationalProvider";
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
        <div className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-[#e5b869] mb-1"><StorefrontText id="copy_dbfbec444c4f0088" fallback="A SIMPLE BREWING PROTOCOL" />
        </div>
        <h2 className="font-serif text-[28px] sm:text-[34px] leading-tight font-normal"><StorefrontText id="copy_1d1c3d4735169274" fallback="Your kettle." /> <em className="italic text-[#e5b869]"><StorefrontText id="copy_519fb483b1bea889" fallback="Your own verdict." /></em>
        </h2>
        <p className="text-[#a89a8e] text-[13px] mt-1"><StorefrontText id="copy_2c00d24cfa6a6166" fallback="Recommended extraction protocol for" /> {teaName}<StorefrontText id="copy_ef01881c61a9757c" fallback=". Test under uniform conditions for fair evaluation." />
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
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#d59e5b] bg-[#3a291e] px-2 py-0.5 rounded"><StorefrontText id="copy_0bb2241e31a9f7eb" fallback="MEASURE" />
              </span>
            </div>
            <strong className="block text-[16px] text-white font-semibold mb-2"><StorefrontText id="copy_e3240f6dfbdf39fe" fallback="Weigh Leaf Dose (" />{dose}g)
            </strong>
            <p className="text-[13px] text-[#aa9e92] leading-relaxed"><StorefrontText id="copy_4bdc3a7459c52226" fallback="Weigh exactly" /> {dose}<StorefrontText id="copy_de0622ea0056025e" fallback="g of leaf into 100ml to 150ml boiling water. Use calibrated scales rather than unverified spoons." />
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#ffffff10] text-[12px] text-[#e5b869]"><StorefrontText id="copy_35f67c0c4a19ae83" fallback="Ratio:" /> {dose}<StorefrontText id="copy_b3c1aa956f7b3db6" fallback="g leaf / 150ml water + 100ml milk" />
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
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#d59e5b] bg-[#3a291e] px-2 py-0.5 rounded"><StorefrontText id="copy_9e111938ea4c7a91" fallback="HEAT" />
              </span>
            </div>
            <strong className="block text-[16px] text-white font-semibold mb-2"><StorefrontText id="copy_76d985b0f2006cd4" fallback="Rolling Boil (" />{temp}<StorefrontText id="copy_18a3291bd76fe13f" fallback="°C)" />
            </strong>
            <p className="text-[13px] text-[#aa9e92] leading-relaxed"><StorefrontText id="copy_5acc54cc86121d5f" fallback="Bring water to a vigorous rolling boil (" />{temp}<StorefrontText id="copy_a2187f250fee0642" fallback="°C). Add milk and simmer gently until foam rises twice in the pan." />
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#ffffff10] text-[12px] text-[#e5b869]"><StorefrontText id="copy_8e721459b5d600f1" fallback="Water temp: 90-95°C · Double foam rise" />
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
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#d59e5b] bg-[#3a291e] px-2 py-0.5 rounded"><StorefrontText id="copy_be5aa6e7e0036550" fallback="JUDGE" />
              </span>
            </div>
            <strong className="block text-[16px] text-white font-semibold mb-2"><StorefrontText id="copy_f4d9aa459a5ad245" fallback="Steeping (" />{timeFormatted})
            </strong>
            <p className="text-[13px] text-[#aa9e92] leading-relaxed"><StorefrontText id="copy_2cbd662369e55940" fallback="Maintain rolling simmer for" /> {timeFormatted}<StorefrontText id="copy_8f60a64960f1cbd0" fallback=". Strain through fine wire mesh. Judge color, aroma, and resteep potential." />
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#ffffff10] text-[12px] text-[#e5b869]"><StorefrontText id="copy_298d6c7549e48a97" fallback="Duration:" /> {steepSec}<StorefrontText id="copy_fd3ec5a491960afd" fallback="s · Decant immediately" />
          </div>
        </div>
      </div>
    </div>
  );
}
