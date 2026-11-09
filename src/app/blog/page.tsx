import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { getDb } from "@/lib/db";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema } from "@/lib/seo/schema";
import { BlogHubClient, type BlogItem } from "@/components/blog/BlogHubClient";

export const dynamic = "force-dynamic";

export const metadata = constructMetadata({
  title: "Tea Journal & Brewing Guides",
  description:
    "Explore Himalayan and Bengal tea origins, artisanal flushes, sensory cupping profiles, and authentic brewing recipes from licensed tea tasters and master tea blenders.",
  path: "/blog",
  ogImage: "/images/cupping-guide.jpg",
});

export default async function BlogHubPage() {
  const db = getDb();
  let articles: BlogItem[] = [];

  try {
    articles = db
      .prepare(
        "SELECT id, slug, title, summary, excerpt, author_name, cover_image_url, published_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC"
      )
      .all() as BlogItem[];
  } catch {
    articles = [];
  }

  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Tea Journal", url: "/blog" },
  ]);

  return (
    <div className="container page-shell max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Accessible Breadcrumb Navigation */}
      <nav className="breadcrumbs flex items-center gap-1.5 text-xs text-[#63685e] mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <span aria-current="page" className="text-[#18231c] font-semibold">
          Tea Journal &amp; Guides
        </span>
      </nav>

      {/* Page Header */}
      <header className="mb-12 max-w-3xl">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#2c4e38] block mb-2">
          Origin Stories, Terroirs &amp; Brewing Culture
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#18231c] tracking-tight mb-4 [text-wrap:balance]"> <StorefrontText id="copy_4fa78d75e887c951" fallback="Notes from the Tea Table" /> </h1>
        <p className="text-base sm:text-lg text-[#52594e] leading-relaxed [text-wrap:pretty]"> <StorefrontText id="copy_0a1d4deef1a5a307" fallback="Explore regional single-origin flushes, leaf harvest chronicles, sensory radar cupping notes, and precision steeping guides from Darjeeling, Assam, and Bengal foothills." /> </p>
      </header>

      {/* Main Interactive Client Hub */}
      <BlogHubClient initialArticles={articles} />

      {/* Cross-linking to Tea Finder Quiz and Shop */}
      <section className="bg-gradient-to-r from-[#fbf9f4] via-[#f7f4ed] to-[#f2eee3] border border-[#ece7dc] rounded-3xl p-8 sm:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-16">
        <div className="max-w-2xl">
          <span className="text-xs uppercase font-bold tracking-widest text-[#2c4e38] block mb-2">
            Terroir Match &amp; Flavour Profiling
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#18231c] font-bold mb-3 [text-wrap:balance]"> <StorefrontText id="copy_3269e086faca213e" fallback="Find the Tea That Matches Your Palate" /> </h2>
          <p className="text-sm text-[#52594e] leading-relaxed [text-wrap:pretty]"> <StorefrontText id="copy_46563f28d7cfbfcf" fallback="Unsure whether an orthodox First Flush, fragrant Lebu Cha, or a brisk breakfast cup suits your morning? Compare terroir, mouthfeel, and caffeine intensity with our 60-second tea quiz." /> </p>
        </div>
        <div className="flex flex-wrap gap-3.5 flex-shrink-0">
          <Link
            href="/tea-finder"
            className="px-6 py-3.5 bg-[#18231c] text-[#fbf9f4] text-xs font-bold tracking-wider uppercase rounded-xl hover:bg-[#2c4e38] transition-colors shadow-sm"
          > <StorefrontText id="copy_43a07da31ca1590f" fallback="Tea Finder Quiz →" /> </Link>
          <Link
            href="/shop"
            className="px-6 py-3.5 bg-white border border-[#cfc8b8] text-[#18231c] text-xs font-bold tracking-wider uppercase rounded-xl hover:bg-[#ece7dc] transition-colors"
          > <StorefrontText id="copy_4d1f2b5b8471a1ce" fallback="Explore All Teas" /> </Link>
        </div>
      </section>
    </div>
  );
}
