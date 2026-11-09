# Trials discovery shelf — selected option 2

The source `selected-refinement.png` is an ImageGen design mock, not a browser screenshot.
`desktop.png`, `mobile.png`, `tablet.png`, and `narrow.png` are captured from the running app with the Codex in-app browser. Comparison sheets combine the design and rendered screenshots.

The real local catalogue currently contains one published kit. The implementation therefore uses a horizontal single-kit layout at wide desktop sizes; two or more visible kits use the selected two-column grid. Mock sample kits are never inserted or published. Contents, weights, current price and availability come from the existing public DTO. Tasting notes, provenance and certification badges are omitted from listing cards pending review of seeded data.

The existing shared header/footer and product detail flow are preserved. The new hero lives in `DiscoveryShelfHero.tsx` so the existing legacy `TrialHero.tsx` can remain independent.

## Generated imagery

Built-in ImageGen, no CLI fallback. Image assets are decorative conceptual imagery and visibly disclosed.

- `hero-source.png`: four ceramic milk chai cups and four plain cream kraft pouches on limestone, loose tea, ginger, cardamom and cinnamon, natural side light, cream/forest palette, 3:2 landscape; no typography, logos, claims or interface. Optimized to `public/images/trials/discovery-shelf-hero.webp`, 1200×800, 176,782 bytes.
- `kit-source.png`: cream kraft presentation box behind exactly four cream kraft pouches with green abstract leaf motifs, ceramic chai cup at right on limestone, warm side light; no typography, logos, weights, claims or interface. Optimized to `public/images/trials/discovery-shelf-kit.webp`, 1000×750, 91,086 bytes.

Kit artwork substitutes only the exact known development record ID and its seeded landscape URL. An operator-uploaded replacement image is always retained. Missing images have a readable fallback. No database records, schema, product publication states or production services were changed.
