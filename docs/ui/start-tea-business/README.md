# Start Your Tea Business — option 1

Implemented locally on 17 November 2026. Selected visual: `selected-option-1.png`.
Preview: http://127.0.0.1:3013/start-tea-business (local production build; no deployment).

## Evidence
- `before-desktop.jpg`, `before-mobile.jpg`: captured from the live reference using the in-app browser.
- `production-desktop.jpg` (1440×7609), `production-desktop-hero.jpg` (1440×1000): real built-page browser captures, idle quotation state.
- `production-mobile-390.jpg` (390×844), `production-mobile-320.jpg` (320×740): real built-page browser captures.
- `production-calculator-desktop.jpg`: actual built calculator with default inputs.
- `implementation-hindi-320.jpg`, `implementation-mobile-calculator-390.jpg`, `quotation-success-320.jpg`: real development-browser interaction captures.
- `comparison-hero.jpg`, `comparison-calculator.jpg`, `comparison-full.jpg`: source on the left, implementation on the right. These are comparison composites, not additional browser screenshots.
- `implementation-desktop-initial.jpg` records the initial React list-key warning; it is historical evidence, not the final result.

## Deliberate differences from the concept

The generated design contained incorrect ready-pack copy implying TeaFloww packs become the buyer’s brand. The implementation correctly describes resale of TeaFloww packs. Existing approved text and actual supply terms remain authoritative. The full page is longer because the approved brief also requires a live sample shelf, six startup essentials, service-scope guidance, a working quote form and expanded FAQs. Calculator revenue, costs and contribution percentage supplement the three large concept outputs.

Georgia/Arial follow the repository’s licensed/system-font convention. The photographic subject, warm-paper/forest/brass palette, split hero, open comparison columns, dark calculator, tasting banner and light roadmap reproduce the chosen direction. Generated art is decorative and disclosed; catalogue product photographs remain catalogue-backed.

## Asset production

Built-in ImageGen produced two individual photographic assets using the selected option as a reference. Sharp optimized them to WebP without changing their content.
- `public/images/business/starter-tea-table.webp`: 1513×1039, about 134KB. Prompt: premium sunlit oak tea table, cream wall, plain kraft pouches, three ivory tasting bowls, loose black/green/spiced tea bowls and leafy vase; subject toward right, no UI, text, logo, real-facility or provenance claim; warm paper, forest and brass art direction matching selected reference.
- `public/images/business/starter-sampling.webp`: 1800×650, about 112KB. Prompt: wide editorial sampling still life; clear glass amber tea, three ceramic loose-tea bowls, natural linen and green branch on the right; quiet ivory background on the left for HTML copy; no UI, text, logo or real-product claims.

The selected design image is a concept, not a browser screenshot. WebP source assets are conceptual illustrations, not photographs of TeaFloww facilities or guaranteed delivered packaging.

## Verification

17 focused unit tests pass. Typecheck and lint complete successfully; existing lint warnings remain. The broad suite excluding the unrelated subscription date suite passes 3,136 tests (six skipped). Production build completes. The full `npm run check` remains blocked by 24 unrelated subscription tests using today’s date after its late-evening dispatch cutoff. See `docs/TESTING.md` for exact commands and limitations.

Browser checks cover default/loss/invalid/reset calculations, offer-prefill and focus, English/Hindi, narrow overflow, input/footer sticky-bar hiding, native FAQ expansion, sample detail navigation and a saved local synthetic quote. No production mutation or deployment was performed. No terminal Playwright run or assistive-technology certification is claimed.
