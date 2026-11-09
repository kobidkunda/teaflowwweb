# AGENTS.md — Working Rules for TeaFloww Blend Lab

## Mission
Add the Blend Lab service to the existing TeaFloww storefront with a premium customer experience and a defensible physical sample-to-wholesale workflow. Deliver incremental production-ready changes in the existing codebase; **do not replace the storefront or rebuild the TeaPilot ERP**.

## Mandatory before coding
1. Inspect site routes, styling system, auth, checkout, existing product schema, mail, payments, courier integrations, hosting and deployment workflow.
2. Record findings in `docs/INTEGRATION_DISCOVERY.md` and explicitly mark **verified** versus **assumed**.
3. Confirm service-specific taxes, scope and courier rules with business owners; stop service checkout launch if unresolved.
4. Agree the data ownership boundary between storefront orders and TeaPilot samples/tastings/blends.
5. Capture actual desktop/mobile screenshots of existing header, footer, product cards, typography and navigation before landing-page changes.

## Contract-first implementation
- Plans and included deliverables come from one typed config, not duplicated price strings in components.
- Price storage is integer paise; tax categorization is server-owned and configurable. Display ₹299/₹1,999/₹2,999 inclusive *only if billing matches*.
- Never treat browser callback / success URL as a confirmed payment.
- Never create duplicate projects on repeated payment/webhook events.
- Expose no proprietary blend ratios, supplier costs, internal tasting notes, or raw audit logs through customer APIs.
- All report results have provenance (`human_sensory`, `instrument`, `external_lab`, `supplier_claim`, `customer_supplied`, `estimate`, `ai_prediction`).
- A published PDF is immutable; changes create a new numbered revision.
- Keep a real-world custody log of samples and outbound blend trials.

## Frontend standards
- Use reusable shared components; avoid component-local values for colours, spacing, radii, or prices.
- Server-render static marketing content where existing stack supports it; enhance only interactive widgets on client.
- Mobile-first; 360px layouts must not horizontally overflow.
- Base accessible patterns on WCAG 2.2 AA; use 44px touch targets as the project's higher internal standard.
- All controls have real handlers or are explicitly **demo** only.
- Respect reduced-motion preferences.
- Explicit loading, empty, validation, offline/retry, permission-denied, error and success states.
- Do not fabricate accredited lab certification, savings, tester qualifications, reviews, dates or SLAs.

## Definition of done for each PR
- Linked backlog item(s), screenshots and before/after explanation.
- Unit/integration/e2e tests appropriate for the change.
- Accessibility review and responsive checks.
- No secrets in client bundles or sample code.
- Error and retry behavior documented.
- API type/schema changes reflected in contracts.
- Ops workflow and content updated where relevant.
- Reviewer approval before production launch.

## Delivery order
Architecture discovery → design/token approval → landing UI → service intake/payments → courier/intake → testing/report → formulation/revisions → bulk conversion. Feature flags allow independent release of each stage.

## Non-goals
- No AI-only tasting or invented chemical test results.
- No automatic exact reproduction of a competitor's proprietary blend.
- No full ERP redesign.
- No automatic fulfillment of orders before real inventory, compliance and payment checks.
- No unbounded included revisions or sample shipments.
