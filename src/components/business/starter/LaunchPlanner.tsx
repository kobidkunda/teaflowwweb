"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Download } from "lucide-react";
import type { BusinessLocale, OfferCode } from "@/lib/business/schema";
import styles from "./starter.module.css";
import { useTr } from "../BusinessI18n";

export function LaunchPlanner({ locale, onPlan }: { locale: BusinessLocale; onPlan: (offer: OfferCode | undefined, summary: string) => void }) {
  const t = useTr();
  const questions = [
    { title: t("What will you sell?"), options: [t("Prepared chai"), t("Packaged tea"), t("My own tea brand"), t("Bulk tea")] },
    { title: t("Where will you sell?"), options: [t("Local shops"), t("My tea stall or café"), t("Online & direct"), t("Trade & institutions")] },
    { title: t("What is your starting budget?"), options: [t("Still exploring"), t("Under ₹25,000"), "₹25,000–₹1,00,000", t("Above ₹1,00,000")] },
    { title: t("Who is your first customer?"), options: [t("Daily chai drinkers"), t("Families"), t("Retailers"), t("Offices & cafés")] },
    { title: t("When would you like to begin?"), options: [t("I’m researching"), t("I’m preparing"), t("Ready to discuss supply")] },
  ];
  const [answers, setAnswers] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const complete = step === questions.length;
  const offer: OfferCode | undefined = answers[0] === 1 ? "ready_retail" : answers[0] === 2 ? "private_label" : answers[0] === 3 ? "bulk_supply" : undefined;
  const recommendation = [t("Explore the tea-shop journey"), t("Compare finished retail packs"), t("Explore private-label supply"), t("Discuss a bulk specification")][answers[0] ?? 0];
  const summary = questions.map((question, index) => answers[index] === undefined ? "" : `${question.title} ${question.options[answers[index]]}`).filter(Boolean).join("\n");
  function move(next: number) { setStep(next); requestAnimationFrame(() => heading.current?.focus()); }
  function download() {
    const blob = new Blob([`${t("My Tea Business Plan")}\n\n${summary}\n\n${recommendation}\n${t("Next: test samples, confirm landed costs, check applicable registrations and test customer demand. Budget is a preference, not a supplier quote or confirmation of feasibility.")}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "teafloww-business-plan.txt"; anchor.click(); URL.revokeObjectURL(url);
  }
  return <section id="planner" className={`${styles.section} ${styles.planner}`} aria-labelledby="planner-title">
    <div className={styles.container}>
      <div className={styles.sectionTop}><div><h2 id="planner-title">{t("A business that starts with you.")}</h2><p>{t("Five decisions. No sign-up. A practical place to begin.")}</p></div><a href="#business-quote">{t("Already buying? Go straight to a quote")}<ArrowRight size={17} aria-hidden="true" /></a></div>
      <div className={styles.plannerGrid}>
        <div className={styles.question}>
          <p className={styles.progressText} role="status">{t("Your plan")} · {Math.min(step + 1, 5)} / 5</p>
          <progress max={5} value={answers.length} aria-label={t("Decisions completed")} />
          <h3 ref={heading} tabIndex={-1}>{complete ? t("Your first decisions, made.") : questions[step].title}</h3>
          {complete ? <><p>{recommendation}</p><p>{t("This is a starting direction based on what you want to sell. Compare costs and test demand before committing your budget.")}</p><div className={styles.actions}><button type="button" className={styles.goldButton} onClick={() => { onPlan(offer, summary); document.getElementById("business-quote")?.scrollIntoView(); document.getElementById("tf-note")?.focus({ preventScroll: true }); }}>{t("Use my plan in an enquiry")}<ArrowRight size={16} aria-hidden="true" /></button><button type="button" className={styles.outlineButton} onClick={download}><Download size={16} aria-hidden="true" />{t("Download plan")}</button></div><Link className={styles.plannerDestination} href={answers[0] === 0 ? "/tea-shops" : answers[0] === 2 ? "/private-label" : "/tea-traders"}>{recommendation}<ArrowRight size={16} aria-hidden="true" /></Link></> : <fieldset className={styles.choices}><legend className="sr-only">{questions[step].title}</legend>{questions[step].options.map((option, index) => <label key={option} data-selected={answers[step] === index}><input type="radio" name={`decision-${step}`} checked={answers[step] === index} onChange={() => setAnswers(previous => { const next = [...previous]; next[step] = index; return next; })} />{option}{answers[step] === index && <Check size={17} aria-hidden="true" />}</label>)}</fieldset>}
          <div className={styles.plannerControls}><button type="button" className={styles.reset} disabled={step === 0} onClick={() => move(step - 1)}>{t("Back")}</button>{!complete && <button type="button" className={styles.goldButton} disabled={answers[step] === undefined} onClick={() => move(step + 1)}>{step === 4 ? t("See my plan") : t("Continue")}<ArrowRight size={16} aria-hidden="true" /></button>}</div>
        </div>
        <aside className={styles.planPreview} aria-label={t("Your business plan preview")}><h3>{t("From an idea\nto your first sale.")}</h3><dl>{questions.map((question, index) => <div key={question.title}><dt>{question.title}</dt><dd>{answers[index] === undefined ? t("Your decision to make") : question.options[answers[index]]}</dd></div>)}</dl><p className={styles.small}>{t("Your decisions stay here until you choose to include them in an enquiry. Refreshing resets this planner.")}</p><span className={styles.planWordmark}>TEAFLOWW / {t("BUSINESS PLAN")}</span></aside>
      </div>
    </div>
  </section>;
}
