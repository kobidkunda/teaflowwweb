# Private-label flow repairs — 2026-11-11

The consultation form previously displayed success on a timer without making a
request. It now posts to the existing validated contact API, retains input on
failure and displays the stored reference only after a successful response.

Studio repairs cover one-time packaging deep links, guarded step navigation,
current-item persistence before quoting, optimistic revision updates, visible
session/network/conflict errors, server estimates and public-only catalogue props.
Drafts persist locally without initiating competing background updates. The
account workspace lists saved projects and resumes them through the authenticated
project endpoint, including configuration, revision and current step.

Artwork inputs are now explicitly **previews**: PNG/JPEG/WebP up to 512 KB, with
read/decode errors, rights confirmation and persistence as an embedded preview.
This is not a production artwork upload or automatic production preflight.
Production proof approval remains on the quote flow and requires an existing
server proof; the studio cannot fabricate an approved proof.

Quote detail obtains the linked project ID from the authenticated quote response;
it no longer guesses by fetching unrelated projects. Samples expose session
failures, use associated field labels, and do not promise a free coupon before
server validation. All private-label pages use the storefront's main landmark.

Five AI-generated images are in `public/images/private-label/`: the atelier hero
and pouch/tin/jar/carton concepts. Optimized family images are 29–45 KB WebP.
They are disclosed as illustrative and are used only when operator imagery is
absent. Local uploaded imagery is accepted by catalogue/detail cards. No catalogue
records, inventory or verified sourcing were invented to fill the empty store.
Unsupported licence, price-lock and dispatch claims were removed from touched copy.

No database migration or production deployment is part of this change.

Additional verified repair: quoted drafts previously failed on save because their
items were deleted while `pl_quote_items` still referenced them. Updates now retain
item IDs and quoted snapshots. Removing quoted items or changing a locked proof is
blocked with a controlled response. A regression test reproduced the foreign-key
failure before the fix and passed afterward.

Browser evidence uses an isolated production server and synthetic customer:
consultation storage with a real reference, sample request with server pricing,
project create/update, 2,500-unit quote creation with the selected alternate pack,
PDF response, account project resume, and unauthenticated save guidance. Supplier
name and raw tea/pack costs were absent from serialized studio HTML. Desktop,
tablet and mobile layout checks covered landing, catalogue, packaging detail and
studio at 1440/768/390/320px with one main landmark and no document overflow.

Final acceptance: full check passed (2,840 tests; six intentional live-PG skips).
The final production-browser replay saved artwork on the already quoted project,
advanced to revision 3 and restored the embedded preview after reload. Final
landing captures were taken after decoding all five responsive images. Generated
concept cards replace the fictional fallback products and dead SKU links. The
isolated server was stopped and its temporary SQLite copy moved to Trash.
