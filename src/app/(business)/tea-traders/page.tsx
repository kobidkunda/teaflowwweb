import type { Metadata } from "next";
import { TraderLanding } from "@/components/business/traders/TraderLanding";
import { getTraderPresentation } from "@/lib/business/traderRepository";
import { localize } from "@/lib/international/translations";
import { localeSchema } from "@/lib/international/models";
import { requestContext } from "@/lib/international/context";
import { permanentRedirect } from "next/navigation";
import { isSiteLocale, localizedHref } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ lang?: string }> };
async function pageLocale(searchParams: Props["searchParams"]) {
  const parsed = localeSchema.safeParse((await searchParams).lang);
  return parsed.success ? parsed.data : (await requestContext()).locale;
}
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const locale = await pageLocale(searchParams);
  const { copy } = localize(getTraderPresentation(), "tea-traders", locale);
  return { title: copy.seoTitle, description: copy.seoDescription, alternates: { canonical: "https://teafloww.com/tea-traders" } };
}
export default async function TeaTradersPage({ searchParams }: Props) {
  const lang = (await searchParams).lang;
  // Legacy `?lang=xx` links permanently move to the canonical path prefix.
  if (isSiteLocale(lang)) permanentRedirect(localizedHref("/tea-traders", lang));
  return <TraderLanding locale={await pageLocale(searchParams)} />;
}
