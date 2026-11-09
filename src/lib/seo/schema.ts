import { SITE_CONFIG, getSiteUrl } from "./site";
import { buildCanonicalUrl } from "./canonical";
import type { Product, Variant } from "@/lib/productModels";

/**
 * Returns JSON-LD Organization and OnlineStore schema representing Himalayan Tea House.
 */
export function getOrganizationSchema() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "OnlineStore"],
    "@id": `${siteUrl}/#organization`,
    name: SITE_CONFIG.name,
    legalName: SITE_CONFIG.legalName,
    url: siteUrl,
    logo: `${siteUrl}/images/logo.png`,
    description: SITE_CONFIG.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE_CONFIG.address.streetAddress,
      addressLocality: SITE_CONFIG.address.addressLocality,
      addressRegion: SITE_CONFIG.address.addressRegion,
      postalCode: SITE_CONFIG.address.postalCode,
      addressCountry: SITE_CONFIG.address.addressCountry,
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: SITE_CONFIG.contact.telephone,
        contactType: SITE_CONFIG.contact.contactType,
        email: SITE_CONFIG.contact.email,
        availableLanguage: SITE_CONFIG.contact.availableLanguage,
      },
    ],
    sameAs: [...SITE_CONFIG.sameAs],
  };
}

/**
 * Returns JSON-LD LocalBusiness and Store schema for the Siliguri Works &
 * packaging facility (AGENTS.md source of truth). The Organization schema
 * above uses the registered office; this Store uses the Works address.
 */
export function getLocalBusinessSchema() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": ["Store", "LocalBusiness"],
    "@id": `${siteUrl}/locations/siliguri#store`,
    name: `${SITE_CONFIG.name} — Siliguri Tasting Room & Sourcing Hub`,
    image: `${siteUrl}/images/siliguri-tasting-room.jpg`,
    url: `${siteUrl}/locations/siliguri`,
    telephone: SITE_CONFIG.contact.telephone,
    email: SITE_CONFIG.contact.email,
    priceRange: "₹₹",
    currenciesAccepted: "INR",
    paymentAccepted: "Cash, Credit Card, UPI, Net Banking",
    address: {
      "@type": "PostalAddress",
      streetAddress: "00, Fulbari Ghoshpukur Bypass, Fulbari, Binnaguri",
      addressLocality: "Siliguri",
      addressRegion: "West Bengal",
      postalCode: "734015",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: SITE_CONFIG.geo.latitude,
      longitude: SITE_CONFIG.geo.longitude,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    parentOrganization: {
      "@type": "Organization",
      name: SITE_CONFIG.name,
      url: siteUrl,
    },
  };
}

/**
 * Returns JSON-LD WebSite schema with SearchAction for the homepage.
 * Enables sitelinks searchbox eligibility; no fabricated claims.
 */
export function getWebsiteSchema() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    inLanguage: SITE_CONFIG.defaultLocale,
    publisher: {
      "@type": "Organization",
      name: SITE_CONFIG.name,
      url: siteUrl,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/shop?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Returns JSON-LD Product schema for a catalog tea item with individual variant Offers.
 * Complies strictly with Google Merchant Center specifications.
 * Excludes fabricated reviews, fake aggregate ratings, and deprecated FAQ schema.
 */
export function getProductSchema(
  product: Product,
  variants: Variant[] = [],
  images: Array<{ url: string; alt_text?: string }> = []
) {
  const siteUrl = getSiteUrl();
  const canonicalUrl = buildCanonicalUrl(`/tea/${product.slug}`);

  const imageUrls: string[] = [];
  if (images.length > 0) {
    for (const img of images) {
      if (img.url) {
        imageUrls.push(
          /^https?:\/\//i.test(img.url) ? img.url : `${siteUrl}${img.url.startsWith("/") ? "" : "/"}${img.url}`
        );
      }
    }
  } else if (product.primary_image?.url) {
    const url = product.primary_image.url;
    imageUrls.push(/^https?:\/\//i.test(url) ? url : `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`);
  } else {
    imageUrls.push(`${siteUrl}/images/product-darjeeling-tin.jpg`);
  }

  const activeVariants = variants.length > 0 ? variants : product.variants || [];

  const offers = activeVariants.map((v) => {
    const variantPrice = (v.price_paise / 100).toFixed(2);
    const inStock = v.stock > 0;

    return {
      "@type": "Offer",
      "@id": `${canonicalUrl}#variant-${v.sku}`,
      sku: v.sku,
      url: `${canonicalUrl}?sku=${encodeURIComponent(v.sku)}`,
      price: variantPrice,
      priceCurrency: SITE_CONFIG.currency,
      itemCondition: "https://schema.org/NewCondition",
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: SITE_CONFIG.name,
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: (SITE_CONFIG.shipping.flatRatePaise / 100).toFixed(2),
          currency: SITE_CONFIG.currency,
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "IN",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: 2,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 2,
            maxValue: 5,
            unitCode: "DAY",
          },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "IN",
        returnPolicyCategory:
          "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: SITE_CONFIG.returns.windowDays,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: product.name,
    description: product.description || `${product.name} single-estate orthodox tea from ${product.origin}.`,
    image: imageUrls,
    category: `${product.category} Tea`,
    brand: {
      "@type": "Brand",
      name: SITE_CONFIG.brand,
    },
    offers: offers.length === 1 ? offers[0] : offers,
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Origin",
        value: product.origin,
      },
      {
        "@type": "PropertyValue",
        name: "Estate",
        value: product.estate,
      },
      {
        "@type": "PropertyValue",
        name: "Harvest Flush",
        value: product.flush,
      },
      ...(product.elevation_display
        ? [
            {
              "@type": "PropertyValue",
              name: "Elevation",
              value: product.elevation_display,
            },
          ]
        : []),
      ...(product.cultivar
        ? [
            {
              "@type": "PropertyValue",
              name: "Cultivar",
              value: product.cultivar,
            },
          ]
        : []),
    ],
  };
}

/**
 * Returns JSON-LD BreadcrumbList schema.
 */
export function getBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => {
      const fullUrl = /^https?:\/\//i.test(item.url)
        ? item.url
        : `${siteUrl}${item.url.startsWith("/") ? "" : "/"}${item.url}`;

      return {
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: fullUrl,
      };
    }),
  };
}

/**
 * Returns JSON-LD Article schema for educational guides and connoisseur articles.
 */
export function getArticleSchema(article: {
  slug: string;
  title: string;
  summary?: string | null;
  content: string;
  author_name?: string | null;
  cover_image_url?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
}) {
  const siteUrl = getSiteUrl();
  const canonicalUrl = buildCanonicalUrl(`/blog/${article.slug}`);

  let coverImage = `${siteUrl}/images/tea-education-hero.jpg`;
  if (article.cover_image_url) {
    coverImage = /^https?:\/\//i.test(article.cover_image_url)
      ? article.cover_image_url
      : `${siteUrl}${article.cover_image_url.startsWith("/") ? "" : "/"}${article.cover_image_url}`;
  }

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonicalUrl}#article`,
    headline: article.title,
    description: article.summary || article.title,
    image: [coverImage],
    datePublished: article.published_at || new Date().toISOString(),
    dateModified: article.updated_at || article.published_at || new Date().toISOString(),
    author: {
      "@type": "Person",
      name: article.author_name || "Tashi Bhutia, Master Tea Sommelier",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_CONFIG.name,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/images/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
  };
}

/**
 * Returns JSON-LD CollectionPage schema for category hubs and catalogue listings.
 */
export function getCollectionSchema(
  categoryName: string,
  categoryDescription: string,
  categoryPath: string,
  products: Product[] = []
) {
  const siteUrl = getSiteUrl();
  const canonicalUrl = buildCanonicalUrl(categoryPath);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonicalUrl}#collection`,
    name: `${categoryName} | ${SITE_CONFIG.name}`,
    description: categoryDescription,
    url: canonicalUrl,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((p, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${siteUrl}/tea/${p.slug}`,
        name: p.name,
      })),
    },
  };
}
