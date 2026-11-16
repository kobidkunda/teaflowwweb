# Security, Privacy, Abuse Controls & Responsible Lead Operations

This is a checklist for engineering/legal review; it is not legal advice. The two buyer pages collect names, contact numbers and delivery pincodes, and will pass events to third-party ad platforms only through approved policies.

## Threat model

| Risk | Attack path | Required control |
|---|---|---|
| Spam/fake leads | Open public form or bots | Rate limit, honeypot, server validation, anomaly rules, CAPTCHA only when justified |
| Duplicate leads | Retries / multi-clicks | UUID idempotency, request fingerprint and unique DB key |
| CSRF / origin abuse | Cross-site POST | Same-origin checks plus CSRF mechanism if cookies/session auth used |
| XSS and script injection | Customer text in CRM, email or logs | Escape output, strict length, no dangerouslySetInnerHTML, CSP |
| PII leakage | GA4 event, URLs, error logs, analytics exports | Structured safe-property allowlist and redacted logging |
| Unauthorized employee reads | Lead endpoints/admin UI | RBAC, audit logs, least privilege, access reviews |
| Integration exposure | API keys in browser | Server-only secret storage, scope-limited credentials, rotation |
| Outbox replay | Worker retries CAPI/CRM | External dedupe keys; event-level exactly-once business semantics |
| Price misrepresentation | Stale/incorrect pricing | Approved offer IDs and quote snapshots with expiry |
| Fraudulent profit claims | Ads/landing copy | Owner-reviewed claims register |

## HTTP API hardening beyond the sample route

1. Reject request bodies beyond a defined small limit (e.g. 8–16KB for the simple form, unless existing backend requires more).
2. Validate `Content-Type: application/json`; unknown fields should fail strict schema or be stripped by documented policy.
3. Use a reasonable request rate by IP/session and additional organization-level anti-abuse; avoid collecting unnecessary fingerprint data.
4. Compare normalized request body fingerprints on retry with same idempotency key; 409 on mismatch.
5. Ensure DB transactions always create lead+outbox atomically; store a trustworthy source timestamp.
6. Respond with opaque reference and generic safe error, not full persisted lead/PII.
7. Escape untrusted input in CRM messages and emails and never create untrusted direct webhook URLs.
8. Do not trust `utm_campaign` values or pincode validity beyond formatting; route serviceability requires server lookup.
9. Add request IDs, operational metrics, dead-letter alerts, and tested recovery runbook.

## Origin and body-size example — `src/lib/business/request-guards.ts`

```ts
export function checkBusinessLeadRequest(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return { ok: false as const, status: 415, error: 'JSON required' };
  }
  const origin = request.headers.get('origin');
  const allowed = new Set(['https://teafloww.com', 'https://www.teafloww.com']);
  if (origin && !allowed.has(origin)) {
    return { ok: false as const, status: 403, error: 'Origin not allowed' };
  }
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > 16_384) {
    return { ok: false as const, status: 413, error: 'Request too large' };
  }
  return { ok: true as const };
}
```

**This is only a defense-in-depth example.** `Content-Length` may be omitted or untrustworthy and Origin may be absent. Production implementation must enforce a hard read/stream body bound at the server/edge, proper CSRF protection (as needed), enforce actual deployment origins and traffic proxy behavior, plus separate rate limits. Never treat this function as a complete security boundary.

## Example sensitive-data-safe logger

```ts
const safeKeys = new Set([
  'request_id', 'event', 'segment', 'offer', 'lead_ref', 'status', 'duration_ms',
]);

export function logBusinessEvent(data: Record<string, unknown>) {
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (safeKeys.has(key)) record[key] = value;
  }
  // Replace with structured cloud logger; do not log raw request bodies.
  console.info(JSON.stringify(record));
}
```

## Consent and data protection controls

- Request-to-contact consent is distinct from optional ongoing marketing consent; a person must be able to request a quote without accepting promotional newsletters.
- Consent text should accurately reflect what will happen, link to current privacy policy and expose requested channels.
- Apply ad platform server event matching only when configured and legally/contractually permitted; do not send full CRM notes or exact postal address as generalized tracking fields.
- Store original source and opt-in timestamp; if an existing consent management platform is present, integrate rather than invent parallel browser state.
- Define retention policy for unconverted inquiries, successful customer records, logs, click identifiers and uploads, and support deletion/access correction with audit.
- Have legal counsel review applicable India privacy rules, telecommunications/marketing consent, GST and FSSAI claims where relevant, as requirements and implementation dates can change.

## Sales safety and trust

A user asking about tea trading may be inexperienced; the site should never promise guaranteed returns or present a fixed quote without quantity, destination, taxes, freight and production method. Provide transparent steps, optional call/contact, and proof they can verify. Sales agents must not present unapproved “₹299 matching”, “24h all-India delivery”, “direct garden no middlemen” or “100% consistent” as fixed contractual commitments.

## Operational alerts

- Alert if lead-creation success >0 but CRM deliveries =0 for the monitoring window.
- Alert if form server error or webhook retries exceed conservative threshold.
- Alert if unapproved claim asset becomes visible, B2B page suddenly 404s, ad URL returns wrong locale or tag misfires.
- Create read-only ad performance reports for operators but keep PII in restricted CRM.

## References

- https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- https://developers.google.com/tag-platform/security/guides/consent
- https://www.w3.org/WAI/WCAG22/quickref/
