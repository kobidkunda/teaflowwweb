"use client";

import React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { RitualHeader } from "@/components/home/RitualHeader";
import { RitualFooter } from "@/components/home/RitualFooter";
import { CartProvider } from "@/components/CartProvider";
import { WholesaleProvider } from "@/components/wholesale/WholesaleContext";

// Deferred below-the-fold / interrupt-driven widgets: both render null
// (modal) or fixed-position (floating trigger) on first paint, so loading
// them after hydration cannot shift layout — but it keeps their JS out of
// the initial bundle and off the critical main-thread path.
const WholesaleFloatingTrigger = dynamic(
  () =>
    import("@/components/wholesale/WholesaleFloatingTrigger").then(
      (m) => m.WholesaleFloatingTrigger
    ),
  { ssr: false }
);
const LeadCaptureModal = dynamic(
  () =>
    import("@/components/cart/LeadCaptureModal").then((m) => m.LeadCaptureModal),
  { ssr: false }
);
import { QuickVariantModal } from "@/components/cart/QuickVariantModal";
import { AddToCartPrompt } from "@/components/cart/AddToCartPrompt";

/**
 * StorefrontShell manages layout wrapping between public storefront routes and
 * administrative routes. Admin portal routes (/admin/*) are isolated from customer
 * storefront headers, navigation bars, and footers.
 */
import type { HomepageContent } from "@/lib/homepageSchema";
import type { AnnouncementData } from "@/components/StorefrontHeader";
import type { SiteNavigation } from "@/lib/contentBlocks";
import type { FooterCategory, FooterBlog } from "@/components/Footer";

export function StorefrontShell({
  children,
  content,
  announcement,
  navigation,
  categories,
  footerBlogs,
}: {
  children: React.ReactNode;
  content: HomepageContent | null;
  announcement?: AnnouncementData | null;
  navigation?: SiteNavigation | null;
  categories?: FooterCategory[];
  footerBlogs?: FooterBlog[];
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) {
    return (
      <main id="main-content" tabIndex={-1} style={{ display: "contents" }}>
        {children}
      </main>
    );
  }

  return (
    <CartProvider>
      <WholesaleProvider>
        {pathname === "/" ? (
          <RitualHeader
            content={content}
            announcement={announcement}
            navigation={navigation}
          />
        ) : (
          <Header
            content={content}
            announcement={announcement}
            navigation={navigation}
          />
        )}
        <main
          id="main-content"
          tabIndex={-1}
          // Keep the footer below the first viewport while Next streams the
          // homepage. A short Suspense fallback must not expose it at first paint.
          style={pathname === "/" ? { minHeight: "100svh" } : undefined}
        >
          {children}
        </main>
        {pathname === "/" ? (
          <RitualFooter
            content={content}
            navigation={navigation}
            categories={categories}
            blogs={footerBlogs}
          />
        ) : (
          <Footer
            content={content}
            navigation={navigation}
            categories={categories}
            blogs={footerBlogs}
          />
        )}
        <WholesaleFloatingTrigger />
        <LeadCaptureModal />
        <AddToCartPrompt />
        <QuickVariantModal />
      </WholesaleProvider>
    </CartProvider>
  );
}
