# Tea Traders — trader studio

## Purpose and visual direction — 18 November 2026

The implemented local `/tea-traders` redesign responds to the supplied Tea Traders blueprint: help a buyer choose a trading model, understand costs, compare teas and prepare an informed purchase or enquiry. The blueprint describes a broader future product; deferred capabilities below are not represented as completed.

This surface extends the established forest/ivory/brass identity and Georgia/Arial typography governed by `design.md`. It uses the first configured hero as a static introduction; other stored hero slides remain preserved. This is a surface extension, with no replacement global DESIGN file or token system.

## Implemented journey

- Four audience choices—new reseller, retailer, distributor and own brand—change advice and relevant catalogue formats. The progressive planner collects budget, target customers, region, PIN, experience, existing customers, timing and volume. It downloads a TXT plan and can fill an editable enquiry summary capped at 500 characters.
- Catalogue-backed economics use actual public quantity-tier prices and three independently editable scenarios. Missing costs stay pending. Warnings cover MRP, negative profit, stock and unconfirmed freight. Money calculations use integer amounts; partial-stock cost of goods sold is distinguished from full upfront funding, which includes an operating reserve. Credit period is planning context, not a supplier-credit offer or full cashflow forecast. No fabricated custom tea prices substitute for catalogue fields.
- Format filters and comparison of up to three teas expose recorded ingredients, tasting notes, grade, pack and documentation information. No invented quality scores are added. Existing add-to-cart and buy behavior remains in place.
- Blank CSV worksheets support customer outreach, sample evaluation and stock records. A four-stage checkable preparation roadmap also downloads as TXT. Seven searchable FAQs provide progressive guidance. Company identity follows approved TeaFloww/Nirva details; no new testimonials, case studies or process proof are invented.
- The four-stage enquiry uses the existing backend and retains Zod validation, UTM attribution, consent and idempotency. An editable planner handoff does not itself submit a lead or confirm commercial terms.

## Content and operational boundaries

Hindi tool copy joins the existing Translation Studio, administrator and MCP presentation-copy workflow. Additive field defaults preserve compatibility with older presentation documents. Other languages fall back to source until a translation is published.

Existing APIs, payment gateway and checkout remain authoritative. No schema, dependency or deployment changes accompany this work. Deferred: live wholesale freight provider, negotiated-rate engine, verified new samples/case studies and audited content, advanced cashflow, CRM follow-ups and a new funnel-event taxonomy. The planner and calculator do not establish legal compliance, credit availability, delivery serviceability or guaranteed profit.

## Verification record

Final typecheck and scoped lint passed. Fourteen focused tests passed after the final presentation-compatibility refinement, including preservation of required legacy copy fields. The initial `npm run check` passed typecheck/lint but stopped with 40 shared-database contention failures in unrelated suites. A separate full run on `/tmp/teafloww-trader-studio-validation.sqlite` then passed all 3,189 tests (215 files passed, one skipped; six PostgreSQL-only tests skipped). The isolated production build using a separate SQLite copy and `.next-trader-studio-build` completed successfully, generating 130 pages. These individual checks passed; the original `npm run check` invocation is not described as green.

Browser checks verified downloaded planner TXT contents, private-label handoff, invalid-PIN recovery, product comparison, independent scenario inputs, missing-freight pending state, FAQ search and blank CSV downloads. A mocked enquiry failure followed by success preserved the same retry key. That mocked success is not evidence of a persisted lead or real saved reference. No real lead, order, payment or WhatsApp message was sent. English and Hindi at 320px, plus desktop 1440px and mobile 390px, showed no horizontal overflow. Earlier screenshots in this directory remain historical evidence, not proof of the current implementation.

Current actual browser captures: `output/playwright/trader-studio-{desktop,mobile}.png`, `trader-studio-{desktop,mobile}-hero.png`, `trader-studio-{desktop,mobile}-selector.png`, `trader-studio-economics.png`, `trader-studio-enquiry-mobile.png` and `trader-studio-hindi-320.png`. The independent design review requested a higher-contrast focus outline on dark surfaces. The light-brass override was keyboard-verified (`rgb(227, 199, 141)`) and captured in `trader-studio-economics-{desktop,mobile}-focus.png`; the reviewer returned ship for that fix. Assistive-technology certification and field performance measurements are not claimed. The detector only flagged the established Arial convention.
