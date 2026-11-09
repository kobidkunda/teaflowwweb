# Screen Templates & UI Layout Annotations

This document gives a designer/frontend engineer concrete layout grids and purpose-built UI components. The actual design preview is in `examples/static-preview/index.html`.

## Desktop landing (≥1280px)
```
┌────────────────────────────────────────────────────────────────────────────────┐
│ TEAFLOWW      How It Works   Methodology   Report   Pricing       [Explore]   │
├────────────────────────────────────────────────────────────────────────────────┤
│  EYEBROW                                        │ cupping photo/illustration  │
│  Your tea.                                      │ overlapping real tea cups   │
│  Our expertise.                                 │ small authenticity note    │
│  Better blends.                                 │                             │
│  2-line explanation                             │                             │
│  [Explore plans] [Example report]               │                             │
│  01 Ship  / 02 Taste / 03 Decide                │                             │
├────────────────────────────────────────────────────────────────────────────────┤
│  Three reassurance columns with borders                                      │
├────────────────────────────────────────────────────────────────────────────────┤
│  Section heading                                                                │
│  [Lower cost]             [Better cup]                [Signature blend]        │
├────────────────────────────────────────────────────────────────────────────────┤
│  01 Choose       02 Ship       03 Taste        04 Review       05 Order        │
├────────────────────────────────────────────────────────────────────────────────┤
│  Evidence-led report heading                    │ A4 report mock (demo label)  │
├────────────────────────────────────────────────────────────────────────────────┤
│  Quality/cost explanation                       │ Interactive priority tabs   │
├────────────────────────────────────────────────────────────────────────────────┤
│  [₹299]                [₹1,999]                [₹2,999  FEATURED]              │
├────────────────────────────────────────────────────────────────────────────────┤
│  Confidentiality / FAQ / closing CTA                                         │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Design decisions
- Header height ~72–80px; hero vertical rhythm spacious but conversion CTA visible on first screen.
- Main canvas warm parchment; dark hero and report section alternate for clear rhythm.
- Desktop 12-column grid, max content width 1180–1240px, gutters 24px.
- Pricing three equal-width cards; featured card border/copy focus rather than extreme size.
- Report teaser inset A4 design supports product trust without inventing scores.

## Mobile landing (360–599px)
```
┌───────────────────────┐
│ TEAFLOWW         Menu │
├───────────────────────┤
│ Eyebrow               │
│ Your tea.             │
│ Our expertise.        │
│ Better blends.        │
│ Short explanation     │
│ [Explore plans      ] │
│ [Example report     ] │
│ Three small proof tags│
│ tea illustration     │
├───────────────────────┤
│ proof / proof / proof │
├───────────────────────┤
│ Market objectives     │
│ [card]                │
│ [card]                │
│ [card]                │
├───────────────────────┤
│ steps in 1–2 columns │
├───────────────────────┤
│ Report heading        │
│ full-width A4 teaser │
├───────────────────────┤
│ Priority tabs         │
│ Quality preview       │
├───────────────────────┤
│ ₹299 card             │
│ ₹1,999 card           │
│ ₹2,999 card (feature) │
├───────────────────────┤
│ CTA and footer        │
└───────────────────────┘
```

- Keep action button at least 44px tall (project standard).
- All pricing cards show inclusions AND exclusions without another navigation step.
- Avoid horizontal tabs that are smaller than accessible touch targets; use segmented control or scrollable full labels.
- No forced scroll-jack; no hovering to reveal crucial information.

## Checkout desktop
```
[Logo]                             Checkout: Plan › Tea › Goals › Pickup › Pay
┌────────────────────────────────────────────┬───────────────────────────────┐
│ STEP TITLE                                 │ Your service                 │
│ Labels, fields, helpful hints, errors      │ ₹2,999 (approved total)       │
│ Input goals show conditional fields       │ Courier rules summary        │
│                                            │ Includes / excludes          │
│ [Back]                        [Continue]   │ Refund terms link            │
└────────────────────────────────────────────┴───────────────────────────────┘
```

Mobile: summary collapses to labelled price strip with expandable terms; no popup requirement to proceed; form controls full width.

## Customer dashboard
```
Header / customer navigation
  Welcome back  [+ New project]
  [New requests] [In transit] [Reports ready] [Awaiting feedback]
  Project cards: reference, plan, genuine status, next action, updated time
```

Detail page: one leading next-action box; timeline with actual event times; reporting/trials/quotes only when entitled. Loading/empty/error/offline states have recovery copy.

## Staff/TeaPilot screens
- **Inbox:** dense queue with saved filters and urgency reasons. Mobile cards instead of broken tables.
- **Intake:** specimen images + weighed/received condition and acceptance checklist.
- **Tasting:** controlled method at top, human sensory fields centre, evidence media right.
- **Report editor:** left sections, centre A4 composition, right source/provenance/review panel.
- **Formulation editor:** real lot IDs with quantity ratio, target sensory, effective cost and version history; private by default.
- **Quote:** MOQ, quantity, lead time, price validity, tax/freight basis and approval owner.

## Screen-level acceptance
At every screen document: job-to-be-done, hero/top action, permission owner, API/data source, loading/empty/error state, desktop/mobile frame and keyboard semantics. Require source-labelled chart data and no fabricated conclusions.
