# Website → GTM → destinations: current v7 correction

The supplied export is GTM-M5G27HSQ, account 6382131376, container 266900144,
version 7. It contains one Google base tag and three Meta tags, but no GA4 Event
tags. A base Google tag does not forward arbitrary dataLayer ecommerce objects.

The live website currently emits commerce events. A browser check on 11 November
2026 observed add_to_cart with SKU TFW-005-100G, quantity 1, value 30, currency INR,
plus product list impressions. The GA4 collection request for these events was
absent. Composio's GA4 Realtime API returned only page_view, scroll and
session_start. The site has changed since the earlier version-2 audit; website
tracking fixes are now present in production, deployed through separate work.
This audit did not perform a deployment or publish GTM changes.

## Prepared import

Use **teafloww-gtm-corrected.json**, generated from the user's exact export.
The file preserves the existing real account/container IDs and custom templates.
It adds four native GA4 Event tags targeting G-62FDHK0EQ6 for page_view, the
standard ecommerce funnel, generate_lead and search. Correct native GTM import
fields are measurementIdOverride, eventSettingsTable and getEcommerceDataFrom.
Only the intended production hostnames match these new event triggers.

It also sets the existing Google tag's send_page_view=false to avoid the new
explicit page tag competing with automatic initial pageviews. It pauses the
incorrect duplicate Meta purchase template tag named
“mm Meta Pixel - Purchase - Teafloww”: this tag uses the purchase event ID as the
Meta event name. The existing Custom HTML Purchase tag remains active. Active
Meta tags gain explicit marketing consent requirements. The base is allowed to
initialize once when a visitor grants marketing after initially choosing analytics
only. Meta remains installed and dispatched through GTM, not website pixel calls.

1. Export/back up the current GTM workspace, then open Admin → Import Container
   for GTM-M5G27HSQ and select teafloww-gtm-corrected.json.
2. Choose **Merge**. Review conflicts carefully; overwrite the matching imported
   entities to apply the existing Google/Meta corrections. Preserve unrelated
   new workspace changes. Confirm four new TF GA4 event tags and the paused
   duplicate Meta purchase tag in the import summary.
3. Preview first. After consent, view a product and add it to the cart: verify
   TF GA4 - Ecommerce fires, its measurement ID is G-62FDHK0EQ6, and GA4
   DebugView/Realtime receives view_item/add_to_cart. Verify denied marketing
   prevents Meta, including analytics-only consent followed by a later grant.
4. Disable duplicate enhanced-measurement history pageviews if enabled in GA4,
   then publish the reviewed version. Confirm one GA4 purchase per transaction
   and one Meta standard Purchase with the shared stable event ID using an
   authorized verified test payment; no synthetic purchase was sent here.

The included source-export snapshot is not an assertion that every existing Meta
setting is healthy. Live browser requests for the Meta CAPI helper at jsDelivr
and unpkg were blocked by CSP. No broad CDN allowance was added. Server-side
CAPI, destination configuration and event matching need separate verification.
The supplied v7 export also has no Google Ads conversion/remarketing tags; the
correction does not invent an AW conversion ID or purchase label.

## Validation and access boundary

The GA4 supplement has three passing integration-contract tests covering native
parameter keys, complete ecommerce event matching, variable/trigger references,
consent and production-host restrictions. JSON structure and the corrected
container's references were additionally checked locally. Actual import acceptance,
Tag Assistant firing and receiving-side event delivery still require the reviewed
workspace import/publication. Composio searches in this session returned GA4 and
Ads tools but no GTM workspace/import/publish tools.

Generated with:
`node scripts/patch-gtm-export.mjs source-export.json`

[Google's ecommerce event-tag setup](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce?client_type=gtm)

## Published version 8 follow-up — 11 November 2026

The public container now compiles four native `__gaawe` GA4 event tags with the
correct measurementIdOverride G-62FDHK0EQ6 and ecommerce Data Layer source.
The duplicate Meta purchase template is paused. Tag Assistant's “Unknown Tag
Type” display does not mean the exported tags are unknown to the GTM runtime:
the published runtime identifies them as native GA4 event tags.

Live Chromium verification after publication observed successful HTTP 204
Google Analytics collection requests. Composio GA4 Realtime independently
returned page_view=5, view_item_list=4, add_to_cart=2, select_item=1, view_item=1,
plus scroll and session_start in its rolling window. These values are a snapshot,
not permanent totals. Ecommerce is now reaching GA4; no purchase or successful
lead was fabricated for verification.

The remaining observed console errors are a guest-customer 401 and CSP-blocked
Meta CAPI helper requests to jsDelivr/unpkg. This is separate from the verified
GA4 event flow. Paid-purchase reconciliation, Meta CAPI delivery and Google Ads
retargeting are still not certified by these browser/GA4 checks.

## Meta helper / CAPI / Preview CSP correction — 11 November 2026

The official Meta GTM template requests its CAPI parameter helper from jsDelivr,
then unpkg. Both hosts returned JavaScript successfully (currently version
1.3.3); the production website's script-src policy blocked both requests.
The user's console also identified two blocked CAPI destinations. Both exact
hostnames were independently found in Meta's public signals configuration for
pixel 1128432123376468 and domain teafloww.com before adding them to connect-src.

`src/lib/security.ts` now permits the exact helper script URLs, the current
versioned unpkg redirect, those two exact CAPI origins, and Google's documented
Tag Manager Preview script/style/font sources. It does not grant blanket script
access to jsDelivr/unpkg or blanket connections to cloud.run/on.aws. Production
eval and framing protections are retained. GTM remains the tracker owner.

A temporary localhost HTTP harness served the actual production CSP and loaded
each real remote helper independently. Chromium reported helperLoaded=true,
clientParamBuilder as an object, processAndCollectAllParams as a function, and
zero securitypolicyviolation events for both primary and fallback. Preview icon
fonts/styles also loaded without CSP violations. No pixel events or fabricated
conversions were initialized by this harness. Seven targeted tests passed;
TypeScript and focused ESLint checks passed.

This is a website HTTP-header change, so importing another GTM JSON cannot
activate it. It requires an explicitly authorized website deployment, then a
fresh page load and verification of the live CSP and Meta Events Manager.
Browser policy acceptance is not proof of server-side CAPI ingestion.

The guest `/api/customer/me` 401 is expected when signed out. The logged
`/shop/<product-slug>` 404s are separate obsolete/broken navigation or prefetch
URLs and are not evidence of GA4 failure. Tag Assistant's disconnected Safari
session may also need reconnecting after the styling fix; no assertion of
Safari connection success is made by the Chromium helper tests.

Sources: [official Meta template](https://github.com/facebook/GoogleTagManager-WebTemplate-For-FacebookPixel/blob/main/template.tpl),
[Google Preview CSP requirements](https://developers.google.com/tag-platform/security/guides/csp#preview_mode).

Full-suite follow-up for the CSP correction: 2,931 tests passed across 174 files;
6 PostgreSQL-only tests skipped. The isolated production build passed. Production
HTTP headers remain unchanged until an explicitly authorized deployment.


## Authorized CSP production deployment — 2026-11-11

The user explicitly requested production deployment. Built an isolated release
from the current server source with only `src/lib/security.ts` replaced. The
production build passed. A private candidate on port 3051 passed health and
readiness checks with PostgreSQL before activation. No schema migration ran.

Activated the new `.next` build under the existing TeaFloww PM2 process and
retained `.next-previous-20261111-csp` for rollback. Old static chunks were kept
so already-open pages can continue requesting their assets. The prior security
source is retained in `/www/wwwroot/teafloww-csp-release-20261111/security.ts.rollback`.

The host inherits Nginx proxy caching. Plain URLs initially returned cached old
CSP headers while the origin and a new query URL returned the correction. Backed
up and invalidated 429 cache files whose exact cache key began with
`http://127.0.0.1:3050/`; other applications' caches were untouched. The normal
public `/shop` URL then served the corrected CSP.

Fresh Chromium verification on the normal live shop URL confirmed GTM loads,
the Meta clientParamBuilder helper returns HTTP 200 and initializes as an object,
and a GA4 collection request returns HTTP 204. The only recorded CSP violation
was an eval attempt; production eval remains blocked intentionally. No helper
URL CSP violation remained. Public health and readiness both return HTTP 200,
with PostgreSQL, migrations and environment checks passing.

No GTM configuration was modified during this deployment. These checks do not
prove Meta server-side ingestion, Safari Tag Assistant reconnection, or a paid
purchase. No purchase or real payment was created.
