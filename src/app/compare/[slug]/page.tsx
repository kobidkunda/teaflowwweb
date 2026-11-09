import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { notFound } from "next/navigation";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo/metadata";
import { getArticleSchema, getBreadcrumbSchema } from "@/lib/seo/schema";
import { COMPARISONS_DATA } from "@/lib/comparisons";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cmp = COMPARISONS_DATA.find((c) => c.slug === slug);

  if (!cmp) {
    return constructMetadata({
      title: "Comparison Not Found",
      description: "The requested tea comparison guide does not exist.",
      path: `/compare/${slug}`,
      noindex: true,
    });
  }

  return constructMetadata({
    title: `${cmp.title} | Technical Tea Comparison`,
    description: cmp.summary,
    path: `/compare/${cmp.slug}`,
    ogImage: "/images/cupping-guide.jpg",
    ogType: "article",
    authors: ["Tashi Bhutia, Master Tea Sommelier"],
  });
}

export default async function ComparisonDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cmp = COMPARISONS_DATA.find((c) => c.slug === slug);
  if (!cmp) notFound();

  const articleJsonLd = getArticleSchema({
    slug: `compare/${cmp.slug}`,
    title: cmp.title,
    summary: cmp.summary,
    content: `${cmp.title}\n\n${cmp.summary}\n\nTea A: ${cmp.teaA.name}\nTea B: ${cmp.teaB.name}`,
    author_name: "Tashi Bhutia, Master Tea Sommelier",
    published_at: "2026-03-01T00:00:00Z",
  });

  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Compare", url: "/compare" },
    { name: cmp.title, url: `/compare/${cmp.slug}` },
  ]);

  return (
    <article className="container page-shell max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav className="breadcrumbs flex items-center gap-1.5 text-xs text-[#63685e] mb-8" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <Link href="/compare" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_e888155d8c7d2e3c" fallback="Compare" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <span aria-current="page" className="text-[#18231c] font-semibold truncate max-w-xs sm:max-w-md">
          {cmp.title}
        </span>
      </nav>

      <header className="mb-10 pb-8 border-b border-[#e4ded0]">
        <span className="text-xs font-bold uppercase tracking-widest text-[#2c4e38] block mb-2"> <StorefrontText id="copy_2588f81793f8d0ac" fallback="Technical Comparison Matrix" /> </span>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#18231c] leading-tight mb-4">
          {cmp.title}
        </h1>
        <p className="text-lg sm:text-xl text-[#52594e] font-serif italic leading-relaxed">
          {cmp.summary}
        </p>
      </header>

      {/* Side-by-side Technical Table */}
      <div className="overflow-x-auto mb-12 border border-[#e4ded0] rounded-xl">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-[#f7f5f0] border-b border-[#e4ded0]">
              <th className="p-4 font-bold text-[#18231c] w-1/3"> <StorefrontText id="copy_7d5f33348c1adb1f" fallback="Evaluation Metric" /> </th>
              <th className="p-4 font-bold text-[#2c4e38] w-1/3">{cmp.teaA.name}</th>
              <th className="p-4 font-bold text-[#2c4e38] w-1/3">{cmp.teaB.name}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ece7dc]">
            <tr>
              <td className="p-4 font-semibold text-[#18231c]">Terroir & Elevation</td>
              <td className="p-4 text-[#52594e]">{cmp.teaA.origin}</td>
              <td className="p-4 text-[#52594e]">{cmp.teaB.origin}</td>
            </tr>
            <tr>
              <td className="p-4 font-semibold text-[#18231c]"> <StorefrontText id="copy_eb2fb86ec2e2ee14" fallback="Tasting Profile" /> </td>
              <td className="p-4 text-[#52594e]">{cmp.teaA.flavor}</td>
              <td className="p-4 text-[#52594e]">{cmp.teaB.flavor}</td>
            </tr>
            <tr>
              <td className="p-4 font-semibold text-[#18231c]"> <StorefrontText id="copy_9ec90708f376a931" fallback="Culinary Pairing" /> </td>
              <td className="p-4 text-[#52594e]">{cmp.teaA.pairing}</td>
              <td className="p-4 text-[#52594e]">{cmp.teaB.pairing}</td>
            </tr>
            <tr>
              <td className="p-4 font-semibold text-[#18231c]"> <StorefrontText id="copy_69d18bce20c9268e" fallback="Direct Sample Lot" /> </td>
              <td className="p-4">
                <Link
                  href={`/tea/${cmp.teaA.sampleSlug}`}
                  className="text-xs font-bold text-[#18231c] hover:text-[#2c4e38] underline"
                > <StorefrontText id="copy_4de2a6533f837661" fallback="View Sample Batch →" /> </Link>
              </td>
              <td className="p-4">
                <Link
                  href={`/tea/${cmp.teaB.sampleSlug}`}
                  className="text-xs font-bold text-[#18231c] hover:text-[#2c4e38] underline"
                > <StorefrontText id="copy_4de2a6533f837661" fallback="View Sample Batch →" /> </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="space-y-6 text-[#3d433b] text-base sm:text-lg leading-relaxed mb-16">
        <h2 className="font-serif text-2xl font-bold text-[#18231c] mt-8"> <StorefrontText id="copy_458c9ec4c1b78d57" fallback="Choosing the Right Harvest For Your Ritual" /> </h2>
        <p> <StorefrontText id="copy_c2d48320e58d0827" fallback="Both teas embody exemplary Himalayan craftsmanship, yet they cater to distinctly different moments in your day. When seeking brisk morning vigour or a robust base that stands tall alongside rich culinary fare, the fuller tannin structure of Assam orthodox is unmatched. Conversely, for mindful afternoon contemplation or delicate palate cleansing, the high-elevation muscatel delicacy of Darjeeling remains supreme." /> </p>
      </div>

      <aside className="p-8 bg-[#f7f5f0] border border-[#ece7dc] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-[#2c4e38] block mb-1"> <StorefrontText id="copy_cd4e961133c72a01" fallback="Need Personal Guidance?" /> </span>
          <h3 className="font-serif text-xl font-bold text-[#18231c]"> <StorefrontText id="copy_18a11a8cb0800b7a" fallback="Take The Interactive Tea Finder" /> </h3>
          <p className="text-xs text-[#52594e] mt-1"> <StorefrontText id="copy_b548dd65c1b00b69" fallback="Answer 3 quick sensory questions to match your exact brewing style and taste notes." /> </p>
        </div>
        <Link
          href="/tea-finder"
          className="whitespace-nowrap px-6 py-3 bg-[#18231c] text-[#fbf9f4] text-xs font-bold uppercase tracking-wider rounded-md hover:bg-[#2c4e38] transition-colors"
        > <StorefrontText id="copy_818cb7cf8bf78d05" fallback="Launch Tea Finder →" /> </Link>
      </aside>
    </article>
  );
}
