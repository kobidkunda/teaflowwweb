# SEO & GEO Strategy Specification — Himalayan Tea House

**Version:** 2026-10-11  
**Brand:** Himalayan Tea House (`https://himalayantea.com`)  
**Operating Entity:** Himalayan Tea House Private Limited  
**Headquarters & Tasting Room:** Hill Cart Road, Matigara, Siliguri, Darjeeling District, West Bengal 734010, India  
**Audience:** Specialty tea connoisseurs, whole-leaf orthodox collectors, high-mountain flush enthusiasts, culinary professionals, and mindful gift buyers.

---

## 1. Executive Summary & Brand Positioning

Himalayan Tea House is a direct-from-origin orthodox tea purveyor dedicated to preserving truthful sourcing, radical harvest freshness, and uncompromising sensory excellence. By eliminating the multi-layered colonial brokerage system and packaging every harvest batch directly at our Siliguri headquarters within 24–48 hours of lot firing, we deliver orthodox teas with their full, volatile aromatic bouquet intact.

### Non-Negotiable Editorial & Technical Mandate
* **Zero Fabricated Claims:** We never invent reviews, aggregate star ratings, false inventory scarcity counters, artificial countdown clocks, or fictitious GTIN barcodes.
* **Truth in Sourcing:** Every tea is traceable to its verified partner estate (Risheehat, Giddapahar, Upper Assam, Kangra, Nilgiri), harvest flush, elevation, and lot invoice.
* **Server-Rendered First:** App Router Server Components deliver 100% of primary content, canonical tags, Open Graph meta, and Schema.org JSON-LD in the initial HTTP response.
* **Search Engine & Generative Engine Optimization (GEO):** Clear semantic HTML, unambiguous facts, verifiable citations, and structured data serve human buyers, Google/Bing search crawlers, and AI-driven retrieval systems alike.

---

## 2. Target Personas & Search Intents

| Persona | Core Needs | Primary Search Queries | Destination URLs |
| :--- | :--- | :--- | :--- |
| **Orthodox Connoisseur** | Terroir specifics, clonal cultivars, cupping scores, harvest flush dates | `buy darjeeling first flush online`, `giddapahar high mountain oolong`, `assam orthodox whole leaf` | `/tea/darjeeling-spring`, `/tea/giddapahar-oolong`, `/collections/black` |
| **Mindful Daily Drinker** | Brisk morning strength, digestive teas, antioxidant purity, sustainable packaging | `best breakfast tea india`, `single origin assam black tea`, `kangra valley spring green` | `/tea/assam-golden-breakfast`, `/tea/kangra-green`, `/shop` |
| **Tea Student / Brewer** | Precise brewing temperatures, leaf doses, understanding flushes and oxidation | `how to brew assam tea`, `darjeeling first flush guide`, `tea cupping protocol`, `orthodox vs ctc` | `/learn/how-to-brew-assam-tea`, `/learn/darjeeling-first-flush-guide`, `/learn/tea-cupping-guide` |
| **Curious Explorer** | Comparing regional taste profiles, selecting between flushes, finding personal match | `assam vs darjeeling tea`, `orthodox vs green tea`, `first flush vs second flush` | `/compare/assam-vs-darjeeling-tea`, `/compare/first-flush-vs-second-flush`, `/tea-finder` |
| **Tasting Room Visitor** | Visiting Siliguri, experiencing physical tea cupping in the Darjeeling district | `tea tasting siliguri`, `darjeeling tea sourcing hub matigara`, `himalayan tea house location` | `/locations/siliguri`, `/contact`, `/about` |

---

## 3. Topical Clusters & Architecture

```
                    [Homepage /]
                         │
      ┌──────────────────┼──────────────────┬─────────────────┐
      │                  │                  │                 │
 [Shop Index /shop]  [Learn Hub /learn]  [Compare Hub]  [Trust & Local]
      │                  │                  │                 │
 ┌────┴────┐        ┌────┴────┐        ┌────┴────┐       ┌────┴────┐
 │Collections│      │Brewing Guides│   │Comparisons│      │Locations│
 │/collections/     │/learn/how-to-    │/compare/        │/locations/
 │black             │brew-assam        │assam-vs-        │siliguri
 │green             │darjeeling-flush  │darjeeling       │
 │oolong            │cupping-guide     │orthodox-vs-green│/about
 │chai              │orthodox-vs-ctc   │first-vs-second  │/contact
 └────┬────┘        └─────────┘        └─────────┘       │/shipping
      │                                                  │/returns
 [PDP /tea/:slug]                                        │/privacy
                                                         │/terms
```

### Pillar 1: Single-Estate Origin Catalog (`/shop`, `/collections/*`, `/tea/*`)
* **Focus:** Deep commercial intent for specific flushes, origins, and leaf grades (FTGFOP1, SFTGFOP).
* **Execution:** Each product page features structured data (`Product`, `Offer`), 6-axis cupping radar metrics, interactive steeping calculators, and certified lot numbers.

### Pillar 2: Connoisseurship & Brewing Academy (`/learn`, `/learn/*`)
* **Focus:** Informational and educational queries. Captures high-intent enthusiasts early in their buying journey.
* **Execution:** Authored by licensed tea sommelier Tashi Bhutia with complete `Article` schema, water temperature tables, and direct contextual product links.

### Pillar 3: Objective Technical Comparisons (`/compare`, `/compare/*`)
* **Focus:** Commercial investigation and decision stage.
* **Execution:** Side-by-side matrices evaluating terroir elevation, liquor color, caffeine intensity, and food pairings.

### Pillar 4: Provenance, Ethics & Local Authority (`/about`, `/contact`, `/locations/*`, policies)
* **Focus:** E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) and local SEO signals.
* **Execution:** Demonstrates physical presence at the foot of Darjeeling in Siliguri, direct relationships with tea garden managers, transparent shipping and return policies.

---

## 4. GEO & Generative AI Search Strategy

Google Search Generative Experience (SGE), Perplexity, Claude, and ChatGPT search systems prioritize verifiable, logically organized factual content:
1. **Unambiguous Data Extraction:** Key specs (brew temperature, steep time, elevation, lot number, origin) are rendered in semantic HTML definitions (`<dl>`, `<table>`, `<p>`) rather than obscured inside client-only JavaScript states.
2. **Entity Consistency:** The brand entity "Himalayan Tea House" is anchored with stable `@id` URIs in Schema.org JSON-LD (`https://himalayantea.com/#organization` and `https://himalayantea.com/locations/siliguri#store`).
3. **Topical Completeness:** Educational guides present direct, definitive answers to questions ("What temperature should Assam tea be brewed at? 95°C–98°C") followed by detailed terroir rationale.

---

## 5. Ongoing Monitoring & KPI Milestones

* **Crawl Health:** Zero 5xx errors; 100% of indexable URLs returning HTTP 200 with matching canonicals; sitemap submission in Google Search Console and Bing Webmaster Tools.
* **Core Web Vitals:** LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 across mobile and desktop.
* **Organic Performance:** Visibility in high-intent queries (e.g., "single estate darjeeling", "assam orthodox tea online"); tracking in Google Search Console Search & Generative AI reports.
