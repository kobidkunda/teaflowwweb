# Detailed Responsive Wireframes & Visual Template

The sketches below are **layout contracts**. They translate to the real shared components in the code documents. They are not claims of current live-site appearance.

## Desktop: first fold — 1440px viewport

```text
╭─────────────────────────────────────────────────────────────────────────────────────────────╮
│ TEAFLOWW                                    Bulk Tea   Your Brand   How It Works    [EN/HI]│
│                                                                                GET QUOTE  → │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│   ┌  SILIGURI · ORIGIN-LED TEA SUPPLY                                                ┐       │
│   │                                                                                  │       │
│   │  Your tea business                 ╭──────────────────────────────╮             │       │
│   │  starts here.                      │                              │             │       │
│   │                                    │       AUTHENTIC PHOTO         │             │       │
│   │  Tea supply, packaging,            │       25kg SACK + POUCH       │             │       │
│   │  branding and practical            │       AMBIENT NATURAL LIGHT    │             │       │
│   │  launch support from Siliguri.     │                              │             │       │
│   │                                    │       [25kg] [250g–1kg]       │             │       │
│   │  [Plan My Tea Business →]          ╰──────────────────────────────╯             │       │
│   │  See the 3 ways to start ↓                                                       │       │
│   │                                                                                  │       │
│   │   ┌ I’m just starting ┐    ┌ I already trade tea ┐                               │       │
│   └──────────────────────────────────────────────────────────────────────────────────┘       │
╰─────────────────────────────────────────────────────────────────────────────────────────────╯
```

Desktop hero has 6/6 layout, 64–96px internal side padding, image 46–50% of width, 16px image inner rounded corner, vertical alignment centered. One decisive CTA, one supporting anchor. Dense proof line is below fold if page becomes cramped.

## Mobile: 360px budget phone first fold

```text
┌──────────────────────────────────┐
│ TeaFloww                EN  ☰    │
├──────────────────────────────────┤
│ SILIGURI · TEA BUSINESS PARTNER  │
│                                  │
│ YOUR TEA BUSINESS                │
│ STARTS HERE.                     │
│                                  │
│ Bulk tea, retail packs and       │
│ branding help for your business. │
│                                  │
│ [ Plan My Tea Business       → ] │  52px tall
│ [ Explore Options             ]  │
│                                  │
│ ╭──────────────────────────────╮ │
│ │ Genuine tea and pouch photo │ │  4:3 at compact widths
│ │ [25kg bulk] [250g–1kg packs]│ │
│ ╰──────────────────────────────╯ │
│                                  │
│ [ I'm starting ] [ I trade tea ] │
└──────────────────────────────────┘
                 ...
┌──────────────────────────────────┐
│ [Get Business Quote]  [WhatsApp] │  bottom safe area
└──────────────────────────────────┘
```

**Mobile above-fold order:** eyebrow → H1 → brief statement → main CTA → secondary action → actual product visual → segment switch. Do not require customer to watch a video to understand product. On 320px, H1 wraps naturally and buttons stay 1-column.

## Offer cards: grid rules

Desktop 3 cards / row; tablet 2 then third card spans only if a balanced composition; mobile 1 card / row. Every card uses the same anatomical slots:

```text
╭────────────────────────────────╮
│ [photo 1.18:1]                 │
│ BULK SUPPLY                    │
│ 25kg tea sacks                 │
│ Explore tea grades and volume  │
│ options for your market.       │
│                                │
│ [Explore quote →]              │
╰────────────────────────────────╯
```

Card action preselects `offer_id` in the same quote form. Card illustrations are not links to consumer checkout unless a new journey explicitly requires that.

## Five-step timeline

Desktop: steps 01 → 02 → 03 → 04 → 05 in a contiguous almond section with a fine continuous rule. Mobile: numbered vertical flow with 12px connector and 20px gap. Every step contains 8–13 word title/explanation, no spinning animations.

## Proof grid — designed for trust

```text
┌───────────────────────────────┬───────────────────────────┐
│ [Tea grain photograph]        │  Traceable supply         │
│ [real packing photograph]     │                           │
│                               │  Confirmed formats        │
│                               │  Approval workflow        │
│                               │  Written quotation        │
│                               │                           │
│                               │  [See our process]        │
└───────────────────────────────┴───────────────────────────┘
```

Images require exact captions: who/where/when and permission to publish. Any mockup must be explicitly described as an example.

## Quote module — desktop

```text
╭──────────────────────────────────────────────────────────────────────────╮
│ Request a tea business quote         │  STAGE                         ▾  │
│ Tell us pack and destination.        │  INTEREST                      ▾  │
│ Quote includes relevant terms.       │  ORDER BAND                    ▾  │
│                                      │  PINCODE                         │
│ Confirmation of fees/MOQ follows.    │  NAME     /     MOBILE            │
│                                      │  □ I agree to contact for quote  │
│                                      │  [ Request My Quote            ] │
╰──────────────────────────────────────────────────────────────────────────╯
```

Mobile form collapses to a single column, with sticky bar disabled/hidden where it obscures the form. Use native select where possible and accessible error messages. Avoid full-screen modal.

## Trader-first alternate hero

Use the exact same shared hero layout and typography but swap copy and image. Optional small spec tiles under hero: `25kg bulk`, `250g–1kg retail`, `Custom brand`, `Freight by quote`. The trader page should expose 'Get Quote' in <=1 screen on mobile and not bury specifications below a founder story.

## Language layout

`EN | हिंदी` is a small inline switch in header. Translation changes copy and `lang`, does not replace route, drop form inputs, or auto-switch on every visit. Fallback if one translation is missing: English with a clear inline indicator; don't use unreliable automatic translation as legal copy.

## Conversion and visual QA shots to capture

At minimum capture: 320×740 / 360×800 / 390×844 / 768×1024 / 1024×768 / 1440×900; starter/trader; English/Hindi; three offer selections; validation errors; success; slow loading; no JS; reduced-motion; font scale 200%.

## Page section inventory

| Section | Starter | Trader | Reusable component |
|---|---|---|---|
| Header | common | common | `BusinessHeader` |
| Segment switch | starter active | trader active | `AudienceSwitch` |
| Hero | beginner copy | procurement copy | `BusinessHero` |
| Offer grid | education-first | specifications-first | `OfferGrid` |
| Process | setup workflow | quotation workflow | `ProcessTimeline` |
| Proof | pack/branding photos | grading/sampling photos | `ProofGallery` |
| FAQ | starter answers | trade answers | `FaqAccordion` |
| Quote | starter preselected | trader preselected | `BusinessLeadForm` |
| Fixed mobile action | start quote | trade quote | `StickyLeadBar` |
| Footer | common | common | `BusinessFooter` |
