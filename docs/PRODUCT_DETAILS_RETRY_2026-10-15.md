# TeaFloww product-details retry — 2026-10-15

The production API and direct MCP endpoint already expose `admin.updateProductDetails` with 64 input properties. The installed Codex connector still advertises the old minimal product write schema. Its catalogue list defaults to published records and does not advertise the supported `status` filter. Use authenticated API `store.listProducts` with `status: "all"` to locate drafts, then `store.getProduct` for individual readback.

## Applied and verified

All 16 existing products (IDs 43–58) received nine explicit **pending verification / pending assessment** notes: dry leaf appearance, grade and aroma; liquor colour name, clarity and body; wet leaf aroma and processing profile; and provenance verification requirements in estate_story. These are workflow notes, not measured product specifications. Eight updates used direct MCP tools/call and eight used the authenticated HTTP tool API. Every write was followed by individual readback and comparison with the before snapshot. UUID idempotency keys were persisted in the request journal.

No sensory scores, aroma tags, measured colour hex values, origin, verified_origin or estate names were invented. All ratings remain unscored; supplier records and final-blend cupping are still required. Ingredient declarations remain unverified and retain regional/single-estate wording that needs supplier substantiation.

All 64 variants remain ₹199 and zero stock. All 16 products remain Draft. Ingredients, descriptions, SEO, categories, brewing guidance, galleries, variants and identity were retained exactly. No products were recreated and no application deployment was performed.

## Evidence and outstanding input

Local before/after snapshots, persistent request keys and the field audit are in `scratch/product-import/*2026-10-15*`. Production database backup and before/after snapshots are stored with restricted permissions at `/www/backup/teafloww-product-details-20261015-191215`.

To replace pending notes with actual specifications: provide lot-specific supplier provenance and grade documents; recorded dry/brewed/wet-leaf observations; aroma tags and six cupping scores on the supported 0–5 scale; approved ingredient declarations; actual sellable stock per SKU; and publication readiness. Access is now verified; missing evidence is the remaining dependency.
