import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import "@/components/international/international.css";
import { requestContext } from "@/lib/international/context";
import { InternationalProvider } from "@/components/international/InternationalProvider";
import { localize } from "@/lib/international/translations";
import { publicMarkets } from "@/lib/international/store";
import { activeCampaign } from "@/lib/international/campaigns";
import type { Metadata, Viewport } from "next";
import { StorefrontShell } from "@/components/StorefrontShell";
import { SITE_CONFIG, getSiteUrl } from "@/lib/seo/site";
import { getOrganizationSchema, getLocalBusinessSchema, getWebsiteSchema } from "@/lib/seo/schema";
import "./globals.css";
import { getStorefrontHomepageContent } from "@/lib/homepage";
import { listStorefrontCategories } from "@/lib/storefront";
import { listBlogPosts } from "@/lib/blogs";
import { trackingBootstrap } from "@/lib/seo/consent";
import { getPublicTrackingConfig } from "@/lib/trackingSettings";
import { AnalyticsHeadScripts } from "@/components/analytics/AnalyticsScripts";

export const dynamic = "force-dynamic";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
    template: `%s · ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    url: siteUrl,
    siteName: SITE_CONFIG.name,
    locale: SITE_CONFIG.defaultLocale,
    type: "website",
    images: [
      {
        url: `${siteUrl}${SITE_CONFIG.defaultOgImage}`,
        secureUrl: `${siteUrl}${SITE_CONFIG.defaultOgImage}`,
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: SITE_CONFIG.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    images: [`${siteUrl}${SITE_CONFIG.defaultOgImage}`],
    site: "@teafloww",
    creator: "@teafloww",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1D2A24",
};

import { getAnnouncementSettings, getSiteNavigation } from "@/lib/contentBlocks";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const international = await requestContext();
  const active = activeCampaign(international.country);
  const campaign = active ? localize(active, `campaign:${active.id}`, international.locale) : null;
  const orgSchema = getOrganizationSchema();
  const localBusinessSchema = getLocalBusinessSchema();
  const websiteSchema = getWebsiteSchema();
  const trackingConfig = getPublicTrackingConfig();
  const shell = localize({ navigation: getSiteNavigation(), announcement: getAnnouncementSettings() }, "shell", international.locale);
  const announcement = shell.announcement;
  if (announcement) {
    if (campaign?.announcement) { announcement.highlight = campaign.announcement; announcement.text = campaign.announcement; }
    else if (international.country !== "IN" || !publicMarkets().find(m => m.code === international.country)?.available) {
      announcement.highlight = "Discover your next tea ritual";
      announcement.text = "Delivery availability and charges are confirmed at checkout.";
    }
  }
  const navigation = shell.navigation;

  const currentLang = international.requestedLocale || international.locale;
  const storefrontCategories = listStorefrontCategories().map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));
  const footerBlogs = listBlogPosts({ status: "published", limit: 6 }).map((b) => ({
    slug: b.slug,
    title: b.title,
  }));

  return (
    <html lang={currentLang === "en" ? "en-IN" : currentLang} dir={international.dir}>
      <head>
        <script id="tracking-consent-defaults" dangerouslySetInnerHTML={{ __html: trackingBootstrap(trackingConfig) }} />
        <link rel="ai-catalog" href="/ai-catalog.json" />
        <link rel="ard" href="/ai-catalog.json" />
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              prerender: [
                {
                  where: { href_matches: "/shop" },
                  eagerness: "moderate",
                },
              ],
            }),
          }}
        />
      </head>
      <body>
        <AnalyticsHeadScripts config={trackingConfig} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <a href="#main-content" className="skip-link"> <StorefrontText id="copy_c887f134c26ea831" fallback="Skip to main content" /> </a>
        <InternationalProvider value={international}><StorefrontShell
          content={localize(getStorefrontHomepageContent(), "homepage", international.locale)}
          announcement={announcement}
          navigation={navigation}
          categories={storefrontCategories}
          footerBlogs={footerBlogs}
        >
          {children}
        </StorefrontShell></InternationalProvider>
      </body>
    </html>
  );
}
