import Link from "next/link";
import { BusinessLanguageSwitch } from "./BusinessLanguageSwitch";
import type { BusinessLocale, Segment } from "@/lib/business/schema";
import { serverTr } from "@/lib/business/starterTexts";

export function BusinessHeader({
  segment,
  locale,
}: {
  segment: Segment;
  locale: BusinessLocale;
}) {
  const t = serverTr(locale);
  const basePath = segment === "starter" ? "/start-tea-business" : "/tea-traders";

  return (
    <header className="tf-header">
      <div className="tf-container tf-topbar">
        <div className="tf-brand-group">
          <Link href="/" className="tf-brand">
            TEAFLOWW
          </Link>
          <span className="tf-location-pill">
            {t("Siliguri, West Bengal")}
          </span>
        </div>

        <nav className="tf-nav" aria-label={t("Page sections")}>
          <a href="#solutions">{t("Our solutions")}</a>
          <a href="#process">{t("How it works")}</a>
          <a href="#proof">{t("Proof")}</a>
          <a href="#faq">{t("Questions")}</a>
        </nav>

        <div className="tf-header-actions">
          <BusinessLanguageSwitch path={basePath} locale={locale} className="tf-lang-switch" label={t("Select language")} />
          <a href="#business-quote" className="tf-button tf-button--gold" style={{ minHeight: 40, padding: "0.45rem 1rem", fontSize: "0.86rem" }}>
            {t("Get Quote")}
          </a>
        </div>
      </div>
    </header>
  );
}
