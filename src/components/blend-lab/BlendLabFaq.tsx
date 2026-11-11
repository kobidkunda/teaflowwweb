import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import type { BlendLabFaqItem } from "@/lib/blend-lab/content";

export function BlendLabFaq({ initialFaqs = [] }: { initialFaqs?: BlendLabFaqItem[] } = {}) {
  if (!initialFaqs.length) return null;
  return <section className="bl-faq bl-wrap" aria-labelledby="faq-title"><div><p className="bl-eyebrow"><StorefrontText id="copy_5ed23858ae92b1b9" fallback="A LITTLE MORE CLARITY" /></p><h2 id="faq-title"><StorefrontText id="copy_c1a8a29d32b6cc42" fallback="Before you send" /><br /><StorefrontText id="copy_6a5c758696beea46" fallback="your sample." /></h2></div><div>{initialFaqs.map((faq, index) => <details key={`${index}-${faq.question}`}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>;
}
