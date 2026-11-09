# Schema.org Structured Data Coverage Map — Himalayan Tea House

**Version:** 2026-10-11  
**Syntax:** JSON-LD (`application/ld+json`)  
**Specification Baseline:** Schema.org v26 + Google Search Central Merchant Guidelines (2026 Update)

---

## 1. Schema Deployment Matrix by Route Template

| Template | Route | Schema Types | Schema IDs (`@id`) | Key Properties |
| :--- | :--- | :--- | :--- | :--- |
| **Root Layout** | Everywhere | `Organization`, `OnlineStore` | `https://himalayantea.com/#organization` | `name`, `legalName`, `url`, `logo`, `address`, `contactPoint`, `sameAs` |
| **Root Layout & Local Hub** | `/`, `/locations/siliguri` | `Store`, `LocalBusiness` | `https://himalayantea.com/locations/siliguri#store` | `name`, `address`, `geo`, `openingHoursSpecification`, `telephone`, `priceRange` |
| **Product Detail (PDP)** | `/tea/[slug]` | `Product`, `Offer`, `BreadcrumbList` | `https://himalayantea.com/tea/[slug]#product` | `name`, `image`, `description`, `category`, `brand`, `offers` (per variant with price, currency, SKU, availability, shippingDetails, returnPolicy) |
| **Collection Hubs** | `/collections/[slug]`, `/shop` | `CollectionPage`, `ItemList`, `BreadcrumbList` | `https://himalayantea.com/collections/[slug]#collection` | `name`, `description`, `numberOfItems`, `itemListElement` (position, name, URL) |
| **Educational Guides** | `/learn/[slug]` | `Article`, `BreadcrumbList` | `https://himalayantea.com/learn/[slug]#article` | `headline`, `description`, `author`, `publisher`, `datePublished`, `dateModified`, `image`, `mainEntityOfPage` |
| **Tea Comparisons** | `/compare/[slug]` | `Article`, `BreadcrumbList` | `https://himalayantea.com/compare/[slug]#article` | `headline`, `description`, `author`, `publisher`, `datePublished`, `mainEntityOfPage` |

---

## 2. Product & Offer Schema Specification

On every Product Detail Page (`/tea/[slug]`), the server emits structured data synchronized with the SQLite database:

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": "https://himalayantea.com/tea/darjeeling-spring#product",
  "name": "Darjeeling Spring Clonal First Flush",
  "description": "Delicate and vibrant, this First Flush offers a light golden liquor with floral notes, a fresh vegetal sweetness and a lingering, crisp finish.",
  "image": [
    "https://himalayantea.com/images/product-darjeeling-tin.jpg"
  ],
  "category": "Black Tea",
  "brand": {
    "@type": "Brand",
    "name": "Himalayan Tea House"
  },
  "offers": [
    {
      "@type": "Offer",
      "@id": "https://himalayantea.com/tea/darjeeling-spring#variant-DJ-SP-100G",
      "sku": "DJ-SP-100G",
      "url": "https://himalayantea.com/tea/darjeeling-spring?sku=DJ-SP-100G",
      "price": "950.00",
      "priceCurrency": "INR",
      "itemCondition": "https://schema.org/NewCondition",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "Himalayan Tea House"
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "99.00",
          "currency": "INR"
        },
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "IN"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 1,
            "maxValue": 2,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 2,
            "maxValue": 5,
            "unitCode": "DAY"
          }
        }
      },
      "hasMerchantReturnPolicy": {
        "@type": "MerchantReturnPolicy",
        "applicableCountry": "IN",
        "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
        "merchantReturnDays": 14,
        "returnMethod": "https://schema.org/ReturnByMail",
        "returnFees": "https://schema.org/FreeReturn"
      }
    }
  ],
  "additionalProperty": [
    {
      "@type": "PropertyValue",
      "name": "Origin",
      "value": "Darjeeling, India"
    },
    {
      "@type": "PropertyValue",
      "name": "Estate",
      "value": "Risheehat"
    },
    {
      "@type": "PropertyValue",
      "name": "Harvest Flush",
      "value": "Spring First Flush"
    }
  ]
}
```

---

## 3. Strict Compliance Guardrails (Zero Fake Data)

1. **Strict Exclusion of Deprecated FAQ Schema:**
   * Google deprecated `FAQPage` rich results for general commercial websites in August 2023, restricting it exclusively to authoritative government and healthcare domains.
   * Himalayan Tea House **strictly avoids** generating `FAQPage` markup on commercial or product routes to eliminate search console warnings and algorithmic spam flags.

2. **Zero Fabricated Reviews or Ratings:**
   * We never include `aggregateRating`, `ratingValue`, or `reviewCount` unless supported by real, cryptographically verifiable third-party buyer reviews.
   * Inventing star ratings is an explicit violation of Google Search Quality Rater Guidelines and Section 0 of our Master Implementation Specification.

3. **No Fictitious GTINs:**
   * Single-estate agricultural lots do not carry global barcode identifiers. We strictly output authentic internal `sku` identifiers rather than fake `gtin13` or `isbn` fields.

4. **Synchronized Feed Data:**
   * Price figures in JSON-LD (`price`), Google Merchant XML feeds (`<g:price>`), and visible PDP storefront UI are generated from the identical source of truth in SQLite (`price_paise / 100`).

---

## 4. Organization & Local Business Schema

```json
{
  "@context": "https://schema.org",
  "@type": ["Store", "LocalBusiness"],
  "@id": "https://himalayantea.com/locations/siliguri#store",
  "name": "Himalayan Tea House — Siliguri Tasting Room & Sourcing Hub",
  "image": "https://himalayantea.com/images/siliguri-tasting-room.jpg",
  "url": "https://himalayantea.com/locations/siliguri",
  "telephone": "+91-353-2570112",
  "email": "support@himalayantea.com",
  "priceRange": "₹₹",
  "currenciesAccepted": "INR",
  "paymentAccepted": "Cash, Credit Card, UPI, Net Banking",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Hill Cart Road, Near Tea Auction Centre, Matigara",
    "addressLocality": "Siliguri",
    "addressRegion": "West Bengal",
    "postalCode": "734010",
    "addressCountry": "IN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 26.7271,
    "longitude": 88.3953
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      "opens": "09:00",
      "closes": "18:00"
    }
  ]
}
```
