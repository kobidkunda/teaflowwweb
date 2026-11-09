# Homepage sample-kit invitation — selected option 3

The homepage section introduces trial kits and links to `/trials`. It no longer
acts as a product-detail page or adds a specific kit directly to the cart.

## Editable images

Admin: `/admin/homepage` → **Trials Flights** → **Background artwork**.
Use Upload New, Media Library, or Edit Path. Publish Homepage saves the content.

| Field | Recommended exact source size | Aspect ratio | Display |
| --- | --- | --- | --- |
| `trials.image_url` | 1920 × 720 px | 8:3 | Above 640 CSS px |
| `trials.mobile_image_url` | 960 × 1080 px | 8:9 | 640 CSS px and below |
| `trials.image_alt` | Text, up to 500 characters | — | Accessible description shared by both compositions |
| `trials.image_caption` | Text, up to 500 characters | — | Visible image caption |

Use WebP/JPEG, preferably under 400 KB (uploader limit: 5 MB). Upload artwork only;
headings, buttons and captions remain accessible HTML. Both crops use centered
cover. Keep cups and pouches in frame. The mobile composition uses 2 × 2 pairs
instead of cropping the desktop strip. Clearing mobile uses desktop; clearing
desktop uses mobile if present; clearing both removes the image, retaining the CTA.

## MCP

1. Read `store.getHomepageContent`.
2. Keep the complete returned `content` document, changing only desired `trials`
   fields, then call `admin.updateHomepageContent` with `{ content }` and an
   optional UUID `idempotencyKey`.
3. Read again to verify persisted paths/caption.

Both tools and authenticated GET/PUT `/api/admin/homepage` return
`media_guidance.trials` with exact dimensions, crop instructions, formats,
mobile breakpoint and fallback rules. MCP tool discovery also describes the
editable paths. Paths must be local; external URLs, schemes and protocol-relative
URLs are rejected by the shared Zod schema. Existing authorization and validated
upload tooling remain in place.

Example section fields (merge into the full document, not a partial homepage):

```json
{
  "image_url": "/uploads/sample-kit-desktop.webp",
  "mobile_image_url": "/uploads/sample-kit-mobile.webp",
  "image_alt": "Four cups of chai with four sample tea pouches",
  "image_caption": "Illustrative imagery"
}
```

Existing stored documents remain compatible via additive optional/defaulted JSON
fields. Exact old starter text is mapped to the selected design without overwriting
stored copy; custom editorial copy is retained. No database schema migration.

## Assets and evidence

Built-in ImageGen used the selected option 3 reference. No CLI fallback or new
dependencies. Prompts and original images are in this directory. Optimized files:

- `public/images/trials/home-discovery-desktop.webp`: 1920×720, 257,870 bytes.
- `public/images/trials/home-discovery-mobile.webp`: 960×1080, 153,176 bytes.

Both are visibly illustrative, not actual product/provenance photography.
`selected-option-3.png` is a generated mockup. Section captures and admin screenshots
are actual in-app browser evidence; comparison sheets combine source/render views.
Admin save verification uses an isolated SQLite copy and synthetic review account;
normal catalogue/homepage data is not changed by the verification.
