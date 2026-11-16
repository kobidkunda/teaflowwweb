"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { AnyTradeLocale } from "@/lib/trade/contracts";
import {
  compareBatches,
  recommendPackCoverage,
  type BatchResult,
} from "@/lib/trade/calculator";
import type { TradeDictionary } from "@/lib/trade/i18n";
import { formatInrPaise, formatTradeNumber } from "./ui/Primitives";
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
}) {
  const resultLabel = result.valid
    ? `${formatInrPaise(result.costPerGlassPaise, locale)} ${dict["calc.perGlass"]}`
    : result.reason === "fractional_glasses"
    ? "Enter whole glasses (e.g. 10)"
    : result.reason === "non_positive"
    ? "Enter values greater than zero"
    : `— ${dict["calc.perGlass"]}`;

  return (
    <div className={`${styles.panel} ${styles.calc}`}>
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
}: {
  locale: AnyTradeLocale;
  dict: TradeDictionary;
  availablePackGrams: number[];
  confirmedPerKgRupees?: number | null;
}) {
  const [priceA, setPriceA] = useState("");
  const [gramsA, setGramsA] = useState("");
  const [glassesA, setGlassesA] = useState("");

  const [priceB, setPriceB] = useState(
    confirmedPerKgRupees ? String(Math.round(confirmedPerKgRupees)) : ""
  );
  const [priceBEdited, setPriceBEdited] = useState(false);
  useEffect(() => {
    if (!priceBEdited && confirmedPerKgRupees && confirmedPerKgRupees > 0) {
      setPriceB(String(Math.round(confirmedPerKgRupees)));
    }
  }, [confirmedPerKgRupees, priceBEdited]);
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

  return (
    <section className={styles.section} id="cost" aria-labelledby="calcHeading">
      <div className={styles.titleRow}>
        <div>
          <div className={styles.kicker}>{dict["calc.kicker"]}</div>
          <h2 id="calcHeading" className={styles.h2}>
            {dict["calc.title"]}
          </h2>
        </div>
        <p className={styles.small}>{dict["calc.subtitle"]}</p>
      </div>

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
        />
      </div>

      {comparison.direction !== null && comparison.differencePaise !== null ? (
        <div className={styles.inlineStatus} role="status" aria-live="polite">
          {comparison.direction === "parity"
            ? "Both batches cost the same per glass in tea leaves."
            : comparison.direction === "b_cheaper"
            ? `TeaFloww saves ${formatInrPaise(comparison.differencePaise, locale)} per glass in tea leaves.`
            : `TeaFloww costs ${formatInrPaise(comparison.differencePaise, locale)} more per glass in tea leaves.`}
        </div>
      ) : null}

      <div className={styles.panel} style={{ marginTop: 22 }}>
        <h3 className={styles.h3} style={{ fontSize: 22 }}>
          How much tea do you need?
        </h3>
        <div className={styles.calcFields} style={{ marginTop: 12 }}>
          <div>
            <label className={styles.fieldLabel} htmlFor="cov-cups">
              Cups / day
            </label>
            <input
              id="cov-cups"
              className={styles.input}
              type="number"
              min="1"
              value={cupsPerDay}
              onChange={(e) => setCupsPerDay(e.target.value)}
            />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="cov-dose">
              Dose per cup (g)
            </label>
            <input
              id="cov-dose"
              className={styles.input}
              type="number"
              min="1"
              step="0.5"
              value={doseGrams}
              onChange={(e) => setDoseGrams(e.target.value)}
            />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="cov-days">
              Selling days
            </label>
            <input
              id="cov-days"
              className={styles.input}
              type="number"
              min="1"
              value={sellingDays}
              onChange={(e) => setSellingDays(e.target.value)}
            />
          </div>
        </div>
        <p className={styles.small} aria-live="polite">
          Estimated need: <b>{formatTradeNumber(packRec.requiredKg, locale)} kg</b>
          {packRec.closestPacks.length > 0
            ? ` · Closest pack: ${packRec.closestPacks[0].labelKg} kg (covers ~${packRec.closestPacks[0].coversDays} days)`
            : ""}
        </p>
      </div>
    </section>
  );
}
