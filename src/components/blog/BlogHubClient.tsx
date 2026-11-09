"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useMemo } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import { Clock, ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { BlogFilterBar } from "./BlogFilterBar";

export interface BlogItem {
  id: number;
  slug: string;
  title: string;
  summary: string;
  excerpt: string;
  author_name: string;
  cover_image_url?: string | null;
  published_at: string;
  category?: string;
  reading_time_minutes?: number;
}

export function BlogHubClient({ initialArticles }: { initialArticles: BlogItem[] }) {
  const [activeCategory, setActiveCategory] = useState("All Articles");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    "All Articles",
    "Brewing Guides",
    "Terroirs & Flushes",
    "Bengali Tea Culture",
    "Cupping & Tasting",
  ];

  // Helper to categorize articles based on title/slug
  const getCategoryForPost = (post: BlogItem): string => {
    const text = `${post.title} ${post.slug}`.toLowerCase();
    if (text.includes("brew") || text.includes("how-to") || text.includes("recipe") || text.includes("steep")) {
      return "Brewing Guides";
    }
    if (
      text.includes("bengal") ||
      text.includes("lebu") ||
      text.includes("nolen") ||
      text.includes("kolkata") ||
      text.includes("paan") ||
      text.includes("siliguri")
    ) {
      return "Bengali Tea Culture";
    }
    if (text.includes("cupping") || text.includes("tasting") || text.includes("flavour") || text.includes("blend")) {
      return "Cupping & Tasting";
    }
    return "Terroirs & Flushes";
  };

  const enrichedArticles = useMemo(() => {
    return initialArticles.map((art) => {
      const words = (art.summary || art.excerpt || art.title).split(/\s+/).length + 350;
      const readingTime = Math.max(2, Math.ceil(words / 200));
      return {
        ...art,
        category: getCategoryForPost(art),
        reading_time_minutes: readingTime,
      };
    });
  }, [initialArticles]);

  const filteredArticles = useMemo(() => {
    return enrichedArticles.filter((art) => {
      const matchesCategory =
        activeCategory === "All Articles" || art.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        art.title.toLowerCase().includes(q) ||
        (art.summary && art.summary.toLowerCase().includes(q)) ||
        (art.excerpt && art.excerpt.toLowerCase().includes(q)) ||
        art.author_name.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [enrichedArticles, activeCategory, searchQuery]);

  // Featured article is the first article when no filter is applied
  const featured = !searchQuery && activeCategory === "All Articles" ? filteredArticles[0] : null;
  const gridArticles = featured ? filteredArticles.slice(1) : filteredArticles;

  return (
    <div>
      <BlogFilterBar
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={filteredArticles.length}
      />

      {/* Featured Hero Article */}
      {featured && (
        <article className="mb-14 p-6 sm:p-10 bg-gradient-to-br from-[#ffffff] to-[#f8f5ee] border border-[#e2dcd0] rounded-3xl shadow-sm hover:border-[#2c4e38]/60 transition-all duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {featured.cover_image_url && (
              <div className="lg:col-span-7">
                <Link
                  href={`/blog/${featured.slug}`}
                  className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-[#ede9df] block group"
                >
                  <Image
                    src={featured.cover_image_url}
                    alt={featured.title}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 650px"
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-4 left-4 bg-[#18231c]/80 backdrop-blur-md text-[#fbf9f4] text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#c69255]" />
                    <span> <StorefrontText id="copy_5b6cdc2f5316e728" fallback="Featured Story" /> </span>
                  </div>
                </Link>
              </div>
            )}

            <div className={featured.cover_image_url ? "lg:col-span-5" : "lg:col-span-12"}>
              <div className="flex items-center gap-2.5 text-xs text-[#6e746a] mb-3">
                <span className="font-bold text-[#2c4e38] uppercase tracking-wider text-[11px]">
                  {featured.category}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {featured.reading_time_minutes} <StorefrontText id="copy_b337c94500c5a161" fallback="min read" /> </span>
              </div>

              <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#18231c] font-bold leading-tight mb-4 hover:text-[#2c4e38] transition-colors [text-wrap:balance]">
                <Link href={`/blog/${featured.slug}`}>{featured.title}</Link>
              </h2>

              <p className="text-sm sm:text-base text-[#52594e] leading-relaxed mb-6 line-clamp-3 [text-wrap:pretty]">
                {featured.summary || featured.excerpt}
              </p>

              <div className="flex items-center justify-between pt-6 border-t border-[#eee8db]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#2c4e38] text-white flex items-center justify-center font-serif text-xs font-bold">
                    {featured.author_name ? featured.author_name.charAt(0) : "T"}
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold text-[#18231c] block">
                      {featured.author_name}
                    </span>
                    <time dateTime={featured.published_at} className="text-[#7d8478]">
                      {new Date(featured.published_at).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                </div>

                <Link
                  href={`/blog/${featured.slug}`}
                  className="px-5 py-2.5 bg-[#18231c] hover:bg-[#2c4e38] text-[#fbf9f4] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <span> <StorefrontText id="copy_4536a47de9e85a46" fallback="Read Article" /> </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </article>
      )}

      {/* Grid of Articles */}
      {gridArticles.length === 0 ? (
        <div className="p-16 text-center bg-[#f7f5f0] border border-[#ece7dc] rounded-3xl mb-16">
          <BookOpen className="w-10 h-10 text-[#2c4e38] mx-auto mb-3 opacity-60" />
          <h3 className="font-serif text-2xl text-[#18231c] font-bold mb-2"> <StorefrontText id="copy_5afac6a9827b7d50" fallback="No tea stories found" /> </h3>
          <p className="text-sm text-[#52594e] max-w-md mx-auto mb-6">
            We couldn&apos;t find any guides matching &ldquo;{searchQuery}&rdquo;. Try clearing your search query or selecting a different category.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setActiveCategory("All Articles");
            }}
            className="px-6 py-3 bg-[#18231c] text-[#fbf9f4] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#2c4e38] transition-colors"
          > <StorefrontText id="copy_660f3d76f4f2802d" fallback="Reset Filters" /> </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {gridArticles.map((art) => (
            <article
              key={art.id}
              className="p-6 rounded-2xl bg-white border border-[#e4ded0] hover:border-[#2c4e38] hover:shadow-md transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                {art.cover_image_url && (
                  <Link
                    href={`/blog/${art.slug}`}
                    className="relative aspect-[16/9] w-full mb-5 rounded-xl overflow-hidden bg-[#ede9df] block"
                  >
                    <Image
                      src={art.cover_image_url}
                      alt={art.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 380px"
                      loading="lazy"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-[#18231c]/75 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                      {art.category}
                    </div>
                  </Link>
                )}

                <div className="flex items-center gap-2 text-[11px] text-[#6e746a] mb-2.5">
                  <span className="font-semibold text-[#2c4e38]">{art.author_name}</span>
                  <span>•</span>
                  <time dateTime={art.published_at}>
                    {new Date(art.published_at).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  <span>•</span>
                  <span>{art.reading_time_minutes} <StorefrontText id="copy_1f6fa6f69d185e60" fallback="min" /> </span>
                </div>

                <h3 className="font-serif text-xl text-[#18231c] font-bold mb-2.5 leading-snug group-hover:text-[#2c4e38] transition-colors [text-wrap:balance]">
                  <Link href={`/blog/${art.slug}`}>{art.title}</Link>
                </h3>

                <p className="text-xs text-[#52594e] leading-relaxed line-clamp-3 mb-6 [text-wrap:pretty]">
                  {art.summary || art.excerpt}
                </p>
              </div>

              <div className="pt-4 border-t border-[#f0ede6] flex items-center justify-between">
                <Link
                  href={`/blog/${art.slug}`}
                  className="text-xs font-bold uppercase tracking-wider text-[#18231c] group-hover:text-[#2c4e38] inline-flex items-center gap-1.5 transition-colors"
                >
                  <span> <StorefrontText id="copy_23b13e25bf395de3" fallback="Read Story" /> </span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
