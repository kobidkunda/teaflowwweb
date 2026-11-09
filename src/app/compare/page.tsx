import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema } from "@/lib/seo/schema";
import { COMPARISONS_DATA } from "@/lib/comparisons";

export const dynamic = "force-dynamic";

export const metadata = constructMetadata({
  title: "Side-by-Side Tea Comparisons — Terroir, Body & Flushes",
  description:
    "Compare single-estate orthodox teas side-by-side: Assam vs. Darjeeling, Orthodox vs. High-Mountain Green, and First Flush vs. Second Flush nuances.",
  path: "/compare",
});

export default function CompareHubPage() {
  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Compare", url: "/compare" },
  ]);

  return (
    <div className="container page-shell max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav className="breadcrumbs flex items-center gap-1.5 text-xs text-[#63685e] mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <span aria-current="page" className="text-[#18231c] font-semibold"> <StorefrontText id="copy_e4090ef2ddb84d9e" fallback="Tea Comparisons" /> </span>
      </nav>

      <header className="mb-12 max-w-3xl">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#2c4e38] block mb-2">
          Terroir & Tasting Analysis
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#18231c] tracking-tight mb-4"> <StorefrontText id="copy_263e305cf27e0ebb" fallback="Real-World Tea Comparisons" /> </h1>
        <p className="text-base sm:text-lg text-[#52594e] leading-relaxed"> <StorefrontText id="copy_0006caad4731931f" fallback="Choosing between regions, flushes, and oxidation styles. Read side-by-side technical breakdowns to discover your ideal steeping preference." /> </p>
      </header>

      <div className="space-y-8">
        {COMPARISONS_DATA.map((cmp) => (
          <article
            key={cmp.slug}
            className="p-6 sm:p-8 bg-white border border-[#e4ded0] rounded-xl hover:border-[#2c4e38] transition-colors"
          >
            <div className="mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2c4e38]">
                {cmp.subtitle}
              </span>
              <h2 className="font-serif text-2xl text-[#18231c] font-bold mt-1 mb-2 hover:text-[#2c4e38] transition-colors">
                <Link href={`/compare/${cmp.slug}`}>{cmp.title}</Link>
              </h2>
              <p className="text-sm text-[#52594e] max-w-3xl leading-relaxed">
                {cmp.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6 p-4 bg-[#f8f6f0] rounded-lg">
              <div className="border-b md:border-b-0 md:border-r border-[#e8e4da] pb-3 md:pb-0 md:pr-4">
                <div className="text-xs font-bold text-[#18231c] uppercase">{cmp.teaA.name}</div>
                <div className="text-xs text-[#6e746a] mt-1">{cmp.teaA.origin}</div>
                <div className="text-xs text-[#3d433b] mt-1 italic">{cmp.teaA.flavor}</div>
              </div>
              <div className="pt-3 md:pt-0 md:pl-4">
                <div className="text-xs font-bold text-[#18231c] uppercase">{cmp.teaB.name}</div>
                <div className="text-xs text-[#6e746a] mt-1">{cmp.teaB.origin}</div>
                <div className="text-xs text-[#3d433b] mt-1 italic">{cmp.teaB.flavor}</div>
              </div>
            </div>

            <Link
              href={`/compare/${cmp.slug}`}
              className="text-xs font-bold uppercase tracking-wider text-[#18231c] hover:text-[#2c4e38] inline-flex items-center gap-1.5"
            > <StorefrontText id="copy_5b7dd5b2adbdf5a6" fallback="Read Full Technical Comparison" /> <span>→</span>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
