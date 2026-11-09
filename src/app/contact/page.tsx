import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { Sparkles, Leaf, Compass } from "lucide-react";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema } from "@/lib/seo/schema";
import { getDynamicSiteConfig, getSiteUrl } from "@/lib/seo/site";
import { getPageOrDefault } from "@/lib/pages";
import { ContactChannels } from "@/components/contact/ContactChannels";
import { ObfuscatedEmail } from "@/components/ObfuscatedEmail";
import { ContactStudio } from "@/components/contact/ContactStudio";
import { TransitHeritageMap } from "@/components/contact/TransitHeritageMap";
import { ContactFaq } from "@/components/contact/ContactFaq";
import { requestContext } from "@/lib/international/context";
import { localize } from "@/lib/international/translations";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const ctx = await requestContext();
  const rawPage = getPageOrDefault("contact");
  const resource = rawPage.id ? `page:${rawPage.id}` : "page:contact";
  const page = localize(rawPage, resource, ctx.locale);
  const siteConfig = getDynamicSiteConfig();
  return constructMetadata({
    title:
      page.meta_title ||
      `Contact Us — Tasting Room & Sourcing Headquarters · ${siteConfig.brand || "TeaFloww"}`,
    description:
      page.meta_description ||
      `Contact TeaFloww (Nirva) in Siliguri, West Bengal. Customer care, brewing guidance, private tea tasting reservations, and wholesale partnerships at the Himalayan foothills.`,
    path: "/contact",
    locale: ctx.requestedLocale || ctx.locale,
    resource,
  });
}

export default function ContactPage() {
  const page = getPageOrDefault("contact");
  const siteConfig = getDynamicSiteConfig();
  const siteUrl = getSiteUrl();

  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: page.title || "Contact Us", url: "/contact" },
  ]);

  const contactPointJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${siteUrl}/contact#webpage`,
    url: `${siteUrl}/contact`,
    name: "Contact TeaFloww — Siliguri Tasting Room & Sourcing Headquarters",
    description:
      "Direct customer care, sommelier brewing consultation, private tasting bookings, and wholesale inquiries in Siliguri, West Bengal.",
    mainEntity: {
      "@type": "Organization",
      name: "TeaFloww",
      legalName: "Nirva",
      url: "https://teafloww.com",
      email: "info@teafloww.com",
      telephone: "+91-7001304853",
      contactPoint: [
        {
          "@type": "ContactPoint",
          telephone: "+91-7001304853",
          contactType: "customer service",
          email: "info@teafloww.com",
          availableLanguage: ["English", "Hindi", "Bengali", "Nepali"],
          areaServed: "IN",
        },
      ],
      address: [
        {
          "@type": "PostalAddress",
          name: "Works & Sourcing Facility",
          streetAddress: "00, Fulbari Ghoshpukur Bypass, Fulbari, Binnaguri",
          addressLocality: "Siliguri",
          addressRegion: "West Bengal",
          postalCode: "734015",
          addressCountry: "IN",
        },
        {
          "@type": "PostalAddress",
          name: "Registered Office",
          streetAddress: "Shiv Shakti Kali Bari Rd, Sukantapally East",
          addressLocality: "Siliguri",
          addressRegion: "West Bengal",
          postalCode: "734005",
          addressCountry: "IN",
        },
      ],
    },
  };

  const eyebrow = page.eyebrow || "Customer Care & Sourcing Headquarters";
  const headline = page.headline || "Connect With Our Tea Masters";
  const subtitle =
    page.subtitle ||
    "Questions regarding brewing parameters, order status, private tasting bookings, or garden partnerships? We are here to assist.";

  return (
    <div className="bg-[#f6f1e7] text-[#171713] min-h-screen">
      {/* Structured SEO Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactPointJsonLd) }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-6xl">
        {/* Breadcrumb Navigation */}
        <nav
          className="flex items-center gap-2 text-xs text-[#63685e] mb-8"
          aria-label="Breadcrumb"
        >
          <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
          <span className="text-[#a59f92]">/</span>
          <span aria-current="page" className="text-[#18231c] font-semibold">
            {page.title || "Contact Us"}
          </span>
        </nav>

        {/* Hero Editorial Header */}
        <header className="mb-10 sm:mb-14 pb-8 sm:pb-10 border-b border-[#e4ded0]">
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e3ebe4] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#23483a]">
              <Sparkles size={12} className="text-[#3b744d]" />
              {eyebrow}
            </span>
            <span className="text-xs text-[#70766b] font-medium">
              Siliguri, West Bengal · Gateway to Darjeeling &amp; Dooars
            </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-[#18231c] leading-[1.12] mb-4 tracking-tight">
            {headline}
          </h1>

          <p className="max-w-3xl text-base sm:text-xl text-[#52594e] font-serif italic leading-relaxed">
            {subtitle}
          </p>

          {/* Trust & Channel Snapshot Strip */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-6 border-t border-[#ede7db] text-xs">
            <div className="rounded-xl border border-[#e4ded0] bg-white/70 p-3.5 backdrop-blur-xs">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6e746a]"> <StorefrontText id="copy_c52ab17a433f65fd" fallback="Response Window" /> </span>
              <strong className="mt-0.5 block text-sm font-semibold text-[#18231c]"> <StorefrontText id="copy_d655898525a2a84c" fallback="⚡ Under 24 Hours" /> </strong>
              <span className="text-[11px] text-[#787f74]"> <StorefrontText id="copy_5e36ff406d9363d4" fallback="Monday to Saturday" /> </span>
            </div>

            <div className="rounded-xl border border-[#e4ded0] bg-white/70 p-3.5 backdrop-blur-xs">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6e746a]"> <StorefrontText id="copy_c3046c1702938d00" fallback="Live Concierge" /> </span>
              <a
                href="https://wa.me/917001304853"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block text-sm font-semibold text-[#128c7e] hover:underline"
              > <StorefrontText id="copy_fc466799facec6d5" fallback="💬 WhatsApp Chat" /> </a>
              <span className="text-[11px] text-[#787f74]">+91 7001304853</span>
            </div>

            <div className="rounded-xl border border-[#e4ded0] bg-white/70 p-3.5 backdrop-blur-xs">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6e746a]"> <StorefrontText id="copy_d605886f4300695d" fallback="Sensory Location" /> </span>
              <strong className="mt-0.5 block text-sm font-semibold text-[#18231c]"> <StorefrontText id="copy_8cb1d2a57910e266" fallback="📍 Fulbari Hub" /> </strong>
              <span className="text-[11px] text-[#787f74]"> <StorefrontText id="copy_ac35fa0df4f52e07" fallback="Private tastings by appt" /> </span>
            </div>

            <div className="rounded-xl border border-[#e4ded0] bg-white/70 p-3.5 backdrop-blur-xs">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6e746a]"> <StorefrontText id="copy_365f7a923a338f7e" fallback="Direct Email" /> </span>
              <span className="mt-0.5 block text-sm font-semibold text-[#18231c] truncate">
                ✉️{" "}
                <ObfuscatedEmail className="hover:text-[#23483a] hover:underline" />
              </span>
              <span className="text-[11px] text-[#787f74]">Corporate &amp; retail desk</span>
            </div>
          </div>
        </header>

        {/* Core Layout: Two-Column Channels & Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 mb-14">
          {/* Left Column: Direct Touchpoints & Origin Facilities (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <ContactChannels />
          </div>

          {/* Right Column: The Interactive Contact Studio (7 Cols) */}
          <div className="lg:col-span-7">
            <ContactStudio />
          </div>
        </div>

        {/* Geographic Crossroads Section */}
        <div className="mb-14">
          <TransitHeritageMap />
        </div>

        {/* FAQ Accordion Section */}
        <div className="mb-14">
          <ContactFaq />
        </div>

        {/* Editorial Footer Navigation Strip */}
        <footer className="pt-8 border-t border-[#e4ded0] flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[#52594e]">
          <div className="flex flex-wrap items-center gap-4 font-semibold text-[#18231c]">
            <Link
              href="/leaf-to-cup"
              className="hover:text-[#b36b3d] inline-flex items-center gap-1 transition-colors"
            >
              <Leaf size={13} className="text-[#23483a]" /> <StorefrontText id="copy_8823e559d15d100b" fallback="Leaf to Cup Sourcing" /> </Link>
            <span className="text-[#a59f92]">·</span>
            <Link
              href="/about"
              className="hover:text-[#b36b3d] inline-flex items-center gap-1 transition-colors"
            >
              <Compass size={13} className="text-[#23483a]" /> Terroir &amp; Provenance
            </Link>
            <span className="text-[#a59f92]">·</span>
            <Link
              href="/wholesale"
              className="hover:text-[#b36b3d] inline-flex items-center gap-1 transition-colors"
            >
              🌿 Trade &amp; Wholesale
            </Link>
            <span className="text-[#a59f92]">·</span>
            <Link
              href="/track"
              className="hover:text-[#b36b3d] inline-flex items-center gap-1 transition-colors"
            > <StorefrontText id="copy_c9852d882d6214f6" fallback="📦 Track Dispatch" /> </Link>
          </div>

          <div className="text-[11px] text-[#787f74]">
            {siteConfig.brand || "TeaFloww"} <StorefrontText id="copy_7b59f1e59dab0913" fallback="· Nirva · Siliguri 734005 · GSTIN: 19CTHPK8646J2ZY" /> </div>
        </footer>
      </div>
    </div>
  );
}
