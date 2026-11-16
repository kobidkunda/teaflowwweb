import React from "react";
import { cookies } from "next/headers";
import type { AnyTradeLocale, QuoteResult } from "@/lib/trade/contracts";
import { getTradeSettings } from "@/lib/trade/catalogue";
import { getTradeDictionary } from "@/lib/trade/i18n";
import { getTradeQuoteForSession } from "@/lib/trade/quotes";
import { TradeCheckoutReview } from "@/components/trade/TradeCheckoutReview";

export const dynamic = "force-dynamic";

export default async function TradeCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ quoteId?: string }>;
}) {
  const { locale } = await params;
  const { quoteId } = await searchParams;
  const settings = getTradeSettings();
  const dict = getTradeDictionary(locale as AnyTradeLocale);

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("tf_trade_sid")?.value || "";

  let confirmedQuote: Extract<QuoteResult, { kind: "confirmed" }> | null = null;
  let expired = false;

  if (quoteId && sessionId) {
    try {
      const loaded = getTradeQuoteForSession(quoteId, sessionId);
      if (loaded && loaded.row.kind === "confirmed") {
        expired = loaded.expired;
        confirmedQuote = {
          kind: "confirmed",
          id: String(loaded.row.id),
          quoteType: String(loaded.row.quote_type) as "bulk" | "trial",
          expiresAt: String(loaded.row.expires_at),
          destinationPin: String(loaded.row.destination_pin),
          payment: String(loaded.row.payment_method) as "prepaid" | "cod" | "freight_advance",
          serviceCode: "confirmed",
          serviceLabel: "Confirmed",
          laneId: String(loaded.row.lane_id || ""),
          laneVersion: Number(loaded.row.lane_version || 1),
          handover: loaded.handover || { kind: "doorstep", locality: "" },
          lines: loaded.lines,
          netGrams: Number(loaded.row.net_grams),
          grossGrams: Number(loaded.row.net_grams),
          dimensionalGrams: Number(loaded.row.billed_grams),
          billedGrams: Number(loaded.row.billed_grams),
          maxNetGrams: 30000,
          capacityRatio: Math.min(1, Number(loaded.row.net_grams) / 30000),
          currency: "INR",
          goodsPaise: Number(loaded.row.goods_paise),
          freightPaise: Number(loaded.row.freight_paise),
          extraTaxPaise: Number(loaded.row.extra_tax_paise),
          otherFeesPaise: Number(loaded.row.other_fees_paise),
          creditPaise: Number(loaded.row.credit_paise),
          totalPaise: Number(loaded.row.total_paise),
          dueNowPaise: Number(loaded.row.due_now_paise),
          dueLaterPaise: Number(loaded.row.due_later_paise),
          etaLabel: loaded.row.eta_label ? String(loaded.row.eta_label) : undefined,
        };
      }
    } catch {
      confirmedQuote = null;
    }
  }

  return (
    <TradeCheckoutReview
      locale={locale as AnyTradeLocale}
      dict={dict}
      settings={settings}
      quote={confirmedQuote}
      expired={expired}
    />
  );
}
