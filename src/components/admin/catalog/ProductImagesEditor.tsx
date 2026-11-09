"use client";
import { useState } from "react";
import { MultiImageUploader, type GalleryImage } from "./MultiImageUploader";

type VariantOption = { sku: string; grams: number; packaging_format: string };
export function ProductImagesEditor({ productId, images, variants, onSaved }: {
  productId: number; images: GalleryImage[]; variants: VariantOption[];
  onSaved: (images: (GalleryImage & { id: number })[]) => void;
}) {
  const [draft, setDraft] = useState(images);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save() {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/products/${productId}/images`, {
        method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: draft }),
      });
      if (!response.ok) throw new Error("Save failed");
      const result = await response.json() as { images: (GalleryImage & { id: number })[] };
      setDraft(result.images); onSaved(result.images); setDirty(false); setMessage("Product images and variant assignments saved.");
    } catch { setError("Unable to save images. Please review the selected variants and try again."); }
    finally { setSaving(false); }
  }
  return <section style={{ background: "#fbf8f1", border: "1px solid #d9d4c8", borderRadius: 8, padding: 20, marginBottom: 24 }} aria-label="Manage product images">
    <h2 style={{ fontSize: 20 }}>Images &amp; variant assignments</h2>
    <p>Upload images and select the pack variants that should show each image. Save your changes below.</p>
    <fieldset disabled={saving} style={{ border: 0, padding: 0, minWidth: 0 }}>
      <MultiImageUploader images={draft} variants={variants} onChange={(next) => { setDraft(next); setDirty(true); setMessage(""); }} />
    </fieldset>
    <button type="button" className="button button-primary" disabled={!dirty || saving} aria-busy={saving} onClick={() => void save()} style={{ marginTop: 16 }}>{saving ? "Saving…" : "Save images"}</button>
    {error && <p role="alert" className="error-message">{error}</p>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
