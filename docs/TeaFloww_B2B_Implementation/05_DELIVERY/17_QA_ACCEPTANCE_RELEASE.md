# QA, Acceptance Criteria, Deployment & Rollback

## Release contract

**Not launchable until:** verified claims, real assets, consent handling, verified business contact, two live routes, secured lead storage, CRM delivery, full test lead, analytics and final owner approval. Deploying a page is separate from activating a paid campaign.

## Acceptance test matrix

| ID | Scenario | Expected outcome | Severity |
|---|---|---|---|
| QA-001 | Visit starter URL via Google ad on 360px phone | Business proposition + primary CTA clear, correct locale; no horizontal overflow | P0 |
| QA-002 | Visit trader URL with approved UTMs | Correct quote wording, no retail B2C checkout push | P0 |
| QA-003 | Switch starter ↔ trader | Correct content and form default; no stale page headings | P0 |
| QA-004 | Navigate keyboard-only | Focus visible and logical, no keyboard trap, active switch announced | P0 |
| QA-005 | Screen reader traverses page | Single H1, logical H2/H3, form labels/errors, link purpose clear | P0 |
| QA-006 | Submit invalid phone or pincode | Accessible inline error; no API persistence | P0 |
| QA-007 | Submit valid lead | Exactly one DB lead, reference displayed and sales queue receives it | P0 |
| QA-008 | Double-click or network retry | One lead; same reference; changed payload with same idempotency key => 409 | P0 |
| QA-009 | CRM integration offline | Lead saved, outbox retried, sales alerted; not silently lost | P0 |
| QA-010 | Opt out analytics marketing | Tags respect consent; operational lead still saved where permitted | P0 |
| QA-011 | Click WhatsApp CTA | Opens **verified** number; only a click event, not a qualified conversation | P0 |
| QA-012 | Background video disabled | Page still compelling and usable; no invisible content or jump | P1 |
| QA-013 | Slow 3G / data saver | Core message, image placeholder and form usable with minimal JS | P1 |
| QA-014 | Test English and Hindi | No overflow, mixed numerals fine, errors and consent translated | P1 |
| QA-015 | Existing shop/cart/checkout/private-label | No regressions; existing ads unaffected | P0 |
| QA-016 | Purchase and quote tracking | No B2C Purchase emitted for a B2B quote; sales goal independent | P0 |
| QA-017 | Fictitious or missing photo asset | Graceful fallback or blocks promotion; never renders broken image | P0 |
| QA-018 | Unapproved MOQ/fee/speed statement | Absent from published site and ads | P0 |
| QA-019 | Broken consent script / GA error | Form and primary CTA still operate | P0 |
| QA-020 | Ineligible/unsupported ad asset | Flag as blocked, do not change to another account or bypass | P0 |

## Performance targets — engineering budgets, not audited current metrics

| Measure | Desired staging target | Technique |
|---|---|---|
| Mobile LCP | ≤2.5s at p75 when realistic field data permit | Compressed image, preloading only hero, simple server HTML |
| INP | ≤200ms at p75 where measurable | Small client island, avoid heavy animation/third-party scripts |
| CLS | ≤0.1 | Reserve image dimensions, reserve font metrics, stable sticky CTA |
| Initial JS (B2B route) | Team target ≤150KB compressed if compatible with existing bundle | No carousels/large video runtime in fold |
| Hero media | WebP/AVIF optimized per breakpoint; real asset choice | Art direction, sizes, explicit aspect ratio |
| Accessibility | WCAG 2.2 AA minimum | Semantic controls, contrast, focus, tested validation |

These are goals rather than guarantees. Use WebPageTest/Lighthouse plus real Chrome UX Report/field measurements when available, and record actual results before claims about speed.

## Design QA: pixel and interaction

Capture and compare exactly these layouts: 320×700, 360×800, 390×844, 768×1024, 1024×768, 1440×900 and 1920×1080. Include both segment pages plus error/success states. Inspect: hero headline wrapping, product pack imagery scale, equal card gutters, CTA hierarchy, one logo treatment, balanced gold accents, type baseline, safe-area bottom bar and modal-free locale switch. Verify reduced-motion mode and 200% zoom.

### Playwright sample: `tests/e2e/business-landing.spec.ts`

```ts
import { test, expect } from '@playwright/test';

const routes = [
  { path: '/start-tea-business', heading: /start.*tea business/i },
  { path: '/tea-traders', heading: /tea supply|wholesale/i },
];

for (const route of routes) {
  test(`${route.path} is usable on narrow mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(route.path);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(route.heading);
    await expect(page.getByRole('link', { name: /quote|pricing/i }).first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });
}

test('invalid phone is rejected and errors are understandable', async ({ page }) => {
  await page.goto('/start-tea-business');
  await page.getByLabel('Delivery pincode').fill('734001');
  await page.getByLabel('Your name').fill('Sample Buyer');
  await page.getByLabel('Mobile number').fill('12345');
  await page.getByLabel(/I agree TeaFloww may contact/i).check();
  await page.getByRole('button', { name: /request.*quote|send.*enquiry/i }).click();
  await expect(page.getByText(/valid.*mobile|mobile.*number/i)).toBeVisible();
});
```

> The test uses labels and CTA matchers from the draft code. Adjust selectors only to actual **accessible names**, not brittle CSS classes. The current draft form may show server errors rather than inline phone validation until FE completes it: a deliberate acceptance requirement, not a claim of finished code.

### Unit assertions: `tests/unit/business-constraints.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { businessLeadSchema } from '@/lib/business/schema';

const base = {
  segment: 'starter', interest: 'bulk_supply', quantityBand: 'unsure',
  pincode: '734001', name: 'Sample Buyer', phone: '9876543210',
  contactConsent: true, marketingConsent: false, attribution: {},
};

describe('business lead payload', () => {
  it('accepts intended buyer input', () => {
    expect(businessLeadSchema.safeParse(base).success).toBe(true);
  });
  it('rejects invalid pincode', () => {
    expect(businessLeadSchema.safeParse({ ...base, pincode: '123' }).success).toBe(false);
  });
  it('requires consent to contact about requested quotation', () => {
    expect(businessLeadSchema.safeParse({ ...base, contactConsent: false }).success).toBe(false);
  });
});
```

## Backend integration contract tests

1. Valid request with UUID idempotency key -> HTTP 201 and opaque lead reference; one DB record and outbox row.
2. Same request/key -> HTTP 200 or 201 with the **same reference**, no second lead.
3. Same key/different payload -> HTTP 409, no overwrite.
4. Oversized request, invalid content type, unsupported Origin, bot/honeypot and high rate -> appropriate bounded errors, no PII disclosure.
5. Persisted lead but CRM down -> API success, outbox pending; internal operator alert.
6. Two concurrent identical requests -> database unique key and transaction ensure only one lead.
7. Missing/invalid UTM -> sanitize or drop untrusted source; no raw input reflected in HTML/email.
8. Backend throws -> user safe error, request ID for internal logs, no stack traces.

## Browser and device coverage

- Chrome Android mid/low-end; Safari iOS; Chrome desktop; Firefox desktop; Edge desktop.
- Slow network, data saver, no JS for static value proposition, media blocked, fonts delayed, screen magnification 200%, reduced motion.
- Test bidi/wrapping only if later locale requires it; Hindi and Bengali font and punctuation review.

## Security/PII acceptance

Refer to `24_SECURITY_PRIVACY_OPERATIONS.md`. Minimum: server-side schema validation, same-origin/CSRF protection, abuse protection, secret-free clients, encrypted backups, role-based lead access, audit of exports, controlled retention/deletion, consent gating, no phone/email in analytics or URLs.

## Production deployment checklist

- [ ] Real source repository reviewed and branch/preview deployed.
- [ ] Secrets present only in deployment environment, rotated/tested, never in screenshots or logs.
- [ ] DB migrations reviewed with rollback, no duplicate lead tables.
- [ ] Approved official copy and actual owned images published.
- [ ] DNS/CDN/cache, robots/index, sitemap and canonical verified for new routes.
- [ ] Test enquiry received by CRM and sales with source retained.
- [ ] Meta Pixel and GA4 checked through official debugging tools without false “qualified” events.
- [ ] Consent tested on first visit, accepted, denied and preference changed.
- [ ] Monitoring/alert for lead delivery; QA verifies operator can see next action.
- [ ] Owner signs off routes, offers, landing pages, ads, geo and **exact spend**.
- [ ] Existing retail/shop/cart/checkout remain functional.

## Rollback plan

Use feature flag `businessLandingEnabled` and route-level kill switch. On blocking fault: immediately pause affected paid destinations, disable new business forms or route to existing approved inquiry path **only if source tracking and semantics remain valid**, preserve durable leads, notify sales, roll back front-end release or database change with approved migration plan. Never delete lead records to hide a deployment error. Retrospective should record affected leads and time windows.

## Go / no-go record template

```text
Release version:
Environment:
B2B routes tested:
Verified phone:
Claims sign-off:
Contact privacy/consent sign-off:
Lead→CRM test reference:
Meta lead attribution verified:
Google Ads conversion verified:
Shipping/MOQ quotation terms verified:
Approved campaign names and budgets:
Owner approval / timestamp:
Rollback owner:
GO / NO-GO:
```
