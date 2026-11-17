"use client";

import { trackBusinessEvent } from "@/lib/business/events";
import type { BusinessLocale, OfferCode, Segment } from "@/lib/business/schema";
import { buildWhatsAppLink } from "@/lib/business/whatsapp";
import { useTr } from "./BusinessI18n";

export function StickyLeadBar({
  segment,
  locale,
  selectedOffer,
  whatsappE164,
  hidden,
}: {
  segment: Segment;
  locale: BusinessLocale;
  selectedOffer?: OfferCode;
  whatsappE164?: string | null;
  hidden: boolean;
}) {
  const t = useTr();
  if (hidden) return null;
  const waUrl = buildWhatsAppLink(whatsappE164, {
    segment,
    interest: selectedOffer ?? "unsure",
    locale,
  });

  return (
    <div className="tf-mobile-bar" role="region" aria-label={t("Quick quote actions")}>
      <a href="#business-quote" className="tf-button tf-button--forest" style={{ minHeight: 46, fontSize: "0.9rem" }}>
        {t("Get Quote")}
      </a>
      {waUrl ? (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tf-button tf-button--gold"
          style={{ minHeight: 46, fontSize: "0.9rem" }}
          onClick={() =>
            trackBusinessEvent("business_whatsapp_click", {
              segment,
              interest: selectedOffer ?? "unsure",
              placement: "sticky_mobile_bar",
            })
          }
        >
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}
