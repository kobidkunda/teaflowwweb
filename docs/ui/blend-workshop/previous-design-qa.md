# Homepage design QA

Status: passed for the completed homepage. This supersedes the earlier upper-page-only review.

## Target and scope
Selected option 3 forest hero plus the complete section journey in the user's 1024 × 1536 reference. The optional hero clarification received no answer; the explicitly selected option 3 was retained. The full reference was treated as visual input, not permission to invent claims, reviews or stock.

## Final evidence
Actual browser captures in `docs/ui/screenshots/`:
- `ritual-complete-desktop.jpg` — 1385 px full page.
- `ritual-complete-mobile.jpg` — 390 px full page.
- `ritual-complete-320.jpg` — 320 px full page.
- `ritual-complete-tablet.jpg` — 768 px full page.
- `ritual-complete-comparison.png` — supplied reference left, actual browser right, proportional scaling.
- `ritual-newsletter-success.jpg` — browser success after local synthetic consent submission.

Reviewed the full composition: hero, four category panels, four catalogue product cards, lifestyle/philosophy split, four shopping guidance items, community section, newsletter and footer. Images load and no horizontal overflow appeared at 1385/768/390/320 px. Product images retain nonzero dimensions at narrow sizes. Mobile switches to one category/product column at 320 px to preserve legibility; the header menu remains available. Reduced-motion rules cover image hover transitions. Newsletter controls have labels, explicit consent, 44 px interactive targets and live success/error messages. One main landmark and semantic section headings remain.

## Fixes during review
Repaired collapsed mobile product image widths, aligned product pricing/actions with varying catalogue names, corrected checkbox styling inherited from global input rules, kept draft testimonials out of public RSC/client payloads, prevented pre-hydration form GET submissions, and fixed browser Host versus Next bind-address origin validation. Migration 014 conditionally repairs the demo Masala image that incorrectly reused an Assam-labelled tin without changing operator replacements.

## Deliberate differences
Original selected forest hero is retained. Live catalogue names, prices and illustrations replace fictional mockup cards. No fabricated reviews, avatars, stars, ethical sourcing badges, shipping promises, watch-story video or wishlist control are introduced. Approved genuine testimonials render as cards; absence renders the admin-controlled community invitation. Local decorative artwork is identified as illustrative. All editorial copy/images/links come from admin settings; no migration seed file is read as a runtime marketing fallback.

## Verification and limits
`NEXT_DIST_DIR=.next-home-check npm run check` exited 0: typecheck, lint (43 warnings, no errors), 42 test files / 690 tests and production build passed. Unit tests cover authenticated homepage reads/saves, migration preservation, publication privacy, consent validation, idempotent email normalization, same-origin/bind-host handling, rate limiting and generic errors. Browser signup saved one private normalized record and displayed success; the synthetic record was removed. Online backups preceded migrations 013 and 014.

Authenticated editor save/upload interactions remain a manual verification gap; the existing login gate was preserved and its API behaviour was tested. Newsletter capture stores consent only. Provider integration, unsubscribe and retention workflows must be completed before campaign delivery. This is homepage validation, not a whole-store release approval.
