"use client";

import { useEffect, useState } from "react";
import { trackBusinessEvent } from "@/lib/business/events";
import type { PublicOfferView } from "@/lib/business/repository";
import type { BusinessLocale, OfferCode, Segment } from "@/lib/business/schema";
import { BusinessLeadForm } from "./BusinessLeadForm";
import { OfferGrid } from "./OfferGrid";
import { Section } from "./Section";
import { StickyLeadBar } from "./StickyLeadBar";
import { useTr } from "./BusinessI18n";

export function BusinessQuoteExperience({
  segment,
  locale,
  offers,
  leadsEnabled,
  whatsappE164,
  formHeading,
  formSubhead,
  quoteNotice,
  processSection,
  proofSection,
  faqSection,
}: {
  segment: Segment;
  locale: BusinessLocale;
  offers: PublicOfferView[];
  leadsEnabled: boolean;
  whatsappE164: string | null;
  formHeading: string;
  formSubhead: string;
  quoteNotice: string;
  processSection: React.ReactNode;
  proofSection: React.ReactNode;
  faqSection: React.ReactNode;
}) {
  const t = useTr();
  const [selectedOffer, setSelectedOffer] = useState<OfferCode | undefined>();
  const [formFocused, setFormFocused] = useState(false);

  useEffect(() => {
    trackBusinessEvent("business_page_view", { segment, locale });
  }, [segment, locale]);

  return (
    <>
      <Section
        id="solutions"
        eyebrow={t("THREE WAYS TO PARTNER")}
        title={t("Choose the format that fits your market.")}
        summary={
          t("Bulk supply, ready retail packs or your own label. Every option is quoted to your requirements.")
        }
      >
        <OfferGrid
          offers={offers}
          selectedOffer={selectedOffer}
          locale={locale}
          onSelect={setSelectedOffer}
        />
      </Section>

      {processSection}
      {proofSection}

      <Section id="business-quote" tone="forest">
        <div className="tf-form-panel">
          <div>
            <span className="tf-eyebrow">
              {t("YOUR BUSINESS QUOTE")}
            </span>
            <h2 className="tf-section-heading">{formHeading}</h2>
            <p className="tf-copy">{formSubhead}</p>
            <p className="tf-note" style={{ marginTop: "1rem" }}>
              {quoteNotice}
            </p>
          </div>
          <BusinessLeadForm
            segment={segment}
            locale={locale}
            selectedOffer={selectedOffer}
            leadsEnabled={leadsEnabled}
            whatsappE164={whatsappE164}
            onFocusChange={setFormFocused}
          />
        </div>
      </Section>

      {faqSection}

      <StickyLeadBar
        segment={segment}
        locale={locale}
        selectedOffer={selectedOffer}
        whatsappE164={whatsappE164}
        hidden={formFocused}
      />
    </>
  );
}
