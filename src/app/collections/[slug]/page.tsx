import React from "react";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { redirect } from "next/navigation";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listProducts } from "@/lib/products";
import { listBlogPosts, getBlogPost } from "@/lib/blogs";
import { constructMetadata } from "@/lib/seo/metadata";
import { getCollectionSchema, getBreadcrumbSchema } from "@/lib/seo/schema";
import { cupsFromGrams } from "@/lib/money";
import { requestContext } from "@/lib/international/context";
import { localize } from "@/lib/international/translations";
import { formatMoney, convertPaise } from "@/lib/international/money";
import { ProductImpression } from "@/components/analytics/ProductImpression";
import { catalogItem } from "@/lib/seo/tracking";

export const dynamic = "force-dynamic";

interface CategoryRecord {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  cover_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_override?: string | null;
  noindex?: number;
  related_blog_slug?: string;
  related_blog_title?: string;
}

const VIRTUAL_COLLECTIONS: Record<string, Partial<CategoryRecord>> = {
  "darjeeling-first-flush": {
    id: 99001,
    name: "Darjeeling First Flush",
    description:
      "Direct-from-origin single-estate first flush orthodox harvests plucked in early spring across high-mountain Darjeeling gardens. Celebrated worldwide for vibrant floral top-notes, delicate muscatel nuances, and a pale luminous liquor.",
    seo_title: "Darjeeling First Flush Tea Collection — Spring Harvest Orthodox Teas",
    seo_description:
      "Shop certified single-estate Darjeeling First Flush orthodox loose-leaf teas direct from Himalayan gardens. Vacuum-sealed at origin in Siliguri.",
    related_blog_slug: "darjeeling-first-flush-guide",
    related_blog_title: "Understanding Darjeeling First Flush: Elevation, Clonal Bushes, and Spring Aromatics",
  },
  "black-tea": {
    id: 99002,
    name: "Reserve Black Teas",
    description:
      "Full-bodied orthodox and specialty whole-leaf black teas from Darjeeling, Assam, and Himalayan foothills. Graded for brisk strength, rich malt, and amber depth.",
    seo_title: "Orthodox Black Tea Collection — Single-Estate Darjeeling & Assam",
    seo_description:
      "Explore premium single-estate orthodox black teas direct from Himalayan gardens. Certified lot provenance and origin sealed.",
    related_blog_slug: "how-to-brew-assam-tea",
    related_blog_title: "How to Brew Assam Orthodox Tea: Water Temperature, Leaf Dose, and Infusion Timing",
  },
  "green-tea": {
    id: 99003,
    name: "Green & White Teas",
    description:
      "Hand-plucked high-mountain green and imperial white orthodox teas. Lightly steamed and pan-fired to lock in vital polyphenols, crisp vegetal top-notes, and clean clarity.",
    seo_title: "Single-Estate Green & White Tea Collection — Himalayan Orthodox Harvests",
    seo_description:
      "Pure single-estate green and white teas from Nilgiri, Kangra, and Darjeeling. Rich in natural antioxidants and delicate sweetness.",
    related_blog_slug: "orthodox-vs-ctc-tea",
    related_blog_title: "Orthodox vs. CTC Tea: Manufacturing, Flavour Profiles, and Terroir Expression",
  },
  "white-tea": {
    id: 99004,
    name: "Imperial White Teas",
    description:
      "Rare silver needles and imperial white peony teas harvested exclusively at dawn. Naturally sun-withered to retain tender downy buds and honeyed meadow aromatics.",
    seo_title: "Imperial White Tea Collection — Silver Needles & White Peony",
    seo_description:
      "Exquisite hand-plucked Himalayan white teas. Minimal processing, unblended whole leaf buds direct from origin in Siliguri.",
    related_blog_slug: "tea-cupping-guide",
    related_blog_title: "Professional Tea Cupping: How to Evaluate Dry Leaf, Liquor Clarity, and Wet Leaf Aromatics",
  },
  "oolong-tea": {
    id: 99005,
    name: "High Mountain Oolong Teas",
    description:
      "Artisanal semi-oxidized high-elevation oolongs exhibiting intricate transitions from honeyed orchid florals to toasted peach wood and roasted nut undertones.",
    seo_title: "High Mountain Oolong Tea Collection — Artisanal Orthodox Harvests",
    seo_description:
      "Discover artisanal Himalayan oolongs hand-crafted at high elevation partner estates in Darjeeling and Kurseong.",
    related_blog_slug: "orthodox-vs-ctc-tea",
    related_blog_title: "Orthodox vs. CTC Tea: Manufacturing, Flavour Profiles, and Terroir Expression",
  },
  "everyday-milk-chai": {
    id: 99006,
    name: "Everyday Milk Chai",
    description:
      "Robust CTC and orthodox blends crafted specifically for authentic Indian milk chai. Bold, brisk, rich in color, and naturally harmonious with ginger and cardamom.",
    seo_title: "Everyday Milk Chai Collection — Strong Kadak Tea Leaves",
    seo_description:
      "Shop everyday strong milk chai, elaichi tea, and spiced masala chai blends direct from Bengal gardens.",
    related_blog_slug: "how-to-brew-milk-chai",
    related_blog_title: "How to Make Strong Milk Chai at Home: A Practical Guide",
  },
  "chai": {
    id: 99007,
    name: "Chai & Spiced Blends",
    description:
      "Signature single-estate CTC and whole-spice milk chai blends crafted with real crushed cardamom, ginger, cinnamon, and golden orthodox tips.",
    seo_title: "Chai & Spiced Blends — Authentic Indian Tea Leaves",
    seo_description:
      "Authentic Indian milk chai blends and CTC teas direct from North Bengal tea gardens.",
    related_blog_slug: "how-to-brew-milk-chai",
    related_blog_title: "How to Make Strong Milk Chai at Home: A Practical Guide",
  },
  "bengal-signature-blends": {
    id: 99008,
    name: "Bengal Signature Blends",
    description:
      "Innovative terroir-inspired infusions celebrating Bengal culture: Gondhoraj lebu, Nolen gur, Panch phoron, and Meetha paan aromatics.",
    seo_title: "Bengal Signature Blends — Gondhoraj, Nolen Gur, & Paan Inspired Teas",
    seo_description:
      "Distinctive Bengal heritage tea blends combining high-mountain orthodox tea with authentic culinary notes.",
    related_blog_slug: "gondhoraj-lebu-cha-guide",
    related_blog_title: "Gondhoraj Lebu Cha: How Bengal’s Aromatic Lemon Tea Works",
  },
  "regional-tea-origins": {
    id: 99009,
    name: "Regional Tea Origins",
    description:
      "Single-origin orthodox and CTC teas celebrating the distinct terroirs of Darjeeling, Assam, Dooars, and Nilgiri.",
    seo_title: "Regional Tea Origins — Darjeeling, Assam, Dooars & Nilgiri",
    seo_description:
      "Discover terroir-driven regional loose leaf teas direct from small Himalayan tea makers.",
    related_blog_slug: "dooars-vs-assam-vs-darjeeling-tea",
    related_blog_title: "Dooars vs Assam vs Darjeeling Tea: Which Cup Suits You?",
  },
};

function findCategory(slug: string): CategoryRecord | null {
  const normalized = slug.trim().toLowerCase();

  // 1. Direct database match
  try {
    const db = getDb();
    let cat = db
      .prepare("SELECT * FROM categories WHERE slug = ? AND is_active = 1")
      .get(normalized) as CategoryRecord | undefined;

    // Try matching with suffix "-tea" or "-teas" stripped
    if (!cat && (normalized.endsWith("-tea") || normalized.endsWith("-teas"))) {
      const base = normalized.replace(/-teas?$/, "");
      cat = db
        .prepare("SELECT * FROM categories WHERE (slug = ? OR slug = ?) AND is_active = 1")
        .get(base, `${base}-tea`) as CategoryRecord | undefined;
    }

    // Try matching with prefix "reserve-" stripped
    if (!cat && normalized.startsWith("reserve-")) {
      const base = normalized.replace(/^reserve-/, "").replace(/-teas?$/, "");
      cat = db
        .prepare("SELECT * FROM categories WHERE (slug = ? OR slug = ?) AND is_active = 1")
        .get(base, `${base}-tea`) as CategoryRecord | undefined;
    }

    // Fallback: match by lower(name)
    if (!cat) {
      const nameGuess = normalized.replace(/-/g, " ");
      cat = db
        .prepare("SELECT * FROM categories WHERE (LOWER(name) = ? OR LOWER(name) = ?) AND is_active = 1")
        .get(normalized, nameGuess) as CategoryRecord | undefined;
    }

    // Match inactive categories if active was not found
    if (!cat) {
      const stripped = normalized.replace(/-teas?$/, "").replace(/^reserve-/, "");
      cat = db
        .prepare("SELECT * FROM categories WHERE slug = ? OR slug = ? OR slug = ? OR LOWER(name) = ?")
        .get(normalized, stripped, `${stripped}-tea`, normalized) as CategoryRecord | undefined;
    }

    if (cat) return cat;
  } catch {
    /* fallback to virtual */
  }

  // 2. Curated Virtual Collections (guarantees known tea flushes and categories never 404)
  const lookupKey = normalized.replace(/^reserve-/, "").replace(/-teas$/, "-tea");
  if (VIRTUAL_COLLECTIONS[normalized] || VIRTUAL_COLLECTIONS[lookupKey]) {
    const vc = VIRTUAL_COLLECTIONS[normalized] || VIRTUAL_COLLECTIONS[lookupKey];
    return {
      id: vc.id ?? 99000,
      slug: normalized,
      name: vc.name || normalized.replace(/-/g, " "),
      description: vc.description,
      seo_title: vc.seo_title,
      seo_description: vc.seo_description,
      related_blog_slug: vc.related_blog_slug,
      related_blog_title: vc.related_blog_title,
      is_active: 1,
    } as CategoryRecord;
  }

  // 3. Match against products catalogue
  try {
    const allProducts = listProducts();
    const queryTerm = normalized.replace(/-/g, " ");
    const matching = allProducts.filter((p) => {
      return (
        (p.category && p.category.toLowerCase().includes(queryTerm)) ||
        (p.origin && p.origin.toLowerCase().includes(queryTerm)) ||
        (p.flush && p.flush.toLowerCase().includes(queryTerm)) ||
        (p.estate && p.estate.toLowerCase().includes(queryTerm)) ||
        p.slug.toLowerCase().includes(normalized)
      );
    });

    if (matching.length > 0) {
      const readable = normalized
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return {
        id: 99050,
        slug: normalized,
        name: readable,
        description: `Hand-selected ${readable} orthodox tea harvests direct from Himalayan estates. Vacuum-sealed at origin in Siliguri.`,
        seo_title: `${readable} Tea Collection — Himalayan Orthodox Harvests`,
        seo_description: `Shop premium single-estate ${readable} teas. Graded and packed at origin.`,
        is_active: 1,
      } as CategoryRecord;
    }
  } catch {
    /* ignore */
  }

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await requestContext();
  const rawCat = findCategory(slug);

  if (!rawCat) {
    return constructMetadata({
      title: "Fine Tea Catalog — Single-Estate Orthodox Harvests",
      description: "Explore premium single-estate orthodox teas from the Himalayas. Certified garden provenance and fresh lot cupping scores.",
      path: `/shop?q=${encodeURIComponent(slug.replace(/-/g, " "))}`,
      locale: ctx.locale,
    });
  }

  const cat = localize(rawCat, `category:${rawCat.id}`, ctx.locale);

  return constructMetadata({
    title: cat.seo_title || `${cat.name} Tea Collection — Single-Estate Orthodox Harvests`,
    description:
      cat.seo_description ||
      cat.description ||
      `Explore premium single-estate ${cat.name} orthodox teas from the Himalayas. Certified garden provenance and fresh lot cupping scores.`,
    path: `/collections/${cat.slug}`,
    ogImage: cat.cover_image_url || null,
    canonicalOverride: cat.canonical_override,
    noindex: Boolean(cat.noindex),
    locale: ctx.requestedLocale || "en",
    resource: `category:${rawCat.id}`,
  });
}

export default async function CategoryCollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requestContext();
  const rawCat = findCategory(slug);

  if (!rawCat) {
    // Graceful seamless redirect to shop with customer search query instead of a 404
    redirect(`/shop?q=${encodeURIComponent(slug.replace(/-/g, " "))}`);
  }

  const cat = localize(rawCat, `category:${rawCat.id}`, ctx.locale);

  // Find all products for this category or collection
  const allProducts = listProducts();
  const normalizedSlug = rawCat.slug.toLowerCase();
  const catProducts = allProducts
    .filter((p) => {
      if (rawCat.id > 0 && rawCat.id < 99000 && p.category_id === rawCat.id) return true;
      if (p.category && p.category.toLowerCase() === rawCat.name.toLowerCase()) return true;
      if (p.category && p.category.toLowerCase() === rawCat.slug.toLowerCase()) return true;
      if (normalizedSlug.includes("first-flush") && p.flush.toLowerCase().includes("first flush")) return true;
      if (normalizedSlug.includes("darjeeling") && (p.origin.toLowerCase().includes("darjeeling") || p.estate.toLowerCase().includes("darjeeling"))) return true;
      if (normalizedSlug.includes("black") && p.category.toLowerCase().includes("black")) return true;
      if (normalizedSlug.includes("green") && p.category.toLowerCase().includes("green")) return true;
      if (normalizedSlug.includes("white") && p.category.toLowerCase().includes("white")) return true;
      if (normalizedSlug.includes("oolong") && p.category.toLowerCase().includes("oolong")) return true;
      if (normalizedSlug.includes("chai") && (p.category.toLowerCase().includes("chai") || p.name.toLowerCase().includes("chai"))) return true;
      return false;
    })
    .map(p => localize(p, `product:${p.id}`, ctx.locale));

  // Find related blog post for editorial & educational linking
  let relatedBlog: { slug: string; title: string; summary?: string | null; excerpt?: string | null } | null = null;
  if (rawCat.related_blog_slug) {
    const post = getBlogPost(rawCat.related_blog_slug);
    if (post && post.status === "published") {
      relatedBlog = post;
    }
  }
  if (!relatedBlog) {
    try {
      const recentBlogs = listBlogPosts({ status: "published", limit: 12 });
      const match = recentBlogs.find(
        (b) =>
          b.slug.includes(normalizedSlug) ||
          b.title.toLowerCase().includes(rawCat.name.toLowerCase()) ||
          (normalizedSlug.includes("first-flush") && b.slug.includes("first-flush")) ||
          (normalizedSlug.includes("black") && (b.slug.includes("assam") || b.slug.includes("orthodox"))) ||
          (normalizedSlug.includes("chai") && b.slug.includes("chai"))
      );
      if (match) relatedBlog = match;
    } catch {
      /* ignore */
    }
  }

  const collectionJsonLd = getCollectionSchema(
    `${cat.name} Tea`,
    cat.description || `Single-estate ${cat.name} tea collection from Darjeeling and the Himalayan foothills.`,
    `/collections/${cat.slug}`,
    catProducts
  );

  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Teas", url: "/shop" },
    { name: `${cat.name} Tea`, url: `/collections/${cat.slug}` },
  ]);

  return (
    <div className="container page-shell max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Engine Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Accessible Breadcrumb Navigation */}
      <nav className="breadcrumbs flex items-center gap-1.5 text-xs text-[#63685e] mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <Link href="/shop" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_9155590820cd9e0b" fallback="Teas" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <span aria-current="page" className="text-[#18231c] font-semibold">
          {cat.name} <StorefrontText id="copy_017979e8299034d8" fallback="Tea" /> </span>
      </nav>

      {/* Category Header */}
      <header className="mb-10 text-center max-w-3xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#2c4e38] block mb-2"> <StorefrontText id="copy_0a23bcc462c8a513" fallback="Origin Collection" /> </span>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#18231c] mb-4 tracking-tight">
          {cat.name} <StorefrontText id="copy_017979e8299034d8" fallback="Tea" /> </h1>
        <p className="text-base sm:text-lg text-[#52594e] leading-relaxed">
          {cat.description ||
            `Hand-selected ${cat.name.toLowerCase()} orthodox teas harvested at high elevation across our partner estates. Each batch is vacuum-sealed at origin to preserve volatile top-notes.`}
        </p>
      </header>

      {/* Products Grid */}
      {catProducts.length === 0 ? (
        <div className="text-center py-16 bg-[#f7f5f0] rounded-xl border border-[#ece7dc]">
          <p className="text-lg text-[#52594e] mb-4"> <StorefrontText id="copy_01702863d234fbab" fallback="Currently curating fresh flushes for this collection." /> </p>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center px-6 py-2.5 bg-[#18231c] text-[#fbf9f4] text-sm font-semibold rounded-md hover:bg-[#2c4e38] transition-colors"
          > <StorefrontText id="copy_3dbb250d14ab7c9c" fallback="Browse Full Tea Catalog" /> </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {catProducts.map((product) => {
            const minPrice =
              product.variants.length > 0
                ? Math.min(...product.variants.map((v) => v.price_paise))
                : 0;
            const primaryVariant = product.variants[0];
            const cups = primaryVariant ? cupsFromGrams(primaryVariant.grams) : 0;
            const imgUrl =
              product.primary_image?.url ||
              product.primary_image_url ||
              "/images/product-darjeeling-tin.jpg";

            return (
              <article
                key={product.id}
                className="bg-white rounded-lg border border-[#e4ded0] overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                <ProductImpression item={catalogItem(product, primaryVariant)} list={`Collection: ${cat.name}`} />
                <Link
                  href={`/tea/${product.slug}`}
                  className="relative aspect-4/3 w-full bg-[#f4f1ea] block overflow-hidden"
                >
                  <Image
                    src={imgUrl}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-2.5 left-2.5 bg-[#18231c]/80 backdrop-blur-xs text-[#fbf9f4] text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-xs">
                    {product.flush}
                  </div>
                </Link>

                <div className="p-5 flex flex-col flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#5a6655] mb-1 line-clamp-2 min-h-[2.6em] h-[2.6em] overflow-hidden">
                    {product.estate} · {product.origin}
                  </div>
                  <h2 className="font-serif text-lg text-[#18231c] mb-2 font-bold line-clamp-2 min-h-[2.6em] h-[2.6em] overflow-hidden">
                    <Link
                      href={`/tea/${product.slug}`}
                      className="hover:text-[#2c4e38] transition-colors block line-clamp-2"
                    >
                      {product.name}
                    </Link>
                  </h2>
                  <p className="text-xs text-[#52594e] line-clamp-2 min-h-[2.8em] h-[2.8em] overflow-hidden mb-4 flex-1">
                    {product.description}
                  </p>

                  <div className="pt-3 border-t border-[#f0ede6] flex items-center justify-between mt-auto">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-xs text-[#73786f]"> <StorefrontText id="copy_218197693424e015" fallback="From" /> </span>
                      <span className="font-semibold text-base text-[#18231c]">
                        {formatMoney(ctx.rates[ctx.currency] ? convertPaise(minPrice, ctx.rates[ctx.currency], ctx.currency, ctx.fxMarkupBps, ctx.roundingMinor) : minPrice, ctx.currency, ctx.locale)}
                      </span>
                      {primaryVariant?.compare_at_price_paise && primaryVariant.compare_at_price_paise > minPrice ? (
                        <>
                          <del
                            className="text-xs text-[#8b9285] line-through font-medium"
                            aria-label={`Original price ${formatMoney(ctx.rates[ctx.currency] ? convertPaise(primaryVariant.compare_at_price_paise, ctx.rates[ctx.currency], ctx.currency, ctx.fxMarkupBps, ctx.roundingMinor) : primaryVariant.compare_at_price_paise, ctx.currency, ctx.locale)}`}
                          >
                            {formatMoney(ctx.rates[ctx.currency] ? convertPaise(primaryVariant.compare_at_price_paise, ctx.rates[ctx.currency], ctx.currency, ctx.fxMarkupBps, ctx.roundingMinor) : primaryVariant.compare_at_price_paise, ctx.currency, ctx.locale)}
                          </del>
                          <span
                            className="text-[10px] font-bold text-[#1d5f38] bg-[#e8f5ec] border border-[#c3e5cd] px-1.5 py-0.5 rounded-xs"
                            aria-label={`${Math.round(((primaryVariant.compare_at_price_paise - minPrice) / primaryVariant.compare_at_price_paise) * 100)} percent off`}
                          >
                            {Math.round(((primaryVariant.compare_at_price_paise - minPrice) / primaryVariant.compare_at_price_paise) * 100)} <StorefrontText id="copy_d892cb05720ec3ad" fallback="% OFF" /> </span>
                        </>
                      ) : null}
                      {cups > 0 && (
                        <span className="text-[11px] text-[#73786f] ml-1.5">
                          (~{cups} <StorefrontText id="copy_6e868d2a7f1844fd" fallback="cups)" /> </span>
                      )}
                    </div>
                    <Link
                      href={`/tea/${product.slug}`}
                      className="text-xs font-bold text-[#18231c] hover:text-[#2c4e38] underline underline-offset-4"
                    > <StorefrontText id="copy_d055df59375e495c" fallback="View Batch Details →" /> </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {/* Educational & Brewing Guide Link from Blog */}
      {relatedBlog && (
        <section className="mt-14 pt-8 border-t border-[#ece7dc]" aria-label="Journal and brewing guides">
          <div className="bg-[#fcfaf7] border border-[#e6dfd1] rounded-xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-[#2c4e38] block mb-1">
                <StorefrontText id="collection_journal_guide_tag" fallback="Tea Journal & Brewing Guide" />
              </span>
              <h3 className="font-serif text-xl sm:text-2xl text-[#18231c] font-bold mb-2">
                {relatedBlog.title}
              </h3>
              <p className="text-sm text-[#52594e] max-w-2xl">
                {relatedBlog.summary || relatedBlog.excerpt || "Learn more about the harvest terroir, brewing parameters, and cupping profile in our tea journal."}
              </p>
            </div>
            <Link
              href={`/blog/${relatedBlog.slug}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2c4e38] text-white text-xs font-semibold uppercase tracking-wider rounded-md hover:bg-[#18231c] transition-colors whitespace-nowrap"
            >
              <span><StorefrontText id="collection_read_article_btn" fallback="Read Article" /></span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
