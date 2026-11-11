import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import styles from "./TrialsCollection.module.css";

const steps = [
  { title: "Explore", description: "Browse the kits and see every tea inside." },
  { title: "Compare", description: "Choose the combination that catches your curiosity." },
  { title: "Brew", description: "Try the teas in your own kettle. Find your favourite." },
];

export function TrialHowItWorks() {
  return (
    <section id="how-it-works" className={styles.guidance} aria-labelledby="trials-guide-title">
      <div className={styles.steps}>
        <h2 id="trials-guide-title"><StorefrontText id="copy_7429aafc0285db21" fallback="How to choose" />{" "}<br /><StorefrontText id="copy_b9776d7ddf459c9a" fallback="the" /> <em><StorefrontText id="copy_ac2c149de31ecf3c" fallback="right kit?" /></em></h2>
        <ol>
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <h3>{step.title}</h3><p>{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.faq}>
        <h2><StorefrontText id="copy_bb6b45f8ef07f41e" fallback="Good questions, answered." /></h2>
        <details><summary><StorefrontText id="copy_2019f40b0d24b3dc" fallback="What is inside a trial kit?" /><ChevronDown size={16} aria-hidden="true" /></summary>
          <p><StorefrontText id="copy_d3ce7fbde6585908" fallback="Each kit contains four individually packed 50g teas, for 200g in total. Every listing shows the names and weights so you can compare before choosing." /></p>
        </details>
        <details><summary><StorefrontText id="copy_667e8d89b5641357" fallback="How should I brew the teas?" /><ChevronDown size={16} aria-hidden="true" /></summary>
          <p><StorefrontText id="copy_b8ea71dff8780f59" fallback="Open a kit to see its brewing guide. When comparing teas, keep your water, milk, sugar and measured tea dose consistent." /></p>
        </details>
        <details><summary><StorefrontText id="copy_60c907ff371e1ac4" fallback="Where can I check delivery?" /><ChevronDown size={16} aria-hidden="true" /></summary>
          <p><StorefrontText id="copy_cb25cff99d14e611" fallback="Check the delivery PIN code on the kit page. Availability and charges are confirmed for your address at checkout." /></p>
        </details>
        <details><summary><StorefrontText id="copy_23e426671065bfc0" fallback="Can I explore full-size teas too?" /><ChevronDown size={16} aria-hidden="true" /></summary>
          <p><StorefrontText id="copy_4a90b66f04ad45fb" fallback="Yes. Browse the" /> <Link href="/shop"><StorefrontText id="copy_ee53d28ee8ae3c7f" fallback="tea shop" /></Link><StorefrontText id="copy_6f2d663c11bfc392" fallback="for current full-size packs and availability, or" /> <Link href="/contact"><StorefrontText id="copy_d7d165ef527d8489" fallback="ask us for help" /></Link><StorefrontText id="copy_c4ffa8df9f2eff48" fallback="choosing." /></p>
        </details>
      </div>
    </section>
  );
}
