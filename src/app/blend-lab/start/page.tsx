import React, { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { IntakeWizard } from "@/components/blend-lab/wizard/IntakeWizard";
import { ChevronLeft, FlaskConical, Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Blend Lab Intake — TeaFloww Commercial Atelier",
  description: "Register your reference tea sample for professional cupping, cost optimization, and custom formulation.",
  alternates: {
    canonical: "/blend-lab/start",
  },
};

export default function BlendLabStartPage() {
  return (
    <div className="min-h-screen bg-[#f7f4ed] text-[#19332b]">
      <div className="py-10 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          {/* Top Breadcrumb & Heading */}
          <div className="mb-8 space-y-3">
            <Link
              href="/blend-lab"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#65746d] hover:text-[#143c31] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Blend Lab Overview</span>
            </Link>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#b8753d]">
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>5-STEP SERVICE REGISTRATION</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-serif text-[#092b23] mt-1">
                  Blend Lab Project Intake
                </h1>
              </div>

              <span className="text-xs text-[#65746d] bg-white px-3.5 py-1.5 rounded-full border border-[#dde4dc]">
                🔒 256-Bit Encrypted & Idempotent
              </span>
            </div>
          </div>

          {/* Stepper Wizard wrapped in Suspense */}
          <Suspense
            fallback={
              <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 text-[#143c31] animate-spin" />
                <span className="text-xs text-[#65746d]">
                  Initializing Blend Lab Intake Wizard...
                </span>
              </div>
            }
          >
            <IntakeWizard />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
