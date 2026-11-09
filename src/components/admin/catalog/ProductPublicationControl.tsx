"use client";
import { useState } from "react";

type Publication = { status: "draft" | "published" | "archived"; is_enabled: number };
export function ProductPublicationControl({ id, status, enabled = 1, name, onChange }: {
  id: number; status?: string; enabled?: number; name: string; onChange: (value: Publication) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const live = status === "published" && enabled !== 0;
  async function save() {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/products/${id}/publication`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: live ? "draft" : "published" }),
      });
      if (!response.ok) throw new Error("Save failed");
      const result = await response.json() as Publication;
      onChange(result);
      setMessage(live ? `${name} moved to draft.` : `${name} is now live.`);
    } catch { setError("Unable to change publication status. Please try again."); }
    finally { setSaving(false); }
  }
  return <div>
    <button type="button" className={`button ${live ? "button-outline" : "button-primary"}`} disabled={saving} aria-busy={saving} aria-label={`${live ? "Move to draft" : "Make live"}: ${name}`} onClick={() => void save()}>{saving ? "Saving…" : live ? "Move to draft" : "Make live"}</button>
    {error && <p role="alert" className="error-message">{error}</p>}
    <p role="status" aria-live="polite" style={{ margin: message ? "8px 0 0" : 0 }}>{message}</p>
  </div>;
}
