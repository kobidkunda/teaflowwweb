# Technical SEO Architecture Specification — Himalayan Tea House

**Version:** 2026-10-11  
**Framework:** Next.js 15 (App Router) + React 19 + TypeScript (Strict Mode)  
**Database:** SQLite 3 (WAL Mode, parameterized queries via `better-sqlite3`)  
**Site Host:** `https://himalayantea.com`

---

## 1. Next.js App Router Rendering Architecture

Himalayan Tea House employs a strictly Server-First rendering paradigm designed to satisfy search engine crawlers, GEO retrieval systems, and Core Web Vitals performance benchmarks:

1. **Server Components by Default:**
   * Primary route layouts (`src/app/layout.tsx`, `src/app/page.tsx`, `src/app/shop/page.tsx`, `src/app/tea/[slug]/page.tsx`, `src/app/collections/[slug]/page.tsx`, `src/app/learn/[slug]/page.tsx`) execute exclusively on the Node.js server.
   * 100% of primary editorial copy, prices, tasting notes, harvest flush data, semantic H1–H3 headings, image alt attributes, and JSON-LD structured data scripts are embedded directly into the initial server HTML stream.
   * Search crawlers (Googlebot, Bingbot) and AI indexing bots never encounter blank client shells, deferred loading spinners, or JavaScript hydration delays for critical indexable data.

2. **Small Interactive Client Components:**
   * Interactivity is isolated to small client leaves (e.g. `VariantPicker.tsx`, `ProductGallery.tsx`, `ShopExplorer.tsx`, `PDPInteractiveTabs.tsx`).
   * Price and inventory display in client components is reconciled against immutable server properties to prevent client-side price tampering.

---

## 2. Canonical URL Architecture & Normalization

All public canonical URLs follow strict engineering rules implemented in `src/lib/seo/canonical.ts`:

* **Protocol & Domain:** Strictly absolute HTTPS (`https://himalayantea.com`).
* **Path Case:** Strictly normalized lowercase (e.g., `/tea/darjeeling-spring`).
* **Trailing Slash Discipline:** No trailing slash on subpaths (e.g. `/shop`, not `/shop/`), while root is `/`.
* **Parameter Stripping:**
  * All ephemeral marketing and attribution parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid`, `msclkid`, `ref`, `session_id`, `_ga`) are stripped from canonical links.
  * Functional filters on `/shop` collapse cleanly to the canonical index `/shop`, while dedicated category pages maintain self-referencing canonicals at `/collections/[slug]`.
* **Canonical Overrides:** Admin catalog entities support explicit `canonical_override` fields for syndication or cross-domain canonicalization.

---

## 3. Crawlability & Robots Directives (`/robots.txt`)

Configured dynamically via `src/app/robots.ts` using Next.js Metadata Route conventions:

```txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /checkout/
Disallow: /cart/
Disallow: /order/
Disallow: /api/
Disallow: /track

Sitemap: https://himalayantea.com/sitemap.xml
```

### Rationale:
* **Private Cart & Checkout:** Transactional customer screens (`/cart`, `/checkout`, `/order/*`) are excluded from crawling to prevent index bloat and eliminate customer PII exposure risk.
* **Administrative Operations:** All `/admin/*` and internal `/api/*` endpoints are barred from crawling.
* **Public Resources:** All images, stylesheets, fonts, and client JavaScript bundles are freely accessible so search engine renderers can compute layout geometry and visual stability.

---

## 4. XML Sitemap Architecture (`/sitemap.xml`)

Implemented dynamically in `src/app/sitemap.ts` via `getCatalogSitemapEntries()` (`src/lib/seo/sitemap.ts`):

* **Content Inclusions:**
  * Core hub templates: `/`, `/shop`, `/learn`, `/compare`, `/about`, `/contact`, `/locations/siliguri`, `/shipping`, `/returns`, `/privacy`, `/terms`, `/feeds`.
  * All active catalogue products: `/tea/[slug]` where `noindex = 0`.
  * All active category hubs: `/collections/[slug]` where `is_active = 1` and `noindex = 0`.
  * All published educational guides: `/learn/[slug]` where `status = 'published'` and `noindex = 0`.
  * All comparative articles: `/compare/[slug]`.
* **Lastmod Authenticity:**
  * `<lastmod>` timestamps reflect verified substantive modifications (e.g. product `harvest_date` or article `updated_at` / `published_at`).
  * Never artificially generates `new Date()` on every crawl request for static archives.
* **Priority Weighting:**
  * Homepage: `1.0` (daily)
  * Shop Index: `0.9` (daily)
  * Product Detail Pages: `0.8` (weekly)
  * Educational Guides & Local Hub: `0.7`–`0.8` (monthly/weekly)
  * Trust & Legal: `0.3`–`0.6` (yearly/monthly)

---

## 5. HTTP Status Codes & Error Semantics

* **200 OK:** Served for all valid public storefront routes containing substantive content.
* **404 Not Found:** Served by `src/app/not-found.tsx` for unknown routes or invalid product slugs. We never return a "soft 404" (a 200 response with an error message).
* **301 / 308 Permanent Redirects:** Employed for moved resources or legacy URL migration paths without redirect loops or chains.
* **500 / 503 Service Behavior:** Graceful fallback boundaries via `src/app/error.tsx` and `src/app/global-error.tsx`.

---

## 6. Core Web Vitals (CWV) Performance Strategy

| Metric | Target | Technical Implementation |
| :--- | :--- | :--- |
| **LCP (Largest Contentful Paint)** | ≤ 2.5s | • Above-the-fold hero images use `next/image` with `priority` and `sizes` attributes.<br>• Next-generation WebP/AVIF formats served with explicit intrinsic aspect ratios.<br>• Preconnect hints to origin asset servers. |
| **INP (Interaction to Next Paint)** | ≤ 200ms | • Critical interactivity (variant switching, tab changes) handled with minimal React state changes.<br>• Avoid expensive main-thread computations during user input.<br>• Client bundle size maintained under 130 kB first-load JS. |
| **CLS (Cumulative Layout Shift)** | ≤ 0.1 | • Strict aspect-ratio containers (`aspect-4/3`, `aspect-square`) on all gallery cards and carousels.<br>• Font fallback metrics matched to system serif and sans-serif fonts to eliminate FOUT/FOIT layout jumps. |

---

## 7. Migration & Redirect Rules

When retiring legacy routes or migrating external catalog URLs, apply permanent 301 redirects in Next.js configuration (`next.config.ts`):

```typescript
// next.config.ts redirect mapping template
async redirects() {
  return [
    {
      source: '/products/:slug',
      destination: '/tea/:slug',
      permanent: true,
    },
    {
      source: '/blogs/news/:slug',
      destination: '/learn/:slug',
      permanent: true,
    },
    {
      source: '/collections/all',
      destination: '/shop',
      permanent: true,
    },
  ];
}
```
