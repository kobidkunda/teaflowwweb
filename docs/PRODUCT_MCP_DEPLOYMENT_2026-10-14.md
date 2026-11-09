# Product MCP production deployment — 2026-10-14

The user explicitly requested production deployment. The two changed source
files were deployed to `/www/wwwroot/teafloww.com`: `src/lib/mcp.ts` and
`src/app/api/mcp/openapi/route.ts`. Production product persistence and validation
files already matched the tested local source. Local `npm run check` passed:
1,247 tests passed, five PostgreSQL tests skipped, and the build succeeded.

The production build succeeded in `.next-product-mcp-20261014`, with PostgreSQL
environment settings inherited from the existing TeaFloww PM2 process. PM2
`teafloww` was restarted with `NEXT_DIST_DIR=.next-product-mcp-20261014` and its
configuration saved. The previous `.next` build remains available. No database
migrations or package installations were performed.

## Live verification

- Public HTTPS homepage and `/api/health` returned 200; health reported PostgreSQL.
- Public `/api/mcp/openapi` served version 1.1.0 with 57 product properties.
- Authenticated MCP `tools/list` exposed the full product input schema.
- Unauthenticated product writes returned 401; invalid category IDs returned 400.
- Existing product 43 and its original gallery were readable through the live API.

## Catalogue updates

A PostgreSQL custom-format backup was created before writes. The prepared
`scratch/product-import/translated.json` package was applied through authenticated
`admin.upsertProduct` calls with persistent per-product UUID idempotency keys.
Each target ID/slug and each category ID/name was checked before mutation.
The package deliberately omitted `images` and unverified ingredient formulas.

All 16 target IDs (43–58) were read back and verified:

- Category assignments: IDs 43–46 → 75; 47–50 → 76; 51–54 → 77; 55–58 → 78.
- Prepared draft descriptions, SEO titles and descriptions persisted exactly.
- Four variants each (100 g, 250 g, 500 g, 1 kg): 64 total, ₹199 each, zero stock.
- Status is Draft for all 16 proposed products, as requested by the prepared package.
- All 16 gallery records remained identical, including image IDs and media references.
- Ingredient declarations remain blank: the source contains only internal R&D
  formulas, with `ingredients_public: null`. Verified declarations are still needed.

## Backups and rollback

Production backup directory: `/www/backup/teafloww-product-mcp-20261014`.
It contains the previous two source files, build log, custom-format database
backup, persistent product requests and pre/post-update product snapshots.
Database backup and product snapshots are mode 0600. Do not publish these files.

Code rollback: restore the two backed-up source files, restart only `teafloww`
with `NEXT_DIST_DIR=.next` and `--update-env`, then save PM2 configuration and
verify health. A database restore is a separate operational action; do not
overwrite unrelated subsequent orders or catalogue edits. Product snapshots
allow a targeted restoration after reviewing intervening changes.

Future builds must use a new staging directory and switch PM2's `NEXT_DIST_DIR`
after successful verification. The currently served build is not `.next`.

The hosted schemas are current. A client holding the old two-field action
definition must rediscover MCP tools or refresh its OpenAPI import. No connector
permission changes were performed.

## Follow-up: product-specific guidance

After the user identified the remaining fields, all 16 existing records received
product-specific brewing starting points and intended flavour profiles from the
prepared source package. These are explicitly labelled as developmental and
unverified in `steep_instructions` and `tasting_notes`; they are not cupping
results or batch-tested specifications. The guide recommends one initial
infusion and states that repeat-infusion suitability has not been evaluated.

`scratch/product-import/suggested-guides.json` records the exact updates. A new
production PostgreSQL backup (`database-before-guides.dump`) and pre/post-update
product snapshots were stored in the same restricted backup directory. Live
read-back verified all seven updated fields for each product, as well as
unchanged images, variants, descriptions, SEO, category assignments, Draft
status, zero stock and all unverified ingredient/provenance/leaf/score fields.

Approved ingredient labels, actual lot provenance, cupping/leaf observations
and operator-confirmed sellable stock are still required. No product was
published and no stock was invented.
