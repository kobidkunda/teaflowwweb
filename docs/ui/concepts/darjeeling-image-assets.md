# Darjeeling Spring imagery

Created with built-in ImageGen on October 11, 2026, then exported as WebP with Sharp at quality 88. These are illustrative visuals, not verified photography. All image URLs and visible descriptions are stored in the admin catalogue, not embedded in page code.

| Image | Project artifact | Size | Usage |
| --- | --- | --- | --- |
| Caddy | `public/uploads/darjeeling-spring-hero-v2.webp` | 105,638 bytes | Primary admin gallery image |
| Dry leaves | `public/uploads/darjeeling-spring-dry-leaf-v2.webp` | 176,704 bytes | Gallery and dry-leaf section |
| Brewed cup | `public/uploads/darjeeling-spring-liquor-v2.webp` | 80,930 bytes | Gallery, liquor section and brewing |
| Wet leaves | `public/uploads/darjeeling-spring-wet-leaf-v2.webp` | 249,018 bytes | Gallery and wet-leaf section |

All four exported images are 1254 × 1254 pixels, matching the actual generated output dimensions. Generated PNG originals remain in Codex's generated-image storage. Existing catalogue media and files were preserved. Only the new hero was promoted to primary. There are four new media records and four new product-image records after two imports.

## Prompt set

1. Product mockup: preserve the existing admin caddy's emerald body, lid, brass trim and label. Use the selected Option 1 mockup only for art direction. Center it on a soft sage studio surface with diffused daylight and botanical shadow, generous crop margins, no new label claims or props. Explicitly an illustrative demo visualization.
2. Dry leaves: a small pile of wiry olive-brown whole tea leaves with a few pale tips on a shallow ivory ceramic dish. Warm paper background, soft sage tones, macro still-life texture, full dish and generous margins. No words, branding, estate or certification. Explicitly not an actual batch photograph.
3. Brewed cup: white porcelain cup and saucer with pale amber-gold tea, soft morning sidelight, gentle steam, warm ivory tabletop and sage background. Full cup and ample handle/saucer margins; no fruit, flowers or provenance. Explicitly a conceptual brewing illustration.
4. Wet leaves: unfurled moist olive-green and copper-brown leaves on a shallow ivory ceramic dish, warm paper backdrop, soft morning light and tactile texture. Full dish and crop margins; no fresh plant, estate, packaging, words or certification. Explicitly an educational illustration.

## Administration and repeatability

The existing media library exposes the assets through their `media_uploads` records. Product gallery records link each asset through `media_id`. Images can be selected/replaced in admin as normal. `scripts/register-darjeeling-gallery.mjs` validates files, imports transactionally with bound SQL parameters, preserves existing image records, and is rerunnable without duplicate imports. A SQLite snapshot was taken before the first import at `data/backups/store-2026-10-11_17-51-38.sqlite`.

Section selection uses admin image descriptions containing `dry leaf`, `liquor`, `wet leaf` or `estate`. For each generated image, the AI-created label is present in the alt description and visible caption. Without a supplied estate image, the origin section uses catalogue text at full width. There is no simulated film.
