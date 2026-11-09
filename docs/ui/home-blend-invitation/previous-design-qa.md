# Blend Lab workshop — option 3 design QA

Date: 2026-10-31. Route: `/blend-lab`. Final result: passed.

## Visual truth and evidence

- Selected visual truth: `docs/ui/blend-workshop/selected-option-3.png` (854×1840 native pixels).
- Implementation: `http://localhost:3300/blend-lab`.
- Desktop browser screenshot: `docs/ui/screenshots/blend-workshop-desktop.png` (1440px wide, full page; viewport 1440×1024 CSS px).
- Focused hero screenshot: `docs/ui/screenshots/blend-workshop-hero.png` (1440×1024).
- Responsive screenshots: `docs/ui/screenshots/blend-workshop-mobile.png` (390×844 viewport), `blend-workshop-tablet.png` (768×1024), `blend-workshop-320.png` (320×740), all full-page captures.
- Combined comparison inputs inspected: `docs/ui/blend-workshop/comparison-full.png`, `comparison-hero.png`, and `comparison-process.png`. Source is on the left; implementation is on the right.

Chrome was used after two in-app browser navigation attempts timed out. Browser
captures are real rendered-page screenshots, re-encoded as PNG without artistic
edits. They are distinct from the selected AI mockup.

## Normalization and state

The generated reference is 854px wide, although its intended desktop design width
was 1440px. Actual browser capture is 1440 CSS/pixel px wide (1× density). For the
focused hero comparison, source crop (0,46,854,440) and implementation crop
(0,106,1440,740) were independently reduced to 720px wide; their region heights
are effectively equal. The process comparison similarly normalizes source
(0,718,854,448) and implementation (0,1263,1440,787) to 720px wide.

Full-view comparison uses 600px-wide copies at natural aspect ratio. The implementation
crop excludes the existing shared shell and includes the retained FAQs. It is
longer because production catalogue deliverables and exclusions are more detailed
than the mock, and the existing FAQs remain available. These are deliberate product
constraints, not a density mismatch to hide through image stretching.

State: default first goal selected; report, plan exclusions and FAQs closed.
The browser's persistent wholesale trigger and development indicator are visible
in some captures; neither was fabricated or added to the selected page design.

## Findings and five fidelity surfaces

No actionable P0/P1/P2 findings remain.

- **Fonts and typography:** Georgia editorial headlines and clean Arial body copy match the reference's two-font treatment. Hero now wraps into three lines with 92px display type at 1440px. Mobile uses 49px type at 390px and remains readable at 320px. Detailed catalogue copy is intentionally smaller than display copy, not truncated. Custom admin hero text remains supported.
- **Spacing and layout rhythm:** 740px desktop split hero, wide paper margins, two-column goal selection, four-image process strip, dark report split and three service columns reproduce the selected hierarchy. The process becomes two columns on tablet and a single column on narrow phones. Cards and action links remain inside their sections. No horizontal overflow at 1440/768/390/320px.
- **Colours and tokens:** warm paper `#f6f1e7`, forest `#173b2b`, dark report `#142e23`, restrained amber `#92501f`, moss and white action labels maintain the reference's surface balance. Focus outlines remain visible; selected goals use forest and white.
- **Image quality and fidelity:** six separately generated WebP assets cover hero, dry leaf, infusion, liquor/aroma, milk response and report artwork. The subjects, warm lighting and porcelain/wood/stone materials reproduce the chosen art direction. No CSS art, fabricated SVG imagery or placeholder shapes substitute for photos. All nine image instances loaded in the final desktop check. Imagery and the report are visibly identified as illustrative.
- **Copy and content:** the selected headline, goal framing and four stages are present. Existing operator descriptions/FAQs and authoritative plan data supersede concept copy. Fake hero scores, guaranteed cost-saving language and unverified certification claims from the prior static presentation were removed from the redesigned components/default FAQ wording. Detailed-report availability is explicit; the example contains no numeric customer results.

## Interaction and accessibility checks

- All three goal buttons update the description, audience and linked plan. State uses `aria-pressed`; changes are announced through polite live regions.
- Primary hero link navigates to `#plans`; method link targets the real process section.
- Report summary opens and closes by keyboard Enter, exposing an accessible HTML outline of report contents.
- FAQ disclosure opens; plan exclusions remain in native keyboard-accessible disclosures.
- Signature plan link opens `/blend-lab/start?plan=SIGNATURE`; the existing wizard displays the Signature entitlement and its sample quantity.
- Exactly one main landmark; shared header/footer used once, also covered by the existing shell test.
- Goal buttons exceed 44px practical touch targets; main actions are at least 44px.
- Meaningful alt text; global and local reduced-motion rules preserved.
- Browser error log: empty during review. No real project submission/payment attempted.

## Comparison history

1. Initial capture exposed transient image-loading gaps, and the desktop hero headline wrapped into two lines rather than the reference's three. Waited for actual image completion, increased the hero to 740px, adjusted display width/size and recaptured. All images then rendered. Post-fix evidence: `blend-workshop-hero.png` and `comparison-hero.png`.
2. First normalized full/hero comparison showed undersized headline/actions and insufficient desktop left margin. Increased headline to 92px, primary actions to 54px high/14px type and aligned the content to a 1280px editorial width. Recaptured and inspected updated `comparison-hero.png`, `comparison-process.png` and `comparison-full.png` together. No further P0/P1/P2 fixes were required.
3. Mobile review found the FAQ line break needed explicit whitespace when hidden. Added the space and verified the narrow layout/accessible title. Post-fix evidence: final mobile and 320px captures.

## Expected differences and follow-up polish

The shared store header/footer and wholesale trigger remain part of the real site,
rather than being replaced by the concept's shorter shell. The FAQs and full
catalogue deliverables/exclusions are retained. Detailed production copy makes
plan cards taller than the mock. Admin image replacement remains supported; fixed
process/report art is shipped as editorial assets. There is no claim of pixel-perfect
identity, guaranteed conversion or full WCAG certification.

P3: verified facility photography could later replace the disclosed illustrations.
Formal assistive-technology and field performance audits were not part of this visual pass.

## Implementation checklist

- [x] Selected composition and individual image assets implemented.
- [x] Reference and rendered captures opened in combined comparison inputs.
- [x] Desktop/tablet/mobile composition reviewed; no remaining P0/P1/P2 issues.
- [x] Core landing interactions and existing intake handoff exercised.
- [x] Regression checks and repository validation recorded in `docs/TESTING.md`.

final result: passed
