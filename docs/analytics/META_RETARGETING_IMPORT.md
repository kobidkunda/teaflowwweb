# Correct Meta destination and add retargeting events — 2026-11-11

The merchant identified dataset 29619022431117471 as the intended TeaFloww data
source. The live public GTM container was independently checked and still
contained 1128432123376468, with no occurrence of the intended ID. The Meta
connector requires reauthentication, so ownership and receipt could not be
verified through that connector.

Use `teafloww-meta-correct-dataset-29619022431117471-v3.json`. This supersedes the
previous supplement. The artifact is prepared locally; it is not published.

1. Export the latest container as a backup and choose a clean workspace.
2. Admin → Import Container → choose the corrected file.
3. Choose top-level **Merge**. Do NOT select the top-level Overwrite option,
   which replaces the workspace contents.
4. Within Merge, choose **Overwrite conflicting tags, triggers and variables**.
   This is needed to change the existing Meta base and Purchase destination,
   and to update matching funnel tags if the previous supplement was imported.
   Do not choose Rename: that would leave old destination tags firing too.
5. Inspect the preview: existing Meta base, Purchase and paused duplicate point
   at 29619022431117471. Duplicate purchase remains paused. Six additional event
   tags map view_item, add_to_cart, begin_checkout, add_payment_info,
   generate_lead and search to ViewContent, AddToCart, InitiateCheckout,
   AddPaymentInfo, Lead and Search. No GA4 tags should change or be deleted.
6. Preview with marketing cookies granted and denied. Check single firing,
   content_ids/contents, quantity/value/currency, and eventID. Confirm Meta Test
   Events under dataset 29619022431117471 receives events before publishing.
7. Submit → Publish. Match content IDs to catalog retailer IDs for dynamic ads.

The source for existing base and purchase tags is the export supplied earlier
in this chat. Review differences if those tags have since been edited. Preserve
intentional newer changes before publication. A verified paid purchase remains
untested. The existing paused duplicate must remain paused.

The mapping variable uses a sandboxed template, avoiding a Custom JavaScript
variable's unsafe-eval requirement. It allowlists product fields and search
term rather than copying customer data. New funnel tags require marketing
consent and production hostname matching. PageView/Purchase are not duplicated
by the six new funnel tags. Website deployment is not required for the GTM
import; CAPI delivery for the new destination still requires verification.

Import-format correction: the new template's ___INFO___ section now includes
numeric version 1. GTM previously rejected its absence with
`template_data ___INFO___.version: Invalid/missing long int`. Regression tests
now check the version field on every included template. Local contract tests
cannot replace the actual GTM import validation step.


Second importer correction: locally embedded templates must be referenced by
`cvt_<containerId>_<templateId>`, not an invented descriptive public ID. The
properties variable now uses `cvt_266900144_9500`; its template ID is 9500,
INFO id is `cvt_temp_public_id`, and INFO version is numeric 1. This convention
was cross-checked against a published export containing local variable/tag
templates: https://github.com/OCANA-Co/gtm-stape-tracking/blob/main/templates/container-web-template.json
Ten focused tests pass, including local template reference resolution and INFO
version requirements; focused lint passes. Actual GTM acceptance remains pending.

The current public container remains version 8 with no new funnel tags. It
still routes Meta to the old pixel. Failed imports have not activated fixes.
Production PurchaseStatus already calls tracking for server-confirmed cod_due
orders; no further COD eligibility change was made in this investigation.
Abandonment is normally measured using AddToCart/InitiateCheckout audiences
excluding Purchase over a chosen time window, rather than a browser exit event.

## Live version 9 and Preview follow-up — 2026-11-11, about 14:20 IST

A fresh public `gtm.js` fetch now reports version 9 with the intended
29619022431117471 destination and all six funnel mappings; the old pixel ID is
absent. This supersedes the earlier version-8 status above. The published resource
contains Meta tags but no native Google/GA4 tags, so the previous GA4 configuration
needs review against a current workspace export before any further publication.

In a fresh browser on the real shop page, accepted marketing consent initialized
the intended pixel. Clicking the real Everyday Strong Milk Chai add button emitted
`add_to_cart` with SKU TFW-005-100G, quantity 1, INR 30 and a UUID event ID.
The corresponding Meta `/tr/` AddToCart request returned HTTP 200. PageView was
also observed. No fake Purchase, payment, lead or search event was sent. Browser
HTTP success proves transport, not Events Manager processing or CAPI ingestion.

The user's Safari page visibly showed “Tag Assistant Not Connected.” Starting a
fresh session reached an active-domain entry, but Tag Assistant was signed out
and displayed “You do not have access to this container”; no completed authenticated
Preview result is claimed. The user was asked to sign in with the GTM account.
The connected Meta API also returned reauthentication required, so receiving-side
activity remains unverified. A summary listing only the base tag as fired is
expected before performing the corresponding funnel actions; the duplicate
Purchase tag should stay paused. No GTM edits/publication or website deployment
was performed during this follow-up.

### Combined restoration artifact

`teafloww-tracking-complete.json` combines the previously reviewed Google/GA4
baseline with the corrected Meta supplement. It includes one Google base, all
four GA4 event-forwarding tags, the intended Meta base/Purchase, six Meta funnel
mappings, their dependencies and the paused duplicate. It is prepared locally;
it is not a fresh workspace export and cannot establish that later operator
workspace edits are preserved. Back up/export the current workspace and review
the diff before use. Import with **Merge → Overwrite conflicting entities**,
never top-level Overwrite. Preview an actual product view/add-to-cart with
analytics/marketing consent and verify GA4 and Meta receipt before publication.

Regenerate: `node scripts/generate-gtm-complete.mjs`. Twelve focused tests pass
across complete-import, GA4 and Meta contract suites; focused ESLint passes.
The full repository check passed for the cart changes before this additive
tracking artifact was created. This import has not been validated by GTM's
actual importer or published in this follow-up.

## Meta iframe/form transport correction — 2026-11-11

The supplied browser errors identify two additional CSP directives: frame-src
blocked `https://www.facebook.com/`, and form-action blocked
`https://www.facebook.com/tr/`. The local security header now permits the exact
frame origin and only the tracking form path. Existing connect-src and script-src
allowances alone cannot authorize frames or form submissions. This is a website
header fix; a GTM JSON import cannot activate it. Twenty focused tests and a real
Chromium harness with production CSP passed, including rejection of an unrelated
Facebook form path. No real conversion payload was sent and no receiving-side
processing is claimed. Deployment remains a separate explicit operation.
