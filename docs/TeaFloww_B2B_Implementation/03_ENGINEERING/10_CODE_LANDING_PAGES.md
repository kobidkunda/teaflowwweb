# Copyable Code — Shared Premium Business Landing Pages

All code examples use the one visual system in `09_CODE_DESIGN_FOUNDATION.md`. The **exact same component tree** renders starter and trader pages; only typed content changes. This prevents future visual drift and reduces QA cost.

## 1. `src/lib/business/content.ts` — the single content source

```ts
export type Segment = 'starter' | 'trader';
export type OfferId = 'bulk_supply' | 'ready_retail' | 'private_label';

export type Offer = {
  id: OfferId;
  eyebrow: string;
  title: string;
  body: string;
  icon: 'package' | 'shopping-bag' | 'pen-tool';
};

export type BusinessContent = {
  segment: Segment;
  eyebrow: string;
  headline: string;
  intro: string;
  heroAlt: string;
  photoSrc: string;
  primaryCta: string;
  processIntro: string;
  proofTitle: string;
  proofBody: string;
  faq: Array<{ q: string; a: string }>;
};

export const offers: Offer[] = [
  { id: 'bulk_supply', eyebrow: '01 · BULK', title: 'Tea in 25kg sacks',
    body: 'Explore bulk tea grades and pack options with a quotation by volume and destination.', icon: 'package' },
  { id: 'ready_retail', eyebrow: '02 · RETAIL', title: '250g to 1kg pouches',
    body: 'Explore selected ready retail formats for local distribution and resale.', icon: 'shopping-bag' },
  { id: 'private_label', eyebrow: '03 · YOUR BRAND', title: 'Private-label tea',
    body: 'Discuss tea selection, label design, packaging, printing coordination and launch support.', icon: 'pen-tool' },
];

export const businessPages: Record<Segment, BusinessContent> = {
  starter: {
    segment: 'starter',
    eyebrow: 'SILIGURI · BUSINESS STARTER',
    headline: 'Your tea business starts here.',
    intro: 'Explore tea supply, packaging, branding and practical launch support. Tell us what you want to build.',
    heroAlt: 'Real TeaFloww tea and packaging examples photographed in Siliguri',
    photoSrc: '/images/business/approved-starter-hero.webp',
    primaryCta: 'Plan My Tea Business',
    processIntro: 'A clear way to explore your first tea trading order.',
    proofTitle: 'From tea selection to your own product.',
    proofBody: 'Discuss grade, pack format, branding and destination before you commit to a production quotation.',
    faq: [
      { q: 'Can I start without a tea brand or logo?', a: 'Yes. Explain your planned business; our team can discuss applicable brand-design options and fees.' },
      { q: 'Can I choose my own tea packaging?', a: 'Packaging methods and sizes can be discussed. Each format has its own order minimum and print requirements.' },
      { q: 'How much does it cost to start?', a: 'There is no universal figure. Tea, pack, quantity, tax, print work and delivery are covered in your tailored quote.' },
      { q: 'Can I order samples?', a: 'Ask about currently available samples, fees and shipping terms during the consultation.' },
    ],
  },
  trader: {
    segment: 'trader',
    eyebrow: 'SILIGURI · TRADE SUPPLY',
    headline: 'Source tea. Add your label. Grow your range.',
    intro: 'Compare bulk sacks, retail packs and private-label options. Share grade, order size and destination for a trade quote.',
    heroAlt: 'Actual bulk tea and retail pack samples from the TeaFloww supply workflow',
    photoSrc: '/images/business/approved-trader-hero.webp',
    primaryCta: 'Get Wholesale Quote',
    processIntro: 'A quotation process built around real commercial requirements.',
    proofTitle: 'Make the specifications clear before ordering.',
    proofBody: 'Review grade, taste requirements, artwork, production minimums, freight and sample approvals with the trade team.',
    faq: [
      { q: 'Can I specify tea grade and cup profile?', a: 'Yes. Include the target grade or send your specification for review. Any sample-matching terms are confirmed separately.' },
      { q: 'Can I add my own branded packs?', a: 'Private label formats are available for discussion. MOQ and fees depend on size, artwork and print method.' },
      { q: 'How do I compare landed cost?', a: 'Tell us order size and destination pincode. The commercial quotation should show freight and applicable taxes.' },
      { q: 'Is the next lot exactly identical?', a: 'Agree acceptance specs and samples with our sourcing team; absolute batch-identical results are not guaranteed.' },
    ],
  },
};

export const commonProcess = [
  { title: 'Your market', body: 'Tell us your location and buyer profile.' },
  { title: 'Your tea', body: 'Discuss grades, taste and available samples.' },
  { title: 'Your pack', body: 'Choose bulk, retail or own-label direction.' },
  { title: 'Clear quotation', body: 'Review MOQ, tax, freight and service scope.' },
  { title: 'Next step', body: 'Approve sample, artwork or a commercial order.' },
] as const;
```

## 2. `src/components/business/BusinessHero.tsx`

```tsx
import Image from 'next/image';
import { ButtonLink } from '@/components/ui/ButtonLink';
import type { BusinessContent } from '@/lib/business/content';

export function BusinessHero({ content }: { content: BusinessContent }) {
  return (
    <section className="tf-hero" aria-labelledby="business-hero-title">
      <div className="tf-container tf-hero-grid">
        <div>
          <span className="tf-eyebrow" style={{ color: '#d8b36c' }}>
            {content.eyebrow}
          </span>
          <h1 className="tf-hero-title" id="business-hero-title">
            {content.headline}
          </h1>
          <p className="tf-hero-body">{content.intro}</p>
          <div className="tf-hero-actions">
            <ButtonLink href="#business-quote" variant="gold">
              {content.primaryCta} <span aria-hidden="true">↗</span>
            </ButtonLink>
            <ButtonLink href="#solutions" variant="outline">Explore Solutions</ButtonLink>
          </div>
        </div>
        <div className="tf-hero-media">
          <Image
            src={content.photoSrc}
            alt={content.heroAlt}
            fill
            priority
            sizes="(max-width: 900px) 100vw, 48vw"
            style={{ objectFit: 'cover' }}
          />
          <div className="tf-photo-caption" aria-hidden="true">
            <span className="tf-photo-pill">25kg bulk option</span>
            <span className="tf-photo-pill">250g–1kg retail</span>
          </div>
        </div>
      </div>
    </section>
  );
}
```

> The `Image` source is a **placeholder path**. You must supply actual owned images, verify alt text, and use a fallback or omit this module until the source file exists. Do not generate fictitious facility photography.

## 3. `src/components/business/AudienceSwitch.tsx`

```tsx
import Link from 'next/link';
import type { Segment } from '@/lib/business/content';

const destinations = [
  { segment: 'starter', label: "I'm starting", href: '/start-tea-business' },
  { segment: 'trader', label: 'I already trade tea', href: '/tea-traders' },
] as const;

export function AudienceSwitch({ segment }: { segment: Segment }) {
  return (
    <nav className="tf-switch" aria-label="Choose your tea business stage">
      {destinations.map((item) => (
        <Link
          key={item.segment}
          href={item.href}
          aria-current={item.segment === segment ? 'page' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

When a user switches with UTM/click IDs, do not blindly append every query string to the link; add a consent-aware allowlist policy if the existing attribution system requires preservation.

## 4. `src/components/business/OfferGrid.tsx`

```tsx
import { Package, ShoppingBag, PenTool } from 'lucide-react';
import type { Offer, OfferId } from '@/lib/business/content';

const icons = {
  package: Package,
  'shopping-bag': ShoppingBag,
  'pen-tool': PenTool,
} as const;

export function OfferGrid({
  offers,
  onSelect,
}: {
  offers: Offer[];
  onSelect: (offerId: OfferId) => void;
}) {
  return (
    <div className="tf-card-grid">
      {offers.map((offer) => {
        const Icon = icons[offer.icon];
        return (
          <article key={offer.id} className="tf-card">
            <div className="tf-card__illustration" aria-hidden="true"><Icon /></div>
            <span className="tf-eyebrow" style={{ color: '#8b5e3c', marginTop: '1.2rem' }}>
              {offer.eyebrow}
            </span>
            <h3>{offer.title}</h3>
            <p>{offer.body}</p>
            <button
              type="button"
              className="tf-card__link"
              style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer' }}
              onClick={() => {
                onSelect(offer.id);
                document.getElementById('business-quote')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Discuss this option <span aria-hidden="true">↗</span>
            </button>
          </article>
        );
      })}
    </div>
  );
}
```

Note that using an in-browser scroll is acceptable **only** inside this client component. For full accessibility, handle reduced-motion and optionally move focus to the form heading, but do not unexpectedly steal focus from assistive technology.

## 5. `src/components/business/ProcessTimeline.tsx`

```tsx
import { commonProcess } from '@/lib/business/content';

export function ProcessTimeline() {
  return (
    <ol className="tf-timeline">
      {commonProcess.map((step, i) => (
        <li key={step.title}>
          <b aria-hidden="true">{String(i + 1).padStart(2, '0')}</b>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
```

## 6. `src/components/business/FaqAccordion.tsx`

```tsx
type FaqItem = { q: string; a: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="tf-faq">
      {items.map(({ q, a }) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
```

## 7. `src/components/business/BusinessLanding.tsx`

```tsx
'use client';

import { useState } from 'react';
import { AudienceSwitch } from './AudienceSwitch';
import { BusinessHero } from './BusinessHero';
import { OfferGrid } from './OfferGrid';
import { ProcessTimeline } from './ProcessTimeline';
import { FaqAccordion } from './FaqAccordion';
import { BusinessLeadForm } from './BusinessLeadForm';
import { Section } from '@/components/ui/Section';
import { businessPages, offers, type OfferId, type Segment } from '@/lib/business/content';

export function BusinessLanding({ segment }: { segment: Segment }) {
  const [selectedOffer, setSelectedOffer] = useState<OfferId | undefined>();
  const content = businessPages[segment];

  return (
    <div className="tf-page-has-sticky">
      <BusinessHero content={content} />
      <div className="tf-container"><AudienceSwitch segment={segment} /></div>
      <Section
        id="solutions"
        eyebrow="THREE WAYS TO PARTNER"
        title="Choose the format that fits your market."
        summary="Bulk supply, ready retail packs or your own label. Every option is quoted to your requirements."
      >
        <OfferGrid offers={offers} onSelect={setSelectedOffer} />
      </Section>
      <Section id="process" tone="almond" eyebrow="A CLEAR PROCESS"
        title="From your brief to a real quotation." summary={content.processIntro}>
        <ProcessTimeline />
      </Section>
      <Section id="proof" eyebrow="BEYOND THE TEA LEAF"
        title={content.proofTitle} summary={content.proofBody}>
        <p className="tf-copy">
          We confirm pack options, production requirements, applicable minimums
          and delivery terms before commercial approval.
        </p>
      </Section>
      <Section id="business-quote" tone="forest">
        <div className="tf-form-panel" style={{ padding: 0 }}>
          <div>
            <span className="tf-eyebrow" style={{ color: '#d8b36c' }}>YOUR BUSINESS QUOTE</span>
            <h2 className="tf-section-heading">Tell us what you want to build.</h2>
            <p className="tf-copy">We use your volume and pincode to discuss
              available formats and a suitable quote. We do not promise a fixed
              investment before reviewing the specification.</p>
          </div>
          <BusinessLeadForm segment={segment} selectedOffer={selectedOffer} />
        </div>
      </Section>
      <Section id="faq" eyebrow="FAQ" title="Before you get started">
        <FaqAccordion items={content.faq} />
      </Section>
    </div>
  );
}
```

**Important server/client optimization:** This simple compositional example marks the full landing client-side to demonstrate state sharing. The recommended production refinement is: keep hero, steps, FAQs and static copy as **Server Components**, and wrap only `OfferGrid` + `BusinessLeadForm` in a small client-side `BusinessQuoteExperience`. This is a deliberate future refinement to lower initial JavaScript and improve LCP.

## 8. New page files — real SEO routes

### `src/app/(business)/start-tea-business/page.tsx`

```tsx
import type { Metadata } from 'next';
import { BusinessLanding } from '@/components/business/BusinessLanding';

export const metadata: Metadata = {
  title: 'Start a Tea Business | TeaFloww Siliguri',
  description: 'Explore tea supply, 25kg bulk options, retail packs and branding support for your new tea business. Request a quote from TeaFloww Siliguri.',
  alternates: { canonical: 'https://teafloww.com/start-tea-business' },
};

export default function StartTeaBusinessPage() {
  return <BusinessLanding segment="starter" />;
}
```

### `src/app/(business)/tea-traders/page.tsx`

```tsx
import type { Metadata } from 'next';
import { BusinessLanding } from '@/components/business/BusinessLanding';

export const metadata: Metadata = {
  title: 'Wholesale Tea Supply & Private Label | TeaFloww',
  description: 'Request trade pricing for 25kg bulk tea, retail pouches and private-label packaging. Discuss volume and delivery with TeaFloww Siliguri.',
  alternates: { canonical: 'https://teafloww.com/tea-traders' },
};

export default function TeaTradersPage() {
  return <BusinessLanding segment="trader" />;
}
```

## 9. Existing-route integration

- Add only a small, discoverable B2B nav entry and footer links to existing pages. Keep current consumer catalog unaffected.
- Existing `/wholesale` and `/private-label` can display a light contextual link to these new journeys, but do not redirect all current traffic without funnel measurement.
- Keep brand logo, footer, cookie consent and global metadata shared with existing site.
- Test the pages under the real hosting rewrite, cache and CDN behavior. The new URLs are proposed until published and verified.

## 10. Asset readiness and production blocking conditions

Do not publish pages using the illustrative `/images/business/approved-*` URLs if no approved photos are present. For staging, use visual fixtures labeled `'visual placeholder'`, not invented company photographs. In production, required: real hero image, product pack size photographs, signed-off copy, verified contact and privacy policy URL, working lead API and end-to-end lead persistence.
