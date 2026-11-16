# Copyable Code — Unified Design Tokens, Layout & Shared UI Primitives

> **Usage:** These are reference code listings. Create the named paths inside the **actual** repo (or adapt to the framework it uses). Media paths must be replaced with verified, owned photography before production. Test the assembled code in CI. All page code consumes these same design classes to guarantee uniformity.

## A. `src/app/globals.css` — premium responsive visual foundation

```css
@import "tailwindcss";

@theme {
  --color-brand-forest: #063b2f;
  --color-brand-forest-deep: #0a362b;
  --color-brand-ivory: #fffbf3;
  --color-brand-almond: #f6e8d7;
  --color-brand-honey: #d8b36c;
  --color-brand-ink: #0c2835;
  --color-brand-sage: #527f58;
  --color-brand-earth: #8b5e3c;
  --color-brand-line: #c7d0d4;
  --radius-brand-card: 1.75rem;
}

:root {
  color-scheme: light;
  --page-width: 1200px;
  --gutter: clamp(1rem, 3.5vw, 2.5rem);
  --focus-ring: #9f6500;
  --body-font: Arial, "Noto Sans Devanagari", system-ui, sans-serif;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: #fffbf3; color: #0c2835; font-family: var(--body-font); }
button, input, select, textarea { font: inherit; }
a { text-underline-offset: 4px; }
:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 3px; }
::selection { background: #d8b36c; color: #063b2f; }

.tf-container { width: min(100% - (2 * var(--gutter)), var(--page-width)); margin-inline: auto; }
.tf-section { padding-block: clamp(3.5rem, 7vw, 6.5rem); }
.tf-section--almond { background: #f6e8d7; }
.tf-section--forest { background: #063b2f; color: #fffbf3; }
.tf-eyebrow { display: block; font-size: .76rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.tf-heading { max-width: 21ch; margin: 0; font-size: clamp(2.3rem, 5vw, 4.4rem); line-height: 1.05; letter-spacing: -.045em; font-weight: 750; }
.tf-section-heading { font-size: clamp(2rem, 4vw, 3.2rem); letter-spacing: -.035em; line-height: 1.1; margin: .8rem 0 1.1rem; }
.tf-copy { max-width: 59ch; line-height: 1.7; font-size: clamp(1rem, 1.6vw, 1.12rem); }
.tf-button { display: inline-flex; justify-content: center; align-items: center; gap: .7rem; min-height: 52px; padding: .82rem 1.55rem; border: 1px solid transparent; border-radius: 9999px; text-decoration: none; font-weight: 750; font-size: .98rem; transition: background-color 170ms ease, transform 170ms ease, border-color 170ms ease; cursor: pointer; }
.tf-button:hover { transform: translateY(-2px); }
.tf-button:active { transform: translateY(0); }
.tf-button--gold { background: #d8b36c; color: #063b2f; }
.tf-button--gold:hover { background: #ebc683; }
.tf-button--forest { background: #063b2f; color: #fffdf6; }
.tf-button--forest:hover { background: #0a4b3c; }
.tf-button--outline { color: inherit; border-color: currentColor; background: transparent; }
.tf-button--outline:hover { background: rgb(255 255 255 / .08); }
.tf-button:disabled, .tf-button[aria-disabled="true"] { opacity: .55; cursor: not-allowed; transform: none; }

.tf-topbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-block: 1.1rem; }
.tf-brand { color: inherit; font-size: 1.12rem; font-weight: 900; letter-spacing: -.04em; text-decoration: none; }
.tf-nav { display: flex; align-items: center; gap: clamp(1rem, 2vw, 2rem); }
.tf-nav a { font-size: .9rem; font-weight: 650; text-decoration: none; }
.tf-nav a:hover { text-decoration: underline; }

.tf-hero { isolation: isolate; position: relative; overflow: hidden; background: #063b2f; color: #fffbf3; border-radius: 0 0 2.25rem 2.25rem; }
.tf-hero::before { content: ""; position: absolute; inset: 0; z-index: -1; background: radial-gradient(ellipse at 72% 20%, #527f5850, transparent 45%), linear-gradient(110deg, #063b2f, #0a362b); }
.tf-hero-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); align-items: center; gap: clamp(2rem, 5vw, 5rem); padding-block: clamp(3rem, 6vw, 6rem); }
.tf-hero-title { font-size: clamp(2.65rem, 6vw, 5.3rem); line-height: 1.025; letter-spacing: -.055em; max-width: 12ch; margin: 1.2rem 0; font-weight: 800; }
.tf-hero-body { max-width: 51ch; color: #f6e8d7; line-height: 1.75; font-size: clamp(1rem, 1.6vw, 1.2rem); }
.tf-hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .85rem; margin-top: 2rem; }
.tf-hero-media { min-height: 420px; height: min(50vw, 530px); overflow: hidden; border: 1px solid rgb(255 255 255 / .26); border-radius: 28px; position: relative; background: linear-gradient(145deg, #527f58, #0a362b); }
.tf-hero-media img { width: 100%; height: 100%; display: block; object-fit: cover; }
.tf-photo-caption { position: absolute; bottom: 16px; left: 16px; right: 16px; display: flex; gap: .6rem; flex-wrap: wrap; }
.tf-photo-pill { padding: .6rem .8rem; border: 1px solid rgb(255 255 255 / .25); border-radius: 999px; background: #063b2fe6; color: #fffdf6; font-weight: 700; font-size: .75rem; }

.tf-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .6rem; max-width: 670px; margin-block: 1.5rem 0; }
.tf-switch a { display: block; padding: .9rem 1.1rem; border-radius: 14px; border: 1px solid rgb(255 255 255 / .3); color: inherit; font-size: .9rem; font-weight: 750; text-decoration: none; text-align: center; }
.tf-switch a[aria-current="page"] { background: #fffbf3; border-color: #fffbf3; color: #063b2f; }

.tf-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.tf-card { display: flex; flex-direction: column; min-width: 0; padding: 1.5rem; border: 1px solid rgb(6 59 47 / .13); border-radius: 28px; background: #fffdf9; box-shadow: 0 14px 45px rgb(12 40 53 / .045); }
.tf-card h3 { font-size: 1.45rem; line-height: 1.2; margin: .9rem 0 .5rem; letter-spacing: -.025em; }
.tf-card p { font-size: 1rem; line-height: 1.6; color: #354955; }
.tf-card__link { margin-top: auto; padding-top: 1.4rem; color: #063b2f; font-weight: 800; text-underline-offset: 5px; }
.tf-card__illustration { height: 112px; border-radius: 18px; background: linear-gradient(135deg, #f6e8d7, #cadcc4); display: grid; place-items: center; color: #063b2f; }
.tf-card__illustration svg { width: 42px; height: 42px; stroke-width: 1.6; }
.tf-timeline { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.25rem; }
.tf-timeline li { position: relative; border-top: 1px solid #8b5e3c60; padding-top: 1.5rem; }
.tf-timeline b { display: inline-grid; place-items: center; width: 38px; height: 38px; border: 1px solid #8b5e3c60; border-radius: 50%; color: #063b2f; background: #fffdf8; margin-bottom: 1rem; }
.tf-timeline h3 { margin: .5rem 0; font-size: 1rem; }
.tf-timeline p { margin: 0; color: #354955; line-height: 1.6; }

.tf-form-panel { background: #063b2f; color: #fffbf3; border-radius: 30px; padding: clamp(1.5rem, 5vw, 3.4rem); display: grid; grid-template-columns: 1fr 1.2fr; gap: clamp(1rem, 5vw, 4rem); }
.tf-form-stack { display: grid; gap: .9rem; }
.tf-form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .9rem; }
.tf-field { display: grid; gap: .4rem; }
.tf-field label { font-weight: 650; font-size: .9rem; }
.tf-field input, .tf-field select, .tf-field textarea { display: block; width: 100%; min-height: 48px; border: 1px solid #8fa39a; background: #fffdf8; color: #0c2835; padding: .72rem .85rem; border-radius: 12px; }
.tf-field input[aria-invalid="true"] { border-color: #a22d25; }
.tf-error { color: #ffd5d2; font-size: .85rem; }
.tf-note { font-size: .85rem; color: #f6e8d7; line-height: 1.6; }
.tf-form-checkbox { display: flex; align-items: flex-start; gap: .65rem; line-height: 1.5; font-size: .9rem; }
.tf-form-checkbox input { width: 19px; height: 19px; flex-shrink: 0; margin-top: 2px; }
.tf-faq details { border-bottom: 1px solid #c7d0d4; padding: 1.2rem 0; }
.tf-faq summary { list-style-position: outside; font-weight: 760; cursor: pointer; }
.tf-faq p { max-width: 74ch; line-height: 1.75; color: #354955; }
.tf-mobile-bar { display: none; }

@media (max-width: 900px) {
  .tf-nav { display: none; }
  .tf-hero-grid, .tf-form-panel { grid-template-columns: 1fr; }
  .tf-hero-media { min-height: 260px; height: 390px; }
  .tf-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tf-timeline { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .tf-hero { border-radius: 0 0 20px 20px; }
  .tf-hero-grid { gap: 1.7rem; }
  .tf-hero-media { min-height: 0; height: auto; aspect-ratio: 4 / 3; border-radius: 20px; }
  .tf-hero-title { font-size: clamp(2.3rem, 9.8vw, 3.25rem); }
  .tf-hero-actions { flex-direction: column; align-items: stretch; }
  .tf-hero-actions .tf-button { width: 100%; }
  .tf-card-grid, .tf-form-row, .tf-timeline { grid-template-columns: 1fr; }
  .tf-switch { grid-template-columns: 1fr 1fr; }
  .tf-switch a { padding: .7rem .3rem; font-size: .82rem; }
  .tf-card { border-radius: 22px; }
  .tf-mobile-bar { display: flex; align-items: center; gap: .6rem; position: fixed; inset-inline: 0; bottom: 0; padding: .7rem 1rem calc(.7rem + env(safe-area-inset-bottom)); z-index: 20; background: #fffbf3ef; border-top: 1px solid #c7d0d4; backdrop-filter: blur(10px); }
  .tf-mobile-bar .tf-button { flex: 1; min-width: 0; padding-inline: .65rem; }
  .tf-page-has-sticky { padding-bottom: 84px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; }
}
```

**Build check:** Validate CSS with a linter and run visual QA on the assembled application.

## B. `src/components/ui/Section.tsx`

```tsx
import type { PropsWithChildren, ReactNode } from 'react';

type Tone = 'ivory' | 'almond' | 'forest';

type SectionProps = PropsWithChildren<{
  id?: string;
  tone?: Tone;
  eyebrow?: string;
  title?: string;
  summary?: string;
  headingSlot?: ReactNode;
}>;

export function Section({
  id,
  tone = 'ivory',
  eyebrow,
  title,
  summary,
  headingSlot,
  children,
}: SectionProps) {
  const toneClass = tone === 'almond' ? 'tf-section--almond'
    : tone === 'forest' ? 'tf-section--forest'
    : '';

  return (
    <section id={id} className={`tf-section ${toneClass}`}>
      <div className="tf-container">
        {eyebrow && <span className="tf-eyebrow">{eyebrow}</span>}
        {title && <h2 className="tf-section-heading">{title}</h2>}
        {summary && <p className="tf-copy">{summary}</p>}
        {headingSlot}
        {children}
      </div>
    </section>
  );
}
```

## C. `src/components/ui/ButtonLink.tsx`

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: 'gold' | 'forest' | 'outline';
  className?: string;
};

export function ButtonLink({
  href,
  children,
  variant = 'forest',
  className = '',
}: ButtonLinkProps) {
  return (
    <Link className={`tf-button tf-button--${variant} ${className}`} href={href}>
      {children}
    </Link>
  );
}
```

## D. `src/components/ui/FormField.tsx`

```tsx
import type { InputHTMLAttributes } from 'react';

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({ id, label, error, hint, ...props }: FormFieldProps) {
  return (
    <div className="tf-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {error && <span className="tf-error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}
```

## E. Design review test

Check computed colors and contrast, no horizontal overflow, no invisible focus, input errors with AT and all English/Hindi text at 320px. The CSS example is a **starter baseline**; formal accessibility/visual verification occurs once implemented with real assets.
