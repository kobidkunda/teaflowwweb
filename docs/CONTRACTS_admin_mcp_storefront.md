# Contracts: Admin, MCP & Storefront (t1)

Docs-only contract. No code changes. Implements AGENTS.md standards.
Single source of truth for downstream implementation tasks.

## 0. Non-negotiable constraints (all layers)

1. All SQLite access uses parameterized queries (`?` / named params). No string-interpolated SQL.
2. Never trust client prices / stock / totals. Server re-reads `variants.price_paise` + `stock`,
   recomputes `subtotal + shipping − discount`, persists server-confirmed `unit_price_paise`.
3. No order is marked `paid` without a verified gateway webhook (signature check, server secret,
   never in client bundle / source control). Demo checkout stays `demo_unpaid` / `unpaid`.
4. Mutating order/payment creation is idempotent (UUID `idempotencyKey`, UNIQUE column, replay
   returns the original row).
5. Every mutating API request validated with Zod; generic customer-facing errors only
   (never raw DB errors).
6. No customer PII in logs, analytics, or public routes. Order lookup stays server-side;
   log only order id / status transitions, never name/email/address. Token values never logged
   (note: MCP token travels in URL — access logs must strip query strings).
7. Never fabricate reviews, scarcity, certifications, provenance, harvest dates, or shipping
   promises. Seed copy stays illustrative until verified sourcing lands.
8. Additive migrations only. `scripts/migrate.mjs` is bootstrap-only; new schema lands as
   versioned `scripts/migrations/NNN_<name>.mjs` run in order, each idempotent
   (`IF NOT EXISTS`, backfill guarded), with down-migration = no-op note (never silent rewrite).

## 1. Additive SQLite migrations

Migration runner (to build): `scripts/migrations/` executed in filename order, tracked in
`schema_migrations(version PRIMARY KEY, applied_at)`. Each file wraps in a transaction,
uses `ALTER TABLE … ADD COLUMN` / `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`.

### 002_categories — normalize free-text `products.category`
- `CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`
- `ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id);`
  + `CREATE INDEX idx_products_category_id ON products(category_id);`
- Backfill: insert distinct `products.category` values as slugs; set `products.category_id`.
- Keep legacy `products.category TEXT` read-only for rollback; new writes set both until
  a later migration drops it (not this batch). Service layer resolves category via join.

### 003_product_images — product gallery (replaces single placeholder art)
- `CREATE TABLE product_images (id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL, alt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0, is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`
- `CREATE INDEX idx_product_images_product ON product_images(product_id);`
- Rule: exactly one `is_primary=1` per product enforced in service (not CHECK); `alt_text`
  required by Zod (accessibility), empty only for decorative images with justification.

### 004_sliders — homepage hero / promo slots
- `CREATE TABLE sliders (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL,
  cta_label TEXT NOT NULL DEFAULT '', cta_href TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT, ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`
- `CREATE INDEX idx_sliders_active_order ON sliders(is_active, sort_order);`
- Storefront reads only `is_active=1` and within `[starts_at, ends_at]` window.

### 005_coupons — codes + order discount columns
- `CREATE TABLE coupons (code TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('percent','flat')),
  value INTEGER NOT NULL CHECK(value > 0),
  min_subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(min_subtotal_paise >= 0),
  max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count >= 0),
  starts_at TEXT, ends_at TEXT, is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`
- `ALTER TABLE orders ADD COLUMN coupon_code TEXT REFERENCES coupons(code);`
- `ALTER TABLE orders ADD COLUMN discount_paise INTEGER NOT NULL DEFAULT 0 CHECK(discount_paise >= 0);`
- Validation + math live in the service layer only: active window, `subtotal >= min`,
  `used_count < max_uses`, percent capped (e.g. ≤ 50%), `discount ≤ subtotal`.
  `used_count` increments once, atomically, inside the verified paid capture
  (never at checkout, so abandoned carts cannot burn limited codes); captures
  re-check `max_uses` and refunds release the claim. Client-submitted discount ignored.

### 006_payment_dispatch — payment state + fulfillment status on orders
- `ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'
  CHECK(payment_status IN ('unpaid','payment_pending','paid','payment_failed','refunded'));`
- `ALTER TABLE orders ADD COLUMN dispatch_status TEXT NOT NULL DEFAULT 'unfulfilled'
  CHECK(dispatch_status IN ('unfulfilled','preparing','shipped','delivered','cancelled','returned'));`
- Backfill: existing `status='demo_unpaid'` rows → `payment_status='unpaid'`.
  Legacy `orders.status TEXT` kept read-only; state machine lives in the two new columns.
- `CREATE TABLE order_payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
  gateway TEXT NOT NULL DEFAULT 'demo', gateway_payment_id TEXT UNIQUE,
  amount_paise INTEGER NOT NULL CHECK(amount_paise >= 0),
  status TEXT NOT NULL DEFAULT 'payment_pending'
  CHECK(status IN ('payment_pending','paid','payment_failed','refunded')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`
- `CREATE TABLE payment_events (id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id), from_status TEXT NOT NULL, to_status TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`
  Every payment/dispatch transition inserts one audit row in the same transaction.
- Allowed transitions (service-enforced, idempotent):
  - payment: `unpaid → payment_pending → paid` (webhook only) | `→ payment_failed` |
    `paid → refunded` (admin + gateway refund record only).
  - dispatch: `unfulfilled → preparing → shipped → delivered` | any non-delivered `→ cancelled` |
    `shipped → returned`. Dispatch beyond `preparing` requires `payment_status='paid'`.
  - Stock decrement happens only on the webhook-driven `→ paid` transition, atomically.

## 2. Service layer (single SQL owner)

New modules under `src/lib/` own ALL SQL; routes and MCP handlers call them, never `getDb()`:
`src/lib/categories.ts`, `src/lib/productImages.ts`, `src/lib/sliders.ts`, `src/lib/coupons.ts`,
`src/lib/orders.ts` (reads + dispatch transitions), `src/lib/payments.ts` (intent + webhook apply).
Existing `products.ts / checkout.ts / money.ts` keep catalogue + demo-order logic; coupon/shipping
math composes inside `orders.ts`/`checkout.ts`, not in routes. Read functions return plain DTOs
with PII redaction flag for public callers.

## 3. Admin REST contracts (`/api/admin/*`)

- Base: `/api/admin/<resource>`. Gating: cookie session (`admin_session=<id>.<hmac>`,
  HttpOnly, 8h) minted by `POST /api/admin/login` from the env-bootstrapped root
  (`ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH`, migration 008); server verifies the HMAC,
  checks expiry and `is_active`, 401 on missing/invalid. `/api/admin/users` is root-only
  (403 otherwise). Never ship secrets to client bundles, never log them.
- Idempotency: all mutating `POST` accept `idempotencyKey: uuid` (body or `Idempotency-Key`
  header); UNIQUE-backed, replay returns original with `200 + { deduped: true }`.
  `PATCH/PUT` are natural-idempotent; `DELETE` returns `204` (repeatable).
- Errors: `400` Zod detail (field-level, no DB internals), `401`, `404`, `409` (stock/coupon/
  transition conflict), `500` generic. No raw DB errors, no PII echo.
- Representative Zod schemas (all mutating bodies validated):
  - `CategoryInput { slug: slug3-40, name: 2-60, sort_order: int ≥ 0, is_active: bool }`
  - `ProductInput { slug, name 2-120, category_id: int, origin/estate/flush/harvest_date bounded
    strings, description ≤ 2000, tasting_notes ≤ 500, floral/fruity/malty/body 0-5 ints,
    brew_temp 50-100, brew_seconds 30-600, featured bool }` — no provenance/certification/review
    fields exist; copy must not assert unverified claims.
  - `VariantInput { sku: 3-24 uppercase [A-Z0-9-], grams positive int, price_paise ≥ 0 int,
    stock ≥ 0 int }` — price/stock set only here, never from storefront input.
  - `ProductImageInput { product_id, url: https/relative ≤ 500, alt_text ≤ 200, sort_order,
    is_primary bool }`
  - `SliderInput { title 2-80, subtitle ≤ 200, image_url, cta_label ≤ 40, cta_href: relative/ https,
    sort_order, is_active, starts_at/ends_at nullable ISO datetimes }`
  - `CouponInput { code: 4-24 uppercase, kind: percent|flat, value (percent 1-50 | flat ≥ 1 paise),
    min_subtotal_paise ≥ 0, max_uses nullable positive, window datetimes, is_active }`
  - `DispatchTransitionInput { order_id: uuid, to: dispatch enum, idempotencyKey: uuid }`
    — illegal transition → 409; requires paid except cancel.
- Endpoints: `GET/POST /api/admin/products|variants|categories|product-images|sliders|coupons`,
  `GET/PATCH/DELETE /api/admin/<resource>/:id`, `GET /api/admin/orders?status=&q=` (PII only here,
  behind token), `GET /api/admin/orders/:id`, `POST /api/admin/orders/:id/dispatch`,
  `POST /api/admin/orders/:id/cancel`, `GET /api/admin/payments/:orderId`.
  List routes paginate (`?cursor&limit≤100`).

## 4. MCP contracts (`/mcp?token=` only)

- Transport/auth: single endpoint `/mcp`; auth is `MCP_TOKEN` server env compared constant-time
  against the `?token=` **query param only** — never `Authorization` header, never body.
  Missing/mismatch → generic auth error (no detail). Tokens never logged; server access logs must
  strip query strings. Rotation = new env value, no code change.
- No duplicated SQL: each tool is a thin wrapper calling the §2 service function of the same
  name/shape; validation reuses the §3 Zod schemas. Tool list maps 1:1:
  - catalogue (read): `store.listProducts {q?, category?, featured?}`,
    `store.getProduct {slug}`, `store.listCategories {}`, `store.listSliders {activeOnly?}`,
    `store.validateCoupon {code, subtotalPaise}` (returns validity + discount, no mutation).
  - admin catalogue (mutating, each takes `idempotencyKey?`): `admin.upsertProduct`,
    `admin.upsertVariant`, `admin.upsertCategory`, `admin.upsertProductImage`,
    `admin.upsertSlider`, `admin.upsertCoupon`, `admin.deleteEntity {entity, id}`.
  - orders/payments: `orders.getOrder {orderId}` (PII included — token-gated like admin),
    `orders.listOrders {paymentStatus?, dispatchStatus?, cursor?, limit?}`,
    `orders.setDispatchStatus {orderId, to, idempotencyKey}`,
    `payments.recordIntent {orderId, amountPaise (= order total), idempotencyKey, gateway?, gatewayPaymentId?}`,
    `payments.applyWebhook {gatewayPaymentId, status, signature, amountPaise?}` (signature verified inside
    `payments.ts`; unverified → rejection, never `paid`; also served publicly at
    `POST /api/payments/webhook` with generic pre-signature failures).
- Mutating tools echo `{ deduped }` on idempotency replay; errors mirror §3 codes as tool errors
  with the same generic messages.

## 5. Storefront impact (read-only consumers)

- `GET /api/products` gains optional `categoryId` + `featured` passthrough; joins new category
  table; embeds primary `product_images` row; prices from server variants as today.
- Homepage hero reads active sliders; product pages render gallery with required alt text.
- Checkout accepts optional `couponCode`; server validates via `coupons.ts`, ignores any
  client-computed discount/total. Response adds `discountPaise`, keeps
  `{ status: demo_unpaid, paymentCollected: false }` until a real gateway exists.
- No admin/MCP tokens, no payment secrets, no PII in any storefront payload, log, or bundle.

## 6. Downstream acceptance checklist

- [ ] Migrations 002–006 apply cleanly on seeded DB; re-run idempotent; rollback data intact.
- [ ] All admin routes 401 without token; all mutating POSTs dedupe on `idempotencyKey`.
- [ ] Every MCP tool delegates to its §2 service function (grep: zero `prepare(` outside `src/lib/`).
- [ ] MCP authed only via `?token=`; header/body tokens rejected; query stripped from logs.
- [ ] No `paid` path reachable without webhook verification (tests: forged callback → rejected).
- [ ] `npm run check` green; migration + auth + coupon + transition tests added per AGENTS.md.

## 7. Amendment (t2 — shipping/tax totals, lookup hardening, scale notes)

- Totals pipeline: `src/lib/money.ts` owns `calculateShipping` (standard flat
  ₹99 / free ≥ ₹1,500 — demo schedule, never a carrier promise),
  `calculateTaxPaise` (GST-INCLUSIVE 5% breakout for display/records; the
  checkout total is unchanged: `total = subtotal − discount + shipping`),
  and `quoteTotals` (single composer). Migration 007 adds
  `orders.tax_paise` + `orders.shipping_method` (default `'standard'`);
  checkout/storefront tolerate their absence on old DBs.
- Public order lookup: ≥ 8-char references only (the printed confirmation
  prefix; 4-char prefixes are enumerable), dedicated 30/min/client budget
  (`RATE_LIMITS.lookup`), generic 400/404 shapes, no PII — ever.
- Demo seed stays fenced (`ALLOW_DEMO_SEED` in prod) and claim-free (no
  reviews/scarcity/certifications/provenance/carrier promises); static guards
  in `tests/unit/taxlookup.test.ts`.
- SQLite scale envelope + guardrails live in `docs/OPERATIONS.md` §4a.

## Full product connector contract (2026-10-14)

`admin.upsertProduct`, `admin.createProduct` and `admin.updateProduct` expose the
same full input contract: category assignment, ingredients, description, origin,
sensory and brewing fields, publication status, SEO, pricing, variants and images.
The OpenAPI operation ID is `admin_upsertProduct`; its schema is generated from
that same tool definition at `/api/mcp/openapi`, with `Cache-Control: no-store`.
Ingredients accept text or a list. SEO strings accept null to clear them;
featured/noindex accept booleans or 0/1.

For existing products, identify the record by `id` or `slug`. Omitted details,
variants and images are retained. Supplying `images` replaces the gallery;
omit it when retaining existing attachments. Supplied variants upsert by SKU;
use stable SKUs when retrying. Use an optional UUID `idempotencyKey` to replay a
mutation safely. Variant prices are supplied in paise (`price_paise`) or rupees
(`price`), with actual operator-confirmed stock. Four explicit pack variants
can be supplied in one call without creating a default fifth variant.

`category_id` takes precedence over category text and synchronizes the stored
category name. A name/slug edit resolves the new category rather than retaining
the previous ID. `category_id: null` clears both fields. Invalid IDs return 400;
missing categories return 404. These operations remain token-gated.

A connected action advertising only slug/name is using an older contract.
After an explicitly authorized deployment, refresh/reimport the connector's
schema from `/api/mcp/openapi` (or rediscover MCP `tools/list`) and verify that
category_id, ingredients, SEO and variants appear. Changing local code alone
cannot refresh a hosted connector. No deployment or live catalogue changes
were performed for this fix, and no database migration is required.

The supplied assignment plan is product IDs 43–46 → Bengal Signature Blends,
47–50 → Everyday Milk Chai, 51–54 → Regional Tea Origins, and 55–58 → Iced & Clear
Teas. Resolve actual category IDs from the target catalogue before updating.
Descriptions, ingredient composition, pack weights/prices and stock still need
verified operator data; the mapping alone does not establish those values.
