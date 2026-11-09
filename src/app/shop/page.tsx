import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { requestContext } from "@/lib/international/context";
import { localize } from "@/lib/international/translations";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { listProducts } from "@/lib/products";
import { listStorefrontCategories } from "@/lib/storefront";
import { listSliders } from "@/lib/sliders";
import { constructMetadata } from "@/lib/seo/metadata";
import { getCollectionSchema, getBreadcrumbSchema } from "@/lib/seo/schema";
import { ShopExplorer } from "@/components/shop/ShopExplorer";
import { TrustBar } from "@/components/home/TrustBar";
import { NewsletterSection } from "@/components/home/NewsletterSection";

export const dynamic = "force-dynamic";

export const metadata = constructMetadata({
  title: "Fine Tea Collection — Single-Estate Flushes",
  description:
    "Explore pure, single-estate flushes from Darjeeling, Assam, Kangra, and Nilgiri. Graded, cupped, and packaged at origin to preserve high-mountain aromatics.",
  path: "/shop",
  ogImage: "/images/hero-himalayan-tea.jpg",
});

export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    categoryId?: string;
    region?: string;
    flush?: string;
    flavor?: string;
    elevation?: string;
    featured?: string;
    sort?: string;
    view?: string;
  }>;
}) {
  const ctx = await requestContext();
  const params = await searchParams;
  const categories = listStorefrontCategories().map(c => localize(c, `category:${c.id}`, ctx.locale));

  // Load all catalogue products with their full variants and cupping parameters
  const products = listProducts().map(p => localize(p, `product:${p.id}`, ctx.locale));
  const shopSliders = listSliders({ activeOnly: true, pageTarget: "shop" }).map(s => localize(s, `slider:${s.id}`, ctx.locale));
  const collectionJsonLd = getCollectionSchema(
    "Fine Tea Collection",
    "Explore pure, single-estate flushes from Darjeeling, Assam, Kangra, and Nilgiri.",
    "/shop",
    products
  );
  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Shop", url: "/shop" },
  ]);

  return (
    <div className="tf-shop-page-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Screen-reader breadcrumbs for WCAG 2.2 AA accessibility */}
      <nav className="sr-only" aria-label="Breadcrumb">
        <Link href="/"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page"> <StorefrontText id="copy_9e85a7ef54d14494" fallback="Shop Fine Teas" /> </span>
      </nav>

      {/* Main Interactive Catalog Island with Hero Showcase */}
      <main id="catalog-content" className="tf-shop-catalog-main">
        <ShopExplorer
          initialProducts={products}
          categories={categories}
          initialParams={params}
          shopSliders={shopSliders}
        />
      </main>

      {/* Trust & Quality Pillars matching mockup */}
      <TrustBar />

      {/* Newsletter Subscription Banner matching mockup */}
      <NewsletterSection />
    </div>
  );
}
