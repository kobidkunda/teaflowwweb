import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatInr, type ServicePlan } from "@/lib/blend-lab/plans-catalog";

const imagery: Record<string, string> = { MATCH_QUOTE: "dry-leaf", QUALITY_AUDIT: "infusion", SIGNATURE: "milk-response" };

export function TierComparisonTable({ plans }: { plans: readonly ServicePlan[] }) {
  return (
    <section id="plans" className="bl-plans bl-wrap" aria-labelledby="tier-table-caption">
      <div className="bl-section-heading"><div><p className="bl-eyebrow"><StorefrontText id="copy_c2b8e53083b40678" fallback="OUR PLANS" /></p><h2 id="tier-table-caption"><StorefrontText id="copy_50f0280840d0ae2e" fallback="Choose the right plan for your needs." /></h2></div><p><StorefrontText id="copy_64e9add3d971247a" fallback="Simple, transparent plans for focused evaluation and practical guidance." /></p></div>
      {plans.length === 0 ? <p><StorefrontText id="copy_28333f7e8c6e1152" fallback="Services are currently unavailable." /> <Link href="/contact"><StorefrontText id="copy_49b8f809f1e481a8" fallback="Contact us about your tea." /></Link></p> : <div className="bl-plan-grid">
        {plans.map(plan => <article key={plan.code} className={`bl-plan bl-plan-${plan.code.toLowerCase()}`}>
          <div className="bl-plan-intro"><div className="bl-plan-image"><Image src={`/images/blend-lab/${imagery[plan.code] || "dry-leaf"}.webp`} alt="Illustrative tea evaluation imagery" fill sizes="120px" /></div><div><h3>{plan.title}</h3><p className="bl-plan-price">{formatInr(plan.totalPaise)}</p><p className="bl-tax"><StorefrontText id="copy_df498282bede20a9" fallback="Includes" /> {plan.taxRateBps / 100}<StorefrontText id="copy_f18789e4c98ec534" fallback="% GST" /></p><p className="bl-plan-description">{plan.description}</p></div></div>
          <h4><StorefrontText id="copy_d666dba2a2aacfaf" fallback="Key deliverables" /></h4><ul className="bl-plan-features">{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
          {plan.exclusions.length > 0 && <details className="bl-plan-exclusions"><summary><StorefrontText id="copy_12646a04d6e5b9cd" fallback="What’s not included" /></summary><ul>{plan.exclusions.map(item => <li key={item}>{item}</li>)}</ul></details>}
          <Link className="bl-button" href={`/blend-lab/start?plan=${plan.code}`} aria-label={`Choose ${plan.title}`}><StorefrontText id="copy_ec3574a14d175458" fallback="Choose plan" /><ArrowRight size={15} aria-hidden="true" /></Link>
        </article>)}
      </div>}
      <p className="bl-plan-note"><StorefrontText id="copy_f8beff4d96ff25ea" fallback="Sample quantity, pickup availability and service details are confirmed during intake. Wholesale production is quoted separately." /></p>
    </section>
  );
}
