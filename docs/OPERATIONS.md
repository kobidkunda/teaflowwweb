# Operations Runbook — The Tea House

Server-only operator guide. Nothing here belongs in the client bundle.
Customer PII (name, email, address) must never appear in logs, backups chat,
or pasted tickets — log order IDs and status transitions only.

## 1. Environment checklist

Copy `.env.example` to `.env` (never commit `.env`). Required before serving traffic:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_PATH` | yes | Absolute path on a **persistent disk**, e.g. `/var/lib/teahouse/store.sqlite`. Default `./data/store.sqlite` is dev-only. |
| `ADMIN_USERNAME` | yes (first boot) | Root login name. Bootstraps `admin_users` on first login; afterwards the DB row rules — may be removed from env. |
| `ADMIN_PASSWORD_HASH` | yes (first boot) | scrypt hash from `node scripts/gen-admin-hash.mjs`. Preferred over `ADMIN_PASSWORD`. |
| `ADMIN_PASSWORD` | boot-only fallback | Used only when `ADMIN_PASSWORD_HASH` is empty and no admin exists. Set the hash and unset this after first login. |
| `ADMIN_EMAIL` | no | Contact email stored on the bootstrapped root (password resets). |
| `SESSION_SECRET` | yes | `openssl rand -hex 32`. HMAC secret for the `admin_session` cookie. Rotate per §7. |
| `SMTP_HOST/PORT/USER/PASS` | no | Reset-mail relay. Empty = links stay in `password_reset_tokens` + logged fallback. Port 465 (or `SMTP_SECURE=1`) uses TLS-on-connect; plain AUTH otherwise. |
| `RESET_FROM_EMAIL` | with SMTP | Envelope sender for reset mail. |
| `APP_BASE_URL` | with SMTP | Public base URL for reset links, e.g. `https://shop.example.com`. |
| `MCP_TOKEN` | yes | `openssl rand -hex 32`. Query-param `?token=` for `/mcp`. Strip query strings from access logs. |
| `LOG_LEVEL` | no | `debug\|info\|warn\|error`, default `info`. Use `info` in prod. |
| `BACKUP_DIR` | yes (prod) | Persistent-disk directory, e.g. `/var/backups/teahouse`. |
| `NODE_ENV` | yes (prod) | `production`. Fences `db:seed` out unless `ALLOW_DEMO_SEED=1`. |
| `PAYMENT_WEBHOOK_SECRET` | gateway task | `openssl rand -hex 32`. Do not set until the verified gateway lands. |

Generate: `openssl rand -hex 32`. Store in the host secret manager, not in git.

## 2. Deploy steps (single persistent Node host)

SQLite has exactly one writer. Run **one** app instance per database file —
never serverless/edge, never two hosts on one file, never the DB on ephemeral disk.

1. Provision a host with a persistent volume. Note its mount in the deploy log.
2. `npm ci` (or `npm install`), then `npm run db:migrate`.
3. Gate: `npm run db:migrate:check` must print `up to date` (exit 0). If it
   prints `Migrations pending`, do NOT start traffic — the migrate failed.
4. Start: `npm run build && npm run start` (or `npm run dev` for staging).
5. Verify: `GET /api/health` → 200 `{status:"ok"}`; `GET /api/ready` → 200
   `{status:"ready"}`. A 503 from `/api/ready` with `pending:[...]` means
   migrations are behind — re-run step 2, never hand-edit schema.
6. Point the reverse proxy at the app; confirm TLS, then run one demo checkout
   and one `WELCOME10` coupon order in staging.

Seed rule: `npm run db:seed` loads **fictional demo catalogue** and upserts by
slug/sku. It REFUSES under `NODE_ENV=production` unless `ALLOW_DEMO_SEED=1`.
Never seed production — it would publish unverified provenance copy.

## 3. Migration discipline

- Bootstrap (`scripts/migrate.mjs` header) is frozen. New schema = new file
  `scripts/migrations/NNN_<name>.mjs` exporting `up(db)` using only
  `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE … ADD COLUMN` /
  `CREATE INDEX IF NOT EXISTS`, plus guarded backfills. Down = no-op.
- Files run in filename order, each in its own transaction; the version row is
  written inside that transaction, so a failed migration leaves no record and
  is safe to retry after fixing.
- The app NEVER auto-migrates on boot or in a request path. `/api/ready`
  reports pending versions instead of applying them.
- Rollback = deploy the previous build (additive columns/tables are ignored by
  old code). Never `DROP`/`ALTER` deployed schema silently.

## 4. Backup & restore (SQLite)

Strategy: nightly `VACUUM INTO` snapshot to **persistent disk** (not the same
volume as the live DB if possible), retain 7 daily + 4 weekly, copy one weekly
off-site. `VACUUM INTO` is online-safe under WAL — no downtime needed.

- Backup: `npm run db:backup` (or `BACKUP_DIR=/var/backups/teahouse npm run db:backup`).
  Prints the snapshot path, e.g. `store-2026-10-10_08-00-00.sqlite`.
- Cron example: `0 2 * * * cd /srv/teahouse && BACKUP_DIR=/var/backups/teahouse npm run db:backup`.
- Restore (downtime): stop the server → `npm run db:backup` (safety snapshot) →
  `node scripts/restore.mjs <backup-file> --force` (snapshots current DB aside as
  `.pre-restore-*`, validates the SQLite header, runs `integrity_check`) →
  `npm run db:migrate:check` → start server → verify `/api/ready`.
- Test restores quarterly on staging: restore a prod snapshot to a temp
  `DATABASE_PATH` and boot. An untested backup is not a backup.

> **Persistent-disk warning:** SQLite on ephemeral/serverless storage loses all
> orders on redeploy/scale-to-zero. If the host cannot provide a persistent
> writable volume, migrate to a managed database BEFORE accepting live sales.

## 4a. SQLite scale notes & guardrails (single-writer limits)

This build is sized for a small single-host shop. The hard ceiling is
architectural, not tuning: SQLite has exactly one writer, and this app runs
exactly one Node process per database file (better-sqlite3, synchronous).

- **Known-good envelope:** hundreds of orders/day, catalogue < 10k variants,
  DB file < 2 GB, one writer process. Inside this envelope no tuning is needed
  beyond WAL (set by `db:migrate`) and the nightly `VACUUM INTO` (§4).
- **Migrate to a managed database BEFORE any of:** a second app instance or
  host serving traffic; sustained > 5 checkouts/minute; 24h order table growth
  that outpaces the backup window; read-replica or full-text-search needs.
  Do not paper over these with PRAGMAs — move the data layer.
- **Guardrails (already in code, do not relax without review):**
  - One migrator per DB file per deploy; app never auto-migrates on boot.
  - Checkout caps: ≤ 30 line items, ≤ 20 units per variant; oversell fails
    closed at verified capture (stock re-checked in the webhook transaction).
  - Public lookup: 30 req/min/client + ≥ 8-char references (enumeration
    hardening, see `getPublicOrder`); coupon preview shares a separate 60/min
    budget so lookup probes cannot eat pricing availability.
  - Rate limits are per-process memory: correct for one instance, void the
    moment a second instance exists (move to Redis/KV with the database).
- **Monthly operator check (5 min):** `ls -lh $DATABASE_PATH` size trend,
  `npm run db:migrate:check` → up to date, last backup timestamp < 26h,
  `PRAGMA integrity_check` → `ok` on the staging-restored snapshot.

## 5. Health, readiness & logging

- `GET /api/health` — liveness: process alive + SQLite answers. 200/503.
- `GET /api/ready` — readiness: database + migrations current (env presence
  reported as boolean). Gate deploys and load-balancer checks on this.
- Logs are single-line JSON via `src/lib/logger.ts`
  (`{ts, level, msg, ...safeFields}`). Sensitive keys (name/email/address,
  token/secret/cookie/payment) are replaced with `[redacted]`; emails in text
  are masked. Safe fields: `orderId`, status transitions, `route`,
  `latency_ms`, error codes. `LOG_LEVEL=info` in prod; never `debug` with
  traffic. MCP access logs must strip `?token=` query strings.

## 6. Rollback

1. Stop traffic (proxy drain or maintenance page).
2. Deploy the previous build artifact (code only — schema is additive so old
   code runs on the new DB).
3. `npm run db:migrate:check` → expect up-to-date (old build ignores new
   tables/columns).
4. If data corruption is suspected: restore per §4, then re-check.
5. Restart, verify `/api/ready` → `ready`, smoke-test shop → cart → demo checkout.

## 7. Session secret rotation & admin accounts

Admin auth is cookie-session (migration 008): `POST /api/admin/login`
issues `admin_session=<id>.<hmac>` (HttpOnly, SameSite=Lax, 8h, Secure in
production). The server stores only the SHA-256 of the id plus the HMAC.
`/api/admin/*` gate on that cookie; `/api/admin/users` is root-only.

- **First boot:** set `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` (from
  `node scripts/gen-admin-hash.mjs 'password'`) + `SESSION_SECRET`, run
  `db:migrate`, POST login once, then unset `ADMIN_PASSWORD` if used.
- **Staff:** root creates logins at `/admin/users` (username 3–32 chars,
  password ≥ 12, role root/admin). Disable instead of delete; disabling and
  password changes sign the account out everywhere. Root cannot disable or
  demote itself; the last active root is protected.
- **Lockout:** 5 wrong passwords lock the account 15 min (generic 401, no
  username oracle). Login is also capped at 10/min/client (429).
- **Resets:** `/admin/reset` — forgot always answers `{ok:true}` (no email
  oracle). Tokens are single-use, 60 min, SHA-256 stored. Without SMTP the
  token stays in `password_reset_tokens` and the request is logged; the
  operator drill is: confirm the requester out-of-band, then read the newest
  `expires_at` row for that `user_id` and hand over
  `$APP_BASE_URL/admin/reset?token=<raw>` — the raw token is never logged.
- **Rotate `SESSION_SECRET`:** generate (`openssl rand -hex 32`), update the
  secret manager, restart in low traffic. Every session signs out; staff log
  in again. Confirm: old cookie → 401, fresh login → 200.
- **MCP_TOKEN rotation** (unchanged): generate, update, restart, confirm old
  → 401 and new → 200 on one MCP call.
- Grep for leaks: `grep -r "SESSION_SECRET\|MCP_TOKEN\|ADMIN_PASSWORD" --exclude-dir=node_modules .`
  must show no values; access logs must never carry cookie values.

## 8. Operator-action checklist (non-code items — human work before live sales)

- [ ] **Gateway account:** production gateway account (e.g. Razorpay) created,
      KYC complete, test-mode keys issued separately from live keys.
- [ ] **Webhook secret:** `PAYMENT_WEBHOOK_SECRET` (`openssl rand -hex 32`) set on
      the host; gateway callbacks hit `POST /api/payments/webhook`
      `{gatewayPaymentId, status, signature}` (HMAC-SHA256 over
      `"<gatewayPaymentId>:<status>"`); forged-signature and double-webhook
      drills pass in test mode.
- [ ] **Refund policy:** written refund/return window, who approves, gateway
      dashboard reconciliation cadence; support macro drafted.
- [ ] **Domain & TLS:** production domain registered, TLS via managed certs with
      auto-renewal, HTTP→HTTPS redirect, HSTS; staging on a separate subdomain.
- [ ] **Persistent disk:** production volume provisioned, mount documented,
      nightly backup cron + quarterly restore drill scheduled (§4).
- [ ] **Secrets storage:** tokens live ONLY in the host secret manager; `.env`
      never committed; rotation runbook (§7) assigned an owner.
- [ ] **Legal pages:** privacy policy, terms, shipping, returns published and
      reviewed; consent checkbox + retention/deletion workflow live.
- [ ] **Tax & shipping:** code computes the demo schedule (standard flat ₹99 /
      free ≥ ₹1,500) plus a GST-inclusive 5% breakout for display/records
      (`src/lib/money.ts` — assumption, not tax advice). Operator still
      confirms: final GST treatment with CA, PIN-code serviceability, carrier
      contract and tracking integration for launch regions.
- [ ] **Photography & content:** real product photography shot; every estate,
      certification, harvest-date and review claim verified — fictional seed copy
      replaced, not edited in place.
- [ ] **Support & comms:** support inbox, transactional-email sender (SPF/DKIM),
      order-notification templates, on-call rotation and incident channel ready.
- [ ] **Monitoring baseline:** `/api/health` + `/api/ready` in the uptime monitor,
      log retention set, P0 alert (readiness 503, backup failure) tested.

## 9. International Commerce, Exchange Rates & Background Worker

### Background Worker Service
International commerce features background tasks (currency FX refreshes, AI translations, tracking polling, inventory reservation cleanup).
- Run the worker in production via systemd or PM2:
  `node scripts/commerce-worker.mjs`
- The worker claims pending jobs from `commerce_jobs` with advisory leases and backoff retries.

### Exchange Rate & Payment Gateway Secrets
- `EXCHANGERATE_API_KEY`: API key for ExchangeRate-API. Cached for 48 hours for storefront browsing.
- `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: Razorpay credentials. Webhooks are verified using raw request HMAC-SHA256 signatures (`x-razorpay-signature`).
- `SHIPROCKET_EMAIL` & `SHIPROCKET_PASSWORD`: Shiprocket credentials for carrier booking, label generation, and tracking.
- `OPENAI_API_KEY` & `OPENAI_TRANSLATION_MODEL`: Structured translation provider.

