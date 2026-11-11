import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import type { Metadata } from "next";
import Link from "next/link";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema } from "@/lib/seo/schema";
import { getSiteUrl } from "@/lib/seo/site";
import { TrialService } from "@/lib/trials/service";
import { DiscoveryShelfHero } from "@/components/trials/DiscoveryShelfHero";
import { TrialCatalogueExplorer } from "@/components/trials/TrialCatalogueExplorer";
import { TrialHowItWorks } from "@/components/trials/TrialHowItWorks";
import styles from "@/components/trials/TrialsCollection.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = constructMetadata({
  title: "TeaFloww Trials — Discover Your Next Favourite Tea",
  description:
    "Explore TeaFloww discovery kits. See the four teas inside every 200g kit, compare current prices, and find your favourite in your own kettle.",
  path: "/trials",
  ogImage: "/images/trials/discovery-shelf-hero.webp",
});

export default async function TrialsCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; search?: string; tag?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const searchQuery = params.search || params.q || "";

  // 1. Direct Server-Side Data Fetching via TrialService
  const { trials, total } = TrialService.listPublic({
    limit: 24,
    offset: 0,
    sort_by: "published_at",
    sort_dir: "desc",
  });

  // 2. Structured Data (JSON-LD)
  const siteUrl = getSiteUrl();
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${siteUrl}/trials#collection`,
    name: "TeaFloww Trials — 4x50g Craft Discovery Kits",
    description: "Explore tea discovery kits and compare the four 50g teas inside each kit.",
    url: `${siteUrl}/trials`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: trials.length,
      itemListElement: trials.map((t, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${siteUrl}/trials/${t.slug}`,
        name: t.title,
      })),
    },
  };

  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Trials", url: "/trials" },
  ]);

  return (
    <div className={`tf-trials-page-shell ${styles.page}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Screen-reader breadcrumb navigation for WCAG 2.2 AA */}
      <nav className="sr-only" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/"><StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /></Link>
          </li>
          <li aria-current="page"><StorefrontText id="copy_9d3e674e1c363b5f" fallback="Trials" /></li>
        </ol>
      </nav>

      {/* Hero Section */}
      <DiscoveryShelfHero />

      {/* Catalogue Explorer Main Section */}
      <section id="trials-catalogue" aria-label="Trial kit collection" className={styles.catalogue}>
        <TrialCatalogueExplorer
          initialTrials={trials}
          total={total}
          initialSearch={searchQuery}
        />
      </section>

      {/* How It Works Section */}
      <TrialHowItWorks />
    </div>
  );
}
