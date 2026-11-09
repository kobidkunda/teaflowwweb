# TeaFloww Trials — Engineering Implementation Backlog (v3)

**Priority:** P0 = required before commercial launch; P1 = polished conversion and admin productivity; P2 = growth/experimentation.  
**Acceptance:** Items are `NOT DONE` until merged, tested and verified in the actual TeaFloww staging environment. Existing FastAPI reference behaviour does not count as site integration.

## Milestone A — Discovery and safety gate (P0)

- [ ] **A-01 | P0 | Tech lead** Locate/verify the source repository that actually serves teafloww.com, live framework/versions and deployment ownership. **Accept:** repo path, branch, tech stack, runtime and release path documented.
- [ ] **A-02 | P0 | Backend** Inventory existing products/variants, carts, order/payment/shipping tables, media library, licence fields and auth/permissions. **Accept:** ER diagram and interface inventory grounded in source.
- [ ] **A-03 | P0 | Tech lead** Decide whether Trials is in-repo module vs authenticated internal service. **Accept:** architecture decision record; no second unsynced checkout.
- [ ] **A-04 | P0 | Product** Approve exact trial kit composition (4 × 50 g), SKU strategy and which child flavours are buyable. **Accept:** approved product contract.
- [ ] **A-05 | P0 | Finance** Approve kit price as GST inclusive/exclusive, shipping policy and actual all-flavour COGS. **Accept:** signed price waterfall and break-even calculation.
- [ ] **A-06 | P0 | Compliance** Verify operator/FBO licensing, actual package labels, intended flavoured tea classification and regulatory approvals. **Accept:** internal signed compliance checklist.
- [ ] **A-07 | P0 | Marketing/QA** Inventory claims (50%, 45s, savings, 9.5/10, testimonials). **Accept:** approved evidence register; all unverified claims disabled.
- [ ] **A-08 | P0 | DevOps** Establish staging with masked/isolated test data, backups, feature flags and rollback. **Accept:** rehearsed stage deploy without affecting existing orders.

## Milestone B — Domain, data and migrations (P0)

- [ ] **DB-01 | P0 | Backend** Implement normalized `trials` migration: slug, kind, audience, status, net weight, revision, sort order. **Accept:** migrates on staging and rolls back safely.
- [ ] **DB-02 | P0 | Backend** Implement `trial_components` with FK to actual variants, weight and quantity. **Accept:** database and service prevent invalid kit total.
- [ ] **DB-03 | P0 | Backend** Define trial price reference using existing price/variant service. **Accept:** one authoritative payable product price.
- [ ] **DB-04 | P0 | Backend** Add media-stage links (`packaging`, `dry_leaf`, `infused_leaf`, `liquor`, `milk_tea`). **Accept:** ordered approved assets render on both channels.
- [ ] **DB-05 | P0 | Backend** Add trial claims/evidence approval records. **Accept:** missing/expired/unapproved quantitative proof blocks publication.
- [ ] **DB-06 | P0 | Backend** Add `trial_audit` and publication snapshots. **Accept:** actor, source, revision, timestamp and changed-field diff recorded.
- [ ] **DB-07 | P0 | Backend** Add product/lot provenance links where available. **Accept:** no invented garden/tea-grade codes in public descriptions.
- [ ] **DB-08 | P0 | Backend** Implement atomic compare-and-swap revision updates. **Accept:** concurrent edit returns 409 and leaves latest saved value unchanged.
- [ ] **DB-09 | P0 | Backend** Implement stable idempotent draft importer. **Accept:** running seed twice creates no duplicates and never publishes.
- [ ] **DB-10 | P0 | Backend** Add serialized, whitelist-based public projection. **Accept:** public JSON contains no COGS, supplier costs, admin approval fields or private information.
- [ ] **DB-11 | P0 | Backend** Define archival retention with order foreign keys. **Accept:** archived products disappear from browse but remain resolvable in historical order records.

## Milestone C — TrialService and REST API (P0)

- [ ] **API-01 | P0 | Backend** Implement `GET /api/v1/trials` published-only with safe paging, filtering and caching. **Accept:** drafts invisible even by search.
- [ ] **API-02 | P0 | Backend** Implement `GET /api/v1/trials/:slug` published-only and 404 unpublished. **Accept:** no internal fields returned.
- [ ] **API-03 | P0 | Backend** Implement authenticated `GET /api/v1/admin/trials`. **Accept:** role checks, filters, pagination and no public access.
- [ ] **API-04 | P0 | Backend** Implement draft `POST /api/v1/admin/trials` with idempotency key. **Accept:** duplicate key returns same record, duplicate slug is 409.
- [ ] **API-05 | P0 | Backend** Implement `PATCH` with `expected_revision`. **Accept:** 409 on stale editing and accurate changed-key audit.
- [ ] **API-06 | P0 | Backend** Implement transactional kit components reorder/replace. **Accept:** exact total weight and inventory linkage checked in same transaction.
- [ ] **API-07 | P0 | Backend** Implement media attach/detach through existing media service. **Accept:** rights, type, alt text, upload limits and secure URLs.
- [ ] **API-08 | P0 | Backend** Implement `GET /validate` with blocker/warning distinction. **Accept:** all launch gates enumerated with fields and owners.
- [ ] **API-09 | P0 | Backend** Implement review/publish/unpublish/archive transitions. **Accept:** only scoped publisher publishes; invalid record 422.
- [ ] **API-10 | P0 | Backend** Integrate verified ingredients/packaging/label fields. **Accept:** failure blocks purchasable publication.
- [ ] **API-11 | P0 | Backend** Add typed server-side contract validation and structured error codes. **Accept:** malformed/oversized payloads rejected.
- [ ] **API-12 | P0 | Backend** Add rate limiting, pagination caps, CSRF, request logging without sensitive data. **Accept:** security tests pass.
- [ ] **API-13 | P0 | Backend** Add versioned OpenAPI contract documentation and examples. **Accept:** API consumers can generate clients.

## Milestone D — MCP parity and provenance (P0)

- [ ] **MCP-01 | P0 | Integration** Register trial tools in the actual TeaFloww website MCP connection. **Accept:** tools discoverable from a properly connected authorized client.
- [ ] **MCP-02 | P0 | Integration** Implement `trial_list`, `trial_get`, `trial_create`, `trial_update`. **Accept:** returns same records as admin and same validation/errors.
- [ ] **MCP-03 | P0 | Integration** Implement `trial_components_replace` and `trial_media_attach`. **Accept:** component totals, permissions, revision checks and media provenance enforced.
- [ ] **MCP-04 | P0 | Integration** Implement `trial_validate`, `trial_submit_review`, `trial_publish`, `trial_unpublish`, `trial_archive`, `trial_history`. **Accept:** no MCP-only publication bypass.
- [ ] **MCP-05 | P0 | Security** Authenticate each actor/client; use scoped permissions and structured audit. **Accept:** list/read role cannot mutate/publish.
- [ ] **MCP-06 | P0 | Integration** Cross-channel revision conflict test. **Accept:** Admin edit 1 visible through MCP; stale MCP edit 409 and vice versa.
- [ ] **MCP-07 | P1 | Integration** Add `trial_sync_from_teapilot(sample_id, approved_fields)` with lot/media provenance. **Accept:** only allowed verified data imported, reviewed before publication.
- [ ] **MCP-08 | P1 | Integration** Build MCP tool contract/response snapshots. **Accept:** upgrades cannot silently break published tools.

## Milestone E — Stunning public UI/UX (P0 + P1)

- [ ] **UI-01 | P0 | Design/FE** Apply unified design tokens (forest/ivory, obsidian/copper/gold). **Accept:** contrast-checked responsive theme at key widths.
- [ ] **UI-02 | P0 | FE** Integrate navigation route and active-state Trial link. **Accept:** desktop + mobile navigation and breadcrumbs work.
- [ ] **UI-03 | P0 | FE** Build `/trials` premium hero with accurate offer/contents. **Accept:** no unverified “50%/North India verified/free delivery” assertions.
- [ ] **UI-04 | P0 | FE** Build filtered/catalogue card grid with hero imagery, weight, flavours, price and status. **Accept:** public API controls visibility.
- [ ] **UI-05 | P0 | FE** Build SSR `/trials/:slug` SEO metadata and product info. **Accept:** key text rendered without JS and no draft indexing.
- [ ] **UI-06 | P0 | FE** Build buy box with 4×50g contents, price/GST statement, stock and pincode quote. **Accept:** checkout only when fully serviceable.
- [ ] **UI-07 | P1 | FE** Implement Optical Studio: pouch tabs × verified stage tabs. **Accept:** no fabricated images/colour scores, keyboard support.
- [ ] **UI-08 | P1 | FE** Build sensory bento with measurement provenance/unknown state. **Accept:** no default 9.5/10 data.
- [ ] **UI-09 | P1 | FE** Implement realistic cost-per-cup calculator. **Accept:** savings and negative savings both shown faithfully.
- [ ] **UI-10 | P1 | FE** Build visual three-step kettle testing guide. **Accept:** ratio/time clearly labelled as a tested protocol or illustrative method.
- [ ] **UI-11 | P1 | FE** Build bulk ladder linked to real 500g/1/2/5/10kg variants. **Accept:** current price and stock always come from catalogue.
- [ ] **UI-12 | P1 | FE** Build reviewed FAQs, legally permitted verified testimonials and review request. **Accept:** author consent and source audit.
- [ ] **UI-13 | P0 | FE** Mobile sticky action bar; conditional checkout state. **Accept:** at 360,375,390,430 px no overflow, 44px tap targets.
- [ ] **UI-14 | P0 | FE** Add skeletons, empty states, error pages, offline/slow-network fallback. **Accept:** buyers receive clear actionable messaging.
- [ ] **UI-15 | P0 | FE** Implement accessible tabs, focus, image alternatives and reduced motion. **Accept:** axe + keyboard manual audit passes.
- [ ] **UI-16 | P0 | FE/SEO** Optimize LCP and product structured data, canonical URL and sitemap. **Accept:** published only, current genuine offers.
- [ ] **UI-17 | P1 | FE** Hindi copy toggle (with professionally reviewed translation). **Accept:** language coverage complete per page, correct canonical/hreflang.

## Milestone F — Admin Trial Studio (P0 + P1)

- [ ] **ADM-01 | P0 | FE** Build full authenticated listing with status, search, filters, bulk actions and inventory indicators. **Accept:** roles prevent unauthorized changes.
- [ ] **ADM-02 | P0 | FE** Build five tabs: Identity & Pricing; Pouches; Optical & Brewing; Promotions & Bulk; Preview & Publish. **Accept:** all data is editable via safe API.
- [ ] **ADM-03 | P0 | FE** Implement form validation (field errors + summary). **Accept:** jumps to blocker and preserves unsaved inputs.
- [ ] **ADM-04 | P0 | FE** Implement revision conflict resolution. **Accept:** 409 displays server version and offers refresh/diff, never overwrites silently.
- [ ] **ADM-05 | P0 | FE** Build kit weights/price economics inspector. **Accept:** uses real configurable costs and clearly labels unknown cost.
- [ ] **ADM-06 | P1 | FE** Drag-and-drop sachet composer with keyboard reorder fallback. **Accept:** 4×50g sum visible and saved atomically.
- [ ] **ADM-07 | P1 | FE** Split-screen 375px mobile / 1440px desktop live preview. **Accept:** rendered from unsaved form state clearly marked PREVIEW.
- [ ] **ADM-08 | P0 | FE** Review/publish workflow with actionable checklist. **Accept:** only publisher role can execute publication.
- [ ] **ADM-09 | P0 | FE** View audit timeline and record provenance. **Accept:** who/what/when/channel visible to staff.
- [ ] **ADM-10 | P1 | FE** Optional image editor/crop/picker with rights and accessibility checks. **Accept:** no broken publish assets.

## Milestone G — Checkout, shipping, subscriptions and analytics (P0 + P1)

- [ ] **COM-01 | P0 | Commerce** Integrate trial line item into existing cart/order tables. **Accept:** kit SKU, 4-component pack instructions and totals persist.
- [ ] **COM-02 | P0 | Commerce** Integrate actual pincode shipping rates, GST and final price disclosure. **Accept:** customer sees precise total before payment.
- [ ] **COM-03 | P0 | Commerce** Atomic inventory reservation and release, including kit component allocation. **Accept:** prevents overselling.
- [ ] **COM-04 | P0 | Commerce** Create payment intent from server-verified total. **Accept:** tampering with browser price cannot change amount.
- [ ] **COM-05 | P0 | Commerce** Verify webhook signature and idempotent paid/refund state. **Accept:** double webhook does not double-fulfil.
- [ ] **COM-06 | P0 | Commerce** Test cancellation/refund and courier failure recovery. **Accept:** stock and customer states reconcile.
- [ ] **COM-07 | P0 | Operations** Implement packing slip with four correctly labelled 50g contents and batch IDs. **Accept:** fulfilled sample matches order.
- [ ] **COM-08 | P1 | Commerce** Optional voucher `STALL150` with validated scope/caps. **Accept:** approved by finance, cannot create uncontrolled negative margin.
- [ ] **COM-09 | P1 | Commerce** Link genuine subscribed bulk offers to recurring payments and customer management. **Accept:** permissioned pause/skip/cancel/mandate lifecycle.
- [ ] **AN-01 | P0 | Analytics** Track view, product click, pincode quote, add-to-cart, checkout, paid kit and bulk conversion. **Accept:** event taxonomy and privacy controls documented.
- [ ] **AN-02 | P1 | Analytics** Track feedback and order-to-reorder conversion at 7/14/30 days. **Accept:** KPIs reproducible from orders, not ad-platform attribution alone.

## Milestone H — Compliance, QA and release (P0)

- [ ] **LAW-01 | P0 | Compliance** Verify required FSSAI registration/licence and product/packing scope. **Accept:** approved official data on labels and sales record.
- [ ] **LAW-02 | P0 | Compliance** Verify requirements for added flavour products and Tea Board registrations if applicable. **Accept:** assessed and documented per recipe.
- [ ] **LAW-03 | P0 | Compliance** Approve every individual 50g sachet and outer pack label. **Accept:** ingredients, lot, declarations, FBO details, relevant dates correct.
- [ ] **LAW-04 | P0 | Quality** Establish verified test protocol for any comparative extraction/50% dosing claim. **Accept:** claim linked to controlled primary data and approved reviewer.
- [ ] **LAW-05 | P0 | Marketing** Approve product images and testimonials; purge simulated claims from actual public copy. **Accept:** asset rights/evidence recorded.
- [ ] **QA-01 | P0 | QA** Test public visibility and confidential-field redaction. **Accept:** drafts/private costs inaccessible.
- [ ] **QA-02 | P0 | QA** Test production auth/RBAC, MCP permissions, rate limit, CSRF, IDOR and injection. **Accept:** no critical/high vulnerabilities.
- [ ] **QA-03 | P0 | QA** Test admin ↔ MCP parity, version conflicts and all lifecycle states. **Accept:** no drift and no unauthorized publish.
- [ ] **QA-04 | P0 | QA** Test full payment, taxes, courier, stock, refund and duplicate callbacks. **Accept:** ledger/order/totals reconcile.
- [ ] **QA-05 | P0 | QA** Test accessibility, mobile, low-speed Android and 200% zoom. **Accept:** no critical WCAG issues.
- [ ] **QA-06 | P0 | QA** Test migration, backups, feature flag and rollback. **Accept:** successful rehearsal.
- [ ] **REL-01 | P0 | Release** Sign off Product, Finance, QA, Legal/Compliance, Ops, Engineering. **Accept:** recorded release approval.
- [ ] **REL-02 | P0 | Release** Supervised production purchase and dispatch of one trial kit. **Accept:** customer charge, correct parcel, inventory, shipping, confirmation and tracking validated.
- [ ] **REL-03 | P0 | Release** Release via limited traffic and monitor errors, drops, delivery, chargebacks and conversions. **Accept:** stable measurements and rollback ready.

## MVP vs later

**MVP/P0:** Public list/detail + draft/admin/MCP parity + real 200g kit + legal labels + authentic photos + pincode quote + checkout + audit, safe mobile design, testing.

**Next/P1:** 4-stage optical experience, sensory bento, calculator, 5-tier bulk ladder, incentives, bilingual content, subscription only if billing is supported.

**Later/P2 (not a launch gate):** Segmented ad landing variants, A/B experiments, interactive lab reports, cross-market comparisons, predictive reorder recommendations, fully automated replenishment with opt-in.

## Recommended tracker fields

`ticket_id`, `priority`, `team`, `owner`, `status`, `dependency`, `repository_path`, `pull_request`, `test_evidence`, `acceptance_status`, `staging_url`, `release_version`.

When imported to a ticketing system, keep the dependency chain `A → B → (C,D) → E,F → G,H` and mark integration gates required before commercial publication.
