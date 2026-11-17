# Tea Traders — selected visual option 2

The source is the **second displayed** generated concept (Leaf to Business),
selected on 17 November 2026. It is a design mock, not a browser screenshot.
`production-before.png` is a real capture of the original production page.

The implementation retains its split hero, editorial typography, audience paths,
forest purchase guidance and compact quote form. The user explicitly requested
backend product images: all hero, shelf and guidance photographs therefore come
from live published/enabled catalogue products, rather than the concept's generated
pouches. The additional catalogue shelf implements the user's direct-buy request.
No newly generated packaging is substituted for a catalogue photograph.

## Editing

- `/admin/business` → **Tea Traders · Slider & Shop**: choose/reorder up to eight
  hero slides and twelve featured products, choose the guidance image product,
  and edit all public page copy and SEO. Empty slide/product arrays enable live
  catalogue selection (first three products with photos / first six products).
- `/admin/products`: upload and assign the primary/gallery/SKU photographs. Slider
  images follow their selected product's primary image automatically; product
  cards use existing SKU/format image selection. Prices/stock remain catalogue owned.
- `GET / PUT /api/admin/business/traders`: the same complete presentation document.
  Cookie-session auth, rate limiting, origin check, bounded JSON, Zod validation,
  safe errors, parameterized persistence and published/enabled-product validation.
- MCP `business.getTradersPage` / `business.saveTradersPage` (`{content: document}`):
  the same canonical reader/writer, plus underscore aliases.
- `/admin/translations`: select **Tea Traders · page, slider & enquiry** (resource
  `tea-traders`). Every copy field and explicit slide title/body is included.
  Draft, review and publish using the existing GUI/API or `translations.update`
  and `translations.publish`. English fallback applies to missing/stale translations;
  English source changes require reviewing and republishing translations.
  Product names use their own existing `product:<id>` translation resources.
- `/admin/responses` → Bulk orders: includes `business:<id>` leads with reference,
  contact, requirements, locale, consent and attribution in their private payload,
  plus a link to `/admin/business` for the commercial lead lifecycle.

## Commerce and operations

Buy now uses the existing direct-purchase cart for the exact selected variant and
opens guest checkout; Add to
bag keeps the buyer on the page. Stock/price authorizations and verified payment
confirmation remain owned by existing server quote/payment/webhook services.
WhatsApp opens a draft conversation; only a successful enquiry form submission
creates a saved reference. No messages, payments or orders were sent/created in QA.

Presentation JSON uses the existing `store_settings` table under
`tea_traders_presentation_v1`; no schema migration is required. Deployment remains
explicit. Back up the setting/current database before production rollout, using
existing backup/restore procedures. Rollback restores the prior build and setting.

## Verification

See root `design-qa.md` and `docs/TESTING.md` for executed checks and visual evidence.
Browser enquiry QA used clearly marked local fixtures and removed them afterwards.


## Hindi translation follow-up — 2026-11-17

`?lang=hi` now has complete starter translations for all 84 page-copy fields,
including SEO, carousel controls, purchase controls, form states and FAQs.
`traderCopy.json` is the shared English source; `traderHindi.json` contains the
Hindi starter. Defaults apply only when the current source matches that English
text, including configured slides using the same copy. Custom admin copy needs
its own reviewed translation. A current published Translation Studio value takes
priority; unchanged starter fields fill partial Hindi publications. Stale admin
publications are not applied.

Edit at `/admin/translations?search=tea-traders`, select Hindi, open
**Tea Traders · page, slider & enquiry**, edit and Publish. The same resource
works through existing translation API/MCP operations and all supported locales.
Hindi starter values prefill the editor without replacing saved draft edits.
Product names/details remain separate `product:<id>` translation resources;
backend support hours remain the configured business value.

`node scripts/seed-tea-traders-hindi.mjs` creates the initial local SQLite Hindi
record only when no record exists. It never overwrites an admin draft/publication;
it rejects PostgreSQL mode. Production publication uses the authenticated admin,
API or MCP workflow after deployment is explicitly requested. No schema change.

Verified seven Tea Traders tests plus 22 shared translation regression tests,
scoped ESLint, and real desktop/mobile Hindi browser rendering. Evidence:
`hindi-desktop.png`, `hindi-mobile.png`, `hindi-hero.png` (real screenshot crop).
