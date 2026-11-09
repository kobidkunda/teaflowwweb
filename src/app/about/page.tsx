import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import {
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  Leaf,
  Sparkles,
  Mountain,
  Compass,
  ArrowRight,
  CheckCircle2,
  Building2,
  Clock,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ObfuscatedEmail } from "@/components/ObfuscatedEmail";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema } from "@/lib/seo/schema";
import { getDynamicSiteConfig } from "@/lib/seo/site";
import { getPageOrDefault } from "@/lib/pages";
import { requestContext } from "@/lib/international/context";
import { localize } from "@/lib/international/translations";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const ctx = await requestContext();
  const rawPage = getPageOrDefault("about");
  const resource = rawPage.id ? `page:${rawPage.id}` : "page:about";
  const page = localize(rawPage, resource, ctx.locale);
  const siteConfig = getDynamicSiteConfig();
  return constructMetadata({
    title: page.meta_title || `About ${siteConfig.brand} — Himalayan Single-Estate Teas & Provenance`,
    description:
      page.meta_description ||
      `Discover ${siteConfig.brand}'s direct-from-origin sourcing model: single-estate harvests across Darjeeling, Assam, Kangra, and Nilgiri, vacuum-sealed at our Siliguri hub at the Himalayan foothills.`,
    path: "/about",
    ogImage: "/images/about/hero-himalayan-dawn.jpg",
    locale: ctx.requestedLocale || ctx.locale,
    resource,
  });
}

const TERROIRS = [
  {
    name: "Darjeeling",
    state: "West Bengal",
    elevation: "1,200m – 2,200m ASL",
    profile: "Alpine mists, crisp Himalayan diurnal shifts, and steep mineral slopes.",
    flavor: "Delicate muscatel notes, white blossom, fresh green almond, and lingering floral sweetness.",
    harvest: "First Flush (Spring) & Second Flush (Summer) Orthodox",
    badge: "The Champagne of Teas",
  },
  {
    name: "Assam",
    state: "Brahmaputra Valley",
    elevation: "50m – 120m ASL",
    profile: "Dense alluvial floodplains, monsoonal warmth, and nutrient-dense river soil.",
    flavor: "Bold maltiness, roasted cocoa, warm honeycomb, and deep copper-amber liquor.",
    harvest: "Orthodox Golden Tips & Full-Bodied Breakfast Leaves",
    badge: "Heart of Rich Malts",
  },
  {
    name: "Kangra",
    state: "Himachal Pradesh",
    elevation: "1,000m – 1,500m ASL",
    profile: "Glacial runoff from the Dhauladhar range, pine valley breezes, and limestone soil.",
    flavor: "Subtle vegetal sweetness, roasted chestnut undertones, and refreshing alpine clarity.",
    harvest: "Small-batch Orthodox Greens & Light-Oxidized Oolongs",
    badge: "Glacial Terroir",
  },
  {
    name: "Nilgiri",
    state: "Tamil Nadu",
    elevation: "1,800m – 2,400m ASL",
    profile: "High-altitude cloud forests, dramatic year-round moisture, and crisp winter chills.",
    flavor: "Bright golden liquor, brisk citrus zest, passionfruit hints, and crisp aromatic finish.",
    harvest: "Winter Frost Orthodox & Rare High-Elevation Flushes",
    badge: "Blue Mountain Frost",
  },
];

const FOUR_STANDARDS = [
  {
    icon: ShieldCheck,
    title: "1. 100% Single-Estate Purity",
    description:
      "We strictly refuse anonymous multi-origin blending and commercial dust dilution. Every tin is traceable to its estate, elevation, batch invoice, and harvest season.",
  },
  {
    icon: Leaf,
    title: "2. Zero Synthetic Additives",
    description:
      "We never spray synthetic flavor oils, artificial bergamot, or masking essences. The delicate bouquet in your cup is born purely of cultivar genetics, terroir, and artisan firing.",
  },
  {
    icon: Sparkles,
    title: "3. Rigorous Sensory Cupping",
    description:
      "Every harvest invoice undergoes standardized cupping in white porcelain bowls at our sensory room, evaluating leaf twist, liquor hue, aromatic volatility, and palate balance.",
  },
  {
    icon: Compass,
    title: "4. Equitable Garden Stewardship",
    description:
      "Direct trade ensures partner estates and multi-generational pluckers receive fair compensation that rewards ecological vitality and heirloom bush preservation.",
  },
];

const CUPPING_STAGES = [
  {
    step: "01",
    name: "Dry Leaf Inspection",
    detail: "Appraising whole leaf integrity, tip proportion, twist consistency, and fresh vegetal or malty aroma.",
  },
  {
    step: "02",
    name: "Infused Wet Aroma",
    detail: "Inhaling the warm vapor trapped beneath the porcelain lid to identify floral, fruit, or roasted nuances.",
  },
  {
    step: "03",
    name: "Liquor Hue & Clarity",
    detail: "Observing clarity and depth in pristine white bowls, from champagne pale gold to radiant ruby amber.",
  },
  {
    step: "04",
    name: "Aerated Palate Evaluation",
    detail: "Aspirating liquor with oxygen across taste receptors to measure viscosity, briskness, and lingering finish.",
  },
];

export default function AboutPage() {
  const page = getPageOrDefault("about");
  const siteConfig = getDynamicSiteConfig();

  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: page.title || "About Us", url: "/about" },
  ]);

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "TeaStore",
    name: siteConfig.brand,
    legalName: "Nirva",
    url: "https://teafloww.com",
    logo: "https://teafloww.com/images/logo.png",
    description: siteConfig.description,
    email: "info@teafloww.com",
    telephone: "+91 7001304853",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Shiv Shakti Kali Bari Rd Sukantapally East",
      addressLocality: "Siliguri",
      addressRegion: "West Bengal",
      postalCode: "734005",
      addressCountry: "IN",
    },
  };

  const eyebrow = page.eyebrow || "Provenance · Purity · Siliguri Origin";
  const headline = page.headline || "Direct From the High Himalayas";
  const subtitle =
    page.subtitle ||
    "Bridging high-mountain tea artisans and mindful connoisseurs through radical freshness, verified estate traceability, and zero artificial additions.";

  return (
    <article className="about-page bg-[#fbf8f1] min-h-screen text-[#171713]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14">
        {/* Breadcrumb Navigation */}
        <nav
          className="breadcrumbs flex items-center gap-2 text-xs text-[#63685e] mb-8"
          aria-label="Breadcrumb"
        >
          <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
          <span className="text-[#a59f92]" aria-hidden="true">
            /
          </span>
          <span aria-current="page" className="text-[#18231c] font-semibold">
            {page.title || "About Us"}
          </span>
        </nav>

        {/* Hero Masthead */}
        <header className="mb-12 pb-10 border-b border-[#e4ded0] flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-3xl">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-[#23483a] bg-[#e7eee6] px-3 py-1 rounded-full mb-3">
              {eyebrow}
            </span>
            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-[#171713] leading-[1.12] mb-5">
              {headline}
            </h1>
            <p className="text-lg sm:text-xl text-[#52594e] font-serif italic leading-relaxed">
              {subtitle}
            </p>
          </div>
          <div className="shrink-0 flex items-center justify-center self-start md:self-center">
            <BrandLogo
              variant="badge"
              size={116}
              aria-label={`${siteConfig.brand} Single Estate Seal`}
            />
          </div>
        </header>

        {/* Panoramic Hero Image */}
        <figure className="mb-14">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-[#e4ded0] shadow-sm bg-[#e8e4da]">
            <Image
              src="/images/about/hero-himalayan-dawn.webp"
              alt="Misty Himalayan tea garden terraces at sunrise with Kanchenjunga mountain peaks in background"
              fill
              priority
              className="object-cover transition-transform duration-700 hover:scale-[1.01]"
              sizes="(max-width: 1200px) 100vw, 1200px"
            />
            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 flex flex-wrap items-center gap-2">
              <span className="bg-[#171713]/85 text-[#fbf8f1] backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase border border-white/10"> <StorefrontText id="copy_3a9bc408c6dcf2d9" fallback="Himalayan Foothills Corridor · Siliguri Gateway" /> </span>
              <span className="bg-[#23483a]/90 text-[#fbf8f1] backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-medium border border-white/10 hidden sm:inline-block"> <StorefrontText id="copy_db732604c3c385ef" fallback="0 km from Garden Invoices" /> </span>
            </div>
          </div>
          <figcaption className="mt-2.5 text-xs text-[#70756a] italic"> <StorefrontText id="copy_19019065799e15ef" fallback="Illustrative visual: Dawn breaks across terraced high-mountain gardens in the Himalayan foothills." /> </figcaption>
        </figure>

        {/* Provenance Key Figures Strip */}
        <section
          aria-label="Provenance Highlights"
          className="mb-16 bg-[#f4eee1] rounded-2xl p-6 sm:p-8 border border-[#e8dfcf] shadow-xs"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-[#ded4c0]">
            <div className="pt-3 md:pt-0">
              <span className="block font-serif text-3xl sm:text-4xl text-[#171713] font-bold"> <StorefrontText id="copy_d2912e0f137251ea" fallback="24–48h" /> </span>
              <span className="text-xs uppercase tracking-wider text-[#52594e] font-semibold mt-1 block"> <StorefrontText id="copy_ba88daf29887aac8" fallback="Garden to Seal Window" /> </span>
              <p className="text-xs text-[#6e7368] mt-1 hidden sm:block"> <StorefrontText id="copy_b80a6f8076f6315f" fallback="Preserving volatile aromatics directly at our Siliguri works." /> </p>
            </div>
            <div className="pt-3 md:pt-0 md:pl-4">
              <span className="block font-serif text-3xl sm:text-4xl text-[#171713] font-bold"> <StorefrontText id="copy_6eaf218000e36983" fallback="4 Terroirs" /> </span>
              <span className="text-xs uppercase tracking-wider text-[#52594e] font-semibold mt-1 block"> <StorefrontText id="copy_ebd5de73ad9c08cc" fallback="Signature Growing Origins" /> </span>
              <p className="text-xs text-[#6e7368] mt-1 hidden sm:block"> <StorefrontText id="copy_c4cd60c6f3583864" fallback="Darjeeling, Assam, Kangra, and the Nilgiri Hills." /> </p>
            </div>
            <div className="pt-3 md:pt-0 md:pl-4">
              <span className="block font-serif text-3xl sm:text-4xl text-[#171713] font-bold">
                100%
              </span>
              <span className="text-xs uppercase tracking-wider text-[#52594e] font-semibold mt-1 block"> <StorefrontText id="copy_a4e847bc9cd1ac0c" fallback="Single-Estate Traceability" /> </span>
              <p className="text-xs text-[#6e7368] mt-1 hidden sm:block"> <StorefrontText id="copy_115b8982747b89e5" fallback="Identified by garden, elevation, invoice, and flush date." /> </p>
            </div>
            <div className="pt-3 md:pt-0 md:pl-4">
              <span className="block font-serif text-3xl sm:text-4xl text-[#171713] font-bold">
                0%
              </span>
              <span className="text-xs uppercase tracking-wider text-[#52594e] font-semibold mt-1 block"> <StorefrontText id="copy_cd38d5109992925f" fallback="Synthetic Fragrance Oils" /> </span>
              <p className="text-xs text-[#6e7368] mt-1 hidden sm:block"> <StorefrontText id="copy_1d962736bbaab945" fallback="Pure unadulterated whole-leaf leaf genetics and terroir." /> </p>
            </div>
          </div>
        </section>

        {/* Section 1: The Sourcing Philosophy */}
        <section className="mb-20">
          <div className="max-w-3xl mb-10">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#23483a] block mb-2"> <StorefrontText id="copy_695d4270536d2f39" fallback="Our Sourcing Philosophy" /> </span>
            <h2 className="font-serif text-2xl sm:text-4xl text-[#171713] leading-snug mb-4"> <StorefrontText id="copy_9eb55df16044d538" fallback="A Singular Conviction: Freshness is Non-Negotiable" /> </h2>
            <p className="text-base sm:text-lg text-[#3d433b] leading-relaxed">
              {siteConfig.brand} <StorefrontText id="copy_b806ba8d26c55ae0" fallback="was founded with a straightforward belief: tea tastes extraordinary when it is consumed as close as possible to the mountain soil and garden furnace where it was fired. For generations, commodity trading created an elongated chain of auctions, warehouses, and brokers where tea leaves aged for months before packaging. We replaced that system with a direct garden-to-caddy model rooted right at the foot of the hills." /> </p>
          </div>

          {/* 4 Terroir Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TERROIRS.map((terroir) => (
              <div
                key={terroir.name}
                className="bg-[#fcfaf5] p-6 sm:p-7 rounded-2xl border border-[#ece4d4] hover:border-[#b39156] transition-all hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#b36b3d] bg-[#fbf0e8] px-2.5 py-1 rounded-md">
                      {terroir.badge}
                    </span>
                    <span className="text-xs text-[#63685e] flex items-center gap-1 font-mono">
                      <Mountain size={13} className="text-[#23483a]" />
                      {terroir.elevation}
                    </span>
                  </div>
                  <h3 className="font-serif text-xl sm:text-2xl text-[#171713] font-bold mb-1">
                    {terroir.name}
                    <span className="text-sm font-normal text-[#63685e] ml-2">
                      ({terroir.state})
                    </span>
                  </h3>
                  <p className="text-xs text-[#52594e] italic mb-3">{terroir.profile}</p>
                  <p className="text-sm text-[#3d433b] leading-relaxed mb-4">
                    <strong className="text-[#171713]"> <StorefrontText id="copy_4030b164a3e54408" fallback="Sensory Character:" /> </strong> {terroir.flavor}
                  </p>
                </div>
                <div className="pt-3 border-t border-[#ece4d4] text-xs text-[#52594e] flex items-center justify-between">
                  <span className="font-semibold text-[#23483a]">{terroir.harvest}</span>
                  <Link
                    href={`/shop?origin=${terroir.name.toLowerCase()}`}
                    className="text-[#171713] hover:text-[#b36b3d] font-semibold inline-flex items-center gap-1 transition-colors"
                  > <StorefrontText id="copy_3b73900b8d29f963" fallback="Explore" /> <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: The Siliguri Advantage (Proximity) */}
        <section className="mb-20 bg-[#f7f3ea] rounded-3xl p-6 sm:p-10 lg:p-12 border border-[#e8dfcf]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#23483a] block mb-2"> <StorefrontText id="copy_34d1c640b27c8367" fallback="The Himalayan Gateway" /> </span>
              <h2 className="font-serif text-2xl sm:text-4xl text-[#171713] leading-snug mb-5"> <StorefrontText id="copy_d04fddeae1fdd43b" fallback="Why Siliguri Changes Everything" /> </h2>
              <div className="space-y-4 text-sm sm:text-base text-[#3d433b] leading-relaxed">
                <p> <StorefrontText id="copy_31af9d7a2a2eabe7" fallback="Siliguri sits at the geographic confluence where the steep Himalayan ridges of Darjeeling slope downward to meet the tea plains of the Dooars, Terai, and Assam. Nearly all world-renowned tea passes through this corridor." /> </p>
                <p> <StorefrontText id="copy_7d5255e536fc5709" fallback="Instead of shipping raw tea hundreds of miles across the subcontinent to coastal ports for third-party packaging, our operations are stationed right here at the" /> {" "}
                  <strong> <StorefrontText id="copy_eff61d978eeb67e3" fallback="Fulbari Ghoshpukur Bypass in Siliguri" /> </strong>.
                </p>
                <p> <StorefrontText id="copy_2a186d9f1ce0e995" fallback="When a partner garden completes its artisanal rolling, oxidation, and firing, the lot arrives at our tasting room within hours. Here, volatile monoterpenes—the aromatic compounds responsible for high-altitude muscatel, honey, and floral notes—are hermetically protected in airtight, food-grade caddies." /> </p>
              </div>

              <div className="mt-6 pt-6 border-t border-[#ded4c0] flex flex-wrap items-center gap-4 text-xs text-[#52594e]">
                <span className="flex items-center gap-1.5 font-semibold text-[#171713]">
                  <MapPin size={15} className="text-[#23483a]" /> <StorefrontText id="copy_4846b42d2bce0739" fallback="Works: Fulbari Ghoshpukur Bypass, Siliguri" /> </span>
                <span className="text-[#a59f92]">·</span>
                <span className="flex items-center gap-1.5">
                  <Clock size={15} className="text-[#23483a]" />
                  Cupped &amp; packed within 24–48 hours
                </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-[#ded4c0] shadow-sm bg-[#e8e4da]">
                <Image
                  src="/images/about/siliguri-packaging-craft.webp"
                  alt="TeaFloww luxury green and brushed brass tea canisters with loose leaf orthodox Darjeeling tea on natural linen"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 480px"
                />
              </div>
              <p className="mt-2 text-xs text-[#70756a] italic text-center"> <StorefrontText id="copy_2f95589dc06f6ad4" fallback="Airtight barrier caddies and whole orthodox leaf at our Siliguri facility." /> </p>
            </div>
          </div>
        </section>

        {/* Section 3: The Four Non-Negotiable Standards */}
        <section className="mb-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#23483a] block mb-2"> <StorefrontText id="copy_0a17cc77261a4d16" fallback="The TeaFloww Standard" /> </span>
            <h2 className="font-serif text-2xl sm:text-4xl text-[#171713] leading-snug"> <StorefrontText id="copy_ac728a36a6e23da5" fallback="Truth in Every Single Cup" /> </h2>
            <p className="text-sm sm:text-base text-[#52594e] mt-2"> <StorefrontText id="copy_bd11abfb2e0d9fa3" fallback="Our principles are not marketing claims. They are strict operational controls baked into every purchase order, cupping evaluation, and customer tin." /> </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FOUR_STANDARDS.map((standard) => {
              const IconComponent = standard.icon;
              return (
                <div
                  key={standard.title}
                  className="bg-[#fcfaf5] p-6 rounded-2xl border border-[#ece4d4] flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-[#e7eee6] flex items-center justify-center text-[#23483a] mb-4">
                      <IconComponent size={20} />
                    </div>
                    <h3 className="font-serif text-lg font-bold text-[#171713] mb-2 leading-tight">
                      {standard.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#4a5047] leading-relaxed">
                      {standard.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 4: The Art & Science of Sensory Cupping */}
        <section className="mb-20 bg-[#1d2a24] text-[#f6f1e7] rounded-3xl p-6 sm:p-10 lg:p-12 overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-5 order-2 lg:order-1">
              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-[#141d19]">
                <Image
                  src="/images/about/cupping-laboratory.webp"
                  alt="Tea sommelier cupping bowls with clear golden amber tea liquors, evaluation dishes, and silver spoon"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 480px"
                />
              </div>
              <p className="mt-2.5 text-xs text-[#a9b5ab] italic text-center"> <StorefrontText id="copy_cb73c7382184a35e" fallback="Standardized sensory cupping in white porcelain bowls at our tasting room." /> </p>
            </div>

            <div className="lg:col-span-7 order-1 lg:order-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#d6c8a7] block mb-2"> <StorefrontText id="copy_7400098a093dcbb6" fallback="Sensory Laboratory" /> </span>
              <h2 className="font-serif text-2xl sm:text-4xl text-[#f6f1e7] leading-snug mb-4"> <StorefrontText id="copy_96f419edc3e2b264" fallback="The Science of the Cupping Spoon" /> </h2>
              <p className="text-sm sm:text-base text-[#c7d1c6] leading-relaxed mb-6"> <StorefrontText id="copy_a782a08ba46fa964" fallback="Before any lot is selected for a" /> {siteConfig.brand} <StorefrontText id="copy_82b83d8ac5073a87" fallback="tin, our team conducts a rigorous 4-stage cupping evaluation adapted from international professional tea standards." /> </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CUPPING_STAGES.map((stage) => (
                  <div
                    key={stage.step}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs"
                  >
                    <span className="font-mono text-xs font-bold text-[#d6c8a7] block mb-1">
                      {stage.step}
                    </span>
                    <h3 className="font-serif text-base font-semibold text-white mb-1">
                      {stage.name}
                    </h3>
                    <p className="text-xs text-[#b8c4b7] leading-relaxed">{stage.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: The Pluck — Two Leaves and a Bud */}
        <section className="mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#23483a] block mb-2"> <StorefrontText id="copy_3c1f12ec8d31c7e3" fallback="Artisan Harvesting" /> </span>
              <h2 className="font-serif text-2xl sm:text-4xl text-[#171713] leading-snug mb-4">
                The Sacred Imperial Pluck: Two Leaves &amp; a Bud
              </h2>
              <div className="space-y-4 text-sm sm:text-base text-[#3d433b] leading-relaxed">
                <p> <StorefrontText id="copy_95cde9e585b9aca9" fallback="Orthodox whole-leaf tea is defined by the tender shoot at the crown of the Camellia sinensis bush. Commercial machine harvesting shears leaves indiscriminately, creating shredded stems and bitter dust." /> </p>
                <p> <StorefrontText id="copy_0bac086a7f636993" fallback="By contrast, our partner gardens practice gentle, manual hand-plucking of the top two young leaves and the unopened silver bud. This apical shoot holds the highest concentration of L-theanine, catechins, and essential ethereal oils, resulting in the silky mouthfeel and floral clarity characteristic of premium single-estate tea." /> </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-[#23483a] bg-[#e7eee6] px-3 py-1.5 rounded-full font-semibold">
                  <CheckCircle2 size={13} /> <StorefrontText id="copy_e224ffde79b72d53" fallback="Hand-Plucked Only" /> </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-[#23483a] bg-[#e7eee6] px-3 py-1.5 rounded-full font-semibold">
                  <CheckCircle2 size={13} /> <StorefrontText id="copy_3fdf298a504e9538" fallback="Unopened Silver Bud" /> </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-[#23483a] bg-[#e7eee6] px-3 py-1.5 rounded-full font-semibold">
                  <CheckCircle2 size={13} /> <StorefrontText id="copy_cd3f4afe1933cf3c" fallback="Whole Leaf Orthodox" /> </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-[#ded4c0] shadow-sm bg-[#e8e4da]">
                <Image
                  src="/images/about/two-leaves-and-a-bud.webp"
                  alt="Gentle hands holding fresh two leaves and a bud shoot with morning dew drops in mountain tea garden"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 480px"
                />
              </div>
              <p className="mt-2 text-xs text-[#70756a] italic text-center"> <StorefrontText id="copy_aebc35011d65e26d" fallback="Close-up of the artisanal two leaves and a bud harvest in the morning mist." /> </p>
            </div>
          </div>
        </section>

        {/* Section 6: Bengal Tea Culture & The Adda */}
        <section className="mb-20 bg-[#f4eee1] rounded-3xl p-6 sm:p-10 border border-[#e8dfcf]">
          <div className="max-w-3xl mx-auto text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#b36b3d] block mb-2"> <StorefrontText id="copy_7070dc47f8c547de" fallback="Cultural Heritage" /> </span>
            <h2 className="font-serif text-2xl sm:text-4xl text-[#171713] leading-snug mb-4">
              Rooted in Bengal’s Tea Culture &amp; Daily Adda
            </h2>
            <p className="text-sm sm:text-base text-[#4a5047] leading-relaxed mb-6"> <StorefrontText id="copy_67b6b9dd614d97d7" fallback="In West Bengal, tea is not merely a morning beverage—it is a cultural fabric. It is the spark for unhurried intellectual adda, the warm welcome to an honored guest, and a quiet moment of solitary peace as the afternoon sun casts long shadows over the verandah." /> </p>
            <p className="text-sm sm:text-base text-[#4a5047] leading-relaxed"> <StorefrontText id="copy_1668e64467b50d97" fallback="We celebrate all expressions of this tradition: from brisk CTC brewed with creamy milk and warming crushed ginger, to fragrant Gondhoraj lebu cha in a clear glass, and connoisseur first flush Darjeeling poured gently from a fine porcelain gaiwan." /> </p>
            <div className="mt-6 flex justify-center gap-4">
              <Link
                href="/blog/about-teafloww"
                className="text-xs font-bold uppercase tracking-wider text-[#171713] hover:text-[#b36b3d] underline underline-offset-4"
              >
                Read our Journal: Tea Culture &amp; Bengal →
              </Link>
            </div>
          </div>
        </section>

        {/* Section 7: Verified Corporate Identity & Operational Transparency */}
        <section
          aria-label="Corporate Transparency"
          className="mb-16 bg-white rounded-2xl p-6 sm:p-8 border border-[#e4ded0] shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-[#ece7dc]">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#23483a] block mb-1">
                Verified Entity &amp; Governance
              </span>
              <h2 className="font-serif text-xl sm:text-2xl text-[#171713] font-bold"> <StorefrontText id="copy_b7b3c725812b5c74" fallback="Operational Transparency" /> </h2>
            </div>
            <div className="text-xs text-[#52594e] font-mono bg-[#f7f5f0] px-3 py-1.5 rounded-lg border border-[#ece7dc]"> <StorefrontText id="copy_245b8ecd18f90172" fallback="GSTIN: 19CTHPK8646J2ZY" /> </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs sm:text-sm text-[#4a5047] leading-relaxed">
            <div>
              <strong className="block text-[#171713] mb-1 font-semibold flex items-center gap-1.5">
                <Building2 size={14} className="text-[#23483a]" /> <StorefrontText id="copy_0f2b578f19ce6578" fallback="Corporate Entity" /> </strong>
              <p> <StorefrontText id="copy_21711f067894cf2f" fallback="Nirva (Operating Brand:" /> {siteConfig.brand})</p>
              <p className="mt-1"> <StorefrontText id="copy_f56f0b09eea2a4c0" fallback="Domain: TeaFloww.com" /> </p>
            </div>

            <div>
              <strong className="block text-[#171713] mb-1 font-semibold flex items-center gap-1.5">
                <MapPin size={14} className="text-[#23483a]" /> <StorefrontText id="copy_80b9841c9be54c99" fallback="Registered Office" /> </strong>
              <address className="not-italic text-[#52594e]"> <StorefrontText id="copy_b298b50704b226b3" fallback="Shiv Shakti Kali Bari Rd, Sukantapally East," /> <br /> <StorefrontText id="copy_c9d528f22a35f24b" fallback="Siliguri, West Bengal — 734005, India" /> </address>
            </div>

            <div>
              <strong className="block text-[#171713] mb-1 font-semibold flex items-center gap-1.5">
                <MapPin size={14} className="text-[#23483a]" /> Works &amp; Sourcing Facility
              </strong>
              <address className="not-italic text-[#52594e]"> <StorefrontText id="copy_a507c9224061333e" fallback="00, Fulbari Ghoshpukur Bypass, Fulbari, Binnaguri," /> <br /> <StorefrontText id="copy_801bd7aba94dd0cc" fallback="Dist Jalpaiguri, Siliguri, West Bengal — 734015" /> </address>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-[#ece7dc] flex flex-wrap items-center justify-between gap-4 text-xs text-[#52594e]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Mail size={13} className="text-[#23483a]" />
                <ObfuscatedEmail className="hover:underline text-[#171713]" />
              </span>
              <span className="text-[#a59f92]">·</span>
              <span className="flex items-center gap-1.5">
                <Phone size={13} className="text-[#23483a]" />
                <a href="tel:+917001304853" className="hover:underline text-[#171713]">
                  +91 7001304853
                </a>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/privacy" className="hover:text-[#171713] underline underline-offset-2"> <StorefrontText id="copy_506ff394621596dd" fallback="Privacy Policy" /> </Link>
              <span className="text-[#a59f92]">·</span>
              <Link href="/terms" className="hover:text-[#171713] underline underline-offset-2"> <StorefrontText id="copy_4afa55bf7aec7ddc" fallback="Terms of Service" /> </Link>
              <span className="text-[#a59f92]">·</span>
              <Link href="/shipping" className="hover:text-[#171713] underline underline-offset-2">
                Shipping &amp; Transit
              </Link>
            </div>
          </div>
        </section>

        {/* Bottom Editorial Call to Action */}
        <footer className="mt-14 pt-8 border-t border-[#e4ded0] flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#18231c]">
            <Link
              href="/leaf-to-cup"
              className="hover:text-[#b36b3d] inline-flex items-center gap-1 transition-colors"
            > <StorefrontText id="copy_db3c49f6ee8e2cc7" fallback="Leaf-to-Cup Process Guide →" /> </Link>
            <span className="text-[#a59f92]">·</span>
            <Link
              href="/locations/siliguri"
              className="hover:text-[#b36b3d] inline-flex items-center gap-1 transition-colors"
            > <StorefrontText id="copy_faaa282bc3680e62" fallback="Siliguri Tasting Room →" /> </Link>
            <span className="text-[#a59f92]">·</span>
            <Link
              href="/contact"
              className="hover:text-[#b36b3d] inline-flex items-center gap-1 transition-colors"
            > <StorefrontText id="copy_fa313088d3885f16" fallback="Tasting Inquiries →" /> </Link>
          </div>

          <Link
            href="/shop"
            className="w-full sm:w-auto px-7 py-3 bg-[#1d2a24] text-[#fbf8f1] text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-[#23483a] transition-colors shadow-xs inline-flex items-center justify-center gap-2"
          > <StorefrontText id="copy_389efbf7d8ffad7c" fallback="Explore Current Flushes" /> <ArrowRight size={14} />
          </Link>
        </footer>
      </div>
    </article>
  );
}
