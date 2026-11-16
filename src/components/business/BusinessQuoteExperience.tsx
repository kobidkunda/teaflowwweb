"use client";

import { useEffect, useState } from "react";
import { trackBusinessEvent } from "@/lib/business/events";
import type { PublicOfferView } from "@/lib/business/repository";
import type { BusinessLocale, OfferCode, Segment } from "@/lib/business/schema";
import { BusinessLeadForm } from "./BusinessLeadForm";
import { OfferGrid } from "./OfferGrid";
import { Section } from "./Section";
import { StickyLeadBar } from "./StickyLeadBar";

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
  const [selectedOffer, setSelectedOffer] = useState<OfferCode | undefined>();
  const [formFocused, setFormFocused] = useState(false);
  const isHi = locale === "hi";

  useEffect(() => {
    trackBusinessEvent("business_page_view", { segment, locale });
  }, [segment, locale]);

  return (
    <>
      <Section
        id="solutions"
        eyebrow={isHi ? "साझेदारी के 3 विकल्प" : "THREE WAYS TO PARTNER"}
        title={isHi ? "अपने बाज़ार के अनुसार सही फॉर्मेट चुनें।" : "Choose the format that fits your market."}
        summary={
          isHi
            ? "थोक सप्लाई, तैयार रिटेल पैक या आपका अपना ब्रांड। हर विकल्प का कोटेशन आपकी आवश्यकता के अनुसार दिया जाता है।"
            : "Bulk supply, ready retail packs or your own label. Every option is quoted to your requirements."
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
              {isHi ? "आपका बिज़नेस कोटेशन" : "YOUR BUSINESS QUOTE"}
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
