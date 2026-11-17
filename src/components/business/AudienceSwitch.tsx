import Link from "next/link";
import { localizedHref } from "@/lib/i18n/locale";
import type { BusinessLocale, Segment } from "@/lib/business/schema";
import { serverTr } from "@/lib/business/starterTexts";

export function AudienceSwitch({
  segment,
  locale,
}: {
  segment: Segment;
  locale: BusinessLocale;
}) {
  const t = serverTr(locale);

  const destinations: Array<{ segment: Segment; label: string; sub: string; href: string }> = [
    {
      segment: "starter",
      label: t("I'm just starting"),
      sub: t("Supply, packs & brand guidance"),
      href: localizedHref("/start-tea-business", locale),
    },
    {
      segment: "trader",
      label: t("I already trade tea"),
      sub: t("Bulk lots, grades & trade pricing"),
      href: localizedHref("/tea-traders", locale),
    },
  ];

  return (
    <div className="tf-container tf-switch-wrap">
      <nav
        className="tf-switch"
        aria-label={t("Choose your tea business stage")}
      >
        {destinations.map((item) => (
          <Link
            key={item.segment}
            href={item.href}
            aria-current={item.segment === segment ? "page" : undefined}
          >
            <span>{item.label}</span>
            <small style={{ fontWeight: 500, opacity: 0.85, fontSize: "0.78rem", marginTop: 2 }}>
              {item.sub}
            </small>
          </Link>
        ))}
      </nav>
    </div>
  );
}
