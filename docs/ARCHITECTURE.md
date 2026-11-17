# Architecture and Data Flow

## Public trade pilot discovery — 2026-11-18
`publicTradePilots` excludes explicit E2E titles, inactive/incomplete locations and duplicate town/collection-point/address combinations without mutating stored records. `listTradeSharedPilots(true)` applies it for public API/page parity; admin `false` listing keeps all records. `TradePilotLocations` repeats the display guard and renders one accessible collection-enquiry action for a localized location list, or no section when empty. No schema or deployment changes.

## Tea shops optional hero animation — 2026-11-18
The deferred loader retries on visibility, pageshow and connection changes if its initial check was skipped, while preventing duplicate download attempts.

`TradeHeroArt` keeps the existing priority still image and its layout. After window load plus a 500ms yield, it preloads `/images/tea-shops/masala-chai-pour-loop.gif` only on visible pages reporting at least 4GB device memory, four logical processors, a 4g effective connection and 5 Mbps downlink, without Data Saver or reduced motion. Unknown capability signals retain the still (including browsers without these APIs). The supplied GIF is copied unchanged from `docs/logo/Animated Masala Chai Pour Loop.gif`. Successful decoding enables a decorative overlay; failure retains the still. A keyboard-accessible English/Hindi pause/play button switches back to the still. Changes to reduced motion or connection eligibility remove the overlay. No dependencies, schema or production changes.

## Tea business launch studio — 2026-11-18
`src/components/business/starter/` composes the existing business landing experience with small client-side planner and budget interactions. Planner state renders a live preview, supports a text download, and enters the existing editable enquiry note only when the visitor chooses that handoff. Existing consent, API validation and idempotency govern submission. State resets on refresh; there is no saved-progress store. Budget values stay local and are excluded from enquiry payloads.

`src/lib/business/launchCapital.ts` validates user amount strings and sums integer paise. All seven budget categories must be complete; unknown freight/tax remain pending. The existing contribution calculator supports prepared-chai unit costs. Neither calculator supplies authoritative trade prices. Server catalogue samples, administrator copy/offers and commerce validation retain their existing authority. No database/schema, dependency or deployment changes are required. Product and surface context: `../PRODUCT.md` and `ui/start-tea-business/launch-studio.md`.


Browser → Next.js App Router → server-side product queries → SQLite.
Browser cart is localStorage-based; it is a convenience cache, not a pricing authority.
Browser demo checkout → POST /api/checkout → Zod validation → SQLite transaction → order ID.
Server reads variant prices and stock. The demo never collects payment or decrements stock.

## Tables
products: slug, name, type, origin, estate, flush, harvest, description, sensory attributes and brewing defaults.
variants: product FK, SKU, weight, price in paise, sample stock.
orders: UUID, idempotency key, guest contact/address, totals, demo status.
order_items: order FK, variant FK, quantity, server-confirmed unit price.

## API
GET /api/products?q=&category= returns product/variant catalogue.
GET /api/health returns SQLite availability.
GET /feeds/google.xml (alias /api/feeds/google-merchant) returns Google Merchant Center compliant RSS 2.0 XML feed.
GET /feeds/catalog.csv (alias /api/feeds/meta) returns Meta Catalog compliant RFC 4180 CSV spreadsheet.
POST /api/checkout accepts name, email, address, UUID idempotencyKey and items [{variantId,quantity}].
Success: 201 with orderId, totalPaise, demo_unpaid and paymentCollected:false.
Invalid input: 400. Unavailable stock: 409. Internal error: 500.
POST /api/admin/inventory (authenticated) sets inventory to an exact quantity by product id/slug or SKU/variantId; product mode updates all variants (creating one default 100g variant when none exist). Same contract is exposed to operators as the MCP `inventory.updateStock` tool.

## Security
All SQL uses bound parameters. Checkout never trusts submitted prices. IDs are UUIDs. No payment credentials are stored. Current demo order links are not an authorization model; add authenticated or signed order access before production. PII is stored locally only for the demo; use sample details and implement retention/deletion before real use.

## Deployment
Persistent writable Node.js filesystem required. Use a single instance with backups for SQLite or migrate to managed relational database for scale. Never store production DB in ephemeral serverless storage.

## Production payment state machine (planned)
draft → payment_pending → paid → preparing → shipped → delivered.
Failure states: payment_failed, cancelled, refunded, returned.
Only a verified payment webhook may transition payment_pending to paid. Make every transition idempotent and auditable.

## Homepage editorial content (option 3 redesign)
The homepage and its dedicated header/footer consume the validated `homepage_content_v1` JSON
record in `store_settings` through `src/lib/homepage.ts`. No homepage marketing copy or
artwork path falls back to a component constant. Other routes retain their existing shared shell. Featured products, current variant
prices, stock and primary images still come from the catalogue. Discovery panels
reference category IDs and disappear when those categories are inactive or absent.
The root layout is dynamic so published editorial edits are read on new requests.

Authenticated `GET/PUT /api/admin/homepage` serves the editor at `/admin/homepage`.
PUT validates a strict Zod schema, allows only local links/images, and stores a
single atomic record with bound SQL parameters. Errors never expose database details.
Hero, discovery, shelf, navigation, disclosure and footer fields are all editable;
image fields support the existing validated media uploader. The previous homepage
slider/story placements are preserved in the database; this design uses the new
Homepage editor as its editorial source.

Migration 012 inserts the initial selected design only if that content key is
absent. It resolves category IDs from slugs and never overwrites operator edits.
No schema tables or catalogue records are changed by this migration. Take an
online backup with `npm run db:backup` before applying `npm run db:migrate`.
Restore with the existing documented restore procedure if operational rollback is
needed; do not silently edit a deployed schema.

Homepage completion adds optional, validated story, benefits, community and newsletter sections to the existing admin settings document. Migration 013 inserts missing fields without replacing operator edits, adds up to two missing category links, and creates private `newsletter_subscriptions` storage. Public content projection strips unapproved testimonials before rendering or passing data to client components. Operators must obtain consent and verify a quote before approving publication; no reviews or ratings are seeded.

`POST /api/newsletter` validates email and explicit consent, rejects cross-origin requests and oversized input, applies a per-process burst limit, and inserts normalized email/consent wording with parameterized SQL. Duplicate submissions return the same non-identifying result. There is no public subscriber-read endpoint, email delivery integration or claim of double opt-in. A delivery provider and unsubscribe/retention workflow are required before sending a campaign.

Content migration 014 corrects only the demo Masala Chai image association that reused an Assam-labelled tin. It leaves uploaded replacements unchanged, clears the stale media reference, and preserves product/variant IDs, stock and prices. Its pre-migration online backup is the rollback mechanism.

## Product enable/disable control

`products.is_enabled` is independent of draft/published/archived status. Additive
migration 028 defaults existing and new products to enabled, retaining product,
variant, image and order records. Authenticated, rate-limited
`PATCH /api/admin/products/[id]/availability` accepts only `{ enabled: boolean }`,
checks the request origin and sets the flag idempotently using bound SQL.
Normal `/admin/products` lists enabled products; the “Disabled products only”
switch shows disabled products with the same search, status, category and stock
filters. The list fetches every API page, including catalogues over 100 products.
Public lists, product pages, shopping feeds and sitemap omit disabled products;
checkout rejects saved cart items for disabled products. Signed-in admins can
preview disabled product pages. Re-enabling never changes publication status.

Before applying 028 to a deployed database, take a verified database backup
(SQLite: `npm run db:backup`; production PostgreSQL: `pg_dump` and a restore
check), then apply the versioned migration through the existing deployment
procedure. PostgreSQL uses the same integer flag and additive `ALTER TABLE` in
`scripts/migrate-to-postgres.mjs`. Restore the backup for data rollback; do not
drop the column on a running deployment. Local migration was applied after a
backup; no production changes were made for this feature.

## Product publication and variant-specific images

Authenticated `PATCH /api/admin/products/[id]/publication` accepts only
`{ status: "draft" | "published" }`. “Make live” sets published status and enables
the product explicitly; “Move to draft” hides it through the existing publication
filter. Both use exact assignments and leave stock, pricing and gallery intact.
The product list and details page expose these actions.

Additive migration 029 stores `product_images.variant_skus` as a JSON array of
pack SKUs. An image can match multiple variants; an empty list means it is shared.
The admin product form and details-page image editor support checkbox selection;
newly uploaded images initially select the first variant. Images can be saved
independently through authenticated `PUT /api/admin/products/[id]/images`.
Validation rejects malformed, duplicate and foreign-product SKUs. Gallery
replacement is transactional, and the canonical product upsert now wraps product,
variant and gallery writes in one transaction, retaining the previous data if
an image assignment fails. Omitted galleries and omitted assignment edits are
preserved. Both storefront and admin reads decode the same stored assignments.

The first catalogue variant is selected by default. Its matching images appear
before shared images; changing the selected pack resets the gallery to its first
matching image. With no assigned/shared image, the first product image remains a
fallback. Existing unassigned images continue to be shared. No media files are
deleted by assigning or replacing gallery rows.

Back up before migration 029 (local: `npm run db:backup`; production PostgreSQL:
`pg_dump` plus a restore check). Apply the versioned additive migration through
the existing deployment process; PostgreSQL DDL is also recorded in
`scripts/migrate-to-postgres.mjs`. Restore the backup for operational data rollback.
The local migration was applied after a backup; production is unchanged.

## Agent resource discovery

The AI discovery catalog is a build-time JSON import from `src/lib/seo/aiCatalog.json`.
`/ai-catalog.json`, `/.well-known/ai-catalog.json` and `/.well-known/ard.json`
share the same response handler, cache policy and security headers. The layout
advertises both `ai-catalog` and `ard` link relations. Avoid duplicate files in
`public`: those can conflict with App Router handlers or silently become stale.
Catalog links describe existing resources; they do not grant connector access.

## Homepage streaming and analytics loading

The public homepage's main element reserves one small viewport height in SSR
HTML. This prevents its short streaming fallback from exposing the footer before
the full page arrives; it does not impose a fixed content height. Google tags use
Next's `lazyOnload` scheduler. An active GTM container owns Google loading;
standalone GA4 is emitted only without an active container, and operators must
configure the GA4 tag in GTM when using that mode. Existing dataLayer commerce
events remain queued before the loader arrives. See
`docs/PERFORMANCE_AUDIT_2026-10-16.md` for measurements and limits.

Production builds can set `NEXT_ASSET_PREFIX` to a unique release URL prefix.
The proxy must map that prefix's `/_next/static/` path to the shared directory
of published hashed assets. Publish and verify those public resources before
changing the live application's `NEXT_DIST_DIR`; retain older hashes for open
tabs and rollback. See `docs/DEPLOYMENT_2026-10-16_PERFORMANCE.md`.

## International Commerce, Multi-Currency, and Translation Studio (Migration 031)

### 1. Market & Delivery Country Architecture
- **Independent Preferences**: Delivery country, currency, and language are decoupled and individually selectable.
- **Geolocation & Cookies**: Initial country recommendation is derived from trusted proxy headers (`cf-ipcountry` or `x-geo-country`) falling back to `IN`. Customer choices persist in `tf_preferences` cookies and are never overwritten by subsequent IP changes. Store administrators can preview any country via `tf_preview_country`.
- **Checkout Shipping Authority**: Delivery address submitted in checkout is the ultimate authority. Selecting or altering destination recalculates shipping rates, regional taxes, duties, and product eligibility.
- **Honest Browsing**: Non-serviced destinations allow honest browsing of the tea collection without silent catalog alteration, displaying clear notice that checkout is unavailable.

### 2. Multi-Currency & Rational Integer Money
- **Exact Rational Integer Arithmetic**: All monetary conversions (`convertPaise`) avoid floating-point drift by computing BigInt rational products scaled by target decimal places (`currencyDigits(currency)`), handling 0-decimal (JPY), 2-decimal (INR, USD, EUR, GBP), and 3-decimal (BHD, KWD, OMR) currencies.
- **ExchangeRate-API Integration & 48h Caching**: Server periodically snapshots fresh exchange rates. Cached rates are retained for browsing for up to 48 hours; fresh rates are mandatory for payment creation.
- **Preserved Accounting Values**: Orders and checkout quotes store exact customer minor charges alongside INR accounting base totals for book-keeping integrity.

### 3. Orders, Idempotency & Gateways
- **Authoritative Quotes**: 15-minute checkout quotes (`commerce_quotes`) bind SKUs, delivery address, shipping fee, calculated duties, and active coupons.
- **Razorpay Webhooks & Raw Signatures**: `payments.applyWebhook` verifies raw HMAC signatures (`x-razorpay-signature` and `x-razorpay-event-id`), ensuring idempotent state transitions and releasing expired reservations atomically.
- **Shiprocket Carrier Integration**: Maps quotes and bookings to Shiprocket APIs across 220+ destinations without hardcoded limits. Domestic cash-on-delivery (COD) is strictly India-only with PIN-code verification, dedicated fee schedule, and segregated `cod_due` / remittance ledger states.

### 4. Translation Studio & Content Safety
- **Structured LLM Translation**: Uses OpenAI Structured Outputs with strict Zod validation (`extractTexts` / `validateTexts`).
- **Protected Tokens**: Automatically asserts preservation of numbers, URLs, brands (`TeaFloww`, `Nirva`), SKUs (`TFW-*`), and template placeholders (`{{...}}`).
- **Stale Source Tracking & Draft/Publish Workflow**: Computes cryptographic source hash (`source_hash`). Edits in English mark translations as `stale`. Human translators review AI drafts before publishing.


## International commerce (2026-10-16)

Storefront middleware stamps a normalized locale for locale-prefixed URLs and retains
security headers. The server resolves saved country/currency choices before trusted
proxy country hints, supplies a private request context, and renders published
translations with an English fallback. Client commerce components format prices from
server-provided rate snapshots. Displayed prices never authorize a charge.

`POST /api/commerce/quote` accepts a structured address, currency, locale, payment
method, offer code and variant quantities. It reads live product data and market
policy, obtains carrier serviceability, and stores a private expiring quote.
`POST /api/commerce/payment` consumes an owner-bound quote and idempotency key,
reserves inventory/coupon capacity, and creates a Razorpay order or COD liability.
`POST /api/webhooks/razorpay` authenticates the raw body and durably queues events;
only verified capture confirms prepaid funds. `/purchase/[id]` and its status API
require a signed expiring token. Legacy unsigned order lookup excludes live orders.

Additive migrations 031/032 create `commerce_*` markets, policies/config, FX, quotes,
orders, reservation/coupon holds, financial events, shipments, translations/revisions,
jobs, campaigns and audit storage, plus truthful live-order receipt templates.
Catalogue/historical INR fields and legacy orders are preserved. New orders appear
in `/admin/fulfillment`; existing `/admin/orders` retains historical/demo orders.

The separate commerce worker claims persistent leased jobs through an authenticated
internal endpoint. Translations run in resumable chunks; source/revision guards,
strict output schemas and usage ceilings prevent silent edits or unbounded retries.
FX, reservation cleanup, webhook processing, tracking and email share the queue.

Read `docs/INTERNATIONAL_COMMERCE.md` for account-specific shipping adapter contracts,
stock/payment/refund/COD invariants, operational failure handling and production-only
PostgreSQL migration instructions. Account APIs and PostgreSQL are not validated by
local SQLite/mock-provider tests.

## Product Tea Moments

Optional `products.tea_moments` stores validated JSON as nullable TEXT. Product
mapping parses it defensively into `TeaMomentsContent | null`; the existing
HTTP/MCP upsert owner persists it using bound parameters in the product
transaction. Omitted top-level writes preserve content, null clears, supplied
objects replace. Product PATCH discards defaults for omitted keys before merging
with stored values to protect hidden sourcing fields. No pricing/payment paths
are changed. See `docs/TEA_MOMENTS.md`.

## Cart imagery

`GET /api/cart/images` accepts a bounded, validated JSON list of variant/trial
identities in the `items` query parameter and returns public image URLs only.
CartProvider fetches this metadata on identity changes and enriches its display
items without changing persisted prices, quantities or server-sync payloads.
Published/enabled product images use the product gallery's SKU/format selection;
published kits use their hero image. Missing or failed images render an accessible
neutral placeholder. Product names and slugs never select substitute photos.

## GTM event ownership and consent — 2026-11-11

`trackingBootstrap` establishes denied consent synchronously before vendor code.
The client runtime loads one GTM container after opt-in and emits sanitized route
views. When GTM is active, direct GA4, Meta and custom-script injection are
suppressed. `seo/tracking.ts` owns the ecommerce data-layer contract; server
quote analytics supply purchase amounts. PurchaseStatus is the sole active paid
retail conversion source; demo and unpaid COD confirmations do not emit purchase.
Catalog SKUs match feed identifiers. See the [audit and GTM setup contract](analytics/TRACKING_AUDIT_2026-11-11.md)
for event definitions, verification evidence, platform release gates and limits.

## Tea Traders presentation — 2026-11-17

`/tea-traders` uses the selected split-hero design with server-resolved catalogue
products and small client carousel, pack-selection and enquiry components.
`src/lib/business/traderRepository.ts` owns the validated presentation JSON in
`store_settings.tea_traders_presentation_v1`. GUI, authenticated REST and MCP share
this reader/writer; no schema migration is required. The document stores product
IDs rather than copied photo URLs, stock or prices. Published/enabled-product
filtering applies on every render, so unpublishing a selected product removes it
from the public page without exposing a draft. SKU image mapping uses the existing
catalogue helper.

The `tea-traders` Translation Studio resource includes all page/SEO copy and
explicit slide titles/bodies. Source hashing invalidates old publications after
English edits. Existing translation GUI/API/MCP workflows publish these texts;
missing/stale fields retain English. Product resources own product-name translations.
The existing B2B form endpoint retains idempotency, consent and rate limits; its
`b2b_leads` records now appear in the unified Responses inbox under Bulk orders.
Lead validation accepts supported storefront locales; legacy EN/HI B2B page-content
constraints remain unchanged. See `docs/ui/tea-traders-redesign/README.md`.

## Business admin media uploads — 2026-11-18

`BusinessMediaField` replaces URL-only fields in `/admin/business` for the four
landing settings images, each offer image, locale-specific page hero and every
proof item. It uploads through the existing authenticated `/api/admin/media`
endpoint and reuses `MediaPicker`. Existing section saves remain the publishing
boundary; no new API, schema or dependency is introduced. Images accept JPEG,
PNG, WebP and AVIF up to 5 MB, with server content validation unchanged.

Tea Traders embeds the existing `ProductImagesEditor` in `BusinessProductMedia`.
Operators can select any available catalogue product, upload/library-select photos,
set primary images and variant assignments, and save through the existing protected
product-images API. These are shared catalogue updates across all surfaces, with
an explicit notice in the editor. Page copy remains an independent save.

## Tea Traders studio — 2026-11-18

Audience and planner interactions compose the existing trader surface; the first configured hero is static while other stored slides remain intact. Catalogue products, variants and public quantity tiers supply comparison and economics. Integer-money calculations distinguish partial-stock COGS from full upfront funding including operating reserve; unknown expenses remain pending. Credit period is context rather than a full cashflow model. Planner TXT, blank CSV worksheets and roadmap TXT are local downloads; the planner can hand an editable summary of at most 500 characters to the existing enquiry flow.

The four-stage form retains the actual backend, Zod validation, UTMs, consent and retry idempotency. Existing cart, gateway and checkout remain authoritative. Additive trader presentation defaults keep older documents compatible; Hindi tool text uses the existing Translation Studio/admin/MCP workflow and other locales use source fallback until published. No schema or dependency changes. Surface scope: `ui/tea-traders-redesign/trader-studio.md`.
