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
  const rawPage = getPageOrDefault("shipping");
  const resource = rawPage.id ? `page:${rawPage.id}` : "page:shipping";
  const page = localize(rawPage, resource, ctx.locale);
  const siteConfig = getDynamicSiteConfig();
  return constructMetadata({
    title: page.meta_title || `Shipping & Transit Policy — Origin Packaging & Delivery · ${siteConfig.name}`,
    description:
      page.meta_description ||
      `Review shipping rates, transit timelines, and packaging standards across India from our Siliguri hub.`,
    path: "/shipping",
    locale: ctx.requestedLocale || ctx.locale,
    resource,
  });
}

export default async function ShippingPage() {
  const ctx = await requestContext();
  const rawPage = getPageOrDefault("shipping");
  const resource = rawPage.id ? `page:${rawPage.id}` : "page:shipping";
  const page = localize(rawPage, resource, ctx.locale);
  const siteConfig = getDynamicSiteConfig();
  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: page.title || "Shipping Policy", url: "/shipping" },
  ]);

  const freeThresholdDisplay = `₹${(siteConfig.shipping.freeShippingThresholdPaise / 100).toLocaleString("en-IN")}`;
  const flatFeeDisplay = `₹${(siteConfig.shipping.flatRatePaise / 100).toLocaleString("en-IN")}`;
  const minDeliveryOrderRupees = Math.round((siteConfig.shipping.minDeliveryOrderPaise || 0) / 100);
  const dispatchCommitment = siteConfig.shipping.dispatchCommitment || "Dispatched from our central Siliguri facility within 24 to 48 hours of lot grading to guarantee absolute freshness.";
  const carriers = siteConfig.shipping.courierPartners.join(", ");

  const eyebrow = page.eyebrow || "Origin Logistics";
  const headline = page.headline || "Direct-from-Origin Shipping Policy";
  const subtitle = page.subtitle || dispatchCommitment;

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
          {page.title || "Shipping Policy"}
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
          <h2 className="font-serif text-2xl font-bold text-[#18231c] mb-3">
            Domestic Shipping Rates &amp; Thresholds (India)
          </h2>
          <div className="p-5 bg-[#f7f5f0] border border-[#ece7dc] rounded-xl text-sm sm:text-base space-y-2">
            {minDeliveryOrderRupees > 0 && (
              <p>
                • <strong><StorefrontText id="copy_2b878d09702094a0" fallback="Minimum Delivery Order:" /></strong><StorefrontText id="copy_7611ea51afdae783" fallback="A minimum bag value of" /> <strong>₹{minDeliveryOrderRupees.toLocaleString("en-IN")}</strong><StorefrontText id="copy_8836e909cf1659d6" fallback="is required to place an order for delivery." />
              </p>
            )}
            <p>
              • <strong> <StorefrontText id="copy_c5130ce849eea44b" fallback="Free Shipping:" /> </strong> <StorefrontText id="copy_bbb581b1ce3d5e32" fallback="Automatically applied on all orders of" /> <strong>{freeThresholdDisplay}</strong> <StorefrontText id="copy_bbda8cf589136706" fallback="or greater across all serviceable pin codes in India." /> </p>
            <p>
              • <strong> <StorefrontText id="copy_0b3f0e7b806c842b" fallback="Flat-Rate Standard Shipping:" /> </strong> <StorefrontText id="copy_11749e9beae5d5f4" fallback="A flat fee of" /> <strong>{flatFeeDisplay}</strong> <StorefrontText id="copy_6ed3df7d6b97b9a3" fallback="applies to orders below" /> {freeThresholdDisplay}.
            </p>
            <p>
              • <strong> <StorefrontText id="copy_a7c04a6fc237cb35" fallback="Courier Partners:" /> </strong> <StorefrontText id="copy_080b7c48f02d4a41" fallback="We partner with" /> {carriers} <StorefrontText id="copy_295eddb772dd6a9f" fallback="for rapid air and surface conveyance." /> </p>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl font-bold text-[#18231c] mb-3">
            Worldwide &amp; International Delivery (220+ Countries)
          </h2>
          <div className="p-5 bg-[#f7f5f0] border border-[#ece7dc] rounded-xl text-sm sm:text-base space-y-2">
            <p>
              • <strong> <StorefrontText id="copy_0562fd45012b35f9" fallback="Global Coverage:" /> </strong> <StorefrontText id="copy_3c6972d687bb371c" fallback="We dispatch single-estate orthodox teas to 220+ countries and territories worldwide directly from our Siliguri blending works." /> </p>
            <p>
              • <strong> <StorefrontText id="copy_65873bc5f62baf49" fallback="Authoritative Live Quotes:" /> </strong> <StorefrontText id="copy_df6719f14e3ec1a6" fallback="Delivery charges and applicable taxes are calculated live at checkout based on your exact delivery address and packaged parcel weight." /> </p>
            <p>
              • <strong>Customs &amp; Import Duties:</strong> <StorefrontText id="copy_c790f5be4ccebc32" fallback="Depending on destination regulations, duties are either calculated and prepaid at checkout (duties included) or clearly disclosed as payable upon arrival by the recipient." /> </p>
            <p>
              • <strong> <StorefrontText id="copy_86e6dad9b1ad5e88" fallback="Hermetic Export Packaging:" /> </strong> <StorefrontText id="copy_3b0fd3ca67f897ae" fallback="All international parcels feature nitrogen-flushed barrier packaging to preserve delicate high-mountain Darjeeling and Assam aromas through global air transit." /> </p>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl font-bold text-[#18231c] mb-3">
            Dispatch &amp; Transit Timelines
          </h2>
          <p> <StorefrontText id="copy_7131add076455130" fallback="All harvest orders are packed in airtight, nitrogen-flushed foil pouches or hermetic collector tins at our Siliguri hub. Orders received by 14:00 IST Monday through Friday are processed the same day and handed over to courier dispatch within" /> {dispatchCommitment}.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-[#4a5047] mt-4 text-sm sm:text-base">
            <li><strong> <StorefrontText id="copy_e009b084978e000b" fallback="Metro Regions (Kolkata, Delhi, Mumbai, Bengaluru, Chennai, Hyderabad):" /> </strong> <StorefrontText id="copy_57d04c6a20cb9703" fallback="2–3 business days following dispatch." /> </li>
            <li><strong>Tier-2 &amp; Tier-3 Cities:</strong> <StorefrontText id="copy_e2cc29859432e825" fallback="3–5 business days following dispatch." /> </li>
            <li><strong>Remote Mountain &amp; Island Regions:</strong> <StorefrontText id="copy_9c927ead263daa46" fallback="5–7 business days via India Post Speed Post." /> </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl font-bold text-[#18231c] mb-3"> <StorefrontText id="copy_9b441e23c7a0f0fc" fallback="Real-Time Tracking" /> </h2>
          <p> <StorefrontText id="copy_3c3ed1a2e942231e" fallback="Immediately upon courier induction, an automated dispatch notification with an active tracking link is sent via email and SMS. You can also monitor your order at any moment on our" /> <Link href="/track" className="font-semibold text-[#18231c] underline hover:text-[#2c4e38]"> <StorefrontText id="copy_634e11f25abf7680" fallback="Order Tracking Page" /> </Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
