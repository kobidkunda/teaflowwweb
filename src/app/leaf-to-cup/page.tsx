import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema } from "@/lib/seo/schema";
import { listProducts } from "@/lib/products";
import { LeafToCupStory } from "@/components/leaf-to-cup/LeafToCupStory";
import { TasteTheCraftShowcase } from "@/components/leaf-to-cup/TasteTheCraftShowcase";
import { BookOpen } from "lucide-react";
import { getPageOrDefault } from "@/lib/pages";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const page = getPageOrDefault("leaf-to-cup");
  return constructMetadata({
    title: page.meta_title || "From Leaf to Cup — The Himalayan Orthodox Tea Journey",
    description:
      page.meta_description ||
      "Experience the 7 stages of artisanal orthodox black tea craftsmanship: from hand-harvesting tender shoots in misty mountain gardens to withering, rolling, oxidation, drying, sorting, and mindful brewing.",
    path: "/leaf-to-cup",
    ogImage: "/images/craft/stage-01-plucking.jpg",
  });
}

export default function LeafToCupPage() {
  const page = getPageOrDefault("leaf-to-cup");
  const allProducts = listProducts();
  const blackTeas = allProducts.filter(
    (p) =>
      p.category.toLowerCase().includes("black") ||
      p.slug === "darjeeling-spring" ||
      p.slug === "summer-chinary-black" ||
      p.slug === "assam-golden-tips"
  );
  const featuredTeas = blackTeas.length >= 3 ? blackTeas.slice(0, 3) : allProducts.slice(0, 3);

  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: page.title || "Leaf to Cup", url: "/leaf-to-cup" },
  ]);

  const eyebrow = page.eyebrow || "From the gardens to your cup";
  const subtitle = page.subtitle || "Before the first sip, there is an entire mountain story. Follow the remarkable transformation of Himalayan tea — one thoughtful stage at a time.";

  return (
    <div className="min-h-screen bg-[#f6f5ef] text-[#172c22]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Atmospheric Page Intro Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8 sm:pt-14 sm:pb-12">
        {/* Breadcrumb */}
        <nav
          className="flex items-center gap-1.5 text-xs text-[#63685e] mb-8"
          aria-label="Breadcrumb"
        >
          <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
          <span className="text-[#a59f92]">/</span>
          <span aria-current="page" className="text-[#18231c] font-semibold">
            {page.title || "Leaf to Cup"}
          </span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-4 border-b border-[#ded9cb]">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-[#60775a] mb-4">
              <span className="w-7 h-[1px] bg-[#899c82]" />
              <span>{eyebrow}</span>
            </div>

            {page.headline ? (
              <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-normal leading-[1.04] text-[#142d24] tracking-tight">
                {page.headline}
              </h1>
            ) : (
              <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-normal leading-[1.04] text-[#142d24] tracking-tight"> <StorefrontText id="copy_56401a381c8dacab" fallback="A little leaf." /> <br />
                <em className="text-[#64845c] not-italic font-normal"> <StorefrontText id="copy_6f3a9db8a97471c5" fallback="An extraordinary journey." /> </em>
              </h1>
            )}
          </div>

          <p className="max-w-md text-sm sm:text-base text-[#5c685b] leading-relaxed mb-1">
            {subtitle}
          </p>
        </div>
      </section>

      {/* Interactive Sticky Split-Screen Scrollytelling Section */}
      <LeafToCupStory />

      {/* Curated Commerce Showcase: Taste The Craft */}
      <TasteTheCraftShowcase products={featuredTeas} />

      {/* Cross-Link to Tea Academy Hub */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#ece7dc] border border-[#dcd6c7] flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#4d6652] block mb-2">
              Connoisseurship &amp; Sommelier Guides
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#18231c] mb-3"> <StorefrontText id="copy_c4659dda94e53454" fallback="Deepen your tea appreciation at our Academy" /> </h2>
            <p className="text-sm text-[#5a6356] leading-relaxed"> <StorefrontText id="copy_8f3d468a6e704912" fallback="Explore professional cupping parameters, water temperature curves, seasonal flush distinctions, and high-mountain terroir notes curated by our licensed tea tasters." /> </p>
          </div>

          <Link
            href="/blog"
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-[#18231c] text-white text-xs font-bold tracking-wider uppercase hover:bg-[#2c4e38] transition-colors shrink-0"
          >
            <BookOpen size={16} />
            <span> <StorefrontText id="copy_1fddf49a9e731b2c" fallback="Read Tea Journal" /> </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
