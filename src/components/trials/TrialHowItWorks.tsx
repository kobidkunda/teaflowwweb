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
        <h2 id="trials-guide-title">How to choose{" "}<br />the <em>right kit?</em></h2>
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
        <h2>Good questions, answered.</h2>
        <details><summary>What is inside a trial kit?<ChevronDown size={16} aria-hidden="true" /></summary>
          <p>Each kit contains four individually packed 50g teas, for 200g in total. Every listing shows the names and weights so you can compare before choosing.</p>
        </details>
        <details><summary>How should I brew the teas?<ChevronDown size={16} aria-hidden="true" /></summary>
          <p>Open a kit to see its brewing guide. When comparing teas, keep your water, milk, sugar and measured tea dose consistent.</p>
        </details>
        <details><summary>Where can I check delivery?<ChevronDown size={16} aria-hidden="true" /></summary>
          <p>Check the delivery PIN code on the kit page. Availability and charges are confirmed for your address at checkout.</p>
        </details>
        <details><summary>Can I explore full-size teas too?<ChevronDown size={16} aria-hidden="true" /></summary>
          <p>Yes. Browse the <Link href="/shop">tea shop</Link> for current full-size packs and availability, or <Link href="/contact">ask us for help</Link> choosing.</p>
        </details>
      </div>
    </section>
  );
}
