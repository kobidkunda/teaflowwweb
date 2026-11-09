# TeaFloww production performance release — 2026-10-16

Explicitly requested by the user. Production URL: https://teafloww.com/.

## Active release

- Application: `/www/wwwroot/teafloww.com`
- PM2 application: `teafloww`, ID 20, online; process list saved after verification.
- Build: `.next-production-20261016-performance-v2`
- Asset prefix: `/_assets/20261016-performance-v2`
- Native server build: Node 20.19.5, locked Next.js 15.5.27.
- PostgreSQL remains the production database; no migrations or catalog mutations
  were run by this deployment. Local development remains SQLite.

## Backup and rollback

Protected backup directory:
`/www/backup/teafloww-deploy-20261016-performance`.
It contains the custom PostgreSQL dump, successful `pg_restore --list` output,
application source archive, production environment backups, previous PM2
configuration, database fingerprints, Nginx configuration backup and verification
logs. The archive was inspected, not restored into another database.

Previous working release: `.next-production-20261016-video-csp`. Its build and
hashed static files remain available. To roll application code back, select that
`NEXT_DIST_DIR` and clear `NEXT_ASSET_PREFIX` when restarting PM2, then verify
readiness and save the process list. Full source rollback also requires restoring
the previous source/config and the backed-up public catalog files. Do not restore
the database merely to roll back this code-only release: that would overwrite
subsequent operational edits.

## Static asset publication correction

The first candidate compiled and passed direct application probes. After its
initial activation, public verification found that Nginx served static assets
from `.next/static`, while the new build lived in a separate release directory.
Missing asset responses had already been cached at the CDN. The previous release
was restored while the correction was prepared. The incomplete-asset Lighthouse
run is excluded from final performance evidence.

The final release uses a unique asset prefix. An additive Nginx location maps
`/_assets/20261016-performance-v2/_next/static/` to the shared
`/www/wwwroot/teafloww.com/.next/static/` directory. Nginx configuration validation
passed before reloading. All release assets were copied with readable permissions
and all 17 initial stylesheet/script URLs were verified over public HTTPS before
reactivating the application. Existing hashed files were retained for open tabs
and rollback. No CDN account/DNS changes were made.

Future releases must follow this order:

1. Back up the database, application, environment, PM2 configuration and proxy
   configuration; retain the working build.
2. Build a fresh native release directory using a unique `NEXT_DIST_DIR` and
   `NEXT_ASSET_PREFIX`. Do not copy a patched local `node_modules` directory.
3. Publish all hashed assets to the shared directory, without deleting previous
   versions. Use explicit permissions, e.g. `rsync -rp --chmod=D755,F644`.
4. Configure and validate the release asset URL mapping. Verify the candidate on
   a temporary local port, including read-only readiness/database checks.
5. Check the candidate's actual asset URLs over public HTTPS **before** changing
   the live PM2 process. Direct Node probes do not exercise Nginx/CDN asset serving.
6. Restart PM2 with both release environment values. Verify public HTML, metadata,
   CSS/JS, discovery routes, health/readiness and protected endpoints; then save
   the PM2 process list. Keep the old build and assets.
7. Perform rendered mobile/desktop checks and collect repeatable live audits.

The obsolete public root and legacy catalog files were moved into the backup,
preventing them from shadowing the canonical bundled catalog routes.

## Verification

- Latest local `NEXT_DIST_DIR=.next-perfcheck npm run check` passed: TypeScript,
  lint (existing warnings), 1,282 passing tests, five PostgreSQL tests skipped,
  and production build. Native server production build also passed.
- Public homepage, shop, blog, tea preparation page, health and readiness: 200.
- Root and both legacy catalog routes: 200, ARD 1.0, same three entries.
- Unauthenticated admin products and MCP: 401.
- Homepage reserves space before streaming, metadata is present in the initial
  head, and the existing YouTube CSP allowances remain present.
- All 17 initial versioned CSS/JS resources: 200 over public HTTPS.
- Real browser checks at 390/1440 px: styled layout, decoded hero image, no page
  overflow, no page exceptions or failed versioned asset responses. Screenshots
  were visually reviewed in `output/playwright/production-performance-*.png`.
- Final PM2 check: online, expected release/prefix, PostgreSQL, zero unstable
  restarts. Temporary candidate process stopped.

Three complete Lighthouse 13.5.0 / Chrome 155 mobile runs against public HTTPS,
default Moto G Power 412 × 823 / DPR 1.75 / simulated Slow 4G / 4× CPU, fresh
browser runs:

| Signal | Median | Range |
| --- | --- | --- |
| Performance | 94 | 92–95 |
| Accessibility | 100 | 100–100 |
| Best Practices | 100 | 100–100 |
| SEO | 100 | 100–100 |
| Agentic Browsing | 98 | 98–98 |
| FCP | 1.859 s | 1.303–1.873 s |
| LCP | 2.796 s | 2.642–3.253 s |
| TBT | 93 ms | 78–99 ms |
| CLS | 0 | 0–0 |
| Speed Index | 1.873 s | 1.859–1.906 s |

All three final runs had no console-error findings. The earlier live baseline
reproduced the exact reported CLS 0.587; its single-run Performance score was 73,
while the user's earlier report scored 66. Different browser versions and test
conditions mean these scores are diagnostic, not a controlled field comparison.
LCP remains above 2.5 s in this mobile simulation. Agentic Browsing's remaining
low notices concern accurate API/feed media types outside its preferred list;
the manifest itself is valid. No field Core Web Vitals pass is claimed.

### Database preservation and concurrent changes

At the first activation, fingerprints of products, variants, images, orders,
order items, settings and migration history matched the pre-deploy snapshot.
Later verification still found identical products, all 86 variants (including
prices/stock), orders, order items, settings and all 30 migrations. Image records
changed while verification was running: two rows were added and image 208's
`is_primary` flag changed. Comparing the backup's original 265 image rows with
live data confirmed no original rows were deleted; the only changed original
field was that primary-image flag. These concurrent image edits were left intact.
The deployment did not invoke image/catalog writes or restore database data.

Detailed evidence is under `output/deploy-20261016-performance/` locally and in
the protected backup directory on the server. Backup/configuration files contain
secrets and must not be published or attached to a public issue.
