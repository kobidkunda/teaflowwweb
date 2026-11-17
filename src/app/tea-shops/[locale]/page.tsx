import { publishedTexts } from "@/lib/international/translations";
import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import type { AnyTradeLocale } from "@/lib/trade/contracts";
import {
  getPublicTradeTrial,
  getTradeSettings,
  listLocalizedContent,
  listPublicTradeProducts,
  listTradeSharedPilots,
} from "@/lib/trade/catalogue";
import { getTradeDictionary } from "@/lib/trade/i18n";
import { TradeStorefrontClient } from "@/components/trade/TradeStorefrontClient";

export const dynamic = "force-dynamic";

export default async function TradeLocalePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const settings = getTradeSettings();
  if (!settings.channel_enabled) {
    notFound();
  }

  const typedLocale = locale as AnyTradeLocale;
  const products = listPublicTradeProducts();
  const trial = getPublicTradeTrial(settings);
  const sharedPilots = listTradeSharedPilots(true);
  const dict = getTradeDictionary(typedLocale);
  for (const product of products) {
    const texts = publishedTexts(`product:${product.productId}`, typedLocale);
    if (texts?.name) dict[`product.${product.productId}.name`] = texts.name;
    if (texts?.tasting_notes) dict[`product.${product.productId}.tasting_notes`] = texts.tasting_notes;
  }
  if (trial && typedLocale === "hi") {
    const names: Record<string, string> = {
      "Rozana Kadak — Daily Stall Tea": dict["ui.trialName1"],
      "Elaichi Tea — Cardamom Chai": dict["ui.trialName2"],
      "Masala Tea — Spiced Chai Blend": dict["ui.trialName3"],
      "Ginger Tea — Adrak Chai": dict["ui.trialName4"],
    };
    for (const c of trial.components) dict[`trial.component.${c.slot_index}.name`] ||= names[c.name] || c.name;
  }
  const l10n = listLocalizedContent(typedLocale);
  const heroIntroContent = l10n.find((item) => item.resource_key === "hero.intro");

  return (
    <Suspense fallback={null}>
      <TradeStorefrontClient
        locale={typedLocale}
        dict={dict}
        settings={settings}
        products={products}
        trial={trial}
        sharedPilots={sharedPilots}
        heroAudioUrl={heroIntroContent?.audio_url ?? null}
        heroTranscript={heroIntroContent?.transcript ?? null}
      />
    </Suspense>
  );
}
