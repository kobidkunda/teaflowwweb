# Premium UI Engineering Add-On — Product Stage, Proof Gallery, Sticky CTA & Motion

The core CSS and TSX are in `09_CODE_DESIGN_FOUNDATION.md` and `10_CODE_LANDING_PAGES.md`. This module adds visual distinction without bloating lower-cost mobile phones. **Every code block represents a target path in the actual repository; the ZIP contains Markdown only.**

## Design intent: “Tea origin + high-credibility business commerce”

Build a **forest-green editorial hero**, gold accent line, warm cream paper backdrop, clean product-stage composition, one primary CTA and geometric typography. Avoid generic SaaS dashboards, fake business profit charts, 3D parallax, autoplay background videos or skeleton-heavy spinners. The objective is premium credibility and straightforward buying steps.

### Desktop first fold (1440w) visual assembly

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ TEAFLOWW                 Wholesale   Private Label   How it works   HI/EN │
│                               START YOUR TEA BUSINESS ↗               │
├──────────────────────────────────────┬───────────────────────────────────┤
│  SILIGURI • TEA BUSINESS PARTNERS    │     [AUTHENTIC PRODUCT PHOTO]    │
│                                      │      ┌───────────────┐           │
│  Build your tea business.            │  ┌───┤ 25 KG SACK     │           │
│  We support the supply.              │  │   └───────────────┘           │
│                                      │  │ 250g   500g   1kg            │
│  Bulk tea • Retail packs             │  └─────────────────────┐        │
│  Private label • Design support      │   Siliguri supply       │        │
│                                      │   Pack formats to quote │        │
│  [ Build My Quote ↗ ]  See formats   │  └───────────────────────┘        │
│                                      │                                   │
│  ○ I'm Starting   ○ I Already Trade │    GENUINE TEAFLOWW MATERIALS    │
├──────────────────────────────────────┴───────────────────────────────────┤
│                 THREE WAYS TO PARTNER WITH US                            │
│    ┌────────────────┐ ┌─────────────────┐ ┌───────────────────┐           │
│    │  25kg bulk     │ │ Retail pouches │ │ Own-label support │           │
│    └────────────────┘ └─────────────────┘ └───────────────────┘           │
└──────────────────────────────────────────────────────────────────────────┘
```

The right half is a **product evidence area** with real photographs, not a fabricated picture. The footer proof pill may appear only for an independently verified claim. Keep the hero copy and CTA as live HTML, never baked into the image.

## 1. Product-stage component — `src/components/business/PackFormatStage.tsx`

Use approved files that the business owns. Replace photo paths with actual CMS asset URLs or conditionally omit the image until verified. `aria-label` labels the visual region; individual images retain meaningful alt text.

```tsx
import Image from 'next/image';

type ProductPhoto = {
  src: string;
  alt: string;
  label: string;
  size: 'large' | 'small';
};

export function PackFormatStage({ photos }: { photos: ProductPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <div className="tf-stage" aria-label="Available tea packing formats">
      <div className="tf-stage__glow" aria-hidden="true" />
      <span className="tf-stage__micro">SILIGURI • TEA SUPPLY</span>
      <div className="tf-stage__grid">
        {photos.map((photo, index) => (
          <figure key={`${photo.src}-${index}`}
            className={`tf-stage__item tf-stage__item--${photo.size}`}>
            <div className="tf-stage__frame">
              <Image src={photo.src} alt={photo.alt} fill
                sizes="(max-width: 640px) 46vw, 24vw"
                priority={index === 0}
                style={{ objectFit: 'contain' }} />
            </div>
            <figcaption>{photo.label}</figcaption>
          </figure>
        ))}
      </div>
      <p className="tf-stage__footnote">
        Illustrative format selection. Availability and commercial terms in quotation.
      </p>
    </div>
  );
}
```

### CSS for product stage and editorial presentation — `src/app/business-premium.css`

```css
/* Use alongside 09_CODE_DESIGN_FOUNDATION.md. All colors read from design tokens. */
.tf-stage {
  --stage-cream: #fff7e8;
  position: relative;
  min-width: 0;
  isolation: isolate;
  overflow: hidden;
  padding: clamp(1.25rem, 3vw, 2.25rem);
  border-radius: 2rem;
  border: 1px solid rgba(246, 232, 215, .22);
  background: linear-gradient(153deg, #275a44 0%, #0a362b 58%, #062b23 100%);
  box-shadow: 0 36px 70px rgba(0, 28, 19, .22);
}
.tf-stage__glow {
  position: absolute;
  z-index: -1;
  inset: -22% -15% auto auto;
  width: 70%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(216, 179, 108, .25), transparent 68%);
  pointer-events: none;
}
.tf-stage__micro {
  color: #f3caa6;
  font-size: .73rem;
  letter-spacing: .18em;
  font-weight: 800;
}
.tf-stage__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  align-items: end;
  gap: clamp(.5rem, 1vw, .85rem);
  margin-block: 1.5rem 1.15rem;
}
.tf-stage__item { margin: 0; min-width: 0; }
.tf-stage__frame {
  position: relative;
  isolation: isolate;
  width: 100%;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border-radius: 1.1rem;
  background: linear-gradient(165deg, #f6e8d7, #f3caa6 65%, #e3c18d);
  box-shadow: 0 13px 30px rgba(2, 18, 12, .17);
}
.tf-stage__item--large .tf-stage__frame { aspect-ratio: 3 / 4; }
.tf-stage__frame img { padding: .6rem; }
.tf-stage figcaption {
  color: var(--stage-cream);
  font-size: .78rem;
  font-weight: 700;
  text-align: center;
  margin-top: .7rem;
}
.tf-stage__footnote { margin: .7rem 0 0; font-size: .75rem; color: #f6e8d7; line-height: 1.6; }
@media (max-width: 500px) {
  .tf-stage { border-radius: 1.3rem; padding: .9rem; }
  .tf-stage__grid { margin-block: .8rem; gap: .45rem; }
  .tf-stage__frame { border-radius: .7rem; }
  .tf-stage__frame img { padding: .3rem; }
  .tf-stage figcaption { font-size: .68rem; }
}
```

**Do not place unsupported private-label packaging prototypes next to owned inventory as if already commercially produced.** Add `concept example` in captions if they are visual samples.

## 2. Elegant reusable proof gallery — `src/components/business/ProofGallery.tsx`

```tsx
import Image from 'next/image';

type ProofItem = {
  title: string;
  eyebrow: string;
  description: string;
  imageSrc: string;
  alt: string;
  span?: 'wide' | 'normal';
};

export function ProofGallery({ items }: { items: ProofItem[] }) {
  return (
    <div className="tf-proof-grid">
      {items.map((item) => (
        <article className={`tf-proof tf-proof--${item.span ?? 'normal'}`} key={item.title}>
          <div className="tf-proof__media">
            <Image src={item.imageSrc} alt={item.alt} fill
              sizes="(max-width: 680px) 100vw, 50vw"
              style={{ objectFit: 'cover' }} />
          </div>
          <div className="tf-proof__body">
            <p className="tf-proof__eyebrow">{item.eyebrow}</p>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
```

```css
.tf-proof-grid {
  display: grid;
  grid-template-columns: repeat(12,minmax(0,1fr));
  gap: clamp(.8rem, 1.5vw, 1.5rem);
}
.tf-proof {
  grid-column: span 4;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fffdf9;
  border: 1px solid rgba(6,59,47,.12);
  border-radius: 1.7rem;
  box-shadow: 0 10px 38px rgba(12,40,53,.06);
}
.tf-proof--wide { grid-column: span 8; }
.tf-proof__media { position: relative; width:100%; aspect-ratio: 5/4; background:#e6e3d8; }
.tf-proof--wide .tf-proof__media { aspect-ratio: 16/7; }
.tf-proof__body { padding: clamp(1.1rem,2vw,1.8rem); }
.tf-proof__eyebrow { color:#8b5e3c; font-size:.72rem; letter-spacing:.12em; font-weight:800; }
.tf-proof h3 { color:#063b2f; font-size:clamp(1.3rem,2vw,1.8rem); margin:.3rem 0 .6rem; }
.tf-proof p:not(.tf-proof__eyebrow) { color:#425458; line-height:1.65; margin:0; }
@media(max-width:900px) { .tf-proof,.tf-proof--wide { grid-column:span 6; } }
@media(max-width:640px) { .tf-proof,.tf-proof--wide { grid-column:span 12; } .tf-proof--wide .tf-proof__media { aspect-ratio:5/4; } }
```

## 3. Sticky bottom CTA — `src/components/business/StickyLeadBar.tsx`

Keep the quotation CTA available on mobile without obscuring legal or form controls. Pure server component; no unnecessary JS. Hide when the quote section is visible *only if* a small optional IntersectionObserver client enhancement is tested. CSS handles mobile display.

```tsx
import { ButtonLink } from '@/components/ui/ButtonLink';

export function StickyLeadBar({ label }: { label: string }) {
  return (
    <aside className="tf-mobile-bar" aria-label="Quick business enquiry">
      <div className="tf-mobile-bar__hint" aria-hidden="true">SILIGURI</div>
      <ButtonLink href="#business-quote" variant="gold">{label}</ButtonLink>
    </aside>
  );
}
```

```css
.tf-mobile-bar__hint { color:#063b2f; font-weight:800; font-size:.65rem; letter-spacing:.12em; }
:focus-visible { outline: 3px solid #d8b36c; outline-offset: 3px; }
html { scroll-padding-top: 6rem; }
@media (min-width: 601px) { .tf-mobile-bar { display:none; } }
```

Use `scroll-margin-top: 6rem` on the form's target and reserve enough body padding for the sticky bar. If the sticky CTA lacks sufficient contrast or covers a mobile consent banner, adjust its placement, don't shrink tap targets below accessibility size.

## 4. Conversion-aware section navigation — `src/components/business/JumpNav.tsx`

```tsx
export function JumpNav() {
  const links = [
    { href:'#solutions', text:'Supply options' },
    { href:'#process', text:'How it works' },
    { href:'#proof', text:'What you receive' },
    { href:'#faq', text:'Questions' },
  ];
  return <nav aria-label="On this page" className="tf-jump-nav">
    {links.map((link) => <a key={link.href} href={link.href}>{link.text}</a>)}
  </nav>;
}
```

```css
.tf-jump-nav { display:flex; flex-wrap:wrap; gap:.6rem; align-items:center; padding-block:1rem; }
.tf-jump-nav a { color:#063b2f; background:#fffdf9; border:1px solid #d7d7c7; padding:.55rem .95rem; border-radius:100px; text-decoration:none; font-size:.84rem; font-weight:700; }
.tf-jump-nav a:hover, .tf-jump-nav a:focus-visible { background:#f6e8d7; }
@media (max-width:480px) { .tf-jump-nav { overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; } .tf-jump-nav a { white-space:nowrap; } }
```

## 5. Luxury without weight: subtle reveal and micro-motion

```css
/* Animate only paint/composite properties, and only for intentional actions. */
.tf-card, .tf-proof { transition: transform 180ms ease, box-shadow 180ms ease; }
@media (hover:hover) and (prefers-reduced-motion: no-preference) {
  .tf-card:hover, .tf-proof:hover {
    transform: translateY(-4px);
    box-shadow: 0 18px 50px rgba(12,40,53,.09);
  }
}
@media (prefers-reduced-motion: reduce) {
  .tf-card, .tf-proof { transition: none; }
}
```

No scroll-jacking, WebGL video backgrounds or autoplay background footage on budget phones. A premium mobile experience is visually rich **and** instantly usable.

## 6. Integration example

```tsx
// src/components/business/BusinessLanding.tsx (section-level excerpt, not a replacement file)
import { ProofGallery } from './ProofGallery';
import { StickyLeadBar } from './StickyLeadBar';
import { JumpNav } from './JumpNav';

// ... inside the composed page, after BusinessHero:
// <div className="tf-container"><JumpNav /></div>
// <ProofGallery items={approvedProofItems} />
// <StickyLeadBar label={content.primaryCta} />
```

`approvedProofItems` must be fetched/created from signed-off CMS proof data. It is intentionally undefined in this excerpt until the business provides real assets. **Do not copy this excerpt as a full module or claim build success without wiring actual data.**

## Uniformity checklist

One color/token set; one button component; one global container width; one field style; one card geometry; consistent optical alignment; one typography scale; same CTA language per audience; one icon system; one photography art direction; one scroll/focus policy; identical components in both routes except content props. Review screenshots at 320/360/390/768/1440 and verify Hindi text wrapping.
