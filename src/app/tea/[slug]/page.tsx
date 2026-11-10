import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { requestContext } from "@/lib/international/context";
import { localize } from "@/lib/international/translations";
import { notFound } from "next/navigation";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/products";
import { getProductImages } from "@/lib/storefront";
import { constructMetadata } from "@/lib/seo/metadata";
import { getProductSchema, getBreadcrumbSchema } from "@/lib/seo/schema";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/adminSessions";
import { VariantPicker } from "@/components/VariantPicker";
import { ProductGallery } from "@/components/ProductGallery";
import { PDPInteractiveTabs } from "@/components/PDPInteractiveTabs";
import { StickyPurchaseBar } from "@/components/StickyPurchaseBar";
import { PDPTracker } from "@/components/analytics/PDPTracker";
import { ProductDossierPdf } from "@/components/pdp/ProductDossierPdf";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await requestContext();
  const original = getProductBySlug(slug);
  const p = original ? localize(original, `product:${original.id}`, ctx.locale) : null;
  if (!p) {
    return constructMetadata({
      title: "Tea Not Found",
      description: "The requested orthodox tea could not be located in our garden catalogue.",
      path: `/tea/${slug}`,
      noindex: true,
    });
  }

  if (p.is_enabled === 0 || p.status === "draft" || p.status === "archived") {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    const admin = sessionCookie ? verifySessionValue(sessionCookie) : null;
    if (!admin) {
      return constructMetadata({
        title: "Tea Not Found",
        description: "The requested orthodox tea could not be located in our garden catalogue.",
        path: `/tea/${slug}`,
        noindex: true,
      });
    }
  }

  const primaryImg = p.primary_image?.url || p.primary_image_url || null;

  return constructMetadata({
    title: p.seo_title || p.name,
    description: p.seo_description || p.description,
    path: `/tea/${p.slug}`,
    ogImage: primaryImg,
    canonicalOverride: p.canonical_override,
    noindex: p.is_enabled === 0 || p.status !== "published" || Boolean(p.noindex),
    locale: ctx.requestedLocale || "en",
    resource: `product:${p.id}`,
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requestContext();
  const original = getProductBySlug(slug);
  const p = original ? localize(original, `product:${original.id}`, ctx.locale) : null;
  if (!p) notFound();

  let isDraftPreview = false;
  if (p.is_enabled === 0 || p.status === "draft" || p.status === "archived") {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    const admin = sessionCookie ? verifySessionValue(sessionCookie) : null;
    if (!admin) {
      notFound();
    }
    isDraftPreview = true;
  }

  const images = getProductImages(p.id);
  const productJsonLd = getProductSchema(p, p.variants, images);
  const categorySlug = p.category
    ? p.category.toLowerCase().replace(/&/g, "").replace(/\s+/g, "-").replace(/--+/g, "-").replace(/^-|-$/g, "")
    : "";
  const categoryCrumbUrl = categorySlug ? `/collections/${categorySlug}` : "/shop";
  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Teas", url: "/shop" },
    { name: `${p.category} Tea`, url: categoryCrumbUrl },
    { name: p.name, url: `/tea/${p.slug}` },
  ]);

  return (
    <div className="container page-shell pdp-editorial max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {isDraftPreview && (
        <div className="mb-4 rounded-md bg-[#fff8e1] border border-[#f0dfaa] p-3 text-xs text-[#7c5e10] flex items-center justify-between">
          <span>
            <strong> <StorefrontText id="copy_214ff3d3b00f9e4b" fallback="Draft Preview:" /> </strong> <StorefrontText id="copy_4d0407e170a554ca" fallback="This product is currently" /> {p.is_enabled === 0 ? "disabled" : `in ${p.status} status`} <StorefrontText id="copy_526e101444566abf" fallback="and is not visible to public storefront visitors." /> </span>
          <span className="font-semibold uppercase tracking-wider text-[10px] bg-[#f0dfaa] px-2 py-0.5 rounded">
            {p.status}
          </span>
        </div>
      )}
      {/* Search Engine & Merchant Structured Data */}
      <PDPTracker product={p} variant={p.variants[0]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* 1. Accessible Breadcrumb Navigation */}
      <nav className="breadcrumbs flex items-center gap-1.5 text-xs text-[#63685e] mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <Link href="/shop" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_9155590820cd9e0b" fallback="Teas" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <Link
          href={`/shop?category=${encodeURIComponent(p.category)}`}
          className="hover:text-[#18231c] transition-colors"
        >
          {p.category} <StorefrontText id="copy_017979e8299034d8" fallback="Tea" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <span aria-current="page" className="text-[#18231c] font-semibold truncate max-w-xs sm:max-w-md">
          {p.name}
        </span>
      </nav>

      {/* 2. Responsive Hero Section (Two-Column Desktop Grid) */}
      <div className="pdp-grid grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-12" data-testid="pdp-grid">
        {/* Left Column: Multi-Image Hero Gallery (5 vertical thumbnails + large hero) */}
        <div className="w-full min-w-0">
          <ProductGallery
            productName={p.name}
            flush={p.flush}
            category={p.category}
            images={images}
            productId={p.id}
            defaultVariantSku={p.variants[0]?.sku}
            defaultPackagingFormat={p.variants[0]?.packaging_format}
            variants={p.variants}
          />
        </div>

        {/* Right Column: Editorial Details & Buy Box */}
        <div className="pdp-details w-full min-w-0 flex flex-col justify-start">
          {/* Sourcing Eyebrow Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <span className="inline-block text-[10px] font-bold tracking-[0.16em] uppercase text-[#5a6655] bg-[#ece7dc] px-2.5 py-0.5 rounded-xs">
              {p.flush} · {p.category}
            </span>
            <span className="eyebrow text-xs font-bold text-[#5a6655] uppercase tracking-wider hidden" data-testid="eyebrow">
              {p.origin} · {p.flush}
            </span>
          </div>

          {/* Primary H1 Product Title */}
          <h1 className="font-serif text-3xl md:text-4xl lg:text-[40px] leading-tight text-[#18231c] tracking-tight mb-2">
            {p.name}
          </h1>


          {/* Narrative Editorial Description */}
          <p className="pdp-description text-sm text-[#4a5047] leading-relaxed mb-3.5 font-normal" data-testid="pdp-description">
            {p.description}
          </p>

          {/* Sourced Ingredients */}
          {p.ingredients ? (
            <p className="text-xs text-[#555850] mb-3 leading-normal" data-testid="pdp-ingredients">
              <strong className="text-[#18231c]"> <StorefrontText id="copy_181b526eb39cac0d" fallback="Ingredients:" /> </strong>
              {p.ingredients}
            </p>
          ) : null}

          {/* Tasting Notes */}
          <p className="pdp-notes text-xs font-bold tracking-widest text-[#2c4e38] uppercase mb-4" data-testid="pdp-notes">
            {p.tasting_notes.toUpperCase()}
          </p>

          {/* Official Estate Batch Dossier & Certification PDF */}
          {p.pdf_url ? (
            <ProductDossierPdf
              pdfUrl={p.pdf_url}
              pdfTitle={p.pdf_title}
              productName={p.name}
              estate={p.estate}
              flush={p.flush}
              lotNumber={p.lot_number}
              harvestDate={p.harvest_date}
            />
          ) : null}

          {/* Interactive Variant Picker & Hero Purchase Container */}
          <VariantPicker product={p} />
        </div>
      </div>

      {/* 3. Five Value Proposition Highlights Strip */}


      {/* 4. Interactive Connoisseur Experience (Cupping Profile, Steeping Guide, Estate Terroir) */}
      {p.ingredients && <section className="container" aria-label="Ingredients" style={{ paddingBlock: 24 }}>
        <h2 className="font-serif text-2xl">Ingredients</h2><p>{p.ingredients}</p>
      </section>}
      <PDPInteractiveTabs product={p} images={images} />

      {/* 5. Recommendations Carousel / Grid */}


      {/* 6. Scroll-Triggered Sticky Bottom Purchase Bar */}
      <StickyPurchaseBar product={p} />
    </div>
  );
}
