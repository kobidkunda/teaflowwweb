# International commerce operations

This is a local implementation. No production migration, deployment, account approval,
real shipping booking, real payment, or paid translation run is implied by its presence.
Markets start disabled. Existing historical INR/demo orders remain intact.

## Operator screens

- `/admin/markets`: country import, readiness, bulk enable/disable, currencies,
  tax approvals, delivery pricing, PIN/state exceptions, COD, packaging, campaigns,
  offer countries, and country previews.
- `/admin/translations`: coverage by resource/language, generation queue, side-by-side
  drafts, edits, review/publish/unpublish. Products also have a Translate shortcut.
- `/admin/fulfillment`: commerce orders, booking/AWB/labels/pickup, tracking,
  gateway reconciliation, refunds, COD remittance, and background job failures.
- Existing `/admin/orders` retains legacy orders. New orders use the commerce
  operations screen because their money, reservations and status model differ.

The customer selector keeps delivery country, currency and language independent.
The delivery address determines the final quote. IP detection is a suggestion only.
Configure `TRUST_COUNTRY_HEADER=cf-ipcountry` or `x-geo-country` only when the reverse
proxy removes incoming client versions of that header and stamps a verified value.
Unknown/private location defaults to India. Browser GPS is never requested.

## Server configuration

Use the example keys in `.env.example`. Never put secrets in the GUI, browser bundle,
source control, command output or public logs.

- Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
  Test keys exercise the integration only when an actual test account is available.
  Account activation and enabled currencies must be verified with the provider;
  configure only those charge currencies in each market.
- Currency: `EXCHANGE_RATE_API_KEY`, INR base. Refreshes follow the provider's
  next-update timestamp. No sample exchange rate is seeded or substituted.
- Shipping: `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, plus the account adapter
  settings described below. Configure actual pickup/package/customs data in admin.
- Translations: `OPENAI_API_KEY`, `OPENAI_TRANSLATION_MODEL`. Uses the Responses API
  with strict structured output, `store:false`, field validation, protected values,
  source hashes and human publication. No customer/order data enters this workflow.
- Worker: `COMMERCE_WORKER_SECRET`, `COMMERCE_WORKER_URL` pointing to this deployment's
  `/api/internal/commerce`. Run `npm run commerce:worker` as a separate managed process.
- Order access: `ORDER_ACCESS_SECRET`; a configured `SESSION_SECRET` is the fallback.
  Protect and rotate these keys deliberately; rotation invalidates existing links.

Translation limits default to 100 provider requests and 500,000 conservatively
reserved input/output tokens per rolling 24 hours. Override with
`TRANSLATION_DAILY_MAX_REQUESTS` and `TRANSLATION_DAILY_MAX_TOKENS`. These are usage
ceilings, not an exact monetary spend calculation. Also set an account spend limit.
Long interface translations chain small durable jobs; interruption does not publish
partial output. Source/editor changes prevent old output replacing newer work.
Run `npm run i18n:extract` after adding new literal JSX copy. Language selection is
available after the interface dictionary is reviewed and published.

## Shipping account adapter contracts

Domestic authentication, serviceability, booking, AWB assignment, labels, pickup
and tracking use the provider API server-side. The provider's international
serviceability API documents an existing provider order ID; pre-payment quoting,
account coverage and prepaid-duties contracts must be confirmed for the merchant
account. The following authenticated HTTPS adapters are intentionally explicit;
they must be backed by verified account APIs, never fabricated flat rates.

All use `Authorization: Bearer <SHIPPING_BRIDGE_TOKEN>` and must return JSON.
Endpoints are server environment values, never URLs submitted by customers.

| Setting | Contract |
| --- | --- |
| `SHIPPING_COUNTRIES_URL` | GET → array `{code,name,providerId,currency}` for actual account destinations. ISO country/currency codes. |
| `INTERNATIONAL_RATE_URL` | POST `{address,lines,package,grams,duties}` → `{id,costPaise,expires,cod,ddp,dutiesPaise}`. Freight cost in INR paise; expiry in Unix milliseconds. |
| `LANDED_COST_URL` | POST `{address,lines,package,rateId}` → `{dutiesPaise,ddp:true,expires}` from an actual landed-cost/prepaid duties service. |
| `INTERNATIONAL_BOOKING_URL` | POST `{orderId,quote,order}`, `Idempotency-Key: orderId` → `{order_id,shipment_id}`. Must honor the selected quote/service and duties mode, and implement retry reconciliation. |

No adapter configured means no international quote/booking. A static country metadata
file retained for development compatibility is **not** provider coverage and is never
imported into live markets. No universal "220 countries" count is seeded or claimed.
Import preserves admin disable and pricing preferences; disappeared destinations
lose coverage and fail readiness. Every address still requires serviceability.

## Money, delivery and order invariants

Catalogue and accounting amounts remain INR paise. Charge amounts use the selected
currency's minor units, with a stored rate ID/value and exact sum of components.
Razorpay's three-decimal currencies use rounding steps divisible by ten minor units.
Unsupported charge currencies require explicitly selecting INR; no silent conversion.
Payment requests carry `currencyAcceptance` and, for international INR charges,
`inrAcceptance:true`. The server checks these against the quote and records consent.
Browsing can use overdue rates for at most 48 hours with an estimate notice. New
foreign-currency checkout needs a current provider rate.

Quotes last at most 15 minutes, or the shorter carrier expiry. Cart/address/payment
changes require a new quote. Policy versions, product prices, publication, stock,
coupons and currency readiness are rechecked at reservation. Shipping thresholds
use merchandise after discount. PIN overrides precede state overrides; exclusions
always win. "Included" delivery retains the carrier cost internally. Subsidies cover
freight only. Taxes use operator-approved merchandise profiles; confirm freight tax
and export invoice treatment before approving a market.

Only configure "duties included" with verified prepaid landed costs. Recipient-paid
markets disclose possible collection on import before payment. No LLM calculates tax,
duties, exchange rates, inventory or delivery promises.

Stock is deducted when reserved and returned once on expiry/cancellation; capture
allocates the reservation without deducting again. Coupon capacity follows the same
hold/release discipline. Late captures with released stock become `paid_exception`,
never a false payment failure. Staff must resolve those through fulfillment/refund.

Only the raw-body HMAC-verified Razorpay webhook can confirm captured prepaid funds.
`/api/webhooks/razorpay` durably queues supported capture/failure/refund events, using
the provider event ID for deduplication. Browser callbacks only open the private
pending-status screen. Out-of-order failure events cannot undo a capture.

Provider creation timeouts produce `creation_uncertain` or `booking_uncertain`.
Do not create a new payment/shipment to retry. Verify the provider's receipt/order
record first and link the matching gateway ID through the operations screen. Shipment
uncertainty requires provider reconciliation before operations continue.

Refund requests retain the original currency and reserve refundable capacity. An
uncertain request keeps its capacity until reviewed; never submit a replacement
blindly. A verified refund webhook updates confirmed amounts. Refunds do not restock
returned/dispatched goods automatically; reconcile physical inventory separately.

India COD is disabled until PIN/amount/fee/exclusion controls are configured and the
carrier confirms support. `cod_due`, collection and remittance are separate from
prepaid capture. Delivery alone never marks COD paid. Staff record verified remittance
with the exact original amount and an auditable reference.

## Private access, jobs and operational limits

Live orders are available at `/purchase/<uuid>?token=<signed-expiry-token>` for seven
days. The middleware redirects to a clean URL and places the still-untrusted signed
token in an HTTP-only cookie scoped to that exact order. The order route always
verifies its HMAC and expiry before returning data. This prevents ordinary analytics
page URLs from including the token. Use the private-link copy button to share access
with another device. Unsigned legacy order lookup does not expose live orders or items. Keep query
strings out of proxy/analytics logs on purchase/status routes. Do not share guest URLs.

The worker leases one job at a time per request, with bounded retries/backoff. Run it
only on a trusted local/private address using the secret. Failed and exhausted jobs
remain visible in admin. Missing SMTP is a delivery failure, not a successful email.
SMTP delivery is at least once; a process crash after sending can result in a duplicate
notification. New receipt templates avoid promising packing before staff approval.

The existing request limiter is per-process: add shared limits before horizontal
scaling. Quote/order records include private address data: restrict DB/backups and
apply the store's approved retention policy. This feature does not replace the broader
consent/deletion workflow still tracked in TODO.

## Migrations, backup and rollout

1. Local: `npm run db:backup`, verify the backup, then `npm run db:migrate`.
   Migrations 031/032 are additive and preserve operator values on replay.
2. Production: explicit deployment authorization is required. Take `pg_dump` and a
   source/environment backup, verify restore on a separate approved environment,
   then run `DATABASE_TYPE=postgres node scripts/migrate-international-postgres.mjs`
   with production PG environment configuration. No local PostgreSQL is used.
3. Deploy the compatible application and worker together. Verify pending migration
   reporting, authenticated endpoints and unauthenticated rejection.
4. Verify actual account country export, test-mode payment/capture/refund webhooks,
   real serviceability responses, package/customs values and email delivery. Local
   mocks do not establish any account's eligibility or actual international coverage.
5. Review translations and country policies, bulk-enable only ready countries, then
   explicitly authorize live credentials/activation. Monitor paid exceptions, booking
   uncertainty, stale FX, failed jobs and refund reconciliation.

Rollback application changes through the normal release procedure. Do not drop tables
or restore an old database over new captured orders. Reconcile provider events and
preserve financial records before any operational data restore.

## Verification

Unit/integration suites cover money, quotes, permissions, raw-body signatures,
reservation retries/expiry, payment ordering, COD, refund capacity, translation
publication/staleness, regional targeting and locale metadata. Browser evidence and
final executed check totals are recorded in `docs/TESTING.md` after validation.
Production PG, real account APIs and actual paid LLM runs require separate verification.
