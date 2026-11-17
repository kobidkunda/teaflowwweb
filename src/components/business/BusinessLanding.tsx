import "./business.css";
import {
  getB2BPageContent,
  getB2BSettings,
  listPublicB2BClaims,
  listPublicB2BOffers,
} from "@/lib/business/repository";
import type { BusinessLocale, Segment } from "@/lib/business/schema";
import { AudienceSwitch } from "./AudienceSwitch";
import { BusinessFooter } from "./BusinessFooter";
import { BusinessHeader } from "./BusinessHeader";
import { BusinessHero } from "./BusinessHero";
import { BusinessQuoteExperience } from "./BusinessQuoteExperience";
import { FaqAccordion } from "./FaqAccordion";
import { ProcessTimeline } from "./ProcessTimeline";
import { ProofGallery } from "./ProofGallery";
import { Section } from "./Section";

export function BusinessLanding({
  segment,
  locale,
}: {
  segment: Segment;
  locale: BusinessLocale;
}) {
  const settings = getB2BSettings();
  const content = getB2BPageContent(segment, locale);
  const offers = listPublicB2BOffers(locale);
  const claims = listPublicB2BClaims("web");
  const isHi = locale === "hi";

  if (!content || !settings.business_landing_enabled) {
    return (
      <div className="tf-b2b-root" lang={locale}>
        <BusinessHeader segment={segment} locale={locale} />
        <main className="tf-section">
          <div className="tf-container">
            <h1>{isHi ? "TeaFloww बिज़नेस पोर्टल" : "TeaFloww Business Portal"}</h1>
            <p className="tf-copy">
              {isHi
                ? "यह पेज अभी अपडेट किया जा रहा है। कृपया कुछ समय बाद पुनः प्रयास करें।"
                : "This business page is currently being updated. Please check back shortly."}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const claimMap = new Map(
    claims.map((c) => [c.claim_key, isHi ? c.exact_copy_hi : c.exact_copy_en])
  );
  const quoteNotice =
    claimMap.get("quote_terms_notice") ??
    (isHi
      ? "कीमत, भाड़ा, टैक्स और डिलीवरी तारीख आपके लिखित कोटेशन में कन्फर्म की जाती है।"
      : "Prices, freight, tax and delivery dates are confirmed in your written quotation.");
  const siliguriClaim =
    claimMap.get("siliguri_origin") ??
    (isHi
      ? "सिलीगुड़ी से चाय सोर्सिंग और पैकेजिंग के विकल्प।"
      : "Tea sourcing and packaging options from Siliguri.");

  const processSection = (
    <Section
      id="process"
      tone="almond"
      eyebrow={isHi ? "स्पष्ट प्रक्रिया" : "A CLEAR PROCESS"}
      title={isHi ? "आपकी जानकारी से वास्तविक कोटेशन तक।" : "From your brief to a real quotation."}
      summary={content.process_intro}
    >
      <ProcessTimeline steps={content.steps} />
    </Section>
  );

  const proofSection = (
    <Section
      id="proof"
      eyebrow={isHi ? "चाय से पैक तक" : "BEYOND THE TEA LEAF"}
      title={content.proof_title}
      summary={content.proof_body}
    >
      <ProofGallery items={content.proof_items} />
    </Section>
  );

  const faqSection = (
    <Section
      id="faq"
      eyebrow="FAQ"
      title={isHi ? "शुरुआत करने से पहले" : "Before you get started"}
    >
      <FaqAccordion items={content.faq} locale={locale} />
    </Section>
  );

  return (
    <div className="tf-b2b-root tf-page-has-sticky" lang={locale}>
      <BusinessHeader segment={segment} locale={locale} />
      <main id="main-content" tabIndex={-1}>
        <BusinessHero content={content} locale={locale} />
        <AudienceSwitch segment={segment} locale={locale} />

        <BusinessQuoteExperience
          segment={segment}
          locale={locale}
          offers={offers}
          leadsEnabled={settings.leads_enabled}
          whatsappE164={settings.whatsapp_enabled ? settings.whatsapp_e164 : null}
          formHeading={content.form_heading}
          formSubhead={content.form_subhead}
          quoteNotice={quoteNotice}
          processSection={processSection}
          proofSection={proofSection}
          faqSection={faqSection}
        />
      </main>
      <BusinessFooter
        locale={locale}
        supportHours={settings.support_hours}
        siliguriClaim={siliguriClaim}
      />
    </div>
  );
}
