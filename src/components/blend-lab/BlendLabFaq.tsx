import React from "react";
import type { BlendLabFaqItem } from "@/lib/blend-lab/content";

export function BlendLabFaq({ initialFaqs = [] }: { initialFaqs?: BlendLabFaqItem[] } = {}) {
  if (!initialFaqs.length) return null;
  return <section className="bl-faq bl-wrap" aria-labelledby="faq-title"><div><p className="bl-eyebrow">A LITTLE MORE CLARITY</p><h2 id="faq-title">Before you send<br /> your sample.</h2></div><div>{initialFaqs.map((faq, index) => <details key={`${index}-${faq.question}`}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>;
}
