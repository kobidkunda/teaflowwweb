# Trials discovery shelf — option 2

Date: 2026-11-07. Scope: `/trials` catalogue redesign, existing kit detail navigation preserved.

final result: passed

## Source visual truth and comparison state

Source: `docs/ui/trials-discovery/selected-refinement.png`, 856×1838 native pixels, generated reference representing a 1440px-wide desktop catalogue. It is a mockup, not a browser screenshot. Selected multi-kit direction was refined with four explicit content rows before implementation.

Implementation: `http://192.168.88.81:3000/trials`, verified with the Codex in-app browser. Browser viewport sizes were 1440×1024, 768×1024, 390×844, and 320×740. Screenshot pixel widths equal CSS widths (1:1 density). Actual public local data has one published kit. An isolated SQLite backup at `/tmp/teafloww-trials-design/qa.sqlite` was given three clearly named browser fixture kits and served on port 3355 to verify the multi-kit state. The normal catalogue was not modified or published. The temporary fixture server was stopped after verification.

Full browser captures: `desktop-final.png` (1440×1929), `mobile-final.png` (390×5434), `narrow-final.png` (320×5592), `tablet.png` (768px width), `multiple-kits-desktop.png` (1440×4083), and `multiple-kits-mobile.png` (390px width), all under `docs/ui/trials-discovery/`. `handoff-desktop.png` is the final 1440×1024 viewport screenshot after restarting the dev server following the interrupted turn.

Combined full-view evidence: `comparison-initial.png` and `comparison-multiple-final.png` were opened and reviewed. Source and actual screenshot were placed together in a single image, retaining natural aspect ratios and normalizing both to 720px width. Final multi comparison uses the first 2886px of the 1440px browser screenshot, covering the app-specific catalogue through guidance, excluding the pre-existing shared footer. Source height and catalogue content differ intentionally: mock sample products and their prices are not production content; browser fixtures duplicate known contents only to verify layout.

Focused evidence: `mobile-details-final.png` was opened to inspect all four content rows, wrapping title, price, purchase action and guide typography. `narrow-hero-final.png` was opened to verify the corrected narrow headline. These are crops of real browser screenshots, not additional captures or generated assets.

## Findings and iteration history

No actionable P0/P1/P2 findings remain in the redesigned catalogue.

1. [P2, fixed] Initial 320px headline orphaned “to” onto a separate line. Set display type to 36px below 360px. Post-fix `narrow-final.png` / `narrow-hero-final.png` show the complete first line and no horizontal overflow.
2. [P2, fixed] The guidance heading lost a word space when its break was hidden on mobile. Added explicit JSX whitespace. `mobile-details-final.png` shows “How to choose the right kit?” with correct spacing.
3. [P2, fixed] A three-column legacy card grid, empty second desktop column, and landscape masquerading as kit packaging weakened the selected direction. The new multi-kit grid uses two columns; a single visible kit uses a horizontal presentation above 1000px. Only the exact known seeded landscape association uses visibly disclosed conceptual packaging. Operator-uploaded assets remain intact. `comparison-multiple-final.png` confirms the intended two-column structure; `desktop-final.png` verifies the intentional one-kit adaptation.

## Required fidelity surfaces

- **Typography:** Georgia editorial serif matches the selected classic hierarchy; existing sans handles commerce text. Dark forest headings, readable 13–14px content rows, 29px prices, and button labels remain clear. At 320px the main heading is 36px; long product titles wrap without clipping. Eyebrows are secondary, not essential information.
- **Spacing/layout:** Compact two-part hero, narrow sidebar, open two-column catalogue, four lightly divided contents rows and aligned product actions follow the reference. The single-kit state avoids an empty column. Existing shared header/footer are preserved, hence differ from the concept navigation. At mobile sizes the sidebar becomes a full-width search and wrapping category toolbar. One main landmark and no horizontal overflow were observed at all four viewport widths.
- **Colors/tokens:** Warm paper #F6F1E7, forest #1D2A24, pine #23483A, restrained #956A2E brass, dark muted secondary text and light rules retain the selected palette. Primary labels have high contrast; active filters use white on pine. No ornamental gradients or heavy card shadows were introduced.
- **Images:** Two optimized, inspected raster assets match the photographed tea-table and kraft kit direction. Both are explicitly illustrative. No CSS cup drawings, fake placeholder packaging, or invented logo marks remain in the new hero/cards. Current images decode successfully. Source/prompt/optimization details are in `docs/ui/trials-discovery/README.md`.
- **Copy/content:** All actual kit names, component names, weights, prices and availability come from the public catalogue. Four contents rows are shown without unreviewed tasting notes, invented provenance, certificates, savings, reviews or urgency. Raw seed taglines and mismatched SEO origins are omitted from the listing. Mock sample kits are not inserted into the app. Page metadata now describes discovery kits without unverified estate claims.
- **Icons:** The existing project Lucide library supplies straightforward search, arrows, reset, chevrons and missing-image symbols. Controls have deliberate alignment and practical target sizes; existing brand logos are retained.

## Interaction and state verification

- Hero Browse discovery kits links to the collection anchor.
- Search by the component name “ginger” returns the matching kit.
- A nonexistent search produces a clear empty result; Reset restores the catalogue.
- Café selection updates `aria-pressed` and empty results; All trials restores the kit.
- Enter opens the native “What is inside a trial kit?” disclosure.
- View kit navigates to `/trials/tea-stall-discovery-kit`, where the existing order button is present. No order or payment was submitted.
- Four fixture kits rendered independently in a two-column desktop grid and stacked on mobile, including a correctly labelled unavailable kit. Distinct prices were retained.
- Browser console error logs were empty for the reviewed catalogue and isolated fixture preview.
- Loading and generic error routes are implemented. Load-more has a guarded request, loading, retry and deduplication path; its network failure/retry is not browser-exercised because the normal catalogue has one record. Search/filter scope is explicitly limited to loaded records when additional pages exist.
- Keyboard-visible outlines, named search, semantic buttons, pressed filters, live result count, reduced-motion styles, native disclosures and a single page main landmark are present. No full assistive-technology audit is claimed.

## Validation

`NEXT_DIST_DIR=.next-trials-check npm run check` completed with exit code 0: TypeScript, ESLint (existing warnings, no errors), 122 passing test files, 1,945 passing tests, five intentionally skipped PostgreSQL tests, and optimized Next.js build. The focused trials storefront/adversarial suite separately passed all 88 tests.

The first non-isolated build failed on a missing build trace; a subsequent isolated run was interrupted by the user. The final complete isolated run passed. A malformed pre-existing homepage trial test fixture was corrected to match the public DTO (remove private timestamps, include nullable meta fields); no production DTO was expanded.

## Limitations and follow-up polish

- Existing kit-detail copy and the shared footer still include seeded claims, sample content and an unreviewed tagline; those surfaces were not redesigned. Verification of actual product specifications and commercial claims remains a separate content task.
- Real uploaded kit photography can replace the illustrative packaging through the existing catalogue workflow.
- P3: obtain unique approved imagery for every published kit and reviewed sensory notes before expanding the listing detail beyond names and weights.
- No database migration, catalogue publication, production deployment, real order, payment or new dependency was performed.

## Implementation checklist

- [x] Selected design and refinement attached and reviewed.
- [x] Real catalogue contents/prices/availability retained.
- [x] Single-kit and multi-kit desktop/mobile states reviewed.
- [x] Narrow headline and guide-spacing findings fixed and recaptured.
- [x] Combined full-view and focused comparisons opened.
- [x] Main interactions tested in the browser.
- [x] Full local check passed.
- [x] Local preview restored for handoff.
