# Integration Discovery Checklist — Investigate Existing Project First

## Evidence available now
- Requested site: `https://teafloww.com/`.
- Connected storefront read-only records show brand `TEAFLOWW`, tea-oriented active sliders and collections, and a general 5% tax setting. This is **not** proof that 5% applies to professional services.
- The user described a separate TeaPilot AI operations design system containing Samples, Tasting, Analysis, Blends, Pricing, Reports, Compliance and Team modules.
- The available connected TeaPilot tool catalog in research exposed operations named samples, tastings, analyses, blends, pricing/reports and inventory/lots. **Do not assume a stable cross-product REST endpoint or automatic storefront-to-ERP access without verifying authentication, scope and actual API schemas.**
- The public homepage and `/brand` page were not reliably accessible through website-fetch research; don't claim a pixel-accurate visual audit was performed.

## Questions to answer in repository discovery (not questions for the customer yet)
| Area | Evidence to collect | Decision to record |
|---|---|---|
| Frontend | framework, router, UI library, CSS, image pipeline | extend existing structure |
| Database | ORM, schema version, payment/order tables | migrations / service order boundary |
| Customer identity | sessions, account creation, guest checkout | project claim & secure access |
| Checkout | current gateway, confirmation webhook, refunds | service-specific payment lifecycle |
| Tax/invoices | tax engine, GSTIN, SAC/HSN, invoice generator | new service tax category |
| Notifications | mailer, queues, WhatsApp opt-in | transactional templates |
| Courier | shipper API, coverage endpoint, pickup fees | inbound/outbound policy |
| Storage | S3/compatible, private ACL, signed URLs | samples, reports & attachments |
| TeaPilot | API catalog, auth, tenancy, data model | adapter + outbox sync |
| Monitoring | tracing, logs, alerts, backups | failure recovery |
| Release | feature flags, staging, rollback | staged launch |

## Integration approach
1. Implement `BlendLabService` as a distinct domain within the existing backend.
2. Treat storefront checkout as the authoritative payment source; do not allow TeaPilot to mark invoices paid.
3. Keep TeaPilot as the operational record for tester sessions and formula detail when the integration is supported.
4. Use a typed adapter for cross-system calls and a durable outbox/inbox queue with idempotency keys.
5. Deny access to confidential formulations and supplier costs from public/customer API serializers.
6. No hard dependency on TeaPilot availability when browsing landing page or purchasing; queue downstream sync and show honest status.

## Questions requiring business confirmation
- Is the ₹299 tier available nationwide at the same price, and is pickup mandatory?
- One reference tea per order? Exact grams, sample loss/reject rules and exception refunds?
- Does ₹2,999 include one or two candidates, what dispatched sample mass, and exactly one included revision?
- Is ₹1,999 just testing or does it also include an indicative sourcing quote?
- Is 26 kg the minimum *order quantity* for matched/custom tea, or only a proposed default?
- Formula ownership: license to use vs exclusivity vs customer ownership?
- Service tax rate, GST invoice legal entity and declared tax classification?
- Actual promised report turnaround, lab availability and tester qualifications?

## Decision record template
```
ADR-000: [decision title]
Status: proposed / accepted / replaced
Date:
Owner:
Verified evidence:
Options considered:
Tradeoffs:
Security/privacy impact:
Rollout/rollback:
```
