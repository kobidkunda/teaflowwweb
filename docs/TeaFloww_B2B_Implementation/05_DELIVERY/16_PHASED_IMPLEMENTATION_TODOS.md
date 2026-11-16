# Implementation Plan & Developer-Ready To-Dos

This file is the delivery backbone. Every ticket includes output, dependency and acceptance test. Estimates are **not fixed commitments**: validate with the actual TeaFloww repository first. Phases are ordered dependencies, not artificial calendar promises.

## Roles

- **OWNER:** TeaFloww product/commercial decision maker; approves facts, budget, business objectives.
- **DESIGN:** Product/UI designer with accessibility responsibility.
- **FE:** Front-end engineer.
- **BE:** Back-end/API engineer.
- **DATA:** Analytics/CRM engineer.
- **OPS:** Sourcing, freight, compliance and sales.
- **ADS:** Paid media + video editor.
- **QA:** Acceptance and regression testing.

## Completion definitions

**P0 / blocker:** must be done before accepting paid business leads.  
**P1 / launch:** necessary for production acquisition.  
**P2 / later:** useful after first real qualified lead cohorts.

## Phase 0 — Discovery, claims and safe integration (P0)

- [ ] **TFW-001 | OWNER+FE:** Locate actual TeaFloww source repository and deployment architecture; record framework/runtime, existing feature flags, version, staging preview. **Done:** written architecture map with owners; no site replacement plan.
- [ ] **TFW-002 | BE:** Inspect existing leads, private-label quote, wholesale inquiry, CRM, order and admin data models. **Done:** mapping to a single lead entity; no duplicate contact records created without reason.
- [ ] **TFW-003 | OPS:** Confirm 25kg sack availability, 250g/500g/1kg formats, possible private-label packs, sample offers. **Done:** per-offer SKU/MOQ/price matrix signed off.
- [ ] **TFW-004 | OPS:** Verify freight, COD policy, GST/tax treatment, route viability, cancellation/RTO, handling time, quote validity and dispatch statements. **Done:** commercial disclosure table in staging.
- [ ] **TFW-005 | OWNER+LEGAL:** Review all “A–Z” services, marketing scope, artwork, label/legal responsibilities and refund/cancellation policy. **Done:** approved public terms.
- [ ] **TFW-006 | OWNER+OPS:** Verify one canonical B2B phone/WhatsApp number and sales team availability. **Done:** test call, test click, verified owner.
- [ ] **TFW-007 | FE+OPS:** Audit inconsistent sitewide contact, sample quantities, free-shipping bars and prices. **Done:** no conflicting public claims on targeted routes.
- [ ] **TFW-008 | ADS:** Confirm approved campaign spend, market, access permissions, active campaign separation and creative rights. **Done:** budget/geo document and approval; do not spend before it.
- [ ] **TFW-009 | DATA:** Audit existing pixel/GA4/Google tags, consent mechanism, GCLID preservation, lead conversion mapping and deduplication. **Done:** event gap report.

**Exit gate G0:** all externally advertised facts signed off; staging/access is ready; no unowned production changes.

## Phase 1 — Design system, content and assets (P0/P1)

- [ ] **TFW-010 | DESIGN:** Establish Figma tokens from `05_VISUAL_DESIGN_SYSTEM.md`, with named color/text/spacing/elevation/motion roles. **Done:** light/forest variants and contrast review.
- [ ] **TFW-011 | DESIGN:** Build 360px, 390px, 768px, 1024px and 1440px layouts for both segment routes. **Done:** no horizontal scroll; fold includes business value and one CTA.
- [ ] **TFW-012 | DESIGN:** Build shared UI components: Section, ButtonLink, card, audience switch, step timeline, FAQ, lead form, mobile bar. **Done:** one spec each, both pages reuse.
- [ ] **TFW-013 | CONTENT:** Approve all hero, offer, footnote, CTA, form, FAQs and success/error text. **Done:** content matches signed-off claim matrix.
- [ ] **TFW-014 | OPS+DESIGN:** Photograph real tea, product packs and working process; capture approved 25kg sack and 250g/500g/1kg pack images. **Done:** rights/alt-text/shot inventory, no fake factory.
- [ ] **TFW-015 | DESIGN:** Produce responsive and interactive states (default, selected, hover, focus, disabled, loading, errors, success). **Done:** accessible component checklist and screenshots.
- [ ] **TFW-016 | CONTENT:** Translate full Phase-1 Hindi experience and verify by native reviewer; keep English fallback. **Done:** same actions/claims in both languages.
- [ ] **TFW-017 | FE:** Connect content configuration to existing CMS/admin, with approval flags and missing-value fallbacks. **Done:** unapproved values never render as promises.

**Exit gate G1:** approved Figma and visual components; genuine assets; current content/copy ready.

## Phase 2 — Landing pages & fast responsive UX (P0/P1)

- [ ] **TFW-018 | FE:** Create `/start-tea-business` and `/tea-traders` in existing router. **Done:** correct 200/canonical and SEO metadata; no disruption of existing routes.
- [ ] **TFW-019 | FE:** Implement shared `BusinessLanding` with data-driven persona copy. **Done:** no duplicated card/form implementations.
- [ ] **TFW-020 | FE:** Implement hero, 3-offer grid, five-step process, real proof, source/freight disclosures, FAQs. **Done:** approved design accurate at desktop/mobile.
- [ ] **TFW-021 | FE:** Implement accessible persona switch; preserve lead selections through navigation only as permitted. **Done:** switching does not leak PII into URL.
- [ ] **TFW-022 | FE:** Implement CTA navigation and sticky mobile bar; prevent sticky bar covering submit/help/error content. **Done:** 320px QA plus safe areas.
- [ ] **TFW-023 | FE:** Add localization control without blocking popup; update translated route content. **Done:** keyboard, screen reader and back navigation verified.
- [ ] **TFW-024 | FE:** Optimize LCP image, lazy below-fold media, server content and minimal client JavaScript. **Done:** performance budgets in `17_QA_ACCEPTANCE_RELEASE.md` met where possible and exceptions logged.
- [ ] **TFW-025 | FE:** Add business nav links from existing wholesale/private-label without replacing them. **Done:** no regressions to current consumer/store routes.

**Exit gate G2:** two working pages with approved content, stable mobile design and navigation.

## Phase 3 — Quote lead pipeline & CRM (P0/P1)

- [ ] **TFW-026 | BE:** Finalize lead schema for segment, offer, quantity band, pincode, name/phone, consent, source. **Done:** server validates and rejects unknown payload keys.
- [ ] **TFW-027 | FE:** Build five-group form with accessible errors, progress/loading and clear consent. **Done:** form functions at 320px/low bandwidth.
- [ ] **TFW-028 | BE:** Add server API validation, rate limits/abuse handling, request body size, origin checks and idempotency. **Done:** duplicate retry creates one lead; changed payload key returns 409.
- [ ] **TFW-029 | BE:** Implement transactional DB lead+outbox, retries and dead-letter alert; adapt to existing CRM. **Done:** no successful UI response before DB commit.
- [ ] **TFW-030 | OPS:** Assign lead owners and lifecycle/status definitions; quote service scope and contact process. **Done:** one sales workflow from new to paid order.
- [ ] **TFW-031 | FE+OPS:** Enable verified business WhatsApp route and prefilled **non-sensitive** message. **Done:** actual test contact; WhatsApp click not counted as conversation.
- [ ] **TFW-032 | BE+QA:** Test serviceable/unserviceable pincode, below/above MOQ, retry, network failure, 500, CRM failure and offline follow-up. **Done:** clear end-user outcome and operator alerts.
- [ ] **TFW-033 | DATA:** Associate first order/quotation to original lead and source. **Done:** full CRM lead→quote→paid-order trail.

**Exit gate G3:** lead end-to-end completed on staging, sales confirms receipt and quote visibility.

## Phase 4 — Measurement, QA and compliance (P0/P1)

- [ ] **TFW-034 | DATA:** Define event schema `14_MEASUREMENT_AND_OPTIMIZATION.md`. **Done:** unique events and no raw PII in dataLayer.
- [ ] **TFW-035 | DATA:** Review Consent Mode/analytics gating, existing GA4 property and platform permissions. **Done:** event fires only as authorized; opt-out tested.
- [ ] **TFW-036 | DATA:** Capture approved UTMs/click IDs; map traffic to B2B lead ID and prevent cross-site leakage. **Done:** first/last touch documented.
- [ ] **TFW-037 | DATA:** Define qualified-business-lead and first-paid-order imports to Meta/Google (where supported). **Done:** test payloads reconcile uniquely.
- [ ] **TFW-038 | QA:** Run playwright visual, keyboard, screen reader, 3G/slow, Chrome/Safari/Firefox and phones. **Done:** all blocking issues resolved.
- [ ] **TFW-039 | SECURITY:** Audit spam, bot, PII access, security headers, exports, retention/deletion and dependency vulnerabilities. **Done:** security approval.
- [ ] **TFW-040 | OPS:** Acceptance test on real leads entered from test numbers, follow-ups and itemized quote approval. **Done:** recorded proof of process.

**Exit gate G4:** instrumentation/consent/CRM tested, accessibility/performance approved.

## Phase 5 — Produce paid creative, stage ads and launch on approval (P1)

- [ ] **TFW-041 | ADS:** Shoot and edit four 9:16 Meta masters per `13_CAMPAIGN_BUILD_AND_CREATIVE.md`. **Done:** source files and rights verified.
- [ ] **TFW-042 | ADS:** Build four Google video recuts and captions; **do not spend on Google video yet**. **Done:** ready-to-upload video assets.
- [ ] **TFW-043 | ADS:** Create 4 RSA drafts (two per ad group) from approved canonical copy, verify lengths. **Done:** validation report with character counts.
- [ ] **TFW-044 | ADS:** Finalize region/serviceability, audiences, exclusion logic and negative keywords. **Done:** ops and privacy approval.
- [ ] **TFW-045 | ADS:** Build **paused/draft** Meta and Google Search campaigns using authenticated native tools. **Done:** preview and targeting report; no unapproved spend.
- [ ] **TFW-046 | DATA:** Run click-through QA using test UTM, Pixel/GA4, API lead, CRM stage and quote. **Done:** full attribution trace.
- [ ] **TFW-047 | OWNER:** Review creatives, landed offer, conversions, exact budget and status; approve explicit activation. **Done:** recorded sign-off.
- [ ] **TFW-048 | ADS:** Enable only approved campaigns; monitor for disapproval, billing and tracking. **Done:** spend matches authorization and no unrelated ad change.

**Exit gate G5:** user-approved and technically verified launch; complete ad evidence saved.

## Phase 6 — Learning and iteration (P1/P2)

- [ ] **TFW-049 | ADS+DATA:** Twice-weekly search terms/lead quality review. **Done:** decisions logged with before/after state.
- [ ] **TFW-050 | OPS:** Capture leads reasons, quotes, samples and first paid orders. **Done:** >=95% leads stage-tagged after first contact (operating target, adjust if not practical).
- [ ] **TFW-051 | DATA:** Build CPQL, lead-to-quote, quote-to-order, CAC, net contribution dashboard. **Done:** reconcilable to CRM and ad spend.
- [ ] **TFW-052 | DESIGN+ADS:** Test one creative variable at a time and stop losing angles only after meaningful volume. **Done:** decision record.
- [ ] **TFW-053 | OPS+FE:** Add verified ROI/landed-cost calculator only after freight + tax + SKU rules. **Done:** outputs label assumptions and quote-only data.
- [ ] **TFW-054 | OWNER+ADS:** Consider Google video/Demand Gen after lead tracking and approved incremental spend. **Done:** documented go/no-go.

## Prioritization matrix

| Order | Work package | Must precede | Ship criteria |
|---|---|---|---|
| 1 | Facts, stack and assets | All | Owner signatures + repo survey |
| 2 | Shared design/components | Landing pages | Mobile/desktop signed off |
| 3 | Landing pages | Paid acquisition | Both routes work |
| 4 | Lead API/CRM | Conversion tests | Test lead-to-quote trace |
| 5 | Consent/tracking/QA | Launch | Reconciled lead quality |
| 6 | Meta + Search staging | Approval | Paused/draft setup |
| 7 | Launch and iteration | Explicit spend authorization | First qualified lead reports |

## Definition of done for an engineering PR

PR has screenshots (320/390/768/1440), accessibility notes, tests, no secrets or PII in client events, route and source validation, design token consistency, relevant campaign tags, rollback/feature flag, owner-reviewed copy, and proof that unrelated customer flows continue working.
