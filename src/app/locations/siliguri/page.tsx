import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { constructMetadata } from "@/lib/seo/metadata";
import { getLocalBusinessSchema, getBreadcrumbSchema } from "@/lib/seo/schema";
import { getDynamicSiteConfig } from "@/lib/seo/site";
import { getPageOrDefault } from "@/lib/pages";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const page = getPageOrDefault("locations-siliguri");
  const siteConfig = getDynamicSiteConfig();
  return constructMetadata({
    title: page.meta_title || `Siliguri Tasting Room & Sourcing Hub — ${siteConfig.name}`,
    description:
      page.meta_description ||
      "Visit our tea tasting room and origin packaging hub in Siliguri, West Bengal. Experience curated flights from Darjeeling, Assam, and Dooars.",
    path: "/locations/siliguri",
    ogImage: "/images/hero-himalayan-tea.jpg",
  });
}

export default function SiliguriLocationPage() {
  const page = getPageOrDefault("locations-siliguri");
  const siteConfig = getDynamicSiteConfig();
  const localBusinessJsonLd = getLocalBusinessSchema();
  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Locations", url: "/contact" },
    { name: page.title || "Siliguri Tasting Room", url: "/locations/siliguri" },
  ]);

  const eyebrow = page.eyebrow || "Himalayan Gateway Facility";
  const headline = page.headline || "Siliguri Tasting Room & Packaging Hub";
  const subtitle = page.subtitle || "Situated at the foothills of the Himalayas, our central sensory laboratory connects garden lots directly to tea lovers nationwide.";

  return (
    <div className="container page-shell max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav className="breadcrumbs flex items-center gap-1.5 text-xs text-[#63685e] mb-8" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <Link href="/contact" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_95c61170318a2851" fallback="Locations" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <span aria-current="page" className="text-[#18231c] font-semibold">
          {page.title || "Siliguri Sourcing Hub"}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div className="p-6 bg-white border border-[#e4ded0] rounded-xl">
          <h2 className="font-serif text-xl font-bold text-[#18231c] mb-3">
            Address &amp; Coordinates
          </h2>
          <address className="not-italic text-sm text-[#52594e] space-y-1 leading-relaxed">
            <p className="font-semibold text-[#18231c]">{siteConfig.legalName}</p>
            <p>{siteConfig.address.streetAddress}</p>
            <p>
              {siteConfig.address.addressLocality}, {siteConfig.address.addressRegion} — {siteConfig.address.postalCode}
            </p>
            <p>{siteConfig.address.addressCountry === "IN" ? "India" : siteConfig.address.addressCountry}</p>
          </address>
          <div className="mt-4 pt-4 border-t border-[#f0ede6] text-xs text-[#6e746a] space-y-1">
            <p><strong> <StorefrontText id="copy_fcb59c0dc63f2e97" fallback="GPS Coordinates:" /> </strong> <StorefrontText id="copy_1dc2f98f4d60e6bf" fallback="26.7271° N, 88.3953° E" /> </p>
            <p><strong> <StorefrontText id="copy_b87a568d3eba3dae" fallback="Nearest Landmark:" /> </strong> <StorefrontText id="copy_41e088088c64da50" fallback="Near Siliguri Tea Auction Centre (STAC)" /> </p>
            <p><strong> <StorefrontText id="copy_c3abf0d9547806ea" fallback="Nearest Airport:" /> </strong> <StorefrontText id="copy_4d3ffe42ddbd1906" fallback="Bagdogra International Airport (IXB) — 14 km" /> </p>
          </div>
        </div>

        <div className="p-6 bg-white border border-[#e4ded0] rounded-xl flex flex-col justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#18231c] mb-3">
              Operating Hours &amp; Appointments
            </h2>
            <div className="space-y-2 text-sm text-[#52594e]">
              <p>• <strong> <StorefrontText id="copy_5d18eadd6d87a1ea" fallback="Monday – Saturday:" /> </strong> {siteConfig.openingHours[0] || "09:00 to 18:00 IST"}</p>
              <p>• <strong> <StorefrontText id="copy_ff436f6dc376d6bc" fallback="Sunday:" /> </strong> <StorefrontText id="copy_e9c7c8fb475bda0c" fallback="Closed for garden visits" /> </p>
              <p className="pt-2 text-xs text-[#6e746a]"> <StorefrontText id="copy_7b50e2d4aed89434" fallback="Walk-in visitors are welcome for tea leaf inspection and direct collection pickup. For full 5-flight sensory tasting room experiences with a tea sommelier, please reserve 24 hours in advance." /> </p>
            </div>
          </div>
          <div className="pt-4 border-t border-[#f0ede6] mt-4">
            <a
              href={`tel:${siteConfig.contact.telephone}`}
              className="text-xs font-bold text-[#2c4e38] hover:underline"
            > <StorefrontText id="copy_61fe9e04b8e39250" fallback="Call to Book Tasting:" /> {siteConfig.contact.telephone} →
            </a>
          </div>
        </div>
      </div>

      <div className="space-y-6 text-[#3d433b] text-base leading-relaxed mb-12">
        <h2 className="font-serif text-2xl font-bold text-[#18231c]"> <StorefrontText id="copy_8a8e1f278d4db9e7" fallback="Why Siliguri is Central to Himalayan Tea" /> </h2>
        <p> <StorefrontText id="copy_400194c19173bb8e" fallback="Siliguri holds a historic position in world tea commerce. Located in the Darjeeling district plains, it serves as the physical funnel through which every harvest from Darjeeling hills, Terai plains, Dooars gardens, and neighboring Assam must transit." /> </p>
        <p> <StorefrontText id="copy_7a09c0db4ae5c5cc" fallback="By basing our primary cupping room and vacuum-packaging center in Matigara, Siliguri, we intercept pristine seasonal lots within hours of final firing at estate factories—eliminating the degradation associated with transport to distant port cities." /> </p>
      </div>
    </div>
  );
}
