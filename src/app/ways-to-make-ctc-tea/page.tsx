import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema } from "@/lib/seo/schema";
import { listProducts } from "@/lib/products";
import { CtcBrewStory } from "@/components/ctc-brew/CtcBrewStory";
import { CtcBrewCalculator } from "@/components/ctc-brew/CtcBrewCalculator";
import { CtcFundamentals } from "@/components/ctc-brew/CtcFundamentals";
import { CtcShowcase } from "@/components/ctc-brew/CtcShowcase";
import { CtcFrequentlyAsked } from "@/components/ctc-brew/CtcFrequentlyAsked";
import { BookOpen, Compass, Sparkles } from "lucide-react";
import { getPageOrDefault } from "@/lib/pages";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const page = getPageOrDefault("ways-to-make-ctc-tea", {
    title: "Ways to Make CTC Tea",
    eyebrow: "Master Brewing Guide",
    headline: "7 Ways to Make CTC Tea. From Kadak to Kulhad.",
    subtitle:
      "Explore the 7 iconic traditions of brewing CTC black tea: from classic rolling-boil Kadak Chai and Royal Masala Chai to Kolkata earthen Kulhads, golden Sulaimani, Adrak-Tulsi tonics, chilled lattes, and Himalayan butter tea.",
    meta_title: "7 Authentic Ways to Make CTC Tea — Master Brewing Guide | TeaFloww",
    meta_description:
      "Explore the 7 iconic ways to brew CTC black tea: Classic Kadak Chai, Royal Masala, Kolkata Street Kulhad, Pahari Sulaimani, Adrak-Tulsi, Iced Chai Latte, and Himalayan Butter Brew. Includes interactive recipe scaler & boiling science.",
  });

  return constructMetadata({
    title: page.meta_title || "7 Authentic Ways to Make CTC Tea — Master Brewing Guide",
    description:
      page.meta_description ||
      "Master the 7 iconic traditions of brewing CTC black tea: from classic rolling-boil Kadak Chai and Royal Masala to Kolkata earthen Kulhads and golden Sulaimani.",
    path: "/ways-to-make-ctc-tea",
    ogImage: "/images/ctc-brew/method-01-kadak-chai.jpg",
  });
}

export default function WaysToMakeCtcTeaPage() {
  const page = getPageOrDefault("ways-to-make-ctc-tea", {
    title: "Ways to Make CTC Tea",
    eyebrow: "Master Brewing Guide · Origin to Stovetop",
    headline: "Seven iconic ways to make CTC tea.",
    subtitle:
      "CTC granules are built for fire, milk, and spice. Discover the timeless culinary traditions of brewing brisk black tea — complete with calibrated ratios, aeration secrets, and serving calculators.",
  });

  const allProducts = listProducts();
  const curatedCtcTeas = allProducts.filter(
    (p) =>
      p.slug === "masala-chai-reserve" ||
      p.slug === "assam-golden-breakfast" ||
      p.slug === "assam-golden-tips" ||
      p.category.toLowerCase().includes("chai") ||
      (p.category.toLowerCase().includes("black") && p.slug.includes("assam"))
  );

  const featuredTeas =
    curatedCtcTeas.length >= 3 ? curatedCtcTeas.slice(0, 3) : allProducts.slice(0, 3);

  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: page.title || "Ways to Make CTC Tea", url: "/ways-to-make-ctc-tea" },
  ]);

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Make Authentic CTC Chai (7 Traditional Methods)",
    description:
      "A comprehensive guide on making authentic CTC black tea using 7 distinct traditional Indian and Himalayan techniques.",
    image: "https://teafloww.com/images/ctc-brew/method-01-kadak-chai.jpg",
    totalTime: "PT6M",
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: "INR",
      value: "15",
    },
    supply: [
      { "@type": "HowToSupply", name: "CTC Black Tea Granules (3.5g - 4g)" },
      { "@type": "HowToSupply", name: "Spring Water (120ml)" },
      { "@type": "HowToSupply", name: "Fresh Whole Milk (120ml)" },
      { "@type": "HowToSupply", name: "Unrefined Sugar or Jaggery" },
      { "@type": "HowToSupply", name: "Bruised Green Cardamom & Ginger" },
    ],
    tool: [
      { "@type": "HowToTool", name: "Stainless Steel Heavy Saucepan" },
      { "@type": "HowToTool", name: "Fine Mesh Brass or Stainless Strainer" },
      { "@type": "HowToTool", name: "Mortar and Pestle" },
      { "@type": "HowToTool", name: "Ladle or Chai Kettle" },
    ],
    step: [
      {
        "@type": "HowToStep",
        name: "Boil Fresh Water with Spices",
        text: "Bring 120ml of fresh spring water to a rolling boil with bruised spices for 2 minutes to extract essential aromatic oils.",
      },
      {
        "@type": "HowToStep",
        name: "Add CTC Tea Granules",
        text: "Add 1.5 teaspoons of CTC granules and simmer vigorously for 90 seconds until the liquid turns dark mahogany.",
      },
      {
        "@type": "HowToStep",
        name: "Introduce Whole Milk",
        text: "Pour in 120ml of whole milk and sweeten to taste. Bring back to a frothy rolling boil over medium-high flame.",
      },
      {
        "@type": "HowToStep",
        name: "Aerate and Simmer",
        text: "Lower the flame as the froth rises near the rim; repeat twice to aerate and caramelize natural milk sugars.",
      },
      {
        "@type": "HowToStep",
        name: "Strain and Serve",
        text: "Double-strain through a fine mesh strainer directly into pre-warmed glasses, ceramic mugs, or terracotta kulhads.",
      },
    ],
  };

  const eyebrow = page.eyebrow || "Master Brewing Guide · Origin to Stovetop";
  const subtitle =
    page.subtitle ||
    "CTC granules are built for fire, milk, and spice. Discover the timeless culinary traditions of brewing brisk black tea — complete with calibrated ratios, aeration secrets, and serving calculators.";

  return (
    <div className="min-h-screen bg-[#f6f5ef] text-[#172c22]">
      {/* Structured SEO Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      {/* Atmospheric Page Intro Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8 sm:pt-14 sm:pb-12">
        {/* Breadcrumb Navigation */}
        <nav
          className="flex items-center gap-1.5 text-xs text-[#63685e] mb-8"
          aria-label="Breadcrumb"
        >
          <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
          <span className="text-[#a59f92]">/</span>
          <span aria-current="page" className="text-[#18231c] font-semibold">
            {page.title || "Ways to Make CTC Tea"}
          </span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-4 border-b border-[#ded9cb]">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-[#a46436] mb-4">
              <span className="w-7 h-[1px] bg-[#c48d64]" />
              <span>{eyebrow}</span>
            </div>

            {page.headline ? (
              <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-normal leading-[1.04] text-[#142d24] tracking-tight">
                {page.headline}
              </h1>
            ) : (
              <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-normal leading-[1.04] text-[#142d24] tracking-tight"> <StorefrontText id="copy_ee435f26e502199d" fallback="Seven iconic ways" /> <br />
                <em className="text-[#a46436] not-italic font-normal"> <StorefrontText id="copy_8c6ec4d6fedf2072" fallback="to brew CTC tea." /> </em>
              </h1>
            )}
          </div>

          <div className="max-w-md mb-1">
            <p className="text-sm sm:text-base text-[#5c685b] leading-relaxed mb-4">
              {subtitle}
            </p>

            <div className="flex items-center gap-2 text-xs font-semibold text-[#2c4e38]">
              <span className="w-2 h-2 rounded-full bg-[#1d8a4e] animate-pulse" />
              <span> <StorefrontText id="copy_9814037e2707bbc6" fallback="7 Verified Culinary Techniques · Interactive Scale Calculator" /> </span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Sticky Split-Screen Scrollytelling Section */}
      <CtcBrewStory />

      {/* Interactive Ratio Customizer & Calculator */}
      <CtcBrewCalculator />

      {/* Technical Extraction Science & Comparison (CTC vs Orthodox) */}
      <CtcFundamentals />

      {/* Curated Commerce Showcase: Teas Crafted For Boiling */}
      <CtcShowcase products={featuredTeas} />

      {/* Troubleshooting & Frequently Asked Questions Accordion */}
      <CtcFrequentlyAsked />

      {/* Cross-Link Crossover Banner to Orthodox Leaf-to-Cup & Tea Journal */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Orthodox Leaf to Cup Crossover Card */}
          <div className="p-8 sm:p-10 rounded-3xl bg-[#ece7dc] border border-[#dcd6c7] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#4d6652] mb-3">
                <Compass size={14} className="text-[#64845c]" />
                <span> <StorefrontText id="copy_8d77c92e0f8d98f1" fallback="Orthodox Origin Craft" /> </span>
              </div>
              <h3 className="font-serif text-2xl sm:text-3xl text-[#18231c] mb-3"> <StorefrontText id="copy_499fd60125fad76a" fallback="Experience the 7-Stage Leaf-to-Cup Journey" /> </h3>
              <p className="text-sm text-[#5a6356] leading-relaxed mb-6"> <StorefrontText id="copy_53a027e562e47bcb" fallback="Curious how hand-plucked tender Himalayan shoots transform through withering, rolling, oxidation, and firing? Explore our award-winning interactive origin journey." /> </p>
            </div>

            <Link
              href="/leaf-to-cup"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-[#18231c] text-white text-xs font-bold tracking-wider uppercase hover:bg-[#2c4e38] transition-colors self-start"
            >
              <Compass size={16} />
              <span> <StorefrontText id="copy_cf4cd359390e7d09" fallback="Explore Leaf-to-Cup" /> </span>
            </Link>
          </div>

          {/* Sommelier Academy Journal Card */}
          <div className="p-8 sm:p-10 rounded-3xl bg-[#11241c] text-[#f7f5ee] border border-[#234233] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#d8bb88] mb-3">
                <Sparkles size={14} />
                <span>Tea Academy &amp; Guides</span>
              </div>
              <h3 className="font-serif text-2xl sm:text-3xl text-white mb-3"> <StorefrontText id="copy_65050b2499443e8f" fallback="Deepen Your Tea Connoisseurship" /> </h3>
              <p className="text-sm text-[#c8d4c7] leading-relaxed mb-6"> <StorefrontText id="copy_53a0e6ea9f2752cb" fallback="Read our in-depth sommelier guides on seasonal flush differences, mountain terroir, water minerality curves, and cupping scores curated by licensed tea masters." /> </p>
            </div>

            <Link
              href="/blog"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-[#edd8b4] text-[#14261e] text-xs font-bold tracking-wider uppercase hover:bg-[#fae8c8] transition-colors self-start"
            >
              <BookOpen size={16} />
              <span> <StorefrontText id="copy_1fddf49a9e731b2c" fallback="Read Tea Journal" /> </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
