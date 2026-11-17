import { SITE_CONFIG, getSiteUrl, getDynamicSiteConfig } from "./site";
import { buildCanonicalUrl } from "./canonical";
import { formatPackagingLabel, type Product, type Variant } from "@/lib/productModels";
import type { TrialPublicDto } from "@/lib/trials/types";
import type { PublicPackagingDetailResponse } from "@/lib/private-label/schemas";
import {
  resolveProductCommercePolicy,
  type ProductPolicyOverrides,
  type ResolvedProductCommercePolicy,
} from "./productPolicy";
import type { ProductReview, ReviewSummary } from "@/lib/reviews";

function resolveImageUrl(siteUrl: string, rawUrl: string): string {
  return /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : `${siteUrl}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
}

function defaultPriceValidUntil(): string {
  return `${new Date().getUTCFullYear() + 1}-12-31`;
}

function buildReturnPolicyNode(policy: ResolvedProductCommercePolicy) {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: policy.applicableCountry,
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: policy.returnWindowDays,
    returnMethod: `https://schema.org/${policy.returnMethod}`,
    returnFees: `https://schema.org/${policy.returnFees}`,
    url: policy.returnPolicyUrl,
  };
}

function buildShippingDetailsNode(
  policy: ResolvedProductCommercePolicy,
  itemPricePaise: number
) {
  const ratePaise = policy.computeShippingRatePaise(itemPricePaise);
  return {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: (ratePaise / 100).toFixed(2),
      currency: policy.currency,
    },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: policy.applicableCountry,
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: policy.handlingDaysMin,
        maxValue: policy.handlingDaysMax,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: policy.transitDaysMin,
        maxValue: policy.transitDaysMax,
        unitCode: "DAY",
      },
    },
  };
}

function buildOfferNode(options: {
  id: string;
  sku: string;
  url: string;
  pricePaise: number;
  inStock: boolean;
  policy: ResolvedProductCommercePolicy;
  eligibleMinQuantity?: number;
}) {
  const { id, sku, url, pricePaise, inStock, policy, eligibleMinQuantity } = options;
  return {
    "@type": "Offer",
    "@id": id,
    sku,
    url,
    price: (pricePaise / 100).toFixed(2),
    priceCurrency: policy.currency,
    itemCondition: "https://schema.org/NewCondition",
    availability: inStock
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    priceValidUntil: defaultPriceValidUntil(),
    seller: {
      "@type": "Organization",
      name: policy.sellerName,
    },
    ...(eligibleMinQuantity && eligibleMinQuantity > 0
      ? {
          eligibleQuantity: {
            "@type": "QuantitativeValue",
            minValue: eligibleMinQuantity,
            unitCode: "C62",
          },
        }
      : {}),
    shippingDetails: buildShippingDetailsNode(policy, pricePaise),
    hasMerchantReturnPolicy: buildReturnPolicyNode(policy),
  };
}

function buildReviewNodes(
  policy: ResolvedProductCommercePolicy,
  reviews: ProductReview[] = []
): Record<string, unknown> {
  const summary = policy.reviewSummary;
  if (!summary || summary.reviewCount <= 0 || summary.ratingValue <= 0) {
    return {};
  }

  const out: Record<string, unknown> = {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: summary.ratingValue.toFixed(1),
      reviewCount: summary.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
  };

  if (reviews.length > 0) {
    out.review = reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: r.reviewer_name,
      },
      datePublished: r.created_at ? r.created_at.slice(0, 10) : undefined,
      name: r.title || undefined,
      reviewBody: r.body,
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
    }));
  }

  return out;
}

/**
 * Returns JSON-LD Organization and OnlineStore schema representing the brand entity.
 * Includes store-wide MerchantReturnPolicy per Google Merchant Listing guidelines.
 */
export function getOrganizationSchema() {
  const siteUrl = getSiteUrl();
  const config = getDynamicSiteConfig();
  const policy = resolveProductCommercePolicy({ siteUrlOverride: siteUrl });

  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "OnlineStore"],
    "@id": `${siteUrl}/#organization`,
    name: config.name || SITE_CONFIG.name,
    legalName: config.legalName || SITE_CONFIG.legalName,
    url: siteUrl,
    logo: `${siteUrl}/images/logo.png`,
    description: config.description || SITE_CONFIG.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: config.address.streetAddress,
      addressLocality: config.address.addressLocality,
      addressRegion: config.address.addressRegion,
      postalCode: config.address.postalCode,
      addressCountry: config.address.addressCountry,
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: config.contact.telephone,
        contactType: config.contact.contactType,
        email: config.contact.email,
        availableLanguage: config.contact.availableLanguage,
      },
    ],
    hasMerchantReturnPolicy: buildReturnPolicyNode(policy),
    sameAs: [...config.sameAs],
  };
}

/**
 * Returns JSON-LD LocalBusiness and Store schema for the Siliguri Works &
 * packaging facility (AGENTS.md source of truth).
 */
export function getLocalBusinessSchema() {
  const siteUrl = getSiteUrl();
  const config = getDynamicSiteConfig();
  const storeName = config.name || SITE_CONFIG.name;

  return {
    "@context": "https://schema.org",
    "@type": ["Store", "LocalBusiness"],
    "@id": `${siteUrl}/locations/siliguri#store`,
    name: `${storeName} — Siliguri Tasting Room & Sourcing Hub`,
    image: `${siteUrl}/images/about/siliguri-packaging-craft.jpg`,
    url: `${siteUrl}/locations/siliguri`,
    telephone: config.contact.telephone,
    email: config.contact.email,
    priceRange: "₹₹",
    currenciesAccepted: config.currency || "INR",
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
      name: storeName,
      url: siteUrl,
    },
  };
}

/**
 * Returns JSON-LD WebSite schema with SearchAction for the homepage.
 */
export function getWebsiteSchema() {
  const siteUrl = getSiteUrl();
  const config = getDynamicSiteConfig();
  const storeName = config.name || SITE_CONFIG.name;

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: storeName,
    description: config.description || SITE_CONFIG.description,
    inLanguage: SITE_CONFIG.defaultLocale,
    publisher: {
      "@type": "Organization",
      name: storeName,
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

export interface ProductSchemaOptions {
  policy?: ResolvedProductCommercePolicy;
  reviewSummary?: ReviewSummary | null;
  reviews?: ProductReview[];
}

/**
 * Returns JSON-LD Product or ProductGroup schema for a catalog tea item.
 * - Multi-variant products emit Google-compliant `ProductGroup` with `hasVariant`
 *   so Google Search shows accurate price ranges (`₹min to ₹max`), per-SKU stock,
 *   per-variant shipping cost (`₹0.00` when free-shipping eligible), delivery days,
 *   and return policy.
 * - Single-variant products emit `Product` with an `Offer`.
 * - Verified `aggregateRating` / `review` are emitted ONLY when real approved reviews exist.
 */
export function getProductSchema(
  product: Product,
  variants: Variant[] = [],
  images: Array<{ url: string; alt_text?: string }> = [],
  options: ProductSchemaOptions = {}
) {
  const siteUrl = getSiteUrl();
  const canonicalUrl = buildCanonicalUrl(`/tea/${product.slug}`);

  const policy =
    options.policy ||
    resolveProductCommercePolicy({
      entityType: "product",
      entityId: product.id,
      overrides: product,
      reviewSummary: options.reviewSummary,
      siteUrlOverride: siteUrl,
    });

  const imageUrls: string[] = [];
  if (images.length > 0) {
    for (const img of images) {
      if (img.url) {
        imageUrls.push(resolveImageUrl(siteUrl, img.url));
      }
    }
  } else if (product.primary_image?.url) {
    imageUrls.push(resolveImageUrl(siteUrl, product.primary_image.url));
  } else {
    imageUrls.push(`${siteUrl}/images/product-darjeeling-tin.jpg`);
  }

  const activeVariants = variants.length > 0 ? variants : product.variants || [];
  const description =
    product.description || `${product.name} single-estate orthodox tea from ${product.origin}.`;

  const additionalProperty = [
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
  ];

  const reviewNodes = buildReviewNodes(policy, options.reviews || []);

  if (activeVariants.length > 1) {
    const hasVariant = activeVariants.map((v) => {
      const formatLabel = formatPackagingLabel(v.packaging_format);
      const variantUrl = `${canonicalUrl}?sku=${encodeURIComponent(v.sku)}`;
      const variantImg = v.product_image_url
        ? resolveImageUrl(siteUrl, v.product_image_url)
        : imageUrls[0];

      return {
        "@type": "Product",
        "@id": `${canonicalUrl}#variant-product-${v.sku}`,
        sku: v.sku,
        name: `${product.name} — ${formatLabel} (${v.grams}g)`,
        description,
        image: variantImg ? [variantImg] : imageUrls,
        size: `${v.grams}g`,
        material: formatLabel,
        weight: {
          "@type": "QuantitativeValue",
          value: v.grams,
          unitCode: "GRM",
        },
        url: variantUrl,
        brand: {
          "@type": "Brand",
          name: policy.brandName,
        },
        offers: buildOfferNode({
          id: `${canonicalUrl}#variant-${v.sku}`,
          sku: v.sku,
          url: variantUrl,
          pricePaise: v.price_paise,
          inStock: v.stock > 0,
          policy,
        }),
      };
    });

    return {
      "@context": "https://schema.org",
      "@type": "ProductGroup",
      "@id": `${canonicalUrl}#product`,
      productGroupID: product.slug,
      name: product.name,
      description,
      url: canonicalUrl,
      image: imageUrls,
      category: `${product.category} Tea`,
      brand: {
        "@type": "Brand",
        name: policy.brandName,
      },
      variesBy: ["https://schema.org/size", "https://schema.org/material"],
      hasVariant,
      additionalProperty,
      ...reviewNodes,
    };
  }

  const singleVariant = activeVariants[0];
  const fallbackPaise = product.price_paise && product.price_paise > 0 ? product.price_paise : 0;
  const offer = singleVariant
    ? buildOfferNode({
        id: `${canonicalUrl}#variant-${singleVariant.sku}`,
        sku: singleVariant.sku,
        url: `${canonicalUrl}?sku=${encodeURIComponent(singleVariant.sku)}`,
        pricePaise: singleVariant.price_paise,
        inStock: singleVariant.stock > 0,
        policy,
      })
    : fallbackPaise > 0
    ? buildOfferNode({
        id: `${canonicalUrl}#offer`,
        sku: product.slug.toUpperCase(),
        url: canonicalUrl,
        pricePaise: fallbackPaise,
        inStock: (product.inventory ?? 0) > 0,
        policy,
      })
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: product.name,
    description,
    url: canonicalUrl,
    image: imageUrls,
    category: `${product.category} Tea`,
    brand: {
      "@type": "Brand",
      name: policy.brandName,
    },
    ...(singleVariant?.sku ? { sku: singleVariant.sku } : {}),
    ...(singleVariant?.grams
      ? {
          weight: {
            "@type": "QuantitativeValue",
            value: singleVariant.grams,
            unitCode: "GRM",
          },
        }
      : {}),
    ...(offer ? { offers: offer } : {}),
    additionalProperty,
    ...reviewNodes,
  };
}

/**
 * Returns full Schema.org Product JSON-LD for a Trial Kit (/trials/[slug]),
 * including OfferShippingDetails, MerchantReturnPolicy, and conditional AggregateRating.
 */
export function getTrialProductSchema(
  trial: TrialPublicDto,
  options: ProductSchemaOptions = {}
) {
  const siteUrl = getSiteUrl();
  const canonicalUrl = buildCanonicalUrl(`/trials/${trial.slug}`);
  const policy =
    options.policy ||
    resolveProductCommercePolicy({
      entityType: "trial",
      entityId: trial.id,
      overrides: trial.policy_overrides,
      reviewSummary: options.reviewSummary,
      siteUrlOverride: siteUrl,
    });

  const images: string[] = [];
  if (trial.hero_image?.url) {
    images.push(resolveImageUrl(siteUrl, trial.hero_image.url));
  }
  for (const g of trial.gallery_images || []) {
    if (g.url) {
      const resolved = resolveImageUrl(siteUrl, g.url);
      if (!images.includes(resolved)) images.push(resolved);
    }
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: trial.title,
    description: trial.description || trial.tagline || trial.title,
    url: canonicalUrl,
    ...(images.length > 0 ? { image: images } : {}),
    sku: trial.sku,
    category: "Tea Trial Kit",
    brand: {
      "@type": "Brand",
      name: policy.brandName,
    },
    weight: {
      "@type": "QuantitativeValue",
      value: trial.net_weight_g || 200,
      unitCode: "GRM",
    },
    offers: buildOfferNode({
      id: `${canonicalUrl}#offer`,
      sku: trial.sku,
      url: canonicalUrl,
      pricePaise: trial.price_paise,
      inStock: trial.in_stock,
      policy,
    }),
    ...buildReviewNodes(policy, options.reviews || []),
  };
}

/**
 * Returns full Schema.org Product JSON-LD for a Private Label Packaging Variant
 * (/private-label/packaging/[slug]), including production lead time + shipping & returns.
 */
export function getPackagingProductSchema(
  variant: PublicPackagingDetailResponse,
  overrides?: ProductPolicyOverrides | null,
  options: ProductSchemaOptions = {}
) {
  const siteUrl = getSiteUrl();
  const canonicalUrl = buildCanonicalUrl(`/private-label/packaging/${variant.slug}`);
  const displayTitle = variant.title || variant.name || "Custom Packaging";
  const displayCapacity =
    variant.capacity_description || `${variant.net_weight_capacity_grams}g`;

  const policy =
    options.policy ||
    resolveProductCommercePolicy({
      entityType: "packaging",
      entityId: variant.id,
      overrides,
      extraHandlingDays: variant.lead_time_days || 14,
      reviewSummary: options.reviewSummary,
      siteUrlOverride: siteUrl,
    });

  const heroImage = variant.hero_image_url
    ? resolveImageUrl(siteUrl, variant.hero_image_url)
    : `${siteUrl}/images/packaging-fallback.png`;
  const unitPricePaise = variant.starting_price?.unit_price_paise ?? 0;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: displayTitle,
    description: `Food-grade ${variant.material} structure with ${variant.finish} finish. Net capacity ${displayCapacity}.`,
    url: canonicalUrl,
    image: [heroImage],
    sku: variant.sku || variant.slug,
    category: `Tea Packaging / ${variant.category || variant.family || "Pouch"}`,
    material: variant.material,
    brand: {
      "@type": "Brand",
      name: policy.brandName,
    },
    offers: buildOfferNode({
      id: `${canonicalUrl}#offer`,
      sku: variant.sku || variant.slug,
      url: canonicalUrl,
      pricePaise: unitPricePaise,
      inStock: true,
      policy,
      eligibleMinQuantity: variant.moq_units || 500,
    }),
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Exterior Dimensions",
        value: `${variant.dimensions_mm?.width || 0}mm (W) x ${variant.dimensions_mm?.height || 0}mm (H)`,
      },
      {
        "@type": "PropertyValue",
        name: "Label Safe Area",
        value: `${variant.label_safe_area_mm?.width || 0}mm (W) x ${variant.label_safe_area_mm?.height || 0}mm (H)`,
      },
      {
        "@type": "PropertyValue",
        name: "Net Tea Capacity",
        value: `${displayCapacity} (~${variant.net_weight_capacity_grams}g)`,
      },
      {
        "@type": "PropertyValue",
        name: "Closure Type",
        value: variant.closure_type || "Heat Seal",
      },
      {
        "@type": "PropertyValue",
        name: "Minimum Order Quantity",
        value: `${variant.moq_units || 500} units`,
      },
      {
        "@type": "PropertyValue",
        name: "Order Multiple",
        value: `${variant.order_multiple || 50} units`,
      },
      {
        "@type": "PropertyValue",
        name: "Production Lead Time",
        value: `${variant.lead_time_days || 14} business days`,
      },
    ],
    ...buildReviewNodes(policy, options.reviews || []),
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
  pathOverride?: string;
}) {
  const siteUrl = getSiteUrl();
  const config = getDynamicSiteConfig();
  const storeName = config.name || SITE_CONFIG.name;
  const articlePath = article.pathOverride
    ? article.pathOverride
    : article.slug.startsWith("compare/") || article.slug.startsWith("/compare/")
    ? `/${article.slug.replace(/^\/+/, "")}`
    : `/blog/${article.slug.replace(/^\/+/, "")}`;
  const canonicalUrl = buildCanonicalUrl(articlePath);

  let coverImage = `${siteUrl}/images/tea-education-hero.jpg`;
  if (article.cover_image_url) {
    coverImage = resolveImageUrl(siteUrl, article.cover_image_url);
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
      name: storeName,
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
  const config = getDynamicSiteConfig();
  const storeName = config.name || SITE_CONFIG.name;
  const canonicalUrl = buildCanonicalUrl(categoryPath);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonicalUrl}#collection`,
    name: `${categoryName} | ${storeName}`,
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
