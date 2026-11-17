"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { calculateStarterNumbers, STARTER_EXAMPLE, type StarterNumbers } from "@/lib/business/starterCalculator";
import { trackBusinessEvent } from "@/lib/business/events";
import type { BusinessLocale } from "@/lib/business/schema";
import styles from "./starter.module.css";
import { intlLocale } from "@/lib/i18n/locale";
import { useTr } from "../BusinessI18n";

const fields: [keyof StarterNumbers, string][] = [
  ["selling", "Selling price / pack (₹)"],
  ["tea", "Tea cost / pack (₹)"],
  ["packaging", "Packaging / pack (₹)"],
  ["freight", "Inward freight / pack (₹)"],
  ["fees", "Selling & delivery / pack (₹)"],
  ["packs", "Packs sold / month"],
  ["fixed", "Fixed expenses / month (₹)"],
];
const draftExample = () => Object.fromEntries(Object.entries(STARTER_EXAMPLE).map(([k, v]) => [k, String(v)])) as Record<keyof StarterNumbers, string>;

export function StarterCalculator({ locale }: { locale: BusinessLocale }) {
  const t = useTr();
  const [draft, setDraft] = useState(draftExample);
  const [mode, setMode] = useState<"packs" | "cups">("packs");
  const interacted = useRef(false);
  const invalid = fields.filter(([key]) => !/^\d+(?:\.\d{1,2})?$/.test(draft[key]) ||
    Number(draft[key]) > (key === "fixed" ? 1_000_000_000 : 1_000_000) || (key === "packs" && !Number.isInteger(Number(draft[key]))));
  const result = invalid.length ? null : calculateStarterNumbers(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)])) as StarterNumbers);
  const money = (paise: number) => new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);

  return (
    <section id="margins" className={styles.calculator} aria-labelledby="starter-calculator-title">
      <div className={styles.container}>
        <p className={styles.eyebrow}>{t("PLAN YOUR NUMBERS")}</p>
        <h2 id="starter-calculator-title">{t("Build a margin you understand.")}</h2>
        <p className={styles.calcIntro}>{t("Every sale. Every cost. A clearer picture of your business.")}</p>
        <div className={styles.calcModes} role="group" aria-label={t("Business calculator type")}>
          <button type="button" aria-pressed={mode === "packs"} onClick={() => { setMode("packs"); setDraft(draftExample()); }}>{t("Packaged tea")}</button>
          <button type="button" aria-pressed={mode === "cups"} onClick={() => { setMode("cups"); setDraft({ selling: "", tea: "", packaging: "", freight: "", fees: "", packs: "", fixed: "" }); }}>{t("Prepared chai")}</button>
        </div>
        <div className={styles.calcGrid}>
          <fieldset className={styles.inputs} aria-describedby="calculator-assumptions calculator-help">
            <legend className="sr-only">{t("Your planning assumptions")}</legend>
            {fields.map(([key, en]) => {
              const error = invalid.some(([k]) => k === key);
              return <div className={styles.inputRow} key={key}>
                <label htmlFor={`starter-${key}`}>{mode === "packs" ? t(en) : ({ selling: t("Selling price / cup (₹)"), tea: t("Tea & spices / cup (₹)"), packaging: t("Milk, water & sugar / cup (₹)"), freight: t("Cup & fuel / cup (₹)"), fees: t("Wastage & other costs / cup (₹)"), packs: t("Cups sold / month"), fixed: t("Rent, staff & fixed / month (₹)") })[key]}</label>
                <input id={`starter-${key}`} type="text" inputMode={key === "packs" ? "numeric" : "decimal"} value={draft[key]} maxLength={14}
                  aria-invalid={error} aria-describedby={error ? `starter-${key}-error` : undefined}
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, [key]: event.target.value }));
                    if (!interacted.current) { interacted.current = true; trackBusinessEvent("business_calculator_use", { segment: "starter", locale }); }
                  }} />
                {error && <span id={`starter-${key}-error`} className={styles.inputError}>{t(key === "packs" ? "Enter a whole number from 0 to 10,00,000." : key === "fixed" ? "Enter 0–1,00,00,00,000, with up to 2 decimal places." : "Enter 0–10,00,000, with up to 2 decimal places.")}</span>}
              </div>;
            })}
            <button type="button" className={styles.reset} onClick={() => { setMode("packs"); setDraft(draftExample()); }}><RotateCcw size={15} aria-hidden="true" />{t("Reset example")}</button>
          </fieldset>
          <div className={styles.results} role="status" aria-live="polite" aria-atomic="true">
            <p className={styles.eyebrow}>{t("YOUR RESULTS · BASED ON YOUR INPUTS")}</p>
            {result ? <>
              <dl>
                <div><dt>{t("Monthly revenue")}</dt><dd>{money(result.revenue)}</dd></div>
                <div><dt>{t("Monthly variable costs")}</dt><dd>{money(result.variableCosts)}</dd></div>
                <div className={styles.bigResult}><dt>{mode === "packs" ? t("Contribution / pack") : t("Contribution / cup")}</dt><dd>{money(result.contribution)}</dd></div>
                <div><dt>{t("Contribution margin")}</dt><dd>{result.margin === null ? t("Not defined at ₹0 selling price") : `${result.margin.toFixed(1)}%`}</dd></div>
                <div className={styles.bigResult}><dt>{t("Monthly operating surplus")}</dt><dd>{money(result.surplus)}</dd></div>
                <div><dt>{t("Break-even / month")}</dt><dd>{result.breakEven === null ? t("No break-even at these inputs") : `${result.breakEven.toLocaleString("en-IN")} ${mode === "packs" ? t("packs") : t("cups")}`}</dd></div>
              </dl>
              {result.surplus < 0 && <p>{t("These inputs produce an operating loss. Review your costs, price and realistic sales volume.")}</p>}
            </> : <p>{t("Check the highlighted inputs to calculate your results.")}</p>}
          </div>
        </div>
        <p id="calculator-assumptions" className={styles.calcNotice}>{t("Illustrative example—not TeaFloww pricing or an earnings forecast.")}</p>
        {mode === "cups" && <p className={styles.calcHelp}>{t("For chai, use costs per cup and monthly sales. Include all rent, staff and other fixed costs in the monthly amount. The inputs below are your assumptions; no supplier prices are prefilled.")}</p>}
        <p id="calculator-help" className={styles.calcHelp}>{t("Use one consistent pack size and tax-exclusive amounts. Surplus is before tax, owner remuneration and any costs you have not entered. Include advertising, returns and channel fees in selling expenses. Sales volumes are your assumptions, not guaranteed demand. Your numbers stay in this browser and are not saved or sent.")}</p>
      </div>
    </section>
  );
}
