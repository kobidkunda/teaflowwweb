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
  const content = getB2BPageContent("starter", locale);

  return {
    title: content?.seo_title ?? "Start a Tea Business | TeaFloww Siliguri",
    description:
      content?.seo_description ??
      "Explore tea supply, 25kg bulk options, retail packs and branding support for your new tea business. Request a quote from TeaFloww Siliguri.",
    alternates: {
      canonical: "https://teafloww.com/start-tea-business",
    },
  };
}

export default async function StartTeaBusinessPage({ searchParams }: Props) {
  const sp = await searchParams;
  const locale: BusinessLocale = sp.lang === "hi" ? "hi" : "en";
  return <BusinessLanding segment="starter" locale={locale} />;
}
