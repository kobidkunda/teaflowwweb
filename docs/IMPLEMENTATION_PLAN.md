# Full Implementation Plan

## Objective
Build an editorial, mobile-first, high-performance premium tea DTC storefront with trustworthy sourcing, strong discovery and an uncomplicated checkout. The included code implements a functional development baseline. Production features are clearly separated below.

## Technology
Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4 plus design-token CSS, SQLite via better-sqlite3, Zod validation, Lucide icons, Vitest unit tests and Playwright E2E.

## Phase 0 — Foundation (implemented as starter)
1. App Router and shared layout.
2. Warm-paper/forest design tokens and responsive layout.
3. SQLite products, variants, orders and order_items.
4. Idempotent database seeding.
5. Server-rendered catalogue and product details.
6. Client cart and variant selection.
7. Demo order API with Zod validation, stock checks, server-side price recalculation and idempotency.
8. Unit tests, E2E screenshot tests and design previews.

Acceptance: local app starts after npm install and npm run db:setup; homepage, shop, PDP, cart, Tea Finder, gifts and demo checkout can be navigated. This acceptance must be verified locally; it has not been executed in the authoring environment.

## Phase 1 — Production commerce
- Choose deployment with persistent database or migrate to managed PostgreSQL.
- Add proper migration runner and backups.
- Build admin authentication, RBAC and audit logs.
- Payment integration: create payment intent/order server-side, verify signed gateway webhook, reconcile order totals, handle retries and refunds.
- Atomic inventory reservations and fulfillment transitions.
- Indian shipping service, GST/tax rules, address validation, serviceable PIN codes and tracking.
- Guest checkout and secure order lookup.
- Rate limiting, CSP, CSRF considerations, privacy/retention, fraud controls and monitoring.
- Real product assets, validated source claims and customer policies.

Exit criteria: verified test payments, no double charges, accurate stock under concurrent orders, working refunds, transactional messages, full accessibility audit.

## Phase 2 — Signature experiences
- Tea Passport with real lots, estates, producer records, harvest and packing dates.
- Taste Map with controlled sensory vocabulary and accessible comparison.
- Tea Finder with deterministic explainable scoring and preference consent.
- Gift Atelier with packaging choices and corporate quote flow.
- Review intelligence, discovery flights, real delivery estimates.
- Origin and estate editorial pages with provenance evidence.

## Phase 3 — Retention
- Subscriptions, skips/swaps/cancellations and payment token handling.
- Wishlist, taste profile, Tea Society, saved brewing recipes.
- Post-purchase tracking and reorder flows.
- Analytics, cohort retention and experimentation.

## Implemented file map
src/app/page.tsx — Homepage.
src/app/shop/page.tsx — Catalogue and filters.
src/app/tea/[slug]/page.tsx — Product detail.
src/app/gifts/page.tsx — Gift collection.
src/app/tea-finder/page.tsx — Guided recommendation.
src/app/cart/page.tsx — Shopping bag.
src/app/checkout/page.tsx — Demo checkout.
src/app/order/[id]/page.tsx — Demo confirmation.
src/app/api/products/route.ts — Product API.
src/app/api/checkout/route.ts — Demo order API.
src/app/api/health/route.ts — Health check.
src/app/admin — Full-page zero-modal admin console (Products, Categories, Orders, Visitors, Blogs, MCP, Settings, Coupons, Staff).
src/app/api/admin — Authenticated administrative REST endpoints with Zod validation.
src/components — Shared layout and commerce components.
src/components/admin — Admin shell, sidebar, mobile drawer, topbar, multi-image uploader, markdown editor, MCP bench, analytics.
src/lib — Database, products, productModels, money, validation, checkout, uploads, coupons, mcp.
scripts — SQLite setup, migrations (001–009), seed, backup, restore.
tests — Unit and E2E tests (Vitest 523 tests across 29 suites; Playwright E2E).
docs/ui — Design previews and screenshot capture.

## UI component status
Implemented: Header, Footer, ProductCard, AddToCart, VariantPicker, CartProvider, TasteMap, TeaPassport, TeaFinder, CheckoutForm, responsive page sections, AdminShell, AdminSidebar, AdminMobileDrawer, AdminTopBar, MultiImageUploader, MarkdownEditor, McpDashboard, AnalyticsCharts.
Planned: CartDrawer, MegaMenu, FilterSheet, Wishlist, CompareTray, DeliveryEstimator, ReviewGallery, GiftAtelierBuilder, BrewTimer, OriginMap, SubscriptionPanel, and live payment gateway UI.

## Nonfunctional targets
- WCAG 2.2 AA
- LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 at p75
- Server-side prices and validation
- Payment idempotency and verified webhooks
- Reliable backup/restore
- No false scarcity or unsupported sourcing claims

## Risks
SQLite is unsuitable for horizontally scaled serverless hosting without a suitable persistence strategy. Better-sqlite3 is Node-only, not Edge. The demo checkout is deliberately not a live payment solution. Seed data is fictional. The UI previews are mockups; Playwright must be run for actual screenshots.

## Release gate
Do not enable live sales until P0 production items in TODO.md are completed and independently verified.

### Selected homepage design (option 3)
The homepage now uses the sensory editorial layout selected in Product Design:
a forest still-life hero, category-linked image panels, and three featured
catalogue products with working quick-add controls. `/admin/homepage` manages
all editorial content, image uploads, navigation and footer fields. The optional
packaging fallback is explicitly illustrative. Migration 012 populates the
selected design without rewriting existing operator content. Live commerce
release gates remain as listed above.

Homepage completion (reference follow-up): retain approved option 3 hero; expand to four category tiles and four catalogue product cards; add admin-controlled lifestyle/philosophy split, shopping guidance strip, genuine approved testimonial/empty community state and newsletter signup. New optimized local story/newsletter artwork is decorative AI imagery. Migration 013 is additive; online backup required before applying. Runtime never reads migration seed files as marketing fallbacks.

Completion validation: final isolated check passed (42 test files, 690 tests, production build); full reference/browser comparison and 1385/768/390/320 px real browser captures reviewed. Local newsletter signup saved consent and returned success. No production deployment or email campaign was performed.

## International commerce implementation (2026-10-16)

Local code now covers country/currency/language preferences; market readiness and
country disabling; exact minor-unit conversion and expiring server quotes; India
flat/free/PIN/state delivery policies and COD; international shipping and landed-cost
adapter contracts; Razorpay order/webhook/refund handling; reservations; signed guest
status; admin-approved fulfillment; regional campaigns; and reviewed AI translation
jobs with source hashes, revisions, English fallback and Arabic direction support.

Markets and COD default to disabled. Native domestic shipping and account-specific
international adapters require actual merchant configuration. No sample exchange
rates or fabricated customs/shipping costs stand in for unavailable APIs. Live account
verification, production database restore/migration checks, and deployment remain
operator steps. See `docs/INTERNATIONAL_COMMERCE.md` and final validation notes in
`docs/TESTING.md`.

## Blend Lab workshop redesign (2026-10-31)

The selected Product Design option 3 is implemented in the existing `/blend-lab`
route: paper/forest editorial hero, interactive business-goal selection, four
photographic testing stages (including infusion), an expandable report example,
and catalogue-backed plan selection. Six optimized, local WebP images are
AI-generated illustrations; disclosures distinguish them from facility photography
and real customer results. The page relies on the existing StorefrontShell for
one header, main landmark and footer. It retains admin-authored hero copy/images
and FAQs, current prices, GST rates, entitlements and intake URLs. Only the exact
original starter headline receives the selected design's replacement headline;
custom operator headlines remain unchanged. No database schema, payment flow,
production service or dependencies were changed. See `design-qa.md` and the
Blend Lab workshop notes in `docs/TESTING.md` for validation evidence.

## Homepage Blend Lab invitation (2026-10-31)

Selected homepage-section option 1 replaces only `BlendLabDiscoverySection` with
a warm full-bleed still life, editorial headline, concise service explanation,
three-step journey and links to `/blend-lab` and `/blend-lab#method`. The previous
static scores, verification badge, savings claim and hardcoded teaser price are
removed. Existing content-block and image-placement overrides remain available;
exact starter headlines map to the selected design headline. Styles are scoped
in `HomeBlendLab.module.css`. No other homepage components, database schema,
commerce code or dependencies were changed. The new photo is an AI illustration
with visible disclosure. Source/render evidence is in `docs/ui/home-blend-invitation`.

## Compact homepage tea shelf — option 1 (2026-10-31)

Redesigned SignatureBlendsCarousel with compact photo-left mobile rows, warm paper styling, stronger prices and forest Quick Add buttons. Desktop retains its carousel. Existing product photographs, catalogue order, authoritative prices and cart/wishlist behavior remain. Removed fabricated slug-based merchandising badges and misleading fallback imagery; added product-specific purchase labels. Styles are scoped in SignatureBlendsShelf.module.css. No new dependencies, schema or API changes. Evidence: docs/ui/compact-tea-shelf; final comparison record: design-qa.md.

## Trials discovery shelf — selected option 2 (2026-11-07)

Redesigned the existing `/trials` landing route with a compact photographic hero,
sidebar search/filtering, two-column multi-kit catalogue and an adaptive horizontal
single-kit state. Each listing shows all four tea names/weights, current price,
availability and the existing kit-detail link. Seeded tasting/provenance claims and
raw taglines are omitted from listings. The exact known seeded landscape image
receives disclosed conceptual packaging; uploaded assets remain unchanged.

Native FAQ, loading/error states, keyboard focus and paginated load-more states
are included. Existing database, public DTO, admin workflows, product details,
checkout, header and footer are preserved. No migrations, dependencies or deployment.
See `design-qa.md` and `docs/ui/trials-discovery` for source and browser evidence.

## Homepage sample-kit invitation — option 3 (2026-11-07)

Replaced the dense HomeTrialsSection product showcase with the selected centered
editorial invitation, wide tasting-table artwork and one collection link to `/trials`.
Separate mobile artwork keeps all four cup/pouch pairs visible. The section no
longer adds a featured kit to cart or publishes seeded guarantees and cup-yield claims.

Added default-compatible homepage JSON fields for desktop/mobile image paths,
alt text, caption, title ending and supporting text. Existing admin Trials Flights
editor now exposes both image upload/library/path controls with exact dimensions,
matching crop previews, accessible alt text and fallback guidance. Existing HTTP
and MCP read/save tools use the same validation and return media_guidance.trials;
MCP discovery describes the paths and sizes. The live editor simulation uses the
selected desktop/mobile image for its own viewport toggle. No DB schema change.

Recommended sources: desktop 1920×720 (8:3), mobile 960×1080 (8:9), WebP/JPEG under
400KB preferred. See docs/ui/home-trials-invitation/README.md and design-qa.md.

### Homepage trial navigation correction — 2026-11-07

The sample-kit invitation now links to `/trials#top` so opening the collection
explicitly requests the page top even when navigating from deep in the homepage.
No global scroll-reset effect was added; browser history restoration remains
managed by Next. Added a desktop/mobile browser regression specification.

## Product Tea Moments — 2026-11-07

Replaced the product provenance dossier with opt-in, curated Tea Moments across
desktop tabs, All Overview and mobile accordions. Product admin now edits the
moment, serving suggestion, pairing and portrait image rather than sourcing.
Hidden sourcing values and external integrations are preserved. Added nullable
JSON-text storage via migration 037, shared validation and HTTP/MCP read/write
parity. See `docs/TEA_MOMENTS.md` for migration, backup and isolated preview steps.
No production deployment or automatic editorial backfill.
