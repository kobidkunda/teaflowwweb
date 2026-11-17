"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Leaf, Package, Tag, Check } from "lucide-react";
import type { PublicOfferView } from "@/lib/business/repository";
import type { BusinessLocale, OfferCode } from "@/lib/business/schema";
import { trackBusinessEvent } from "@/lib/business/events";
import { BusinessLeadForm } from "../BusinessLeadForm";
import styles from "./starter.module.css";

export function StarterConversion({ offers, locale, leadsEnabled, whatsappE164, heading, subhead, quoteNotice, children, faq }: {
  offers: PublicOfferView[]; locale: BusinessLocale; leadsEnabled: boolean; whatsappE164: string | null;
  heading: string; subhead: string; quoteNotice: string; children: ReactNode; faq: ReactNode;
}) {
  const t = (en: string, hi: string) => locale === "hi" ? hi : en;
  const [selected, setSelected] = useState<OfferCode>();
  const [focused, setFocused] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const formSection = useRef<HTMLElement>(null);
  useEffect(() => {
    trackBusinessEvent("business_page_view", { segment: "starter", locale });
    const updateFocus = (event: FocusEvent) => {
      const target = event.type === "focusout" ? event.relatedTarget : event.target;
      setFocused(target instanceof Element && Boolean(target.closest("input, textarea, select, #business-quote form")));
    };
    document.addEventListener("focusin", updateFocus);
    document.addEventListener("focusout", updateFocus);
    const footer = document.getElementById("starter-footer");
    const observer = new IntersectionObserver(([entry]) => setAtEnd(entry.isIntersecting));
    if (footer) observer.observe(footer);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", updateFocus);
      document.removeEventListener("focusout", updateFocus);
    };
  }, [locale]);
  const details = {
    ready_retail: { icon: Package, fit: t("Retailers & local resellers", "रिटेलर और स्थानीय विक्रेता"), work: t("Choose packs, find customers and manage selling.", "पैक चुनें, ग्राहक खोजें और बिक्री संभालें।"), channel: t("Local shops, direct customers", "स्थानीय दुकानें, सीधे ग्राहक") },
    bulk_supply: { icon: Leaf, fit: t("Buyers planning their own packing", "खुद पैकिंग करने वाले खरीदार"), work: t("Plan packing, storage and your sales channel.", "पैकिंग, भंडारण और बिक्री चैनल की योजना बनाएं।"), channel: t("Trade supply, local packing", "थोक सप्लाई, स्थानीय पैकिंग") },
    private_label: { icon: Tag, fit: t("Founders building a tea brand", "अपना चाय ब्रांड बनाने वाले"), work: t("Confirm blend, pack, artwork and print commitments.", "ब्लेंड, पैक, डिज़ाइन और प्रिंट की शर्तें तय करें।"), channel: t("Your brand’s chosen channels", "आपके ब्रांड के चुने हुए चैनल") },
  };
  // Approved offers and their operator-authored descriptions remain authoritative.
  const ordered = [...offers].sort((a, b) => ["ready_retail", "bulk_supply", "private_label"].indexOf(a.code) - ["ready_retail", "bulk_supply", "private_label"].indexOf(b.code));
  return <>
    <section id="solutions" className={styles.section} aria-labelledby="starter-models-title">
      <div className={styles.container}>
        <p className={styles.eyebrow}>{t("CHOOSE YOUR BUSINESS MODEL", "अपना बिज़नेस मॉडल चुनें")}</p>
        <h2 id="starter-models-title">{t("Three ways to make tea your business.", "चाय का बिज़नेस करने के तीन तरीके।")}</h2>
        <p className={styles.intro}>{t("The right format depends on your customers, your budget and how much you want to manage yourself.", "सही फॉर्मेट आपके ग्राहकों, बजट और खुद संभालने वाले काम पर निर्भर करता है।")}</p>
        <div className={styles.models}>
          {ordered.map(offer => {
            const d = details[offer.code]; const Icon = d.icon;
            return <article key={offer.id} className={styles.model} data-selected={selected === offer.code}>
              <Icon size={38} strokeWidth={1.35} aria-hidden="true" />
              <h3>{offer.title}</h3><p>{offer.description}</p>
              <dl><div><dt>{t("Best suited to", "किसके लिए")}</dt><dd>{d.fit}</dd></div>
                <div><dt>{t("Your role", "आपका काम")}</dt><dd>{d.work}</dd></div>
                <div><dt>{t("Where to sell", "कहां बेचें")}</dt><dd>{d.channel}</dd></div></dl>
              {offer.moqText && <p className={styles.small}>{offer.moqText}</p>}
              <button type="button" className={styles.outlineButton} aria-pressed={selected === offer.code} onClick={() => {
                setSelected(offer.code);
                formSection.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
                document.getElementById("tf-interest")?.focus({ preventScroll: true });
              }}>{selected === offer.code && <Check size={16} aria-hidden="true" />}{offer.ctaLabel}<ArrowRight size={16} aria-hidden="true" /></button>
            </article>;
          })}
        </div>
        {!ordered.length && <p>{t("Supply options are being updated. Ask the trade desk about your requirements below.", "सप्लाई विकल्प अपडेट हो रहे हैं। नीचे अपनी जरूरत बताएं।")}</p>}
      </div>
    </section>
    {children}
    <section id="business-quote" ref={formSection} className={styles.quote} aria-labelledby="starter-quote-title">
      <div className={`${styles.container} ${styles.quoteGrid}`}>
        <div><p className={styles.eyebrow}>{t("YOUR NEXT STEP", "आपका अगला कदम")}</p><h2 id="starter-quote-title">{heading}</h2><p>{subhead}</p>
          <p className={styles.quoteNote}>{quoteNotice}</p>
          <ul className={styles.quoteChecklist}>{[
            t("Your chosen tea and pack format", "आपकी चुनी चाय और पैक फॉर्मेट"),
            t("Quantity, MOQ and packaging commitments", "मात्रा, MOQ और पैकेजिंग की शर्तें"),
            t("Itemised costs, applicable tax and freight", "अलग-अलग खर्च, लागू टैक्स और भाड़ा"),
            t("Sampling terms and confirmed lead time", "सैंपल की शर्तें और पुष्ट समय सीमा"),
          ].map(item => <li key={item}><Check size={17} aria-hidden="true" />{item}</li>)}</ul>
        </div>
        <BusinessLeadForm segment="starter" locale={locale} selectedOffer={selected} leadsEnabled={leadsEnabled} whatsappE164={whatsappE164} onFocusChange={setFocused} />
      </div>
    </section>
    {faq}
    <div className={styles.sticky} hidden={focused || atEnd} aria-label={t("Quick business actions", "बिज़नेस के अगले कदम")}>
      <a href="#samples" className={styles.goldButton}>{t("Explore samples", "सैंपल देखें")}</a>
      <a href="#business-quote" className={styles.outlineButton}>{t("Get a quote", "कोटेशन लें")}</a>
    </div>
  </>;
}
