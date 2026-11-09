# Product Tea Moments

Tea Moments replaces the Origin & Terroir dossier on `/tea/[slug]`. It appears
in All Overview, its own desktop tab, and the mobile accordion only when a
product has a nonblank curated introduction. Empty suggestions are omitted.
No selected image, or an image that fails to load, produces a text-only layout.
Ingredients remain in the main product information.

## Editing and interfaces

The product editor provides headline, introduction, occasion, serving suggestion,
food pairing and upload/library/path image controls. Recommended image dimensions
are 1200×1500 (4:5), WebP/JPEG preferably under 400 KB. Describe the actual image,
including any illustration disclosure. The matching alt description is visible
under storefront imagery. Content is plain text, never rendered as HTML.

Product HTTP endpoints and MCP create/upsert/update tools accept `tea_moments`:

```json
{
  "headline": "Make it your moment.",
  "introduction": "Operator-authored product introduction",
  "occasion": "",
  "serving_suggestion": "",
  "food_pairing": "",
  "image_url": "",
  "image_alt": ""
}
```

Omitting the top-level property preserves it; `null` clears it. A supplied object
replaces the previous object, with empty optional text defaults. Headline is
limited to 120 characters, introduction to 1200, recommendations/alt to 300,
and local image paths to 500. A selected image requires alt text. External,
protocol-relative, traversal and unsafe image paths are rejected. Malformed
stored JSON is treated as absent. Existing authorization and idempotency apply.

All sourcing controls and sourcing-specific product admin displays are removed.
Stored sourcing fields, external sourcing integrations and storefront catalogue
filters remain available. Product PATCH only merges explicitly supplied fields;
Zod defaults cannot erase hidden sourcing during an unrelated edit.

## Additive migration and rollback

Local development uses SQLite only. Back up before applying migration 037:

```sh
npm run db:backup
npm run db:migrate
npm run db:migrate:check
```

The migration adds nullable TEXT `products.tea_moments`; it does not backfill
editorial content or delete sourcing. It is safe to replay. For a future,
explicitly authorized production release, first take a PostgreSQL backup with
`pg_dump`, validate restoration to a separate database, then apply this SQL in
a transaction using the production migration procedure:

```sql
BEGIN;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tea_moments TEXT DEFAULT NULL;
INSERT INTO schema_migrations (version)
VALUES ('037_tea_moments') ON CONFLICT (version) DO NOTHING;
COMMIT;
```

Confirm the existing schema_migrations definition before applying, read back a
saved object and an unchanged legacy product, and verify the storefront. This
SQL is supplied for operator review; no production database was accessed or
migration/deployment performed. Roll back application code while retaining the
additive column and data; do not drop the column. Restore a tested backup only
if data recovery is required.

## Reproducible isolated browser preview

The preview helper copies the local SQLite database via its online backup API,
migrates that temporary copy, and places explicitly illustrative content on one
published product in the copy. It leaves the source database unchanged. It requires
an existing published product and active root user; no credentials are printed.

```sh
node scripts/tea-moments-preview.mjs
```

The output is a temporary directory. In each terminal load its `preview.env`
with `set -a; source /printed/directory/preview.env; set +a`. Start the preview:

```sh
NEXT_DIST_DIR=.next-tea-moments npx next dev -p 3314 -H 127.0.0.1
```

In the second terminal, after loading the same environment:

```sh
BASE_URL=http://127.0.0.1:3314 npx playwright test tests/e2e/tea-moments.spec.ts
```

The session expires after one hour. The browser suite skips without
`TEA_MOMENTS_FIXTURE` rather than editing a working catalogue. Stop the preview
and remove its temporary directory when finished. Captures under
`docs/ui/tea-moments` are real browser screenshots with fixture content, not
published product recommendations or product photography.
