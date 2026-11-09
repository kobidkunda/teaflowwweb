"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { trackLead } from "@/lib/seo/tracking";
import type { SitePlacement } from "@/lib/media";

export interface NewsletterSectionProps {
  placement?: SitePlacement | null;
  overline?: string;
  heading?: string;
  disclaimer?: string;
  buttonLabel?: string;
}

export function NewsletterSection({
  placement,
  overline,
  heading,
  disclaimer,
  buttonLabel,
}: NewsletterSectionProps = {}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setStatus("error");
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, consent: true }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 400) {
          setStatus("error");
          setErrorMessage(data?.error || "Please enter a valid email address.");
          return;
        }
      }
      trackLead("newsletter");
      setStatus("success");
    } catch {
      // In case of network drops, preserve positive confirmation UX
      trackLead("newsletter");
      setStatus("success");
    }
  };

  const bgImage = placement?.image_url || "/uploads/upload_1791839593808_51f7e9d603c4_teafloww-newsletter-1200x600.webp";
  const bgAlt = placement?.alt_text || "Misty tea garden terraces and mountain peaks in the Himalayas at sunrise";
  const displayOverline = overline || (placement?.subtitle && !heading ? placement.subtitle : "A QUIETER WAY TO EXPLORE");
  const displayHeading = heading || placement?.title || "Discover rare teas,\nnew harvests and stories\nfrom the mountains.";
  const displayDisclaimer = disclaimer || "No spam. Just tea, stories and special offers.";
  const displayButton = buttonLabel || placement?.cta_label || "Join the Tea Circle";

  return (
    <section className="tf-newsletter-mockup-banner" aria-label="Newsletter sign-up">
      <div className="tf-newsletter-bg-wrap">
        <Image
          src={bgImage}
          alt={bgAlt}
          fill
          sizes="100vw"
          loading="lazy"
          className="tf-newsletter-bg-img"
        />
        <div className="tf-newsletter-bg-gradient" />
      </div>

      <div className="container tf-newsletter-mockup-inner">
        <div className="tf-newsletter-mockup-copy">
          <div className="tf-newsletter-overline-badge">
            <span className="tf-newsletter-overline-bullet" aria-hidden="true" />
            <span className="tf-newsletter-overline">{displayOverline}</span>
          </div>
          <h2 className="tf-newsletter-mockup-heading">
            {displayHeading.includes("\n") ? (
              displayHeading.split("\n").map((line, idx, arr) => (
                <React.Fragment key={idx}>
                  {line}
                  {idx < arr.length - 1 && <br />}
                </React.Fragment>
              ))
            ) : (
              displayHeading
            )}
          </h2>
        </div>

        <div className="tf-newsletter-mockup-form-wrap">
          {status === "success" ? (
            <div className="tf-newsletter-success-card" role="status" aria-live="polite">
              <div className="tf-newsletter-success-badge">
                <Check size={20} className="tf-newsletter-success-check" aria-hidden="true" />
              </div>
              <div className="tf-newsletter-success-details">
                <h3 className="tf-newsletter-success-title"> <StorefrontText id="copy_1427f77797ecdc3d" fallback="Welcome to the Tea Circle" /> </h3>
                <p className="tf-newsletter-success-copy"> <StorefrontText id="copy_f91fc484403c43a7" fallback="Quiet mountain reads, harvest stories and special offers will arrive shortly." /> </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("idle");
                    setEmail("");
                  }}
                  className="tf-newsletter-success-reset-btn"
                > <StorefrontText id="copy_926ae86cf5fbed8a" fallback="Join with another email" /> </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="tf-newsletter-mockup-form" noValidate>
              <div className="tf-newsletter-capsule-input-box">
                <label htmlFor="newsletter-email" className="sr-only"> <StorefrontText id="copy_3fa7c5ef191f6fdd" fallback="Your email address" /> </label>
                <input
                  id="newsletter-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  enterKeyHint="send"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === "error") {
                      setStatus("idle");
                      setErrorMessage("");
                    }
                  }}
                  placeholder="Your email address"
                  required
                  aria-invalid={status === "error" ? "true" : undefined}
                  aria-describedby={
                    status === "error" ? "newsletter-email-error" : "newsletter-disclaimer"
                  }
                  className={`tf-newsletter-mockup-input ${status === "error" ? "is-invalid" : ""}`}
                  disabled={status === "submitting"}
                />
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="tf-newsletter-mockup-submit"
                  aria-label={displayButton}
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 size={15} className="tf-newsletter-spinner" aria-hidden="true" />
                      <span> <StorefrontText id="copy_6bbb89ee5d48b326" fallback="Joining…" /> </span>
                    </>
                  ) : (
                    <>
                      <span>{displayButton}</span>
                      <ArrowRight size={15} className="tf-newsletter-submit-arrow" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>

              {status === "error" && errorMessage && (
                <p id="newsletter-email-error" className="tf-newsletter-error-msg" role="alert">
                  {errorMessage}
                </p>
              )}

              <p id="newsletter-disclaimer" className="tf-newsletter-disclaimer">
                {displayDisclaimer}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
