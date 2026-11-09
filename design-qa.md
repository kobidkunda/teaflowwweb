# Homepage sample-kit invitation — selected option 3

Date: 2026-11-07. Scope: the homepage HomeTrialsSection, its image editing controls,
shared content schema and existing HTTP/MCP homepage content transports.

final result: passed

## Source and browser evidence

Source visual truth: `docs/ui/home-trials-invitation/selected-option-3.png`,
1681×936 native pixels, representing a desktop homepage section. This is an
ImageGen concept, not a browser screenshot.

Running implementation: `http://192.168.88.81:3000/#home-trials`, inspected in the
Codex in-app browser. Actual section captures are saved in
`docs/ui/home-trials-invitation/`:

- `desktop-final.png`: 1440×937 section; 1440×1024 CSS viewport.
- `mobile-final.png`: 390×885 section; 390×844 CSS viewport.
- `narrow-final.png`: 320×792 section; 320×740 CSS viewport.
- `tablet.png`: 768px-wide section; 768×1024 CSS viewport.
- `admin-editor.png`: isolated authenticated editor image controls.
- `admin-save-storefront-proof.png`: actual isolated storefront after image/caption save.

Capture density was 1:1: pixel widths equal CSS widths. Section captures exclude
browser chrome and neighboring sections. The fixed shared header initially
appeared in some offscreen captures; clean captures were retaken after scrolling
the page to its main landmark. No application header was removed or restyled.

Combined full-view comparison: `comparison-initial.png` and
`comparison-final.png` place the source and browser rendering together at 720px
width per side, retaining natural aspect ratios. Both were opened and reviewed.
Focused comparison: `comparison-action.png` places the source and actual
button/supporting-copy region together at 600px each; it was opened and reviewed.
`narrow-final.png` was separately opened to verify the 320px button fix.

The actual section is taller than the concept (937px versus ~802px when source
width is normalized to 1440px). This is intentional: editable 8:3 artwork is
shown without cutting off any cup/pouch, copy remains separate accessible HTML,
and the real caption is visible. The new 8:9 mobile composition is intentional
art direction requested by the user; it does not crop the desktop strip.

## Findings and fixes

No actionable P0/P1/P2 findings remain in the scoped section and editor.

1. [P2, fixed] The first desktop rendering had excessive outer spacing. Reduced
   desktop top/bottom and action gaps while retaining the full 8:3 image slot.
   `comparison-final.png` verifies the tightened rhythm.
2. [P2, fixed] At 320px the CTA label wrapped, expanding the button to ~80px.
   Adjusted the narrow button font, padding, gap and arrow width. Browser measured
   the corrected button at 54px high. `narrow-final.png` shows a single-line label
   with no overflow or clipped arrow.
3. [Capture artifact, corrected] On resizing, an early screenshot retained the
   prior mobile bitmap until the desktop asset decoded. Browser `currentSrc`,
   natural dimensions and subsequent captures confirmed the right source.
   Final captures were taken after decode. No source-selection code fix was needed.

## Fidelity surfaces

- Typography: Georgia editorial headline with italic brass emphasis, restrained
  sans supporting copy and a serif forest CTA follow the chosen concept. Headline
  wraps into two balanced lines on mobile; the narrow label remains readable.
- Layout/spacing: centered introduction, wide overhead tea photograph, single
  primary action and short supporting line preserve the concept's hierarchy.
  There are no nested product cards, tabbed sachet details or dense claim panels.
  Photo proportions and padding were adjusted for editable assets and mobile use.
- Colors: #F6F1E7 paper, #1D2A24 forest text, #23483A button, restrained brass,
  and darker secondary text preserve the brand direction and legibility.
- Image quality: built-in ImageGen produced separate desktop and mobile artwork.
  Final WebP sizes are exactly 1920×720 (257,870 bytes) and 960×1080 (153,176 bytes).
  Four cups and four pouches remain visible. No CSS/SVG illustrations or fake
  package text replace the target artwork. Both illustrations have a visible caption.
- Copy/content: selected introduction and collection CTA replace the seeded
  provenance, voucher, discount, harvest scarcity, dispatch and cup-yield claims.
  Names/prices/stock are intentionally left to `/trials`. Pack count/weight comes
  from the published trial DTO. Exact old starter strings map to safe selected
  copy without overwriting stored custom editorial text.
- Icons/controls: the existing Lucide arrow matches the reference's plain action.
  It is decorative and hidden from assistive technology. Visible focus, a real
  anchor, semantic heading/figure/caption, responsive image selection and reduced
  motion are retained. CTA target height is at least 54px on phones.

## Browser and backend verification

- 1440, 768, 390 and 320px document width matched viewport width; no overflow.
- Correct desktop optimized image above 640px; separate mobile source below it.
- Image decode and current source were checked; all four pairs remain in frame.
- Keyboard Enter on Explore all sample kits navigated to `/trials`, where the
  published kit was present. No cart mutation/order/payment was performed.
- A synthetic account in an isolated SQLite backup served on port 3356 verified
  the actual admin editor, exact dimension/crop hints, image path editing, mobile
  clearing, save success and subsequent storefront readback.
- Isolated admin changed the desktop image, cleared mobile and changed caption.
  The storefront used the new desktop image for both slots and displayed the saved
  caption, confirming the documented fallback. Normal homepage records were untouched.
- HTTP tests use authenticated sessions; unauthenticated updates return 401.
- MCP tests round-trip both image fields, preserve unrelated hero content, reject
  unsafe external/scheme/protocol-relative image paths, and return exact-size guidance.
- Browser console error logs were empty for the normal homepage review.
- No fault-injected uploader error or full assistive-technology audit is claimed;
  the existing authenticated uploader and its error states are reused.

## Validation and security

`NEXT_DIST_DIR=.next-home-trials-check npm run check` completed with exit code 0:
TypeScript, ESLint (125 existing warnings; zero errors), 126 passing test files,
1,963 passing tests, five intentionally skipped live PostgreSQL tests, optimized
Next.js build. After the final CSS-only narrow-button change, the same isolated
production build was run again and completed successfully.

Focused homepage/editor/MCP suite passed all 46 tests. Both transport paths use
shared Zod validation and existing admin authorization. Image paths remain local;
user content is escaped by React. No new dependencies, payment logic, customer data
exposure or production operations were added. Two existing checkout `any` address
annotations were replaced with the existing `CustomerAddress` type to clear global
lint; no checkout behavior was changed by this task. Concurrent checkout edits
briefly caused a global syntax failure before the final passing run.

## Admin and MCP handoff

Admin `/admin/homepage` → Trials Flights → Background artwork:

- Desktop: **1920 × 720 px**, 8:3, above 640px CSS width.
- Mobile: **960 × 1080 px**, 8:9, at/below 640px.
- Alt text, caption, copy and CTA label remain editable.
- Existing Media Library / Upload New / Edit Path controls are reused.
- Both crop previews use the matching ratio and centered cover.

`store.getHomepageContent` and `admin.updateHomepageContent` expose the fields in
schema/descriptions and return `media_guidance.trials`. Authenticated admin GET/PUT
returns the same guidance. Save the complete homepage document when using MCP.
Detailed workflow, source prompts and actual optimized file paths are in
`docs/ui/home-trials-invitation/README.md`.

## Checklist and limits

- [x] Selected visual mapped unambiguously to displayed option 3.
- [x] Dedicated desktop/mobile assets generated, optimized and inspected.
- [x] Admin and MCP image/caption edits persist and read back.
- [x] Exact dimensions and fallback rules visible in editor and tool responses.
- [x] Desktop/tablet/mobile/narrow screenshots and combined comparisons reviewed.
- [x] Narrow CTA and spacing findings fixed and recaptured.
- [x] Normal local preview restored; no production deployment.
- [x] Full check and final CSS production build passed.

P3: replace generated illustrations with approved kit photography when available.
The shared homepage header/footer, unrelated sections and kit-detail copy are
outside this redesign. No database schema migration or publication of kits occurred.

## Tea Moments — 2026-11-07

Local section extension of the existing paper/forest product design. Replaced
the sourcing dossier with an optional curated introduction, occasion, serving
suggestion, pairing and portrait image. Existing products receive no automatic
editorial copy. Removed sourcing controls/displays from product admin while
preserving catalogue values and external contracts.

Evidence: `docs/ui/tea-moments/{moments,product}-{1440,768,390,320}.png` and
`admin-{1440,390}.png`. These are real browser captures from a temporary SQLite
copy, with clearly disclosed fixture copy/AI imagery. Section-only captures
hide unrelated fixed overlays; full product captures retain the storefront.
The mobile admin grid overflow found in review was fixed before recapture.
Five Chromium regression tests passed, including keyboard, save/clear,
validation and broken-image fallback. Impeccable detector returned no findings.
Fresh finish reviewer viewed every capture and returned **Ship**, no material
findings or required fixes. The approved incumbent design system is preserved.
