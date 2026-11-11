import React from "react";
import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo/metadata";
import { getSiteUrl } from "@/lib/seo/site";
import { getStoreSettings } from "@/lib/storeSettings";
import { PrivateLabelService } from "@/lib/private-label/service";
import type { PublicPackagingVariantDto } from "@/lib/private-label/public-dto";
import { PrivateLabelHero } from "@/components/private-label/landing/PrivateLabelHero";
import { ProofOfProcessStepper } from "@/components/private-label/landing/ProofOfProcessStepper";
import { TrustBadgesStrip } from "@/components/private-label/landing/TrustBadgesStrip";
import { StudioTeaserPreview } from "@/components/private-label/landing/StudioTeaserPreview";
import { FeaturedPackagingGrid } from "@/components/private-label/landing/FeaturedPackagingGrid";
import { PrintComparisonMatrix } from "@/components/private-label/landing/PrintComparisonMatrix";
import { FAQAccordion, FAQ_DATA } from "@/components/private-label/landing/FAQAccordion";
import { ConsultationLeadForm } from "@/components/private-label/landing/ConsultationLeadForm";

export const metadata: Metadata = constructMetadata({
  title: "Private Label Tea Studio — Bespoke Tea Sourcing & Packaging | TeaFloww",
  description:
    "Explore private-label tea and packaging, preview your brand and request a quotation from TeaFloww. Specifications and production terms are confirmed for your project.",
  path: "/private-label",
  ogImage: "/images/private-label/atelier-concept.webp",
});

export default async function PrivateLabelLandingPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const params = searchParams ? await searchParams : {};
  const requestedDieline = typeof params.dieline === "string" ? params.dieline.slice(0, 200) : "";
  const siteUrl = getSiteUrl();

  let featuredVariants: PublicPackagingVariantDto[] = [];
  try {
    const res = PrivateLabelService.listPublicPackagingVariants({ limit: 6 });
    featuredVariants = res.items;
  } catch {
    featuredVariants = [];
  }

  let whatsappNumber = "+91 7001304853";
  try {
    const settings = getStoreSettings();
    if (settings?.whatsapp_number?.trim()) {
      whatsappNumber = settings.whatsapp_number.trim();
    }
  } catch {
    // Keep fallback
  }

  // Schema.org Structured Data
  const jsonLdGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: "TeaFloww",
        legalName: "Nirva",
        url: siteUrl,
        email: "info@teafloww.com",
        telephone: "+91 7001304853",
        taxID: "19CTHPK8646J2ZY",
        address: {
          "@type": "PostalAddress",
          streetAddress: "00, Fulbari Ghoshpukur Bypass, Fulbari, Binnaguri",
          addressLocality: "Siliguri",
          addressRegion: "West Bengal",
          postalCode: "734015",
          addressCountry: "IN",
        },
      },
      {
        "@type": "Service",
        "@id": `${siteUrl}/private-label#service`,
        name: "TeaFloww Private Label Tea Atelier",
        serviceType: "Private Label Tea Manufacturing & Packaging",
        description:
          "Private-label tea and packaging consultation, configuration and proof review.",
        provider: {
          "@id": `${siteUrl}#organization`,
        },
        areaServed: [
          { "@type": "Country", name: "India" },
          { "@type": "Country", name: "United States" },
          { "@type": "Country", name: "United Kingdom" },
          { "@type": "Country", name: "European Union" },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/private-label#faq`,
        mainEntity: FAQ_DATA.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/private-label#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Private Label",
            item: `${siteUrl}/private-label`,
          },
        ],
      },
    ],
  };

  return (
    <div style={{ maxWidth: "100%", overflowX: "clip" }}>
      {/* Schema.org JSON-LD Script */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />

      <PrivateLabelHero />
      <ProofOfProcessStepper />
      <TrustBadgesStrip />
      <StudioTeaserPreview />
      <FeaturedPackagingGrid variants={featuredVariants} />
      <PrintComparisonMatrix />
      <FAQAccordion />
      <div id="sample-kit">
        <ConsultationLeadForm
          initialNotes={requestedDieline ? `Please provide the approved prepress dieline for ${requestedDieline}.` : ""}
          whatsappNumber={whatsappNumber}
        />
      </div>
    </div>
  );
}
