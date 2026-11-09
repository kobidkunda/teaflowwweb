"use client";

import React from "react";
import { Mail, Send, Image as ImageIcon } from "lucide-react";
import { ImageFieldWithPicker } from "./ImageFieldWithPicker";
import { LinkControl } from "./LinkControl";
import type { HomepageContent } from "./types";

export interface NewsletterTabProps {
  content: HomepageContent;
  onChange: (updater: (prev: HomepageContent) => HomepageContent) => void;
  disabled?: boolean;
}

const DEFAULT_NEWSLETTER = {
  enabled: true,
  eyebrow: "JOIN OUR TEA CIRCLE",
  title: "New leaves.\nLittle moments of calm.",
  description: "Leave your email to join our tea newsletter list.",
  image_url: "/images/home/ritual-newsletter.webp",
  image_alt: "Decorative botanical artwork of tea leaves in forest mist",
  email_label: "Email address",
  placeholder: "Your email address",
  button_label: "Join the circle",
  consent_label: "I agree to receive tea news by email.",
  privacy: {
    label: "Privacy policy",
    href: "/privacy",
  },
  pending_label: "Saving…",
  success_message: "Thank you. Your newsletter preference has been saved.",
  error_message: "We couldn’t save your request. Please check your email address and try again.",
};

export function NewsletterTab({ content, onChange, disabled = false }: NewsletterTabProps) {
  const newsletter = content.newsletter ?? DEFAULT_NEWSLETTER;

  function updateNl(patch: Partial<typeof newsletter>) {
    onChange((prev) => ({
      ...prev,
      newsletter: {
        ...(prev.newsletter ?? DEFAULT_NEWSLETTER),
        ...patch,
      },
    }));
  }

  return (
    <div className="hp-tab-pane">
      <div className="hp-section-intro">
        <div className="hp-section-icon">
          <Mail size={20} />
        </div>
        <div>
          <h3>Tea Circle Newsletter Subscription</h3>
          <p>
            Invite visitors into the Himalayan tea community with seasonal harvest dispatches
            and tasting notes. Consent is recorded into the database; real emails require a
            configured transport.
          </p>
        </div>
      </div>

      {/* Enable / Disable Section Toggle Card */}
      <div className="hp-card mb-6">
        <div className="hp-toggle-row">
          <div>
            <h4 className="hp-card-title m-0">Display Newsletter Banner on Storefront</h4>
            <p className="hp-card-desc">
              When toggled off, this section is completely hidden from the homepage.
            </p>
          </div>
          <label className="hp-switch-wrap big">
            <input
              type="checkbox"
              checked={newsletter.enabled}
              onChange={(e) => updateNl({ enabled: e.target.checked })}
              disabled={disabled}
            />
            <span className="hp-switch-slider" />
            <span className="hp-switch-text font-semibold">
              {newsletter.enabled ? "Active on Storefront" : "Disabled"}
            </span>
          </label>
        </div>
      </div>

      <div className="hp-two-col-layout">
        {/* Left Column: Copy & Form Labels */}
        <div className="hp-col">
          <div className="hp-card">
            <h4 className="hp-card-title">Editorial Copy</h4>
            <div className="hp-field-group">
              <label htmlFor="hp-nl-eyebrow" className="hp-sublabel">
                Section Eyebrow
              </label>
              <input
                id="hp-nl-eyebrow"
                type="text"
                value={newsletter.eyebrow}
                onChange={(e) => updateNl({ eyebrow: e.target.value })}
                placeholder="JOIN OUR TEA CIRCLE"
                className="hp-input"
                maxLength={100}
                disabled={disabled}
              />
            </div>

            <div className="hp-field-group">
              <label htmlFor="hp-nl-title" className="hp-sublabel">
                Headline (Supports linebreaks with Enter)
              </label>
              <textarea
                id="hp-nl-title"
                value={newsletter.title}
                onChange={(e) => updateNl({ title: e.target.value })}
                rows={2}
                className="hp-textarea"
                maxLength={150}
                placeholder="New leaves.&#10;Little moments of calm."
                disabled={disabled}
              />
            </div>

            <div className="hp-field-group">
              <label htmlFor="hp-nl-desc" className="hp-sublabel">
                Supporting Description
              </label>
              <textarea
                id="hp-nl-desc"
                value={newsletter.description}
                onChange={(e) => updateNl({ description: e.target.value })}
                rows={2}
                className="hp-textarea"
                maxLength={300}
                placeholder="Leave your email to join our tea newsletter list."
                disabled={disabled}
              />
            </div>
          </div>

          <div className="hp-card">
            <h4 className="hp-card-title">
              <Send size={16} /> Input Controls & Consent
            </h4>

            <div className="hp-grid-2">
              <div className="hp-field-group">
                <label htmlFor="hp-nl-email-label" className="hp-sublabel">
                  Email Field Label
                </label>
                <input
                  id="hp-nl-email-label"
                  type="text"
                  value={newsletter.email_label}
                  onChange={(e) => updateNl({ email_label: e.target.value })}
                  placeholder="Email address"
                  className="hp-input"
                  maxLength={60}
                  disabled={disabled}
                />
              </div>

              <div className="hp-field-group">
                <label htmlFor="hp-nl-placeholder" className="hp-sublabel">
                  Input Placeholder
                </label>
                <input
                  id="hp-nl-placeholder"
                  type="text"
                  value={newsletter.placeholder}
                  onChange={(e) => updateNl({ placeholder: e.target.value })}
                  placeholder="Your email address"
                  className="hp-input"
                  maxLength={60}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="hp-field-group">
              <label htmlFor="hp-nl-btn-label" className="hp-sublabel">
                Submit Button Label
              </label>
              <input
                id="hp-nl-btn-label"
                type="text"
                value={newsletter.button_label}
                onChange={(e) => updateNl({ button_label: e.target.value })}
                placeholder="Join the circle"
                className="hp-input"
                maxLength={60}
                disabled={disabled}
              />
            </div>

            <div className="hp-field-group">
              <label htmlFor="hp-nl-consent" className="hp-sublabel">
                Consent Agreement Wording
              </label>
              <input
                id="hp-nl-consent"
                type="text"
                value={newsletter.consent_label}
                onChange={(e) => updateNl({ consent_label: e.target.value })}
                placeholder="I agree to receive tea news by email."
                className="hp-input"
                maxLength={200}
                disabled={disabled}
              />
            </div>

            <LinkControl
              idPrefix="newsletter-privacy"
              title="Privacy Policy Link"
              value={newsletter.privacy}
              onChange={(next) => updateNl({ privacy: next })}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Right Column: Visual Artwork & Responses */}
        <div className="hp-col">
          <div className="hp-card">
            <h4 className="hp-card-title">
              <ImageIcon size={16} /> Botanical Background Canvas
            </h4>
            <ImageFieldWithPicker
              id="hp-nl-img"
              label="Newsletter Botanical Visual"
              description="Full-bleed background artwork behind the newsletter card."
              imageUrl={newsletter.image_url}
              imageAlt={newsletter.image_alt}
              onImageUrlChange={(url) => updateNl({ image_url: url })}
              onImageAltChange={(alt) => updateNl({ image_alt: alt })}
              aspectRatioHint="16:9 Banner"
              recommendation="1920×1080 WebP"
              disabled={disabled}
            />
          </div>

          <div className="hp-card">
            <h4 className="hp-card-title">Interactive Feedback Alerts</h4>

            <div className="hp-field-group">
              <label htmlFor="hp-nl-pending" className="hp-sublabel">
                Saving / Submitting State
              </label>
              <input
                id="hp-nl-pending"
                type="text"
                value={newsletter.pending_label}
                onChange={(e) => updateNl({ pending_label: e.target.value })}
                placeholder="Saving…"
                className="hp-input"
                maxLength={60}
                disabled={disabled}
              />
            </div>

            <div className="hp-field-group">
              <label htmlFor="hp-nl-success" className="hp-sublabel">
                Success Confirmation Message
              </label>
              <input
                id="hp-nl-success"
                type="text"
                value={newsletter.success_message}
                onChange={(e) => updateNl({ success_message: e.target.value })}
                placeholder="Thank you. Your newsletter preference has been saved."
                className="hp-input"
                maxLength={200}
                disabled={disabled}
              />
            </div>

            <div className="hp-field-group">
              <label htmlFor="hp-nl-error" className="hp-sublabel">
                Error State Message
              </label>
              <input
                id="hp-nl-error"
                type="text"
                value={newsletter.error_message}
                onChange={(e) => updateNl({ error_message: e.target.value })}
                placeholder="We couldn’t save your request. Please check your email address."
                className="hp-input"
                maxLength={200}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
