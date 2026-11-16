import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteUrl } from "@/lib/seo/site";
import { ALL_TRADE_LOCALES, type AnyTradeLocale } from "@/lib/trade/contracts";
import { getTradeSettings } from "@/lib/trade/catalogue";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
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
      "Taste a trial at your tea counter or check delivered bulk pack pricing by PIN code.",
    alternates: {
      canonical: `${siteUrl}/tea-shops/${locale}`,
      languages,
    },
  };
}

export default async function TradeLocaleLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
}) {
  const { locale } = await params;
  if (!(ALL_TRADE_LOCALES as readonly string[]).includes(locale as AnyTradeLocale)) {
    notFound();
  }
  return <>{children}</>;
}
