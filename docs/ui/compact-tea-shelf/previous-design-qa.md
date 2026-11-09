# Homepage Blend Lab invitation — option 1

Date: 2026-10-31. Scope: only `BlendLabDiscoverySection` on `/`.

## Visual truth and rendered evidence

- Source visual: `docs/ui/home-blend-invitation/selected-option-1.png`, 1681×936 native pixels, intended component size 1440×800 CSS px.
- Browser-rendered desktop: `docs/ui/home-blend-invitation/desktop.png`, 1440×810 pixels, captured in Chrome at a 1440×1024 CSS viewport.
- Responsive section captures: `mobile.png` (390px wide, 390×844 viewport), `narrow.png` (320px wide, 320×740 viewport), `tablet.png` (768px wide, 768×1024 viewport), under the same directory.
- Full section comparison input: `docs/ui/home-blend-invitation/comparison.png`, reference on left and implementation on right, both reduced to 720px wide with natural aspect ratios. The source is about 401px high at this width; the implementation about 405px. No stretching was used.
- Focused type/action comparison: `docs/ui/home-blend-invitation/comparison-detail.png`; corresponding text/action crops were reduced to 500px width for side-by-side inspection.
- Route: `http://localhost:3300/#home-blend-lab`. State: default, no hover, existing wholesale widget minimized in the final desktop capture.

The source and actual browser screenshot were opened together in both comparison
inputs before this report. The 10px height difference permits real HTML type and
spacing; it does not materially change the component's composition. Images are
real browser captures, distinct from the AI design reference. Captured JPEG bytes
were re-encoded as PNG without artistic edits.

## Findings and comparison history

No actionable P0/P1/P2 findings remain.

1. Initial mobile/tablet inspection found that the third journey step wrapped to a new row with an orphaned divider. Mobile action links also stacked at 390px despite available space. Changed the step row to three equal grid tracks and adjusted mobile button padding/type. Post-fix evidence: `mobile.png`, `narrow.png`, `tablet.png`.
2. Desktop comparison found the headline and copy starting too high relative to the selected reference. Increased desktop copy top padding to 124px and display type to 6.95vw (about 100px at 1440px). Post-fix evidence: `desktop.png`, `comparison.png`, `comparison-detail.png`. This later comparison required no further P0/P1/P2 changes.
3. The in-app browser's annotation layer intercepted link clicks and contaminated one capture with its inspector tooltip. No application CSS or browser protections were changed. Used Chrome for actual navigation checks and an unobstructed final desktop capture. This was an external browser overlay, not a broken app link.

## Required fidelity surfaces

- **Fonts/typography:** Georgia editorial headline retains the source's three-line structure; Arial body and CTA provide a clean second font. Copy stays readable, with no clipping or truncation at tested widths. The real primary button is slightly more compact than the concept but exceeds the 44px touch target.
- **Spacing/layout:** full-bleed warm still life, left-aligned invitation, two actions, three journey steps and bottom image caption match the selected hierarchy. Mobile places the image below text; the step row stays aligned. Tablet retains the split composition with a deliberate tighter image crop. Adjacent homepage sections and route structure are unchanged.
- **Colours/tokens:** warm paper `#f6f1e7`, deep forest text `#0b3328`, forest action `#153f30` and restrained copper eyebrow `#98521e` reproduce the selected palette. Copy sits over the light negative space of the supplied image. Uploaded operator images use a separate right-side image area so text contrast does not depend on an arbitrary upload.
- **Image quality/assets:** one individually generated photographic illustration (`public/images/blend-lab/home-invitation.webp`, about 231KB) faithfully covers the four bowls: dry leaf, infused leaf, amber liquor and milk response. Responsive image sizing and reserved section/image dimensions prevent late layout collapse. No CSS art or handmade SVG replaces the source photography. AI imagery is visibly disclosed.
- **Copy/content:** selected headline, concise service introduction, real actions and three process labels are implemented. The previous fabricated sensory numbers, verification badge, savings recommendation and unsupported nationwide pickup language are removed from this section. No fixed teaser price is shown. Operator copy, image, alt text and primary CTA label remain supported; only exact original starter headlines receive the selected headline treatment.

## Interaction and accessibility evidence

- Chrome click on `See how it works` navigated to `/blend-lab#method`; the target heading `See your tea in a new light.` was present.
- Keyboard Enter on `Explore Blend Lab` navigated to `/blend-lab`; the landing-page heading was present.
- Both controls have real links, visible focus styles and at least 48px height; the primary is 58px on desktop and 52px on mobile.
- Journey uses an explicitly identified ordered list; section has an accessible heading, and the illustrative photo has meaningful alt text.
- Document width matched viewport width at 390, 320 and 768px. Desktop section width was 1440px with no clipping.
- Native/global reduced-motion rules preserved. No new animation or client-side component was added.
- Chrome console error log was empty during verification.

## Executed checks

`npm run check` passed: TypeScript, ESLint (0 errors; 61 existing warnings),
1,416 tests across 99 passing test files, 5 live PostgreSQL tests skipped, and
optimized production build. The compiled CSS includes the final desktop type rule.
Two new rendering regressions check real destinations, retired claim removal,
illustrative disclosures and preservation of operator-authored copy/media/CTA.
No production deployment, database mutation or payment action was performed.

## Follow-up polish and limits

P3: real facility photography can replace the disclosed illustration through the
existing homepage media placement. The compact real button differs slightly from
the concept's larger label but remains clear and accessible. This pass is visual
and keyboard/browser verification, not a formal screen-reader certification or
field performance measurement.

## Checklist

- [x] Selected option implemented in the existing component.
- [x] Individual image placed and disclosed.
- [x] Full and focused combined comparisons inspected after fixes.
- [x] Desktop/tablet/mobile states reviewed and actual destinations exercised.
- [x] Repository check passed; no deployment performed.

final result: passed
