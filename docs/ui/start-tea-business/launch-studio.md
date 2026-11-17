# Start your tea business — launch studio

Implemented locally on 18 November 2026 as an extension of the established TeaFloww identity. This document describes the current `/start-tea-business` surface; `README.md` in this directory records the earlier option-1 implementation and its historical evidence. Global visual guidance remains in `design.md`; no new global token system is introduced.

## Purpose and visual direction

Help a beginner move from an idea to a practical first plan, while an existing trader can go directly to the quotation form. The selected blueprint fixes a dark forest hero, ivory planning surfaces and restrained brass controls within the incumbent Georgia/Arial typography. Editorial hierarchy, generous spacing and open sections keep the page approachable. The plan preview uses a footer wordmark so its heading remains the first reading priority. On narrow screens, planning controls and preview stack vertically.

## Implemented journey

- Five decisions produce a live plan preview, a plain-text download and a suggested tea-shop, private-label or trader destination. Choosing to use the plan fills an editable enquiry note; submission retains the existing consent requirement. Planner decisions reset on refresh, as disclosed beside the preview.
- The starting-capital estimator accepts seven user estimates: opening tea inventory, packaging and artwork, equipment and setup, rent and deposits, launch marketing, freight and applicable tax, and working-capital reserve. Each category must be completed before a total appears. Unknown costs remain pending; enter zero only after confirming a cost does not apply. Amounts are summed in integer paise, with no supplied supplier rates or illustrative business scenarios. Inputs reset on refresh and are not included in the enquiry.
- The existing contribution calculator now includes prepared-chai unit costs. Its results depend on the buyer’s assumptions and do not promise profit.
- Progressive launch guides reveal the next relevant advice and link to the existing private-label and tea-shop journeys. The planner also links to the trader journey.
- Catalogue samples, administrator-managed copy and offers remain authoritative. Existing enquiry API validation and idempotency are preserved; planning is not an order or live trade-pricing engine.

## Boundaries

No schema changes, dependencies or deployment accompany this work. Deferred: live trade pricing, carrier serviceability, automated legal determination, saved progress, sensitivity scenarios, CRM follow-ups and new verified case studies. Legal and operational guidance must remain qualified; no fictional evidence or rates should fill those gaps.

## Verification and evidence — 18 November 2026

`npm run check` completed successfully: TypeScript, ESLint (existing warnings), 3,173 passing tests, six PostgreSQL-only skipped tests, and the optimized production build generating 130 pages. Twenty focused unit tests passed across starter presentation, contribution calculation, catalogue samples and launch capital. Scoped lint and typecheck were also rerun after the enquiry adjustment.

Browser interaction checks passed for planner completion into an editable enquiry note, download contents and selected-offer handoff, prepared chai with ₹15 selling price / ₹9 variable cost / ₹3,000 fixed cost producing 500-cup break-even, ₹10,000 capital, and pending results for missing freight. English and Hindi layouts at 320px showed no horizontal overflow. No live quotation was submitted and no production mutation occurred.

Actual browser screenshots at 1440px and 390px are in `output/playwright/tea-launch-desktop.png`, `tea-launch-desktop-hero.png`, `tea-launch-desktop-planner.png`, `tea-launch-mobile.png`, `tea-launch-mobile-hero.png` and `tea-launch-mobile-planner.png`. These are browser captures, distinct from the older generated concept image. Development-only Sentry monitoring HTTP 500 and Next.js preload/speculation warnings were observed; no interaction exception was observed. These checks do not constitute assistive-technology certification.


## Startup budget UI refinement — 18 November 2026

Refined only the starting-capital section: closer label/amount grouping, visible rupee prefixes, explicit pending total, valid-category count and field-specific linked errors. Mobile reads introduction, estimates, then summary. Existing integer-paise calculation, required categories, confirmed zero handling and local-only/reset disclosure remain intact. No dependencies, schema changes or deployment.

Reviewed real Chromium captures at 1440px, 768px and 390px, plus Hindi at 320px, with no horizontal overflow. Browser checks verified ₹1,200.30 from decimal estimates, missing freight returning to pending, negative-value errors and sequential keyboard focus. Three launch-capital unit tests and focused ESLint passed. The mechanical detector only flagged the incumbent Arial font, retained per the approved design system. `npm run check` was executed but stopped at an unrelated TS2352 error in `src/lib/business/traderPresentation.ts:8`; full check/build is not reported as passing. Captures: `output/playwright/startup-budget-{desktop,tablet,mobile,mobile-summary,hindi-mobile}.png`.


## Business format illustrations — 18 November 2026

Added three coordinated AI-generated conceptual packaging images above the retail, bulk and private-label options. Assets are local 960×640 WebP (approximately 61/115/67 KiB), lazy-loaded through Next Image with reserved dimensions, responsive sizing, English/Hindi alt text and visible conceptual-image captions. Existing offer content and quote behavior remain authoritative. Full generation prompts and asset paths are recorded in `docs/ui/start-tea-business/business-model-images.md`.

Focused ESLint and five starter-presentation unit tests passed. Real Chromium verified all three decoded images, 1440px/390px rendering and each quote button selecting ready_retail, bulk_supply or private_label. No mobile horizontal overflow. Screenshots: `output/playwright/business-model-images-{desktop,mobile}.png`. Mechanical detector reported only the established Arial font, preserved by design. `npm run check` stopped at unrelated TypeScript errors in TradeStorefrontClient.tsx (missing isGeneratedPouches) and traderPresentation.ts (TS2352 schema cast). No full-check/build success is claimed. No deployment, schema or dependency changes.
