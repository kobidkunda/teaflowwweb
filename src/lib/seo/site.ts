import { getStoreSettings } from "@/lib/storeSettings";

export const SITE_CONFIG = {
  name: "Himalayan Tea House",
  legalName: "Himalayan Tea House Private Limited",
  brand: "Himalayan Tea House",
  tagline: "Orthodox & CTC Teas from Origin",
  description:
    "Direct-from-origin single-estate orthodox teas harvested in Darjeeling, Assam, Kangra, and Nilgiri. Graded, cupped, and packaged at origin in Siliguri to preserve high-mountain aromatics.",
  defaultLocale: "en-IN",
  currency: "INR",
  currencySymbol: "₹",
  defaultOgImage: "/images/og-himalayan-tea-house.jpg",

  // Real business location & contact
  // NOTE: Operator-managed values in `store_settings` override these fallbacks
  // at runtime via getDynamicSiteConfig(). AGENTS.md lists the canonical
  // TeaFloww/Nirva contact facts — update them via /admin/settings or MCP
  // (store.updateSettings), not by editing this fallback, to avoid breaking
  // feed/MCP/schema contracts covered by unit tests.
  address: {
    streetAddress: "Hill Cart Road, Near Tea Auction Centre, Matigara",
    addressLocality: "Siliguri",
    addressRegion: "West Bengal",
    postalCode: "734010",
    addressCountry: "IN",
  },
  geo: {
    latitude: 26.7271,
    longitude: 88.3953,
  },
  contact: {
    email: "support@himalayantea.com",
    telephone: "+91-353-2570112",
    contactType: "customer service",
    availableLanguage: ["English", "Hindi", "Bengali", "Nepali"],
  },
  openingHours: [
    "Mo-Sa 09:00-18:00",
  ],

  // Sourcing & Shipping details
  shipping: {
    minDeliveryOrderPaise: 0,
    freeShippingThresholdPaise: 150000, // ₹1,500.00
    flatRatePaise: 9900, // ₹99.00
    dispatchCommitment: "24-48 hours from Siliguri hub",
    courierPartners: ["Blue Dart", "Delhivery", "India Post Speed Post"],
  },
  returns: {
    windowDays: 14,
    policyDescription:
      "14-day freshness and transit resolution guarantee. Unopened tins or items damaged in transit are replaced or refunded upon inspection.",
  },

  // Social & verification links
  sameAs: [
    "https://www.instagram.com/himalayanteahouse",
    "https://twitter.com/himalayantea",
    "https://www.facebook.com/himalayanteahouse",
  ],
} as const;

/**
 * Resolves the primary base URL of the storefront.
 * Prioritizes configured environment variables and falls back to canonical domain.
 */
export function getSiteUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.APP_BASE_URL ||
    process.env.FEED_BASE_URL;

  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  if (typeof process !== "undefined" && process.cwd && process.cwd().includes("teafloww")) {
    return "https://teafloww.com";
  }

  return "https://himalayantea.com";
}

/**
 * Returns dynamic site configuration merged with real-time store settings.
 */
export function getDynamicSiteConfig() {
  try {
    const s = getStoreSettings();
    return {
      name: s.store_name || SITE_CONFIG.name,
      legalName: s.legal_name || SITE_CONFIG.legalName,
      brand: s.brand_name || SITE_CONFIG.brand,
      tagline: s.brand_tagline || SITE_CONFIG.tagline,
      description: s.brand_description || SITE_CONFIG.description,
      defaultLocale: SITE_CONFIG.defaultLocale,
      currency: s.currency || SITE_CONFIG.currency,
      currencySymbol: s.currency === "INR" ? "₹" : "$",
      defaultOgImage: SITE_CONFIG.defaultOgImage,
      address: {
        streetAddress: s.address_street || SITE_CONFIG.address.streetAddress,
        addressLocality: s.address_city || SITE_CONFIG.address.addressLocality,
        addressRegion: s.address_region || SITE_CONFIG.address.addressRegion,
        postalCode: s.address_postal_code || SITE_CONFIG.address.postalCode,
        addressCountry: s.address_country || SITE_CONFIG.address.addressCountry,
      },
      geo: SITE_CONFIG.geo,
      contact: {
        email: s.contact_email || SITE_CONFIG.contact.email,
        telephone: s.telephone || SITE_CONFIG.contact.telephone,
        contactType: SITE_CONFIG.contact.contactType,
        availableLanguage: SITE_CONFIG.contact.availableLanguage,
      },
      openingHours: [s.opening_hours || SITE_CONFIG.openingHours[0]],
      shipping: {
        minDeliveryOrderPaise: s.min_delivery_order_paise,
        freeShippingThresholdPaise: s.free_shipping_threshold_paise,
        flatRatePaise: s.shipping_flat_fee_paise,
        dispatchCommitment: s.dispatch_commitment || SITE_CONFIG.shipping.dispatchCommitment,
        courierPartners: SITE_CONFIG.shipping.courierPartners,
      },
      returns: {
        windowDays: s.return_window_days || SITE_CONFIG.returns.windowDays,
        policyDescription: s.guarantee_description || SITE_CONFIG.returns.policyDescription,
      },
      sameAs: [
        s.social_instagram || SITE_CONFIG.sameAs[0],
        s.social_twitter || SITE_CONFIG.sameAs[1],
        s.social_facebook || SITE_CONFIG.sameAs[2],
        ...(s.social_youtube ? [s.social_youtube] : []),
      ],
    };
  } catch {
    return SITE_CONFIG;
  }
}

