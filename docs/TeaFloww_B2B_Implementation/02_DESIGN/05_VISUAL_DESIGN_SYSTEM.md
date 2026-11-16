# TeaFloww Business Design System — 'Origin / Commerce'

## Design thesis

**Elegant enough for a tea brand founder. Serious enough for a 500kg wholesaler. Fast enough for a budget Android phone.** The design should feel like a polished editorial tea house combined with a trustworthy procurement service: tactile parchment, deep evergreen, controlled gold, precise product macro imagery, dense proof instead of clutter.

## Palette — proposed reuse of TeaFloww brand values

| Role | Hex | Use |
|---|---|---|
| Evergreen 900 | `#063B2F` | Primary brand surface, headings in dark modules |
| Evergreen 950 | `#0A362B` | Hover/pressed header and hero depth |
| Forest 600 | `#527F58` | Nature accent, illustrations |
| Ivory 50 | `#FFFBF3` | Default page canvas |
| Almond 100 | `#F6E8D7` | Warm alternating section background |
| Honey 400 | `#D8B36C` | Premium line, graphic highlights, small decorative chips |
| Peach 200 | `#F3CAA6` | Subtle badge/accent, not primary text |
| Ochre 300 | `#EBB77A` | Warm hover/illustrative tone |
| Earth 700 | `#8B5E3C` | Tea source captions, detail |
| Ink 900 | `#0C2835` | Body text on light surfaces |
| Sage 300 | `#8FAD80` | Secondary illustration tone |
| Cool grey | `#C7D0D4` | Input border / subtle separators |

**Contrast rules:** Verify each text/background color pair automatically. Default body `#0C2835` on `#FFFBF3`; CTA ivory text on `#063B2F`. Gold is a decoration or accent on dark backgrounds, **not** fine body text on white. W3C WCAG AA minimum for normal text is 4.5:1 (3:1 for large text); verify through automated + manual checks.

## Theme tokens

| Token | Desktop | Mobile | Purpose |
|---|---|---|---|
| Container width | 1200px | fluid | Predictable editorial alignment |
| Side padding | clamp(20px, 4vw, 40px) | 16–20px | Comfortable thumb margins |
| Hero H1 | clamp(52px, 6vw, 84px) | clamp(38px, 10vw, 52px) | Strong hierarchy without crop |
| Section H2 | clamp(34px, 4.5vw, 56px) | 32–42px | Repeated system |
| Lead paragraph | 18–20px | 16–18px | Readable with subtitles |
| Body | 16px | 16px | Do not use tiny 12px marketing copy |
| Radius card | 28px | 22px | Refined soft geometry |
| Radius input | 12px | 12px | Functional clarity |
| Radius button | 9999px | 9999px | Thumb-friendly rounded CTA |
| Section vertical rhythm | 96px | 58px | Calm, generous breathing room |
| Card padding | 28px | 20px | Uniform density |
| Button min-height | 52px | 52px | Touch and legibility |
| Hairline | `1px solid rgba(...)` | same | Soft dividers |

## Type system

- **Editorial display:** optional locally hosted premium serif with Devanagari-safe fallback, or `Georgia` as a no-download baseline. Use serif for *small amount of expressive English copy only*, not long Hindi paragraphs.
- **UI/sans:** system sans (`Arial`, `Noto Sans Devanagari`, `Segoe UI`, etc.) to avoid costly downloads; choose custom sans only if optimized and brand-approved.
- **Weights:** 400 body, 550/600 labels, 700 key CTA. Avoid excessive faux-font weights.
- **Numerals:** tabular-nums for pack sizes, statistics and quote figures.
- **Line lengths:** 48–64ch hero body, 62–72ch paragraphs; Hindi translations get flexible width.
- **Tone:** plain-language, specific, slightly aspirational; never 'guaranteed profit' or 'cheapest supplier'.

## Global surfaces

1. **Hero:** `forest-900` with a subtle radial spotlight (not multiple glass gradients), dark side for copy and photograph module on right; 1 thin honey border line to communicate quality.
2. **Offer cards:** ivory base with 1px evergreen 10% border, one photo or graphic, no stock icon collages, hover lift 2px max; focus ring 3px high contrast.
3. **Process:** almond alternating band, numbered steps in small engraved circle, horizontal editorial rule.
4. **Proof:** asymmetric 7:5 grid for macro tea/packaging, captions in concise text blocks.
5. **Conversion:** dark evergreen quotation card, input fields in calm light surfaces, error text on accessible colors.
6. **Footer:** deep evergreen with legal text, contact and short paths.

## Motion & microinteractions

- 160–220ms for button/interactive changes; transform and opacity only; no parallax on phones.
- Hero image can fade once if reduced-motion not requested; no scroll-triggered motion needed for LCP content.
- Offer selected: focus ring + subtle `translateY(-2px)` and a visible 'Selected' label, not color-only state.
- Form success: green accessible status icon + reference number, polite live region.
- Respect `prefers-reduced-motion: reduce` globally.
- No auto-playing decorative video background by default; optional 'Play 20-sec tour' poster only.

## Photography & visual authenticity

Photo art direction: real macro tea granules in shallow side light; silhouetted worker hands weighing tea; neat lined 25kg sacks **when real and available**; measured packing with close texture; honest pouches in 250g, 500g and 1kg; actual tea-in-milk result; client artwork **only with permission**. Use warm natural light, subtle grain, true material color, consistent matte grading. Avoid AI inventing factory scale, machines, certificates or customer approvals.

**Image specs:** hero 1600×1200 source to generate responsive AVIF/WebP; safe small poster 720×540; card images 800×720; 1:1 social crop optional. Use `object-fit: cover` + focal point metadata, intrinsic sizes to avoid CLS. Do not ship giant image with CSS downscaling.

## Iconography

Choose Lucide or current site icon set, 20–24px stroke 1.75. Standard icons: `Package`, `Leaf`, `PenTool`, `ClipboardList`, `MessageCircle`, `ArrowUpRight`. One icon family globally. Icons decorate but never replace text labels.

## Uniformity principles

- Exactly **one** `<Section>` pattern, heading cluster and spacing rhythm for all pages.
- One button API (`primary`, `secondary`, `quiet`); no custom ad-hoc CTAs in page JSX.
- One form field component with label, hint, error, ID and ARIA wiring.
- One type-safe `OfferCard` configured by data, not copied HTML three times.
- One CTA tracking helper and one consistent sticky bar.
- Component names should reflect business semantics; no giant untyped `AnyCard` component.

## What NOT to do

No giant auto-play videos, aggressive animated counters, fake demand scarcity ('only 3 spots left'), endless marquees, synthetic testimonials, impossible freight promise, bloated JS carousel, full-screen blocking language popup, tiny footers, or green-on-gold body text.
