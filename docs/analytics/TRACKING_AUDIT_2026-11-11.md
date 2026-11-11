# TeaFloww tracking audit — 11 November 2026

> Follow-up: the live container is now version 7 and the website emits ecommerce events. See [the current v7 diagnosis and corrected import](GTM_V7_FIX.md); it supersedes the original version-2 production snapshot below.

## Verdict and evidence

The production website loads **GTM-M5G27HSQ**, which loads **G-62FDHK0EQ6**.
The GA4 stream belongs to property **558650387**, stream **16117362094**,
with default URI `https://teafloww.com`. The identifiers match.

The published GTM resource fetched during this audit has version **2** and
exactly **one tag**, a Google tag triggered on initialization. It has no ecommerce
GA4 event tags, Google Ads conversion/remarketing tags, or Meta tag. This finding
concerns the **published** container; an unpublished workspace may differ.

A GA4 Data API report covering `28daysAgo` through `today`, grouped by eventName
and hostName, returned all 10 rows without pagination. It showed:

| Event | teafloww.com events | Users |
|---|---:|---:|
| page_view | 1,047 | 142 |
| session_start | 258 | 142 |
| user_engagement | 246 | 43 |
| scroll | 166 | 12 |
| first_visit | 138 | 138 |
| form_start | 31 | 5 |
| click | 2 | 1 |

`www.teafloww.com` contributed two each of page_view, first_visit and session_start.
There were **no rows** for view_item, add_to_cart, begin_checkout, purchase,
or generate_lead. Absence of purchase alone cannot establish a malfunction
without paid-order reconciliation; absence of all commerce events plus the
missing published event tags demonstrates the tracking configuration gap.

Live browser inspection observed one successful `g/collect` page_view request
(HTTP 204), no `fbq`, no Meta script, and no explicit Google consent defaults
(all four consent entries were implicit). A data-layer push by itself is **not**
evidence that GA4 or an advertising platform received an event.

GA4 key-event definitions currently include purchase, close_convert_lead and
qualify_lead. The website emits neither of the latter two; actual successful
website enquiries now emit generate_lead, with lead_type for segmentation.

The connected Meta account returned zero assigned datasets. The connected Google
Ads customer 2229174178 is named Biolastic. No changes were made to either account,
and no TeaFloww conversion destination was inferred from their presence.
The user confirmed that GTM should own all downstream tracking.

## Local corrections

- One GTM owner: no duplicate direct GA4/Meta/custom tracking injection while
  GTM is enabled. Standalone vendor integrations remain available only when
  GTM is disabled. `gtag('event')` is not called alongside GTM object events.
- Explicit denied Consent Mode defaults run synchronously before vendor loading.
  Basic consent mode loads no optional vendor until a visitor opts in. The UI
  offers essential only, analytics only, accept all, and a persistent settings
  button. All four Google consent signals update; withdrawal gates future app
  events and sends Meta's revoke command if a Meta queue exists.
- Client navigation page views use sanitized locations and referrers. Arbitrary
  query parameters, recovery tokens, order tokens, and private IDs are removed.
  Administrative, account, login, auth, API and order-lookup routes are excluded.
- Real card visibility drives list impressions; card links send select_item.
  Product views, cart additions/removals/quantity deltas, cart views, checkout
  entry, accepted server quotes and accepted payment requests form the funnel.
- Retail and trial cart entries carry SKUs. Old saved carts can resolve current
  catalog SKUs through the optional tracking metadata in the image lookup API.
  Missing retail SKUs use the same HTH-productId-variantId fallback as feeds.
- One purchase source remains: PurchaseStatus after server status equals paid.
  Demo pages, pending/failed payments and unpaid COD do not count as purchases.
  The second confirmation-page tracker previously counted COD and could
  double-count prepaid orders; it has been removed. A central transaction marker
  deduplicates within the current page and across refreshes when storage works.
  Storage failure retains page-memory deduplication but cannot guarantee
  cross-refresh deduplication; destination transaction_id deduplication remains
  necessary. GTM receives a stable `event_id = purchase_<transaction_id>`.
- Server quote analytics allocate discounted merchandise across the actual
  items; GA4 value excludes shipping and tax. New quote documents retain
  analyticsTaxMinor using the quote's original currency conversion. Older
  stored quotes infer their tax conversion from their stored amounts.
- Newsletter server/network errors no longer report a successful signup/lead.
  Successful contact, wholesale, newsletter, cart capture, Blend Lab and
  private-label consultation/quote responses emit generate_lead, never customer
  names, email, phone, street addresses, business name, or form message text.
- CSP now includes Google's documented Ads conversion/remarketing endpoints
  for scripts and connections, including the Indian Google domain. Other
  country-specific Google domains require review if used by the destination.
- Tracking settings tests now use isolated SQLite rather than modifying the
  developer database. Restored carts do not emit false add_to_cart events;
  additions missing an SKU resolve catalog metadata or suppress the event. Browser testing uses a SQLite copy in /tmp.

## Event contract for the GTM workspace

All events clear `ecommerce` immediately before the next event. Every event
has a fresh event_id; purchases use a stable transaction-derived event_id.
Item prices are currency units, not paise. Catalog and bag values use INR;
accepted quotes, payment information and purchases use the server quote's currency.

| Data-layer event | Trigger meaning | Relevant payload | Suggested downstream use |
|---|---|---|---|
| page_view | Initial public page, client route, or first consent | page_location, page_path, page_title, page_referrer | GA4 page view, Meta PageView |
| view_item_list | Card intersects viewport at 50% | ecommerce.items, currency, item_list_name | Discovery analysis |
| select_item | Product link selected | ecommerce.items, item_list_name | Discovery analysis |
| view_item | Product detail | ecommerce.items, value, currency | GA4; Meta ViewContent; product viewers |
| add_to_cart | Addition or positive quantity delta | ecommerce.items, value, currency | GA4; Meta AddToCart; cart audience |
| remove_from_cart | Removal or negative quantity delta | ecommerce.items, value, currency | Cart analysis |
| view_cart | Nonempty bag or changed bag | ecommerce.items, value, currency | Cart analysis |
| begin_checkout | First nonempty checkout entry | ecommerce.items, value, currency | GA4; Meta InitiateCheckout; abandoners |
| add_shipping_info | Accepted server destination quote | ecommerce.items, value, currency, shipping_tier | Checkout analysis |
| add_payment_info | Server accepts payment creation | ecommerce.items, value, currency, payment_type | GA4; Meta AddPaymentInfo |
| purchase | Server-confirmed paid retail order | ecommerce.transaction_id, value, shipping, tax, currency, items; event_id | GA4 key event; Ads purchase; Meta Purchase |
| search | Debounced shop query | search_term | GA4 Search; obvious emails/phone-like terms rejected |
| generate_lead | Successful response from a supported public form | lead_type; allowlisted interest/estimated_volume where applicable | GA4 key event as appropriate; Meta Lead |
| consent_updated | Preference changed | analytics_consent, marketing_consent | Consent-aware tag re-evaluation |

Lead types: newsletter, contact_inquiry, wholesale_inquiry, cart_recovery,
blend_lab_project, private_label_consultation, private_label_quote.
These are different business outcomes; do not make all of them primary bidding
conversions without deciding which are valuable and preventing double counting.

## Required GTM and destination setup — not performed or verified

1. Sign in to GTM and open GTM-M5G27HSQ. The available in-app browser currently
   opens at Google's sign-in screen. No authenticated workspace was accessible.
   Targeted Composio MCP searches returned GA4/Ads tools but no GTM workspace,
   container, tag or trigger tools in this session.
   Export the current container before changing it; use a reviewable workspace.
2. Keep one Google tag for G-62FDHK0EQ6. Explicitly set send_page_view=false.
   Disable GA4 enhanced-measurement history/page-change views, form interaction
   and site-search capture if they would duplicate explicit events or read raw
   URLs/form data. Explicit events provide sanitized page information.
3. Add a GA4 ecommerce event tag with Event Name `{{Event}}`, a Custom Event
   regex for `^(view_item_list|select_item|view_item|add_to_cart|remove_from_cart|view_cart|begin_checkout|add_shipping_info|add_payment_info|purchase)$`,
   and ecommerce data from the data layer. Require analytics_storage consent.
4. Add separate page_view and generate_lead/search GA4 tags with explicit
   allowlisted fields from the contract. Do not attach stale ecommerce values
   to noncommerce tags. Do not enable a generic catch-all event trigger.
   Require analytics_storage; use the correct production hostname allowlist.
5. Configure Google Ads destinations inside GTM using the actual TeaFloww Ads
   conversion ID and label: Google tag/Conversion Linker as applicable, purchase
   conversion using ecommerce.value/currency/transaction_id, and retail dynamic
   remarketing using item_id as the feed product ID. Preserve ad_storage,
   ad_user_data and ad_personalization consent requirements.
6. Choose one primary Google Ads purchase source: direct Ads tag or imported
   GA4 purchase. Keep the alternative secondary, avoiding duplicate bidding
   conversions. Confirm the GA4–Ads link and personalized-advertising settings.
7. Configure Meta inside GTM using the correct dataset, standard-event mappings
   from the table, content_type=product, content_ids from ecommerce.items.item_id,
   contents with id/quantity/item_price, value/currency and stable purchase eventID.
   Require marketing consent; handle both grant and revoke. Disable automatic
   form scraping/advanced matching unless separately reviewed and authorized.
   Do not install the same pixel via direct settings/custom scripts as well.
8. Verify product-feed IDs match each retail SKU exactly; trial SKUs also require
   corresponding catalog entries before claiming dynamic trial retargeting.
   Catalog linking, feed acceptance and all retargeting audiences remain unverified.
9. Create consented audiences: product viewers excluding purchasers; cart
   abandoners excluding purchasers; checkout abandoners excluding purchasers;
   successful relevant leads; purchasers for a separate repeat-purchase strategy.
   Choose audience windows, exclusions and activation in the destination accounts.
   GTM forwarding by itself does not create usable retargeting audiences.
10. Review/publish the GTM container together with an explicitly authorized app
    deployment. Use Tag Assistant to verify consent, one tag per intended event,
    matching SKU/value/currency, no raw private URLs, and no CSP blocks. Verify
    receiving-side GA4 DebugView/Realtime and Meta Test Events independently.
    Reconcile one verified test payment against the order record and GA4/Ads/Meta;
    refresh/back navigation must not add a second purchase. No real test charge
    or production deployment was made during this audit.

## Explicit limitations

Browser measurement cannot guarantee capture of visitors with denied consent,
ad blockers, disabled JavaScript, closed confirmation tabs, or network failure.
There is no durable webhook-to-analytics outbox/CAPI delivery in this change.
Missing confirmation-page visits can still lose purchase measurement. A reliable
server-side extension needs a separately designed consent/attribution record,
transaction idempotency, retries, refund handling, and verified destination secrets.
It must not send raw PII through the browser data layer.

Refunds, paid_exception reconciliation, settled COD, subscriptions, paid Blend Lab
plans and private-label invoice/deposit payments are not silently represented as
retail purchase conversions. Their order/payment definitions need explicit
business-specific mapping and server verification. The implemented lead and retail
funnel contract must not be presented as coverage of every payment system.

Code and local browser tests establish app behavior, not receipt by an unpublished
GTM configuration. Platform setup, publication, live payment reconciliation and
retargeting audience activation remain release gates.

## Reference documentation

- [Google ecommerce data-layer guidance](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce?client_type=gtm)
- [Google consent setup](https://developers.google.com/tag-platform/security/guides/consent)
- [Tag Manager consent APIs](https://developers.google.com/tag-platform/tag-manager/templates/consent-apis)
- [Google Ads and GTM CSP requirements](https://developers.google.com/tag-platform/security/guides/csp)
- [GTM container export/import](https://support.google.com/tagmanager/answer/6106997?hl=en)
