# Detailed Implementation Plan — TeaFloww Blend Lab

## Guiding principle
Ship a **real service workflow** in verified slices, preserving the current storefront. A beautiful service page that cannot collect samples, produce valid reports or quote bulk tea is not launched.

## Architecture choices requiring discovery
Do not assume the storefront is Next.js. React/TypeScript snippets in this pack are reference components only. First establish the existing frontend framework, routing, checkout provider, customer auth/session model, database/ORM, deployment, admin roles, TeaPilot connectivity and current courier services. See `INTEGRATION_DISCOVERY.md`.

## Workstreams and ownership
| Workstream | Accountable | Deliverables |
|---|---|---|
| Product & operations | Founder / service owner | pricing scope, terms, sample quantity, turnaround, SOP |
| UX / visual | Product designer | mobile/desktop master layouts, tokens, content, states |
| Frontend | Storefront engineer | homepage, landing, intake, report viewer, dashboard |
| Backend | Application engineer | data contracts, project API, payments, courier, permissions |
| Lab operations | Head taster / lab lead | evaluation rubric, scorecards, revision limits |
| Commercial | Procurement / costing lead | lot-based price inputs, quote process, MOQ and validity |
| Finance & compliance | Accountant / compliance adviser | GST classification, invoices, licensing, confidentiality terms |
| QA | QA + security reviewer | automated checks, scenarios, launch gate |

## Critical preconditions (blockers)
**GATE-01** Confirm legal entity details and service invoicing recipient. Store metadata needs review; avoid copying prior placeholder/incorrect contacts into production.

**GATE-02** Confirm GST classification and display. Current connected storefront records show a 5% general tax setting. Tax must not be inferred from product settings for service SKUs.

**GATE-03** Cost each tier per transaction: inbound courier, failed pickups, lab labour, sampling and returns, payment fee, packaging, loss, tax, overhead. Pay special attention to ₹299.

**GATE-04** Publish exact plan entitlements: one submitted reference? included inbound weight? one or two trials? sample mass? one revision? number of reships? regional limits? turnaround? refundable conditions?

**GATE-05** Verify applicable FSSAI licence/registration and whether outside accredited lab tests are upsells. Sensory tasting != laboratory chemical safety testing.

**GATE-06** Determine formula confidentiality/exclusivity/ownership, retention and customer access before opening public purchase.

## Phase 0 — Discovery & contracts (P0)
**Goal:** inventory existing software and validate business feasibility before committing to integrations.

1. Capture current site desktop/mobile, brand settings, top-level route and design token inventory.
2. Inspect current store code/stack and data models, existing checkout semantics, auth and email provider.
3. Assess TeaPilot operations for samples, tastings, analysis, blends, inventory, reports; identify stable APIs versus needing a new adapter.
4. Write a source-of-truth ownership diagram: store owns customer, payment, service order; Blend Lab domain owns project lifecycle; TeaPilot owns tasting/formulation internal records.
5. Perform courier zone checks (including pickup/dropoff alternatives); create published coverage/weight table.
6. Cost all three plans, validate MOQ and tax/invoice flows.
7. Decide PII retention, report permissions, confidentiality, terms and support escalation.
8. Define success metrics and initial baseline.

**Outputs:** `integration-decisions.md` in production repo, confirmed commercial service catalog, scope-approved UI copy, architecture decision records (ADRs), initial design screenshots.

**Exit criteria:** all GATEs have named owner and decision; no launch-blocking unknown remains unassigned.

## Phase 1 — Design system + marketing discovery (P0)
**Goal:** a premium, fast, accessible service landing experience; keep purchase disabled until integrations are correct.

1. Extract current storefront design constraints, align palette and typography with `DESIGN.md`.
2. Implement tokens, foundational Button/Card/Container/Heading/Badge primitives, and typed plan content.
3. Add homepage B2B Blend Lab feature section to existing editorial flow.
4. Add `Blend Lab` navigation destination and footer link.
5. Build `/blend-lab` hero, methodology, steps, report-preview teaser, tier comparison and FAQ.
6. Design all mobile/desktop states and keyboard support.
7. Build clearly marked example report; do not fake real results or staff credentials.
8. Implement performance SEO, metadata, canonical, sitemap, internal links, instrumentation.
9. Test responsive/contrast/semantics before enabling public purchase.

**Outputs:** staging preview, tested responsive components, content approval, analytics events for marketing steps.

**Acceptance:** desktop/tablet/mobile screenshots approved; zero nonfunctional CTAs; price scope caveats visible; no fabrication or certification claims.

## Phase 2 — Purchase, intake and courier (P0)
**Goal:** paid projects can be captured, validated, tracked and received.

1. Add service-specific catalog entries with unique SKU/ID, entitlement record, version, price snapshot.
2. Build `/blend-lab/start` 5-step intake: plan → sample data → objectives → pickup → payment.
3. Validate desired strength/profile, addresses, region, sample weight, mandatory acceptance of service terms and privacy policy.
4. Server-side courier eligibility and pricing policy; fallback 'self-ship' only with explicit customer understanding and commercial agreement.
5. Create draft project with idempotency key before payment; issue payment provider intent/order.
6. Confirm payment by verified webhook/provider server-side check; ledger idempotency under concurrency.
7. Confirm project and send receipt/instructions; do not mark courier as booked until provider confirms.
8. Generate secure project reference, tracking and event stream.
9. Build support handling for failed payment, partially completed intake, pickup unavailable, lost shipment, damaged/insufficient sample, cancellation/refund.
10. Establish auditable chain of custody and sample intake acceptance/rejection statuses.

**Outputs:** paid order → courier → check-in happy path + exception handling; backoffice queue; transactional email templates.

**Acceptance:** webhook replay yields exactly one paid project; no client-supplied price trusted; unserviceable pincodes blocked or clearly rerouted; refund states reconcile.

## Phase 3 — Lab evaluation and professional reporting (P0)
**Goal:** professional tester can create evidence-backed report, and customer can securely receive it.

1. Define sample tasting protocol, recipes for water/milk, wash/cleanliness and sensory anchors.
2. Configure sample identity and session linkage to project.
3. Tester inputs dry-leaf, liquor, infusion/milk cup and notes; gather provenance and optional instruments.
4. Clearly separate sensory findings, estimates, laboratory metrics, supplier claims and AI predictions.
5. Build versioned report schema and reusable A4 PDF design with semantic chapters.
6. Compute/report real price comparisons only where sourced; show data-not-available instead of invented values.
7. Implement draft → reviewer check → publish workflow and immutable PDF file versioning.
8. Deliver via expiring authorized link, email and dashboard; audit file downloads.
9. Add report corrections as new revisions, not silent edits.
10. Verify ₹299 does **not** accidentally grant PDF access; ₹1,999 grants audited report but no formulation trials.

**Outputs:** tester UI, reviewer UI, printable PDF template, report version store, customer document viewer.

**Acceptance:** evidence complete, QA signed, correct entitlements, strong access controls, mobile report usable, PDF prints accurately on A4.

## Phase 4 — Blend development, trial shipments and feedback (P1)
**Goal:** premium customers can evaluate a new or optimized candidate and approve a repeatable formulation.

1. Build approved lot/material selector and candidate recipe versioning.
2. Cost blends using current lot prices and explicit packaging, loss and overhead assumptions.
3. Generate 1–2 candidate formulas within approved ₹2,999 entitlement (or final validated limit).
4. Document real preparation, tasting method, customer targets and reviewer approval.
5. Label candidate samples and pack with traceable IDs; book one included outbound shipment.
6. Publish sample instructions and customer feedback form.
7. Accept requested feedback within defined period; enforce included revision entitlement atomically.
8. Create updated formulation version; preserve trial history and compare original vs revision.
9. Customer selects an approved version or requests commercial consultation.
10. Document substitute-lot policy and how equivalence is re-checked.

**Outputs:** candidate registry, signed-off formula versions, outbound tracking, feedback approval, revision accounting.

**Acceptance:** no physical dispatch without labeling and QA; no formula silently modified; customer can approve only a completed/reviewed version.

## Phase 5 — Wholesale conversion and retention (P1)
**Goal:** move approved customers into repeat wholesale orders and measurable lifetime value.

1. Build quote UI and API: MOQ, 26 kg *proposed* threshold, packaging, freight/tax, valid through, recipe version, production lead time.
2. Commercial reviewer validates raw stock and margin before publishing a quote.
3. Convert approved quote to wholesale order with exact version and customer address.
4. Generate proforma invoice and fulfillment handoff to existing order/production systems.
5. Display manufacturing, shipping and delivered statuses; support reorder and quote refresh.
6. Track report→quote, quote→order, repeat purchase and realized gross profit metrics.
7. Add account-manager followup tools that respect marketing consent.

**Outputs:** a complete closed-loop procurement flow.

**Acceptance:** price cannot be modified client-side; expired quote cannot place order; no substitution without customer reapproval; cost data stays internal.

## Phase 6 — Harden, scale and refine (P2)
- Accessibility audit against WCAG 2.2 AA.
- A/B test *honest* hero copy and report preview placement; no dark patterns.
- Queue-backed long-running PDF jobs, dispatch reconciliation, retry/dead-letter policies.
- Analytics dashboard and customer lifecycle metrics.
- Formal service quality SLAs after measurement.
- Optional international customer inquiry funnel only after cross-border courier/tax requirements are validated.

## Dependency graph
`Business/tax/courier decisions → typed plan catalog → UI & checkout → verified payment → sample intake → tasting → reviewer report → premium blend revision → wholesale quote → order`.

In parallel: `Design tokens → homepage/landing/report UI`, and `Security/consent → all customer-facing APIs`.

## Recommended PR / delivery slicing
- PR01: domain types + shared plan config + tokens.
- PR02: homepage placement + nav/footer.
- PR03: landing and static example report.
- PR04: intake validation + address eligibility.
- PR05: checkout and webhook integration.
- PR06: project status + customer dashboard.
- PR07: courier intake and exception queue.
- PR08: tasting forms and evidence.
- PR09: report builder/approval/PDF.
- PR10: candidate formulas and costings.
- PR11: dispatch, customer feedback, revisions.
- PR12: quotes/wholesale fulfillment integration.
- PR13: security/a11y/performance and launch gates.

## Stage-gate evidence to request in reviews
Each PR should present: linked requirements, API/DB diff, mobile and desktop screenshots, tests, transaction boundaries, error retries, privacy implications, and rollback strategy. Store release decisions with date/owner.
