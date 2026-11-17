import type { Metadata } from "next";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { BusinessLanding } from "@/components/business/BusinessLanding";
import { getB2BPageContent } from "@/lib/business/repository";
import { serverTr } from "@/lib/business/starterTexts";
import { SITE_LOCALES, isSiteLocale, localizedHref, resolveLocale } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

const PATH = "/start-tea-business";
const ORIGIN = "https://teafloww.com";

type Props = {
  searchParams: Promise<{ lang?: string }>;
};

/** Language comes from the path prefix (`/pa/start-tea-business`); English has none. */
async function pageLocale() {
  return resolveLocale((await headers()).get("x-teafloww-locale"));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await pageLocale();
  const t = serverTr(locale);
  const content = getB2BPageContent("starter", "en");
  const languages: Record<string, string> = { "x-default": `${ORIGIN}${PATH}` };
  for (const code of SITE_LOCALES) languages[code] = `${ORIGIN}${localizedHref(PATH, code)}`;

  return {
    title: t(content?.seo_title ?? "Start a Tea Business | TeaFloww Siliguri"),
    description: t(
      content?.seo_description ??
        "Explore tea supply, 25kg bulk options, retail packs and branding support for your new tea business. Request a quote from TeaFloww Siliguri.",
    ),
    alternates: { canonical: `${ORIGIN}${localizedHref(PATH, locale)}`, languages },
  };
}

export default async function StartTeaBusinessPage({ searchParams }: Props) {
  const { lang } = await searchParams;
  // Legacy `?lang=hi` links permanently move to the canonical path prefix.
  if (isSiteLocale(lang)) permanentRedirect(localizedHref(PATH, lang));
  return <BusinessLanding segment="starter" locale={await pageLocale()} />;
}
