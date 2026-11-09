"use client";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { MarketSelector } from "@/components/international/MarketSelector";

import React, { useEffect, useState } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, Search, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useCart } from "@/components/CartProvider";
import { WholesaleNavButton } from "@/components/wholesale/WholesaleNavButton";
import { CustomerNavButton } from "@/components/customer/CustomerNavButton";
import { QuickSearchModal } from "@/components/QuickSearchModal";
import type { HomepageContent } from "@/lib/homepageSchema";
import type { SiteNavigation } from "@/lib/contentBlocks";

export const DEFAULT_BRAND = "TEAFLOWW";
export const DEFAULT_TAGLINE = "Himalayan Single-Estate Teas";
export const DEFAULT_NAV = [
  { label: "Shop Tea", href: "/shop" },
  { label: "Leaf to Cup", href: "/leaf-to-cup" },
  { label: "Black Teas", href: "/collections/black-tea" },
  { label: "Wholesale & Bulk", href: "/wholesale" },
  { label: "Blend Lab", href: "/blend-lab" },
  { label: "Tea Finder", href: "/tea-finder" },
  { label: "Trials & Samples", href: "/trials" },
];

export interface AnnouncementData {
  text?: string;
  highlight?: string;
  link_url?: string;
  link_label?: string;
  wholesale_label?: string;
  enabled?: boolean;
}

export interface StorefrontHeaderProps {
  content?: HomepageContent | null;
  announcement?: AnnouncementData | null;
  navigation?: SiteNavigation | null;
  showAnnouncement?: boolean;
}

export function StorefrontHeader({
  content,
  announcement,
  navigation,
  showAnnouncement = true,
}: StorefrontHeaderProps) {
  const pathname = usePathname();
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isStuck, setIsStuck] = useState(false);

  // Keyboard escape listener for mobile drawer
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Global Cmd+K / Ctrl+K shortcut to open quick search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Scroll detection fallback for sticky compact state across all browsers
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsStuck(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const brand = navigation?.brand || content?.brand || DEFAULT_BRAND;
  const tagline = navigation?.tagline || content?.tagline || DEFAULT_TAGLINE;

  // Determine navigation items defensively
  const rawNav =
    navigation?.header_links && navigation.header_links.length > 0
      ? navigation.header_links
      : content?.navigation && content.navigation.length > 0
      ? content.navigation
      : DEFAULT_NAV;

  // Ensure craft story "Leaf to Cup" is always discoverable if using custom nav without it
  const navItems = [...rawNav];
  if (
    content?.navigation &&
    content.navigation.length > 0 &&
    !navItems.some((link) => link.href === "/leaf-to-cup")
  ) {
    // Insert right after the first item (e.g. Shop/All Teas)
    navItems.splice(1, 0, { label: "Leaf to Cup", href: "/leaf-to-cup" });
  }

  const isAnnEnabled = showAnnouncement && announcement?.enabled !== false;
  const annHighlight = announcement?.highlight || "Discover your next tea ritual";

  return (
    <>
      {isAnnEnabled && (
        <div
          className="announcement tf-announcement"
          role="region"
          aria-label="Announcement"
        >
          <div className="ritual-container tf-announcement-inner">
            {announcement?.link_url ? (
              <Link href={announcement.link_url} className="tf-announcement-highlight hover:underline">
                {annHighlight}
              </Link>
            ) : (
              <span className="tf-announcement-highlight">
                {annHighlight}
              </span>
            )}
            <span className="tf-announcement-divider" aria-hidden="true">
              |
            </span>
            <Link href="/track" className="tf-announcement-link"> <StorefrontText id="copy_73a75653065cfd73" fallback="Track Order" /> </Link>
            <span className="tf-announcement-divider" aria-hidden="true">
              |
            </span>
            <Link href="/contact" className="tf-announcement-link"> <StorefrontText id="copy_b79cac926e0b2e34" fallback="Help" /> </Link>
            <span className="tf-announcement-divider" aria-hidden="true">
              |
            </span>
            <span className="tf-announcement-country"><MarketSelector /></span>
          </div>
        </div>
      )}

      <header
        className={`site-header ritual-header ${isStuck ? "is-stuck" : ""}`}
      >
        <div className="ritual-container ritual-nav-row">
          {/* Mobile hamburger button */}
          <button
            className="icon-button ritual-menu"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Brand Logo & Editorial Wordmark */}
          <Link
            href="/"
            className="ritual-brand"
          >
            <BrandLogo
              variant="symbol"
              size={34}
              aria-hidden={true}
              className="ritual-brand-emblem"
            />
            <span className="ritual-brand-text">
              <span className="ritual-brand-name">{brand}</span>
              {" "}
              {tagline && <small className="ritual-brand-tagline">{tagline}</small>}
            </span>
            <span className="sr-only"> <StorefrontText id="copy_a5c5a15eec449ca1" fallback="homepage" /></span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            id="main-navigation"
            className={`ritual-nav ${menuOpen ? "open" : ""}`}
            aria-label="Main navigation"
          >
            {navItems
              .filter((link) => link.label && link.href)
              .map((link, i) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" && pathname?.startsWith(link.href));
                const isWholesale =
                  link.href === "/wholesale" ||
                  link.label.toLowerCase().includes("wholesale");

                return (
                  <Link
                    key={`${link.href}-${i}`}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`ritual-nav-link ${isActive ? "is-active" : ""} ${
                      isWholesale ? "ritual-nav-wholesale-link" : ""
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            {menuOpen && (
              <div className="ritual-mobile-auth-links mt-4 pt-3 border-t border-[#e6dfd2] flex flex-col gap-2">
                <Link
                  href="/account/orders"
                  onClick={() => setMenuOpen(false)}
                  className="text-xs font-semibold text-[#1d2a24] hover:text-[#23483a] py-1"
                >
                  📦 My Orders
                </Link>
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="text-xs font-semibold text-[#1d2a24] hover:text-[#23483a] py-1"
                >
                  👤 My Account
                </Link>
              </div>
            )}
            {menuOpen && (
              <div className="ritual-mobile-market-selector mt-2 pt-2 border-t border-[#e6dfd2]">
                <MarketSelector />
              </div>
            )}
          </nav>

          {/* Action Suite: Wholesale Pill, Quick Search, Shopping Bag, Customer Account */}
          <div className="ritual-nav-actions">
            <WholesaleNavButton />

            <button
              type="button"
              className="icon-button tf-nav-action-btn tf-search-btn"
              aria-label="Search teas (⌘K)"
              title="Search teas (⌘K)"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={19} strokeWidth={1.6} />
            </button>

            <CustomerNavButton />

            <Link
              href="/cart"
              className="icon-button ritual-bag tf-nav-action-btn tf-bag-btn"
              aria-label={`Shopping bag with ${count} items`}
              title={`Shopping bag with ${count} items`}
            >
              <ShoppingBag size={19} strokeWidth={1.6} />
              <span data-testid="cart-count" aria-hidden="true">
                {count}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Modern Accessible Instant Quick Search Drawer */}
      <QuickSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
