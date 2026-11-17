"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import Image from "next/image";
import type { PublicOfferView } from "@/lib/business/repository";
import type { BusinessLocale, OfferCode } from "@/lib/business/schema";
import { trackBusinessEvent } from "@/lib/business/events";
import { BusinessLeadForm } from "../BusinessLeadForm";
import styles from "./starter.module.css";
import { LaunchPlanner } from "./LaunchPlanner";
import { useTr } from "../BusinessI18n";

export function StarterConversion({ offers, locale, leadsEnabled, whatsappE164, heading, subhead, quoteNotice, children, faq }: {
  offers: PublicOfferView[]; locale: BusinessLocale; leadsEnabled: boolean; whatsappE164: string | null;
  heading: string; subhead: string; quoteNotice: string; children: ReactNode; faq: ReactNode;
}) {
  const t = useTr();
  const [selected, setSelected] = useState<OfferCode>();
  const [planNote, setPlanNote] = useState("");
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
    ready_retail: { image: "starter-model-retail.webp", alt: locale === "hi" ? "छोटे, मध्यम और बड़े तैयार चाय पाउच का उदाहरण" : "Illustration of small, medium and large ready-to-sell tea pouches", fit: t("Retailers & local resellers"), work: t("Choose packs, find customers and manage selling."), channel: t("Local shops, direct customers") },
    bulk_supply: { image: "starter-model-bulk.webp", alt: locale === "hi" ? "खुली चाय और रीपैकिंग के पाउच के साथ बड़े चाय बोरे का उदाहरण" : "Illustration of large tea sacks with loose tea and small pouches for repacking", fit: t("Buyers planning their own packing"), work: t("Plan packing, storage and your sales channel."), channel: t("Trade supply, local packing") },
    private_label: { image: "starter-model-private-label.webp", alt: locale === "hi" ? "अपने ब्रांड के चाय पाउच, लेबल और रंगों की डिज़ाइन मेज़ का उदाहरण" : "Illustration of custom tea pouches, label artwork and colour swatches on a design table", fit: t("Founders building a tea brand"), work: t("Confirm blend, pack, artwork and print commitments."), channel: t("Your brand’s chosen channels") },
  };
  // Approved offers and their operator-authored descriptions remain authoritative.
  const ordered = [...offers].sort((a, b) => ["ready_retail", "bulk_supply", "private_label"].indexOf(a.code) - ["ready_retail", "bulk_supply", "private_label"].indexOf(b.code));
  return <>
    <LaunchPlanner locale={locale} onPlan={(offer, summary) => { setSelected(offer); setPlanNote(summary); }} />
    <section id="solutions" className={styles.section} aria-labelledby="starter-models-title">
      <div className={styles.container}>
        <p className={styles.eyebrow}>{t("CHOOSE YOUR BUSINESS MODEL")}</p>
        <h2 id="starter-models-title">{t("Three ways to make tea your business.")}</h2>
        <p className={styles.intro}>{t("The right format depends on your customers, your budget and how much you want to manage yourself.")}</p>
        <div className={styles.models}>
          {ordered.map(offer => {
            const d = details[offer.code];
            return <article key={offer.id} className={styles.model} data-selected={selected === offer.code}>
              <figure className={styles.modelMedia}>
                <Image src={`/images/business/${d.image}`} alt={d.alt} width={960} height={640} sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1100px) 30vw, 390px" />
                <figcaption>{locale === "hi" ? "पैकेजिंग का काल्पनिक उदाहरण" : "Illustrative packaging concept"}</figcaption>
              </figure>
              <h3>{offer.title}</h3><p>{offer.description}</p>
              <dl><div><dt>{t("Best suited to")}</dt><dd>{d.fit}</dd></div>
                <div><dt>{t("Your role")}</dt><dd>{d.work}</dd></div>
                <div><dt>{t("Where to sell")}</dt><dd>{d.channel}</dd></div></dl>
              {offer.moqText && <p className={styles.small}>{offer.moqText}</p>}
              <button type="button" className={styles.outlineButton} aria-pressed={selected === offer.code} onClick={() => {
                setSelected(offer.code);
                formSection.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
                document.getElementById("tf-interest")?.focus({ preventScroll: true });
              }}>{selected === offer.code && <Check size={16} aria-hidden="true" />}{offer.ctaLabel}<ArrowRight size={16} aria-hidden="true" /></button>
            </article>;
          })}
        </div>
        {!ordered.length && <p>{t("Supply options are being updated. Ask the trade desk about your requirements below.")}</p>}
      </div>
    </section>
    {children}
    <section id="business-quote" ref={formSection} className={styles.quote} aria-labelledby="starter-quote-title">
      <div className={`${styles.container} ${styles.quoteGrid}`}>
        <div><p className={styles.eyebrow}>{t("YOUR NEXT STEP")}</p><h2 id="starter-quote-title">{heading}</h2><p>{subhead}</p>
          <p className={styles.quoteNote}>{quoteNotice}</p>
          <ul className={styles.quoteChecklist}>{[
            t("Your chosen tea and pack format"),
            t("Quantity, MOQ and packaging commitments"),
            t("Itemised costs, applicable tax and freight"),
            t("Sampling terms and confirmed lead time"),
          ].map(item => <li key={item}><Check size={17} aria-hidden="true" />{item}</li>)}</ul>
        </div>
        <BusinessLeadForm segment="starter" locale={locale} selectedOffer={selected} initialNote={planNote} leadsEnabled={leadsEnabled} whatsappE164={whatsappE164} onFocusChange={setFocused} />
      </div>
    </section>
    {faq}
    <div className={styles.sticky} hidden={focused || atEnd} aria-label={t("Quick business actions")}>
      <a href="#planner" className={styles.goldButton}>{t("Build my plan")}</a>
      <a href="#business-quote" className={styles.outlineButton}>{t("Get a quote")}</a>
    </div>
  </>;
}
