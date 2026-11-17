# Tea shops — Counter Ritual redesign

## Pilot discovery refinement — 2026-11-18

Mode: Persuade. Preserve the forest/paper/Georgia visual identity and genuine active collection locations. Public discovery now excludes records explicitly marked E2E, incomplete/inactive locations and duplicate normalized town/point/address combinations. Stored records remain available through unrestricted admin listing; no database rows are deleted or migrated. The public API and server-rendered page share this filtering. This is a safeguard against explicit test markers, not an automatic verification of operator claims.

When genuine locations exist, use a headed, responsive two-column section with a simple ruled location list and one shared collection enquiry action. The action opens the existing consented enquiry flow. English/Hindi copy belongs to the existing trade Translation Studio resource. With no genuine locations, omit the entire section and its spacing. Local records were all E2E fixtures, so the rendered page transitions directly from the calculator to enquiry.

Implemented locally for `/tea-shops/hi`, based on selected option 1 refined to include TeaFloww pouch branding and direct buying. No production deployment was performed. Conversion improvements are hypotheses; no conversion percentage is guaranteed.

## Buying and enquiry journeys

- Trial and bulk buyers check a PIN-based trade estimate, then enter the existing commerce checkout. The checkout revalidates stock, delivery, discounts and payment eligibility server-side. The final total can differ from the trade estimate and is explicitly reviewed before payment.
- Existing Razorpay/Youpi and eligible offline payment flows are reused. Browser callbacks do not mark gateway payments successful; verified webhooks remain authoritative. No real payment was made in verification.
- Enquiries require explicit contact consent and persist before an optional WhatsApp handoff. Idempotency prevents duplicate retries. Leads appear in `/admin/responses` as bulk-order/trade responses and link to `/admin/trade`. Locale and attribution are retained; no customer PII is added to public analytics.
- The page includes live pack prices, a brewing walkthrough, blend comparison, leaf-cost and demand calculators, FAQs and mobile sticky actions. Shared-pilot discovery links to assistance rather than promising a funded shipment.

## Editing through GUI, API and MCP

Use `/admin/trade` for channel settings, catalogue offers, freight lanes and hero/trial media. Media fields provide URL editing, upload and media-library selection. Existing operator-uploaded URLs are preserved. Only empty values or the exact old starter image path receive the new generated default.

Use `/admin/translations`, resource **Tea shops · page, checkout & calculator** (`trade`), for page, form, checkout, calculator, image-alt and disclosure text. Select the language, edit and publish reviewed copy. English editorial overrides are supported for this resource. Product titles/tasting notes use their existing product resources. Published current Studio text overrides legacy reviewed trade localization, which overrides bundled defaults. Draft/stale copies do not appear publicly.

MCP uses the same backing services:

```json
{"name":"trade.updateSettings","arguments":{"hero_image_url":"/uploads/approved-counter.webp","trial_image_url":"/uploads/approved-pouches.webp"}}
{"name":"translations.update","arguments":{"resource":"trade","locale":"hi","texts":{"hero.title":"आपकी दुकान की पसंदीदा कड़क चाय।"}}}
{"name":"translations.publish","arguments":{"resource":"trade","locale":"hi","reviewed":true}}
```

Read the translation first with `translations.get` and use `expected_revision` when publishing concurrent edits. Protected numeric values, brand tokens and markup validation remain enforced. Use the authenticated admin API routes backing these screens for HTTP integrations; public clients must not call administrative mutations.

## Images and evidence

- `public/images/trade/counter-ritual-hero.webp`: 1920×1080, approximately 89 KB.
- `public/images/trade/counter-ritual-pouches.webp`: 1600×650, approximately 78 KB. All four pouches carry TeaFloww branding.
- Both generated images are disclosed as illustrative; the pouches are packaging concepts, not evidence of physical stock or final printed packaging.
- Selected refined source: `/Users/biolastic/.codex/generated_images/01a1e800-71f1-73a0-b4bd-7be72057f8ff/exec-d689007a-3b7a-4205-93e5-f0d36a14d616.png`.
- `desktop-1440.png`, `tablet-768.png`, `mobile-320.png`, `mobile-390.jpg`, `lead-saved-mobile.png` and `admin-translation-published.png` are real local browser captures. `comparison-*.png` pair reference and browser pixels for design review.

Browser verification used temporary SQLite copies with synthetic contact details and outbound notifications disabled. Local fixture catalogue has extra historical seeded products; production catalogue remains operator-controlled. No schema migration is introduced by this redesign; unrelated migrations in the shared checkout belong to separate work.

HTTP integration routes: authenticated `GET /api/admin/international/translations?locale=hi`,
`POST /api/admin/international/translation` with
`{"resource":"trade","locale":"hi","action":"publish","texts":{"hero.title":"…"}}`,
and existing `GET/POST /api/admin/trade` settings actions. Use the application's
normal admin authentication/origin controls; do not embed admin credentials in storefront code.

Final browser verification also submitted `Isolated Ritual Inbox QA` through the
isolated storefront and visibly found reference `ENQ-19703A7F58` in
`/admin/responses`, status `new`, locale `hi` (`admin-responses.png`).

## Brewing image refresh — 2026-11-17

Replaced all four images beneath “One test pan. A clearer decision.” with a
coordinated generated tea-counter series: measure CTC, simmer milk chai, compare
two equal servings, and strain to taste. Each uses TeaFloww-branded kraft packaging.
Files: `public/images/trade/brew-{measure,simmer,compare,strain}-v2.webp`.
Each is 1200×828; approximately 98–168 KB per image. These are illustrative scenes,
not claims about physical packaging or test results. The shared component updates
all `/tea-shops/[locale]` routes. Existing localized headings/recipe copy remain.
Reviewed full source images and browser crops at 1440 desktop and 390 mobile;
all four loaded and mobile scrollWidth matched viewport width. Evidence:
`brew-after-desktop.png`, `brew-after-mobile.png`.

## Artwork captions — 2026-11-18
At the user’s request, removed the visible “AI illustration · packaging concept” caption from the hero and trial artwork. Image assets and illustrative alt descriptions remain unchanged.
