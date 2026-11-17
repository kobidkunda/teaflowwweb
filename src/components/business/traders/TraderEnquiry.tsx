"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { businessLeadSchema } from "@/lib/business/schema";
import { collectAttribution } from "@/lib/business/attribution";
import { trackBusinessEvent } from "@/lib/business/events";
import type { TraderCopy } from "@/lib/business/traderPresentation";
import styles from "./traders.module.css";
import { useTraderJourney } from "./TraderJourney";

export function TraderEnquiry({copy:c,locale,enabled,whatsapp}:{copy:TraderCopy;locale:string;enabled:boolean;whatsapp:string|null}) {
  const [status,setStatus] = useState<"idle"|"sending"|"success"|"error">("idle");
  const [error,setError] = useState("");
  const [reference,setReference] = useState("");
  const [errors,setErrors] = useState<string[]>([]);
  const request = useRef<{body:string;key:string}|null>(null);
  const summary = useRef<HTMLDivElement>(null);
  const journey = useTraderJourney();
  const [step,setStep] = useState(0);
  const [interest,setInterest] = useState("unsure");
  const [note,setNote] = useState("");
  const [pincode,setPincode] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const stageTitle = useRef<HTMLHeadingElement>(null);
  const stages = [c.toolsStepRequirement,c.toolsStepProducts,c.toolsStepDelivery,c.toolsStepContact];
  useEffect(()=>{
    if(!journey?.draft) return;
    setInterest(journey.draft.interest);setNote(journey.draft.note);setPincode(journey.draft.pincode || "");setStep(0);setError("");setErrors([]);
  },[journey?.draft]);
  function move(next:number) {setStep(next);requestAnimationFrame(()=>stageTitle.current?.focus());}
  function next() {
    if(step===2 && !/^[1-9]\d{5}$/.test(pincode)) {setErrors(["pincode"]);setError(c.invalid);requestAnimationFrame(()=>summary.current?.focus());return;}
    setErrors([]);setError("");move(step+1);
  }
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(status === "sending") return;
    if(step<3) {next();return;}
    const f = new FormData(event.currentTarget);
    const parsed = businessLeadSchema.safeParse({segment:"trader",interest:f.get("interest"),quantityBand:f.get("quantityBand"),pincode:f.get("pincode"),name:f.get("name"),phone:f.get("phone"),note:f.get("note"),contactConsent:f.get("consent") === "on",marketingConsent:false,locale,attribution:collectAttribution(window.location.search),honeypot:f.get("website") || ""});
    if(!parsed.success) {setErrors(parsed.error.issues.map(i=>String(i.path[0])));setError(c.invalid);setStatus("error"); requestAnimationFrame(()=>summary.current?.focus());return;}
    setErrors([]);setError("");setStatus("sending");
    const body = JSON.stringify(parsed.data);
    if(request.current?.body !== body) request.current = {body,key:crypto.randomUUID()};
    try {
      const response = await fetch("/api/business-leads",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":request.current!.key},body});
      const result = await response.json();
      if(!response.ok || !result.reference) throw new Error(c.failed);
      setReference(result.reference);setStatus("success");trackBusinessEvent("business_quote_submit",{segment:"trader",locale,interest:parsed.data.interest});
    } catch {setStatus("error");setError(c.failed);requestAnimationFrame(()=>summary.current?.focus());}
  }
  if(!enabled) return <p role="status">{c.disabled}</p>;
  if(status === "success") return <div className={styles.success} role="status"><h3>{c.success}</h3><strong>{reference}</strong><p>{c.successBody}</p>{whatsapp && <a className={styles.outline} href={`${whatsapp.split("?")[0]}?text=${encodeURIComponent(`Hello TeaFloww, enquiry reference ${reference}`)}`} target="_blank" rel="noopener noreferrer">{c.whatsapp}</a>}</div>;
  return <form ref={formRef} onSubmit={submit} className={styles.form} noValidate>
    <ol className={styles.enquiryStages} aria-label={c.formTitle}>{stages.map((label,index)=><li key={label} aria-current={index===step?"step":undefined}>{index+1}. {label}</li>)}</ol>
    <h3 ref={stageTitle} tabIndex={-1} className={styles.enquiryStageTitle}>{stages[step]}</h3>
    {error && <div ref={summary} role="alert" tabIndex={-1} className={styles.error}>{error}</div>}
    <fieldset hidden={step!==0} className={styles.enquiryFields}><legend className="sr-only">{c.toolsStepRequirement}</legend>
    <label>{c.interest}<select name="interest" value={interest} onChange={event=>setInterest(event.target.value)}><option value="unsure">{c.interestUnsure}</option><option value="bulk_supply">{c.interestBulk}</option><option value="ready_retail">{c.interestRetail}</option><option value="private_label">{c.interestBrand}</option></select></label>
    <label>{c.quantity}<select name="quantityBand" defaultValue="unsure"><option value="unsure">{c.unsure}</option><option value="25-49">25–49 kg</option><option value="50-99">50–99 kg</option><option value="100-249">100–249 kg</option><option value="250-plus">250+ kg</option></select></label>
    </fieldset>
    <fieldset hidden={step!==1} className={styles.enquiryFields}><legend className="sr-only">{c.toolsStepProducts}</legend><label className={styles.fullField}>{c.toolsQuoteProduct}<textarea name="note" maxLength={500} rows={5} value={note} onChange={event=>setNote(event.target.value)} placeholder={c.toolsQuoteProductHint}/></label><p className={styles.formFine}>{c.note} · {note.length}/500</p></fieldset>
    <fieldset hidden={step!==2} className={styles.enquiryFields}><legend className="sr-only">{c.toolsStepDelivery}</legend>
    <label>{c.pin} *<input name="pincode" value={pincode} onChange={event=>setPincode(event.target.value)} inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{6}" maxLength={6} required aria-invalid={errors.includes("pincode")} aria-describedby="trade-pin-notice" /></label><p id="trade-pin-notice" className={styles.fine}>{c.toolsLocationNotice}</p></fieldset>
    <fieldset hidden={step!==3} className={styles.enquiryFields}><legend className="sr-only">{c.toolsStepContact}</legend>
    <label>{c.name} *<input name="name" autoComplete="name" minLength={2} maxLength={90} required aria-invalid={errors.includes("name")} /></label>
    <label>{c.phone} *<input name="phone" type="tel" autoComplete="tel-national" maxLength={18} required aria-invalid={errors.includes("phone")} /></label>
    <div className={styles.enquiryReview}><strong>{c.toolsReview}</strong><p>{interest==="bulk_supply"?c.interestBulk:interest==="private_label"?c.interestBrand:interest==="ready_retail"?c.interestRetail:c.interestUnsure} · {pincode}</p>{note && <p className={styles.reviewNote}>{note}</p>}</div>
    <label className={styles.consent}><input name="consent" type="checkbox" required aria-invalid={errors.includes("contactConsent")} /><span>{c.consent} *</span></label>
    </fieldset>
    <div className={styles.trap} aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <div className={styles.formActions}>{step>0 && <button type="button" className={styles.backButton} disabled={status==="sending"} onClick={()=>{setError("");setErrors([]);move(step-1);}}>{c.toolsBack}</button>}<button className={styles.primary} disabled={status === "sending"}>{step<3?c.toolsContinue:status === "sending" ? c.submitting : c.submit}</button>{whatsapp && <a href={`${whatsapp.split("?")[0]}?text=${encodeURIComponent(`${c.formTitle}\n${interest}\n${pincode}\n${note}`)}`} target="_blank" rel="noopener noreferrer">{c.whatsapp}</a>}</div>
    <p className={styles.formFine}>{c.enquiryNotice} <Link href="/privacy">{c.privacy}</Link></p>
  </form>;
}
