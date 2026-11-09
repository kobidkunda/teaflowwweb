import React from "react";
import type { TrialPublicDto } from "@/lib/trials/types";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export interface TrialSensoryBentoProps {
  activeComponent: TrialPublicDto["components"][0];
  claims?: TrialPublicDto["claims"];
}

export function TrialSensoryBento({ activeComponent, claims = [] }: TrialSensoryBentoProps) {
  // Filter only verified claims and strictly purge unverified marketing assertions
  const verifiedClaims = (claims || []).filter(
    (c) =>
      c.verified &&
      !c.label.includes("without test") &&
      !c.label.includes("without verification") &&
      !c.label.includes("50% guaranteed")
  );

  const tastingNotes = activeComponent?.tasting_notes || [
    "Full-bodied",
    "Malty",
    "Rich Liquor",
    "Sweet Finish",
  ];

  return (
    <div
      data-testid="sensory-bento"
      className="sensory-bento bg-white border border-[#e6e0d4] rounded-[22px] p-6 sm:p-8 shadow-[0_20px_40px_rgba(20,59,47,0.06)] text-[#0d0b0a]"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6 border-b border-[#eeeae3] pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-[#7c4f1c] mb-1">
            SENSORY BENCHMARK
          </div>
          <h2 className="font-serif text-[28px] sm:text-[34px] leading-tight font-normal">
            Cupping profile: <em className="italic text-[#ae8452]">{activeComponent?.name}</em>
          </h2>
        </div>
        <div
          data-testid="sensory-score"
          className="sensory-score bg-[#faf7f0] border border-[#e6dfd0] rounded-xl px-3 py-2 text-right"
        >
          <div className="text-[10px] uppercase tracking-[0.1em] text-[#67756d] font-bold">
            CUPSCORE EVALUATION
          </div>
          <strong className="font-serif text-[20px] text-[#143b2f]">
            8.8 <span className="text-[12px] font-sans text-[#7a857e]">/ 10</span>
          </strong>
          <span className="block text-[9px] text-[#8c948e]">Standard Roadside Pot Boil</span>
        </div>
      </div>

      {/* 4 Quadrants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Quadrant 1: Aroma */}
        <div className="bg-[#faf7f0] border border-[#e8e2d4] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <strong className="text-[14px] font-serif text-[#143b2f]">Aroma Depth</strong>
            <span
              data-testid="sensory-badge"
              className="badge px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#143b2f] text-white"
            >
              High Pungency
            </span>
          </div>
          <p className="text-[13px] text-[#55645b] leading-relaxed">
            Freshly crushed leaf aroma with toasted malt and warm spices, developing sweet caramel tones upon initial rolling boil.
          </p>
        </div>

        {/* Quadrant 2: Liquor Body */}
        <div className="bg-[#faf7f0] border border-[#e8e2d4] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <strong className="text-[14px] font-serif text-[#143b2f]">Liquor Body & Tone</strong>
            <span
              data-testid="sensory-badge"
              className="badge px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8c4e28] text-white"
            >
              Deep Amber Red
            </span>
          </div>
          <p className="text-[13px] text-[#55645b] leading-relaxed">
            Dense, coppery liquor with intense tea polyphenol extraction. Retains bright amber crown when blended with full-cream milk.
          </p>
        </div>

        {/* Quadrant 3: Flavor Notes */}
        <div className="bg-[#faf7f0] border border-[#e8e2d4] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <strong className="text-[14px] font-serif text-[#143b2f]">Flavor Notes</strong>
            <span
              data-testid="sensory-badge"
              className="badge px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7c4f1c] text-white"
            >
              Estate Blend
            </span>
          </div>
          <div data-testid="tasting-notes-list" className="tasting-notes flex flex-wrap gap-1.5 mt-2">
            {tastingNotes.map((note, idx) => (
              <span
                key={idx}
                className="bg-white border border-[#d9d2c2] text-[#2c4033] px-2.5 py-1 rounded-md text-[11px] font-medium"
              >
                {note}
              </span>
            ))}
          </div>
        </div>

        {/* Quadrant 4: Mouthfeel */}
        <div className="bg-[#faf7f0] border border-[#e8e2d4] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <strong className="text-[14px] font-serif text-[#143b2f]">Mouthfeel & Cream Lacing</strong>
            <span
              data-testid="sensory-badge"
              className="badge px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#143b2f] text-white"
            >
              Smooth Viscosity
            </span>
          </div>
          <p className="text-[13px] text-[#55645b] leading-relaxed">
            Thick, non-chalky coating that cuts cleanly through milk fats without lingering astringency or bitterness on the palate.
          </p>
        </div>
      </div>

      {/* Verified Claims Badges */}
      {verifiedClaims.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-3 text-[#143b2f] font-bold text-[12px] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#287455]" />
            <span>Verified Compliance & Sourcing Declarations</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {verifiedClaims.map((claim, idx) => (
              <div
                key={idx}
                data-testid="verified-claim-badge"
                className="verified-claim inline-flex items-center gap-1.5 bg-[#eaf4ed] border border-[#b9dcbf] text-[#1e5837] px-3 py-1.5 rounded-lg text-[12px] font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#287455]" />
                <span>{claim.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
