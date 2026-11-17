"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, Check } from "lucide-react";
import type { TraderCopy } from "@/lib/business/traderPresentation";
import { useTraderJourney, type TraderModel } from "./TraderJourney";
import styles from "./traders.module.css";

export function TraderPlanner({ copy }: { copy: TraderCopy }) {
  const journey = useTraderJourney()!;
  const models: { id: TraderModel; title: string; body: string; risk: string; href: string; action: string }[] = [
    { id: "new", title: copy.toolsNew, body: copy.toolsNewBody, risk: copy.toolsRetailRisk, href: "#trader-plan", action: copy.toolsExplore },
    { id: "retail", title: copy.toolsRetail, body: copy.toolsRetailBody, risk: copy.toolsRetailRisk, href: "#trade-packs", action: copy.retailLink },
    { id: "distributor", title: copy.toolsDistributor, body: copy.toolsDistributorBody, risk: copy.toolsBulkRisk, href: "#business-quote", action: copy.quote },
    { id: "brand", title: copy.toolsBrand, body: copy.toolsBrandBody, risk: copy.toolsBrandRisk, href: "/private-label", action: copy.brandLink },
  ];
  const active = models.find(model => model.id === journey.model)!;
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState({ budget: copy.toolsBudgetUnknown, customers: copy.toolsCustomerShops, region: "", pin: "", experience: copy.toolsFirstTime, existing: copy.toolsNo, timeline: copy.toolsResearch, volume: "" });
  const heading = useRef<HTMLHeadingElement>(null);
  const summary = `${active.title}\n${copy.toolsBudget}: ${plan.budget}\n${copy.toolsCustomers}: ${plan.customers}\n${copy.toolsState}: ${plan.region || "—"} ${plan.pin}\n${copy.toolsExperience}: ${plan.experience}\n${copy.toolsExisting}: ${plan.existing}\n${copy.toolsTimeline}: ${plan.timeline}${plan.volume ? `\n${copy.toolsVolume}: ${plan.volume}` : ""}`;
  function move(next: number) { setStep(next); requestAnimationFrame(() => heading.current?.focus()); }
  function update(key: keyof typeof plan, value: string) { setPlan(previous => ({ ...previous, [key]: value })); }
  const fields = step === 0 ? [{ key: "budget", label: copy.toolsBudget, options: [copy.toolsBudgetUnknown, copy.toolsBudgetSmall, copy.toolsBudgetMedium, copy.toolsBudgetLarge, copy.toolsBudgetGrowth] }, { key: "customers", label: copy.toolsCustomers, options: [copy.toolsCustomerShops, copy.toolsCustomerDirect, copy.toolsCustomerBusiness] }] : step === 2 ? [{ key: "experience", label: copy.toolsExperience, options: [copy.toolsFirstTime, copy.toolsExperienced] }, { key: "existing", label: copy.toolsExisting, options: [copy.toolsNo, copy.toolsYes] }, { key: "timeline", label: copy.toolsTimeline, options: [copy.toolsResearch, copy.toolsPreparing, copy.toolsReady] }] : [];
  function download() {
    const url = URL.createObjectURL(new Blob([`${copy.toolsPlanSummary}\n\n${summary}\n\n${active.body}\n${active.risk}\n\n${copy.toolsStageOneBody}\n${copy.toolsStageTwoBody}\n${copy.toolsStageThreeBody}\n${copy.toolsStageFourBody}\n\n${copy.toolsPlanNotice}`], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "teafloww-trading-plan.txt"; anchor.click(); URL.revokeObjectURL(url);
  }
  const invalidPin = Boolean(plan.pin) && !/^[1-9]\d{5}$/.test(plan.pin);
  const invalidVolume = Boolean(plan.volume) && (!/^\d+$/.test(plan.volume) || Number(plan.volume) > 100000);
  return <>
    <section id="solutions" className={styles.section} aria-labelledby="trader-audience-title"><h2 id="trader-audience-title">{copy.toolsAudienceTitle}</h2><div className={styles.modelSelector} role="group" aria-label={copy.toolsModel}>{models.map(model => <button key={model.id} type="button" aria-pressed={journey.model === model.id} onClick={() => journey.choose(model.id)}>{model.title}{journey.model === model.id && <Check size={18} aria-hidden="true" />}</button>)}</div><div className={styles.modelDetail}><div><h3>{active.title}</h3><p>{active.body}</p><a className={styles.textLink} href={active.href}>{active.action}<ArrowRight size={16} aria-hidden="true" /></a></div><div><strong>{copy.toolsTradeoff}</strong><p>{active.risk}</p><Link href="/tea-shops" className={styles.textLink}>{copy.toolsTeaShop}<ArrowRight size={16} aria-hidden="true" /></Link></div></div></section>
    <section id="trader-plan" className={`${styles.section} ${styles.planSection}`} aria-labelledby="trader-plan-title"><div className={styles.planLayout}><div><h2 id="trader-plan-title">{copy.toolsPlannerTitle}</h2><p className={styles.sectionIntro}>{copy.toolsPlannerIntro}</p><progress value={step} max={3} aria-label={copy.toolsPlanSummary} /><h3 ref={heading} tabIndex={-1} className={styles.stepHeading}>{step === 0 ? copy.toolsBudget : step === 1 ? copy.toolsStepDelivery : step === 2 ? copy.toolsExperience : copy.toolsPlanReady}</h3>
      {step < 3 ? <div className={styles.planFields}>{fields.map(field => <label key={field.key}>{field.label}<select value={plan[field.key as keyof typeof plan]} onChange={event => update(field.key as keyof typeof plan, event.target.value)}>{field.options.map(option => <option key={option}>{option}</option>)}</select></label>)}{step === 1 && <><label>{copy.toolsState}<input maxLength={60} value={plan.region} autoComplete="address-level1" onChange={event => update("region", event.target.value)} /></label><label>{copy.pin}<input maxLength={6} inputMode="numeric" value={plan.pin} onChange={event => update("pin", event.target.value)} aria-invalid={invalidPin} aria-describedby="plan-pin-help" /></label><p className={styles.fine} id="plan-pin-help">{copy.toolsLocationNotice}{invalidPin && ` ${copy.invalid}`}</p></>}{step === 2 && <label>{copy.toolsVolume}<input inputMode="numeric" maxLength={6} value={plan.volume} onChange={event => update("volume", event.target.value)} aria-invalid={invalidVolume} aria-describedby={invalidVolume ? "plan-volume-error" : undefined} />{invalidVolume && <span id="plan-volume-error">{copy.toolsInvalid}</span>}</label>}</div> : <><p>{active.body}</p><p>{active.risk}</p><div className={styles.toolActions}><button type="button" className={styles.primary} onClick={() => journey.requestQuote({ interest: journey.model === "brand" ? "private_label" : journey.model === "distributor" ? "bulk_supply" : "ready_retail", pincode: plan.pin, note: summary.slice(0, 500) })}>{copy.toolsUsePlan}<ArrowRight size={17} aria-hidden="true" /></button><button type="button" className={styles.outline} onClick={download}><Download size={16} aria-hidden="true" />{copy.toolsDownload}</button></div></>}
      <div className={styles.planControls}><button type="button" className={styles.backButton} disabled={step === 0} onClick={() => move(step - 1)}>{copy.toolsBack}</button>{step < 3 && <button type="button" className={styles.primary} disabled={(step === 1 && invalidPin) || (step === 2 && invalidVolume)} onClick={() => move(step + 1)}>{copy.toolsContinue}<ArrowRight size={16} aria-hidden="true" /></button>}</div></div><aside className={styles.planPaper} aria-label={copy.toolsPlanSummary}><h3>{copy.toolsPlanSummary}</h3><dl>{[[copy.toolsModel, active.title], [copy.toolsBudget, plan.budget], [copy.toolsCustomers, plan.customers], [copy.toolsTimeline, plan.timeline]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={styles.fine}>{copy.toolsPlanNotice}</p></aside></div></section>
  </>;
}
