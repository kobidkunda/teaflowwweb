# Page-by-Page UX Blueprint, Section Content & Copy

## Creative direction

**Editorial concept: 'From leaf to label, one partner.'** Full-bleed editorial tea photography balanced by warm textured surfaces, glass-free floating proof cards, a strong typographic hierarchy and calm business clarity. The goal is *premium and credible*, not luxury for luxury's sake. A first-time founder should grasp all three offers in the first screen, and an experienced trader should locate the trade quote immediately.

## Global shell

- Utility: short location line `Siliguri, West Bengal` and optional language selector, never a location claim more precise than verified.
- Navbar: TeaFloww logo, `Bulk tea`, `Retail packs`, `Own brand`, `How it works`, `FAQ` + primary quote CTA.
- Desktop max content width 1200px, 24px mobile gutters (16px at 320px), section rhythm 72–104px desktop / 48–64px mobile.
- Sticky mobile CTA: primary `Get Quote` + secondary WhatsApp only when number confirmed. Respect safe-area padding.
- Footer: verified business contact, legal policies, existing relevant business tools and transparent freight/T&C statement.

## Page 1: `/start-tea-business`

### 01 Hero — 0–5 seconds comprehension

**Eyebrow:** `SILIGURI TEA BUSINESS PARTNER`  
**H1:** `Your tea business starts here.`  
**Description:** `Explore tea supply, retail pouches, branding and packaging support. Tell us what you want to build—we'll help prepare a suitable business quotation.`  
**Primary CTA:** `Plan My Tea Business` → form  
**Secondary CTA:** `See the 3 Ways to Start` → offer cards  
**Hero photo:** genuine macro tea/pouches + staff or floor scene; right-side photo module with gradient overlays; static image on mobile.

Visual treatment: left dark-ink hero surface with large warm cream headline; 'tea business' one line underlined with thin gold offset and high-contrast; right image framed in 3:4 crop with a matte-dark bottom caption. Use decorative topographic/leaf-line pattern as CSS or SVG generated from brand marks—not stock fake paperwork.

### 02 Audience switch

`I'm just starting` (selected) | `I already sell tea` (navigate to `/tea-traders`). Include one-line explainer per segment and a graceful keyboard focus outline. Mobile: two full-width wide pills, not tiny tabs.

### 03 Three offers — primary decision cards

| Card | H3 | Description | CTA |
|---|---|---|---|
| A | `Buy tea in bulk` | `Explore 25kg sack options and the grades suited to your customers.` | `Explore bulk quote` |
| B | `Sell ready retail packs` | `Explore existing 250g, 500g and 1kg packs for distribution.` | `Explore retail quote` |
| C | `Build your own tea brand` | `Discuss tea selection, artwork, packaging, printing coordination and launch support.` | `Discuss private label` |

No claim of 'zero setup cost' or that the three offers share an identical MOQ.

### 04 Process strip — five steps

1. **Tell us your market** — city, buyer type, intended format.
2. **Choose tea direction** — product type or suggested sampling.
3. **Select the pack** — bulk or retail; private label when required.
4. **Review quotation** — MOQ, tax, freight and scope in writing.
5. **Approve next step** — sample, artwork or confirmed commercial order.

Interactive desktop: five horizontally laid numbered columns with one consistent gold rule. Mobile: vertical timeline, no carousel dependency. No fake progress bar for a real transaction.

### 05 Proof / editorial module

Split section: tea grading, actual packaging and design review photos on one side; text on other. Show `Siliguri-based sourcing`, `Bulk + retail formats`, `Brand and design assistance`. Proof cards need a source/owner, date and caption before release.

### 06 Sample/consultation bridge

A compact `Not ready for a full order?` section. `Tell us what you want to test. We can discuss current sampling options and applicable fees.` CTA `Ask About Samples` → prefill interest=`samples`. **Do not claim free sample, ₹299 matching or 5-day turnaround until signed off.**

### 07 Quote form

Head: `Tell us about your tea business`  
Subhead: `A few details help us assess format, MOQ and delivery. Final terms arrive in a written quote.`  
See form states and API contract in `11_CODE_LEAD_FORM_AND_API.md`.

### 08 FAQ

- Do I need to know tea grades? → Not required for initial discussion; teams can guide sample selection.
- Can I sell under my brand? → Private-label options can be discussed; pricing/MOQ depends on pack and print method.
- What can I order? → 25kg bulk sacks and selected retail sizes; availability confirmed during quote.
- What about marketing? → Scope includes consultation/support; exact deliverables agreed per quote.
- How is shipping calculated? → Destination and total shipment configuration; quote includes freight terms.
- Is there a fixed startup investment? → No universal number; request a proposal based on format and volume.

## Page 2: `/tea-traders`

### 01 Hero — transaction-focused

**Eyebrow:** `TRADE SUPPLY • SILIGURI`  
**H1:** `Source tea. Add your label. Grow your range.`  
**Description:** `Compare bulk 25kg formats, ready retail packs and private-label options. Share your grade, volume and destination for a commercial quotation.`  
**Primary CTA:** `Get Wholesale Quote`  
**Secondary CTA:** `Review Supply Options`

Image: authentic bulk sack / grain cupping juxtaposed with final packaged product. Text aligned left, proof caption on image. Hero must be lighter, more utilitarian than beginner version but use same tokens and spacing.

### 02 Trade specifications strip

`25kg bulk option`, `250g–1kg retail options`, `Custom specification discussion`, `Quotation by destination`. Avoid fixed price unless there is an approved data-driven, timestamped catalogue module.

### 03 Offer cards

Bulk grade + order band; retail pack resale; own-label/contract packing. Each card asks for specific requirements (pack size, expected quantity, delivery pincode).

### 04 What goes into your commercial quote

`Grade / taste profile • pack size • sample protocol • one-time tooling/design costs • MOQ • taxes • freight • dispatch lead time • terms` with an explicit 'subject to confirmation'. These are **quote fields**, not promises.

### 05 Trust proof & trade workflow

Actual cupping/sampling method and label proof checklist. Link existing `/blend-lab` only if landing offer matches current terms. Link `/private-label/studio` as optional advanced path, not required first conversion.

### 06 Trader quote form

Heading `Request a quote for your next tea lot`. Segment is prefilled `trader`. Capture intended quantity band and destination; grade and monthly usage appear as optional progressive fields.

### 07 FAQ

- Which tea grades? → Confirm by current catalogue/specification with sales.
- Is matching available? → Evaluation can be discussed, results/scope to be confirmed.
- Is a private label possible? → Yes as a commercial service subject to artwork, minimums and fees.
- How does freight affect rate? → Written landed quote based on destination, weight and payment/return arrangements.
- Can we reorder the same profile? → Discuss agreed specifications and sample approval; don't guarantee identical future lots.

## Optional support pages (phase 2)

- `/business/quote/[reference]`: authenticated/expiring status view, no PII in public URLs.
- `/business/samples`: documented sample options and fee/approval matrix.
- `/business/brand-process`: detailed artwork proof, label inputs, print methods, ownership and revision limits.
- `/business/resources/tea-grades`: SEO guide for BP, OF, PD selection, no made-up grades/estate claims.

## Universal content model

```ts
export type Segment = 'starter' | 'trader';
export type OfferId = 'bulk_supply' | 'ready_retail' | 'private_label';

export type LandingContent = {
  segment: Segment;
  hero: { eyebrow: string; title: string; body: string; imageAlt: string };
  cta: { label: string; href: string };
  cards: Array<{ id: OfferId; title: string; body: string; cta: string }>;
  steps: Array<{ title: string; body: string }>;
  faq: Array<{ question: string; answer: string }>;
};
```

The content adapts, but components remain the same. Product and service details eventually come from an approved API/content repository and translation keys rather than forked JSX.
