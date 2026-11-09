# Analytics and Funnel Definitions

## Tracking policy
Use consent-aware analytics. Do not send customer tea composition, report text, contact details, price negotiation or proprietary formulas to ad trackers.

## Events
| Event | Public properties | Meaning |
|---|---|---|
| `blend_lab_page_view` | page_version, referrer_group | service page viewed |
| `blend_lab_plan_view` | plan_code | plan card exposed |
| `blend_lab_plan_selected` | plan_code, placement | intentional plan selection |
| `blend_lab_report_preview_opened` | demo_version | preview intent |
| `blend_lab_checkout_started` | plan_code | started eligible intake |
| `blend_lab_coverage_checked` | serviceable (bool) | region viability (no raw pincode) |
| `blend_lab_payment_verified` | plan_code, value, currency | verified paid service (server only) |
| `blend_lab_sample_received` | plan_code | actual intake milestone (server) |
| `blend_lab_report_published` | plan_code | authorized report ready (server) |
| `blend_lab_trial_dispatched` | plan_code | carrier accepted shipment |
| `blend_lab_feedback_submitted` | plan_code, decision | actual feedback |
| `blend_lab_quote_sent` | plan_code | approved quote published |
| `blend_lab_wholesale_order` | value, quantity_band | validated wholesale conversion |

## Dashboard
1. Landing → plan selection conversion.
2. Plan selection → verified payment conversion.
3. Gross paid service revenue less refunds, tax and fulfillment cost.
4. Inbound courier success and per-plan logistics cost.
5. Median time per workflow stage and exception rate.
6. Premium trial approval and revision frequency.
7. Report → quote → wholesale purchase conversion.
8. Wholesale repeat purchase and contribution margin by acquisition cohort.

## Cohort questions
- Do ₹299 customers become bulk buyers or just low-value testing requests?
- Does the sample report preview improve qualified checkout rate?
- Which geographic regions drive courier exceptions?
- Does premium plan produce more reorders and larger margin after courier cost?

## Integrity requirements
Business events generated server-side; no client event can count a payment as successful. Deduplicate events by immutable ID. Avoid storing PII in URLs or marketing event names.
