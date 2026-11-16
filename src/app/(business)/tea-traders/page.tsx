import type { Metadata } from "next";
import { BusinessLanding } from "@/components/business/BusinessLanding";
import { getB2BPageContent } from "@/lib/business/repository";
import type { BusinessLocale } from "@/lib/business/schema";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const locale: BusinessLocale = sp.lang === "hi" ? "hi" : "en";
  const content = getB2BPageContent("trader", locale);

  return {
    title: content?.seo_title ?? "Wholesale Tea Supply & Private Label | TeaFloww",
    description:
      content?.seo_description ??
      "Request trade pricing for 25kg bulk tea, retail pouches and private-label packaging. Discuss volume and delivery with TeaFloww Siliguri.",
    alternates: {
      canonical: "https://teafloww.com/tea-traders",
    },
  };
}

export default async function TeaTradersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const locale: BusinessLocale = sp.lang === "hi" ? "hi" : "en";
  return <BusinessLanding segment="trader" locale={locale} />;
}
