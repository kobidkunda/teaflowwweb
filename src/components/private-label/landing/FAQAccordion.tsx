import React from "react";
import styles from "../styles/PrivateLabel.module.css";
import { SectionHeading } from "../shared/StudioPrimitives";

export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQ_DATA: FAQItem[] = [
  { question: "What is the minimum order quantity?", answer: "Minimums depend on the tea batch, packaging, print method and order multiple. The studio shows the requirements for your selection; our team confirms the final production terms." },
  { question: "Can I request tea and packaging samples?", answer: "Use the consultation form to discuss available tea samples, packaging swatches and pricing before placing a production order." },
  { question: "How do I check food safety and labeling requirements?", answer: "Ask our team for documentation applicable to your chosen tea, packaging and target market. Certifications and label compliance must be verified for your project before production." },
  { question: "What artwork can I use in the studio?", answer: "The studio accepts PNG, JPEG and WebP previews up to 512 KB. A preview is not a print-ready proof. Our team will confirm production file formats, resolution, color and labeling requirements separately." },
  { question: "When will my order be ready?", answer: "Production and dispatch timing depends on materials, quantity, artwork approval and payment confirmation. Our team will confirm the schedule for your order." },
  { question: "Can I discuss a custom blend?", answer: "Include your desired flavor, ingredients and target price in your consultation request. Our team will review feasibility and recommend the next step." },
];

export function FAQAccordion() {
  return (
    <section className={styles.faqSection} aria-label="Frequently Asked Questions">
      <div className={styles.contentContainer} style={{ maxWidth: "860px" }}>
        <SectionHeading
          title="Frequently Asked Questions"
          subtitle="Clear, truthful answers regarding manufacturing minimums, food compliance, and delivery timelines."
          align="center"
        />

        <div>
          {FAQ_DATA.map((item, index) => (
            <details
              key={index}
              name="pl-faq"
              className={styles.faqDetails}
            >
              <summary className={styles.faqSummary}>
                <span>{item.question}</span>
                <span aria-hidden="true" style={{ fontSize: "1.25rem", color: "#143C31", marginLeft: "12px" }}>
                  +
                </span>
              </summary>
              <div className={styles.faqContent}>
                <p style={{ margin: 0 }}>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
