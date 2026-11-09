# Verified External References and Engineering Notes

These sources were checked on 31 October 2026. The links provide authoritative starting points; confirm the current text when implementation begins, especially tax and regulations.

## Architecture & UI
- Next.js official App Router documentation (optional **if existing stack uses Next**): https://nextjs.org/docs/app
- Next.js Route Handlers (optional): https://nextjs.org/docs/app/getting-started/route-handlers
- Next.js Server vs Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- WCAG 2.2 W3C Recommendation: https://www.w3.org/TR/WCAG22/

**Interpretation:** WCAG 2.2 AA requires 24x24 CSS px pointer targets in general, with exceptions; this project *internally targets at least 44px* for comfortable touch, which is not to be misrepresented as the AA minimum.

## Food/tasting/compliance
- FSSAI Manuals/Methods of Analysis page: https://fssai.gov.in/food-testing/manuals-methods-analysis
- FSSAI 2023 Tea/Coffee/Chicory Methods PDF: https://fssai.gov.in/upload/uploadfiles/files/Manual%20of%20Methods%20of%20Analysis%20of%20Beverages%20Tea_Coffee%20%26%20Chicory.pdf
- FSSAI Food Business Registration: https://www.fssai.gov.in/business/registration
- FSSAI Licensing: https://fssai.gov.in/business/licensing
- FSSAI hygiene requirements: https://www.fssai.gov.in/inspection/hygiene-requirements

**Interpretation:** Refer to these for regulated analytical tests and food operator licensing. Standard human tasting must not be described as accredited chemical testing.

## GST
- CBIC official Goods & Services Tax services rates: https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html

**Interpretation:** Many Heading 9983 professional/technical services fall under 18%, but the precise service and potentially combined shipping/sample supply treatment require an accountant's review. The observed connected store general tax setting of 5% is **not** an approved service tax rate.

## Security
- OWASP API Security Top 10: https://api-security.owasp.org/editions/2023/en/0x11-t10/

**Interpretation:** High priority here: per-project ownership, staff role restrictions, confidential recipe/price properties and secure PDF download authorization.

## Product/site grounding
- Existing TeaFloww homepage: https://teafloww.com/
- User-supplied brand URL: https://teafloww.com/brand

**Source limitation:** Homepage/brand content could not be retrieved reliably with the public web tool at preparation time. Read-only connected storefront metadata included brand `TEAFLOWW`, tea merchandising sliders/categories, and general store tax rate. No pixel-accurate reimplementation is claimed. Verify all brand copy and company contact details against the real current production site before launch.
