# QA Strategy & Acceptance Tests

## Quality gates
### Gate A — Design
- Marketing preview matches selected tokens and current TeaFloww navigation.
- Three plans, prices, exclusions and courier meaning visible and understandable.
- 360px, 390px, 768px, 1024px, 1440px screenshots reviewed; no overflow.
- Keyboard reaches every action in reading order; visible focus, correct labels and errors.
- Motion disabled under reduced-motion preference.

### Gate B — Commercial
- Service tax, inclusive calculation, SAC and invoice approved by accountant.
- Financial modeling shows acceptable contribution margin including failed pickups.
- No published courier or turnaround promise beyond operational capability.

### Gate C — Transactions
- API ignores any client-supplied total and prices service from server-approved catalog.
- Invalid pincode is handled before accepting included-pickup promise.
- Payment verified by genuine provider signature/response and stored ledger event.
- Replayed webhook and concurrent submissions create one paid project.
- Paid project transitions to courier only on valid booking.
- Payment errors/refunds have documented customer response.

### Gate D — Lab & report
- Tasting method version recorded; raw observations and photos mapped correctly.
- No fabricated values; missing values are absent or explicitly unknown.
- PDF has report version, reviewer, publication date and source legend.
- Published reports immutable, revisions versioned and auditable.
- ₹299 cannot download PDF; ₹1,999 cannot create outbound trials; premium trial count enforced.

### Gate E — Wholesale
- Formula contains version and actual authorized lots.
- Only authorized internal roles can read proprietary cost/recipe fields.
- Quote has quantity, MOQ, GST/freight, validity and approval.
- Expired quote cannot convert to order.
- Customer reapproval required for substantive formula substitution.

## Test matrix — illustrative
| ID | Given / When / Then |
|---|---|
| T01 | As a guest I can compare three plans without login; prices match approved catalog. |
| T02 | With unsupported pickup pincode, I see a clear next step before payment. |
| T03 | Submit same idempotency key 10 times; exactly one project draft exists. |
| T04 | Gateway webhook repeats; one payment event is acted upon. |
| T05 | Tamper with client-side price; server ignores/rejects modified value. |
| T06 | Payment captured but courier unavailable; project enters actionable exception state. |
| T07 | Upload malformed/untrusted file; reject safely without storing public URL. |
| T08 | Tester scores a sample; method and performed-at are required. |
| T09 | Missing objective reading appears as untested, not a made-up number. |
| T10 | Report reviewer rejection prevents customer notification. |
| T11 | Published PDF cannot be edited; next publication is version 2. |
| T12 | User A accesses User B report; denied and logged without data leak. |
| T13 | ₹299 customer tries detailed report URL; denied. |
| T14 | ₹1,999 customer attempts trial shipment creation; denied. |
| T15 | Premium user requests more than included revision; clear upgrade/quotation flow. |
| T16 | Approved formula is preserved when a new version is drafted. |
| T17 | Quote expires; click to buy requests re-quotation, not checkout. |
| T18 | Customer opts out of marketing; transactional status still delivered as allowed. |
| T19 | Device 360px wide: no sideways scroll, primary CTA reachable, form errors visible. |
| T20 | Screen reader: stepper announces current step; progress not conveyed by colour alone. |

## Automated testing suggestions
- Unit: money integer arithmetic, plan gate, state transitions, quote expiry, input validation.
- Integration: webhook/DB transaction, courier booking rollback, TeaPilot adapter error/retry, signed downloads.
- E2E: homepage → landing → plan → form → *sandbox* payment → status, report review, premium feedback, quote approval.
- Visual: Storybook/snapshot screenshots for plan cards, comparison and mobile menu.
- Security: object-level authorization and schema validation of all public IDs.

## Performance budget — targets, not measured results
Aim for LCP ≤2.5s on representative mobile, CLS ≤0.1, INP ≤200ms, subject to real device/network testing. Optimise authentic hero imagery and lazy-load report rich media. Do not claim these values as achieved until measured.
