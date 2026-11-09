# Original User Request

## Initial Request — 2026-10-10T21:13:20Z

Implement a Teabox-inspired, dynamic product detail experience for Himalayan Tea House, featuring rich backend-driven product options (packaging types, pack sizes, per-cup pricing), professional sensory cupping profile (dry leaf, liquor hue, wet leaf infusion, aroma notes), interactive steeping guides, and estate terroir storytelling with accessible, responsive UI/UX.

Working directory: /Volumes/AppProjectStorage 1/application/himalayan-tea-house
Integrity mode: development

Reference: Teabox Product Experience (https://www.teabox.com/products/darjeeling-risheehat-summer-chinary-black)

## Requirements

### R1. Dynamic Product Options & Packaging Variants
Extend the product catalog data model and backend storage to support multi-dimensional variants (pack sizes such as 100g, 300g, 500g, 1kg; packaging formats such as loose leaf pouch, luxury tin, pyramid bags), dynamic price calculation, unit/per-cup pricing indicators, and stock-aware state transitions.

### R2. Three-Stage Professional Cupping & Sensory Profile
Provide structured backend attributes and frontend presentation for tea connoisseur evaluation:
- Dry Leaf: visual appearance, grade, and dry leaf aroma.
- Liquor: brew hue color swatch/name, body, and clarity.
- Wet Leaf (Infusion): spent leaf aroma and oxidation character.
- Multi-dimensional flavor profile scores (e.g. Floral, Fruity, Malty, Earthy, Sweetness, Body) and descriptive aroma tags.

### R3. Interactive Steeping Guide & Estate Terroir Dossier
Display dynamic preparation guidance (exact leaf weight/dose, water temperature, steep time, cup servings, re-steeping ability) and verifiable single-estate provenance (estate history, altitude/elevation, harvest season/flush, lot number, cultivar/clone).

### R4. Premium Responsive UI/UX & Storefront Integration
Redesign the product detail page (/tea/[slug]) following the Himalayan Tea House design system and modern web guidance: accessible tabbed/accordion sections, sticky purchase bar on scroll, smooth variant switching, server-validated cart addition, and full keyboard/screen-reader accessibility (WCAG 2.2 AA).

### R5. Database Migration & Commerce Safety
Deliver changes via additive, versioned database migrations without altering deployed tables silently. Enforce server-side price, variant, and stock verification for all cart and checkout operations with Zod schemas.

## Verification Resources
- Project test suites: npm run check (runs typecheck, lint, test, build).
- Database migration runner: npm run db:migrate and npm run db:migrate:check.
- End-to-end browser tests: npm run test:e2e.

## Acceptance Criteria

### Functional & Data Integrity
- [ ] Additive, versioned migration successfully applies via npm run db:migrate and registers in migration history without data loss.
- [ ] Products with multiple packaging formats and sizes load variants, prices, and stock dynamically from the database.
- [ ] Cupping profile attributes (dry leaf, liquor, wet leaf, flavor scores, aroma tags) and steeping parameters render dynamically from database records.
- [ ] Adding configured variants to cart preserves server-side price verification and stock checks without relying on client-supplied amounts.

### Storefront UI/UX & Accessibility
- [ ] Variant switcher updates active price, per-cup calculation, and stock badge synchronously without layout shifts.
- [ ] Steeping guide and cupping details display cleanly on both mobile (<= 768px) and desktop (>= 1024px) viewports.
- [ ] Sticky purchase bar triggers on scroll and allows immediate add-to-bag with clear feedback states (default, adding, added, sold out).
- [ ] Interactive controls support full keyboard navigation (Tab, Enter, Space) and appropriate ARIA attributes (aria-selected, aria-pressed, aria-expanded).

### Quality & Regression Verification
- [ ] npm run check passes with 0 TypeScript errors, 0 ESLint warnings/errors, all unit tests passing, and a successful production build.
- [ ] Playwright E2E tests verify the product page variant selection and add-to-bag flow.


## Follow-up — 2026-10-10T21:15:56Z

Redesign and expand the Himalayan Tea House store administration portal into a modern, full-featured admin dashboard with a responsive side navigation menu and dedicated multi-page CRUD workflows (no modals) for Products, Categories, Orders, Visitors/Analytics, Blog articles, MCP tooling, Settings, and Staff.

Working directory: /Volumes/AppProjectStorage 1/application/himalayan-tea-house
Integrity mode: development

## Requirements

### R1. Admin Side Navigation & Layout Shell
Implement a modern, accessible admin panel layout featuring:
- A collapsible / fixed left side menu with distinct grouped navigation sections (Storefront & Catalog, Sales & Customers, Editorial & Content, System & MCP, Settings).
- Responsive mobile drawer menu with keyboard navigation and WCAG 2.2 AA compliant focus traps.
- Top navigation bar showing current breadcrumb path, store quick links, admin user indicator, and sign-out action.
- Visual active route highlighting on the sidebar matching the current subpath.

### R2. Dedicated Full-Page CRUD Architecture (Zero Modals)
Every entity must use dedicated full-page routes instead of modal dialogs:
- **Index / List page** (`/admin/{entity}`): Search filter, status filter, sorting, pagination, and quick action buttons.
- **Create page** (`/admin/{entity}/new`): Dedicated full form with validation, save, and cancel actions.
- **Detail / View page** (`/admin/{entity}/[id]`): Read-only inspect view with metadata, audit timestamps, and links to edit or delete.
- **Edit page** (`/admin/{entity}/[id]/edit`): Dedicated edit form pre-populated with entity state and unsaved changes confirmation.
- **Delete action**: Safe deletion confirmation with dependency check (e.g., categories containing active products).

### R3. Entity Management Modules
Deliver complete backend endpoints and frontend management pages for:
1. **Products**: Multi-image upload with thumbnail preview and reordering, rich markdown/HTML descriptions, pricing, inventory/stock count, origin tags, category association, and tea tasting notes.
2. **Categories**: Title, slug, description, cover image upload, parent category, display order, and storefront visibility.
3. **Orders**: Order status updates (preparing, dispatched, delivered, cancelled), customer details, line items, shipping address, payment transaction reference, and notes.
4. **Visitors & Analytics**: Daily/weekly traffic overview, top visited teas/pages, referral sources, and order conversion metrics.
5. **Blogs / Journal**: Article title, slug, cover image upload, rich content editor, publication status (draft/published), author name, and published date.
6. **MCP & Tools**: MCP server health status, registry of available tools, API test runner / execution log inspection, and access key info.
7. **Settings & Other**: Store operational settings (currency, tax rate, shipping fee rules, contact email), coupon code manager, and staff account management.

### R4. Local Media & Image Management
Provide a secure image upload mechanism:
- Upload files stored locally under `public/uploads/` with generated collision-resistant filenames.
- Validate MIME type (JPEG, PNG, WebP, AVIF) and file size limits server-side via Zod and Next.js request handlers.
- Persist image records in the database with alt text and display ordering.

### R5. Architecture, Security & Integrity Standards
- All mutating API routes must validate payloads with Zod schemas and require admin session authentication.
- All database operations must use parameterized SQLite queries and versioned migrations.
- Maintain responsive performance, adhering to WCAG 2.2 AA standards and modern web UX best practices.
- Zero raw database errors exposed to users.

## Acceptance Criteria

### Navigation & Shell
- [ ] Admin sidebar renders across all `/admin/*` routes with active state highlights.
- [ ] Sidebar collapses smoothly or toggles to an accessible drawer on viewport widths < 768px.
- [ ] No administration actions rely on popup/modal overlays for creation or editing.

### CRUD Routes & Workflows
- [ ] `/admin/products/new` and `/admin/products/[id]/edit` render dedicated pages with multi-image upload and rich description inputs.
- [ ] `/admin/categories`, `/admin/orders`, `/admin/blogs`, `/admin/visitors`, `/admin/mcp`, and `/admin/settings` each provide functioning list and detail/edit routes.
- [ ] Product and blog image uploads accept valid image files, save them locally in `public/uploads/`, and display immediate previews.
- [ ] Invalid inputs return clear field-level error messages without crashing the page.

### Quality & Test Verification
- [ ] `node ./node_modules/typescript/bin/tsc --noEmit` completes with zero errors.
- [ ] Existing and new Vitest unit tests pass (`node ./node_modules/vitest/vitest.mjs run`).
- [ ] Production build (`node ./node_modules/next/dist/bin/next build`) compiles without bundle or lint errors.

## Verification Resources
- Existing test suites: `tests/unit/admin.test.ts`, `tests/unit/auth-verify.test.ts`, `tests/unit/commerce.test.ts`.
- Database migrations: `scripts/migrate.mjs` and `data/migrations/`.
- Test command: `/Users/biolastic/.nvm/versions/node/v22.22.2/bin/node ./node_modules/vitest/vitest.mjs run`


## Follow-up — 2026-10-12T19:27:18Z

Build an abandoned cart and visitor intelligence system for Himalayan Tea House. The system must capture high-intent visitor phone numbers via an exit-intent & cart-triggered incentive modal, fingerprint devices client-side with server-side IP geolocation, track active and abandoned shopping bags in real time, expand the coupon engine with advanced single-use/per-user rules, present a full-featured management and 1-click WhatsApp recovery dashboard in the Admin portal, and expose full administrative and reporting capabilities via REST API and Model Context Protocol (MCP) tools and resources.

Working directory: /Volumes/AppProjectStorage 1/application/himalayan-tea-house
Integrity mode: development

## Requirements

### R1. Cart Lifecycle & Visitor Device Fingerprinting Engine
- Continuously record and synchronize active cart state (items, variants, quantities, prices, subtotal) associated with an anonymous session and device fingerprint.
- Collect non-invasive client browser fingerprint signals (Canvas hash, WebGL renderer, AudioContext signature, screen resolution, timezone, device memory/concurrency) without paid external trackers.
- Server-side enrichment with requesting IP address, user-agent, geolocation (country, region, city), and precise UTC activity timestamps.
- Transition carts to "abandoned" state after inactivity threshold, or "converted" once an order is placed.

### R2. Phone Number Lead Capture Hook & Incentive Modal
- Present a high-converting lead capture modal upon cart activity or desktop exit-intent offering an instant discount coupon or exclusive sample.
- Validate and record customer mobile/WhatsApp phone number along with optional name.
- Link the captured phone number directly to the active device fingerprint, cart session, and provisioned coupon.

### R3. Advanced Coupon System & Rules Engine
- Upgrade coupon data model and validation to support:
  - Usage restriction per customer (single-use per phone number or email).
  - Multi-use vs strictly single-use promo vouchers.
  - Minimum subtotal threshold and maximum discount amount.
  - Dedicated admin management interface to create, inspect, edit, and deactivate advanced coupons with clear condition indicators.

### R4. Admin Abandoned Carts & Lead Recovery Dashboard
- Dedicated Admin navigation item and dashboard view (e.g. `/admin/abandoned-carts`) displaying:
  - Captured leads (phone number, customer name if provided).
  - Device info, IP location (city, country), date/time, and last active timestamp.
  - Abandoned cart contents (items, quantities, total value in INR).
  - Status workflow (Abandoned, Contacted, Converted, Ignored).
- 1-click WhatsApp recovery link (`https://wa.me/...`) pre-generating a personalized message with the customer's cart summary, discount coupon, and direct recovery link.

### R5. REST API & MCP Integration
- Provide secure REST endpoints for client tracking, lead capture submissions, and admin dashboard operations.
- Expose MCP tools (`list_abandoned_carts`, `get_abandoned_cart_details`, `update_abandoned_cart_status`) and resources (`tea://analytics/abandoned-carts`) conforming to existing Model Context Protocol server capabilities.
- Ensure all queries are parameterized, SQLite additive migrations (019) are versioned, and strict validation (Zod) guards every mutating endpoint.

## Acceptance Criteria

### Cart & Visitor Tracking
- [ ] Client cart modifications automatically sync to the server and associate with a persistent fingerprint/session token.
- [ ] Server records IP address, detected location, user-agent, and exact timestamp without throwing unhandled exceptions.
- [ ] Successfully checked-out orders transition the corresponding cart session to "converted".

### Lead Capture & Hook
- [ ] Modal displays cleanly on desktop exit-intent and mobile cart interactions without re-triggering if dismissed or already submitted.
- [ ] Submitting a phone number attaches it to the cart session and displays the unlocked coupon code to the shopper.

### Advanced Coupons
- [ ] Single-use per phone/email coupons cannot be redeemed more than once by the same phone number or email across multiple orders.
- [ ] Admin can view and configure per-user limit, min subtotal, and validity window.

### Admin Dashboard & Workflows
- [ ] Admin portal lists all abandoned carts with phone numbers, device/IP details, cart items, and timestamps.
- [ ] WhatsApp recovery button launches a valid `wa.me` URL containing pre-filled message text with cart contents and recovery URL.
- [ ] Admin can update recovery status (e.g., Abandoned -> Contacted).

### MCP Integration & Verification
- [ ] MCP tool `list_abandoned_carts` returns current abandoned carts with filters.
- [ ] Additive migration script runs idempotently (`npm run db:migrate`).
- [ ] `npm run check` (typecheck, lint, vitest) passes without errors or regressions.


## Follow-up — 2026-10-13T17:20:46Z

This is a single self-contained fix; keep it small and focused.

Audit and eliminate mobile viewport horizontal overflow issues across all customer storefront pages, fixing elements extending past the right edge of the screen and ensuring seamless mobile UI/UX in compliance with modern web standards.

Working directory: /Volumes/AppProjectStorage 1/application/himalayan-tea-house
Integrity mode: development

## Requirements

### R1. Customer Storefront Mobile Viewport & Overflow Resolution
Audit all customer-facing routes (`/`, `/shop`, `/tea/[slug]`, `/cart`, `/checkout`, `/leaf-to-cup`, `/blog`, `/contact`, `/about`) at standard mobile viewports (320px–430px) and eliminate layout blowouts, unwanted horizontal page scrollbars, and elements spilling past the viewport boundary to the right side of the screen.

### R2. Modern Responsive Layout Standards
Apply modern web guidance for responsive layouts: replace improper `100vw` usage with `100%`/`100dvw` where scrollbar margins trigger overflow, enforce flex and grid item shrink mechanics (`min-w-0`), wrap naturally overflowing data elements (such as tabular comparison charts, badges, and code snippets) in designated horizontal scroll containers (`overflow-x: auto`), and ensure proper document-level containment.

### R3. Mobile Usability & Regression Prevention
Preserve touch target accessibility (minimum 44x44px for interactive buttons and links), legible fluid typography scaling, and ensure existing desktop layouts and functional flows remain completely regression-free.

## Acceptance Criteria

### Viewport Boundary Integrity
- [ ] No public customer storefront page exhibits horizontal document overflow (`document.documentElement.scrollWidth > window.innerWidth`) when loaded at standard mobile widths (360px, 375px, 390px, 414px).
- [ ] Mobile navigation drawer, search overlay, and modal sheets open and close cleanly within viewport bounds without shifting page width or causing lateral displacement.
- [ ] All page sections and content cards fit comfortably within screen margins on mobile devices without clipping essential content or breaking reading flow.

### Code Quality & Build Verification
- [ ] `npm run check` passes with 0 errors (typecheck, lint, test, and production build).
- [ ] Existing desktop layouts and Playwright test suites pass without regression.

## Verification Resources
- Run `npm run check` to verify types, lint, and Next.js production build.
- Programmatic mobile viewport overflow check across public storefront routes at 360px, 375px, 390px, and 414px viewports.


## Follow-up — 2026-10-30T20:56:45Z

Use a full team of agents to implement Milestones A & B of the TeaFloww Blend Lab service into the existing Next.js App Router storefront (`himalayan-tea-house`), delivering the Leaf & Ledger visual design, `/blend-lab` marketing experience, responsive tier comparison, and `/blend-lab/start` 5-step intake flow conforming strictly to Modern Web Guidance and WCAG 2.2 AA.

Working directory: /Volumes/AppProjectStorage 1/application/himalayan-tea-house
Integrity mode: development

Reference material:
- `docs/TeaFloww_BlendLab/README.md`
- `docs/TeaFloww_BlendLab/DESIGN.md`
- `docs/TeaFloww_BlendLab/AGENTS.md`
- `docs/TeaFloww_BlendLab/docs/IMPLEMENTATION_PLAN.md` (Milestones A & B: BL-001 through BL-034)
- `docs/TeaFloww_BlendLab/docs/ARCHITECTURE.md`
- `docs/TeaFloww_BlendLab/docs/DATA_MODEL.sql`
- `docs/TeaFloww_BlendLab/docs/API_CONTRACTS.yaml`
- `docs/TeaFloww_BlendLab/examples/` (design reference snippets & tokens)
- Modern Web Guidance: `responsive-table`, `validate-input-after-interaction`, `accessible-error-announcement`, `css-layout`

## Requirements

### R1. Leaf & Ledger Design System & Storefront Placement
- Integrate Leaf & Ledger tokens (`--tl-forest: #143C31`, `--tl-forest-deep: #092B23`, `--tl-cream: #F7F4ED`, `--tl-ivory: #FFFCF7`, `--tl-copper: #B8753D`, `--tl-gold: #D7B474`, `--tl-sage: #E5ECE4`, `--tl-ink: #19332B`, `--tl-line: #DDE4DC`) into the Tailwind CSS v4 styling system without breaking existing storefront pages.
- Add Blend Lab navigation links in the header navigation and footer, and introduce a B2B discovery feature section on the homepage that leads to `/blend-lab` while preserving existing retail editorial flow.
- Build the `/blend-lab` marketing page featuring the editorial hero, methodology/proof-of-process, interactive synthetic report preview (clearly marked as synthetic demonstration data with zero fabricated certifications), and FAQ.

### R2. Modern Web Guidance & Accessible UI Components
- Build the 3-tier comparison table using modern `@container` query responsive table architecture (`responsive-table` guide), maintaining sticky headers on wide viewports and transforming into accessible stacked cards on narrow viewports without duplicate voiceover announcements.
- Implement the 5-step customer intake flow (`/blend-lab/start`) with inputs that validate using native `:user-valid` and `:user-invalid` pseudo-classes (`validate-input-after-interaction` guide) and synchronize programmatic `aria-invalid` / `aria-describedby` error announcements (`accessible-error-announcement` guide) only after user interaction.
- Ensure full keyboard accessibility across all interactive widgets, visible focus rings, minimum 44px touch targets, and strict `prefers-reduced-motion` compliance.

### R3. Service Domain, Contracts & Safe Intake Flow
- Maintain a single authoritative typed plan catalog for the three tiers: Match & Quote (₹299), Tea Quality Audit (₹1,999), and Signature Blend Lab (₹2,999).
- Implement the 5-step intake wizard (`/blend-lab/start`): Plan Selection → Sample Information → Tasting & Commercial Goals → Pickup Pincode Eligibility → Order Review & Payment Intent shell.
- Enforce server-side pricing in integer paise (29900, 199900, 299900) and reject any client-tampered prices.
- Validate all mutating intake submissions with Zod schemas.
- Ensure project draft generation is idempotent using client-supplied idempotency keys.
- Enforce plan entitlements at the domain level (e.g. ₹299 tier grants matching quote only with no detailed PDF report entitlement; ₹1,999 tier grants audit report but no outbound trial shipments).

## Acceptance Criteria

### Build & Code Quality
- [ ] `npm run check` (incorporating `tsc --noEmit`, ESLint, tests, and `next build`) runs and exits with status code 0.
- [ ] No unhandled TypeScript errors or ESLint warnings in newly added or modified files.
- [ ] No hardcoded pricing strings in UI components; all pricing derives from the typed plan domain catalog.

### Functional & Domain Verification
- [ ] Navigation to `/blend-lab` renders successfully with all sections (Hero, Methodology, Sample Report Preview, 3-Tier Comparison, FAQ).
- [ ] Navigation to `/blend-lab/start` renders the 5-step intake stepper with state persistence across steps.
- [ ] Submitting an unsupported collection pincode triggers an explicit, clear fallback guidance state before payment.
- [ ] Plan entitlement rules are strictly verified via automated tests (₹299 cannot access PDF reports, ₹1,999 cannot access formulation trial dispatches).
- [ ] API endpoints for project draft creation enforce Zod validation and reject malformed inputs or tampered amounts.

### Responsive & Accessibility Verification
- [ ] Layout renders cleanly at 360px, 390px, 768px, and 1280px without horizontal scrollbars or clipped interactive buttons.
- [ ] Tier comparison table collapses to accessible stacked viewports on narrow containers via `@container` queries.
- [ ] Form error messages are linked to inputs via `aria-describedby` and only display after field interaction (`:user-invalid`).
- [ ] Keyboard navigation allows traversing and completing the entire intake flow using `Tab`, `Enter`, and `Space`.
