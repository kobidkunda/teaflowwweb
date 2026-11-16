import Link from "next/link";
import type { BusinessLocale, Segment } from "@/lib/business/schema";

export function BusinessHeader({
  segment,
  locale,
}: {
  segment: Segment;
  locale: BusinessLocale;
}) {
  const basePath = segment === "starter" ? "/start-tea-business" : "/tea-traders";
  const isHi = locale === "hi";

  return (
    <header className="tf-header">
      <div className="tf-container tf-topbar">
        <div className="tf-brand-group">
          <Link href="/" className="tf-brand">
            TEAFLOWW
          </Link>
          <span className="tf-location-pill">
            {isHi ? "सिलीगुड़ी, पश्चिम बंगाल" : "Siliguri, West Bengal"}
          </span>
        </div>

        <nav className="tf-nav" aria-label={isHi ? "पेज अनुभाग" : "Page sections"}>
          <a href="#solutions">{isHi ? "सप्लाई विकल्प" : "Our solutions"}</a>
          <a href="#process">{isHi ? "प्रक्रिया" : "How it works"}</a>
          <a href="#proof">{isHi ? "प्रमाण" : "Proof"}</a>
          <a href="#faq">{isHi ? "सवाल-जवाब" : "Questions"}</a>
        </nav>

        <div className="tf-header-actions">
          <nav className="tf-lang-switch" aria-label={isHi ? "भाषा चुनें" : "Select language"}>
            <Link
              href={basePath}
              lang="en"
              hrefLang="en"
              aria-current={locale === "en" ? "true" : undefined}
            >
              EN
            </Link>
            <Link
              href={`${basePath}?lang=hi`}
              lang="hi"
              hrefLang="hi"
              aria-current={locale === "hi" ? "true" : undefined}
            >
              हिन्दी
            </Link>
          </nav>
          <a href="#business-quote" className="tf-button tf-button--gold" style={{ minHeight: 40, padding: "0.45rem 1rem", fontSize: "0.86rem" }}>
            {isHi ? "कोटेशन लें" : "Get Quote"}
          </a>
        </div>
      </div>
    </header>
  );
}
