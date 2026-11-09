# UI Design Previews and Screenshots

Files ending in -preview.svg and -preview.png are illustrative visual design mockups generated for the project package. They are NOT screenshots of the running Next.js application.

Preview targets:
- homepage-preview.svg/png — Desktop homepage concept
- product-preview.svg/png — Desktop PDP concept
- mobile-preview.svg/png — Mobile homepage concept

Real browser screenshot capture:
1. npm install
2. npm run db:setup
3. npx playwright install chromium
4. npm run test:e2e

The Playwright tests create real browser screenshots in docs/ui/screenshots. Inspect the results for layout regressions and update reference screenshots only after human review.

Design direction: warm ivory, deep forest, editorial serif, source-side provenance, sensory clarity and direct purchase actions.
