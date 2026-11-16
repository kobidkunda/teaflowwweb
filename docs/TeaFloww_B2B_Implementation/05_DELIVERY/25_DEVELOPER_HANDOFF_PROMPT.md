# Engineering Handoff — Exact Instructions for Implementing This Blueprint

Use this as a shareable delivery brief in a repository issue, AI coding agent or engineering standup. It is **not** permission to modify production systems or launch ads autonomously. The complete context is the 25+ Markdown files in the archive.

## Project mission

Implement a stunning, consistent, mobile-first **TeaFloww B2B Tea Business Partner** experience at `teafloww.com`, with two routes `/start-tea-business` and `/tea-traders`, reusable design primitives, current admin-backed product/offer data, consent-aware quotation intake, CRM lead stage transitions, and ads conversion attribution. The sales offer is 25kg bulk options, 250g/500g/1kg retail packs, and discussable A–Z private-label brand services from Siliguri. Launch requires approved facts, verified tracking and explicit spend authorization.

## Non-negotiable architecture boundaries

1. Inspect actual TeaFloww repo, existing backend/framework, admin, storefront, CRM and design system before changing a file. The included Next.js/Prisma source is a **reference** to adapt.
2. Reuse shared `Section`, `ButtonLink`, `AudienceSwitch`, `OfferGrid`, `BusinessHero`, `ProcessTimeline`, `BusinessLeadForm`, `FaqAccordion`, `ProofGallery`, `StickyLeadBar` with data-driven audience props. One design token source.
3. Preserve existing shopping, checkout, product variants, inventory, private-label studio, current B2C campaigns and payment integrations.
4. Do not publish an unverified MOQ, sample fee, dispatched-by promise, freight price, certification, direct-garden relationship or guaranteed business margin.
5. No fake factory photos, fabricated reviews, fabricated benchmark claims or unsupported awards.
6. Create a new **first-party** lead record; client analytics never determine qualified status; do not call WhatsApp click a conversion conversation.
7. Consent, idempotency, server validation, access restrictions, rate limiting, outbox retries and operator workflow are launch gates, not enhancements.
8. No new spend, no existing ads budget change, and no automatic campaign activation without user-approved account/budget/geo/creative details.

## Deliverable order — executor instructions

```text
A. Read source gates → inspect repo → write implementation delta to actual codebase.
B. Map existing design tokens and component ownership → build shared Figma/code system.
C. Implement both segment landing pages as server-rendered page content.
D. Use small client islands only for selection, interactive forms and necessary tracking.
E. Build public API + DB/CRM outbox in existing stack → integration tests.
F. Add consent-aware GA4/Meta/Google lead event model; verify no B2C mixup.
G. Verify responsive/performance/a11y and actual visual screenshots.
H. Stage Meta video + Google Search ads as drafts/paused, if tools support.
I. Request explicit budget/launch approval, then enable only approved objects.
J. Analyze CPQL/paid-order outcomes; iterate only based on reliable evidence.
```

## Coding style and review contract

- TypeScript strict mode and typed props/DTOs; no `any` at data boundaries, unless unavoidable existing SDK bridge isolated.
- Server-first pages, minimal hydration, no heavy animation or video autoplay in mobile fold.
- Tokens as variables, not one-off divergent RGB values; components reusable in both routes.
- Accessible buttons/links, no nested interactive targets, semantic headings, focus-visible, inline input errors, 44px+ comfortable mobile targets as design goal.
- Asset registry with rights, alt text and approval status; no broken image refs in production.
- No duplicated SEO metadata across both pages; meaningful distinct copy.
- API has deterministic tests for validation, concurrent requests, duplicate idempotency, CRM timeout, consent and error hygiene.
- Real-user QA at 320/360/390/768/1440 and reduced motion, low bandwidth.

## Completion checklist

- [ ] The two business URLs exist and appear only on approved live/staging environment.
- [ ] Unified TeaFloww design system and shared reusable components.
- [ ] All visible claims approved; real images; localized text reviewed.
- [ ] Source-driven formats, SKU data, commercial MOQ/freight disclosures.
- [ ] Quote form and server API produce one lead+outbox safely.
- [ ] Sales can accept, qualify, quote and mark paid B2B customer.
- [ ] GA4/Meta/Google events demonstrably reflect consent, no PII leaks and no double counts.
- [ ] E2E and device testing passes, visual QA is signed off.
- [ ] Ad variants staged with 2 A/B angles per beginner and trader audience.
- [ ] Owner signs off budgets and business promises before spend.

## Prompt you can paste into a coding agent

```text
You are implementing the TeaFloww B2B tea-business acquisition experience.
FIRST inspect the existing source repository and deployment constraints; do not
assume its framework or database from this reference blueprint. Use all
Markdown instructions in the archive and treat 01_DECISIONS_AND_SOURCE_GATES
as the rule for claims. Deliver a working two-route, shared-component,
mobile-first experience with premium TeaFloww branding and genuine media.

Implement in this order: routing and shared tokens; hero/offer/proof/steps/FAQ;
responsive lead form; secure lead API; CRM/outbox; tracking; tests; staging.
Preserve storefront, purchases and existing campaigns. Build actual code only
in the discovered production repository, not in this Markdown archive.

Create PRs in logically small steps. For each PR provide: paths changed,
typecheck/test output, screenshots of 320px and 1440px designs, consent/PII
assessment, claim checks, dependencies, and rollback plan. Do not activate
ad spend or claim a production deployment unless specifically authorized and
verified. If an integration is unknown, document the adapter and leave a
safe feature-flagged placeholder rather than inventing an endpoint.
```

## Sign-off table

| Area | Signer | Approval needed before |
|---|---|---|
| Commercial offer, MOQ, tax, freight | Ops / finance / owner | Page copy + adverts |
| Brand design and visuals | Design / brand owner | Front-end publish |
| Consent, security and data retention | Engineering / legal | Public lead intake |
| CRM and sales coverage | Sales owner | Public lead intake |
| Media budget, account, regions, creative | Business owner | Ad activation |
| Conversion goals and reporting | Data / paid media | Automated optimization |
