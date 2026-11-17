"use client";
import { tradeText } from "@/lib/trade/copy";

import React, { useEffect, useMemo, useState } from "react";
import type { AnyTradeLocale } from "@/lib/trade/contracts";
import {
  compareBatches,
  evaluateBatch,
  recommendPackCoverage,
  type BatchResult,
} from "@/lib/trade/calculator";
import type { TradeDictionary } from "@/lib/trade/i18n";
import { ActionButton, formatInrPaise, formatTradeNumber } from "./ui/Primitives";
import styles from "./trade.module.css";

function BatchFields({
  prefix,
  title,
  locale,
  dict,
  price,
  grams,
  glasses,
  onPriceChange,
  onGramsChange,
  onGlassesChange,
  result,
  highlight = false,
}: {
  prefix: string;
  title: string;
  locale: AnyTradeLocale;
  dict: TradeDictionary;
  price: string;
  grams: string;
  glasses: string;
  onPriceChange: (v: string) => void;
  onGramsChange: (v: string) => void;
  onGlassesChange: (v: string) => void;
  result: BatchResult;
  highlight?: boolean;
}) {
  const t = (key: string, vars: Record<string, string | number> = {}) => tradeText(dict, `calc.${key}`, vars);
  const resultLabel = result.valid
    ? `${formatInrPaise(result.costPerGlassPaise, locale)} ${dict["calc.perGlass"]}`
    : result.reason === "fractional_glasses"
    ? t("whole")
    : result.reason === "non_positive"
    ? t("positive")
    : `— ${dict["calc.perGlass"]}`;

  return (
    <div className={`${styles.panel} ${styles.calc} ${highlight ? styles.calcHighlight : ""}`}>
      <h3 className={styles.h3}>{title}</h3>
      <div className={styles.calcFields}>
        <div>
          <label className={styles.fieldLabel} htmlFor={`${prefix}-price`}>
            {dict["calc.pricePerKg"]}
          </label>
          <input
            id={`${prefix}-price`}
            className={styles.input}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="280"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
          />
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor={`${prefix}-grams`}>
            {dict["calc.teaGrams"]}
          </label>
          <input
            id={`${prefix}-grams`}
            className={styles.input}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="30"
            value={grams}
            onChange={(e) => onGramsChange(e.target.value)}
          />
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor={`${prefix}-glasses`}>
            {dict["calc.glasses"]}
          </label>
          <input
            id={`${prefix}-glasses`}
            className={styles.input}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="10"
            value={glasses}
            onChange={(e) => onGlassesChange(e.target.value)}
          />
        </div>
      </div>
      <div className={styles.result} aria-live="polite">
        {resultLabel}
      </div>
    </div>
  );
}

export function CupCalculator({
  locale,
  dict,
  availablePackGrams,
  confirmedPerKgRupees,
  selectedExWorksPerKgRupees,
  selectedProductName,
  onEnquireCoverage,
}: {
  locale: AnyTradeLocale;
  dict: TradeDictionary;
  availablePackGrams: number[];
  confirmedPerKgRupees?: number | null;
  selectedExWorksPerKgRupees?: number | null;
  selectedProductName?: string | null;
  onEnquireCoverage?: (requiredKg: number, comboLabel: string) => void;
}) {
  const t = (key: string, vars: Record<string, string | number> = {}) => tradeText(dict, `calc.${key}`, vars);
  const [priceA, setPriceA] = useState("");
  const [gramsA, setGramsA] = useState("");
  const [glassesA, setGlassesA] = useState("");

  const liveTeaFlowwPerKg =
    confirmedPerKgRupees && confirmedPerKgRupees > 0
      ? Math.round(confirmedPerKgRupees)
      : selectedExWorksPerKgRupees && selectedExWorksPerKgRupees > 0
      ? Math.round(selectedExWorksPerKgRupees)
      : 0;

  const [priceB, setPriceB] = useState(liveTeaFlowwPerKg > 0 ? String(liveTeaFlowwPerKg) : "");
  const [priceBEdited, setPriceBEdited] = useState(false);
  useEffect(() => {
    if (!priceBEdited && liveTeaFlowwPerKg > 0) {
      setPriceB(String(liveTeaFlowwPerKg));
    }
  }, [liveTeaFlowwPerKg, priceBEdited]);

  const [gramsB, setGramsB] = useState("");
  const [glassesB, setGlassesB] = useState("");

  // Pack coverage state (T24)
  const [cupsPerDay, setCupsPerDay] = useState("150");
  const [doseGrams, setDoseGrams] = useState("3");
  const [sellingDays, setSellingDays] = useState("30");

  const comparison = useMemo(() => {
    const parseNum = (s: string) => (s.trim() === "" ? NaN : Number(s));
    return compareBatches(
      {
        pricePerKgRupees: parseNum(priceA),
        teaUsedGrams: parseNum(gramsA),
        glassesMade: parseNum(glassesA),
      },
      {
        pricePerKgRupees: parseNum(priceB),
        teaUsedGrams: parseNum(gramsB),
        glassesMade: parseNum(glassesB),
      }
    );
  }, [priceA, gramsA, glassesA, priceB, gramsB, glassesB]);

  const packRec = useMemo(
    () =>
      recommendPackCoverage({
        cupsPerDay: Number(cupsPerDay) || 0,
        doseGrams: Number(doseGrams) || 0,
        sellingDays: Number(sellingDays) || 0,
        availablePackGrams:
          availablePackGrams.length > 0 ? availablePackGrams : [5000, 10000, 25000],
      }),
    [cupsPerDay, doseGrams, sellingDays, availablePackGrams]
  );

  const quickSnapshot = useMemo(() => {
    const effectivePrice = Number(priceB) > 0 ? Number(priceB) : liveTeaFlowwPerKg > 0 ? liveTeaFlowwPerKg : 280;
    const dose = Math.max(0.5, Number(doseGrams) || 3);
    const cups = Math.max(1, Number(cupsPerDay) || 150);
    const perGlass = evaluateBatch({
      pricePerKgRupees: effectivePrice,
      teaUsedGrams: dose,
      glassesMade: 1,
    });
    const perGlassPaise = perGlass.valid ? perGlass.costPerGlassPaise : 0;
    const costPerDayPaise = Math.round(perGlassPaise * cups);
    const isConfirmed = Boolean(confirmedPerKgRupees && confirmedPerKgRupees > 0);
    return {
      effectivePrice,
      dose,
      cups,
      perGlassPaise,
      costPerDayPaise,
      isConfirmed,
    };
  }, [priceB, liveTeaFlowwPerKg, doseGrams, cupsPerDay, confirmedPerKgRupees]);

  return (
    <section className={styles.section} id="cost" aria-labelledby="calcHeading">
      <div className={styles.wrap}>
        <div className={styles.titleRow}>
          <div>
            <div className={styles.kicker}>{dict["calc.kicker"]}</div>
            <h2 id="calcHeading" className={styles.h2}>
              {dict["calc.title"]}
            </h2>
          </div>
          <p className={styles.small}>{dict["calc.subtitle"]}</p>
        </div>

        {/* Instant Visual Stall Economics Strip */}
        <div className={styles.econBanner}>
          <div className={styles.econMeta}>
            <span className={styles.econEyebrow}>
              {quickSnapshot.isConfirmed
                ? t("delivered", {price: formatInrPaise(quickSnapshot.effectivePrice * 100, locale)})
                : selectedProductName && liveTeaFlowwPerKg > 0
                ? t("exworks", {name: selectedProductName, price: formatInrPaise(quickSnapshot.effectivePrice * 100, locale)})
                : t("example", {price:formatInrPaise(quickSnapshot.effectivePrice*100,locale)})}
            </span>
            <p className={styles.small} style={{ marginTop: 4 }}>
              {t("basis", {dose:formatTradeNumber(quickSnapshot.dose,locale),cups:formatTradeNumber(quickSnapshot.cups,locale)})}
            </p>
          </div>
          <div className={styles.econMetrics}>
            <div className={styles.econStat}>
              <span>{t("per")}</span>
              <strong>{formatInrPaise(quickSnapshot.perGlassPaise, locale)}</strong>
            </div>
            <div className={styles.econStat}>
              <span>{t("month", {days:sellingDays || "30"})}</span>
              <strong>{formatTradeNumber(packRec.requiredKg, locale)} kg</strong>
            </div>
            <div className={styles.econStat}>
              <span>{t("daily")}</span>
              <strong>{formatInrPaise(quickSnapshot.costPerDayPaise, locale)}</strong>
            </div>
          </div>
        </div>

        {/* Two-batch side-by-side measured comparison */}
        <div className={styles.pair}>
          <BatchFields
            prefix="batch-a"
            title={dict["calc.yourTea"]}
            locale={locale}
            dict={dict}
            price={priceA}
            grams={gramsA}
            glasses={glassesA}
            onPriceChange={setPriceA}
            onGramsChange={setGramsA}
            onGlassesChange={setGlassesA}
            result={comparison.batchA}
          />
          <BatchFields
            prefix="batch-b"
            title={dict["calc.teafloww"]}
            locale={locale}
            dict={dict}
            price={priceB}
            grams={gramsB}
            glasses={glassesB}
            onPriceChange={(v) => {
              setPriceBEdited(true);
              setPriceB(v);
            }}
            onGramsChange={setGramsB}
            onGlassesChange={setGlassesB}
            result={comparison.batchB}
            highlight
          />
        </div>

        {comparison.direction !== null && comparison.differencePaise !== null ? (
          <div className={styles.inlineStatus} role="status" aria-live="polite">
            {comparison.direction === "parity"
              ? t("parity")
              : comparison.direction === "b_cheaper"
              ? t("saves", {amount:formatInrPaise(comparison.differencePaise,locale)})
              : t("more", {amount:formatInrPaise(comparison.differencePaise,locale)})}
          </div>
        ) : null}

        {/* Monthly Demand & Full-Period Pack Combination Planner */}
        <div className={styles.panel} style={{ marginTop: 22 }}>
          <div className={styles.coverageHeader}>
            <div>
              <h3 className={styles.h3} style={{ fontSize: 22 }}>
                {t("demand")}
              </h3>
              <p className={styles.small} style={{ marginTop: 4 }}>
                {t("demandBody")}
              </p>
            </div>
            {onEnquireCoverage && packRec.fullCoverageSuggestion ? (
              <ActionButton
                intent="soft"
                onClick={() =>
                  onEnquireCoverage(
                    packRec.requiredKg,
                    packRec.fullCoverageSuggestion!.summaryLabel
                  )
                }
              >
                {t("enquire", {packs:packRec.fullCoverageSuggestion.summaryLabel})}
              </ActionButton>
            ) : null}
          </div>

          <div className={styles.calcFields} style={{ marginTop: 14 }}>
            <div>
              <label className={styles.fieldLabel} htmlFor="cov-cups">
                {t("cups")}
              </label>
              <input
                id="cov-cups"
                className={styles.input}
                type="number"
                min="1"
                inputMode="numeric"
                value={cupsPerDay}
                onChange={(e) => setCupsPerDay(e.target.value)}
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="cov-dose">
                {t("dose")}
              </label>
              <input
                id="cov-dose"
                className={styles.input}
                type="number"
                min="1"
                step="0.5"
                inputMode="decimal"
                value={doseGrams}
                onChange={(e) => setDoseGrams(e.target.value)}
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="cov-days">
                {t("days")}
              </label>
              <input
                id="cov-days"
                className={styles.input}
                type="number"
                min="1"
                inputMode="numeric"
                value={sellingDays}
                onChange={(e) => setSellingDays(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.coverageSummary} aria-live="polite">
            <p className={styles.small} style={{ marginTop: 0 }}>
              <b>{t("need",{kg:formatTradeNumber(packRec.requiredKg,locale)})}</b>
              {packRec.closestPacks.length > 0
                ? ` · ${t("closest",{kg:packRec.closestPacks[0].labelKg,days:packRec.closestPacks[0].coversDays})}`
                : ""}
            </p>
            {packRec.fullCoverageSuggestion &&
            packRec.closestPacks[0] &&
            packRec.closestPacks[0].grams < packRec.requiredGrams ? (
              <p className={styles.small} style={{ marginTop: 4, color: "var(--ink)" }}>
                {t("coverage",{days:sellingDays || "30"})}:
                <b>
                  {packRec.fullCoverageSuggestion.summaryLabel} (
                  {t("total",{kg:formatTradeNumber(packRec.fullCoverageSuggestion.totalKg,locale),days:packRec.fullCoverageSuggestion.coversDays})})
                </b>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
