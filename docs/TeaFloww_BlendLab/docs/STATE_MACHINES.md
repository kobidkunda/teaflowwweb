# State Machines & Entitlements

## Payment state (separate from project)
`draft → pending → paid` or `pending → failed/cancelled`, then `paid → refund_pending → refunded` on verified provider/admin workflow. Never transition based solely on customer browser callback.

## Project lifecycle

| From | Event | To | Guard |
|---|---|---|---|
| draft | submit_order | awaiting_payment | valid brief and serviceable arrangement |
| awaiting_payment | payment_verified | paid | matching provider amount/currency/event |
| paid | pickup_requested | awaiting_sample | courier accepted or documented self-ship |
| awaiting_sample | courier_delivered | intake_pending | delivery evidence |
| intake_pending | sample_accepted | tasting_queued | intake checklist valid |
| intake_pending | sample_rejected | sample_exception | recorded reason and policy action |
| tasting_queued | tester_started | tasting_in_progress | assigned qualified staff |
| tasting_in_progress | tasting_finalized | report_draft **or** quote_draft | plan entitlement and evidence complete |
| report_draft | reviewer_approved | report_ready | signed approval & valid PDF |
| quote_draft | quote_approved | quote_ready | commercial approval |
| report_ready | trial_prepared | trial_dispatch_pending | signature plan only, signed formula, remaining entitlement |
| trial_dispatch_pending | courier_accepted | trial_in_transit | tracking and QA release |
| trial_in_transit | delivered | feedback_pending | carrier delivery evidence |
| feedback_pending | customer_approved | formula_approved | approved formula version |
| feedback_pending | revision_requested | revision_in_progress | remaining revisions > 0 |
| revision_in_progress | reviewer_approved_revision | trial_dispatch_pending **or** feedback_pending | enforce cost/ship entitlement |
| formula_approved | issue_quote | quote_ready | availability, price and MOQ validated |
| quote_ready | quote_accepted | wholesale_order_pending | unexpired quote |
| wholesale_order_pending | order_confirmed | completed | existing order confirmed |

Exception statuses `payment_exception`, `courier_exception`, `sample_exception`, `review_exception`, `paused`, `cancelled`, `refund_pending`, `refunded` need staff action + audit, not hidden behind a generic pending status.

## Plan entitlement model
Use values *approved by operations*, not frontend flags alone:
```
plan: MATCH_QUOTE
  detailed_report: false
  included_inbound_shipments: 1
  included_outbound_shipments: 0
  included_trials: 0
  included_revisions: 0

plan: QUALITY_AUDIT
  detailed_report: true
  included_inbound_shipments: 1
  included_outbound_shipments: 0
  included_trials: 0
  included_revisions: 0

plan: SIGNATURE
  detailed_report: true
  included_inbound_shipments: 1
  included_outbound_shipments: 1
  included_trials: TBD (proposal: up to 2 internal candidates)
  included_revisions: TBD (proposal: 1 round)
```

## Safety invariants
1. A project cannot be both `paid` and `refunded` without the refund ledger and reconciled downstream services.
2. Every project has one owning customer account or verified guest identity.
3. Internal progress requires intake evidence; never skip straight from paid to tasted.
4. `report_ready` requires a published immutable version.
5. `trial_in_transit` requires approved formula and actual courier booking.
6. `formula_approved` references an immutable recipe version.
7. `wholesale_order_pending` references an unexpired approved quote.
8. Customer-facing timelines must redact internal-only staff messages and sensitive formula data.
