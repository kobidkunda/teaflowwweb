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
import type { HomepageContent } from "@/lib/homepageSchema";
import type { SiteNavigation } from "@/lib/contentBlocks";

const DEFAULT_BRAND = "TEAFLOWW";
const DEFAULT_FOOTER_TEXT =
  "Direct-from-origin single-estate orthodox teas harvested in Darjeeling, Assam, Kangra, and Nilgiri. Graded, cupped, and vacuum-sealed at origin in Siliguri.";
const DEFAULT_COPYRIGHT = "TeaFloww · Nirva. All rights reserved.";

// Static Navigation Taxonomy
const SHOP_LINKS = [
  { label: "Shop All Teas", href: "/shop" },
  { label: "Darjeeling First Flush", href: "/collections/darjeeling-first-flush" },
  { label: "Reserve Black Teas", href: "/collections/black-tea" },
  { label: "Green & White Teas", href: "/shop?category=green-tea" },
  { label: "Oolong & Specialty", href: "/shop?category=oolong-tea" },
  { label: "Trials & Samples", href: "/trials" },
  { label: "Wholesale & Bulk Orders", href: "/wholesale" },
  { label: "Blend Lab (Custom Tea Atelier)", href: "/blend-lab" },
];

const DISCOVERY_LINKS = [
  { label: "Tea Finder (Flavor Quiz)", href: "/tea-finder" },
  { label: "Compare Cupping Profiles", href: "/compare" },
  { label: "Track Your Order", href: "/track" },
  { label: "Shopping Bag", href: "/cart" },
  { label: "Product Feeds (Google & CSV)", href: "/feeds" },
];

const HERITAGE_LINKS = [
  { label: "Tea Journal & Articles", href: "/blog" },
  { label: "Tea Education & Brewing", href: "/learn" },
  { label: "Leaf-to-Cup Craft Story", href: "/leaf-to-cup" },
  { label: "Ways to Make CTC Tea", href: "/ways-to-make-ctc-tea" },
  { label: "Siliguri Origin & Tasting Room", href: "/locations/siliguri" },
  { label: "Our Heritage & Estates", href: "/about" },
  { label: "Brand Assets & Media Kit", href: "/brand" },
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
}: {
  content?: HomepageContent | null;
  navigation?: SiteNavigation | null;
}) {
  const brand = navigation?.brand || content?.brand || DEFAULT_BRAND;
  const footerText = navigation?.footer_text || content?.footer_text || DEFAULT_FOOTER_TEXT;
  const copyright = navigation?.footer_copyright || DEFAULT_COPYRIGHT;
  const disclosure = navigation?.footer_disclosure || content?.disclosure;

  // Custom links from operator/content administration
  const customLinks = (
    navigation?.footer_links && navigation.footer_links.length > 0
      ? navigation.footer_links
      : content?.footer_links && content.footer_links.length > 0
      ? content.footer_links
      : []
  ).filter((l) => Boolean(l.label && l.href));

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
                {SHOP_LINKS.map((link, idx) => (
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

          {/* Column 3: Journal & Heritage (Missing items like /blog now fully visible) */}
          <div className="tf-footer-col">
            <h3 className="tf-footer-col-title" id="footer-journal-heading">
              Journal & Heritage
            </h3>
            <nav aria-labelledby="footer-journal-heading">
              <ul className="tf-footer-link-list">
                {HERITAGE_LINKS.map((link, idx) => (
                  <li key={idx}>
                    <Link href={link.href} className="tf-footer-nav-link">
                      <span>{link.label}</span>
                      {link.href === "/blog" && (
                        <span className="tf-footer-badge-tag"> <StorefrontText id="copy_6d09cf5748829bd2" fallback="Stories" /> </span>
                      )}
                    </Link>
                  </li>
                ))}
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
              </ul>
            </nav>

            {/* Operator Custom Links (if configured via admin) */}
            {customLinks.length > 0 && (
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
                    {customLinks.map((link, idx) => (
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
              <Link href="/shipping" className="tf-footer-bottom-link"> <StorefrontText id="copy_5bee6d60d809c03b" fallback="Shipping Policy" /> </Link>
              <Link href="/returns" className="tf-footer-bottom-link"> <StorefrontText id="copy_eea252e1ebc0e893" fallback="Returns Guarantee" /> </Link>
              <Link href="/feeds" className="tf-footer-bottom-link"> <StorefrontText id="copy_e98f3fd41a4da40e" fallback="Product Feeds" /> </Link>
            </nav>
          </div>

          {disclosure && <p className="tf-footer-disclosure">{disclosure}</p>}
        </div>
      </div>
    </footer>
  );
}
