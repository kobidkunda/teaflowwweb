"use client";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";

export interface QCMilestoneData {
  id?: string;
  stage: string;
  milestone_name: string;
  status: "pending" | "passed" | "failed" | "waived" | "conditionally_passed";
  inspector_name?: string | null;
  inspection_date?: string | null;
  evidence_notes?: string | null;
  evidence_photo_url?: string | null;
  cupping_score?: number | null;
  recorded_weight_g?: number | null;
  target_weight_g?: number | null;
  notes?: string | null;
}

export interface QCMilestoneTimelineProps {
  milestones?: QCMilestoneData[];
  jobStatus?: string;
}

const STANDARD_STAGES = [
  { stage: "raw_material", name: "Tea Leaf Lot & Moisture" },
  { stage: "packaging_incoming", name: "Packaging Substrate Check" },
  { stage: "print_proof", name: "Color & Prepress Press-Sheet" },
  { stage: "fill_weight", name: "Fill Weight Tolerance (±1.5%)" },
  { stage: "seal_integrity", name: "Hermetic Seal Vacuum Test" },
  { stage: "sensory_cupping", name: "Production Sensory Cupping" },
  { stage: "final_pack", name: "Master Shipper & Pallet QC" },
];

export function QCMilestoneTimeline({
  milestones = [],
  jobStatus = "scheduled",
}: QCMilestoneTimelineProps) {
  // Map provided milestones by stage (handling aliases)
  const milestoneMap = new Map<string, QCMilestoneData>();
  for (const m of milestones) {
    let s = m.stage;
    if (s === "raw_material_in") s = "raw_material";
    if (s === "packaging_cartoning" || s === "final") s = "final_pack";
    milestoneMap.set(s, m);
  }

  // Active step is the first non-completed stage
  const activeIndex = STANDARD_STAGES.findIndex((def) => {
    const st = milestoneMap.get(def.stage)?.status || "pending";
    return st === "pending";
  });

  return (
    <section
      aria-labelledby="qc-timeline-heading"
      data-testid="qc-milestone-tracker"
      className="w-full bg-[#FCFAF6] border border-[#E8E4DC] rounded-xl p-5 md:p-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-6 border-b border-[#E8E4DC] gap-2">
        <div>
          <h2 id="qc-timeline-heading" className="text-lg font-serif font-bold text-[#143C31]"><StorefrontText id="copy_0fd0e28481b1a982" fallback="Siliguri Cleanroom Quality Assurance (7 Stages)" />
          </h2>
          <p className="text-xs text-[#65746D]"><StorefrontText id="copy_921a5cb8a2ea9613" fallback="Rigorous FSSAI batch verification from raw leaf lot arrival to final export shrink-wrap." />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-[#65746D]"><StorefrontText id="copy_e8955fecc0f64047" fallback="Job Status:" /></span>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[#E4ECE7] text-[#143C31] border border-[#C5D6CC]">
            {jobStatus.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Responsive timeline: horizontal on desktop, vertical stacked on mobile */}
      <ol className="relative flex flex-col md:flex-row md:justify-between gap-6 md:gap-2">
        {STANDARD_STAGES.map((def, idx) => {
          const m = milestoneMap.get(def.stage);
          const status = m?.status || "pending";
          const isPassed = status === "passed" || status === "conditionally_passed";
          const isFailed = status === "failed";
          const isWaived = status === "waived";

          let circleBg = "bg-amber-50 border-amber-300 text-amber-700";
          let badgeBg = "bg-amber-100 text-amber-800 border-amber-200";
          let Icon = Clock;

          if (isPassed) {
            circleBg = "bg-[#143C31] border-[#143C31] text-white";
            badgeBg = "bg-emerald-100 text-emerald-800 border-emerald-200";
            Icon = CheckCircle2;
          } else if (isFailed) {
            circleBg = "bg-rose-600 border-rose-600 text-white";
            badgeBg = "bg-rose-100 text-rose-800 border-rose-200";
            Icon = XCircle;
          } else if (isWaived) {
            circleBg = "bg-stone-200 border-stone-300 text-stone-600";
            badgeBg = "bg-stone-100 text-stone-700 border-stone-200";
            Icon = AlertCircle;
          }

          return (
            <li
              key={def.stage}
              data-testid={`qc-stage-${def.stage}`}
              aria-current={idx === activeIndex ? "step" : undefined}
              className="flex-1 flex flex-row md:flex-col items-start md:items-center text-left md:text-center relative gap-3 md:gap-2"
            >
              {/* Connector line for desktop */}
              {idx < STANDARD_STAGES.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`hidden md:block absolute top-4 left-1/2 w-full h-0.5 z-0 ${
                    isPassed ? "bg-[#143C31]" : "bg-[#DDE4DC]"
                  }`}
                />
              )}

              {/* Icon Node */}
              <div
                className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 shadow-xs shrink-0 ${circleBg}`}
                aria-hidden="true"
              >
                <Icon size={16} />
              </div>

              {/* Stage Details */}
              <div className="flex flex-col md:items-center w-full">
                <span className="text-[10px] font-mono uppercase text-[#65746D]"><StorefrontText id="copy_de838855e4a6e04e" fallback="Stage" /> {idx + 1}
                </span>
                <span className="text-xs font-semibold text-[#143C31] mt-0.5 line-clamp-2 md:max-w-[120px]">
                  {def.name}
                </span>
                <span
                  data-testid="qc-stage-status"
                  className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeBg}`}
                >
                  {status}
                </span>

                {/* Optional metadata: inspector, score, weights */}
                {m?.inspector_name && (
                  <p className="text-[10px] text-[#65746D] mt-1">
                    By {m.inspector_name}
                  </p>
                )}
                {m?.cupping_score !== undefined && m.cupping_score !== null && (
                  <p className="text-[10px] font-medium text-[#143C31] mt-0.5"><StorefrontText id="copy_9689a814f3584ec9" fallback="Score:" /> {m.cupping_score} / 100
                  </p>
                )}
                {m?.recorded_weight_g !== undefined && m.recorded_weight_g !== null && (
                  <p className="text-[10px] text-[#65746D] mt-0.5">
                    {m.recorded_weight_g}<StorefrontText id="copy_f654f17957ad11c2" fallback="g /" /> {m.target_weight_g || 250}g
                  </p>
                )}
                {(m?.notes || m?.evidence_notes) && (
                  <p className="text-[10px] text-[#4A5550] italic mt-0.5 max-w-[160px] line-clamp-2">
                    &ldquo;{m.notes || m.evidence_notes}&rdquo;
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
