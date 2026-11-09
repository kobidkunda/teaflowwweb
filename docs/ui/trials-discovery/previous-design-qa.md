# Compact homepage tea shelf — option 1

Date: 2026-10-31. Scope: homepage SignatureBlendsCarousel and its scoped styles.

## Source and browser evidence

Selected source: `docs/ui/compact-tea-shelf/selected-option-1.png` (950×1656 native pixels, representing a 390×680 CSS-pixel mobile section). Route: `http://localhost:3300/#tf-signature-section`.

Actual Chrome section captures are saved alongside the source: `mobile.png` at 390px width (390×844 viewport), `narrow.png` at 320px (320×740 viewport), `tablet.png` at 768px (768×1024 viewport), and `desktop.png` at 1440px (1440×1024 viewport). Captured screenshot bytes were re-encoded as PNG without artistic edits. These are browser screenshots; the selected concept is a generated reference.

Both combined inspection inputs were opened and reviewed after the final mobile adjustment: `comparison-full.png` places the source and actual section side by side at 390px each; `comparison-pair.png` compares the corresponding Assam/Nilgiri rows at 358px each. Natural aspect ratios were retained. `product-pair.png` is the actual matching pair crop.

The actual section includes the catalogue's first three products and Show All, whereas the concept shows two example products. Product order, real category labels and existing currency formatting are intentionally preserved. Desktop keeps the functioning four-column carousel; the selected compact photo-left composition applies below 1024px.

## Findings and iterations

No actionable P0/P1/P2 findings remain.

1. Initial tablet photos were cropped too tightly. Changed tablet image ratio to 1/1.08 and centered the adjacent details. Final tablet evidence shows complete tins.
2. Source/pair comparison showed excessive space before mobile pricing. Centered mobile details and reduced the price margin to 14px. Reopened both combined comparisons after this change.
3. The in-app browser annotation layer intercepted interaction. Chrome supplied clean captures and interaction checks. Fixed widgets were excluded from section captures by scrolling to the page top before offscreen section capture; application widgets were not removed.

## Fidelity surfaces

- Typography: editorial serif names and forest Quick Add labels, restrained uppercase categories, legible secondary notes and prominent prices follow the selected hierarchy. Long names wrap naturally at 320px.
- Spacing/layout: paper rows, full photo slots, narrow separators and compact adjacent details replace oversized white cards. Wishlist controls are 44px and purchase buttons at least 48px high. Tablet and desktop layouts remain usable.
- Colours: warm paper, deep forest text/actions and muted secondary text match the selected direction. No added decorative gradients or fabricated trust badges.
- Assets: existing product photography is reused directly. No additional image generation or dependencies were needed. Missing images show an honest unavailable state rather than another tea's photo.
- Copy/content: catalogue names, notes, prices, compare-at prices and availability remain authoritative. Removed slug-derived bestseller/popular/new badges and redundant percentage labels. Provenance remains in desktop markup and product detail pages; mobile rows prioritize buying information.

## Interaction and accessibility

- Wishlist toggled by keyboard Enter and was restored to its initial unselected state.
- Show All displayed eight products; Show Fewer restored three and updated aria-expanded.
- Quick Add added Assam Golden Breakfast; cart showed its 50g tin and ₹399 price. The test item was removed afterward, restoring the empty cart.
- Product title navigated to `/tea/assam-golden-breakfast` with the correct heading.
- Desktop Next advanced the carousel; Home returned to the beginning.
- Product-specific accessible purchase labels, stock-disabled state, honest missing-image state and no fabricated badges are covered in unit tests. Existing focus/reduced-motion rules remain.
- Document width matched 320, 390 and 768px viewports; desktop composition was visually reviewed at 1440px.
- One development-only CSS hot-reload removeChild error appeared from Next's mini-css-extract-plugin during editing. A subsequent reload rendered correctly and produced no additional logged errors; the optimized build passed. This is not claimed as an empty console history.

## Executed validation

Final `npm run check` exited 0: TypeScript, lint (0 errors; 61 existing warnings), 1,418 passing tests across 99 passing files, 5 live PostgreSQL tests skipped, and optimized production build. New regressions cover disabled purchase accessibility and missing product imagery; existing price/compare-at assertions were retained.

No database schema, API, payment processing or dependencies changed. No production deployment performed. P3 differences are real currency decimals/category labels and the extra catalogue row; these preserve application content rather than reproduce fictional concept data. This is responsive visual and keyboard/browser QA, not a formal screen-reader audit.

- [x] Selected design implemented in existing homepage component.
- [x] Source and actual screenshots compared together after fixes.
- [x] Mobile, tablet, desktop and buying controls verified.
- [x] Required repository checks passed.

final result: passed
