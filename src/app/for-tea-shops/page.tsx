import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ForTeaShopsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) {
      v.forEach((item) => qs.append(k, item));
    } else if (typeof v === "string") {
      qs.set(k, v);
    }
  }
  const query = qs.toString();
  redirect(`/tea-shops${query ? `?${query}` : ""}`);
}
