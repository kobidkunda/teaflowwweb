# Shared Component Library & Implementation Contracts

## Principle

Build components **once**, supply typed data, preserve one visual grammar. `BusinessHero` is not `StarterHero` plus `TraderHero` copies; it receives `hero` and `segment`. `OfferGrid` renders a typed list of `OfferCard`. Components should be accessible, fast, pure where possible and testable without an ad platform.

## Component dependency graph

```text
BusinessPageShell
├── BusinessHeader
│   ├── BrandLink
│   ├── LanguageSelector
│   └── ActionLink
├── BusinessHero
│   ├── Eyebrow
│   ├── SectionHeading
│   ├── ActionLink
│   └── HeroMedia (static first)
├── AudienceSwitch
├── OfferGrid
│   └── OfferCard × N
├── ProcessTimeline
│   └── ProcessStep × N
├── ProofGallery
│   ├── ProofPhoto
│   └── SourceCaption
├── QuoteLeadSection
│   ├── SectionHeading
│   ├── BusinessLeadForm
│   │   ├── FormField
│   │   ├── SelectField
│   │   ├── ConsentField
│   │   └── SubmitButton
│   └── LeadSuccess
├── FaqAccordion
│   └── FaqItem × N
├── StickyLeadBar
└── BusinessFooter
```

## Props/contracts

| Component | Props | Invariants |
|---|---|---|
| `BusinessPageShell` | `children`, `locale`, `segment` | One HTML landmark of each type, no duplicate global nav |
| `BusinessHeader` | `navItems`, `locale`, `quoteHref` | Sticky on desktop optional, never eclipses anchor |
| `BusinessHero` | `eyebrow`, `title`, `body`, `image`, `cta`, `tone` | One H1; image alt source verified; static for LCP |
| `AudienceSwitch` | `segment`, `locale`, `routes` | Navigates real URLs, semantic anchors |
| `OfferCard` | `offer`, `isSelected`, `onSelect` | Selected state indicated by text and border; no arbitrary color |
| `OfferGrid` | `offers`, `onSelect` | Data-driven; count-independent responsive grid |
| `ProcessTimeline` | `steps` | Always `<ol>` semantic order |
| `ProofGallery` | `items`, `caption` | No fabricated facility claims; permission record |
| `FaqAccordion` | `items` | `<details>` or accessible disclosure; semantics preserved |
| `BusinessLeadForm` | `segment`, `selectedOffer?`, `campaignContext?` | Validation on both client/server; no success before commit |
| `LeadSuccess` | `reference`, `whatsAppUrl?` | Reference never embeds phone or PII |
| `StickyLeadBar` | `quoteHref`, `whatsappHref?` | Hides when form focused/overlapping; respects safe area |
| `PriceQuoteNotice` | `text`, `lastReviewed` | Quote is not a promise until issued |
| `LanguageSelector` | `locale`, `hrefByLocale` | Avoid forced modal; stable form state on change |
| `SourceCaption` | `source`, `approvedAt?` | Only approved real-world proof |

## Shared primitives

- `Container` — max-width + horizontal padding.
- `Section` — vertical spacing and warm/dark background variants.
- `SectionHeading` — eyebrow, title, summary with `h2` default.
- `ButtonLink` — anchor semantics for navigation; uses brand variants.
- `Button` — actions only; supports `loading`, `disabled`, `aria-label`.
- `SurfaceCard` — radius, border, shadow; no business-specific logic.
- `FormField` — ID, label, hint/error with ARIA.
- `StatusMessage` — `role=status` on success; `role=alert` on error.
- `ResponsiveMedia` — intrinsic dimensions, lazy defaults, object position.

## Architecture boundaries

**Presentational:** Hero, offer cards, FAQ, sections; no network, no tracking.  
**Stateful UI:** Quote form, segment switch only when necessary.  
**Domain:** offer mapping, payload validation, lead scoring, quote states.  
**Infrastructure:** DB, CRM adapter, analytics adapters, notifications.  
**Content:** localized copy and image metadata independent of UI.

## Shared token ownership

The CSS token file is the single styling source. Avoid `bg-[#063B2F]` scattered across components. Use semantic classes (`bg-brand-forest`, `text-brand-ink`, `border-brand-line`) mapped from Tailwind `@theme` tokens. Component-local `className` is allowed only for spacing/layout differences, not duplicate palettes.

## Data-driven content example

```ts
const offerCatalog = [
  {
    id: 'bulk_supply',
    titleKey: 'offers.bulk.title',
    bodyKey: 'offers.bulk.body',
    image: { src: '/images/business/real-bulk-tea.webp', altKey: 'images.bulk.alt' },
  },
  {
    id: 'ready_retail',
    titleKey: 'offers.retail.title',
    bodyKey: 'offers.retail.body',
    image: { src: '/images/business/real-retail-packs.webp', altKey: 'images.retail.alt' },
  },
  {
    id: 'private_label',
    titleKey: 'offers.brand.title',
    bodyKey: 'offers.brand.body',
    image: { src: '/images/business/approved-brand-example.webp', altKey: 'images.brand.alt' },
  },
] as const;
```

These asset paths are **design placeholders**. Do not deploy broken `<Image>` URLs until authentic media is supplied. Placeholders are not permission to fabricate proof.

## Component QA matrix

| Test | Expected |
|---|---|
| Keyboard navigate | All links, selections, form fields and FAQ reachable |
| Screen reader | One H1; proper labels and error descriptions |
| 200% zoom | No clipped cards, button text or horizontal scroll |
| Reduced motion | No transform animation causing distraction |
| Missing optional WhatsApp | Form and layout still complete |
| Missing hero photo | Background fallback with no CLS |
| One offer vs three offers | Grid adapts, no duplicated structural markup |
| Hindi translation longer than English | Heading and CTAs wrap, height grows naturally |
| Submit twice | Only one record and one external conversion |
