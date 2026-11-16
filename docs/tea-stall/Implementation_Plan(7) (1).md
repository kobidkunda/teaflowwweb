# TeaFloww Trade · Implementation plan
**Build target** A mobile buying journey at `/tea-shops` for an Indian tea-shop owner who wants to test a blend, understand its delivered cost, or replenish stock. **Handoff date** 17 November 2026, India.

Start with one transaction a shop owner can complete confidently. They open a Bengali ad, recognise the language, see a sample they can brew in their own milk, enter a PIN, and learn exactly what they would pay and where they would receive it. An experienced buyer can jump from the same hero directly to a bulk quote.

## 1 · Decisions from the three briefs

| Question | Build decision | Commercial or design consequence |
|---|---|---|
| Which URL belongs on an ad or QR? | Use `/tea-shops/{locale}`. The neutral `/tea-shops` opens the picker for a first visit. Deep links such as `/tea-shops/bn?blend=everyday-strong-milk-chai` carry a valid selection. | Give every reviewed language a shareable page. If the alternate `/for-tea-shops` path has already circulated, redirect it and preserve campaign parameters. |
| Five or nine languages? | Launch English, Bengali, Hindi, Gujarati and Marathi as each completes review through confirmation. Stage Punjabi, Tamil and Telugu next. Prioritise Kannada and other scripts using enquiries and serviceable demand. | The prototype demonstrates the full core flow in English and Bengali. Ship a language when a buyer can finish in it. |
| Video or fast first paint? | Reserve a static hero image. Offer a captioned 15-second real brew film on tap, plus an independent listen control. | A shared Android phone on a slow connection can buy with all media unopened. The template uses an illustrative pour for composition. |
| Which trial price and contents? | Choose one published trial in admin. Resolve kit title, included blends, grams, cover image, availability, parcel rate and optional credit there. | The repository's TrialService currently validates four 50 g components. A proposed four-by-25 g kit needs an intentional service/schema change. Neither the example ₹200 nor the other offers in the briefs is a launch default. |
| Which bulk order to feature? | Feature an eligible 25 kg pack where the buyer can use that much tea. Let them price smaller quantities on equal terms. Mix-and-match and a capacity indicator are a follow-on. | A 30 kg net order plus carton may cross a 30 kg billed slab. A 35 kg catalogue variant can remain available for a separate quote. |
| What makes a buyer act now? | Compare full cash outlay and freight per kg, display measured per-glass cost, or show a real dispatch deadline/credit. | Render each claim only from the accepted route, the owner's inputs or a dated admin record. |
| What if the carrier cannot confirm a price? | Keep the selected pack, quantity, preferred language and PIN. Offer a reviewable WhatsApp draft or callback request. | A genuine enquiry has its own status and can be converted into a quote by operations. |

### Catalogue evidence

On 17 November the connected catalogue returned four products: Everyday Strong Milk Chai (47), Elaichi Tea (48), Ginger Tea (49) and Masala Tea (50). At that read, each had 5/10/25/35 kg variants priced at ₹1,300/₹2,500/₹5,750/₹7,700 before any applicable quantity rules. Product 47's 25 kg variant was ID 253, weighed 25,000 g, and had a price of 575,000 paise. The previously discussed unified price list differs. Merchandising should reconcile the intended prices in admin before sending traffic. The template uses a dated subset to make the design review reproducible. The production page resolves every line again.

## 2 · Delivery sequence and ownership

Planning estimate for one frontend engineer, one commerce engineer and part-time design, QA and operations. Elapsed times assume access to the existing integration environment. Carrier approval, recording, and native copy review have independent lead times.

| Milestone | Parallel work and dependency | Exit evidence |
|---|---|---|
| M0 · Audit and rate evidence · 2–3 working days | Operations weighs a packed kit, 5, 25 and mixed 30 kg; records volumetric dimensions, contract, PIN coverage, depot, fees, tax inclusivity, COD limits and settlement. Engineering traces catalogue → quote → order and one successful test payment. Design recruits shop owners for language checks. | Versioned pilot lane sheet, trial ID, content owners, existing checkout extension points and unresolved fields. Unconfirmed lanes may open for enquiries. |
| M1 · Shell, components and content · 3–5 days | Begin after audit of current layouts. Build shared controls, dictionaries, trade shell, image crops and audio manifests. Connect admin product/trial projections. Freight team can develop against fixtures. | Localised ad link → correct product; first visit → picker; trial, loading, empty and retired pack states accepted at 360 px. |
| M2 · Quote and handover · 4–6 days | Needs M0's pilot data and M1's variant contract. Implement server packer, provider/manual lanes, quote snapshot, accessible price receipt and enquiry queue. | One eligible shop delivery, one named depot, one unsupported route, one over-slab order and one changed price all produce the expected action. |
| M3 · Checkout and measurement · 4–6 days | Extend existing payment/reservation flow after quote contract stabilises. Add event mapping, operations review and native checkout copy. | Sandbox payment, advance, failure, expiry, double submission, refund and fulfilment reconciliation linked to the same order. |
| M4 · Pilot and release · 2–4 days plus observation | Enable reviewed locales and operational lanes behind flags. Use one local Bengali lane and one confirmed out-of-state lane if available. Review real phones, captions, depot directions and support scripts. | Support can recover an enquiry and reconcile delivered orders. Expand only after reviewing freight charged vs invoiced and actual delivery outcomes. |
| Follow-on | Add cup economics, demand recommendation, authenticated reorder/QR, and credit. Pilot group loads manually before automating mixed boxes, reminders or shared dispatch. | Each subsequent feature has its own acceptance ticket and independent rollback. The visual template includes the calculator early for design review. |

**Critical path.** Approved trial and lane data → server quote → checkout revalidation → verified payment/order status → pilot. Design, translation and media production can proceed with labelled fixtures while a carrier quote is pending.

## 3 · Existing code to reuse

The public default branch reviewed uses Next.js App Router, React, TypeScript, Zod, Vitest and Playwright. These are repository observations. A deployed integration's readiness must be verified in the target environment.

| Existing reference | How the trade implementation should use it |
|---|---|
| [Root layout](https://github.com/kobidkunda/teaflowwweb/blob/main/src/app/layout.tsx) and [StorefrontShell](https://github.com/kobidkunda/teaflowwweb/blob/main/src/components/StorefrontShell.tsx) | The root loads retail navigation and announcement data; the shell wraps non-admin routes in retail providers and chrome. Extend the shell boundary for the exact trade segment and descendants. Keep root consent/analytics once. Profile the root data reads; move retail-only reads under the retail layout if they consume the trade budget. |
| [Product page](https://github.com/kobidkunda/teaflowwweb/blob/main/src/app/tea/%5Bslug%5D/page.tsx), [product queries](https://github.com/kobidkunda/teaflowwweb/blob/main/src/lib/products.ts) and [pack formatter](https://github.com/kobidkunda/teaflowwweb/blob/main/src/lib/packSize.ts) | Reuse canonical variants, stock, imagery and publication checks. Read grams for each button. Keep a channel assignment list of product IDs and sort order only. Use the existing admin-backed server queries from the page; MCP is a management/reference surface. |
| [Trials page](https://github.com/kobidkunda/teaflowwweb/blob/main/src/app/trials/page.tsx) and [TrialService](https://github.com/kobidkunda/teaflowwweb/blob/main/src/lib/trials/service.ts) | Read the public trial projection and its component list. A trial remains a trial. A trade offer points to its published ID and revision. |
| [Checkout](https://github.com/kobidkunda/teaflowwweb/blob/main/src/app/checkout/page.tsx), [LiveCheckout](https://github.com/kobidkunda/teaflowwweb/blob/main/src/components/international/LiveCheckout.tsx) and [commerce operations](https://github.com/kobidkunda/teaflowwweb/blob/main/docs/INTERNATIONAL_COMMERCE.md) | Reuse the gateway, order reservation, payment state and fulfilment operations. LiveCheckout already models quote expiry and wholesale advance/balance. Extract shared hooks/models as needed; a trade receipt adds handover and route policy. Map a freight-only advance explicitly if current wholesale configuration uses percentages. |
| [Money formatter](https://github.com/kobidkunda/teaflowwweb/blob/main/src/lib/international/money.ts), [shared styles](https://github.com/kobidkunda/teaflowwweb/blob/main/src/app/globals.css), [package scripts](https://github.com/kobidkunda/teaflowwweb/blob/main/package.json) | Use minor-unit money, locale-aware display, the existing serif/sans direction, scoped variables, and existing check/e2e commands. |

### Proposed file structure

Paths below are additions or extensions. Match naming to the checked-out revision during M0.

```text
src/app/tea-shops/
  page.tsx                        neutral entry, language choice
  [locale]/layout.tsx             TradeShell, trade-scoped locale, theme and skip link
  [locale]/page.tsx               server-composed hero, trial, quote and support
  [locale]/checkout/page.tsx      accepted quote review and payment
  [locale]/orders/[id]/page.tsx   access-controlled confirmation and reorder
src/app/api/trade/
  quote/route.ts                  validated request → QuoteResult
  enquiries/route.ts              idempotent callback or manual transport lead
src/components/trade/
  ui/                             Button, LanguageSheet, AudioButton, ChoiceGroup,
                                  PinField, QuantityStepper, InlineStatus, PriceReceipt
  TradeShell.tsx                  header, content container, single sticky action
  TrialOffer.tsx                  same PinField and PriceReceipt as bulk
  BulkQuoteForm.tsx               selected lines, delivery and payment preference
  TradeCheckoutReview.tsx         same PriceReceipt; gateway action adapter
  CupCalculator.tsx               two instances of BatchFields, one shared formula
  trade.module.css                scoped shared tokens and component states
src/lib/trade/
  catalogue.ts                    public product and trial projections
  packing.ts                      net, tare, parcel split, volumetric policy
  quotes.ts                       lane eligibility, prices, expiry, snapshots
  contracts.ts                    Zod schemas and discriminated result types
  calculator.ts                   leaf cost and consumption formulae
  analytics.ts                    canonical events and attribution adapter
src/app/admin/trade/              assignments, lane versions, content, enquiry queue
scripts/                          additive migration using existing migration runner
tests/unit/                       pricing, quote transitions, locale and expiry cases
tests/e2e/                        deep link → trial/bulk → review → confirmation
```

Use a server page to fetch the minimal translated offer set once. Send the browser only public fields and the selected language. The picker, audio control, form, calculator and sticky action are small client components. Put a trade draft in its own scope so a retail cart cannot silently gain the trade freight rule. Connect the existing checkout boundary to a server-owned trade quote ID.

## 4 · Data ownership and contracts

| Record | Minimum persisted fields | Writer and invalidation |
|---|---|---|
| Trade offer | Channel, product or trial reference, featured order, eligible variant IDs, start/end, publication state | Merchandising. Hide unpublished or retired references. Missing trial → render bulk and help. |
| Localised content | Resource ID, locale, source revision, text, recording, transcript, review status | Translation editor. Source changes invalidate review where meaning changed. Keep commercial numbers as formatted variables. |
| Packaging/lane | Origin, eligible PIN/range, service, dates, billed-weight/rounding rule, carton/tare, dimensions, net capacity, transport/depot, last-mile charge, taxes, COD/advance, price version | Operations. Keep historical versions immutable for accepted orders. Blank pack/policy data → manual quote. |
| Trade quote | Opaque ID, channel, line snapshots, pricing/rule versions, locale, service, destination, weight, fee breakdown, payment schedule, expiry | Server. Selection, address, service, method or offer changes trigger re-quote. Reject stale snapshots at order creation. |
| Enquiry & order | Separate enquiry ID and states; optional converted quote ID. Existing commerce order links to accepted quote, order access token, gateway/reservation and fulfilment | Support records consent and follow-up. Finance reconciles captures, returns and COD remittance; record order-level adjustment history. |

Proposed interface for a bulk quote (a trial request carries a trial ID and quantity instead). The client supplies intent, while the server supplies weight, eligibility, stock and money.

```ts
type BulkQuoteRequest = {
  channel: "trade"
  locale: "en" | "bn" | "hi" | "gu" | "mr"
  destinationPin: string
  lines: Array<{ variantId: number; quantity: number }>
  payment: "prepaid" | "cod" | "freight_advance"
}
type Handover =
  | { kind: "doorstep"; locality: string }
  | { kind: "depot"; name: string; address: string; onwardIncluded: boolean }
type QuoteResult =
  | { kind: "confirmed"; id: string; expiresAt: string; handover: Handover;
      netGrams: number; billedGrams: number; currency: "INR";
      goodsPaise: number; freightPaise: number; extraTaxPaise: number;
      otherFeesPaise: number; creditPaise: number; totalPaise: number;
      dueNowPaise: number; dueLaterPaise: number; etaLabel?: string }
  | { kind: "manual"; enquiryDraft: string }
  | { kind: "unavailable"; alternatives: Array<"prepaid" | "pickup"> }
  | { kind: "temporarily_unavailable"; retryable: true }
```

**Reference request.** `POST /api/trade/quote` with `{"channel":"trade","locale":"bn","destinationPin":"734001","lines":[{"variantId":253,"quantity":1}],"payment":"prepaid"}`. Validate six-digit Indian PIN, integer quantities, canonical IDs and published status. For production resolve the destination against the approved carrier or manual lane table. The PIN used in the template is only a scenario.

**Server calculation.** Resolve per-SKU quantities and eligible tiers; sum line prices in paise. Use the lane's packing and rounding rule for each parcel. If it bills the greater of gross and dimensional weight, compute both using its contracted divisor and units. Sum eligible parcel charges, COD fees, incremental tax and known handling exactly once. Subtract applicable credits once. Show shop or depot total with the precise handover label. Divide all-in paise by net tea kilograms for the display rate. The invariant is `dueNow + dueLater = total`; a carrier charge collected at the depot belongs in the payment schedule when known. Unknown mandatory charges lead to a manual quote.

| Acceptance fixture, all illustrative | Expected behaviour |
|---|---|
| 5 kg at ₹1,300 plus ₹900; 25 kg at ₹5,750 plus ₹900, same confirmed lane, all charges included | ₹2,200 / ₹440 per kg versus ₹6,650 / ₹266 per kg. Freight alone falls from ₹180/kg to ₹36/kg. Show both cash totals. |
| 25 kg at ₹5,750; approved ₹990 total transport including COD; policy collects freight in advance | Total ₹6,740 or ₹269.60/kg. ₹990 now + ₹5,750 at handover. Requote if COD is unavailable. |
| 25 + 5 kg mixed, 0.6 kg test packaging and 30 kg billed limit | Gross 30.6 kg before dimensional check. Fetch next slab or ask for a quote. A capacity bar reflects packed capacity. |
| 25 kg to depot for ₹6,650 with unknown onward travel chosen by buyer | Label ₹266/kg to the depot. Display collection address and identify buyer-arranged onward transport. |
| Unserviceable, timeout, or already expired | Show separate unsupported, retry or refresh state. Keep selections. A returned error amount of zero cannot create an order. |

**Concurrency and recovery.** Sequence or abort quote requests and discard stale responses. At submit, compare versions, recheck stock, address, credit and route, then write order, quote binding and reservation atomically. Preserve a stable idempotency key on retries. An accepted quote belongs to its customer/session. Reuse the gateway's signed verification and deduplication procedures. If the connection drops after a payment attempt, recover by order ID and show pending until reconciled. Release timed-out reservations and credits idempotently. Expose the supplier or operator action when a paid order cannot be dispatched.

## 5 · Commercial operation and measurement

- **Admin setup.** Assign trial and trade blends, edit pack eligibility and lane tables, preview example PINs, review translations/recordings and check the due-now/later breakdown. Give support a callback queue with locale, PIN, preferred hours and status. Resolve business contact, policy, dispatch and depot details from approved settings.
- **Funnel.** Track language selection, trial viewed, brew played, quote requested, confirmed/manual/unserviceable, checkout started, verified order and delivered order. Map product/variant IDs consistently to the chosen feed convention. Use one transaction ID across retries. Consent-aware attribution retains source, medium, campaign, term and content through locale selection and checkout. A click to WhatsApp is an assisted-intent event; only a submitted enquiry enters the lead count.
- **Purchase policy.** For prepaid use verified capture. For an approved partial-COD order use the business-approved confirmed-order milestone after verified advance; send the agreed merchandise value once and record advance, balance and later remittance separately. Define full COD eligibility and event milestone with finance. A failed, pending or cancelled attempt never becomes a verified sale. Reconcile refunds and returns in the fulfilment ledger.
- **Success measures.** Quote completion = confirmed quotes / unique quote attempts. Trial-to-bulk conversion = delivered trial buyers who place a first delivered bulk order within the agreed window / eligible delivered trial cohort. Track contribution per delivered customer as net realised revenue excluding tax minus tea cost, packaging, freight, payment/COD fees, allocated acquisition and RTO losses, divided by distinct delivered customers. Track depot vs doorstep, locale, prepaid share, freight per delivered kg, refusal/RTO and 30-day repeat. Suppress customer contact fields from analytics.
- **Fallback and rollout.** Feature flags by channel, locale and lane. If a lane becomes unreliable, switch it to manual, honour or resolve paid orders through operations and preserve snapshots. If a language loses reviewed critical copy, keep issued order links readable, pause new traffic in that locale and route to assisted support. Rollback the trade UI separately from additive order data.

## 6 · References and provenance

**Uploaded inputs.** “Pasted text(20261116-202305).txt”, §§1–7, sets the practical reading order, receipt, depot disclosure and sticky action. “Pasted text (2)(4).txt”, §§1–9, supplies commercial paths, voice, admin, metrics and rollout. “Pasted text (3)(3).txt”, §§1–5 and the flow diagram, supplies mixed-box, capacity, partial-COD and tracking cases. Conflicts are resolved explicitly in §1.

**Implementation sources.** Repository links in §3 refer to the default branch inspected on the handoff date. The dated catalogue snapshot came from TeaFloww `store.listProducts`. No contracted lane, payment status or final trial offer was verified by these reads.

**Standards for acceptance.** Measure field LCP, INP and CLS at the 75th percentile. Implement equivalent localised pages with reciprocal alternates. Follow modal focus and keyboard behaviour. Validate ecommerce transaction IDs and item semantics against GA4 documentation. [Core Web Vitals](https://web.dev/articles/vitals) · [Localised URLs](https://developers.google.com/search/docs/specialty/international/localized-versions) · [Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) · [GA4 ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce)

**Template media.** The pour is original generated concept art. The trial photograph-style composition is the existing [TeaFloww discovery-shelf asset](https://github.com/kobidkunda/teaflowwweb/blob/main/public/images/trials/discovery-shelf-hero.webp). Replace illustrative media with the approved product's own kit and measured brew before making product-performance claims.

## 7 · Shared-component implementation example

A pack change first makes the current quote ineligible for checkout. A refreshed quote then controls the receipt, mobile action, checkout and spoken read-back. Implement that transition once in the trade quote hook. For the UI, pass one immutable view model through to each surface. This composition illustrates proposed components.

```tsx
type ConfirmedQuote = Extract<QuoteResult, { kind: "confirmed" }>

type QuotePanelProps = Readonly<{
  quote: ConfirmedQuote
  locale: TradeLocale
  onContinue: (quoteId: string) => void
}>

export function ConfirmedQuotePanel({
  quote, locale, onContinue,
}: QuotePanelProps) {
  return (
    <section aria-labelledby="quote-heading">
      <TradeHeading id="quote-heading" message="quote.heading" />
      <PriceReceipt quote={quote} locale={locale} />
      <AudioButton script={buildQuoteReadback(quote, locale)} />
      <ActionButton onClick={() => onContinue(quote.id)}>
        <TradeMessage id="quote.reviewPack" />
      </ActionButton>
    </section>
  )
}
```

The checkout uses the same `PriceReceipt` with the server-revalidated model. Only the action changes from reviewing the pack to paying the exact amount due or placing an eligible COD order. A manual result uses `InlineStatus` and the assisted enquiry action. The type boundary prevents an incomplete quote from being passed to the confirmed receipt.

**Localisation contract.** Keep UI dictionary keys stable, separate from admin product translations. Example keys are `quote.handover.depot`, `quote.payNow`, `quote.balanceAtCollection` and `enquiry.requestTransport`. Store full sentences with named placeholders so translators can reorder PIN, units and money naturally. A locale switch reloads those labels around the same canonical lines. Give each localised route a self-canonical, reciprocal reviewed alternates, an x-default neutral selector and the correct document language. Store shared-phone preference only for the trade channel.

**Sizing rules.** In the production template use one column below 760 px; on wider screens align the selector and receipt side by side. A mobile sticky action appears only for the current buying decision. Sheet open, editable field focused, or keyboard visible hides it. Use a full-width safe-area inset and restore focus to the trigger on close. At narrow widths a price, handover address or translated button can grow vertically. Production recordings may explain static controls. For variable totals, read back the accepted quote using verified locale-aware speech or offer a text transcript if accurate playback is unavailable.

**How to review the supplied HTML.** Open it locally, choose English or বাংলা, and use the sample PINs printed on the form. With one 25 kg pack, 734001 demonstrates doorstep, 700001 demonstrates depot, and another valid PIN demonstrates manual assistance. Increase the quantity to two packs to see the over-slab result. Compare 5 and 25 kg on one eligible route. Check a sample parcel, edit a WhatsApp draft, try the brew guide and enter real batch measurements in the calculator. Static template data, generated hero artwork and device-dependent speech are design aids. Live providers, payment, reviewed recordings, the remaining three translations and real-device validation are implementation tasks.
