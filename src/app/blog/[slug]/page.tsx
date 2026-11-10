import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { notFound } from "next/navigation";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { analyzeBlogSpecs, type BlogPost } from "@/lib/blogs";
import { constructMetadata } from "@/lib/seo/metadata";
import { getArticleSchema, getBreadcrumbSchema } from "@/lib/seo/schema";
import { ReadingProgressBar } from "@/components/blog/ReadingProgressBar";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { BlogContentRenderer } from "@/components/blog/BlogContentRenderer";
import { BlogShareButtons } from "@/components/blog/BlogShareButtons";
import { Clock, Calendar, ArrowRight } from "lucide-react";
import { requestContext } from "@/lib/international/context";
import { localize } from "@/lib/international/translations";

export const dynamic = "force-dynamic";

interface RelatedPost {
  id: number;
  slug: string;
  title: string;
  summary: string;
  excerpt: string;
  cover_image_url?: string | null;
  published_at: string;
}

function getArticle(slug: string): BlogPost | null {
  const db = getDb();
  try {
    const post = db
      .prepare(
        "SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'"
      )
      .get(slug) as BlogPost | undefined;
    return post || null;
  } catch {
    return null;
  }
}

function getRelatedArticles(currentId: number): RelatedPost[] {
  const db = getDb();
  try {
    return db
      .prepare(
        "SELECT id, slug, title, summary, excerpt, cover_image_url, published_at FROM blog_posts WHERE status = 'published' AND id != ? ORDER BY published_at DESC LIMIT 3"
      )
      .all(currentId) as RelatedPost[];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await requestContext();
  const rawArticle = getArticle(slug);

  if (!rawArticle) {
    return constructMetadata({
      title: "Article Not Found",
      description: "The requested tea brewing guide or story was not found.",
      path: `/blog/${slug}`,
      noindex: true,
      locale: ctx.locale,
    });
  }

  const article = localize(rawArticle, `blog:${rawArticle.id}`, ctx.locale);

  const articleImage =
    article.cover_image_url && article.cover_image_url.trim()
      ? article.cover_image_url.trim()
      : slug.includes("darjeeling")
      ? "/images/darjeeling-first-flush.jpg"
      : slug.includes("brew") || slug.includes("chai")
      ? "/images/assam-brewing-guide.jpg"
      : slug.includes("ctc") || slug.includes("orthodox")
      ? "/images/orthodox-vs-ctc.jpg"
      : "/images/cupping-guide.jpg";

  return constructMetadata({
    title: article.seo_title || article.title,
    description: article.seo_description || article.summary || article.excerpt,
    path: `/blog/${article.slug}`,
    ogImage: articleImage,
    ogType: "article",
    publishedTime: article.published_at || undefined,
    modifiedTime: article.updated_at || article.published_at || undefined,
    authors: [article.author_name || "Teafloww"],
    canonicalOverride: article.canonical_override,
    noindex: Boolean(article.noindex),
    locale: ctx.requestedLocale || "en",
    resource: `blog:${rawArticle.id}`,
  });
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requestContext();
  const rawArticle = getArticle(slug);
  if (!rawArticle) notFound();

  const article = localize(rawArticle, `blog:${rawArticle.id}`, ctx.locale);
  const related = getRelatedArticles(article.id).map(r => localize(r, `blog:${r.id}`, ctx.locale));
  const specs = analyzeBlogSpecs(article.content, article);
  const articleJsonLd = getArticleSchema(article);
  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Tea Journal", url: "/blog" },
    { name: article.title, url: `/blog/${article.slug}` },
  ]);

  const readingTime = specs.reading_metrics.reading_time_minutes;
  const headings = specs.headings_outline;

  return (
    <>
      {/* Smooth Reading Progress Bar */}
      <ReadingProgressBar />

      {/* Schema.org Article & Breadcrumbs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <article className="container page-shell max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Accessible Breadcrumbs */}
        <nav className="breadcrumbs flex items-center gap-1.5 text-xs text-[#63685e] mb-8" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
          <span className="text-[#a59f92]">/</span>
          <Link href="/blog" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_21255b30dceadc49" fallback="Tea Journal" /> </Link>
          <span className="text-[#a59f92]">/</span>
          <span aria-current="page" className="text-[#18231c] font-semibold truncate max-w-xs sm:max-w-md">
            {article.title}
          </span>
        </nav>

        {/* Article Header & Editorial Masthead */}
        <header className="mb-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-widest text-[#2c4e38] font-bold mb-4">
            <span className="px-2.5 py-1 bg-[#2c4e38]/10 text-[#2c4e38] rounded-full"> <StorefrontText id="copy_62dec4c7b85f58ab" fallback="Editorial Dossier" /> </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-[#5a6155]">
              <Calendar className="w-3.5 h-3.5" />
              <time dateTime={article.published_at || ""}>
                {article.published_at
                  ? new Date(article.published_at).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Recently Published"}
              </time>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-[#5a6155]">
              <Clock className="w-3.5 h-3.5" />
              {readingTime} <StorefrontText id="copy_b337c94500c5a161" fallback="min read" /> </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#18231c] leading-[1.18] tracking-tight mb-5 [text-wrap:balance]">
            {article.title}
          </h1>

          {article.summary && (
            <p className="text-lg sm:text-xl text-[#52594e] font-serif italic leading-relaxed mb-6 [text-wrap:pretty]">
              {article.summary}
            </p>
          )}

          {/* Author Byline & Social Share Strip */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-[#eee8db]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#2c4e38] text-white flex items-center justify-center font-serif font-bold text-base shadow-sm">
                {article.author_name ? article.author_name.charAt(0) : "T"}
              </div>
              <div>
                <div className="text-sm font-semibold text-[#18231c]">
                  {article.author_name || "Teafloww Tea Master"}
                </div>
                <div className="text-xs text-[#73786f]">
                  Single-Estate Tea Cupping &amp; Terroir Archive
                </div>
              </div>
            </div>

            <BlogShareButtons title={article.title} slug={article.slug} />
          </div>
        </header>

        {/* Hero Cover Imagery (16:9 Editorial standard) */}
        {article.cover_image_url && (
          <div className="relative aspect-[16/9] w-full max-w-5xl mb-12 rounded-3xl overflow-hidden bg-[#ede9df] shadow-sm border border-[#e4ded0]">
            <Image
              src={article.cover_image_url}
              alt={article.title}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              priority
              className="object-cover"
            />
          </div>
        )}

        {/* Article Layout: Two-Column with Sticky Table of Contents on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Table of Contents Column (Sticky) */}
          <div className="lg:col-span-4 order-2 lg:order-1">
            <TableOfContents headings={headings} />

            {/* Sticky Sommelier Quick Pairing Box */}
            <div className="mt-8 p-6 bg-[#f7f5f0] border border-[#ece7dc] rounded-2xl hidden lg:block sticky top-[22rem]">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#2c4e38] block mb-1"> <StorefrontText id="copy_7e2dbcc2e9954211" fallback="Explore The Garden" /> </span>
              <h4 className="font-serif text-base font-bold text-[#18231c] mb-2"> <StorefrontText id="copy_82eccbeee4c15fc5" fallback="Pure Loose-Leaf Lots" /> </h4>
              <p className="text-xs text-[#52594e] leading-relaxed mb-4"> <StorefrontText id="copy_e354d28a1a8fc264" fallback="Fresh flushes, orthodox whole leaves, and fragrant tea blends sourced without middlemen." /> </p>
              <Link
                href="/shop"
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#2c4e38] hover:text-[#18231c] transition-colors"
              >
                <span> <StorefrontText id="copy_b99553c130c82510" fallback="Browse tea lots" /> </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Main Prose & Interactive Content Renderer Column */}
          <main className="lg:col-span-8 order-1 lg:order-2">
            <BlogContentRenderer content={article.content} />
          </main>
        </div>

        {/* Contextual Teas & Explore Banner */}
        <aside className="mt-16 p-8 sm:p-10 bg-gradient-to-r from-[#fbf9f4] via-[#f7f4ed] to-[#f2eee3] border border-[#ece7dc] rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="text-xs uppercase font-bold tracking-widest text-[#2c4e38] block mb-1"> <StorefrontText id="copy_0d60c3c36d0cc2de" fallback="From the Garden to the Cup" /> </span>
            <h3 className="font-serif text-2xl font-bold text-[#18231c] mb-2"> <StorefrontText id="copy_0568fde8e46bc0fd" fallback="Explore Teafloww Fresh Single-Estate Lots" /> </h3>
            <p className="text-xs sm:text-sm text-[#52594e] leading-relaxed [text-wrap:pretty]"> <StorefrontText id="copy_12e19f37ad65653f" fallback="Directly sourced loose leaves, regional flushes and aroma-rich teas, packaged in vacuum foil for slow, mindful mornings." /> </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="px-6 py-3.5 bg-[#18231c] text-[#fbf9f4] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#2c4e38] transition-colors shadow-sm"
            > <StorefrontText id="copy_7accc79703973344" fallback="Explore Teas →" /> </Link>
            <Link
              href="/tea-finder"
              className="px-5 py-3.5 bg-white border border-[#cfc8b8] text-[#18231c] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#ece7dc] transition-colors"
            > <StorefrontText id="copy_b9501fcc8bb7f13b" fallback="Tea Finder Quiz" /> </Link>
          </div>
        </aside>

        {/* Related Stories */}
        {related.length > 0 && (
          <section className="mt-16 pt-12 border-t border-[#e4ded0]">
            <h2 className="font-serif text-2xl sm:text-3xl text-[#18231c] font-bold mb-8"> <StorefrontText id="copy_e942feeb7afab2d9" fallback="Continue Reading From The Journal" /> </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/blog/${rel.slug}`}
                  className="group block p-5 rounded-2xl bg-white border border-[#e4ded0] hover:border-[#2c4e38] hover:shadow-sm transition-all duration-300"
                >
                  {rel.cover_image_url && (
                    <div className="relative aspect-[16/9] w-full mb-4 rounded-xl overflow-hidden bg-[#ede9df]">
                      <Image
                        src={rel.cover_image_url}
                        alt={rel.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 320px"
                        loading="lazy"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="text-[11px] text-[#6e746a] mb-1.5">
                    <time dateTime={rel.published_at}>
                      {new Date(rel.published_at).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                  <h3 className="font-serif text-base font-bold text-[#18231c] group-hover:text-[#2c4e38] transition-colors line-clamp-2 mb-2 leading-snug">
                    {rel.title}
                  </h3>
                  <p className="text-xs text-[#52594e] line-clamp-2 leading-relaxed">
                    {rel.summary || rel.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
