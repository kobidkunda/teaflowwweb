import Link from "next/link";
import { SITE_LOCALES, SITE_LOCALE_NAMES, localizedHref } from "@/lib/i18n/locale";

/** Language links for every site language; URLs are path-prefixed (`/pa/start-tea-business`). */
export function BusinessLanguageSwitch({ path, locale, className, label }: { path: string; locale: string; className?: string; label: string }) {
  return (
    <nav className={className} aria-label={label}>
      {SITE_LOCALES.map((code) => (
        <Link
          key={code}
          href={localizedHref(path, code)}
          lang={code}
          hrefLang={code}
          aria-current={locale === code ? "page" : undefined}
        >
          {code === "en" ? "EN" : SITE_LOCALE_NAMES[code]}
        </Link>
      ))}
    </nav>
  );
}
