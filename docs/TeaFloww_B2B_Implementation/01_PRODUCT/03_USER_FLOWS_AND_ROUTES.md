# Routes, Information Architecture & Complete User Journeys

## Information architecture

```text
Teafloww website (existing)
├── /                              Consumer storefront (unchanged)
├── /shop                          Existing consumer products (unchanged)
├── /wholesale                     Existing wholesale (link into business journey)
├── /private-label                 Existing private-label overview
├── /private-label/studio          Advanced configurator (phase 2 link)
├── /blend-lab                     Existing service (confirm commercial terms)
├── /start-tea-business            NEW starter funnel
└── /tea-traders                   NEW existing-trader funnel

Cross-cutting:
POST /api/business-leads         NEW lead create contract (use existing backend if available)
GET  /business/thank-you         OPTIONAL no-index confirmation
```

**Do not use programmatically unverified route `/Siliguri/Tea-Business` from the second upload as a live path.** In Google Ads the display path is text, not a requirement that exact route exist; final URL must work.

## Shared route shell

```text
    Brand mark                Our solutions    How it works   Questions    Language
    ────────────────────────────────────────────────────────────────────────────
      Start a tea business   |   I already trade tea   [persist selection in URL]
    ────────────────────────────────────────────────────────────────────────────
      Hero → three solution cards → proof → steps → quote form → FAQ → footer
    ────────────────────────────────────────────────────────────────────────────
      Mobile fixed CTA: [Request quote] / [WhatsApp] (not over form keyboard)
```

## Full starter journey

1. Enter from Meta/Google keyword/organic page with `utm_*` and click ID.
2. See specific hook: 'Start your own tea business' + packs + clear sourcing/branding explanation.
3. Choose format (`bulk 25kg`, `existing retail packs`, `own-brand`) or keep undecided.
4. Scan five-step process: choose tea → choose pack → branding scope → quote/freight → sample/order.
5. View real product examples and FAQ, including 'Can I use my own name?'; all fees subject to quotation.
6. Tap main CTA; form opens/scrolled and preselects offer.
7. Complete stage, interest, quantity band, pincode, name and phone (with explicit enquiry consent).
8. API validates, commits lead idempotently, queues CRM notification; then success state shows lead reference and suggested WhatsApp continuation.
9. CRM assigns rep, confirms MOQ, samples, landed freight and quote; eventual first order logged against lead.

## Full trader journey

1. Enter via trade-specific keyword, partner referral or video.
2. First screen offers `25kg sacks • retail packs • private label` with actual photos, no homepage shopping diversion.
3. Select current monthly volume or target order band, tea grade/taste goal, preferred packs.
4. View specifications and proof links (`/wholesale`, `/blend-lab`), not beginner education wall of text.
5. Request quote; form asks stage=trader, quantity, pincode, phone, optional grade/notes in progressive disclosure.
6. Submit; CRM receives `audience=trader`, required specs, UTM/ad variant and timeline; agent checks serviceability, asks for sample where required, sends written quote.

## Branch logic

| State | Content | CTA | Next |
|---|---|---|---|
| `starter` | Educational steps, proof, simpler trade terms | Get business plan & quote | Starter form |
| `trader` | Grade, continuity, MOQ, landed quote | Get wholesale quote | Trader form |
| `bulk_supply` | 25kg sack capability, freight, sampling | Quote bulk supply | Offer-prefilled form |
| `ready_retail` | TeaFloww retail pouches; possibly resale | Quote retail packs | Offer-prefilled form |
| `private_label` | Label + packaging scope and approvals | Discuss your brand | Form then studio if appropriate |
| `unsure` | Help choose pack and volume | Help me choose | General form |

## State retention

- The page route determines initial segment (`start-tea-business` → starter; `tea-traders` → trader).
- UI switching uses real links to preserve back button and SEO; preserve attribution **only with explicit consent and strict allowlist** where needed.
- Quote button writes selected offer to component state and focuses the form heading/first field; do not scroll and steal keyboard focus unexpectedly.
- On error, retain inputs, show focused error summary and per-field messages.
- On success, never create duplicate lead on second click; reuse returned reference/idempotency key.

## Mobile constraints

- 320px, 360px, 390px, 430px, tablet 768px, desktop 1280px, 1440px widths.
- 44px+ touch buttons; avoid tiny chip-only CTA.
- No forced login, required app install or unclickable floating WhatsApp icon.
- Never trap the user in an audience modal. Suggest language in nonblocking inline switch.
- Dropdown and long fields use native controls where possible.
- Sticky CTA becomes non-sticky while form keyboard/overlay is active if it would hide controls.
- Use optimized still poster with optional click-to-load video, not autoplay video by default.

## Error and empty states

- **Network offline:** Keep typed data; 'Connection lost. Try again when online.' Never falsely mark lead saved.
- **Validation:** Show exact field mistakes and focus summary; don't wipe values.
- **API 429:** 'Too many requests. Please retry shortly or use the contact option.'
- **CRM notification failure after DB commit:** User still sees successful lead ID; retries happen server-side.
- **WhatsApp unavailable/unverified:** Hide chat action; form continues normally.
- **No MOQ approved:** Show 'MOQ and freight are confirmed in quotation'; never hide enquiry form.
- **Lead duplicated:** Respond with same lead ID; show success once.
