"use client";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { useState } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
const questions = [
  { title: "How do you take your tea?", choices: ["Without milk", "With milk", "Either"] },
  { title: "Which notes speak to you?", choices: ["Floral & delicate", "Bold & malty", "Fresh & green"] },
  { title: "What moment is it for?", choices: ["Slow afternoons", "Bright mornings", "A mindful pause"] }
];
export function TeaFinder() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const done = step >= questions.length;
  const match = answers[1] === "Bold & malty"
    ? { slug: "assam-golden-breakfast", name: "Assam Golden Breakfast", reason: "A full-bodied, malty choice that also works with milk." }
    : answers[1] === "Fresh & green"
    ? { slug: "nilgiri-mist-green", name: "Nilgiri Mist Green", reason: "A fresh, lighter cup with gentle vegetal notes." }
    : { slug: "darjeeling-spring", name: "Darjeeling Spring Clonal", reason: "A fragrant, light-bodied cup with floral and fruit notes." };
  return <div className="finder-box">
    {done ? <>
      <p className="eyebrow"> <StorefrontText id="copy_69a5ed5700206c21" fallback="Your suggested match" /> </p><h2>{match.name}</h2>
      <p>{match.reason}</p><p className="micro-note"> <StorefrontText id="copy_a56e89e17972d1fa" fallback="Rule-based illustrative recommendation, not a scientific match percentage." /> </p>
      <div className="button-row"><Link className="button button-primary" href={"/tea/" + match.slug}> <StorefrontText id="copy_c6fafafd40a90b93" fallback="Discover your tea" /> </Link><button className="button button-outline" onClick={() => { setStep(0); setAnswers([]); }}> <StorefrontText id="copy_962e64b761961fe0" fallback="Start again" /> </button></div>
    </> : <>
      <p className="eyebrow"> <StorefrontText id="copy_0beefe703cde8836" fallback="Tea Finder · Question" /> {step + 1} of {questions.length}</p>
      <div className="finder-progress"><div style={{ width: (step / questions.length) * 100 + "%" }}/></div>
      <h2>{questions[step].title}</h2>
      <div className="finder-options">{questions[step].choices.map((choice) => <button key={choice} onClick={() => {
        setAnswers((a) => [...a.slice(0, step), choice]);
        setStep((s) => s + 1);
      }}>{choice}<span>→</span></button>)}</div>
      {step > 0 && <button className="back-link" onClick={() => setStep((s) => s - 1)}> <StorefrontText id="copy_38d87e5bf039e36c" fallback="← Previous question" /> </button>}
    </>}
  </div>;
}
