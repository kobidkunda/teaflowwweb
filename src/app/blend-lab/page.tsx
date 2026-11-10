import React from "react";
import type { Metadata } from "next";
import { BlendLabHero } from "@/components/blend-lab/BlendLabHero";
import { MethodologySection } from "@/components/blend-lab/MethodologySection";
import { GoalExplorer } from "@/components/blend-lab/GoalExplorer";
import { SyntheticReportPreview } from "@/components/blend-lab/SyntheticReportPreview";
import { TierComparisonTable } from "@/components/blend-lab/TierComparisonTable";
import { BlendLabFaq } from "@/components/blend-lab/BlendLabFaq";
import { listPlans } from "@/lib/blend-lab/plans";
import { getBlendLabContent } from "@/lib/blend-lab/content";
import "@/components/blend-lab/blend-lab.css";

import { constructMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructMetadata({
  title: "TeaFloww Blend Lab — Professional Tea Evaluation & Blending",
  description: "Understand your tea from dry leaf to infusion, liquor and milk response. Explore professional sensory evaluation and custom blend development with TeaFloww.",
  path: "/blend-lab",
});

export default function BlendLabPage() {
  const plans = listPlans({ activeOnly: true });
  const content = getBlendLabContent();
  return (
    <div className="bl-workshop">
      <BlendLabHero content={content} />
      <GoalExplorer />
      <MethodologySection />
      <SyntheticReportPreview />
      <TierComparisonTable plans={plans} />
      <BlendLabFaq initialFaqs={content.faqs} />
    </div>
  );
}
