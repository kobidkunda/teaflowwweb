"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { MediaPicker } from "./catalog/MediaPicker";

export function BusinessMediaField({ label, value, onChange, optional = false }: {
  label: string; value: string; onChange: (url: string) => void; optional?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [failedUrl, setFailedUrl] = useState("");

  async function upload(file: File) {
    setError(""); setMessage("");
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError("Choose a JPEG, PNG, WebP or AVIF image."); return;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setError("Choose a non-empty image up to 5 MB."); return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("alt_text", label);
      const response = await fetch("/api/admin/media", { method: "POST", credentials: "same-origin", body });
      const data = await response.json();
      const url = data.url || data.asset?.url || data.upload?.url;
      if (!response.ok || typeof url !== "string") throw new Error("Upload failed. Please try again.");
      onChange(url); setFailedUrl("");
      setMessage("Image uploaded. Save this section to publish the change.");
    } catch {
      setError("Unable to upload the image. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return <div className="tf-admin-field tf-business-media" role="group" aria-labelledby={`${id}-label`}>
    <label id={`${id}-label`} htmlFor={id} className="tf-admin-label">{label}</label>
    {value && value !== failedUrl && (/^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value)) &&
      <Image src={value} alt={`${label} preview`} width={240} height={135} unoptimized onError={() => setFailedUrl(value)} className="tf-business-media-preview" />}
    <input id={id} className="tf-admin-input" value={value} disabled={busy} aria-describedby={`${id}-help`} onChange={e => { onChange(e.target.value); setMessage(""); }} placeholder="/uploads/image.webp" />
    <div className="tf-business-media-actions">
      <button type="button" className="tf-admin-btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Upload image"}</button>
      <input ref={input} id={`${id}-file`} type="file" hidden aria-label={`Upload ${label}`} accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
      <button type="button" className="tf-admin-btn" disabled={busy} onClick={() => setPicker(true)}>Media library</button>
      {optional && value && <button type="button" className="tf-admin-btn" disabled={busy} onClick={() => onChange("")}>Clear image</button>}
    </div>
    <p id={`${id}-help`} className="tf-admin-help">JPEG, PNG, WebP or AVIF, up to 5 MB. Upload or choose an existing asset, then save this section.</p>
    {busy && <p role="status">Uploading image…</p>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <MediaPicker isOpen={picker} title={`Select ${label}`} onClose={() => setPicker(false)} onSelect={asset => { onChange(asset.url); setFailedUrl(""); setError(""); setMessage("Image selected. Save this section to publish the change."); setPicker(false); }} />
  </div>;
}
