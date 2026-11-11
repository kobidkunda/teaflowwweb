import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import Image from "next/image";

const steps = [
  { image: "dry-leaf", title: "Dry leaf inspection", alt: "Illustration of dry black tea leaves in a wooden inspection tray", description: "We examine leaf appearance, style, cleanliness and uniformity to understand your tea’s character." },
  { image: "infusion", title: "Infusion", alt: "Illustration of hot water pouring over tea leaves in a white tasting cup", description: "We steep the tea under controlled conditions to observe colour, leaf opening and infusion character." },
  { image: "liquor-aroma", title: "Liquor & aroma", alt: "Illustration of amber tea liquor in a porcelain bowl with a tasting spoon", description: "We evaluate the liquor’s aroma, flavour, balance and aftertaste, using your intended cup as a reference." },
  { image: "milk-response", title: "Milk performance", alt: "Illustration comparing creamy milk tea with an amber black tea infusion", description: "Where relevant, we assess how the tea performs in milk — looking at strength, body, flavour and overall suitability." },
];

export function MethodologySection() {
  return (
    <section id="method" className="bl-process" aria-labelledby="methodology-heading">
      <div className="bl-wrap bl-section-heading"><div><p className="bl-eyebrow"><StorefrontText id="copy_5d1d433d98601998" fallback="THE PROCESS" /></p><h2 id="methodology-heading"><StorefrontText id="copy_12dcfe4ae598cb75" fallback="See your tea in a new light." /></h2></div><p><StorefrontText id="copy_fba52263ba8fa587" fallback="A hands-on, sensory-led journey from leaf to cup. We evaluate, discuss and recommend — so you can make confident decisions for your tea or blend." /></p></div>
      <ol className="bl-step-grid">
        {steps.map((step, index) => <li key={step.image}>
          <div className="bl-step-image"><Image src={`/images/blend-lab/${step.image}.webp`} alt={step.alt} fill sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 25vw" /><span aria-hidden="true">0{index + 1}</span></div>
          <div className="bl-step-copy"><h3>{step.title}</h3><p>{step.description}</p></div>
        </li>)}
      </ol>
      <p className="bl-image-note bl-wrap"><StorefrontText id="copy_2bfa7987cc6287cc" fallback="AI-generated illustrative imagery. Sensory evaluation is distinct from accredited chemical or food-safety testing." /></p>
    </section>
  );
}
