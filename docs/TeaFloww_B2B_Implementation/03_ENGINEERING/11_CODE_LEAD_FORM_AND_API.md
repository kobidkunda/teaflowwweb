# Copyable Code — Conversion-Optimized Lead Form, Validation & API

## Contract

`POST /api/business-leads` accepts a **first-party trade enquiry**, validates it on the server, saves it with an idempotency key, and returns `{ reference }` only after the DB transaction succeeds. A click on WhatsApp is a separate diagnostic event and is **not** assumed to be a received or qualified conversation.

### User-visible information groups (five)

1. **Business stage** — `starter` or `trader`, preselected by route.
2. **Interest** — `bulk_supply`, `ready_retail`, `private_label`, or `unsure`.
3. **Quantity** — `25-49`, `50-99`, `100-249`, `250-plus`, or `unsure` kg bands; these are lead qualification options, **not guaranteed available MOQs**.
4. **Destination** — six-digit Indian pincode (sales can verify serviceability).
5. **Contact** — name + Indian mobile as one visual group.

Additional: required contact-for-quote consent, optional marketing consent, invisible anti-spam honeypot; optional notes added only after base form/when trader needs them. Never make the customer choose a tea grade just to ask for a quote.

## 1. `src/lib/business/schema.ts`

```ts
import { z } from 'zod';

export const businessLeadSchema = z.object({
  segment: z.enum(['starter', 'trader']),
  interest: z.enum(['bulk_supply', 'ready_retail', 'private_label', 'unsure']),
  quantityBand: z.enum(['25-49', '50-99', '100-249', '250-plus', 'unsure']),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a 6-digit Indian pincode'),
  name: z.string().trim().min(2).max(90),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid Indian mobile number'),
  contactConsent: z.literal(true),
  marketingConsent: z.boolean().default(false),
  company: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
  // Campaign fields are untrusted; whitelist with strict lengths.
  attribution: z.object({
    utm_source: z.string().max(100).optional(),
    utm_medium: z.string().max(100).optional(),
    utm_campaign: z.string().max(150).optional(),
    utm_content: z.string().max(150).optional(),
    utm_term: z.string().max(150).optional(),
    gclid: z.string().max(250).optional(),
    gbraid: z.string().max(250).optional(),
    wbraid: z.string().max(250).optional(),
    fbclid: z.string().max(250).optional(),
  }).default({}),
  honeypot: z.string().max(120).optional(),
});

export type BusinessLeadInput = z.infer<typeof businessLeadSchema>;
```

Phone validation above handles standard **10-digit Indian mobile** entries. For international trade leads, use an E.164-aware phone parser and country selector after defining operating countries. For India, accept user-friendly input formats only after normalizing them safely server-side.

## 2. `src/lib/business/attribution.ts` — allowlist only

```ts
import type { BusinessLeadInput } from './schema';

type Attribution = BusinessLeadInput['attribution'];

const ALLOWED = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'gclid', 'gbraid', 'wbraid', 'fbclid',
] as const;

export function collectAttribution(search: string): Attribution {
  const params = new URLSearchParams(search);
  const record: Record<string, string> = {};
  for (const key of ALLOWED) {
    const value = params.get(key)?.trim();
    if (value) record[key] = value.slice(0, key.startsWith('utm_') ? 150 : 250);
  }
  return record;
}
```

Attribution only uses the current URL. If this journey crosses pages and needs persistent attribution, wire a consent-aware first-party solution that expires quickly and document its retention. Never stash phone/name in URL parameters or ad-tracking events.

## 3. `src/components/business/BusinessLeadForm.tsx` — functional form

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { FormField } from '@/components/ui/FormField';
import type { OfferId, Segment } from '@/lib/business/content';
import { collectAttribution } from '@/lib/business/attribution';
import { trackBusinessEvent } from '@/lib/business/events';

type Interest = OfferId | 'unsure';
type QuantityBand = '25-49' | '50-99' | '100-249' | '250-plus' | 'unsure';

type Draft = {
  segment: Segment;
  interest: Interest;
  quantityBand: QuantityBand;
  pincode: string;
  name: string;
  phone: string;
  contactConsent: boolean;
  marketingConsent: boolean;
  honeypot: string;
};

export function BusinessLeadForm({
  segment,
  selectedOffer,
}: {
  segment: Segment;
  selectedOffer?: OfferId;
}) {
  const [form, setForm] = useState<Draft>({
    segment, interest: selectedOffer ?? 'unsure', quantityBand: 'unsure',
    pincode: '', name: '', phone: '', contactConsent: false,
    marketingConsent: false, honeypot: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const idempotency = useRef<string | null>(null);

  useEffect(() => {
    if (selectedOffer) setForm((current) => ({ ...current, interest: selectedOffer }));
  }, [selectedOffer]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting' || status === 'success') return;
    setStatus('submitting');
    setMessage('');
    idempotency.current ??= crypto.randomUUID();

    try {
      const response = await fetch('/api/business-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotency.current,
        },
        body: JSON.stringify({
          ...form,
          attribution: collectAttribution(window.location.search),
        }),
      });
      const data: { reference?: string; error?: string } = await response.json();
      if (!response.ok || !data.reference) {
        throw new Error(data.error ?? 'We could not submit your enquiry.');
      }
      setReference(data.reference);
      setStatus('success');
      trackBusinessEvent('business_quote_submit', { segment, interest: form.interest });
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Please try again.');
      // Reuse the same idempotency key after network errors to avoid duplicates.
    }
  }

  if (status === 'success') {
    return (
      <div className="tf-form-stack" role="status" aria-live="polite">
        <h3 style={{ fontSize: '1.7rem', margin: 0 }}>Enquiry received.</h3>
        <p>Thank you. Your reference is <strong>{reference}</strong>.</p>
        <p className="tf-note">We will review the requirements and contact you.
          MOQ, pricing, taxes, freight and timings are confirmed in the quotation.</p>
      </div>
    );
  }

  return (
    <form className="tf-form-stack" onSubmit={submit} noValidate>
      <div className="tf-field">
        <label htmlFor="tf-stage">Your business stage</label>
        <select id="tf-stage" value={form.segment}
          onChange={(e) => update('segment', e.target.value as Segment)}>
          <option value="starter">I want to start a business</option>
          <option value="trader">I already trade tea</option>
        </select>
      </div>
      <div className="tf-field">
        <label htmlFor="tf-interest">What are you interested in?</label>
        <select id="tf-interest" value={form.interest}
          onChange={(e) => update('interest', e.target.value as Interest)}>
          <option value="unsure">Help me choose</option>
          <option value="bulk_supply">Bulk tea / 25kg sacks</option>
          <option value="ready_retail">250g–1kg ready retail packs</option>
          <option value="private_label">My own tea brand / private label</option>
        </select>
      </div>
      <div className="tf-field">
        <label htmlFor="tf-quantity">Your planned first-order quantity</label>
        <select id="tf-quantity" value={form.quantityBand}
          onChange={(e) => update('quantityBand', e.target.value as QuantityBand)}>
          <option value="unsure">Not sure yet</option>
          <option value="25-49">25–49kg</option>
          <option value="50-99">50–99kg</option>
          <option value="100-249">100–249kg</option>
          <option value="250-plus">250kg or more</option>
        </select>
        <small className="tf-note">This is a planning range, not a guaranteed MOQ.</small>
      </div>
      <FormField
        id="tf-pincode" label="Delivery pincode" value={form.pincode}
        inputMode="numeric" autoComplete="postal-code" maxLength={6}
        onChange={(e) => update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
        required pattern="[0-9]{6}"
      />
      <div className="tf-form-row">
        <FormField id="tf-name" label="Your name" autoComplete="name" required
          value={form.name} onChange={(e) => update('name', e.target.value)} />
        <FormField id="tf-phone" label="Mobile number" required inputMode="tel"
          autoComplete="tel-national" value={form.phone}
          onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
          pattern="[6-9][0-9]{9}"
        />
      </div>
      <label className="tf-form-checkbox">
        <input type="checkbox" required checked={form.contactConsent}
          onChange={(e) => update('contactConsent', e.target.checked)} />
        <span>I agree TeaFloww may contact me about this enquiry.</span>
      </label>
      <label className="tf-form-checkbox">
        <input type="checkbox" checked={form.marketingConsent}
          onChange={(e) => update('marketingConsent', e.target.checked)} />
        <span>Optional: send me relevant future business offers.</span>
      </label>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
        <label htmlFor="tf-company-site">Leave this blank</label>
        <input id="tf-company-site" tabIndex={-1} autoComplete="off"
          value={form.honeypot} onChange={(e) => update('honeypot', e.target.value)} />
      </div>
      <button className="tf-button tf-button--gold" type="submit"
        disabled={status === 'submitting' || !form.contactConsent}>
        {status === 'submitting' ? 'Submitting…' : 'Request My Quote →'}
      </button>
      {status === 'error' && <p role="alert" className="tf-error">{message}</p>}
      <p className="tf-note">Your enquiry is not an order. See our Privacy Policy.
        Commercial terms are confirmed separately.</p>
    </form>
  );
}
```

**Integration hardening before launch:** the example uses server validation plus a generic server error message. Implement *field-level client validation*, safe message localization, required privacy link, complete `<html lang>` behavior, consent-manager hooks, accessible error-summary focus and `trackBusinessEvent` definition from the next file. Never show raw database errors to a visitor. Do not suppress all HTML validation without replacing it with accessible errors—either remove `noValidate` for a native baseline or add per-field Zod validation on the client.

## 4. `src/app/api/business-leads/route.ts` — trusted server-only persistence

```ts
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { businessLeadSchema } from '@/lib/business/schema';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  const siteOrigin = process.env.SITE_ORIGIN;
  if (!siteOrigin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503, headers });
  }
  if (request.headers.get('origin') !== siteOrigin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers });
  }
  if (Number(request.headers.get('content-length') ?? 0) > 8192) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers });
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'JSON required' }, { status: 415, headers });
  }

  const key = request.headers.get('idempotency-key');
  if (!key || !/^[a-f0-9-]{36}$/i.test(key)) {
    return NextResponse.json({ error: 'Invalid request token' }, { status: 400, headers });
  }

  try {
    // Production: enforce an edge/WAF + shared durable rate limit before parsing.
    const raw: unknown = await request.json();
    const parsed = businessLeadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please review your details' }, { status: 422, headers });
    }
    const lead = parsed.data;

    // Honeypot hits are rejected without storing contact data.
    if (lead.honeypot) {
      return NextResponse.json({ error: 'Please retry' }, { status: 400, headers });
    }
    const created = await prisma.businessLead.create({ data: {
      idempotencyKey: key,
      segment: lead.segment,
      interest: lead.interest,
      quantityBand: lead.quantityBand,
      pincode: lead.pincode,
      name: lead.name,
      phone: lead.phone,
      contactConsentAt: new Date(),
      marketingConsentAt: lead.marketingConsent ? new Date() : null,
      utmSource: lead.attribution.utm_source ?? null,
      utmMedium: lead.attribution.utm_medium ?? null,
      utmCampaign: lead.attribution.utm_campaign ?? null,
      utmContent: lead.attribution.utm_content ?? null,
      utmTerm: lead.attribution.utm_term ?? null,
      gclid: lead.attribution.gclid ?? null,
      gbraid: lead.attribution.gbraid ?? null,
      wbraid: lead.attribution.wbraid ?? null,
      fbclid: lead.attribution.fbclid ?? null,
    } });
    // Production: enqueue CRM notification using a durable job/outbox on commit.
    return NextResponse.json({ reference: created.reference }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const previous = await prisma.businessLead.findUnique({ where: { idempotencyKey: key } });
      if (previous) return NextResponse.json({ reference: previous.reference }, { status: 200, headers });
    }
    // Log securely on server with request correlation ID, never response details.
    return NextResponse.json({ error: 'Could not save enquiry. Please retry.' }, { status: 500, headers });
  }
}
```

**Security additions required to call this production-ready:** shared durable rate limit (e.g., managed WAF + Redis), strict maximum body size enforced **on the request stream** rather than just `content-length`, sanitized API logging, PII access controls, DB encryption/backup, origin policy matching staging hostname, privacy retention and lead deletion. These cannot be safely supplied as a one-size-fits-all snippet without seeing hosting topology.

## 5. `src/lib/prisma.ts` — Prisma client singleton

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

## 6. Required API test cases

```text
POST valid starter payload                     → 201, reference persisted
POST valid trader payload                      → 201, reference persisted
POST same idempotency key twice                → 201 then 200; same reference
POST different payload with reused token       → reject unless exact request fingerprint matches (must add)
POST no contact consent                        → 422
POST invalid 5-digit or 7-digit pincode       → 422
POST malformed phone                           → 422
POST wrong Origin                              → 403
POST missing/incorrect Content-Type            → 415
POST over size limit                            → 413
POST honeypot                                   → 400 without storage
POST 20 automated requests quickly              → throttle; no repeated CRM notifications
CRM outage after DB commit                      → lead still exists, job retried
```

The code shown does **not yet implement payload-fingerprint conflict detection** for same idempotency key and changed body. Add that check before production; do not mistake the reference snippet for a complete final backend security review.
