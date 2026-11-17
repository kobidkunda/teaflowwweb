import Link from "next/link";
import type { BusinessLocale } from "@/lib/business/schema";
import { serverTr } from "@/lib/business/starterTexts";

export function BusinessFooter({
  locale,
  supportHours,
  siliguriClaim,
}: {
  locale: BusinessLocale;
  supportHours: string;
  siliguriClaim: string;
}) {
  const t = serverTr(locale);

  return (
    <footer className="tf-footer">
      <div className="tf-container tf-footer-grid">
        <div>
          <strong style={{ color: "#fffbf3", fontSize: "1.05rem" }}>TeaFloww (Nirva)</strong>
          <p style={{ margin: "0.35rem 0 0" }}>{siliguriClaim}</p>
          <p style={{ margin: "0.25rem 0 0", opacity: 0.85 }}>
            Shiv Shakti Kali Bari Rd, Sukantapally, East Siliguri 734005 · {supportHours}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.2rem", alignItems: "center" }}>
          <Link href="/wholesale">{t("Wholesale")}</Link>
          <Link href="/private-label">{t("Private Label")}</Link>
          <Link href="/blend-lab">{t("Blend Lab")}</Link>
          <Link href="/shop">{t("Shop")}</Link>
          <Link href="/privacy">{t("Privacy")}</Link>
          <Link href="/terms">{t("Terms")}</Link>
        </div>
      </div>
    </footer>
  );
}
