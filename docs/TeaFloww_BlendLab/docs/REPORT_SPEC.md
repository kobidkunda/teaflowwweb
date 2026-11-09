# Professional PDF Report Specification

## Purpose
Deliver a defensible, comprehensible customer report built from actual professional sensory observations, supporting evidence and documented commercial assumptions. The PDF is neither a laboratory safety certificate nor proof of chemical composition.

## Template layout
- A4 portrait, 20mm min margins, readable type and repeating header/footer.
- Forest-green chapter title band, ivory page background, white data cards, copper lines.
- Page numbers, report reference, version, issue date and confidentiality footer.
- Cover illustration/photo of *actual submitted sample* when possible (consented). Alternative neutral tea imagery otherwise.

## Proposed section order
1. **Cover & metadata** — sample ID, client business, report version, tester/reviewer, scope.
2. **Executive summary** — three observed strengths, three improvement areas, recommendation and limitations.
3. **Customer brief** — intended market, budget, brewing method and customer success conditions.
4. **Sample custody & methods** — arrival, condition, mass, methods, water/tea/milk/time.
5. **Dry leaf** — photos, grade observations, particle/fibre notes, visible defects.
6. **Brewed liquor** — photo, brightness, hue, visual/physical observations.
7. **Sensory character** — attributes scored with published anchor definitions + descriptive notes.
8. **Milk chai suitability** — separately controlled method and observations when relevant.
9. **Customer objective alignment** — what's met/missing/uncertain.
10. **Risks & limitations** — what was NOT tested or certified.
11. **Commercial analysis** — if sufficient evidence: customer cost assumptions, lot price basis, packaging/logistics margin caveat.
12. **Improvement roadmap** — prioritize actions with confidence and trade-offs.
13. **Candidate formulas (Signature only)** — customer-safe description; full raw material ratios optional only if commercial contract grants disclosure.
14. **Tester commentary** — named/verified professional human review.
15. **Wholesale quotation** — only if separately approved and live-valid; otherwise link to quote request.
16. **Appendix** — definitions, score anchors, versions, source types, supporting external lab certificate references (if any).

## Example scorecard schema
```
{
  "sampleCode": "DEMO-TL-001",
  "methodId": "CTC-MILK-CHA-01-v1",
  "scores": [
    {"attribute":"strength","score":7,"max":10,"source":"human_sensory"},
    {"attribute":"body","score":6,"max":10,"source":"human_sensory"}
  ],
  "testerNotes": "Illustrative example only; not a real customer result.",
  "reviewStatus": "example_only"
}
```
Do not compute confidence percentages for the tester scores unless a documented statistical calibration exists.

## Review gate
- Identifiers, photos, quantities and timestamps match the project.
- No fabricated metrics or unexplained precision.
- Every plotted value has units and provenance.
- Every price has currency, quantity basis, date, expiry and assumption set.
- Applicable plan entitlement confirmed.
- Licensed reviewer signs a `reviewer_id + timestamp + version hash` record.
- PDF produced through retryable job, stored privately, checksum saved, publication transactional.

## Digital experience
- Customer HTML reader with chapters, zoom and searchable text.
- PDF downloads via authorized expiring URL.
- Mobile chapters become segmented selector/accordion; no inaccessible wide tables.
- Revised reports shown alongside revision summary; preserve previously published versions.
