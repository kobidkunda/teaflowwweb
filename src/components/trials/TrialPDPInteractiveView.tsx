"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { TrialPublicDto } from "@/lib/trials/types";
import { type TrialLocale } from "@/lib/trials/i18n";
import { TrialOpticalStudio } from "./TrialOpticalStudio";
import { TrialBuyBox } from "./TrialBuyBox";
import { TrialSensoryBento } from "./TrialSensoryBento";
import { TrialCostCalculator } from "./TrialCostCalculator";
import { TrialKettleGuide } from "./TrialKettleGuide";
import { TrialBulkLadder } from "./TrialBulkLadder";
import { TrialStickyActionBar } from "./TrialStickyActionBar";
import { TrialLanguageToggle } from "./TrialLanguageToggle";

export interface TrialPDPInteractiveViewProps {
  trial: TrialPublicDto;
}

export function TrialPDPInteractiveView({ trial }: TrialPDPInteractiveViewProps) {
  const [locale, setLocale] = useState<TrialLocale>("en");
  const [activePouchIndex, setActivePouchIndex] = useState<number>(0);

  const components = trial.components || [];
  const activeComponent = components[activePouchIndex] || components[0];

  // Localized trial title and description
  const localizedTitle =
    locale === "hi"
      ? trial.title.includes("Discovery Kit")
        ? "टीफ़्लो चार-चाय नमूना किट"
        : `${trial.title} (नमूना किट)`
      : trial.title;

  const localizedTagline =
    locale === "hi"
      ? "सिलीगुड़ी सीटीसी और साबुत खड़े मसालों से तैयार चार अनोखी दूध चाय। अपनी केतली में स्वयं परखें।"
      : trial.tagline;

  const localizedTrial: TrialPublicDto = {
    ...trial,
    title: localizedTitle,
    tagline: localizedTagline,
  };

  return (
    <div className="tf-trial-pdp-view">
      {/* Top Bar with Breadcrumbs & Language Toggle */}
      <div className="detailtop bg-gradient-to-r from-[#0c0a09] via-[#1a1410] to-[#211710] text-[#f7f2eb] py-8 border-b border-[#ffffff15]">
        <div className="max-w-[1260px] mx-auto px-4 md:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <nav aria-label="Breadcrumb trail" className="breadcrumbs text-[11px] text-[#bea585] uppercase tracking-wider font-semibold">
              <ol className="flex items-center gap-2">
                <li><Link href="/" className="hover:underline">HOME</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/trials" className="hover:underline">TEA TRIALS</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-[#e5b869] truncate max-w-[200px] sm:max-w-none">
                  {trial.title}
                </li>
              </ol>
            </nav>

            <TrialLanguageToggle
              currentLocale={locale}
              onLocaleChange={setLocale}
            />
          </div>

          {/* Top 2-Column Grid: Optical Studio & Buy Box */}
          <div className="details grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-8 items-start">
            <TrialOpticalStudio
              components={components}
              activePouchIndex={activePouchIndex}
              onPouchChange={setActivePouchIndex}
              locale={locale}
              heroImage={trial.hero_image}
              galleryImages={trial.gallery_images}
            />

            <TrialBuyBox trial={localizedTrial} />
          </div>
        </div>
      </div>

      {/* Main Body Sections */}
      <div className="max-w-[1260px] mx-auto px-4 md:px-6 pt-12 pb-24 md:pb-12 space-y-12">
        {/* Sensory Bento */}
        <section aria-labelledby="sensory-heading">
          <TrialSensoryBento
            activeComponent={activeComponent}
            claims={trial.claims}
          />
        </section>

        {/* Cost-Per-Cup Calculator */}
        <section aria-labelledby="calc-heading">
          <TrialCostCalculator
            initialPricePerKg={430}
            initialDoseGrams={activeComponent?.brewing?.dose_g || 2.5}
            kitWeightGrams={trial.net_weight_g || 200}
          />
        </section>

        {/* 3-Step Kettle Brewing Guide */}
        <section aria-labelledby="kettle-heading">
          <TrialKettleGuide
            brewing={activeComponent?.brewing}
            teaName={activeComponent?.name}
          />
        </section>

        {/* Bulk Conversion Ladder */}
        <section aria-labelledby="bulk-heading">
          <TrialBulkLadder
            bulkLink={activeComponent?.bulk_link}
            componentName={activeComponent?.name}
            isOutOfStock={!trial.in_stock}
          />
        </section>
      </div>

      {/* Mobile Sticky Action Bar */}
      <TrialStickyActionBar trial={localizedTrial} />
    </div>
  );
}
