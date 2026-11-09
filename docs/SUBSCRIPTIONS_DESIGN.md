# TeaFloww product subscriptions — proposed design

Date: 2026-11-07. Status: design only; no subscription feature, migration or deployment implemented.

## Requested behavior

- All purchasable products support repeat purchases every 3, 7, 14, 30 or 60 days, at a selected variant and quantity.
- Subscription orders receive an admin-configured x% discount. Prepaid subscription orders receive an additional y% discount.
- Standard coupons do not apply to subscription orders.
- COD renewal orders are generated automatically on schedule.
- Prepaid renewals require a payment link each time; fulfillment waits for verified payment. No mandate or automatic debit is assumed.
- Customers can cancel, change frequency and skip the next shipment before dispatch. Switching an unpaid renewal to COD removes its prepaid discount.
- Existing admin shipping fees and free-shipping thresholds still apply per shipment.

The recommendations below resolve unspecified behavior; they are not existing functionality or confirmed commercial terms. The actual x/y rates remain unset.

## Customer model and scope

Use a replenishment plan plus individual renewal cycles, rather than treating the subscription itself as an order or payment mandate. One cycle creates at most one fulfillable commerce order. No future inventory is reserved for the lifetime of a plan.

Every product purchase selector offers One-time purchase / Subscribe. A subscription selects variant, quantity, interval, address and default payment preference. All published, enabled, purchasable variants are eligible by default; subscriptions cannot bypass stock or market restrictions. Product packs/kits with a separate catalog or component inventory path need that same authoritative fulfillment adapter before their subscription option is enabled. Services such as Blend Lab require a separate recurring-service design.

Recommend an authenticated customer account for subscriptions, using the existing customer sessions. Ordinary one-time guest checkout remains available. Store explicit recurring COD authorization and the wording/version accepted, including prices, shipping, cancellation and the fact that prepaid renewals require manual payment.

Allow multiple products in one plan when address, frequency, next date and payment preference match. This produces one shipment and one shipping charge. A customer can have several independent plans. Do not silently merge separate plans or move dates to obtain free shipping. Changing one item's frequency splits it into a separate plan with an explicit shipping preview.

For the first release, split one-time and subscription purchases into clearly disclosed orders with separate shipping calculations. A coupon can apply to the separate one-time order only. Multiple plans in the same checkout also require separate totals. Do not take an unrelated one-time purchase into account for a renewal's shipping threshold.

## Pricing contract

Recommended interpretation: x and y are additive percentage points on the same eligible product subtotal, not compounding discounts. They exclude shipping, COD charges and separately calculated taxes/duties. If “y% on total” is intended to discount shipping too, that is a different commercial rule and must be selected explicitly before implementation.

Let S be the current server-priced subscription product subtotal:

1. Subscription discount D = round(S × x / 100).
2. Additional prepaid discount P = round(S × y / 100) for prepaid; zero for COD.
3. Net product value N = max(0, S − D − P).
4. Apply the applicable shipping rule to N: at or above the configured free-shipping threshold means free shipping; below it means the applicable fee. If free shipping is disabled, use the configured fee policy.
5. Add the applicable COD fee and taxes/duties through the existing pricing rules. Preserve tax-inclusive pricing without adding inclusive GST a second time.

Use integer paise and basis points with deterministic rounding; validate 0 ≤ x, y and x+y < 100. Persist both discount components separately. Allocate discounts deterministically to lines for invoices, tax calculation and partial refunds.

Illustration only: S=₹1,000, x=10%, y=5% gives ₹900 COD product value or ₹850 prepaid product value. Shipping and any COD fee are additional when applicable. These are not proposed final rates.

Reject standard coupons server-side at both quoting and order creation, not just in the UI. Do not stack existing UPI/card/netbanking promotional discounts with y. All prepaid methods get the configured subscription prepaid rate; actual captured funds remain the payment authority.

Converting prepaid to COD recalculates the entire quote: remove P, re-evaluate shipping threshold, COD eligibility/fee and taxes, then show the exact amount for confirmation. Shipping can become free after P is removed. Keep D. A change to this renewal does not alter the plan's future default unless the customer explicitly chooses that option.

Snapshot accepted x/y rates and terms on the plan. Snapshot current catalog prices, discounts, shipping policy version, tax values and total on each cycle/order. Do not silently change an existing plan's promised discount. New discount terms require an effective version and customer acceptance; existing plans retain accepted terms until then. Catalog price/shipping increases above the last accepted total require customer approval before an automatic COD renewal is committed. Prepaid customers review the exact renewal amount before paying.

## Scheduling and unpaid renewals

The interval means days between scheduled dispatch cycles, not a guaranteed arrival date. Display “Ships every 7 days” and a separate carrier estimate where one is available. Thirty days means 30 days, not a calendar month.

Use Asia/Kolkata calendar dates for customer schedules; persist UTC instants as well. The customer selects the first dispatch date, defaulting to the next operational slot. Show any non-working-day adjustment before confirmation. An early successful payment must not cause an early shipment.

Recommended default: create the renewal draft and reminder one day before its scheduled dispatch date (admin-configurable, shorter than the 3-day minimum interval). For the first immediate order, create the draft immediately. COD becomes a real reserved order on its due date. Prepaid receives a secure link and a visible payment deadline, initially the scheduled dispatch cutoff. These timings are proposed defaults, not shipping promises.

At most one unresolved cycle exists per plan. Never accumulate multiple unpaid orders or dispatch a burst of missed orders after worker downtime. An expired unpaid cycle releases its holds, invalidates its link and moves the plan to payment-required hold; it never silently becomes COD. Customer action can pay a freshly quoted replacement, choose eligible COD, skip or cancel.

Normal next due date = previous scheduled dispatch date + interval. If actual dispatch is late, re-anchor the next date to actual dispatch + interval so shipments do not bunch up. Explicit skip advances by one interval from the skipped due date. A frequency change previews a new next date and requires acceptance; do not unexpectedly schedule an immediate renewal. On resume after a long hold, ask for the next date instead of generating catch-up cycles.

Out-of-stock or disabled variants, invalid addresses, unserviceable destinations and provider failures put the cycle on a visible hold. Never substitute tea/pack sizes, partially ship a plan or change quantities without consent. Notify the customer, allow skip/change/cancel, and reserve again only after validation. Check COD eligibility on every renewal.

## COD and prepaid execution

COD: due cycle → price/serviceability validation → atomic inventory reservation and one commerce order → cod_due → dispatch gate → fulfillment. Delivery does not mark COD as prepaid or remitted; preserve the existing collection/remittance ledger.

Prepaid: draft cycle → authoritative renewable quote → stock hold and payment attempt/link → verified full capture → allocated paid order → scheduled dispatch gate → fulfillment. Future cycles remain manual-pay. Initially recommend a TeaFloww hosted renewal URL which opens the existing Razorpay order checkout when the customer presses Pay. This satisfies the payment-link experience while retaining the existing capture integration and short stock holds.

If merchant-hosted Razorpay Payment Links are preferred, build a dedicated adapter. Their API supports amount, currency, expiry, reference and disabling partial payments; their webhooks include paid, cancelled and expired events. The current app's order-payment webhook parser is not a complete Payment Links integration. Store link → attempt → cycle → order mappings, verify raw signatures and exact captured amount/currency, and deduplicate link/payment events through one financial transition. A redirect or payment-authorized event alone never permits shipping.

Do not expose a long-lived provider link backed only by the current 15-minute quote/reservation. A hosted TeaFloww URL can remain usable while creating a fresh short-lived payable attempt on demand. With provider links, choose a supported expiry within the actual stock/price hold and replace expired links after revalidation. Never reprice an already payable attempt in place.

Every attempt has a generation number. Reissuing a link or changing address/payment method invalidates earlier local attempts; cancel provider links where available. Uncertain remote creation/cancellation is reconciled rather than blindly retried.

Prepaid → COD must claim the cycle, block dispatch and new payments, reconcile/cancel the current attempt, then commit a repriced COD order. If payment already captured, keep the paid order and report that payment succeeded; do not also create COD liability. A late capture against a superseded/cancelled attempt enters payment exception/refund handling, never a second shipment. Do not assume invalidating a local URL cancels a gateway checkout already open in another tab.

## Customer changes and the dispatch boundary

Expose next date, products/quantities, interval, default method, price breakdown, payment deadline and pending actions at /account/subscriptions. Actions: Skip next, Change frequency, Change address/quantity, Pay now, Switch this renewal to COD, Pause/resume and Cancel subscription.

Separate cancelling future renewals from cancelling the current order. Explain the outcome for both in the confirmation. A dispatched current order remains active even if future renewals are cancelled.

Before dispatch, skipping/cancelling an unpaid cycle invalidates payment attempts, releases inventory once and cancels queued fulfillment. For a paid cycle, block dispatch immediately, request the refund and show refund pending until verified; do not silently move funds into store credit or promise an instant refund. Advance the plan only once. A customer can cancel future renewals while a refund is pending.

Customer changes and dispatch must compete for the same atomic cycle/order revision and dispatch claim. Queued jobs always re-read state before any provider call. If a shipment is already booked, cancellation must also reconcile the carrier booking/AWB/pickup; booking alone must not permanently remove the promised before-dispatch controls. Where carrier cancellation is uncertain, show processing and hold dispatch instead of claiming success.

Use a genuine warehouse/carrier handover event for the final no-change boundary. The current international fulfillment code sets dispatched at AWB assignment, which happens earlier than physical handover. This must be corrected before advertising “change until dispatch.” Record actual handover separately and handle late carrier events. After handover, changes affect future cycles; the current shipment follows the existing return process.

## Persistence and integration

Proposed additive tables (exact migration number chosen at implementation):

| Table | Purpose / key constraints |
| --- | --- |
| subscription_policies | Versioned x/y, allowed intervals, timing and terms; accepted policies immutable. |
| subscriptions | Customer FK, status, timezone, interval, next date, default method, address snapshot, accepted policy/total, revision. |
| subscription_items | Plan FK, authoritative product/variant identity, quantity; no client-authoritative prices. |
| subscription_cycles | Plan FK, unique sequence, due date, financial/fulfillment references, snapshot, revision and blocking reason; one unresolved cycle per plan. |
| subscription_payment_attempts | Cycle FK, unique generation/reference/provider IDs, exact amount/currency, expiry, capture/refund status. |
| subscription_events | Private audit trail for consent, edits, skip, price acceptance, payment conversion and cancellation. |

Keep payment, cycle and fulfillment states separate. Suggested plan states: active, paused, action_required, cancelled. Cycle states: draft, awaiting_payment, ready, dispatching, dispatched, skipped, cancelled, exception. Payment/refund states belong to attempts/orders, not the plan.

Use commerce_orders for new renewal orders and an explicit stable customer_id ownership link. Do not use a browser session UUID as permanent subscription ownership. The existing customer order APIs primarily query legacy orders; extend their authenticated projection to include owned commerce renewal orders. Never match subscription ownership merely through a submitted email/phone.

Relevant existing seams:

- src/lib/international/quotes.ts: authoritative product prices, coupon rejection, separate subscription discounts, shipping threshold after all subscription discounts, versioned quotes.
- src/lib/international/orders.ts: reservations, idempotency and verified captures; add cycle/attempt provenance and dispatch eligibility.
- src/lib/international/jobs.ts: durable maintenance and renewal scanning, retry/reconciliation, reminders and refunds. The inspected worker has no auto_dispatch handler even though order code enqueues it; resolve this deliberately.
- src/lib/international/fulfillment.ts and src/lib/shiprocket.ts: enforce the same subscription gate across manual booking, direct automatic booking, worker jobs and admin actions.
- src/lib/customerSessions.ts and src/lib/customerOrders.ts: authenticated plan ownership and renewal history.
- src/lib/shippingSettings.ts and src/lib/paymentSettings.ts: reuse admin shipping rules and explicitly prevent standard payment-offer stacking.
- Product selector, cart and LiveCheckout: subscription choice and separate order-group price previews. Leave the demo checkout incapable of creating live renewal subscriptions.

Suggested API surface: authenticated subscription create/list/details, revision-checked update, skip, pause/resume, cancel, cycle quote/pay and cycle convert-to-COD. All mutations use strict Zod schemas, origin protection, rate limits, customer ownership, idempotency keys and generic errors. Admin controls include policies, plan/cycle lookup, holds, retry/reconcile and audit records; existing MCP administration should expose equivalent protected operations where needed.

Workers claim due plans transactionally, create a unique cycle and enqueue side effects through a transactional outbox. Use unique plan/sequence, cycle/order and provider/payment IDs as correctness boundaries. Leases and optimistic revisions must work in SQLite locally and PostgreSQL in production; never depend on an in-memory timer, open browser, process singleton or claim that external side effects are exactly-once. Alert on worker lag, exhausted retries, overdue payment exceptions, refunds and carrier cancellation holds. A global stop-renewals control must preserve already-paid obligations.

## Delivery plan and acceptance

1. Finalize commercial semantics: x/y, additive vs sequential calculation, discount base, post-discount shipping threshold, price-change acceptance and payment deadline. This document recommends defaults, without inventing rates.
2. Add versioned additive SQLite/production PostgreSQL migrations, backup/restore strategy, model and pure price/schedule/state transition functions; verify preservation and migration replay. Do not use PostgreSQL locally.
3. Implement authenticated plan APIs, worker cycle creation, stock and payment attempts, reconciliation/refunds, carrier cancellation and the shared dispatch gate. Verify core transitions before customer UI exposes subscriptions.
4. Add product/cart/checkout controls, account management, admin/MCP operations and transactional templates. Include empty/loading/failure/pending/success states, keyboard access and accessible announcements.
5. Run npm run check and focused integration/browser comparisons on mobile/desktop. Exercise provider test-mode payment/cancel/refund and carrier cancellation before enabling the feature. Deployment requires a separate explicit user request.

Required tests: all five intervals; leap/month/year boundaries; skip and frequency changes; overdue worker recovery without catch-up bursts; duplicate/concurrent workers; one cycle/order; stock contention; disabled products; mixed-order shipping; coupon rejection through every live entry point; no generic payment discount stacking; rounding and threshold edges; prepaid→COD fee/threshold recalculation; repeated/late/out-of-order webhooks; capture while switching/skipping/cancelling; paid skip and refund failure; address changes; dispatch/cancel races including booked shipments; future cancellation with current delivery; wrong-account access; worker failures; migration replay and restore. Browser QA covers product selection, precise grouped totals, pay link expiry, customer edits and admin holds at narrow/mobile/desktop widths.

## Provider references checked

- [Razorpay: create a Standard Payment Link](https://razorpay.com/docs/api/payments/payment-links/create-standard/) — amount, currency, reference, expiry and partial-payment configuration.
- [Razorpay: Payment Links webhook events](https://razorpay.com/docs/webhooks/payment-links/) — paid/cancelled/expired lifecycle and payment payloads.

These capabilities do not establish that the merchant's account is configured or that an end-to-end transaction has been tested. No live messages, charges, orders or shipments were created for this design.
