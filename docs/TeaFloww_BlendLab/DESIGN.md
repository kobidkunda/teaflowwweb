# DESIGN.md — TeaFloww Blend Lab Design System

> Product character: **a premium tea atelier married to a precise commercial analysis lab**. Warm, sensory and trustworthy in marketing; calm, practical and data-rich in operations.

## Design objectives
1. On first scroll customers grasp the offer, the three price points, courier flow and expected deliverable.
2. The customer sees **proof of the process** (sample report, tasting framework, expert reviews) rather than inflated claims.
3. Signature Blend Lab is visually featured, but the ₹299 service retains honest value.
4. Every public and private UI uses the same tokens, type scale and shared primitives.
5. No one confuses professional tea tasting with accredited analytical laboratory testing.

## 1. Visual direction

**Name:** Leaf & Ledger. Deep forest-green and warm ivory, punctuated with copper and liquor gold. Large serif editorial headings, precise sans UI text, subtle grid borders, photography of actual tea cups, leaves and cupping tables when verified assets become available.

**Reject:** fluorescent green dashboards, fake laboratory equipment, heavy stock-image overlays, irrelevant 3D neon scenes, giant gradients, moving backgrounds, fabricated testimonials.

**Visual hierarchy:** eyebrow → strong two-line statement → subhead ≤ 2–3 lines → primary and secondary CTA → sensory illustration/proof → service comparison.

## 2. Design tokens

| Token | Value | Usage |
|---|---|---|
| `--tl-forest` | `#143C31` | primary navigation/actions |
| `--tl-forest-deep` | `#092B23` | hero, footer, dominant headings |
| `--tl-cream` | `#F7F4ED` | primary page canvas |
| `--tl-ivory` | `#FFFCF7` | cards, reading panels |
| `--tl-copper` | `#B8753D` | score callouts, separators |
| `--tl-gold` | `#D7B474` | restrained premium accent |
| `--tl-sage` | `#E5ECE4` | filled secondary panels |
| `--tl-muted` | `#65746D` | secondary metadata |
| `--tl-line` | `#DDE4DC` | borders |
| `--tl-ink` | `#19332B` | readable text |
| `--tl-danger` | `#A43D38` | actual errors only |
| `--tl-good` | `#287455` | confirmed success |

**Fonts:** Marketing headings: Fraunces, Georgia fallback. Body: Inter/system-ui fallback. Avoid downloading fonts at build if unavailable; test font licenses before deployment.

**Type scale:** display 72/1.04 desktop, 46/1.06 tablet, 37/1.10 phone; h2 44→30; h3 26→22; body 16–18/1.6; labels 12–13 uppercase with wide tracking; prices 42–50 tabular.

**Spacing:** 4, 8, 12, 16, 24, 32, 48, 64, 96. Sections 92px desktop/60px mobile. Container max 1180–1240px. 24px desktop gutters/20px mobile.

**Geometry:** 16px cards, 24px feature surfaces, 999px chips, 12px fields, 48–56px buttons. Default border 1px. Shadow only where useful, preferably `0 20px 60px rgba(10,42,34,.10)`.

**Motion:** 140–240ms easing. Respect `prefers-reduced-motion`. Do not add fake load/progress states.

## 3. Site-wide templates

### 3.1 Homepage extension
- Existing website header/footer remain, add `Blend Lab` nav item.
- Feature banner after first curated retail storytelling/collection section, not a site-wide retail replacement.
- Left: eyebrow `TEAFLOWW BLEND LAB`, statement **“Your tea. Our expertise. A more competitive blend.”**
- Body: `Send your current blend for professional tasting, commercial insight and optional new formulation.`
- CTA: **Explore Blend Lab**. Secondary: **See a sample report**.
- Right: authentic cupping visual or illustrated reference until original photography is ready.
- Below: 3 proof points: `Sample by courier`, `Professional tasting`, `Wholesale-ready recommendations`.

### 3.2 Dedicated page `/blend-lab`
**Order:** navigation → hero → assurance ribbon → pain/goal cards → timeline → methods → sample report → cost/quality comparison → transparent tier cards → confidentiality → FAQ → closing CTA → footer.

Hero visual: custom cupping still life with rounded overlapping surfaces and inset note `From evaluation to approval`. No unsupported credentials, test scores or savings numbers.

Pricing is in a large section with a pale background: three cards, premium on the right desktop and center mobile only if visual scan order remains clear. Badges limited to a single **Most complete** label, not each feature.

### 3.3 Checkout `/blend-lab/start`
Minimal shell; stepper **Plan / Tea / Goals / Pickup / Pay**; always show plan price with GST-included wording only after tax confirmation; saved session draft; field labels + help and errors; active cart summary on desktop, compact order total mobile; trust via explicit service and courier terms.

### 3.4 Customer workspace `/account/blend-lab`
Cream canvas, white project cards and a timeline. Clear next action, not ERP-like density. Tabs `Overview`, `Courier`, `Evaluation`, `Report`, `Trials`, `Quote`. Show only plan-appropriate tabs. Permission-denied cases return a neutral not-authorized state.

### 3.5 TeaPilot admin module
Dense but comprehensible desktop: operational queue with status chips, lab sample evidence, tasting session editor and 3-pane report editor. On mobile tables collapse into cards. Preserve human edits and report revisions.

## 4. Reusable UI patterns

| Component | Contract | States |
|---|---|---|
| `Button` | appearance, size, href/onClick, loading | enabled, hover, focus, disabled, loading |
| `SectionHeading` | eyebrow, title, description, align | compact/standard |
| `PlanCard` | typed plan object, selected, select handler | default, featured, selected, blocked |
| `ProcessTimeline` | step data, active step | pending, active, complete, blocked |
| `ReportTeaser` | example document, CTA | preview, unavailable |
| `ComparisonChart` | named numeric attributes with sources | no-data, normalized, warning |
| `TeaPreferenceField` | controlled values, label, limits | normal, invalid, help |
| `SampleStatus` | status + action | in transit, waiting, exception, received |
| `QuoteSummary` | server quote, expiry, MOQ | draft, final, expired |
| `PageFeedback` | explanatory view state | loading, empty, error, offline, success |

## 5. Sample pricing copy (subject to validated scope)
- **Match & Quote — ₹299:** `Share one reference. Explore bulk sourcing. No report or physical return sample.`
- **Tea Quality Audit — ₹1,999:** `Professional tasting and a detailed PDF report with actionable recommendations.`
- **Signature Blend Lab — ₹2,999:** `Everything in the audit, plus trial blend development, one outbound trial shipment and a defined feedback round.`
- Fine print: `Inclusive pricing and courier allowances subject to published service terms and serviceable areas.`
- Do not mention guaranteed exact replica; use `sensory match attempt`.

## 6. Interactive patterns
- **Before/after:** toggle `Reference / Cost-focused / Quality-focused`; examples are labelled illustrative; user can see sensory trade-offs.
- **Report preview:** A4 page view, left chapter navigation desktop, select dropdown mobile, no fake test results. Link to a sample PDF only once one is actually created and approved.
- **Goal builder:** customer can select `Reduce cost`, `Improve cup`, `Match reference`, `New signature`; follow-up fields conditionally appear with real validation.
- **Project timeline:** accessible ordered list; show step-specific action and timestamps; don't move an order forward based on a frontend animation.
- **One-page quote:** highlight MOQ, valid-through date, tax/freight basis, formula version and CTA to request/confirm wholesale order.

## 7. Microcopy states
- Pending courier: `We'll send your sample collection instructions once your service area is confirmed.`
- Received: `Your sample is checked in. We are preparing its controlled tasting session.`
- Report ready: `Your evaluation is ready. Review the findings and recommendations.`
- Waiting for feedback: `Taste the shipped trial under the suggested method, then tell us what you would change.`
- No report in ₹299: `Your plan includes a quotation, not a detailed tasting PDF.`
- Out of coverage: `Courier pickup is not available for this pincode yet. Contact us for alternative shipment arrangements.`
- Missing evidence: `This measure was not tested. It has been left out of the report.`

## 8. Responsive layouts
- **360–599:** one column; hero image below CTAs; mobile CTA fixed above safe-area only when it does not cover forms, errors or footer; cards stacked; report preview pan/zoom with accessible text alternative.
- **600–899:** two-column details and single-column plans if three cards would become crowded.
- **900–1279:** compact navigation and flexible grids.
- **1280+:** three pricing columns; report split pane; admin three-pane editor.
- All tappable elements ≥44 CSS px (project decision exceeds WCAG 2.2 AA's general minimum of 24px subject to exceptions).

## 9. Accessibility rules
- Text contrast ≥4.5:1 for normal text, ≥3:1 large text. Verify actual pairs with tools.
- Every error is rendered as text and tied to its input with `aria-describedby`.
- Progress and results do not rely on colour alone.
- Semantic headings, buttons, links and lists; keyboard complete; focus ring visible.
- Charts include complete tabular equivalents and a method/provenance caption.
- Avoid modal traps; preview dialog must be keyboard dismissible.

## 10. Content authenticity & imagery
Use professionally photographed real tea samples and a real cupping table only when available. Do not invent a tester, estate, licence, lab certificate, testimonial or customer ROI. The static design example uses vector art on purpose; it is a layout direction, not proof of lab equipment or a real report. Real report examples must use synthetic clearly marked data or anonymized customer data with written permission.

## 11. UI acceptance requirements
- Works at 360, 390, 768, 1024, 1440 px.
- No horizontal overflow or obscured CTA.
- Main message, three price points and courier meaning understandable without reading FAQ.
- A screen reader can complete service selection and checkout.
- Error, empty, loading, no coverage, expired quote, delayed courier and report-review states designed before build.
- Shared tokens and `PlanCard` are used in home, landing, checkout and dashboard; no duplicated hardcoded amounts.
