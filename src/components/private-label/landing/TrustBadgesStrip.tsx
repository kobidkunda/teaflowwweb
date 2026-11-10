import React from "react";
import styles from "../styles/PrivateLabel.module.css";
import { ShieldCheck, Award, Factory, PackageCheck } from "lucide-react";

const BADGES = [
  { icon: ShieldCheck, title: "Review Your Requirements", desc: "Confirm product details, packaging specifications and required documentation with our team." },
  { icon: Factory, title: "Plan Your Production", desc: "Review quantity, materials and production readiness before committing to a run." },
  { icon: Award, title: "Approve Your Proof", desc: "Review the production proof before approval. Studio previews are illustrative." },
  { icon: PackageCheck, title: "Discuss Sample Options", desc: "Ask about available tea samples and packaging swatches for your project." },
];

export function TrustBadgesStrip() {
  return (
    <section className={styles.trustBadgesSection} aria-label="Quality Standards & Trust Badges">
      <div className={styles.contentContainer}>
        <div className={styles.trustBadgesGrid}>
          {BADGES.map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} className={styles.trustBadgeItem}>
                <div className={styles.trustBadgeIcon} aria-hidden="true">
                  <Icon size={24} />
                </div>
                <div>
                  <h3 className={styles.trustBadgeTitle}>{b.title}</h3>
                  <p className={styles.trustBadgeDesc}>{b.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
