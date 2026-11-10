import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { notFound } from "next/navigation";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listProducts } from "@/lib/products";
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
}

function findCategory(slug: string): CategoryRecord | null {
  const db = getDb();
  const normalized = slug.trim().toLowerCase();
  
  // Try direct slug match
  let cat = db
    .prepare("SELECT * FROM categories WHERE slug = ? AND is_active = 1")
    .get(normalized) as CategoryRecord | undefined;

  // Try matching with suffix "-tea" stripped (e.g. "black-tea" -> "black")
  if (!cat && normalized.endsWith("-tea")) {
    const base = normalized.replace(/-tea$/, "");
    cat = db
      .prepare("SELECT * FROM categories WHERE slug = ? AND is_active = 1")
      .get(base) as CategoryRecord | undefined;
  }

  // Fallback: match by lower(name)
  if (!cat) {
    cat = db
      .prepare("SELECT * FROM categories WHERE LOWER(name) = ? AND is_active = 1")
      .get(normalized) as CategoryRecord | undefined;
  }

  return cat || null;
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
      title: "Collection Not Found",
      description: "The requested tea collection does not exist in our catalog.",
      path: `/collections/${slug}`,
      noindex: true,
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
  if (!rawCat) notFound();
  const cat = localize(rawCat, `category:${rawCat.id}`, ctx.locale);

  // Find all products for this category
  const allProducts = listProducts();
  const catProducts = allProducts
    .filter(
      (p) =>
        p.category_id === rawCat.id ||
        p.category.toLowerCase() === rawCat.name.toLowerCase() ||
        p.category.toLowerCase() === rawCat.slug.toLowerCase()
    )
    .map(p => localize(p, `product:${p.id}`, ctx.locale));

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
    </div>
  );
}
