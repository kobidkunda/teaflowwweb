"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { calculateStarterNumbers, STARTER_EXAMPLE, type StarterNumbers } from "@/lib/business/starterCalculator";
import { trackBusinessEvent } from "@/lib/business/events";
import type { BusinessLocale } from "@/lib/business/schema";
import styles from "./starter.module.css";

const fields: [keyof StarterNumbers, string, string][] = [
  ["selling", "Selling price / pack (₹)", "बिक्री मूल्य / पैक (₹)"],
  ["tea", "Tea cost / pack (₹)", "चाय की लागत / पैक (₹)"],
  ["packaging", "Packaging / pack (₹)", "पैकेजिंग / पैक (₹)"],
  ["freight", "Inward freight / pack (₹)", "आने वाले माल का भाड़ा / पैक (₹)"],
  ["fees", "Selling & delivery / pack (₹)", "बिक्री और डिलीवरी / पैक (₹)"],
  ["packs", "Packs sold / month", "बिकने वाले पैक / महीना"],
  ["fixed", "Fixed expenses / month (₹)", "स्थायी खर्च / महीना (₹)"],
];
const draftExample = () => Object.fromEntries(Object.entries(STARTER_EXAMPLE).map(([k, v]) => [k, String(v)])) as Record<keyof StarterNumbers, string>;

export function StarterCalculator({ locale }: { locale: BusinessLocale }) {
  const hi = locale === "hi";
  const t = (en: string, hindi: string) => hi ? hindi : en;
  const [draft, setDraft] = useState(draftExample);
  const interacted = useRef(false);
  const invalid = fields.filter(([key]) => !/^\d+(?:\.\d{1,2})?$/.test(draft[key]) ||
    Number(draft[key]) > (key === "fixed" ? 1_000_000_000 : 1_000_000) || (key === "packs" && !Number.isInteger(Number(draft[key]))));
  const result = invalid.length ? null : calculateStarterNumbers(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)])) as StarterNumbers);
  const money = (paise: number) => new Intl.NumberFormat(hi ? "hi-IN" : "en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);

  return (
    <section id="margins" className={styles.calculator} aria-labelledby="starter-calculator-title">
      <div className={styles.container}>
        <p className={styles.eyebrow}>{t("PLAN YOUR NUMBERS", "अपनी कमाई का हिसाब समझें")}</p>
        <h2 id="starter-calculator-title">{t("Build a margin you understand.", "अपने मार्जिन को अच्छी तरह समझें।")}</h2>
        <p className={styles.calcIntro}>{t("One pack. Every cost. A clearer picture of your business.", "एक पैक, हर खर्च और आपके बिज़नेस की स्पष्ट तस्वीर।")}</p>
        <div className={styles.calcGrid}>
          <fieldset className={styles.inputs} aria-describedby="calculator-assumptions calculator-help">
            <legend className="sr-only">{t("Your planning assumptions", "आपके अनुमान")}</legend>
            {fields.map(([key, en, hindi]) => {
              const error = invalid.some(([k]) => k === key);
              return <div className={styles.inputRow} key={key}>
                <label htmlFor={`starter-${key}`}>{t(en, hindi)}</label>
                <input id={`starter-${key}`} type="text" inputMode={key === "packs" ? "numeric" : "decimal"} value={draft[key]} maxLength={14}
                  aria-invalid={error} aria-describedby={error ? `starter-${key}-error` : undefined}
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, [key]: event.target.value }));
                    if (!interacted.current) { interacted.current = true; trackBusinessEvent("business_calculator_use", { segment: "starter", locale }); }
                  }} />
                {error && <span id={`starter-${key}-error`} className={styles.inputError}>{t(key === "packs" ? "Enter a whole number from 0 to 10,00,000." : `Enter 0–${key === "fixed" ? "1,00,00,00,000" : "10,00,000"}, with up to 2 decimal places.`, key === "packs" ? "0 से 10,00,000 तक पूर्ण संख्या भरें।" : "सीमा के भीतर शून्य या धनात्मक राशि भरें (अधिकतम 2 दशमलव)।")}</span>}
              </div>;
            })}
            <button type="button" className={styles.reset} onClick={() => setDraft(draftExample())}><RotateCcw size={15} aria-hidden="true" />{t("Reset example", "उदाहरण रीसेट करें")}</button>
          </fieldset>
          <div className={styles.results} role="status" aria-live="polite" aria-atomic="true">
            <p className={styles.eyebrow}>{t("YOUR RESULTS · BASED ON YOUR INPUTS", "आपके आंकड़ों पर आधारित परिणाम")}</p>
            {result ? <>
              <dl>
                <div><dt>{t("Monthly revenue", "मासिक बिक्री")}</dt><dd>{money(result.revenue)}</dd></div>
                <div><dt>{t("Monthly variable costs", "मासिक परिवर्तनीय खर्च")}</dt><dd>{money(result.variableCosts)}</dd></div>
                <div className={styles.bigResult}><dt>{t("Contribution / pack", "प्रति पैक योगदान")}</dt><dd>{money(result.contribution)}</dd></div>
                <div><dt>{t("Contribution margin", "योगदान मार्जिन")}</dt><dd>{result.margin === null ? t("Not defined at ₹0 selling price", "₹0 बिक्री मूल्य पर लागू नहीं") : `${result.margin.toFixed(1)}%`}</dd></div>
                <div className={styles.bigResult}><dt>{t("Monthly operating surplus", "मासिक परिचालन अधिशेष")}</dt><dd>{money(result.surplus)}</dd></div>
                <div><dt>{t("Break-even / month", "मासिक ब्रेक-ईवन")}</dt><dd>{result.breakEven === null ? t("No break-even at these inputs", "इन आंकड़ों पर ब्रेक-ईवन संभव नहीं") : `${result.breakEven.toLocaleString("en-IN")} ${t("packs", "पैक")}`}</dd></div>
              </dl>
              {result.surplus < 0 && <p>{t("These inputs produce an operating loss. Review your costs, price and realistic sales volume.", "इन आंकड़ों पर परिचालन घाटा होता है। लागत, कीमत और वास्तविक बिक्री का आकलन करें।")}</p>}
            </> : <p>{t("Check the highlighted inputs to calculate your results.", "परिणाम देखने के लिए बताए गए आंकड़े ठीक करें।")}</p>}
          </div>
        </div>
        <p id="calculator-assumptions" className={styles.calcNotice}>{t("Illustrative example—not TeaFloww pricing or an earnings forecast.", "यह केवल उदाहरण है—TeaFloww की कीमत या कमाई का पूर्वानुमान नहीं।")}</p>
        <p id="calculator-help" className={styles.calcHelp}>{t("Use one consistent pack size and tax-exclusive amounts. Surplus is before tax, owner remuneration and any costs you have not entered. Include advertising, returns and channel fees in selling expenses. Sales volumes are your assumptions, not guaranteed demand. Your numbers stay in this browser and are not saved or sent.", "एक ही पैक आकार और टैक्स रहित राशि इस्तेमाल करें। अधिशेष में टैक्स, मालिक का मेहनताना और न भरे गए खर्च शामिल नहीं हैं। विज्ञापन, रिटर्न और बिक्री चैनल शुल्क को बिक्री खर्च में जोड़ें। बिक्री मात्रा आपका अनुमान है, मांग की गारंटी नहीं। आपके आंकड़े इसी ब्राउज़र में रहते हैं; सेव या भेजे नहीं जाते।")}</p>
      </div>
    </section>
  );
}
