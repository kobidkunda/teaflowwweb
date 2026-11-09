import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatInr, type ServicePlan } from "@/lib/blend-lab/plans-catalog";

const imagery: Record<string, string> = { MATCH_QUOTE: "dry-leaf", QUALITY_AUDIT: "infusion", SIGNATURE: "milk-response" };

export function TierComparisonTable({ plans }: { plans: readonly ServicePlan[] }) {
  return (
    <section id="plans" className="bl-plans bl-wrap" aria-labelledby="tier-table-caption">
      <div className="bl-section-heading"><div><p className="bl-eyebrow">OUR PLANS</p><h2 id="tier-table-caption">Choose the right plan for your needs.</h2></div><p>Simple, transparent plans for focused evaluation and practical guidance.</p></div>
      {plans.length === 0 ? <p>Services are currently unavailable. <Link href="/contact">Contact us about your tea.</Link></p> : <div className="bl-plan-grid">
        {plans.map(plan => <article key={plan.code} className={`bl-plan bl-plan-${plan.code.toLowerCase()}`}>
          <div className="bl-plan-intro"><div className="bl-plan-image"><Image src={`/images/blend-lab/${imagery[plan.code] || "dry-leaf"}.webp`} alt="Illustrative tea evaluation imagery" fill sizes="120px" /></div><div><h3>{plan.title}</h3><p className="bl-plan-price">{formatInr(plan.totalPaise)}</p><p className="bl-tax">Includes {plan.taxRateBps / 100}% GST</p><p className="bl-plan-description">{plan.description}</p></div></div>
          <h4>Key deliverables</h4><ul className="bl-plan-features">{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
          {plan.exclusions.length > 0 && <details className="bl-plan-exclusions"><summary>What’s not included</summary><ul>{plan.exclusions.map(item => <li key={item}>{item}</li>)}</ul></details>}
          <Link className="bl-button" href={`/blend-lab/start?plan=${plan.code}`} aria-label={`Choose ${plan.title}`}>Choose plan<ArrowRight size={15} aria-hidden="true" /></Link>
        </article>)}
      </div>}
      <p className="bl-plan-note">Sample quantity, pickup availability and service details are confirmed during intake. Wholesale production is quoted separately.</p>
    </section>
  );
}
