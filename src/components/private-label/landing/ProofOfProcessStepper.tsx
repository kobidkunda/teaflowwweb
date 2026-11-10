import React from "react";
import styles from "../styles/PrivateLabel.module.css";
import { SectionHeading } from "../shared/StudioPrimitives";

const PROCESS_STEPS = [
  {
    step: "01",
    title: "Sourcing & Selection",
    desc: "Choose from available teas and packaging. Confirm sourcing and material documentation with our team.",
  },
  {
    step: "02",
    title: "Packaging & Design",
    desc: "Preview your brand and discuss label requirements for your product and target market.",
  },
  {
    step: "03",
    title: "Preflight & Proof Sign-Off",
    desc: "Review artwork requirements with our team and approve the production proof before manufacturing.",
  },
  {
    step: "04",
    title: "Production & Delivery",
    desc: "Confirm the production specification, payment milestones and dispatch schedule for your order.",
  },
];

export function ProofOfProcessStepper() {
  return (
    <section
      data-testid="trust-strip"
      className={`${styles.stepperSection} process-strip`}
      aria-label="How it Works: Sourcing, Packaging & Production Process"
    >
      <div className={styles.contentContainer}>
        <SectionHeading
          title="From Sourcing to Shelf: The 4-Stage Atelier Process"
          subtitle="A transparent, data-driven manufacturing flow engineered for high precision and zero surprises."
          align="center"
        />

        <div className={styles.stepperGrid}>
          {PROCESS_STEPS.map((s) => (
            <div key={s.step} className={styles.stepCard}>
              <div className={styles.stepNumber}>{s.step}</div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
