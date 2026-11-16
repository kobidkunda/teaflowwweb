import React from "react";
import type { AnyTradeLocale } from "@/lib/trade/contracts";
import { getTradeSettings } from "@/lib/trade/catalogue";
import { getTradeDictionary } from "@/lib/trade/i18n";
import { getAuthorizedTradeOrder } from "@/lib/trade/checkout";
import { TradeOrderClient } from "@/components/trade/TradeOrderClient";

export const dynamic = "force-dynamic";

export default async function TradeOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale, id } = await params;
  const { token = "" } = await searchParams;
  const settings = getTradeSettings();
  const dict = getTradeDictionary(locale as AnyTradeLocale);

  let order = null;
  try {
    order = getAuthorizedTradeOrder(id, token);
  } catch {
    order = null;
  }

  return (
    <TradeOrderClient
      locale={locale as AnyTradeLocale}
      dict={dict}
      settings={settings}
      order={order}
      accessToken={token}
    />
  );
}
