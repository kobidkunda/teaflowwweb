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
  const rawPage = getPageOrDefault("returns");
  const resource = rawPage.id ? `page:${rawPage.id}` : "page:returns";
  const page = localize(rawPage, resource, ctx.locale);
  const siteConfig = getDynamicSiteConfig();
  return constructMetadata({
    title: page.meta_title || `Returns & Freshness Guarantee Policy · ${siteConfig.name}`,
    description:
      page.meta_description ||
      `Review our ${siteConfig.returns.windowDays}-day freshness and transit damage guarantee. Hassle-free replacements and refunds for ${siteConfig.name} customers.`,
    path: "/returns",
    locale: ctx.requestedLocale || ctx.locale,
    resource,
  });
}

export default async function ReturnsPage() {
  const ctx = await requestContext();
  const rawPage = getPageOrDefault("returns");
  const resource = rawPage.id ? `page:${rawPage.id}` : "page:returns";
  const page = localize(rawPage, resource, ctx.locale);
  const siteConfig = getDynamicSiteConfig();
  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: page.title || "Returns Policy", url: "/returns" },
  ]);

  const windowDays = siteConfig.returns.windowDays || 14;
  const eyebrow = page.eyebrow || "Customer Assurance";
  const headline = page.headline || `${windowDays}-Day Freshness Guarantee`;
  const subtitle =
    page.subtitle ||
    "We pride ourselves on the pristine condition of our garden harvests. If something is not right, we resolve it promptly.";

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
          {page.title || "Returns & Freshness Guarantee"}
        </span>
      </nav>

      <header className="mb-12 pb-8 border-b border-[#e4ded0]">
        <span className="text-xs font-bold uppercase tracking-widest text-[#2c4e38] block mb-2">
          {eyebrow}
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#18231c] leading-tight mb-4">
          {headline}
        </h1>
        <p className="text-lg sm:text-xl text-[#52594e] font-serif italic leading-relaxed">
          {subtitle}
        </p>
      </header>

      <div className="space-y-8 text-[#3d433b] text-base sm:text-lg leading-relaxed">
        <section>
          <h2 className="font-serif text-2xl font-bold text-[#18231c] mb-3"> <StorefrontText id="copy_0c18c0ae2754c092" fallback="Our Quality Commitment" /> </h2>
          <p> <StorefrontText id="copy_2dd1e0a4afc99e63" fallback="Because loose-leaf orthodox tea is an agricultural food item sensitive to environmental odor and humidity, standard consumables cannot be returned once unsealed unless there is an evident defect or transit breach." /> </p>
          <p className="mt-4"> <StorefrontText id="copy_566d5f1fdae9ee97" fallback="However, we stand 100% behind the freshness of our lots. Within" /> <strong>{windowDays} <StorefrontText id="copy_3191bd68eaddcc22" fallback="days of delivery" /> </strong> <StorefrontText id="copy_e81a0cc5afaa87c3" fallback=", you are fully covered for:" /> </p>
          <ul className="list-disc pl-6 space-y-2 text-[#4a5047] mt-3 text-sm sm:text-base">
            <li><strong> <StorefrontText id="copy_e36b2610d5187eb8" fallback="Transit Damage:" /> </strong> <StorefrontText id="copy_1cd6d892565f23d7" fallback="Dented luxury tins, punctured inner foil seals, or outer parcel crushing." /> </li>
            <li><strong> <StorefrontText id="copy_365f79328e034c52" fallback="Incorrect Fulfilment:" /> </strong> <StorefrontText id="copy_85de18247757cf91" fallback="Receiving an alternate flush, wrong weight variant, or incorrect invoice lot." /> </li>
            <li><strong> <StorefrontText id="copy_0214113164c7c32f" fallback="Sensory Defect:" /> </strong> <StorefrontText id="copy_e5783b8894ad8c64" fallback="Any batch exhibiting uncharacteristic taint or packaging seal failure." /> </li>
          </ul>
        </section>

        <section className="bg-[#f7f5f0] p-6 sm:p-8 rounded-xl border border-[#ece7dc]">
          <h2 className="font-serif text-xl font-bold text-[#18231c] mb-2"> <StorefrontText id="copy_fbb1391650219721" fallback="How to Request a Replacement or Refund" /> </h2>
          <p className="text-sm text-[#52594e] mb-4"> <StorefrontText id="copy_379809968fc4aff0" fallback="Simply email our customer concierge at" /> {" "}
            <a href={`mailto:${siteConfig.contact.email}`} className="font-semibold text-[#18231c] underline">
              {siteConfig.contact.email}
            </a>{" "} <StorefrontText id="copy_80c990f50b5e8786" fallback="with your order number (e.g., ORD-XXXXXX) and a photograph of the damaged tin or issue." /> </p>
          <p className="text-sm text-[#52594e]"> <StorefrontText id="copy_d13a31ddf3be7834" fallback="Our Siliguri support desk evaluates requests within 24 hours. Validated claims are immediately re-dispatched with express priority or credited to your original payment method." /> </p>
        </section>
      </div>
    </div>
  );
}
