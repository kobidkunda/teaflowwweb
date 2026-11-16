# TeaFloww B2B Growth Experience — Implementation Blueprint

**Edition:** 17 November 2026  
**Deliverable:** Complete design, engineering, analytics, content, ad-production and release specification for TeaFloww's tea-business acquisition experience.  
**Status:** **Implementation instructions and copyable code examples only**. No code was deployed, no campaigns created, no budgets changed, and no customer leads touched.

## The outcome

Build one conversion-focused tea trading business experience for two journeys:

1. **Starter:** a first-time buyer who wants to source tea and possibly create a consumer-facing tea brand.
2. **Trader:** an established wholesale buyer or reseller comparing bulk supply, branded pouches and blend/packing support.

Both journeys must share the same **design system, reusable components, API, lead record, events, trust proofs and editorial rules**. Only the content, qualification fields, and calls to action adapt by audience.

### What is in this archive

| Read order | File | Use |
|---|---|---|
| 1 | `00_START/01_DECISIONS_AND_SOURCE_GATES.md` | Facts vs unverified claims; launch blockers |
| 2 | `01_PRODUCT/02_PRD_AND_SCOPE.md` | Objectives, requirements, non-goals, roles |
| 3 | `01_PRODUCT/03_USER_FLOWS_AND_ROUTES.md` | Entire conversion journey and URL plan |
| 4 | `01_PRODUCT/04_PAGE_BLUEPRINTS_AND_COPY.md` | Every page section, copy and UI state |
| 5 | `02_DESIGN/05_VISUAL_DESIGN_SYSTEM.md` | Unified tokens, typography, surfaces, motion |
| 6 | `02_DESIGN/06_RESPONSIVE_WIREFRAMES.md` | Detailed wireframes and breakpoint behavior |
| 7 | `02_DESIGN/07_SHARED_COMPONENT_CONTRACTS.md` | Reusable component API and state model |
| 8 | `03_ENGINEERING/08_ARCHITECTURE_REPOSITORY.md` | Reference stack, file structure and integrations |
| 9 | `03_ENGINEERING/09_CODE_DESIGN_FOUNDATION.md` | Full theme, utilities, card/button/section sample code |
| 10 | `03_ENGINEERING/10_CODE_LANDING_PAGES.md` | Hero, offer, segment pages, accessibility, SEO |
| 11 | `03_ENGINEERING/11_CODE_LEAD_FORM_AND_API.md` | Form, validation, route handler, idempotency |
| 12 | `03_ENGINEERING/12_CODE_DATABASE_EVENTS_AND_CRM.md` | Schema, tracking, lifecycle and server workflows |
| 13 | `03_ENGINEERING/22_CODE_PREMIUM_INTERACTIONS.md` | Visual polish: product-stage, gallery, CTA, motion and UI snippets |
| 14 | `02_DESIGN/26_STUNNING_DESIGN_TEMPLATE.md` | Self-contained HTML/CSS visual template inside Markdown |
| 15 | `03_ENGINEERING/23_CONTENT_ADMIN_AND_INTEGRATIONS.md` | Admin-backed offers, products and lead operations |
| 16 | `03_ENGINEERING/24_SECURITY_PRIVACY_OPERATIONS.md` | Security, privacy, spam and permission requirements |
| 17 | `04_GROWTH/13_CAMPAIGN_BUILD_AND_CREATIVE.md` | Meta + Google ad construction, A/B tests, scripts |
| 18 | `04_GROWTH/14_MEASUREMENT_AND_OPTIMIZATION.md` | Event taxonomy, attribution, metrics, dashboards |
| 19 | `04_GROWTH/15_SEO_COPY_I18N.md` | Multilingual, metadata, credibility and legal content |
| 20 | `05_DELIVERY/16_PHASED_IMPLEMENTATION_TODOS.md` | Owner-ready tickets, sequencing, dependencies |
| 21 | `05_DELIVERY/17_QA_ACCEPTANCE_RELEASE.md` | Test plan, acceptance criteria, release/runbook |
| 22 | `05_DELIVERY/18_EXPERIMENTS_AND_BACKLOG.md` | Experiment matrix and later improvements |
| 23 | `06_SOURCES/19_OFFICIAL_REFERENCES.md` | Primary docs and claim sources |
| 24 | `06_SOURCES/20_ORIGINAL_CAMPAIGN_PACK.md` | The user's original vetted campaign draft, preserved |
| 25 | `06_SOURCES/21_SECOND_UPLOADED_AUDIT.md` | The user's more assertive audit/creative proposal, preserved as supplied |
| 26 | `05_DELIVERY/25_DEVELOPER_HANDOFF_PROMPT.md` | Complete implementer instructions and coding-agent handoff |

## Key product decisions

- **Main discoverable URL** (proposed, not live): `https://teafloww.com/start-tea-business`.
- **Trader landing URL** (proposed, not live): `https://teafloww.com/tea-traders`.
- **Shared backend:** `POST /api/business-leads` (proposed; integrate with existing backend rather than blindly replacing it).
- **First conversion:** verified submitted quotation lead or consented qualifying chat, not a WhatsApp click.
- **Optimization destination:** qualified business lead (CPQL) → quotation → first paid B2B order (CAC).
- **Offers:** 25kg bulk sack supply; 250g/500g/1kg retail packs; custom branding/private label. Any other pack size comes from live catalog and confirmed offer mapping.
- **Mobile-first:** real images, no automatic hero video, optional language picker rather than forced blocking pop-up, lightweight pages.
- **No budget assumptions:** a campaign launch or budget edit requires separate explicit approval.

## Why this is a reference architecture, not a live-site patch

The uploaded briefs expose **routes and public behavior, not the TeaFloww source repository, its framework or database schema**. The code here is a fully specified **Next.js App Router + TypeScript + Tailwind v4 reference implementation** with Prisma/PostgreSQL examples, but it **must be adapted to TeaFloww's real source and authentication/lead APIs**. Never replace the existing storefront, admin, private-label configurator or orders pipeline from these documents alone.

## Minimal first release

**Ship:** new business landing, trader landing, reusable components, lead form, CRM delivery, source capture, attribution, FAQ, trust content and event verification. **Then:** Meta and Google Search tests. **Later:** YouTube/Demand Gen, advanced pack configurator inside the funnel, quote estimator and localized videos.

## Handoff definition

A developer can implement the site from the code documents and data contracts; a designer can build a Figma library from the design docs; a media team can shoot the ads from the creative storyboard; a sales operator can use the lead stages and quote SLAs; a marketer can test and optimize by CPQL/CAC, not superficial clicks.

---

**Important:** Both uploaded source briefs are included untouched in Markdown form for traceability. They contain competing recommendations and some unsupported claims. `01_DECISIONS_AND_SOURCE_GATES.md` is the binding clarification layer for implementation.

## Package format and validation

Every ZIP member has the `.md` extension: this includes the preserved pasted source document and the self-contained HTML/CSS, TypeScript, SQL and JSON examples, all placed in fenced Markdown code blocks. The archive is a **development specification**, not a deployable app; extract each fenced snippet to the target repository only after reviewing existing implementation and approvals.
