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
  const rawPage = getPageOrDefault("privacy");
  const resource = rawPage.id ? `page:${rawPage.id}` : "page:privacy";
  const page = localize(rawPage, resource, ctx.locale);
  const siteConfig = getDynamicSiteConfig();
  return constructMetadata({
    title: page.meta_title || `Privacy Policy — Digital Personal Data Protection · ${siteConfig.name}`,
    description:
      page.meta_description ||
      `Our privacy policy outlines data retention, cookie handling, and how customer information is secured under India DPDP Act and international standards.`,
    path: "/privacy",
    locale: ctx.requestedLocale || ctx.locale,
    resource,
  });
}

export default async function PrivacyPage() {
  const ctx = await requestContext();
  const rawPage = getPageOrDefault("privacy");
  const resource = rawPage.id ? `page:${rawPage.id}` : "page:privacy";
  const page = localize(rawPage, resource, ctx.locale);
  const siteConfig = getDynamicSiteConfig();
  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: page.title || "Privacy Policy", url: "/privacy" },
  ]);

  const eyebrow = page.eyebrow || "Data Governance";
  const headline = page.headline || "Customer Privacy Policy";

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
          {page.title || "Privacy Policy"}
        </span>
      </nav>

      <header className="mb-12 pb-8 border-b border-[#e4ded0]">
        <span className="text-xs font-bold uppercase tracking-widest text-[#2c4e38] block mb-2">
          {eyebrow}
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#18231c] leading-tight mb-4">
          {headline}
        </h1>
        <p className="text-sm text-[#52594e]"> <StorefrontText id="copy_90ba939deef541d2" fallback="Governing Entity:" /> {siteConfig.legalName} <StorefrontText id="copy_67f55aca356abc0f" fallback="· Direct Support:" /> {siteConfig.contact.email}
        </p>
      </header>

      <div className="space-y-8 text-[#3d433b] text-base leading-relaxed">
        {page.body_markdown && (
          <div className="whitespace-pre-line text-[#3d433b]">{page.body_markdown}</div>
        )}

        <section>
          <h2 className="font-serif text-xl font-bold text-[#18231c] mb-2"> <StorefrontText id="copy_8dc7bf471f75d9f6" fallback="1. Information We Collect" /> </h2>
          <p> <StorefrontText id="copy_a092b1fb2e0096b6" fallback="We collect only the personal information strictly necessary to process tea orders, facilitate courier delivery across India, and furnish customer support:" /> </p>
          <ul className="list-disc pl-6 space-y-1 text-[#4a5047] mt-2 text-sm">
            <li> <StorefrontText id="copy_ec6d30f10fd20832" fallback="Customer name, delivery street address, postal code, and contact telephone for parcel handover." /> </li>
            <li> <StorefrontText id="copy_1679f8a3e4ca2db8" fallback="Email address for dispatch updates, invoices, and opted-in harvest announcements." /> </li>
            <li> <StorefrontText id="copy_e1ea67ee6acd25b5" fallback="Payment transaction references returned by authorized gateways (we never see or store raw card numbers)." /> </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-[#18231c] mb-2"> <StorefrontText id="copy_2acf1cd5241f407f" fallback="2. How We Protect Your Data" /> </h2>
          <p> <StorefrontText id="copy_3b3eeaed8430b46a" fallback="We implement strict technical and operational controls. All web communication is encrypted via TLS 1.3. We do not sell, barter, or monetize personal customer records to third-party advertising brokers under any circumstance." /> </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-[#18231c] mb-2"> <StorefrontText id="copy_c207dc27b1dcd0db" fallback="3. Contact the Data Officer" /> </h2>
          <p> <StorefrontText id="copy_80082105097b7b17" fallback="To exercise your rights to review, rectify, or erase personal records, please email our privacy officer at" /> {" "}
            <a href={`mailto:${siteConfig.contact.email}`} className="font-semibold text-[#18231c] underline">
              {siteConfig.contact.email}
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
