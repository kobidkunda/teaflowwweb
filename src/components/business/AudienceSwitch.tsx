import Link from "next/link";
import type { BusinessLocale, Segment } from "@/lib/business/schema";

export function AudienceSwitch({
  segment,
  locale,
}: {
  segment: Segment;
  locale: BusinessLocale;
}) {
  const isHi = locale === "hi";
  const suffix = locale === "hi" ? "?lang=hi" : "";

  const destinations: Array<{ segment: Segment; label: string; sub: string; href: string }> = [
    {
      segment: "starter",
      label: isHi ? "मैं नया बिज़नेस शुरू कर रहा हूँ" : "I'm just starting",
      sub: isHi ? "पहला ऑर्डर, पैक और ब्रांडिंग गाइड" : "Supply, packs & brand guidance",
      href: `/start-tea-business${suffix}`,
    },
    {
      segment: "trader",
      label: isHi ? "मैं पहले से चाय का व्यापार करता हूँ" : "I already trade tea",
      sub: isHi ? "ग्रेड, थोक मात्रा और ट्रेड कोटेशन" : "Bulk lots, grades & trade pricing",
      href: `/tea-traders${suffix}`,
    },
  ];

  return (
    <div className="tf-container tf-switch-wrap">
      <nav
        className="tf-switch"
        aria-label={isHi ? "अपना चाय व्यापार चरण चुनें" : "Choose your tea business stage"}
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
