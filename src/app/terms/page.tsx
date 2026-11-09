import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema } from "@/lib/seo/schema";
import { getDynamicSiteConfig } from "@/lib/seo/site";
import { getPageOrDefault } from "@/lib/pages";
import { requestContext } from "@/lib/international/context";
import { localize } from "@/lib/international/translations";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const ctx = await requestContext();
  const rawPage = getPageOrDefault("terms");
  const resource = rawPage.id ? `page:${rawPage.id}` : "page:terms";
  const page = localize(rawPage, resource, ctx.locale);
  const siteConfig = getDynamicSiteConfig();
  return constructMetadata({
    title: page.meta_title || `Terms of Service — Orders, Currency & Sourcing Contracts · ${siteConfig.name}`,
    description:
      page.meta_description ||
      `Review legal terms, order processing conditions, and policies for ${siteConfig.name}.`,
    path: "/terms",
    locale: ctx.requestedLocale || ctx.locale,
    resource,
  });
}

export default async function TermsPage() {
  const ctx = await requestContext();
  const rawPage = getPageOrDefault("terms");
  const resource = rawPage.id ? `page:${rawPage.id}` : "page:terms";
  const page = localize(rawPage, resource, ctx.locale);
  const siteConfig = getDynamicSiteConfig();
  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: page.title || "Terms of Service", url: "/terms" },
  ]);

  const eyebrow = page.eyebrow || "Customer Agreement";
  const headline = page.headline || "Terms of Service";

  return (
    <div className="container page-shell max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav className="breadcrumbs flex items-center gap-1.5 text-xs text-[#63685e] mb-8" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <span aria-current="page" className="text-[#18231c] font-semibold">
          {page.title || "Terms of Service"}
        </span>
      </nav>

      <header className="mb-12 pb-8 border-b border-[#e4ded0]">
        <span className="text-xs font-bold uppercase tracking-widest text-[#2c4e38] block mb-2">
          {eyebrow}
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#18231c] leading-tight mb-4">
          {headline}
        </h1>
        <p className="text-sm text-[#52594e]"> <StorefrontText id="copy_5626bf367e8c3a0c" fallback="Governing Law: West Bengal, India · Currency:" /> {siteConfig.currency} ({siteConfig.currencySymbol})
        </p>
      </header>

      <div className="space-y-8 text-[#3d433b] text-base leading-relaxed">
        {page.body_markdown && (
          <div className="whitespace-pre-line text-[#3d433b]">{page.body_markdown}</div>
        )}

        <section>
          <h2 className="font-serif text-xl font-bold text-[#18231c] mb-2">
            1. Ordering &amp; Contract Formation
          </h2>
          <p> <StorefrontText id="copy_2a73128081ad21c6" fallback="By placing an order through" /> {siteConfig.name} <StorefrontText id="copy_b1b334bc8487663e" fallback=", you confirm that you are at least 18 years of age and authorized to transact using the selected payment instrument. An order constitutes an offer to purchase tea harvest products; contract acceptance occurs when a confirmation and dispatch notice is issued by our Siliguri operations desk." /> </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-[#18231c] mb-2">
            2. Pricing, Taxes &amp; Currency
          </h2>
          <p> <StorefrontText id="copy_0165ce9a719b041e" fallback="All prices displayed on this storefront are quoted in" /> {siteConfig.currency} ({siteConfig.currencySymbol} <StorefrontText id="copy_5f4887b52c247e3f" fallback=") and include applicable Goods and Services Tax (GST). Delivery charges are calculated and clearly shown prior to order confirmation based on cart value and destination pin code." /> </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-[#18231c] mb-2">
            3. Harvest Authenticity &amp; Disclosures
          </h2>
          <p> <StorefrontText id="copy_6ce633bfae150414" fallback="We guarantee single-estate authenticity for all lots cataloged under estate names. Because orthodox tea is a natural harvest product dependent on seasonal microclimates, liquor hue and volatile aroma notes may exhibit subtle, natural variation between flushes and invoices." /> </p>
        </section>
      </div>
    </div>
  );
}
