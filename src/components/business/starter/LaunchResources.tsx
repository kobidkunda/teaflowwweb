import Link from "next/link";
import type { BusinessLocale } from "@/lib/business/schema";
import styles from "./starter.module.css";
import { serverTr } from "@/lib/business/starterTexts";

export function LaunchResources({ locale }: { locale: BusinessLocale }) {
  const t = serverTr(locale);
  const guides = [
    [t("Plan your first customers"), t("For packaged tea, shortlist local retailers, compare the margins they need and test a small assortment. For a tea shop, observe footfall and test your menu. For bulk trade, qualify buyers and agree credit terms. Record feedback and repeat orders before increasing inventory. These are planning prompts, not a promise of customers.")],
    [t("Check business & label responsibilities"), t("Confirm applicable food-business registration, tax, local permissions and packaged-label requirements with the relevant authority or a qualified adviser. For your own brand, agree who checks the label, owns the artwork and approves printing. TeaFloww supply does not automatically complete these tasks for you.")],
    [t("Confirm your true landed cost"), t("Request product, quantity, packaging, setup, applicable tax and freight as separate lines. Ask for destination-specific serviceability, lead time, payment terms and the damage or return process. Until confirmed, freight is pending. Retail shipping offers do not establish wholesale freight terms.")],
    [t("Prepare your own-brand project"), t("Explore the existing Private Label Studio for tea and packaging options. Confirm pack sizes, artwork scope, print minimums and setup charges in writing. A concept preview is not approved print artwork, a stock reservation or a final commercial quote.")],
  ];
  return <section id="launch-guides" className={styles.section}><div className={styles.container}><h2>{t("A clearer path to your first sale.")}</h2><p className={styles.intro}>{t("Open the guidance you need. Keep your next decision manageable.")}</p>{guides.map(([title, body]) => <details className={styles.processDetails} key={title}><summary>{title}</summary><p>{body}</p></details>)}<div className={styles.actions}><Link href="/private-label" className={styles.outlineButton}>{t("Explore Private Label Studio")}</Link><Link href="/tea-shops" className={styles.outlineButton}>{t("Explore the tea-shop journey")}</Link></div></div></section>;
}
