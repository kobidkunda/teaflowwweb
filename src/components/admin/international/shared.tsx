"use client";
import React, { useState } from "react";
export async function adminRequest(action: string, data?: unknown) {
  const response = await fetch(`/api/admin/international/${action}`, data === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to complete request.");
  return result;
}
export function useOperation() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const run = async (work: () => Promise<void>) => { setBusy(true); setMessage(""); try { await work(); setMessage("Saved successfully."); } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to save."); } finally { setBusy(false); } };
  return { busy, message, setMessage, run };
}
export function Field({ label, value, set, type = "text" }: { label: string; value: string | number; set: (v: string) => void; type?: string }) { return <label>{label}<input type={type} value={value} onChange={e => set(e.target.value)} step={type === "number" ? "any" : undefined} /></label>; }
export function Toggle({ label, value, set }: { label: string; value: boolean; set: (v: boolean) => void }) { return <label className="tf-ops-toggle"><input type="checkbox" checked={value} onChange={e => set(e.target.checked)} />{label}</label>; }
