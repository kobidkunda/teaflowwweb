# Testing and Screenshot Guide

## Setup
npm install
npm run db:setup
npm run dev

## Static and unit checks
npm run typecheck
npm run lint
npm run test
npm run build

## Browser tests
npx playwright install chromium
npm run test:e2e

Playwright starts the local Next.js dev server automatically. Tests require the SQLite seed to exist.

## Screenshots
The tests write real browser screenshots to:
- docs/ui/screenshots/home-desktop.png
- docs/ui/screenshots/home-mobile.png
- docs/ui/screenshots/product-desktop.png

The ZIP also contains illustrative preview PNG/SVG files. These are concept mockups, not captures of the running app.

## Manual acceptance checklist
- Homepage renders at 1440, 768, 390 and 320 widths.
- All navigation links work.
- Search filters products and handles zero results.
- Product variants update weight, price and cup count.
- Add to bag updates count and persists after reload.
- Cart quantity and removal update subtotal.
- Shipping threshold displays correct progress.
- Checkout rejects empty and invalid submissions.
- Checkout recalculates prices server-side.
- Duplicate idempotency key returns same order.
- Out-of-stock items are rejected.
- Confirmation explicitly says demo_unpaid.
- Tea Finder supports back and restart.
- Keyboard navigation and focus order work.
- Reduced motion preference is respected.
- No horizontal overflow on mobile.
- Screen reader announces useful control labels.

## Security cases before production
- Invalid JSON and oversized payload.
- Duplicate variant IDs and excessive quantities.
- Race conditions and concurrent inventory reservations.
- Forged price, stock and payment success.
- Replayed webhooks and double refunds.
- Authorization on orders/admin.
- PII leaks, CSP, XSS, CSRF, rate limiting.
- Backup restore and failed migration rollback.

## Performance and accessibility
Use Lighthouse, browser performance profiling and axe-core. Field Core Web Vitals require real user monitoring; local synthetic results do not establish p75 field performance.

## Test status
Test files are included, but the project was not executed or browser-tested during ZIP generation. Run the commands above and resolve any environment-specific issues before deployment.

## Editorial product-page redesign

The selected Option 1 design is applied to `/tea/[slug]` using the existing server-side catalogue queries and admin product gallery. No migrations or dependencies were added. Packaging descriptions, dispatch promises, sourcing guarantees, savings labels and verified-estate claims were removed where the catalogue cannot substantiate them. All available backend sizes remain selectable, unlike the two-size visual concept. The existing caddy illustration remains an explicitly disclosed empty-gallery fallback; uploading admin images replaces it.

Browser review uses the Codex in-app browser at 1440×1024, 390×844 and 320×740. Evidence is in `docs/ui/screenshots/pdp-editorial-*` and the source comparison is recorded in `design-qa.md`. Check packaging/size selection, price updates, cart persistence, keyboard tabs, mobile accordions, scaled brewing and the sticky purchase control after the main buy box leaves the viewport. The commerce API and payment-verification rules are unchanged.

## Admin-backed product illustrations (October 11, 2026)

Four full-resolution AI-created illustrations were added for Darjeeling Spring: caddy presentation, dry leaves, brewed liquor and wet leaves. WebP exports live in `public/uploads/darjeeling-spring-*-v2.webp` (about 80–249 KB each). They are registered in both `media_uploads` and `product_images`, with explicit AI-illustration descriptions. The prior image remains in the gallery; no existing media files or rows were removed.

`node scripts/register-darjeeling-gallery.mjs` is a parameterized, transactional, rerunnable additive import. Run `npm run db:backup` first. Running the importer twice must leave four new product-image records, not eight. No schema migration is required. The importer's slug lookup fails closed if the product is absent.

The storefront gallery uses only admin image records, including when there are fewer than three images. It no longer invents extra slides or a harvest film. Sensory sections select admin images whose alt text identifies `dry leaf`, `liquor` or `wet leaf`. Brewing reuses the admin liquor image. Estate photography appears only when the admin supplies an image with `estate` in the description; no fictional estate landscape or map is shown. Alt descriptions also appear as visible captions, including AI disclosures. Update descriptions in admin when replacing illustrations with verified photography.

Generation prompts: preserve the existing emerald/brass caddy on a soft sage studio background; dry wiry leaves on an ivory dish; amber liquor in a white porcelain cup; infused wet leaves on an ivory dish. All four use cream/sage editorial lighting, full-frame subject margins, no UI, no additional labels, and explicitly illustrative treatment. Built-in ImageGen was used; the generated PNGs were exported as WebP without artistic edits.

## Option 3 homepage verification
`tests/unit/homepage.test.ts` checks migration replay/edit preservation, deployed
category ID resolution, corrupt/missing content, authenticated save/read boundaries,
unsafe URL rejection and invalid-request preservation. Run it with
`npx vitest run tests/unit/homepage.test.ts`.

Use the in-app browser for responsive and shopping checks. Evidence lives in
`docs/ui/screenshots/ritual-*`; comparison and acceptance notes are in
`design-qa.md`. Check desktop, tablet, 390px and 320px widths, menu/escape behavior,
add-to-bag feedback, category filtering and image loading. Admin saves must update
new storefront requests. Deliberately missing images hide image elements; absent
categories hide their discovery panels; an empty featured collection shows its
admin-defined empty message. Missing/corrupt configuration presents a functional
storefront-unavailable state instead of invented editorial content.

To isolate local browser preview from a concurrent production build, run
`NEXT_DIST_DIR=.next-home-preview PORT=3300 npm run dev`.

For a preview alongside builds, run `NEXT_DIST_DIR=.next-pdp-preview npm run dev`. The optional `NEXT_DIST_DIR` setting isolates generated artifacts; unset it to use the normal `.next` directory. This avoids missing-page/module errors when another process builds the same checkout.

Homepage completion coverage: `tests/unit/homepage-completion.test.ts` verifies migration replay/edit preservation, empty community state, private draft filtering, email/consent validation, duplicate normalization, cross-origin blocking, disabled signup, rate limiting and generic storage errors. Run `NEXT_DIST_DIR=.next-home-check npm run check` while the isolated `.next-home-preview` server remains active on port 3300. Visual QA includes the complete page at 1385, 768, 390 and 320 px and local-only newsletter form submission using a reserved test domain. Email campaign delivery is not configured or tested.

`tests/unit/homepage-image-migration.test.ts` checks the conditional image correction and preserves operator replacements and the original Assam image. Browser signup test confirmed a normalized private row and success message; the synthetic record was removed. A regression also covers Next's internal bind URL versus the incoming browser Host.

## Full product MCP/OpenAPI regression coverage

`tests/unit/product-api-mcp-complete.test.ts` verifies that the published OpenAPI
`admin_upsertProduct` contract matches MCP discovery and exposes category,
ingredients, description, SEO, variants and images. It executes authenticated
connector HTTP requests against an isolated migrated SQLite database, checks
unauthenticated rejection, saves four pack variants, verifies category ID/name
reassignment and null clearing, and asserts that omitted packs and gallery rows
remain byte-for-byte unchanged. Invalid category IDs and non-object payloads
are rejected. No production products are touched by these tests.

## Product availability

`tests/unit/product-availability.test.ts` uses an isolated migrated SQLite database
to cover authentication, origin checks, strict input validation, missing products,
idempotent disable/enable, preservation of drafts/packs/gallery, migration replay,
public API/feed/sitemap exclusion and checkout rejection of disabled cart items.
`tests/e2e/admin-product-availability.spec.ts` uses intercepted admin responses
with synthetic test products to cover both switches at desktop and mobile widths,
keyboard operation, save failure, pending feedback, refresh and empty states.
Real browser captures from these tests are saved to
`docs/ui/screenshots/admin-products-{enabled,disabled}-{1440,390}.png`.
Run the browser suite against a local server with
`BASE_URL=http://127.0.0.1:3308 npx playwright test tests/e2e/admin-product-availability.spec.ts`.
The browser test never edits catalogue rows; server behavior is tested separately.

Desktop (1440 px) and mobile (390 px) browser tests passed. Enabled and disabled
captures were visually reviewed: switches retain readable labels, the new column
sits beside the product name, the existing table scrolls inside its container on
mobile, and the page has no horizontal overflow. Keyboard Space toggles both
controls; saves announce success and return focus to the filter after removing a
row. Mocked save failures retain the product and its previous switch value.

Final local verification: `NEXT_DIST_DIR=.next-availability-check npm run check`
passed (1,254 unit/integration tests, five intentionally skipped PostgreSQL tests;
existing lint warnings). Both browser cases also passed against that isolated
production build on localhost using intercepted admin data and blocked external
HTTPS resources. The browser suite tests API refresh after saving; a full-page
reload check was unreliable in this local environment and is not a release claim.

## Publication and pack image assignments

`tests/unit/product-publication-images.test.ts` covers authenticated publication,
repeated publishing, making disabled drafts live, strict body validation,
multiple SKUs per image, default/shared image ordering, cross-product rejection,
atomic rollback, full-product and image-only saves, clearing and migration replay.
The full local gate passed with 1,261 tests; five PostgreSQL tests are intentionally
skipped because local development uses SQLite. Existing lint warnings remain.

`tests/e2e/product-publication-images.spec.ts` tests product details with intercepted
admin APIs and checks real storefront variant controls against an isolated SQLite
copy containing the `variant-image-browser` fixture. Set `PRODUCT_IMAGE_FIXTURE=1`
only when serving that isolated fixture database. It covers Make live, multiple
variant checkboxes, image save failure/retry, first-variant defaults, switching
50g/100g image galleries and shared-image visibility at 1440px and 390px.
Captures live in `docs/ui/screenshots/product-image-assignment-*.png` and
`docs/ui/screenshots/product-variant-gallery-*.png`. Production catalogue records
are never edited by these browser tests.

The browser suite serves real local fixture image bytes through intercepted
optimizer requests so gallery behavior is independent of image transformation.
It waits for decoded image dimensions before capturing screenshots. The local
optimizer stalled on this run; production image optimization is not verified by
these tests. Desktop/mobile visual review checks the publication actions,
readable multi-variant checkboxes and the selected pack image.

## Homepage Lighthouse regressions (2026-10-16)

Run `npx vitest run tests/unit/performance-regressions.test.ts tests/unit/storefront-shell.test.ts`
for tracking initialization, catalog discovery aliases and the streamed homepage
shell. Run the full `npm run check` with a separate SQLite test copy when another
check process is active, to avoid contending on shared mutable settings.

The issue-level investigation and remaining provider/framework limitations are
recorded in `docs/LIGHTHOUSE_REMEDIATION_2026-10-16.md`. Browser verification must
check computed text colors, not only CSS declarations: selector specificity
previously kept the trust subtitle below the required contrast ratio.

## Homepage loading and audit regressions (2026-10-16)

`tests/unit/performance-regressions.test.ts` covers Google loader ownership,
pre-load commerce queues, idempotent GTM initialization without
`requestIdleCallback`, the canonical ARD manifest and its three discovery routes.
`tests/unit/storefront-shell.test.ts` verifies viewport space exists in the SSR
homepage while its child is only a short loading fallback. Video labels now use
their visible text as the accessible name.

Final `NEXT_DIST_DIR=.next-perfcheck npm run check` passed with 1,282 tests and
five skipped PostgreSQL tests. Three final mobile Lighthouse runs had median
Performance 95, Accessibility/Best Practices/SEO 100, Agentic Browsing 98 and CLS
0. A delayed replay of the captured live stream reproduced CLS 0.587 in three
control runs and 0 in three repaired runs. Keyboard skip navigation, reduced
motion, viewport screenshots and horizontal overflow were checked at 390/1440 px.
See `docs/PERFORMANCE_AUDIT_2026-10-16.md` for exact conditions, local dependency
repair, score ranges and remaining LCP/external-script limitations. No production
result or deployment is claimed.

## International Commerce & Translation Test Suite (2026-10-16)

Nine dedicated test suites (`tests/unit/international-*.test.ts`) cover the international commerce and translation studio systems:
1. `tests/unit/international-money-fx.test.ts`: Rational integer money conversion, currency digits formatting (0, 2, 3 decimals), FX snapshot caching, and 48-hour browsing grace vs fresh payment validation.
2. `tests/unit/international-quotes-checkout.test.ts`: Authoritative 15-minute checkout quotes, country SKU exclusions, PIN-code exclusions, destination tax/duties, coupon target gating, and COD restrictions.
3. `tests/unit/international-orders-safety.test.ts`: Atomic inventory reservation, idempotency under concurrent retries, expired reservation release, guest token signing, Razorpay webhook signature verification, and partial/full refunds.
4. `tests/unit/international-fulfillment-shipping.test.ts`: Shiprocket shipment booking, pickup and label payload mapping, public tracking projection, and COD ledger reconciliation.
5. `tests/unit/international-translations-studio.test.ts`: Approved editorial field extraction (`extractTexts`), source hash stale tracking, strict Zod validation with protected token preservation (numbers, brands, URLs, placeholders), revision increments, and OpenAI Responses API structured output parsing.
6. `tests/unit/international-campaigns-regional.test.ts`: Priority and country-scheduled regional hero/announcement/slider overrides and destination targeting.
7. `tests/unit/international-context-routing.test.ts`: Delivery country, currency, and language preference resolution, cookie persistence, and header geolocation suggestion.
8. `tests/unit/international-seo-hreflang.test.ts`: Canonical and hreflang alternate links generated strictly for published translations, localized OpenGraph tags, and RTL direction handling.
9. `tests/unit/international-extended-edge-cases.test.ts`: 225-country authoritative Shiprocket destination registry, email template translation resource query fixes (`key` and `label`), dot-notation key encoding for strict OpenAI Structured Outputs, generic catalog SKU token preservation, graceful unconfigured SMTP handling, AWB assignment `order_shipped` email enqueuing, `commerce_orders` public guest tracking fallback, and untranslated locale fallback to English canonical with `noindex`.


## International commerce and translation (2026-10-16)

Final executed gate: `NEXT_DIST_DIR=.next-international-polished npm run check` passed:
TypeScript, ESLint (existing warnings; no errors), 1,372 unit/integration tests,
five intentionally skipped PostgreSQL cases, and the optimized production build.
Local development and validation used SQLite only.

`BASE_URL=http://127.0.0.1:3320 npx playwright test tests/e2e/international-commerce.spec.ts --workers=1`
passed all six cases against that final production build. The suite covers 1440px
and 390px country selector visibility, native dialog keyboard/Escape/focus return,
empty cart checkout, overflow, market enable failures and translation draft
review/edit/publication. Admin APIs are intercepted with synthetic fixtures and
external HTTPS resources are blocked; these checks never publish actual translations
or change market readiness in the real local database.

Real browser screenshots are in `output/playwright/international-{selector,checkout,admin-markets,admin-translations}-{1440,390}.png`.
Desktop/mobile captures were visually reviewed for form hierarchy, readable labels,
visible country controls, bottom-sheet layout and confined table scrolling. Mobile
admin breadcrumbs/secondary actions were adjusted to avoid overlap. The old cart's
India-only shipping estimate was replaced by a destination quote explanation.
Duplicate public/App Router icon files were resolved; `/icon.svg` and `/favicon.ico`
both returned 200 on the final preview. Public health returned 200 and unauthenticated
market administration returned 401.

Financial tests mock provider HTTP calls. Coverage includes authoritative totals,
zero/two/three-decimal currencies, source changes, rule version changes, concurrent
idempotent attempts, stock expiry/release, failed/late/duplicate captures, raw-body
HMACs, refund holds, COD remittance, origin/auth guards, duties modes, explicit INR
acceptance and protected translation values. Missing providers cannot fall back to
invented exchange rates, delivery costs, duties, captures or English “translations.”
Signed guest-link middleware redirects secrets out of page URLs into order-scoped
HTTP-only cookies; the server still verifies HMAC/expiry, and unsigned legacy lookup
excludes live orders.

An actual local SQLite pre-feature backup passed `quick_check`, was restored into
an isolated temporary directory and migrated with 031/032. Catalogue, variants,
images, historical orders and order-item counts were preserved; the temporary copy
was then removed. This is a SQLite restore smoke check, not production PG evidence.

No real Razorpay test/live transaction, carrier booking, paid LLM translation,
production PostgreSQL migration or deployment was performed. Real account/currency
eligibility, shipping adapter contracts, customs/tax profiles, worker/email delivery,
reviewed language content and production backup/restore remain activation gates.
Operational configuration is documented in `docs/INTERNATIONAL_COMMERCE.md`.

## Blend Lab workshop redesign (2026-10-31)

Selected design: `docs/ui/blend-workshop/selected-option-3.png`. Real Chrome
browser captures, made after the in-app browser timed out, are saved at
`docs/ui/screenshots/blend-workshop-{desktop,mobile,tablet,320,hero}.png`.
Desktop is 1440×1024; tablet 768×1024; mobile 390×844 and 320×740. Combined
source/render comparisons are in `docs/ui/blend-workshop/comparison-*.png`.
These comparison sheets are derived evidence, not additional browser captures.

Browser checks covered all three goal choices and their linked plans, primary
hero anchor navigation, keyboard Enter expansion/collapse of the report,
FAQ expansion, and navigation into `/blend-lab/start?plan=SIGNATURE`, where the
existing intake displayed the Signature entitlement. All nine rendered image
instances loaded; one main landmark remained. Document width matched the viewport
at 1440, 768, 390 and 320px. Browser error logs were empty during review.
No real project submission, payment or production deployment was performed.

`tests/unit/blend-lab-workshop.test.ts` checks operator-authored hero copy,
non-default price/tax/deliverable rendering, matching intake links, the no-plans
contact state, and the clearly identified native report disclosure. The existing
`storefront-shell.test.ts` also checks a single Blend Lab header/footer. Run
`npm run check`; lint currently reports pre-existing repository warnings.

Final executed validation: `npm run check` passed on 2026-10-31: typecheck, lint
(0 errors; existing warnings), 1,414 passing tests across 98 passing files,
5 PostgreSQL-live tests skipped, and the optimized production build.

## Homepage Blend Lab invitation (2026-10-31)

`tests/unit/home-blend-invitation.test.ts` checks real service/process URLs,
removal of fabricated claims and prices, illustrative disclosure, and preserved
operator copy/image/alt/CTA overrides. Final `npm run check` passed: 1,416 tests,
99 passing files, 5 live PostgreSQL tests skipped, typecheck, lint (0 errors;
61 existing warnings), and optimized build including the final CSS.

Real section captures at 1440, 768, 390 and 320px are saved in
`docs/ui/home-blend-invitation/`. `comparison.png` and `comparison-detail.png`
combine source and actual browser evidence and are derived inspection sheets.
In-app browser captured responsive layouts; its annotation layer then intercepted
interaction, so Chrome verified actual click/keyboard navigation to Blend Lab and
its method anchor and supplied the final unobstructed desktop capture. Browser
console errors were empty. No project submission, production data edit or deployment
was performed. See the root `design-qa.md` for the complete comparison record.

## Compact homepage tea shelf (2026-10-31)

Final npm run check passed: 1,418 tests across 99 passing files, 5 live PostgreSQL tests skipped, typecheck, lint (0 errors; 61 existing warnings), optimized build. Signature shelf tests cover initial/expanded mobile rows, stock-disabled product-specific purchase labels, honest missing-image state and no fabricated merchandising badges; price/compare-at assertions remain.

Chrome verified wishlist keyboard toggling, Show All/Show Fewer, Quick Add and the correct cart line/price, product navigation and desktop carousel movement. The test cart item was removed. Captures at 320/390/768/1440px and source comparisons are in docs/ui/compact-tea-shelf. One Next CSS hot-reload error occurred during editing; reload rendered correctly with no additional logged error. No payment or deployment was performed.

## Trials discovery shelf — option 2 (2026-11-07)

Final `NEXT_DIST_DIR=.next-trials-check npm run check` passed with TypeScript,
ESLint (existing warnings, no errors), 1,945 passing tests across 122 passing files,
five intentionally skipped live PostgreSQL tests and the optimized Next.js build.
The focused trials storefront/adversarial run passed all 88 tests. Listing tests
cover four contents rows, omission of raw seeded claims/taglines, independent
multiple kits/prices/availability, uploaded image preservation and missing imagery.
A pre-existing homepage trial fixture was aligned with the public DTO without
expanding production fields.

The in-app browser verified 1440/768/390/320px layouts, no horizontal overflow,
loaded images, one main landmark, component-name search, no-match/reset, category
pressed/empty state, keyboard FAQ disclosure, hero anchor and kit-detail navigation.
An isolated SQLite backup with three additional clearly named browser fixtures
verified the four-kit two-column and mobile collection, including an unavailable
kit. Actual catalogue records were not changed. No order/payment was submitted.
Browser error logs were empty. Source comparisons, actual captures and remaining
limits are documented in `design-qa.md` and `docs/ui/trials-discovery/README.md`.
Load-more retry and the generic route-error state were not fault-injected in the
browser. No production deployment or full screen-reader audit is claimed.

## Homepage sample-kit invitation — option 3 (2026-11-07)

Full `NEXT_DIST_DIR=.next-home-trials-check npm run check` passed: typecheck,
ESLint (125 existing warnings, zero errors), 1,963 passing tests across 126 passing
files, five skipped live PostgreSQL tests and optimized build. The production
build was repeated successfully after the final CSS-only narrow-button change.
Focused homepage/editor/MCP tests passed all 46 cases, including HTTP auth,
image persistence, MCP parity, guidance, unsafe paths, custom copy, image clearing,
disabled state and removal of seeded claims/direct purchase UI.

The in-app browser reviewed 1440/768/390/320px layouts, decoded image selection,
no overflow, all cup/pouch pairs, and keyboard CTA navigation to `/trials`.
An isolated SQLite backup on port3356 and synthetic admin account verified actual
image edits, exact-size editor hints, saving and storefront readback including
mobile fallback and caption. Normal homepage records were untouched. Comparison
sheets and captures are in docs/ui/home-trials-invitation; see design-qa.md.
No order/payment, actual new media upload, production deployment or full screen-reader
audit was performed. Existing validated uploader and error handling were retained.

### Homepage → trials scroll regression (2026-11-07)

Reproduced the sample-kit CTA opening `/trials` at scrollY 2117.5 instead of
showing its hero. The CTA now uses `/trials#top`, explicitly requesting Next's
page-top navigation instead of relying on its viewport-preservation heuristic.
In-app browser checks at 1280×720 and 390×844 confirmed scrollY 0 after clicking
from the homepage invitation; Back restored a nonzero homepage position.
Actual destination screenshots were reviewed in `docs/ui/navigation-scroll/`.
`tests/e2e/home-trials-navigation.spec.ts` records the desktop/mobile navigation
and Back regression for future Playwright runs; this turn executed the browser
steps through the in-app browser, not the Playwright CLI.

Validation: `NEXT_DIST_DIR=.next-scroll-check npm run check` passed: typecheck,
lint (existing warnings), 1,963 tests passed / 5 skipped, and production build.

## Product Tea Moments — 2026-11-07

`tests/unit/tea-moments.test.ts` exercises migration replay, HTTP/MCP content
round trips, omission/clearing, unauthorized writes, unsafe image paths, alt-text
validation, escaped copy, malformed JSON and preservation of hidden sourcing.
Retired dossier assertions were replaced in the product UI tests.

`tests/e2e/tea-moments.spec.ts` passed all five Chromium tests against an isolated
SQLite copy: 1440/768/390/320px layouts, keyboard tabs and mobile accordions,
admin save/read-back, rejected unsafe image, broken-image text fallback and
clearing/conditional navigation. The admin editor was captured at 1440/390px;
a min-content grid expansion found in the mobile review was corrected. The
browser suite requires the local-only fixture helper documented in
`docs/TEA_MOMENTS.md`; it never backfills the working product catalogue.

Real browser captures are in `docs/ui/tea-moments`. Section captures suppress
unrelated fixed header/cart overlays and development indicators for a clear view
of the entire section; full-page captures retain the actual storefront. The
editorial copy and existing AI illustration are explicitly marked test fixtures.
An independent screenshot review inspected all ten images and returned Ship,
with no material findings. No production or physical-device verification.

Validation outcome: two full `npm run check` runs completed during implementation
(127 test files passed, one skipped; 1,966 tests passed, five skipped; production
build succeeded; lint reported existing warnings). After the final mobile editor
correction, all 53 targeted unit/integration tests and all five browser tests
passed. The final full-project recheck is blocked at type checking by a concurrent,
unrelated edit: `src/lib/shiprocket.ts:384` declares `status` twice (TS1117).
That file was not changed for Tea Moments. An unrelated migration
`038_product_subscriptions` appeared concurrently and remains pending locally.

The working SQLite database was backed up before applying only migration 037.
Its additive migration body was replayed and a before/after comparison confirmed
all sourcing fields unchanged. No Tea Moments content was backfilled into the
working database. Production PostgreSQL migration remains an operator step.

## Header logo clipping — 2026-11-11

The header's 1280px cap and shrinkable brand truncated both TEAFLOWW and its
admin-authored tagline with the additional Private Label navigation link.
The header now allows 1440px and preserves the brand width; below 1400px it
uses the existing navigation drawer, including the Wholesale navigation link.

Real Chromium checks on local SQLite at 1512/1440/1400/1399/1280/1024/768/390/320px
confirmed the visible wordmark/tagline are not clipped and the page has no
horizontal overflow. At 1399px and 320px the menu opens with Private Label
visible and closes with Escape. At 1400px the scrolled sticky header has no
brand/navigation overlap. Reviewed desktop, intermediate and narrow mobile
screenshots in `output/playwright/header-logo/`. The before-desktop browser
capture temporarily reapplies the previous max-width/flex-shrink values;
after captures use the actual changed CSS. No assets or database changes.
The design detector reports only two existing Arial font warnings outside
the changed rules; the incumbent typography is preserved.

Validation: TypeScript passed; all 2,833 unit/integration tests passed (6 skipped);
production build passed. `npm run check` stops at an existing lint error in
`src/lib/international/orders.ts:272` (`prefer-const`), with 200 existing warnings.
Tests and build were therefore executed separately. No production deployment
or physical Safari/device testing was performed.

## Private-label flow repairs — 2026-11-11

`tests/unit/private-label-flow-repair.test.ts` covers prerequisite clamping,
invalid numbers, artwork-rights gating, incompatible prints and server-valid
current-item payloads. The focused storefront/flow run passed 32 tests.
Browser checks use synthetic contact responses for failure/retry and success, and
an isolated SQLite copy for catalogue/studio/project/quote journeys; store data
and production are not modified. See `docs/ui/private-label-flow/README.md` for
scope and the artwork-preview limitation.

Final executed validation: `npm run check` passed with TypeScript, ESLint (existing
warnings), 2,840 tests across 164 passing files, six skipped PostgreSQL-live tests,
and the optimized production build. The post-quote-save regression was observed
failing before the fix and passing afterward. The rebuilt production app then
saved an artwork preview after quote creation (HTTP 200, revision 3), enforced
rights confirmation and restored the preview after reload.

Final real browser captures are in `output/playwright/private-label-*`: landing
1440/320, studio artwork 1440, studio 320 and quote 1440/320. These are browser
screenshots, with synthetic records in the isolated studio/quote captures. No live
payment, production migration or deployment was performed.

## Cart product photos — 2026-11-11

`tests/unit/cart-images.test.ts` covers ID-only saved cart resolution, exact SKU
assignments, replacement uploads, missing/draft/disabled products, published kit
image lookup, strict/bounded query validation and accessible empty-image rendering.
The endpoint returns image URLs only; it does not accept prices or modify carts.
CartProvider resolves current catalogue images for every add source and restored
cart; quantity changes do not trigger image refetches. Cart and legacy checkout
share the neutral missing/broken-image component.

The five focused tests passed. Real Chromium checks at 1440px and 390px restored
two local catalogue products from browser storage, checked decoded thumbnail URLs
against the image endpoint and verified the missing-product placeholder and no
mobile overflow. Reviewed captures: `output/playwright/cart-photos/desktop.png`
and `mobile.png`. Browser cart sync was intercepted to avoid writing test carts
to the working database. The signed-out customer endpoint returned its expected
401. No catalogue edits, payments or deployment were performed.

Quantity increase, item removal and intentionally failed image requests were
also verified in Chromium; broken images switched to the neutral placeholder.
Final `npm run check` passed: TypeScript, ESLint (existing warnings), 2,845
unit/integration tests passed, six PostgreSQL-live tests skipped, and optimized
production build. No database schema or dependency changes.

## GTM and conversion tracking audit — 2026-11-11

Focused tracking, quote-value, performance-contract, cart-image, tracking-setting
and trial-cart regressions passed: 6 files / 57 tests. They cover one Google
transport, GTM ownership of Meta, denied consent, post-consent queues, withdrawal,
purchase deduplication, PII field exclusion, currency precision and catalog SKUs.
Tracking settings now use an isolated test database. Browser tests use a SQLite
copy at `/tmp/teafloww-tracking-browser.sqlite` and vendor request interception;
they do not claim receipt by production analytics.

Real Chromium checks on localhost confirmed no vendor request before consent;
one GTM script after opt-in; matching SKU `DJ-SP-50` through list/add/cart/checkout;
quantity changes emit only their delta; and withdrawing consent suppresses later
cart events. Consent desktop/mobile captures are in
`output/playwright/tracking-consent-desktop.png` and
`output/playwright/tracking-consent-mobile.png`; these are real browser screenshots.
The mobile consent panel was visually reviewed at 390×844.

`npm run check` executed typecheck, lint and the complete unit suite. Latest full
suite: 2,862 passed, 1 failed, 6 skipped across 167 files. The remaining failure is
`private-label-m6-challenger-release-qc.test.ts`, unpaid-deposit release-gate
scenario 1.7. The full check stopped before build; a production build was run
separately, with its result recorded below after completion. Existing lint warnings
remain. Do not describe the full check as passing.

The live production audit and remaining receiving-side verification steps are in
[the tracking audit](analytics/TRACKING_AUDIT_2026-11-11.md). Neither production
GTM publication nor application deployment was performed.

Additional browser verification confirmed exactly one page_view for each client
navigation from product detail to shop, plus consent-triggered view_item with the
same catalog SKU. Focused ESLint on the tracking modules and new tests passed
without warnings. The first separate production build compiled
but failed collecting page data with a missing `.next/server/pages-manifest.json`;
an isolated `.next-tracking-build` build was then executed to avoid shared-output
interference. The published container resource is preserved in
`docs/analytics/published-container-resource.json` for independent inspection.

## Meta CAPI helper and Tag Assistant CSP — 2026-11-11

`tracking-csp.test.ts` plus `gtm-export.test.ts`: 7 tests passed. Focused ESLint
and TypeScript checks passed. A temporary local HTTP harness used the production
header exported by security.ts: Chromium loaded both official Meta helper CDN
URLs (including unpkg's current 1.3.3 redirect), found the expected builder API,
and recorded no CSP violations. The harness did not initialize pixels or send
conversion events. Two exact CAPI origins were verified in the merchant pixel's
public Meta config; their receiving-side event processing has not been tested.
See `docs/analytics/GTM_V7_FIX.md` for deployment and platform verification limits.

The complete unit suite for this correction passed: 174 files, 2,931 tests,
with 6 PostgreSQL-only tests skipped. The isolated production build in
`.next-capi-csp-build` also passed. These checks do not replace live verification
after deployment of the changed HTTP security headers.


2026-11-11 authorized CSP deployment: isolated server production build passed;
candidate and activated production PostgreSQL health/readiness checks passed.
After TeaFloww-only Nginx cache invalidation, the normal public shop URL serves
the new CSP. Fresh Chromium loaded the real Meta helper (HTTP 200, initialized
object) and observed GA4 collection HTTP 204. Meta CAPI ingestion and verified
purchase reception remain unverified; no orders/payments were created.


2026-11-11 Meta retargeting supplement: seven focused GTM contract tests pass.
The mapping tests exercise product SKU/quantity/value transformation, zero
values, malformed items, search isolation, customer-field exclusion, consent,
and event-ID routing. Full local test suite: 2,935 passed, 6 PostgreSQL-only
skipped. Typecheck and lint pass. Import compatibility and event delivery must
still be validated in GTM Preview and Meta Test Events before publication.

Full `npm run check` completed successfully, including the production build.

Meta destination correction: live GTM used 1128432123376468, while the merchant
identified 29619022431117471. Corrected import includes existing Meta base and
Purchase updates and keeps the duplicate paused. Fixed missing numeric version
in new variable template INFO after GTM reported an import-format error; added
regression coverage. This format correction is local; successful import and
Meta receipt have not yet been confirmed.

Private-label follow-up acceptance (11 November 2026): see `docs/ui/private-label-flow/verification-2026-11-11.md` for the executed browser matrix, 2,935-test full check, 865-test focused replay and remaining gateway/prepress boundaries.

Second GTM import correction: replace unresolved cvt_TFMetaProperties with the
container/template-scoped cvt_266900144_9500 and use INFO cvt_temp_public_id.
Ten focused tests and lint pass; actual importer acceptance is still pending.

## Saved cart prices and checkout quotes — 2026-11-11

Cart catalogue metadata now optionally returns current public prices in integer
paise. CartProvider refreshes saved estimates on hydration, identity changes and
window focus, preserving quantities. Checkout still recalculates and validates
prices and stock independently. `tests/unit/cart-images.test.ts` covers changed
catalogue prices and safe reconciliation of saved prices.

The actual CartProvider and LiveCheckout components were also bundled into a
throwaway isolated React/browser harness with mocked catalogue/address/quote
endpoints. Verified cached ₹199 -> current ₹30, quantity-only changes from 1 to
9 to 11, payable totals ₹29.40 / ₹264.60 / ₹323.40, immediate hiding of outdated
pay controls, and a delayed quantity-9 response arriving after quantity 11 without
restoring the old total. API observations confirmed quantities [1,9,11,9,11].
Quote inputs include address, currency, coupon and payment method; outdated
responses are ignored, automatic quote failures are visible, and expiry removes
the payable quote. Copy no longer claims stock/tariff guarantees or a coupon
without evidence. No schema, payment gateway or deployment changes.

`npm run check` completed successfully after these changes. Focused cart-image
suite: six passing tests. Existing unrelated working-tree changes were retained.

## Cart / checkout total consistency — 2026-11-11

The browser regression reproduced an unchanged ₹10 coupon saving after increasing
a ₹100 line from one to two: the cart displayed ₹190 instead of ₹180. CouponField
now recalculates on subtotal changes, aborts obsolete requests, and clears old
savings while validating. Cart cookie hydration delegates validation to that field.
Existing in-progress saved-price refresh and checkout quote-input invalidation
changes were preserved and exercised alongside this fix.

`node tests/browser/cart-totals.mjs` passed against a local SQLite dev server on
port 3367. It uses synthetic catalogue/coupon/quote responses and blocks cart sync;
no order or payment is created. Checks cover quantity changes, catalogue price
refresh on focus, matching cart/checkout merchandise, changed-coupon quote
invalidation, and mobile overflow. Real 390px/1440px captures were reviewed in
`output/playwright/cart-totals/`. Signed-out `/api/customer/me` returns expected 401.
The browser regression needs the installed Playwright CLI skill wrapper (PWCLI can
override its path); BASE_URL overrides the local cart URL. Focused API/quote tests:
13 passed. This verifies the local fix, not the user's production browser cart.
No deployment, schema or dependency changes.

Saved-price reconciliation additionally passed three focused unit tests covering
trial/variant identity, quantity preservation, invalid/missing values and zero
prices. The browser regression is retained in `tests/browser/cart-totals.mjs`.

Final `npm run check` passed: TypeScript, ESLint (existing warnings), 2,939 passing
unit/integration tests across 175 passing files, six skipped PostgreSQL-live tests,
and the optimized production build. `git diff --check` passed. Browser captures
show the corrected ₹200 subtotal, ₹20 coupon saving and ₹180 merchandise estimate.

### Authorized production deployment — 2026-11-11

User requested production deployment. Built an isolated candidate from current
server source with only the six cart/checkout pricing files overlaid. Production
build and private-port health/readiness/storefront/price-endpoint probes passed
using PostgreSQL. Activated build `sG_aycXWWmMj8dzqgl5Kt`; prior build and source
are retained for rollback. No migrations, dependency or payment-setting changes.

Public cart, checkout, health, readiness and price-refresh API return HTTP 200;
all 20 cart JS/CSS assets return HTTP 200. A real published variant's endpoint
price matched its catalogue price. Backed up and invalidated 327 Nginx cache
entries belonging specifically to TeaFloww's port-3050 origin.

The browser regression also passed on the production host with intercepted
synthetic catalogue/coupon/quote requests and blocked cart sync. It verified
quantity/price changes, matching merchandise and quote invalidation, without
creating orders or payments. Test browser cart/coupon storage was cleared.
Only expected signed-out customer 401 errors were recorded. Production captures
and public probes: `output/deploy-cart-totals-20261111/`.

Server rollback build: `/www/wwwroot/teafloww.com/.next-previous-20261111-cart-totals`.
Source backups and deployment logs:
`/www/wwwroot/teafloww-cart-totals-release-20261111/`.

## Meta iframe/form CSP transport — 2026-11-11

`src/lib/security.ts` now allows only the exact `https://www.facebook.com`
origin in frame-src and `https://www.facebook.com/tr/` in form-action, preserving
the existing payment provider, frame-ancestors none, X-Frame-Options DENY and
production eval restrictions. connect-src/script-src did not cover these
separate browser transports. Marketing consent and GTM ownership are unchanged.

The new regression failed before the change and passed afterward. Twenty tests
pass across tracking-csp, blog-routes and video-story; focused ESLint passes.
A temporary localhost harness served the actual production SECURITY_HEADERS:
Chromium initiated the Facebook iframe with no parent CSP violations, submitted
an empty form to `/tr/` with no parent CSP violations, and blocked an empty form
to `/unapproved/` with a form-action violation. No pixel ID or conversion payload
was sent. This verifies CSP permission, not Events Manager/CAPI processing.
No production deployment or GTM publication was performed.

The first full check stopped on incomplete deployment backup copies under the
Git-ignored `output/deploy-cart-totals-20261111/server-before/` directory. Added
`output` to TypeScript excludes and `output/**` to ESLint ignores so generated
artifacts are not validated as application source. No backup files were deleted.
The live `/shop` response was read back and still has the old frame/form sources;
production is intentionally unchanged until explicitly requested.

Full suite follow-up: TypeScript and ESLint pass; 2,945 tests pass and six
PostgreSQL-only tests are skipped. Production build validation follows in the
same `npm run check`; local development/testing remains SQLite.
Production build completed successfully; the full `npm run check` exited zero.
