# SEO, Language Selection, Content Design & Credibility Copy

## Information hierarchy

1. Identify **business trade** visitor in title and first line (prevents retail consumer misclicks).
2. State the three verified options: 25kg bulk format, 250g/500g/1kg retail formats, private-label support.
3. Allow *New* vs *Existing* path choice without hiding the main content.
4. Prove supply with real product photos and approved business details.
5. Ask for a quote, not for registration or up-front business payment.

## Proposed routes and metadata

| Route | Title | Primary query theme | Canonical |
|---|---|---|---|
| `/start-tea-business` | Start a Tea Business with TeaFloww | tea business supply partner, private label tea India | Same live route only |
| `/tea-traders` | Wholesale Tea for Traders | tea wholesale Siliguri, bulk CTC tea | Same live route only |
| `/wholesale` existing | Existing consumer/B2B wholesale as currently implemented | wholesale | Existing canonical stays |
| `/private-label` existing | Existing pack configurator | private label | Existing canonical stays |

Do not add keyword stuffing, fabricated awards, false review markup or Product pricing schema on inquiry-only pages. Add Organization/LocalBusiness JSON-LD only with validated business identity/phone/address and matching visible content; FAQ structured data should not be presumed to earn rich results. Only publish hreflang for **fully translated, available pages**, not placeholders.

## Premium microcopy — approved-safe default

### Starter hero

**Eyebrow:** SILIGURI TEA BUSINESS PARTNERS  
**H1:** Start a tea business with the right supply partner.  
**Subhead:** Choose bulk tea, ready retail packs, or custom-label packaging. We can discuss brand design and launch-planning support too.  
**Primary CTA:** Build My Tea Business Quote  
**Secondary CTA:** Explore Supply Options

### Trader hero

**Eyebrow:** WHOLESALE • RETAIL • PRIVATE LABEL  
**H1:** Your tea supply, packaging and growth plans—connected.  
**Subhead:** Discuss 25kg bulk formats, 250g to 1kg retail pouches and custom blend or branding requirements from Siliguri.  
**Primary CTA:** Get Trade Pricing  
**Secondary CTA:** View Pack Formats

### Proof / logistics note

“Minimums depend on tea, packaging method and production specifications. Final price, taxes, freight and dispatch dates are confirmed in your quotation.”

### Trust note / no social proof yet

“Request actual tea samples, pack photos and written specifications for your chosen configuration.” Do **not** replace absent proof with synthetic testimonial cards.

### Empty/form validation

- Missing pincode: “Enter a 6-digit delivery pincode so we can check your destination.”
- Unknown quantity: “Not sure? Select ‘Help me choose’ and we will discuss your planned market.”
- Quote saved: “Enquiry received. Reference: {ref}. We will review your brief and contact you.”
- No verified WhatsApp number: “Use the quote form; direct messaging is temporarily unavailable.”

## Language UX — optional, never blocking

The uploaded work suggests Hindi/Hinglish and regional languages, but **India is multilingual** and tea traders may prefer English, Hindi or Bengali. Phase 1: English + fully reviewed Hindi. Bengali only after native review; later Punjabi/Marathi/Gujarati according to real lead geographic distribution. Language selector should not launch a large mandatory modal on every visit; respect user choice and offer one accessible header control.

- Default to a known site locale when available, otherwise an accessible English fallback.
- Never infer language from location so aggressively that returning users lose control.
- Persist preference in an explicitly permitted first-party setting; respect consent model. Without persistence, use route-locale URL path.
- Translate labels, field errors, policy, FAQ and WhatsApp copy, not merely headlines.
- Ensure Devanagari and Bengali line height fits (minimum 1.5 body); use fallback fonts installed/served legitimately in production.

### Translation dictionary: `src/messages/hi.json` (as a Markdown code sample)

```json
{
  "business": {
    "eyebrow": "सिलीगुड़ी से टी बिज़नेस सप्लाई",
    "starterTitle": "अपना चाय का बिज़नेस शुरू करें",
    "starterSummary": "थोक चाय, रिटेल पैक और अपने ब्रांड की पैकेजिंग के विकल्प देखें।",
    "traderTitle": "थोक चाय और अपने ब्रांड के लिए सप्लाई",
    "traderSummary": "अपनी चाय की ग्रेड, मात्रा और पैकिंग की ज़रूरत साझा करें।",
    "starterCta": "बिज़नेस के लिए कोटेशन लें",
    "traderCta": "थोक रेट पूछें",
    "selectStage": "आपका बिज़नेस किस चरण में है?",
    "pincode": "डिलीवरी पिन कोड",
    "quantity": "पहले ऑर्डर की अनुमानित मात्रा",
    "contactConsent": "इस पूछताछ के बारे में TeaFloww मुझसे संपर्क कर सकता है।"
  }
}
```

Translation content is a **proposed copy draft** requiring local-language review; do not describe it as professionally translated or legally approved.

### Locale code reference (Next.js-style adapter)

```tsx
// An example of a server-provided translation dictionary, not a full i18n setup.
export type Locale = 'en' | 'hi';
export const supportedLocales: readonly Locale[] = ['en', 'hi'];
export function isLocale(value: string): value is Locale {
  return (supportedLocales as readonly string[]).includes(value);
}

// Render as links to existing translated routes; do not create broken locale links.
// <Link href={`/hi/start-tea-business`} lang="hi" hrefLang="hi">हिन्दी</Link>
```

## Search-friendly article ideas supporting this campaign

| Article | Intent | On-page CTA |
|---|---|---|
| Start a Tea Trading Business: Supply, Packaging, Freight Checklist | Beginner research | Get beginner brief |
| Bulk Tea 25kg Sacks vs Retail Pouches: Which Route Fits Your Market? | Format evaluation | Compare quotes |
| Private-Label Tea Packaging: Artwork, MOQ and Commercial Checklist | Brand intent | Request branding consultation |
| How Tea Traders Should Compare Landed Cost from Siliguri | Wholesale cost | Send pincode and quantity |
| How to Brief a Tea Supplier for Repeatable Grade and Taste Requirements | Operational research | Share a grade/specification |

These are editorial **ideas**, not published articles. Avoid duplicating existing TeaFloww blog topics; check CMS before drafting. Any freight calculations need verified carrier quotes, route and COD assumptions.

## Content governance

All product prices/stock come from admin product data and approved offer configuration, not duplicated hand-authored landing constants. Brand service claims go through an `approvedClaim` content model with owner, proof source, expiry and allowed channels. The content team must be able to disable an obsolete guarantee globally.
