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

export const metadata: Metadata = {
  title: "TeaFloww Blend Lab — Tea Evaluation & Custom Blending",
  description: "Understand your tea from dry leaf to infusion, liquor and milk response. Explore professional sensory evaluation and custom blend development with TeaFloww.",
  alternates: { canonical: "/blend-lab" },
  openGraph: { title: "TeaFloww Blend Lab — Your next signature tea starts here", description: "Professional tea evaluation and custom blend development for cafés, tea brands and bulk buyers.", url: "https://teafloww.com/blend-lab", siteName: "TeaFloww" },
};

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
