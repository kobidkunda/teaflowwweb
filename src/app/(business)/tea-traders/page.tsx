import type { Metadata } from "next";
import { TraderLanding } from "@/components/business/traders/TraderLanding";
import { getTraderPresentation } from "@/lib/business/traderRepository";
import { localize } from "@/lib/international/translations";
import { localeSchema } from "@/lib/international/models";
import { requestContext } from "@/lib/international/context";

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
  return <TraderLanding locale={await pageLocale(searchParams)} />;
}
