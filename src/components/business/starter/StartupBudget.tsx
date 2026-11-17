"use client";

import { useState } from "react";
import type { BusinessLocale } from "@/lib/business/schema";
import { calculateLaunchCapital } from "@/lib/business/launchCapital";
import styles from "./starter.module.css";
import { intlLocale } from "@/lib/i18n/locale";
import { useTr } from "../BusinessI18n";

export function StartupBudget({ locale }: { locale: BusinessLocale }) {
  const t = useTr();
  const labels = [t("Opening tea inventory"), t("Packaging & artwork"), t("Equipment & setup"), t("Rent & deposits"), t("Launch marketing"), t("Freight & applicable tax"), t("Working-capital reserve")];
  const [amounts, setAmounts] = useState<string[]>(labels.map(() => ""));
  const total = calculateLaunchCapital(amounts);
  const money = (value: number) => new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value / 100);
  const validAmounts = amounts.filter(amount => calculateLaunchCapital([amount]) !== null).length;
  const hasErrors = amounts.some(amount => amount !== "" && calculateLaunchCapital([amount]) === null);

  return (
    <section id="startup-budget" className={styles.section} aria-labelledby="budget-title">
      <div className={`${styles.container} ${styles.budgetGrid}`}>
        <div className={styles.budgetIntro}>
          <h2 id="budget-title">{t("Budget for the whole beginning.")}</h2>
          <p>{t("Tea is one line in your startup budget. Add your own estimates to see the bigger picture.")}</p>
        </div>
        <fieldset className={styles.budgetInputs} aria-describedby="budget-input-help">
          <legend>{t("Your estimates")}</legend>
          <p id="budget-input-help" className={styles.budgetHelp}>{t("Enter amounts in rupees. Use 0 only for a cost you have confirmed does not apply.")}</p>
          {labels.map((label, index) => {
            const invalid = amounts[index] !== "" && calculateLaunchCapital([amounts[index]]) === null;
            return (
              <div key={label} className={styles.budgetRow}>
                <label htmlFor={`capital-${index}`}>{label}</label>
                <div className={styles.budgetAmount}>
                  <span aria-hidden="true">₹</span>
                  <input id={`capital-${index}`} type="text" inputMode="decimal" maxLength={12}
                    placeholder={t("Enter amount")} value={amounts[index]}
                    aria-invalid={invalid} aria-describedby={invalid ? `capital-error-${index}` : "budget-range-help"}
                    onChange={event => setAmounts(previous => previous.map((amount, position) => position === index ? event.target.value : amount))} />
                </div>
                {invalid && <p id={`capital-error-${index}`} className={styles.budgetError}>{t("Enter 0–10,00,00,000, with up to two decimal places.")}</p>}
              </div>
            );
          })}
          <p id="budget-range-help" className={styles.budgetHelp}>{t("Maximum ₹10,00,00,000 per category. Up to two decimal places.")}</p>
        </fieldset>
        <div className={styles.budgetSummary}>
          <div className={styles.budgetTotal} role="status" aria-atomic="true">
            <span>{t("Your planned starting capital")}</span>
            <strong data-pending={total === null}>{total === null ? t("Total pending") : money(total)}</strong>
            <p className={styles.budgetCompletion}>{t("{done} of {total} categories completed").replace("{done}", String(validAmounts)).replace("{total}", String(labels.length))}</p>
            <p>{total === null
              ? hasErrors
                ? t("Correct the highlighted amounts to calculate your total.")
                : t("Complete every category to see your total. Unknown costs stay pending.")
              : t("Total of your estimates. Not a quotation or confirmation that this budget is sufficient.")}</p>
          </div>
          <p className={styles.budgetPrivacy}>{t("Unknown freight and tax stay pending. Include each cost once. These inputs reset on refresh and are not sent with your enquiry.")}</p>
        </div>
      </div>
    </section>
  );
}
