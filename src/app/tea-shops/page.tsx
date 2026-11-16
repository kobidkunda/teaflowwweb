import React, { Suspense } from "react";
import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/seo/site";
import { getTradeSettings } from "@/lib/trade/catalogue";
import { TradeNeutralEntry } from "@/components/trade/TradeNeutralEntry";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const settings = getTradeSettings();
  const languages: Record<string, string> = {
    "x-default": `${siteUrl}/tea-shops`,
  };
  for (const loc of settings.enabled_locales) {
    languages[loc] = `${siteUrl}/tea-shops/${loc}`;
  }
  return {
    title: "TeaFloww Trade · For Tea Shops",
    description:
      "Try TeaFloww in the chai you serve every day. Check delivered bulk pack pricing by PIN code.",
    alternates: {
      canonical: `${siteUrl}/tea-shops`,
      languages,
    },
  };
}

export default function TeaShopsNeutralPage() {
  const settings = getTradeSettings();
  return (
    <Suspense fallback={null}>
      <TradeNeutralEntry enabledLocales={settings.enabled_locales} />
    </Suspense>
  );
}
