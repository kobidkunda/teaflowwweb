# Detailed TODO Backlog

IDs are designed to move into GitHub/Jira without rewriting. **P0** blocks initial paid service launch. **P1** enables premium trials and wholesale. **P2** is optimization.

## P0 — Discovery and commercial guardrails
- [ ] BL-001 Identify existing frontend, runtime, router, CSS system, deployment, production/staging environments. **Done:** written stack map + code references.
- [ ] BL-002 Map present storefront customer/auth/order/payment and email data model. **Done:** sequence/data diagram.
- [ ] BL-003 Validate connected TeaPilot sample/tasting/blend/report operations. **Done:** read/write permission and adapter matrix.
- [ ] BL-004 Validate customer-facing company name, contact email, domain, support number and invoice details. **Done:** approved branding record.
- [ ] BL-005 Confirm SAC/HSN, GST tax rate, inclusive-price calculations, invoices and refunds. **Done:** accountant sign-off + automated calculation cases.
- [ ] BL-006 Cost ₹299 / ₹1,999 / ₹2,999 tier delivery including courier failures. **Done:** margin worksheet signed off.
- [ ] BL-007 Define courier coverage, prepaid allowance, pickup caps and sample weight. **Done:** public policy and API flags.
- [ ] BL-008 Confirm service scope limits: reference samples, trials, revisions, expiry, turnaround, 26kg MOQ proposal. **Done:** formal entitlement table.
- [ ] BL-009 Approve sample protocol with professional tester and QC role. **Done:** tasting checklist and method version.
- [ ] BL-010 Approve confidentiality, IP rights, liability, cancellation, consent and privacy terms. **Done:** published policy version IDs.

## P0 — Design system and landing
- [ ] BL-011 Extract current brand tokens/photos; audit real homepage and brand page screenshots. **Done:** annotated screenshots.
- [ ] BL-012 Add shared tokens, type scale, buttons, cards, wrappers, fields and section headings. **Done:** documented variants.
- [ ] BL-013 Establish single typed service plan config and feature gating. **Done:** no duplicate hard-coded entitlements.
- [ ] BL-014 Build homepage discovery strip/section. **Done:** mobile/desktop approved.
- [ ] BL-015 Add nav/footer Blend Lab links. **Done:** keyboard navigable.
- [ ] BL-016 Build `/blend-lab` hero, problem, workflow and evidence sections. **Done:** content approval.
- [ ] BL-017 Build sample-report viewer using safe synthetic demonstration content. **Done:** sample data labelled.
- [ ] BL-018 Build 3-tier cards and feature-comparison table. **Done:** exact inclusions and exclusions visible.
- [ ] BL-019 Build goal/cost explorer without unsubstantiated savings claims. **Done:** explain illustrative output.
- [ ] BL-020 Build FAQ, confidentiality, policies, SEO metadata and structured data. **Done:** valid schema and no fabricated reviews.
- [ ] BL-021 Add tracking for view/plan/CTA clicks with consent appropriate. **Done:** verified event schema.
- [ ] BL-022 Complete responsive + keyboard + contrast QA on landing. **Done:** checklist signed.

## P0 — Checkout and sample fulfillment
- [ ] BL-023 Build customer intake drafts, resume flow and account/guest decision. **Done:** no data loss after reload and auth.
- [ ] BL-024 Validate plan, tea type, objectives, price targets, legal consent, addresses. **Done:** shared client/server contract.
- [ ] BL-025 Implement collection pincode eligibility; fail closed. **Done:** clear alternatives.
- [ ] BL-026 Create service project draft with unique public ID and price snapshot. **Done:** idempotent.
- [ ] BL-027 Create server-owned payment intent/order; verify callbacks/webhooks. **Done:** duplicate replay tested.
- [ ] BL-028 Implement service invoice + GST breakdown after accountant review. **Done:** accepted test invoices.
- [ ] BL-029 Implement transactional email for paid/failed/cancelled states. **Done:** templates and retries.
- [ ] BL-030 Implement courier requests only after confirmed payment and eligibility. **Done:** reconciliation and failures.
- [ ] BL-031 Build internal sample receipt and condition documentation. **Done:** sample QR/ID and custody events.
- [ ] BL-032 Handle missing, leaking, damp, insufficient or mismatched samples. **Done:** exception policy.
- [ ] BL-033 Build customer project status & courier tracking UI. **Done:** restricted to owner.
- [ ] BL-034 Add cancellation/refund and fulfillment state reconciliation. **Done:** audit and support flow.

## P0 — Tasting, report and evidence
- [ ] BL-035 Configure controlled brewing recipe, version, repeatability guidelines. **Done:** tester-approved SOP.
- [ ] BL-036 Build human tasting form with anchor definitions and repeatable evaluation. **Done:** tests and reviewer flow.
- [ ] BL-037 Attach evidence photos/files with exact sample/session IDs. **Done:** authorization/virus/size rules.
- [ ] BL-038 Distinguish sensory observations, estimated prices, lab results and AI predictions. **Done:** provenance in UI/PDF.
- [ ] BL-039 Implement internal tasting summary + report chapter generator. **Done:** no fabricated metrics in PDFs.
- [ ] BL-040 Implement template A4 professional report with accurate calculations and captions. **Done:** visual QA print.
- [ ] BL-041 Implement human approval and report revision snapshots. **Done:** immutable published versions.
- [ ] BL-042 Implement secure PDF access and expiring links. **Done:** unauthorized users denied.
- [ ] BL-043 Email report delivery and audit download events. **Done:** delivery retries.
- [ ] BL-044 Enforce plan entitlement: ₹299 no PDF, ₹1,999 PDF but no trial shipments. **Done:** role/plan tests.

## P1 — Blend development and trials
- [ ] BL-045 Design candidate formulation editor, lot references and constrained versioning. **Done:** reviewer-approved recipe.
- [ ] BL-046 Build cost calculation with lot date, loss, freight, packaging and margin. **Done:** reproducible pricing basis.
- [ ] BL-047 Support candidate comparisons and professionally reviewed sensory charts. **Done:** accurate source labels.
- [ ] BL-048 Enforce number of included formula trials, shipment and revisions. **Done:** no unbounded benefits.
- [ ] BL-049 Produce trial label/pack slip with sample code and brewing instructions. **Done:** traceable handoff.
- [ ] BL-050 Book outbound courier and customer tracking. **Done:** delivered/exception events.
- [ ] BL-051 Capture customer feedback and revision requests. **Done:** complete history preserved.
- [ ] BL-052 Freeze approved formula version and QA sign-off. **Done:** no invisible changes.

## P1 — Wholesale conversion
- [ ] BL-053 Define MOQ by blend and packaging; validate proposed 26kg. **Done:** real commercial rule.
- [ ] BL-054 Build quote creation, approval, expiry and breakdown. **Done:** input prices and validity stored.
- [ ] BL-055 Convert quote to existing order/production workflow. **Done:** committed quantity and formula version.
- [ ] BL-056 Track procurement, production, dispatch and delivery. **Done:** customer-visible statuses.
- [ ] BL-057 Enable reorder and repricing notice after quote expiration. **Done:** no unauthorized price reuse.
- [ ] BL-058 Track quote conversion, repeats and project-level margins. **Done:** production event validation.

## P0 — QA, security and launch
- [ ] BL-059 Audit tenant ownership, internal pricing leakage, object-level auth and file URLs. **Done:** adversarial tests.
- [ ] BL-060 Test payment retries, repeated webhooks, partial failures, refunds and reconciliation. **Done:** automated integration cases.
- [ ] BL-061 Test courier serviceability, manual override, lost parcel, damaged sample and reships. **Done:** support cases reproducible.
- [ ] BL-062 Test report editing/race conflicts, reviewer permissions, PDF publication/revisions. **Done:** access verified.
- [ ] BL-063 Verify accessibility, actual breakpoint screenshot set and page performance. **Done:** documented pass.
- [ ] BL-064 Validate brand legal claims and all public content/FAQ. **Done:** content/legal signoff.
- [ ] BL-065 Release behind feature flag with monitoring and rollback. **Done:** on-call + rollback runbook.

## P2 — Improvements
- [ ] BL-066 A/B test proof-led conversion copy on qualified traffic, not deceptive countdowns.
- [ ] BL-067 Build operational SLA measurements before stating turnaround promises.
- [ ] BL-068 Add international request-only funnel if logistics/tax are viable.
- [ ] BL-069 Add panel consistency analysis using real repeated tasting scores.
- [ ] BL-070 Build support automation for stale projects with human override.

## Sprint planning suggestion
- **Milestone A:** BL-001–022 (discover and approve UI; not charged checkout).
- **Milestone B:** BL-023–034, 059–061 (real intake-to-sample flow).
- **Milestone C:** BL-035–044, 062 (professional report service).
- **Milestone D:** BL-045–058 (premium development + wholesale).
- **Milestone E:** BL-063–070 (security, compliance, rollout, improvement).

**Do not interpret milestones as fixed delivery dates.** Estimate based on the actual existing codebase and staffing after discovery.
