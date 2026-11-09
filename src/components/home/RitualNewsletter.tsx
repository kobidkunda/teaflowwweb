"use client";
import React, { useEffect, useState } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { ArrowRight } from "lucide-react";
import type { HomepageContent } from "@/lib/homepageSchema";
import { trackLead } from "@/lib/seo/tracking";

export function RitualNewsletter({ content }: { content: NonNullable<HomepageContent["newsletter"]> }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const data = new FormData(form); setState("pending");
    try {
      const response = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), consent: data.get("consent") === "on" }) });
      if (!response.ok) throw new Error();
      trackLead("newsletter");
      setState("success"); form.reset();
    } catch { setState("error"); }
  }
  return <form className="ritual-newsletter-form" method="post" action="/api/newsletter" onSubmit={submit}>
    <label className="sr-only" htmlFor="tea-circle-email">{content.email_label}</label>
    <div className="ritual-email-row"><input id="tea-circle-email" name="email" type="email" autoComplete="email" placeholder={content.placeholder} required maxLength={254} disabled={state === "pending"}/><button type="submit" disabled={!ready || state === "pending"}>{state === "pending" ? content.pending_label : content.button_label}<ArrowRight size={17} aria-hidden="true"/></button></div>
    <div className="ritual-consent"><label><input type="checkbox" name="consent" required disabled={state === "pending"}/><span>{content.consent_label}</span></label>{content.privacy.href && <Link href={content.privacy.href}>{content.privacy.label}</Link>}</div>
    {state === "success" && <p role="status">{content.success_message}</p>}{state === "error" && <p role="alert">{content.error_message}</p>}
  </form>;
}
