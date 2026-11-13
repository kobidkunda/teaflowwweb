import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import {
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  Package,
  Leaf,
  Clock,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ObfuscatedEmail } from "@/components/ObfuscatedEmail";
import { MarketSelector } from "@/components/international/MarketSelector";
import { CookiePreferencesButton } from "@/components/analytics/CookiePreferencesButton";
import type { HomepageContent } from "@/lib/homepageSchema";
import type { SiteNavigation } from "@/lib/contentBlocks";

export interface FooterCategory {
  id: number;
  name: string;
  slug: string;
}

export interface FooterBlog {
  slug: string;
  title: string;
}

const DEFAULT_BRAND = "TEAFLOWW";
const DEFAULT_FOOTER_TEXT =
  "Direct-from-origin single-estate orthodox teas harvested in Darjeeling, Assam, Kangra, and Nilgiri. Graded, cupped, and vacuum-sealed at origin in Siliguri.";
const DEFAULT_COPYRIGHT = "TeaFloww · Nirva. All rights reserved.";

const DISCOVERY_LINKS = [
  { label: "Download Brochure Catalog (PDF)", href: "/brochure" },
  { label: "Tea Finder (Flavor Quiz)", href: "/tea-finder" },
  { label: "Compare Cupping Profiles", href: "/compare" },
  { label: "Track Your Order", href: "/track" },
  { label: "Shopping Bag", href: "/cart" },
  { label: "Product Feeds (Google & CSV)", href: "/feeds" },
  { label: "Site Directory & Sitemap", href: "/sitemap" },
];

const CUSTOMER_CARE_LINKS = [
  { label: "Contact Us", href: "/contact" },
  { label: "Payment Methods & Discounts", href: "/payment-methods" },
  { label: "Shipping & Dispatch Policy", href: "/shipping" },
  { label: "14-Day Returns & Guarantee", href: "/returns" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

const TRUST_PILLARS = [
  {
    icon: Leaf,
    title: "100% Single-Estate",
    desc: "Unblended orthodox lots direct from Himalayan gardens.",
  },
  {
    icon: Sparkles,
    title: "Sealed at Origin",
    desc: "Graded and packaged at our Siliguri origin facility.",
  },
  {
    icon: Package,
    title: "24–48h Dispatch",
    desc: "Fast courier delivery across India via Blue Dart & Delhivery.",
  },
  {
    icon: ShieldCheck,
    title: "Freshness Guarantee",
    desc: "14-day freshness and transit resolution assurance.",
  },
];

export function Footer({
  content,
  navigation,
  categories,
  blogs,
}: {
  content?: HomepageContent | null;
  navigation?: SiteNavigation | null;
  categories?: FooterCategory[];
  blogs?: FooterBlog[];
}) {
  const brand = navigation?.brand || content?.brand || DEFAULT_BRAND;
  const footerText = navigation?.footer_text || content?.footer_text || DEFAULT_FOOTER_TEXT;
  const copyright = navigation?.footer_copyright || DEFAULT_COPYRIGHT;
  const disclosure = navigation?.footer_disclosure || content?.disclosure;

  // Custom links from operator/content administration
  // Priority: content.footer_links (homepage admin) -> navigation.footer_links (site content blocks)
  const operatorLinks = (
    content?.footer_links && content.footer_links.length > 0
      ? content.footer_links
      : navigation?.footer_links && navigation.footer_links.length > 0
      ? navigation.footer_links
      : []
  ).filter((l) => Boolean(l.label && l.href));

  // Dynamic Shop & Collection Links:
  // Combines active database categories with key shopping destinations
  const dynamicCategories =
    categories && categories.length > 0
      ? categories.slice(0, 5).map((c) => ({
          label: c.name,
          href: `/collections/${c.slug}`,
        }))
      : [
          { label: "Everyday Milk Chai", href: "/collections/everyday-milk-chai" },
          { label: "Darjeeling First Flush", href: "/collections/darjeeling-first-flush" },
          { label: "Reserve Black Teas", href: "/collections/black-tea" },
          { label: "Green & White Teas", href: "/collections/green-tea" },
        ];

  const renderedShopLinks = [
    { label: "Shop All Teas", href: "/shop" },
    ...dynamicCategories,
    ...(dynamicCategories.some((c) => c.href.includes("darjeeling-first-flush"))
      ? []
      : [{ label: "Darjeeling First Flush", href: "/collections/darjeeling-first-flush" }]),
    ...(dynamicCategories.some((c) => c.href.includes("black-tea"))
      ? []
      : [{ label: "Reserve Black Teas", href: "/collections/black-tea" }]),
    { label: "Trials & Samples", href: "/trials" },
    { label: "Wholesale & Bulk Orders", href: "/wholesale" },
    { label: "Blend Lab (Custom Tea Atelier)", href: "/blend-lab" },
  ];

  // Dynamic Blog Links:
  // Dynamically populated from published blog articles
  const dynamicBlogLinks =
    blogs && blogs.length > 0
      ? blogs.slice(0, 5)
      : [
          {
            slug: "darjeeling-first-flush-guide",
            title: "Darjeeling First Flush: Elevation, Bushes & Spring Aromatics",
          },
          {
            slug: "how-to-brew-milk-chai",
            title: "How to Make Strong Milk Chai at Home: Practical Guide",
          },
          {
            slug: "ctc-vs-orthodox-tea-west-bengal",
            title: "CTC vs Orthodox Tea: Buyer's Guide for Bengal",
          },
          {
            slug: "gondhoraj-lebu-cha-guide",
            title: "Gondhoraj Lebu Cha: How Bengal's Lemon Tea Works",
          },
        ];

  return (
    <footer
      className="ritual-footer footer tf-footer tf-site-footer"
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="tf-footer-wrapper">
        {/* Top Brand & Trust Section */}
        <div className="tf-footer-brand-section">
          <div className="tf-footer-brand-header">
            <Link
              href="/"
              className="tf-footer-brand-lockup"
              aria-label={`${brand} · Nirva homepage`}
            >
              <BrandLogo variant="symbol" size={32} aria-hidden={true} />
              <div>
                <span className="tf-footer-brand-title">{brand}</span>
                <span className="tf-footer-brand-entity"> <StorefrontText id="copy_edfbfddd022b196a" fallback="· Nirva" /> </span>
              </div>
            </Link>
            <p className="tf-footer-mission-text">{footerText}</p>
          </div>

          {/* Trust Value Pillars */}
          <div className="tf-footer-trust-grid" role="region" aria-label="Brand standards">
            {TRUST_PILLARS.map((item, idx) => {
              const IconComp = item.icon;
              return (
                <div key={idx} className="tf-footer-trust-item">
                  <IconComp size={18} className="tf-footer-trust-icon" aria-hidden={true} />
                  <div>
                    <div className="tf-footer-trust-label">{item.title}</div>
                    <div className="tf-footer-trust-desc">{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main 5-Column Navigation Grid */}
        <div className="tf-footer-nav-grid">
          {/* Column 1: Shop & Collections */}
          <div className="tf-footer-col">
            <h3 className="tf-footer-col-title" id="footer-shop-heading"> <StorefrontText id="copy_00b4c381af612b36" fallback="Shop Teas" /> </h3>
            <nav aria-labelledby="footer-shop-heading">
              <ul className="tf-footer-link-list">
                {renderedShopLinks.map((link, idx) => (
                  <li key={idx}>
                    <Link href={link.href} className="tf-footer-nav-link">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Column 2: Discovery & Tools */}
          <div className="tf-footer-col">
            <h3 className="tf-footer-col-title" id="footer-tools-heading">
              Discovery & Tools
            </h3>
            <nav aria-labelledby="footer-tools-heading">
              <ul className="tf-footer-link-list">
                {DISCOVERY_LINKS.map((link, idx) => (
                  <li key={idx}>
                    <Link href={link.href} className="tf-footer-nav-link">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Column 3: Tea Journal & Blog */}
          <div className="tf-footer-col">
            <h3 className="tf-footer-col-title" id="footer-journal-heading">
              <StorefrontText id="footer_journal_heading" fallback="Tea Journal & Blog" />
            </h3>
            <nav aria-labelledby="footer-journal-heading">
              <ul className="tf-footer-link-list">
                {/* Main Blog Hub Landing Page */}
                <li>
                  <Link href="/blog" className="tf-footer-nav-link font-semibold">
                    <span>
                      <StorefrontText id="footer_blog_hub_link" fallback="Tea Journal & Blog (All Articles)" />
                    </span>
                    <span className="tf-footer-badge-tag">
                      <StorefrontText id="footer_blog_stories_badge" fallback="Blog" />
                    </span>
                  </Link>
                </li>

                {/* Dynamic Links from Published Blog Posts */}
                {dynamicBlogLinks.map((blog, idx) => (
                  <li key={`blog-${idx}`}>
                    <Link href={`/blog/${blog.slug}`} className="tf-footer-nav-link text-xs">
                      <span className="line-clamp-1">{blog.title}</span>
                    </Link>
                  </li>
                ))}

                {/* Heritage & Education Stories */}
                <li>
                  <Link href="/leaf-to-cup" className="tf-footer-nav-link">
                    Leaf-to-Cup Craft Story
                  </Link>
                </li>
                <li>
                  <Link href="/ways-to-make-ctc-tea" className="tf-footer-nav-link">
                    Ways to Make CTC Tea
                  </Link>
                </li>
                <li>
                  <Link href="/locations/siliguri" className="tf-footer-nav-link">
                    Siliguri Origin & Tasting Room
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="tf-footer-nav-link">
                    Our Heritage & Estates
                  </Link>
                </li>
                <li>
                  <Link href="/brand" className="tf-footer-nav-link">
                    Brand Assets & Media Kit
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          {/* Column 4: Customer Care & Policies */}
          <div className="tf-footer-col">
            <h3 className="tf-footer-col-title" id="footer-care-heading"> <StorefrontText id="copy_a5f6f286a2b4f75d" fallback="Customer Care" /> </h3>
            <nav aria-labelledby="footer-care-heading">
              <ul className="tf-footer-link-list">
                {CUSTOMER_CARE_LINKS.map((link, idx) => (
                  <li key={idx}>
                    <Link href={link.href} className="tf-footer-nav-link">
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <CookiePreferencesButton className="tf-footer-nav-link" />
                </li>
              </ul>
            </nav>

            {/* Operator Custom Links (if configured via admin) */}
            {operatorLinks.length > 0 && (
              <div style={{ marginTop: "18px" }}>
                <h4
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#5a6459",
                    margin: "0 0 8px",
                    fontWeight: 700,
                  }}
                  id="footer-editorial-heading"
                > <StorefrontText id="copy_cb9b434b273e8ac8" fallback="Featured Topics" /> </h4>
                <nav aria-labelledby="footer-editorial-heading">
                  <ul className="tf-footer-link-list">
                    {operatorLinks.map((link, idx) => (
                      <li key={idx}>
                        <Link href={link.href} className="tf-footer-nav-link">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            )}
          </div>

          {/* Column 5: Company & Facility Credentials (from AGENTS.md) */}
          <div className="tf-footer-col">
            <h3 className="tf-footer-col-title" id="footer-company-heading">
              Company & Origin
            </h3>
            <address className="tf-footer-company-card">
              <div className="tf-footer-info-row">
                <ShieldCheck size={16} className="tf-footer-info-icon" aria-hidden={true} />
                <div className="tf-footer-info-text">
                  <strong> <StorefrontText id="copy_6c10a4f2d0bd1818" fallback="Nirva" /> </strong> <StorefrontText id="copy_f36c2f22376fa043" fallback="(Brand: TeaFloww)" /> <div className="tf-footer-gst-chip"> <StorefrontText id="copy_245b8ecd18f90172" fallback="GSTIN: 19CTHPK8646J2ZY" /> </div>
                </div>
              </div>

              <div className="tf-footer-info-row">
                <MapPin size={16} className="tf-footer-info-icon" aria-hidden={true} />
                <div className="tf-footer-info-text">
                  <strong> <StorefrontText id="copy_4a064af3ef619a34" fallback="Works / Facility:" /> </strong>
                  <div> <StorefrontText id="copy_3681b73040cf0610" fallback="00, Fulbari Ghoshpukur Bypass, Fulbari, Binnaguri, Dist Jalpaiguri, Siliguri, West Bengal, 734015" /> </div>
                </div>
              </div>

              <div className="tf-footer-info-row">
                <MapPin size={16} className="tf-footer-info-icon" aria-hidden={true} />
                <div className="tf-footer-info-text">
                  <strong> <StorefrontText id="copy_749720aad1daf3c5" fallback="Office:" /> </strong>
                  <div> <StorefrontText id="copy_b24112cbf95773d6" fallback="Shiv Shakti Kali Bari Rd, Sukantapally East, Siliguri 734005, West Bengal" /> </div>
                </div>
              </div>

              <div className="tf-footer-info-row">
                <Mail size={16} className="tf-footer-info-icon" aria-hidden={true} />
                <div className="tf-footer-info-text">
                  <ObfuscatedEmail className="tf-footer-nav-link" style={{ padding: 0, minHeight: 0 }} />
                </div>
              </div>

              <div className="tf-footer-info-row">
                <Phone size={16} className="tf-footer-info-icon" aria-hidden={true} />
                <div className="tf-footer-info-text">
                  <a href="tel:+917001304853" className="tf-footer-nav-link" style={{ padding: 0, minHeight: 0 }}>
                    +91 7001304853
                  </a>
                </div>
              </div>

              <div className="tf-footer-info-row">
                <Clock size={16} className="tf-footer-info-icon" aria-hidden={true} />
                <div className="tf-footer-info-text" style={{ fontSize: "11.5px", color: "#344236" }}> <StorefrontText id="copy_45adcb5e8f5bdb46" fallback="Mon – Sat · 09:00 – 18:00 IST" /> </div>
              </div>
            </address>
          </div>
        </div>

        {/* Bottom Legal & Copyright Bar */}
        <div className="tf-footer-bottom">
          <div className="tf-footer-bottom-row">
            <div>
              © {new Date().getFullYear()} {copyright.includes("Nirva") ? copyright : `${brand} · Nirva. All rights reserved.`}
            </div>

            <div className="tf-footer-market-selector">
              <MarketSelector />
            </div>

            <nav aria-label="Legal navigation" className="tf-footer-bottom-links">
              <Link href="/privacy" className="tf-footer-bottom-link"> <StorefrontText id="copy_506ff394621596dd" fallback="Privacy Policy" /> </Link>
              <Link href="/terms" className="tf-footer-bottom-link"> <StorefrontText id="copy_4afa55bf7aec7ddc" fallback="Terms of Service" /> </Link>
              <CookiePreferencesButton className="tf-footer-bottom-link" />
              <Link href="/shipping" className="tf-footer-bottom-link"> <StorefrontText id="copy_5bee6d60d809c03b" fallback="Shipping Policy" /> </Link>
              <Link href="/returns" className="tf-footer-bottom-link"> <StorefrontText id="copy_eea252e1ebc0e893" fallback="Returns Guarantee" /> </Link>
              <Link href="/feeds" className="tf-footer-bottom-link"> <StorefrontText id="copy_e98f3fd41a4da40e" fallback="Product Feeds" /> </Link>
              <Link href="/sitemap" className="tf-footer-bottom-link"> <StorefrontText id="copy_footer_sitemap" fallback="Sitemap" /> </Link>
            </nav>
          </div>

          {disclosure && <p className="tf-footer-disclosure">{disclosure}</p>}
        </div>
      </div>
    </footer>
  );
}
