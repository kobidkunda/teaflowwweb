# Security, Privacy, Tax & Regulatory Guardrails

## Status
This is an engineering compliance checklist, **not legal or tax advice**. Obtain professional review of actual service classification, invoicing, food operations and contractual rights.

## Payment and tax
- Prices ₹299, ₹1,999, ₹2,999 are customer-proposed GST-inclusive total targets.
- General store tax setting observed in connected metadata was 5%; **do not apply it to service SKUs blindly**.
- CBIC lists a general 18% category under Heading 9983 for many professional/technical/business services, subject to the exact classification/exceptions and current law (see references). Check whether tea testing, formulation consultancy and shipping constitute a particular supply configuration before billing.
- Compute inclusive/exclusive portions in integer paise using accountant-approved treatment; capture tax scheme and total in the order snapshot.
- Verify gateway signature, provider event ID uniqueness, amount/currency and authorized refund operations.

## Food and testing
- Professional sensory tasting describes an expert's subjective evaluation; **not** a certificate of chemical safety, residues, contamination, pesticide levels or accreditation.
- FSSAI publishes the official Tea/Coffee/Chicory analytical methods; only claim such testing when a trained/authorized qualified laboratory actually performs it with appropriate methods.
- Confirm FSSAI licence/registration requirements for tea blending/packaging/selling and the actual manufacturer details.
- Ensure samples are not transferred to retail supply chains without documented product traceability.

## Customer data and trade secrets
- Use HTTPS, least privilege and encryption at rest where sensitive.
- Data minimization for tea sample addresses, business contact, supplier details and retained recipes.
- Protect internal costs, raw recipe ratios, supplier names, staff comments and reviewer drafts from customer-facing API serializers.
- Treat PDF reports as private documents; access verified by project owner identity and plan entitlement.
- Expiring download URLs; never hardcode cloud object keys or access tokens in browser bundles.
- Store audit revisions and downloadable artifact hashes.
- Explicit privacy/retention policies, staff retention schedule and deletion requests procedure.

## Security test cases
1. User A attempts to access User B's project, quote, report and feedback API via guessed ID.
2. User attempts to change plan or amount in client-side payload.
3. Webhook is replayed 100 times, concurrently.
4. Signed PDF URL leaks into browser referrer or logs; expire and limit appropriately.
5. Customer-supplied rich text/photo contains HTML or malicious file.
6. Discount/upgrade refund state conflicts with service benefit consumption.
7. Staff role tries to publish report without evidence or approval rights.
8. Report published once then modified directly.
9. Plan upgrade unlocks report without proper payment verification.
10. Courier returned failure after payment and staff must resolve it without losing funds.

## Claims policy
Avoid invented qualifications, customer reviews, numerical savings, absolute guarantees or fake countdowns. State the measurement provenance. Preserve signed/versioned report evidence and a clear complaint route.

## Relevant primary sources
See `REFERENCES.md` for CBIC GST, FSSAI regulatory/testing, OWASP API Top 10 and WCAG 2.2 links.
