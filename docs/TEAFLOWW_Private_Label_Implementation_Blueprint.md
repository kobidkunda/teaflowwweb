# TEAFLOWW — PRIVATE LABEL STUDIO
## Repository-grounded implementation plan, design specification, TODO backlog and reusable code patterns

**Status:** Specification and illustrative code only. No application changes, database migrations, supplier rates or customer orders have been deployed.

**Source inspected:** `teaflowwweb-main.zip` supplied November 2026. The archive is a code snapshot, not guaranteed identical to the currently deployed site. Source file paths below refer to this archive.

---

## 0. Executive brief

**Proposed feature:** `/private-label` — private-label tea sourcing, packaging selection, brand artwork, mockup, quotations, samples, approvals and production tracking in one Teafloww account.

**Customer entry routes:**
1. Start my tea brand (guided wizard).
2. Design my packaging (packaging-first editor).
3. Contract manufacturing (enterprise RFQ).

**Commercial rule:** Separate a simple stock-pouch-and-label job from custom digital/UV printing, gravure cylinder tooling, jars/tins and specialty sachets. Each process has a different supplier, MOQ, pricing unit and proofing requirement. Never infer a firm cost or lead-time from a design preview.

**Product boundaries:** This is NOT a multi-merchant marketplace, a Photoshop replacement, or a standalone e-commerce application. It is a Teafloww module with a secure customer workspace, internal approvals and production integrations. Implement a polished 2D composition preview before adding accurate 3D material simulations. Keep source artwork and prepress documents independent from visual mockups.

### Non-negotiables
- Never fake facility ownership, current supplier availability, MOQ, lead time, shipment status, testimonials or FSSAI/export compliance.
- Every public cost and quantity break comes from active admin-managed validated price rules, or is clearly flagged as an estimate; do not hardcode commercial values into React.
- Every design is tenant-scoped, versioned and authorized. An approval applies only to the exact revision approved.
- Admin, storefront, and MCP use the **same application services** and enforce the same validation, authorization, idempotency and audit requirements.
- All components are reusable; no copy-pasting entire pages to create a new pouch variant.
- Never create production jobs from a mockup-only approval. Require print-ready proof, compliance checks, contractual/payment gates, and operator authorization.

---

## 1. Source audit: what already exists

| Verified repository asset | Path | How to extend |
|---|---|---|
| Runtime | `package.json` | Next 15.5, React 19, TypeScript 5.9, Tailwind 4, Zod 4, Lucide 0.468, Sharp. Do not introduce a second UI or backend framework. |
| Global palette | `src/app/globals.css`, `design.md` | Base on existing paper/forest/pine/brass visual language; new feature-level `tokens.css` should map to these values. |
| Site shell | `src/components/StorefrontShell.tsx`, `src/components/StorefrontHeader.tsx` | Keep global nav/footer; add Private Label nav item via the actual nav model. |
| Navigation configuration | `src/lib/contentBlocks.ts`, `src/components/admin/layout/navConfig.ts` | Public navigation is admin-capable; admin nav has defined groups. Add once, not in two competing constants. |
| Landing patterns | `src/components/home/RitualHero.tsx`, `src/components/trials/DiscoveryShelfHero.tsx` | Create editorial hero with live CMS media; use `next/image` and known alt text. |
| Product cards | `src/components/trials/TrialCard.tsx`, `src/components/shop/ShopProductCard.tsx` | Create a shared `PackagingCard` on the same design grammar. |
| Customer sessions | `src/lib/customerSessions.ts`, `src/app/account/*` | Use `getCustomerSession` on protected APIs and require brand/project ownership. |
| Admin auth | `src/lib/adminHttp.ts`, `src/components/admin/layout/*` | Reuse `guard`, AdminShell, AdminAuthGate and admin role checks. |
| Admin catalog | `src/app/admin/trials`, `src/components/admin/trials/*` | Follow admin forms, listing, draft/review/publish model. |
| Public catalogue pattern | `src/app/trials/page.tsx`, `src/lib/trials/service.ts` | Use server-rendered safe public DTOs, scoped filters and category pages. |
| Existing CMS/media | `src/lib/media.ts`, `src/lib/uploads.ts`, `src/app/api/admin/media/route.ts` | Reuse for public product media; private brand artwork must use access-controlled storage and separate metadata. |
| Wholesale enquiries | `src/app/wholesale/page.tsx`, `src/components/wholesale/WholesaleForm.tsx`, `src/app/api/wholesale/route.ts` | Route eligible enquiries into Private Label project pipeline, preserving existing wholesale workflows. |
| Migrations | `scripts/migrate.mjs`, `scripts/migrations/*` | Latest numbered migration seen is `044_product_pdf_attachment.mjs`; allocate **045 or the next free number** after checking active branch. |
| PostgreSQL | `src/lib/postgresDriver.ts`, `scripts/apply-all-pg-migrations.mjs`, other PG scripts | Verify exact supported PG migration workflow and schema parity; do not assume a SQLite migration works unchanged in PG. |
| MCP | `src/lib/mcp.ts`, `src/app/api/mcp/tools/[tool]/route.ts` | Register new definitions/dispatch handlers as thin adapters to the new services. |
| SEO | `src/lib/seo/metadata.ts`, `src/lib/seo/schema.ts`, `src/lib/seo/sitemap.ts` | Meta title, canonical, schema, indexable catalogue URLs; keep private projects noindex. |
| Tests | `tests/unit/*`, `tests/e2e/*`, `vitest.config.ts`, `playwright.config.ts` | Add domain and E2E tests following existing test conventions. |

**Repository warning:** Existing wholesale landing page has hardcoded promotional claims and uses fallback business text. Do not copy those claims to Private Label without checking operational records. The archive also contains conceptual product mockups; mark them clearly as illustrations, not photographs of printed work.

---

## 2. Commercial scope and launch strategy

### MVP launch options

| Format | Allowed branding at launch | Price response | Publishing gate |
|---|---|---|---|
| Stock stand-up pouch | Paper label, BOPP/sticker label | Estimate or validated instant quote | Approved packaging, supplier and label rate |
| Stock metallic pouch | Label, wrap | Estimate or validated quote | Food-contact and sealer compatibility |
| Digitally printed pouch | Supplier-qualified digital artwork | Usually estimate + supplier confirmation | Supplier model, colour/finish and MOQ verified |
| Gravure pouch | Cylinder tooling, print-film run | Managed quote | Engraving, film conversion, cylinder ownership, weight-based MOQ |
| PET/PP jar | Paper/BOPP label, selected decoration | Estimate or managed quote | Actual jar size, cap/liner, fill test |
| Metal tin | Label and optional sleeve | Managed or validated quote | Tin supplier, inner pouch, transport protection |
| Tea sample pouch | Label and sample kit | Validated quote once stocked | Approved tea lot, quantity, dispatch terms |
| Other: cartons, custom tins, pyramid bags, sachets | Enquiry first | Managed RFQ | Machine/supplier feasibility proof |

**MOQs:** All supplier minima must remain data-driven. Do not launch with an arbitrary universal minimum. Use distinct `tea_min_kg`, `packaging_min_units`, `print_min_units`, `print_min_kg`, `order_multiple`, and `minimum_order_value`. Display *which* constraint blocks a quantity and offer a valid lower-MOQ alternative. Show kg-to-units conversion only when pack dimensions, mass per piece and yield are verified. Gravure cylinder counts depend on the final artwork and print process, not the number of visible shades on a screen.

### Customer journey/state
`anonymous discovery → saved draft → configured → feasibility review → estimate/quote → optional sample → final proof → compliance review → accepted price/deposit → production release → QC → dispatch → delivered → reorder`

Support rejection, revision, expired quotes, supplier unavailability, customer cancellation and revision-specific history. Do not assume samples or deposits are mandatory in every workflow; flags should be rules set by the operator.

---

## 3. UI/UX design system — design language

### Experience name
**TEAFLOWW / Private Label Atelier**. Premium modern editorial tea brand + precise industrial configurator, never generic SaaS dashboard styling on public pages.

### Source-aligned palette

| Token | Value | Role |
|---|---|---|
| `--pl-forest` | `#143C31` | Main dark surfaces (matches existing `--tl-forest`) |
| `--pl-forest-deep` | `#092B23` | Hero and preview stage |
| `--pl-paper` | `#F6F1E7` | Editorial canvas (`design.md`) |
| `--pl-ivory` | `#FFFCF7` | Cards, proof sheets |
| `--pl-pine` | `#23483A` | Buttons and focus-aware accents |
| `--pl-brass` | `#B39156` | Small highlights, numbering, borders |
| `--pl-ink` | `#171713` | Body content |
| `--pl-muted` | `#65746D` | Secondary text |
| `--pl-line` | `#DDE4DC` | Dividers |
| `--pl-success` | `#287455` | Confirmed state |
| `--pl-warning` | `#9E6428` | Needs review |

**Typography:** Georgia/system serif for major editorial headings (aligned with current `design.md`); existing system sans for controls/prices. Do not introduce unlicensed fonts. Primary headlines with 1.05–1.12 line height; interface typography always legible at 13–16px. One important action per screen.

**Composition:** Hero 55% story/45% asset at desktop; transparent navigation over dark forest or inherited common header. Grid max width 1320–1440px. 12-column system and generous 72–112px desktop spacing; 18–20px side gutters on mobile. Product images: 4:5 or 1:1 crop; preview stage 4:5 responsive. Buttons: minimum 44px targets. Corners mostly 4–12px; rounded cards are selective. Subtle brass radial lighting and material reflections only inside visuals, not every panel.

**Motion:** Panel transitions 180–260ms, preview crossfade 250ms; only transform/opacity animations. Honor `prefers-reduced-motion`. Avoid expensive canvas or rotating 3D on first page load.

**UX hierarchy:** Desire → choice → assurance → pricing certainty → action. Pricing is adjacent to the preview, with status `Indicative`, `Confirmed`, `Request quote` and an explainable breakdown. Never show meaningless fake discounts or guaranteed delivery times.

### Template A: Main landing page

Desktop section order:
1. Announcement/top strip only if verified.
2. Full-bleed dark editorial hero. Left: eyebrow, 2-line promise, real benefit text, primary CTA. Right: actual packaging photograph or disclosed mockup.
3. Cream 3-column trust/process strip: tea, packaging, delivery (avoid fake metrics).
4. Gallery of 6 packaging formats with hover details and filters.
5. Interactive 3-step preview teaser that works without authentication.
6. “Choose how you print” visual three-way comparison: label, short-run printed, gravure.
7. Tea sourcing and sampling with currently validated options.
8. “How we bring your brand to life” 6-stage timeline.
9. Transparent pricing/MOQ explainer with quote CTA.
10. Verified examples and real photos only.
11. FAQs and enterprise contact panel.

Mobile order: stack hero image under copy; one clear primary CTA; swipable packaging gallery; start sample or continue design; avoid oversized sticky banners.

### Template B: Packaging catalogue
Header + filters + category chips + packaging grid. Filters: pack type, net weight, finish, material, compatible printing, order quantity band and availability. A card shows real/illustrative image disclosure, capacity, material, compatible methods, quantity status and CTA. Category pages use server-rendered titles and canonical metadata; do not index empty combinations.

### Template C: Design Studio (signature screen)
**Desktop >1200px:** 250px left wizard choices / flexible 620px central stage / 305px right quote. Header has brand/project title, saved status and exit. Top of stage has preview orientation tabs (front, back, top, dieline). Bottom has a drag/drop area for label/logo uploads; accessible fallback controls for keyboard users.

**Tablet 760–1200px:** 2 columns (controls 280px / stage) with quote beneath stage.

**Mobile <760px:** single-column: step progress → visual stage → small option selector → bottom sticky “Save design / View estimate”. Never squeeze desktop 3 columns into 375px.

**Stage layers:** pack silhouette / shadow / editable label safe zone / user logo or artwork / small material swatch / mockup disclosure. Do not claim the CSS illustration is a validated real-world 3D fit. Subsequent high-fidelity viewer must be driven by validated physical dimensions and print dielines.

**Editor modes:** Quick Brand (brand name, colours, type, basic logo) and Upload My Artwork (customer uploads PDF/SVG/PNG with preflight warnings). Pro print layer needs bleed, trim, safe zones, colour mode, image DPI, fonts/rights, PDF output and proof approval.

### Template D: Packaging detail
Left 55% large product image with 6+ angles; right 45% selection + technical info. Tabbed “Materials”, “Dimensions”, “Printing”, “Minimum Orders”, “Artwork guide”, “Shipping/FAQ”. Every displayed dimension must be actual SKU data. Download dieline only when approved; when unavailable show “Request dieline”, not fabricated PDF.

### Template E: Quote page
Show selected tea, grade/origin if verified, package, print process, art revision, quantities, material line items, tea loss assumptions, labour, tooling, freight, taxes, grand total and expiry. For estimated/managed pricing, no deposit CTA until the quote is confirmed.

### Template F: Customer project page
Cards: brand kit, approved tea, selected packaging, design history, quote, sample, artwork approval, delivery milestone. Separate customer-visible milestones from internal production notes. Reorder from an approved locked SKU rather than replaying a stale catalogue configuration.

### Template G: Admin studio
Existing AdminShell, no new admin layout. Dashboard summary → packaging/print catalogue → MOQ/price books → quote queue → brand projects → artwork proof queue → order/production handoffs → reports. Dense tables for operations; tabs and side-panels for edits. Full audit events displayed for price, artwork, supplier and status changes.

---

## 4. Shared component architecture

Use a **small set of shared primitives**; specialized blocks should compose them. No giant 1000-line `DesignStudio.tsx`.

**Global UI primitives** (`src/components/ui/`): `ActionButton`, `Surface`, `SectionHeading`, `Field`, `SelectField`, `SegmentedTabs`, `StatusLabel`, `EmptyState`, `FileDropZone`, `ConfirmDialog`, `MobileBottomBar`, `Money`, `Skeleton`. Reuse existing equivalents if already present; add only the missing primitives.

**Private-label business components** (`src/components/private-label/`):
- `PrivateLabelHero`, `ProcessTimeline`, `PackagingCard`, `PackagingGrid`, `MaterialSwatch`, `PrintMethodCard`, `QuantityBreakTable`, `SampleCallout`, `ComplianceNotice`.
- `StudioShell`, `StudioStepNavigation`, `OptionTile`, `PackagingCanvas`, `ArtworkLayerControls`, `LabelSafeZone`, `ViewTabs`, `ArtworkUploadPanel`, `PreviewDisclosure`, `PriceSummary`, `ConfiguratorErrors`.
- `QuoteBreakdown`, `QuoteStatus`, `ProjectTimeline`, `RevisionHistory`, `ProofApproval`, `ProductionMilestones`.

**Feature hooks** (`src/components/private-label/hooks/`): `useStudioDraft`, `usePreviewState`, `useQuoteEstimate`; hooks own client interaction only, no privileged pricing/approval logic.

**Server domain** (`src/lib/private-label/`): `types`, `schemas`, `catalog`, `compatibility`, `moq`, `pricing`, `quotes`, `projects`, `designs`, `artwork-preflight`, `workflow`, `audit`, `public-dto`, `authorization`, `service`, `production-adapter`.

**Component contract:** presentation components consume typed values and callbacks; they never read DB or infer availability. Server components load sanitized DTOs and provide them as props. `QuoteSummary` prints server-confirmed or explicitly estimated amounts only.

---

## 5. Proposed file tree (new files only; NOT a complete application)

```text
src/
├── app/
│   ├── private-label/
│   │   ├── page.tsx
│   │   ├── packaging/page.tsx
│   │   ├── packaging/[slug]/page.tsx
│   │   ├── start/page.tsx
│   │   ├── studio/page.tsx
│   │   ├── pricing/page.tsx
│   │   ├── samples/page.tsx
│   │   ├── contract-manufacturing/page.tsx
│   │   └── [optional destination]/...  # only after real market support
│   ├── account/private-label/
│   │   ├── page.tsx
│   │   ├── projects/[id]/page.tsx
│   │   └── quotes/[id]/page.tsx
│   ├── admin/private-label/
│   │   ├── page.tsx
│   │   ├── packaging/page.tsx
│   │   ├── printing/page.tsx
│   │   ├── prices/page.tsx
│   │   ├── projects/page.tsx
│   │   ├── quotes/page.tsx
│   │   ├── artwork/page.tsx
│   │   └── jobs/page.tsx
│   └── api/v1/private-label/
│       ├── catalogue/route.ts
│       ├── validate/route.ts
│       ├── estimates/route.ts
│       ├── projects/route.ts
│       ├── projects/[id]/route.ts
│       ├── artworks/upload-intent/route.ts
│       ├── artworks/[id]/preflight/route.ts
│       ├── designs/[id]/preview/route.ts
│       ├── quotes/route.ts
│       ├── quotes/[id]/route.ts
│       ├── samples/route.ts
│       └── admin/[...domain]/route.ts  # explicit handler routes preferred
├── components/
│   ├── ui/                      # only missing reusable primitives
│   └── private-label/
│       ├── shared/
│       ├── landing/
│       ├── catalogue/
│       ├── studio/
│       ├── quotes/
│       ├── customer/
│       ├── admin/
│       └── styles/
└── lib/private-label/
    ├── schemas.ts
    ├── types.ts
    ├── catalogue.ts
    ├── compatibility.ts
    ├── pricing.ts
    ├── moq.ts
    ├── projects.ts
    ├── quotes.ts
    ├── revisions.ts
    ├── artwork.ts
    ├── workflow.ts
    ├── authorization.ts
    ├── public-dto.ts
    ├── audit.ts
    └── integrations/
        ├── trial-samples.ts
        ├── wholesale-leads.ts
        ├── production.ts
        ├── shipping.ts
        └── mcp.ts
scripts/migrations/045_private_label_core.mjs  # verify first free number
scripts/migrations/046_private_label_quotes.mjs
scripts/migrations/047_private_label_artwork.mjs
tests/unit/private-label/
tests/e2e/private-label.spec.ts
```

Add public routes to `src/lib/seo/sitemap.ts` only after content is published. Add nav entries through the existing `src/lib/contentBlocks.ts`/StorefrontHeader system, not through a second nav definition. Add admin nav in `src/components/admin/layout/navConfig.ts`. Extend `src/lib/mcp.ts` through typed service adapters; do not make MCP call public HTTP endpoints and bypass in-process auth.

---

## 6. Business data model and constraints

**Core entities (conceptual):**
1. `pl_clients`: customer reference and organization identity.
2. `pl_brands`: owner, name, brand kit and trademark/content attestation.
3. `pl_projects`: owner/client reference, status, revision, draft JSON, timestamps.
4. `pl_project_items`: tea, packaging, quantity, artwork revision, target market.
5. `pl_tea_options`: approved source recipe references, catalog status, claims, sample policy.
6. `pl_packaging_families`: pouch, jar, tin, carton, sachet, bag.
7. `pl_packaging_variants`: dimensions, capacity, structure, closure, available colours, supplier, status.
8. `pl_print_methods`: process description, handling, finish and compatibility.
9. `pl_print_compatibility`: permitted package × material × print method × size rules.
10. `pl_supplier_quotes` and `pl_price_books`: supplier costs, effective dates, currency, lead times.
11. `pl_moq_rules`: different unit bases, order multiples, effective windows.
12. `pl_artwork_assets`: owner and permissions, file hash, MIME type, storage key, rights, preflight status.
13. `pl_design_versions`: immutable scene JSON, template revision, source artwork and render references.
14. `pl_approval_events`: exact design/quote revision, actor, action, timestamp, evidence.
15. `pl_quotes` / `pl_quote_items`: immutable snapshot with price version and expiry.
16. `pl_samples`, `pl_orders`, `pl_jobs`, `pl_shipments`, `pl_audit`.

**Indexes:** unique slug per published catalog object, unique `(client_id, brand_name)` as appropriate, owner+status+updated_at for project lists, SKU/status for catalog, quote status+expiry, indexes on project revision, append-only audit by entity/time. Use foreign keys and `CHECK` constraints on nonnegative money, quantity and permissible states. Public DTOs exclude supplier costs and other clients' records.

**Guardrails:** Use safe server-side authorization on every access, CAS revision checks, idempotency keys for creation/order actions, and transactional audit. Do not embed external customer artwork into public media library URLs by default.

---

## 7. Pricing and MOQ engine

### Inputs
`tea_recipe_id`, `tea_weight_g`, `packaging_variant_id`, `print_method_id`, `print_colour_count`, `artwork_revision_id`, `quantity`, `shipping_destination`, `customer_price_book_id`, `currency`, `quote_date`.

### Cost components
`tea_cost`, `approved_fill_loss`, `primary_pack`, `closure/liner`, `label`, `printing`, `tooling`, `packing_labour`, `QC`, `carton/insert`, `freight`, `commercial_overhead`, `contingency`. Selling margin and applicable tax are separate.

### MOQ logic
For a requested **filled-pack count** `Q`, validate separately:
- `ceil(Q × weight_g / 1000)` versus minimum tea kg, with batch allowances.
- `Q` versus minimum primary pack quantity and pack order multiple.
- `Q` versus label minimum and print minimum in pieces.
- If printing is in kilograms, convert only using verified printed film weight/length/yield assumptions.
- `Q` versus minimum filling batch and factory slot.
- Finished goods value and destination serviceability.
- Custom tooling ownership, colour count and setup validity.

Return human-readable blockers, eligible alternatives and the nearest valid quantity; do not simply report `Q < 500`. If supplier quotes or stock are missing, emit **managed quote required**, not zero prices.

### Quote states
`draft → pricing_pending → estimated → firm_issued → customer_accepted → (expired | superseded | converted)` with explicit allowed transitions. Printed previews and approved artwork are independent gates.

### Pricing snapshots
Store exact price inputs/cost line items, version, effective date, applied margin, tax, shipping region, exclusions and approvals. Retain the original quote after an admin price update. Customer is shown a *price status*, not just a number.

---

## 8. Artwork, mockup and prepress design

**Editor stage 1:** support brand name, logo and single front-label image placement using constrained 2D scene coordinates. Store physical base package dimensions in millimetres, pixel-to-mm ratio, label safe area, rotation and crop. Rendering is concept art, never final artwork approval.

**Editor stage 2:** additional panels (back/top/gusset), prepared templates, typography, colour palette, layered design JSON, user-supplied print-ready PDF and snapshot versions. Render `.png` for web; preserve separate `.pdf`/vector input as original.

**Editor stage 3:** high-fidelity 3D using real supplier-provided mesh/dielines, finish simulation, 360º rotation and downloadable customer previews. This is not a phase-one dependency.

**Upload acceptance:** signed private upload, validated extension/MIME, malware scan, file size and pixel limits, SVG sanitization or conversion, document password detection, source hash, authorization, audit, storage lifecycle and retention policy. Renderers must not execute arbitrary SVG/PDF scripts. Provide prepress warnings for low DPI, missing bleed, image scaling, unsafe text, missing mandatory label zones or unverified colour output.

**Labels:** front/back preview should include configurable legal-information reserve areas that cannot be printed over by beginner mode. Regulatory review and human confirmation remain necessary.

**Sample data disclosure:** label every non-production simulation as “Digital mockup — illustrative only.” Real uploaded gallery photos are distinguishable from design previews.

---

## 9. API / MCP proposal

### Public reads
- `GET /api/v1/private-label/catalogue`: published packaging and tea choices, filters, safe fields only.
- `GET /api/v1/private-label/catalogue/:slug`: published specification, permitted print choices and transparent status.
- `POST /api/v1/private-label/validate`: calculate compatibility/MOQ; no order created.
- `POST /api/v1/private-label/estimates`: return validated estimate/managed quote state with breakdown or blockers.

### Authenticated customer writes
- `POST /api/v1/private-label/projects`: create draft for authenticated client; rate limited.
- `PATCH /api/v1/private-label/projects/:id`: ownership and optimistic revision guard.
- `POST /api/v1/private-label/artworks/upload-intent`: allocate private signed storage target.
- `POST /api/v1/private-label/quotes`: create snapshot, not an implicit firm offer.
- `POST /api/v1/private-label/designs/:id/approve`: only with exact revision and explicit customer consent.

### Admin-only
- Catalogue, supplier, pricing, quote revisions, manual feasibility, proof QC, production release, and dispatch actions, all through `guard` + domain authorization + audits.

### MCP tools
`private_label_list_catalogue`, `private_label_upsert_packaging`, `private_label_set_moq`, `private_label_upsert_price_rule`, `private_label_get_project`, `private_label_generate_preview`, `private_label_create_quote`, `private_label_list_approval_queue`, `private_label_record_review`, `private_label_release_job`, `private_label_report_dashboard`.

**Security:** MCP must enforce authorization per resource/role, not rely solely on possession of a generic global token for sensitive client material. The write tools must invoke exactly the same service functions used by the admin routes; return structured errors and refusal reasons when a prerequisite is missing.

---

## 10. Phased delivery backlog with acceptance gates

### M0 — Operational discovery [P0]
- [ ] Verify legal name/brand responsible party, FSSAI and packing authorization.
- [ ] Inventory equipment, validated printing methods, food-contact substrates, pack sizes and capacity.
- [ ] Obtain dated supplier price sheets, MOQ unit, ink/tooling quotes, freight matrix and lead-time terms.
- [ ] Define whether samples/tea recipes are supplied in-house or by partners, and exact responsibilities.
- [ ] Confirm deployed Git commit, existing DB backend and data-migration strategy; reconcile with archive.
- [ ] Audit existing marketing claims and product photography disclosures.
**Exit:** signed-off `capability_matrix.csv` and `pricebook_v1` with evidence and owners. No firm pricing otherwise.

### M1 — Shared architecture / data [P0]
- [ ] Create core table migrations after number 044, and PostgreSQL equivalent where applicable.
- [ ] Implement domain types, Zod schemas and public DTOs.
- [ ] Add tenant authorization, revision CAS and append-only audit.
- [ ] Build packaging compatibility and MOQ validators with deterministic tests.
- [ ] Add global shared UI primitives only where existing ones lack parity.
- [ ] Add feature flags (`catalogue_enabled`, `studio_preview_enabled`, `firm_quotes_enabled`).
**Exit:** verified migrations, CRUD through services, auth/isolation tests, no public exposure.

### M2 — Admin first [P0]
- [ ] Catalogue CRUD for tea, pack structures, print methods, photos and custom options.
- [ ] Suppliers, per-material specs, document uploads and SKU status.
- [ ] Price book + MOQ rule editor, cost history and price versioning.
- [ ] Product content, SEO metadata, FAQ management and publication gate.
- [ ] Preview rule conflicts, invalid combinations and missing supplier cost.
**Exit:** one operator can publish a validated packaging SKU without editing React code.

### M3 — Landing / catalogue / SEO [P0]
- [ ] `/private-label` public landing, brand story, process, CTA, disclosures.
- [ ] `/private-label/packaging` filterable searchable catalogue with cards.
- [ ] `/private-label/packaging/[slug]` detail pages, compatible printing and MOQ explanation.
- [ ] Extend StorefrontHeader and footer navigation with active links.
- [ ] Add metadata, breadcrumbs, sitemap rules and noindex for unpublished/draft assets.
- [ ] Optimize photography formats, srcsets, accessible descriptions.
**Exit:** usable public catalogue on 320px–1440px screens with correct canonical pages.

### M4 — Configurator + quotation [P0]
- [ ] Stepper: tea → package → print → artwork → quantity → estimate.
- [ ] Save/retrieve project drafts with resumable steps and price invalidation.
- [ ] Compatibility and MOQ error messages with alternatives.
- [ ] Server-backed price calculation with ranges and cost breakdown; manual-review flag.
- [ ] Quote request form and project summary with contact details/consent.
- [ ] Manage quoted states, expiry, revision and downloadable branded PDF after final QA.
**Exit:** authentic approved example config can be created, priced or routed to managed quote end-to-end.

### M5 — Design Studio [P1]
- [ ] Browser drag/drop logo and design asset with private upload.
- [ ] SVG/PDF/image preflight and permitted file types.
- [ ] Start with 2D mockup, front/back view, safe-zone guide, colour/label templates.
- [ ] Versioned design scene and shareable, authorization-limited preview.
- [ ] User approval, revision history and secure print-ready proof upload.
- [ ] Screenreader, keyboard controls and reduced-motion support.
**Exit:** a customer can upload an art file, preview, revise, submit and approve the same exact proof revision.

### M6 — Samples, orders, production [P1]
- [ ] Sample order flow linked to real trial inventory or material sample provider.
- [ ] Project → quote → customer acceptance → payment → production handoff.
- [ ] Cross-check inventory reservation, BOM, labelling and artwork approval.
- [ ] QC and packaging readiness; dispatch and shipment events.
- [ ] Client dashboard with order milestones, approved SKU and reorder.
**Exit:** one genuine order is traceable from enquiry to delivery with reversible failure handling.

### M7 — MCP/API parity [P1]
- [ ] Register read/mutate tools in `src/lib/mcp.ts`; document schemas.
- [ ] Test each tool for unauthorized and cross-tenant access.
- [ ] Verify identical service validation from admin, website and MCP.
- [ ] Enforce idempotency, rate limiting, payload limits, audit records.
- [ ] Implement quote/production approvals as authorization-restricted actions.
**Exit:** automated parity suite passing for identical test records and workflows.

### M8 — Scale and optimization [P2]
- [ ] 3D material previews with supplier assets; gated by accurate dielines.
- [ ] Enterprise contracts and price books.
- [ ] Export workflows with jurisdiction-specific compliance/documentation.
- [ ] Funnel analytics, A/B tests, abandoned draft recovery with consent.
- [ ] Original technical guides, case studies and international SEO content.
**Exit:** measured increase in qualified RFQs and reliable repeat purchasing without introducing data/process conflicts.

---

## 11. Test/QA acceptance matrix

| Test | Expected behavior |
|---|---|
| 2 customers open each other's project URLs | Forbidden/not found with no data leak |
| Package not compatible with UV | UI excludes it; API rejects tampered request |
| 100-piece order against 500-piece supplier MOQ | Quote blockers and valid alternative, no firm order |
| Gravure cylinder rules altered by admin | New estimates updated; accepted quotes unchanged |
| Customer changes design after approval | Approval invalidated for new revision |
| Quote version becomes stale | Requote required before production conversion |
| Artwork is malformed or oversized | Upload/preflight rejects with clear error |
| Agent attempts production release without approval | Domain rejects and audits attempt |
| Customer uses keyboard only at mobile width | All critical studio actions reachable |
| Reduced-motion preference | Preview and panels update without forced animation |
| Packaging image missing | Styled fallback, not broken image |
| 3D/canvas unsupported | 2D fallback remains fully useful |
| Price visible in public card | Backed by validated price book or clear status disclosure |
| Brand origin/certification claim lacks proof | Publish blocked or claim omitted |
| Admin data and MCP data differ | Contract test fails; source-of-truth correction required |

Performance target at p75: LCP <=2.5s, INP <=200ms, CLS <=0.1 per `design.md`; don't force dynamic 3D on initial public page. Accessibility WCAG 2.2 AA target.

---

## 12. Reusable sample code, aligned with Next 15 / React 19 / CSS Modules

> **These are illustrative component-level snippets, not a complete app.** They intentionally use demo styling/content and avoid fake prices. Source image files, server-side business services and API handlers must be wired by the implementation team. Do not directly deploy the visual proof as print artwork.

### Sample A — reusable design primitives

**Target:** `src/components/private-label/shared/StudioPrimitives.tsx`

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "../styles/PrivateLabel.module.css";

export function StudioSectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      {description && <p className={styles.sectionIntro}>{description}</p>}
    </div>
  );
}

export function StudioLink({
  href,
  children,
  appearance = "primary",
}: {
  href: string;
  children: ReactNode;
  appearance?: "primary" | "outline";
}) {
  return (
    <Link
      href={href}
      className={
        appearance === "primary" ? styles.actionPrimary : styles.actionOutline
      }
    >
      {children}
      <span aria-hidden="true">↗</span>
    </Link>
  );
}

export function StudioAction({
  children,
  onClick,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={styles.actionPrimary}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function PreviewNotice() {
  return (
    <span className={styles.previewNotice}>
      Digital mockup — illustrative only
    </span>
  );
}
```

**Why shared?** Every public landing, detail, studio, quote and customer page can use the same section heading, links, actions and preview disclosures without copying appearance classes. Production UI should also share a `StatusLabel`, `Money` component and accessible form elements.

### Sample B — reusable catalogue product card

**Target:** `src/components/private-label/catalogue/PackagingCard.tsx`

```tsx
import Image from "next/image";
import Link from "next/link";
import styles from "../styles/PrivateLabel.module.css";

export type PackagingCardData = {
  id: string;
  slug: string;
  title: string;
  family: string;
  description: string;
  image?: { src: string; alt: string; illustrative: boolean };
  methods: string[];
  orderStatus: "qualified" | "manual_quote";
  moqSummary?: string; // From verified admin rule, never guessed
};

export function PackagingCard({ item }: { item: PackagingCardData }) {
  return (
    <article className={styles.packagingCard}>
      <Link
        href={`/private-label/packaging/${item.slug}`}
        className={styles.cardMedia}
        aria-label={`Explore ${item.title}`}
      >
        {item.image ? (
          <Image
            src={item.image.src}
            alt={item.image.alt}
            fill
            sizes="(max-width: 620px) 100vw, (max-width: 1100px) 50vw, 33vw"
            className={styles.cardImage}
          />
        ) : (
          <span className={styles.imageFallback}>Packaging preview coming soon</span>
        )}
        {item.image?.illustrative && (
          <span className={styles.imageCaption}>Illustrative image</span>
        )}
      </Link>
      <div className={styles.cardBody}>
        <p className={styles.eyebrow}>{item.family}</p>
        <h3><Link href={`/private-label/packaging/${item.slug}`}>{item.title}</Link></h3>
        <p className={styles.cardDescription}>{item.description}</p>
        <div className={styles.methodRow}>
          {item.methods.slice(0, 3).map((method) => (
            <span key={method}>{method}</span>
          ))}
        </div>
        <div className={styles.cardFooter}>
          <p>
            {item.moqSummary
              ? `Minimum: ${item.moqSummary}`
              : "MOQ confirmed during quotation"}
          </p>
          <Link href={`/private-label/packaging/${item.slug}`}>
            {item.orderStatus === "qualified" ? "Configure" : "Request quote"}
            <span aria-hidden="true"> ↗</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
```

**Integration contract:** Fetch `PackagingCardData[]` from a sanitized server DTO. The card must not compute MOQ or price; those are calculated centrally. Give product detail pages the same source and only expand fields.

### Sample C — interactive studio preview prototype (feature component only)

**Target:** `src/components/private-label/studio/StudioPreviewDemo.tsx`

This is a *controlled visual demonstration* of a brand name on a CSS pack mockup. It illustrates the component organization, responsive behavior and visual style. It is **not** a print-accurate editor, does not perform uploads, and deliberately does not invent costs.

```tsx
"use client";

import { useMemo, useState } from "react";
import { StudioAction, PreviewNotice } from "../shared/StudioPrimitives";
import styles from "../styles/PrivateLabel.module.css";

type PackKind = "pouch" | "tin";
type Choice = {
  id: PackKind;
  title: string;
  description: string;
  printMethods: readonly string[];
};

// Demonstration-only choices. Replace with published catalogue DTOs.
const DEMO_CHOICES: readonly Choice[] = [
  {
    id: "pouch",
    title: "Stand-up pouch",
    description: "A compact retail silhouette with a front-label area.",
    printMethods: ["Paper label", "Premium sticker", "Custom print"],
  },
  {
    id: "tin",
    title: "Tea tin",
    description: "A structured presentation for gifting or premium shelves.",
    printMethods: ["Paper label", "Printed sleeve"],
  },
];

export function StudioPreviewDemo() {
  const [kind, setKind] = useState<PackKind>("pouch");
  const [brandName, setBrandName] = useState("YOUR TEA BRAND");
  const [printMethod, setPrintMethod] = useState("Paper label");
  const [showBack, setShowBack] = useState(false);

  const choice = useMemo(
    () => DEMO_CHOICES.find((entry) => entry.id === kind)!,
    [kind]
  );

  function chooseKind(next: PackKind) {
    const nextChoice = DEMO_CHOICES.find((entry) => entry.id === next)!;
    setKind(next);
    setPrintMethod(nextChoice.printMethods[0]); // Reset incompatible selection
  }

  return (
    <section className={styles.studio} aria-label="Packaging design demonstration">
      <aside className={styles.studioPanel} aria-label="Design options">
        <p className={styles.eyebrow}>01 / Your packaging</p>
        <h2 className={styles.panelTitle}>Make it yours.</h2>
        <p className={styles.panelDescription}>
          Explore how your identity could look on different packaging shapes.
        </p>

        <fieldset className={styles.choiceFieldset}>
          <legend>Packaging format</legend>
          {DEMO_CHOICES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.optionTile}
              aria-pressed={kind === item.id}
              onClick={() => chooseKind(item.id)}
            >
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </fieldset>

        <label className={styles.fieldLabel} htmlFor="pl-brand-name">
          Brand name
        </label>
        <input
          id="pl-brand-name"
          className={styles.textField}
          value={brandName}
          maxLength={36}
          onChange={(event) => setBrandName(event.target.value)}
          placeholder="Your brand name"
        />

        <label className={styles.fieldLabel} htmlFor="pl-print-method">
          Branding method
        </label>
        <select
          id="pl-print-method"
          className={styles.textField}
          value={printMethod}
          onChange={(event) => setPrintMethod(event.target.value)}
        >
          {choice.printMethods.map((method) => (
            <option key={method}>{method}</option>
          ))}
        </select>
      </aside>

      <div className={styles.previewStage}>
        <div className={styles.stageHeader}>
          <span>TEAFLOWW ATELIER / DIGITAL PROOF</span>
          <div className={styles.stageTabs} aria-label="Preview side">
            <button type="button" aria-pressed={!showBack}
              onClick={() => setShowBack(false)}>Front</button>
            <button type="button" aria-pressed={showBack}
              onClick={() => setShowBack(true)}>Back</button>
          </div>
        </div>

        <div className={styles.previewModelArea}>
          <div className={`${styles.mockPack} ${kind === "tin" ? styles.mockTin : styles.mockPouch}`}>
            {kind === "pouch" && <span className={styles.mockSeal} aria-hidden="true" />}
            <div className={styles.mockLabel}>
              <span className={styles.mockLabelKicker}>
                {showBack ? "BACK LABEL PREVIEW" : "SMALL BATCH TEA"}
              </span>
              <strong>{showBack ? "Product information" : (brandName || "YOUR BRAND")}</strong>
              <span className={styles.mockLabelRule} aria-hidden="true" />
              <small>{showBack ? "Layout pending legal review" : "Tea • Crafted for your brand"}</small>
            </div>
          </div>
        </div>
        <PreviewNotice />
      </div>

      <aside className={styles.quotePanel} aria-label="Current configuration">
        <p className={styles.eyebrow}>Your selection</p>
        <h2 className={styles.panelTitle}>The details.</h2>
        <dl className={styles.summaryList}>
          <div><dt>Package</dt><dd>{choice.title}</dd></div>
          <div><dt>Branding</dt><dd>{printMethod}</dd></div>
          <div><dt>Preview</dt><dd>Illustrative only</dd></div>
          <div><dt>Price</dt><dd>Calculated after specifications</dd></div>
        </dl>
        <p className={styles.quoteNote}>
          MOQ, dimensions, print suitability and pricing require published
          supplier specifications and production validation.
        </p>
        <StudioAction
          onClick={() => {
            // A real implementation must save to the authenticated project API.
            // This isolated sample intentionally does not pretend to save data.
          }}
          disabled
        >
          Save project — wire to API
        </StudioAction>
      </aside>
    </section>
  );
}
```

**Production additions:** replace demo choice data with active supplier-qualified DTOs, attach authorized project mutations, add upload/preflight, insert a server-backed estimate, and provide a keyboard-accessible position/size editor (numeric fields in addition to pointer drag).

### Sample D — scoped styling, premium responsive layout

**Target:** `src/components/private-label/styles/PrivateLabel.module.css`

```css
.studio, .packagingCard, .sectionHeading { --pl-forest:#143c31; --pl-deep:#092b23; --pl-paper:#f6f1e7; --pl-ivory:#fffcf7; --pl-gold:#b39156; --pl-ink:#171713; --pl-muted:#65746d; --pl-line:#d9dfd7; }
.studio { display:grid; grid-template-columns:250px minmax(0,1fr) 305px; gap:1px; background:#d9dfd7; min-height:640px; border:1px solid var(--pl-line); color:var(--pl-ink); }
.studioPanel, .quotePanel { padding:34px 25px; background:var(--pl-ivory); min-width:0; }
.eyebrow { font:700 10px/1.5 Arial,sans-serif; text-transform:uppercase; letter-spacing:.18em; color:var(--pl-gold); margin:0 0 14px; }
.panelTitle { font:400 clamp(27px,2.2vw,37px)/1.06 Georgia,serif; letter-spacing:-.04em; margin:0 0 12px; }
.panelDescription { font-size:13px; line-height:1.65; color:var(--pl-muted); margin-bottom:28px; }
.choiceFieldset { border:0; padding:0; margin:0 0 24px; }
.choiceFieldset legend, .fieldLabel { display:block; font-size:12px; font-weight:700; margin-bottom:9px; color:#36483d; }
.optionTile { width:100%; display:flex; flex-direction:column; gap:5px; text-align:left; padding:15px; margin:0 0 9px; border:1px solid var(--pl-line); border-radius:7px; color:var(--pl-ink); background:transparent; transition:border-color .18s,background .18s,transform .18s; }
.optionTile strong { font-size:13px; } .optionTile small { font-size:11px; line-height:1.4; color:#65746d; }
.optionTile[aria-pressed=true] { background:#e8efe8; border-color:#23483a; box-shadow:inset 3px 0 #23483a; }
.optionTile:hover { border-color:#728b7b; transform:translateY(-1px); }
.textField { display:block; width:100%; min-height:46px; border:1px solid #bac7ba; border-radius:6px; background:#fff; padding:12px; font-size:14px; margin-bottom:22px; color:#171713; }
.textField:focus-visible, .optionTile:focus-visible, .stageTabs button:focus-visible { outline:3px solid var(--pl-gold); outline-offset:3px; }
.previewStage { position:relative; display:flex; flex-direction:column; isolation:isolate; min-width:0; color:#f7f1e7; background:radial-gradient(ellipse at 50% 46%,#27634c 0,#123d30 38%,#082a24 80%); overflow:hidden; }
.previewStage::before { content:""; position:absolute; inset:18% 9%; border:1px solid #e1cb9540; border-radius:50%; pointer-events:none; }
.stageHeader { z-index:1; display:flex; justify-content:space-between; gap:14px; padding:24px 25px; font:700 10px Arial,sans-serif; letter-spacing:.12em; color:#ddc69a; align-items:center; }
.stageTabs { display:flex; padding:3px; background:#ffffff1c; border:1px solid #ffffff20; border-radius:6px; }
.stageTabs button { min-width:55px; min-height:38px; border:0; color:#fff; background:transparent; border-radius:4px; font:600 11px Arial,sans-serif; }
.stageTabs button[aria-pressed=true] { background:#f6f1e7; color:#123d30; }
.previewModelArea { flex:1; display:grid; place-items:center; padding:15px 30px 48px; min-height:460px; perspective:1000px; }
.mockPack { position:relative; display:grid; place-items:center; box-shadow:18px 30px 35px #04120d80, inset 7px 0 19px #ffffff24, inset -13px 0 25px #00191090; filter:drop-shadow(0 16px 12px #06191155); }
.mockPouch { width:min(66%,290px); min-width:190px; aspect-ratio: .72; background:linear-gradient(105deg,#174735 0%,#3c7357 24%,#204a39 58%,#102c23 100%); clip-path:polygon(9% 0,91% 0,98% 5%,98% 95%,92% 100%,8% 100%,2% 95%,2% 5%); border-radius:10px 10px 18px 18px; transform:rotateY(-9deg) rotateZ(-1deg); }
.mockSeal { position:absolute; top:18px; left:11%; width:78%; border-top:3px solid #cdd6b04d; border-bottom:1px solid #081a12; height:7px; }
.mockTin { width:min(62%,255px); min-width:170px; aspect-ratio:.84; border-radius:18px 18px 35px 35px; background:linear-gradient(100deg,#0c291f,#3b6850 27%,#143428 73%,#071f19); transform:rotateY(-10deg); }
.mockTin::before { content:""; position:absolute; top:-8px; left:1%; width:98%; height:23px; border:3px solid #c0ad78; border-radius:50%; background:linear-gradient(90deg,#19392e,#69826a,#1d4936); }
.mockLabel { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; width:75%; min-height:45%; padding:18px 12px; text-align:center; background:#efe7d7; color:#1b3c2d; border:2px solid #d6c49d; box-shadow:0 4px 12px #06201554; overflow-wrap:anywhere; }
.mockLabelKicker { font:700 8px Arial,sans-serif; letter-spacing:.15em; }
.mockLabel strong { font:400 clamp(15px,2.2vw,27px)/1.12 Georgia,serif; letter-spacing:-.03em; max-width:100%; }
.mockLabelRule { width:36px; height:1px; background:#b39156; }
.mockLabel small { font:10px/1.5 Georgia,serif; color:#546358; }
.previewNotice { position:relative; z-index:1; display:block; margin:0 20px 20px; text-align:center; color:#d6ded4; font-size:11px; }
.summaryList { margin:24px 0; border-top:1px solid var(--pl-line); }
.summaryList div { display:flex; justify-content:space-between; gap:16px; border-bottom:1px solid var(--pl-line); padding:16px 0; font-size:12px; }
.summaryList dt { color:var(--pl-muted); } .summaryList dd { margin:0; max-width:145px; text-align:right; font-weight:700; }
.quoteNote { color:var(--pl-muted); font-size:12px; line-height:1.6; margin-bottom:24px; }
.actionPrimary, .actionOutline { display:inline-flex; align-items:center; justify-content:center; gap:14px; min-height:46px; padding:12px 20px; text-decoration:none; font:700 12px Arial,sans-serif; border-radius:4px; cursor:pointer; }
.actionPrimary { background:#23483a; color:#fffdf6; border:1px solid #23483a; } .actionOutline { background:transparent; color:#23483a; border:1px solid #728b7b; }
.actionPrimary:disabled { opacity:.55; cursor:not-allowed; }
.sectionHeading { max-width:720px; margin:0 auto 36px; text-align:center; }
.sectionHeading h2 { font:400 clamp(30px,4vw,58px)/1.1 Georgia,serif; letter-spacing:-.04em; }
.sectionIntro { color:#65746d; font-size:15px; line-height:1.7; }
.packagingCard { background:#fffcf7; border:1px solid #e4e2d9; border-radius:9px; overflow:hidden; min-width:0; }
.cardMedia { position:relative; display:block; aspect-ratio:4/5; overflow:hidden; background:#e6e8e0; }
.cardImage { object-fit:cover; transition:transform .3s ease; } .cardMedia:hover .cardImage { transform:scale(1.04); }
.imageFallback { display:grid; place-items:center; height:100%; color:#65746d; font-size:13px; }
.imageCaption { position:absolute; left:12px; bottom:12px; background:#f6f1e7e8; padding:5px 8px; font-size:10px; }
.cardBody { padding:22px; } .cardBody h3 { font:400 28px/1.2 Georgia,serif; margin:0 0 10px; }
.cardDescription { font:13px/1.6 Arial,sans-serif; color:#65746d; }
.methodRow { display:flex; flex-wrap:wrap; gap:6px; margin:20px 0; }
.methodRow span { font:11px Arial,sans-serif; border:1px solid #d9dfd7; padding:7px; }
.cardFooter { display:flex; justify-content:space-between; gap:12px; align-items:center; border-top:1px solid #e4e2d9; padding-top:16px; font-size:12px; }
.cardFooter p { color:#65746d; margin:0; } .cardFooter a { white-space:nowrap; font-weight:700; color:#23483a; }
@media (max-width:1200px) { .studio { grid-template-columns:265px minmax(0,1fr); } .quotePanel { grid-column:1/-1; } }
@media (max-width:760px) { .studio { display:flex; flex-direction:column; } .studioPanel { order:2; padding:23px 20px; } .previewStage { order:1; } .previewModelArea { min-height:380px; } .quotePanel { order:3; padding:24px 20px; } .stageHeader { padding:16px 18px; } .mockPouch { width:230px; } .mockTin { width:205px; } .cardFooter { flex-direction:column; align-items:flex-start; } }
@media (prefers-reduced-motion:reduce) { .optionTile,.cardImage { transition:none; } .optionTile:hover,.cardMedia:hover .cardImage { transform:none; } }
```

This example is intentionally restrained: a premium stage and paper label, not an excessively animated SaaS dashboard. Upgrade the CSS-only product silhouette to a supplier-accurate 2D/3D render *after* the real packaging template is available.

### Sample E — deterministic MOQ validation (subset of full rules)

**Target:** `src/lib/private-label/moq.ts`

```ts
import { z } from "zod";

export const moqInputSchema = z.object({
  requestedUnits: z.number().int().min(1).max(10_000_000),
  netWeightGrams: z.number().positive().max(100_000),
  teaMinimumKg: z.number().nonnegative(),
  packagingMinimumUnits: z.number().int().nonnegative(),
  printingMinimumUnits: z.number().int().nonnegative(),
  fillingMinimumUnits: z.number().int().nonnegative(),
  orderMultiple: z.number().int().positive(),
});

export type MoqInput = z.infer<typeof moqInputSchema>;

export function evaluateMoq(raw: MoqInput) {
  const input = moqInputSchema.parse(raw);
  const teaUnits = Math.ceil(input.teaMinimumKg * 1000 / input.netWeightGrams);
  const baseMinimum = Math.max(
    teaUnits,
    input.packagingMinimumUnits,
    input.printingMinimumUnits,
    input.fillingMinimumUnits,
    1
  );
  const nextValidUnits =
    Math.ceil(Math.max(input.requestedUnits, baseMinimum) / input.orderMultiple) *
    input.orderMultiple;

  const reasons: string[] = [];
  if (input.requestedUnits < teaUnits) reasons.push("Below minimum tea batch");
  if (input.requestedUnits < input.packagingMinimumUnits) reasons.push("Below packaging MOQ");
  if (input.requestedUnits < input.printingMinimumUnits) reasons.push("Below printing MOQ");
  if (input.requestedUnits < input.fillingMinimumUnits) reasons.push("Below filling batch minimum");
  if (input.requestedUnits % input.orderMultiple !== 0)
    reasons.push(`Quantity must be a multiple of ${input.orderMultiple}`);

  return {
    eligible: reasons.length === 0,
    requestedUnits: input.requestedUnits,
    nextValidUnits,
    reasons,
  };
}
```

**Important:** This snippet handles *piece-based* rules and minimum tea kg, not roll film kg yield, tooling amortization, wastage, quantity-break prices, destination feasibility, multi-SKU grouping or supplier batch shares. Those require separate tested rules. Don't use this alone to issue firm gravure quotes.

### Sample F — production API boundary pattern, not a full service

**Target:** `src/app/api/v1/private-label/projects/route.ts`

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerSession } from "@/lib/customerSessions";
// This service is new and must be implemented; see project CRUD milestone.
import { PrivateLabelProjects } from "@/lib/private-label/projects";

export const runtime = "nodejs";

const createProjectSchema = z.object({
  brandName: z.string().trim().min(2).max(100),
  targetMarket: z.string().trim().min(2).max(80),
  // All product, artwork and pricing fields are resolved server-side later.
});

export async function POST(request: Request) {
  const user = getCustomerSession(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in to save a project." }, { status: 401 });
  }

  // Before enabling: add shared rate limiter, anti-abuse checks and request-size bound.
  const raw: unknown = await request.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project details." }, { status: 400 });
  }

  // Service owns UUID creation, ownership, CAS revision, transaction and audit.
  const project = await PrivateLabelProjects.createDraft({
    ownerCustomerId: user.id,
    ...parsed.data,
    idempotencyKey: request.headers.get("Idempotency-Key") ?? undefined,
  });

  return NextResponse.json({ project }, { status: 201 });
}
```

**Production cautions:** This is an interface sketch. `PrivateLabelProjects` does not currently exist in the uploaded source. Add idempotent replay handling (return 200 for replays), consistent domain errors, CSRF-origin protection appropriate to cookie sessions, and failure handling before deployment. Admin routes should use `guard()`; customer routes should use customer session validation, not admin access. Every get/update should query by both `project_id` and `owner_customer_id` or verified organization membership.

### Sample G — Vitest contract for the MOQ subset

**Target:** `tests/unit/private-label/moq.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { evaluateMoq } from "@/lib/private-label/moq";

const base = {
  requestedUnits: 250,
  netWeightGrams: 100,
  teaMinimumKg: 10,
  packagingMinimumUnits: 200,
  printingMinimumUnits: 500,
  fillingMinimumUnits: 100,
  orderMultiple: 50,
};

describe("private label minimum order rules", () => {
  it("reports printing as the blocker", () => {
    const result = evaluateMoq(base);
    expect(result.eligible).toBe(false);
    expect(result.nextValidUnits).toBe(500);
    expect(result.reasons).toContain("Below printing MOQ");
  });

  it("allows a valid exact minimum", () => {
    const result = evaluateMoq({ ...base, requestedUnits: 500 });
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("enforces order multiples even above the minimum", () => {
    const result = evaluateMoq({ ...base, requestedUnits: 520 });
    expect(result.eligible).toBe(false);
    expect(result.nextValidUnits).toBe(550);
  });
});
```

### Sample H — feature page metadata and composition

**Target:** `src/app/private-label/page.tsx`

```tsx
import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo/metadata";
import { StudioSectionHeading, StudioLink } from
  "@/components/private-label/shared/StudioPrimitives";
import styles from "@/components/private-label/styles/PrivateLabel.module.css";

export const metadata: Metadata = constructMetadata({
  title: "Private Label Tea & Packaging | TEAFLOWW",
  description: "Explore custom tea sourcing, packaging and private-label design. Compare formats and request a production quotation.",
  path: "/private-label",
});

export default function PrivateLabelLandingPage() {
  return (
    <main>
      <section className={styles.studioHeroIntro}>
        <p className={styles.eyebrow}>TEAFLOWW / PRIVATE LABEL ATELIER</p>
        <h1>Your name. Your tea. A beautifully made brand.</h1>
        <p>Explore the tea, packaging and design choices for your next product.</p>
        <StudioLink href="/private-label/studio">Explore the studio</StudioLink>
      </section>
      <section className="container section">
        <StudioSectionHeading
          eyebrow="THE COLLECTION"
          title={<>Beautiful on the shelf. Considered in every detail.</>}
          description="Explore available formats and request the specification that fits your brand."
        />
        {/* Insert published, server-rendered PackagingGrid here. */}
      </section>
    </main>
  );
}
```

Add the following to the same CSS module, or compose the existing hero instead:

```css
.studioHeroIntro { background:radial-gradient(circle at 85% 10%,#255643,#092b23 70%); color:#fffcf7; padding:clamp(70px,9vw,142px) max(20px,calc((100vw - 1320px)/2)); }
.studioHeroIntro h1 { max-width:780px; margin:0 0 24px; font:400 clamp(48px,6vw,91px)/1.04 Georgia,serif; letter-spacing:-.055em; }
.studioHeroIntro > p:not(.eyebrow) { max-width:550px; font-size:17px; line-height:1.7; color:#dae2d9; margin-bottom:28px; }
.studioHeroIntro .actionPrimary { background:#e8c78d; color:#10382a; border-color:#e8c78d; }
```

**Production page requirement:** Replace section-only demo with actual admin-managed hero media, proof links, packaging cards, sample CTA, verified trust evidence, SEO breadcrumbs, localized content as supported, FAQ and quote actions. Do not publish this placeholder section as a completed business feature.

---

## 13. Operations, ownership and release checklist

**Roles:** Product owner approves commercial scope and design; sourcing validates supplier quotes/stock; production qualifies packaging and machine routes; prepress approves dieline/print process; regulatory owner approves required claims and labels; engineer owns security/data/migrations; content owner approves images and copy; sales approves final custom quotes; finance confirms invoicing/payment and margins. All actions need a named internal actor, not generic “system approved.”

**Change management:** Create a feature branch, inventory existing migration version, use feature flags, run migrations in staging, ensure PG parity, seed only verified packaging data, test with fake design projects isolated from production, then publish landing/catalogue separately from quoting and production. Ship production writes only after audit and approval tests pass. Rollback should disable flags and revert code while retaining safe additive schema; never delete customer designs as a rollback shortcut.

**Recommended CI gates:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and `npm run test:e2e`. Run with the production DB backend on staging and exercise upload, preview, quotation, payment, dispatch and MCP workflows. The archive includes these scripts, but they were not executed as part of this design review.

**Success metrics:** organic qualified enquiries, completed projects, sample requests, quote turnaround, conversion from estimate to accepted quote, contribution margin by packaging family, manufacturing approval rework, on-time dispatch, repeat orders, support tickets per 100 projects, production incidents, and p75 Core Web Vitals.

---

## 14. Task dependencies and launch recommendation

**Build order:** source audit/operational reality → backend/domain rules and auth → admin catalogue → public catalogue and landing → quote wizard → design preview → approval → production integrations → MCP parity → analytics/advanced 3D.

**Recommended first release:** An editorial landing, 6–8 validated packaging SKUs, genuine photos, a simple guided configuration, 2D brand preview, sample/RFQ capture, and operator-managed quotations. This is a small but strong commercial experience. Do not postpone launch waiting for custom 3D meshes or full self-service gravure checkout.

**Definition of done for the first release:** A real prospective customer can find an eligible packaging type, discover the exact supplier-qualified minimum, configure tea and branding, save a project, request a quote, and receive a traceable admin response with a transparent status. All of it must remain mobile-friendly, accurate and accessible.

---

## 15. Codebase references and external developer documentation

### In-archive design references
- `design.md` — north star, visual tokens, accessibility and performance.
- `docs/UI_COMPONENTS.md` — component inventory and acceptance conventions.
- `docs/TeaFloww_BlendLab/assets/previews/desktop.png` and `mobile.png` — editorial design previews.
- `src/components/trials/TrialsCollection.module.css` — responsive CSS Modules pattern.
- `src/lib/trials/service.ts` and `scripts/migrations/035_trials_v3.mjs` — service/transaction/audit/lifecycle patterns.
- `src/components/home/RitualHero.tsx` — established storefront imagery and CTA composition.
- `src/lib/contentBlocks.ts` — admin-capable navigation data.
- `src/components/admin/layout/navConfig.ts` — admin sidebar sections.
- `src/lib/seo/metadata.ts` and `src/lib/seo/sitemap.ts` — metadata and sitemap integration.
- `src/lib/mcp.ts` — tool definition/dispatch patterns.
- `src/lib/adminHttp.ts` / `src/lib/customerSessions.ts` — distinct admin and customer authorization boundaries.
- `tests/unit/trials-*`, `tests/e2e/trials-v3.spec.ts` — domain workflow and end-to-end testing examples.

### External official references for implementers
- Next.js App Router routing and Route Handlers: https://nextjs.org/docs/app
- React component composition and state: https://react.dev/learn
- Tailwind CSS v4: https://tailwindcss.com/docs/installation/framework-guides/nextjs
- Zod validation: https://zod.dev/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Google structured data guidelines: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data

**Final caveat:** This is a repository-informed blueprint. The project-specific class names, sample types, new domain services and proposed migrations are **design proposals**, not features confirmed to exist. Before implementation, compare the ZIP snapshot against the deployed branch and confirm all supplier, regulatory and financial requirements with the responsible team.