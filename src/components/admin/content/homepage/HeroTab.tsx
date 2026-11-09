"use client";

import React from "react";
import { Sparkles, Layers, Image as ImageIcon } from "lucide-react";
import { ImageFieldWithPicker } from "./ImageFieldWithPicker";
import { LinkControl } from "./LinkControl";
import type { HomepageContent } from "./types";

export interface HeroTabProps {
  content: HomepageContent;
  onChange: (updater: (prev: HomepageContent) => HomepageContent) => void;
  disabled?: boolean;
}

export function HeroTab({ content, onChange, disabled = false }: HeroTabProps) {
  const { hero } = content;

  return (
    <div className="hp-tab-pane">
      <div className="hp-section-intro">
        <div className="hp-section-icon">
          <Sparkles size={20} />
        </div>
        <div>
          <h3>Hero & Storefront Identity</h3>
          <p>
            Configure your brand identity and the first visual chapter visitors encounter.
            Pair evocative Himalayan prose with high-resolution estate photography.
          </p>
        </div>
      </div>

      <div className="hp-two-col-layout">
        {/* Left Column: Brand & Hero Typography */}
        <div className="hp-col">
          {/* Brand Identity Card */}
          <div className="hp-card">
            <h4 className="hp-card-title">
              <Layers size={16} /> Brand Identity
            </h4>
            <div className="hp-field-group">
              <label htmlFor="hp-brand" className="hp-sublabel">
                Brand Name <span className="req-star">*</span>
              </label>
              <input
                id="hp-brand"
                type="text"
                value={content.brand}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, brand: e.target.value }))
                }
                placeholder="TEAFLOWW"
                className="hp-input"
                maxLength={100}
                disabled={disabled}
              />
            </div>

            <div className="hp-field-group">
              <label htmlFor="hp-tagline" className="hp-sublabel">
                Brand Tagline
              </label>
              <input
                id="hp-tagline"
                type="text"
                value={content.tagline}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, tagline: e.target.value }))
                }
                placeholder="A QUIETER RITUAL"
                className="hp-input"
                maxLength={100}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Hero Typography Card */}
          <div className="hp-card">
            <h4 className="hp-card-title">Hero Editorial Copy</h4>
            <div className="hp-field-group">
              <label htmlFor="hp-hero-eyebrow" className="hp-sublabel">
                Eyebrow Category / Tag
              </label>
              <input
                id="hp-hero-eyebrow"
                type="text"
                value={hero.eyebrow}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    hero: { ...prev.hero, eyebrow: e.target.value },
                  }))
                }
                placeholder="THE ART OF A QUIETER RITUAL"
                className="hp-input"
                maxLength={150}
                disabled={disabled}
              />
            </div>

            <div className="hp-grid-2">
              <div className="hp-field-group">
                <label htmlFor="hp-hero-title" className="hp-sublabel">
                  Main Headline
                </label>
                <input
                  id="hp-hero-title"
                  type="text"
                  value={hero.title}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, title: e.target.value },
                    }))
                  }
                  placeholder="Closer to the garden."
                  className="hp-input"
                  maxLength={150}
                  disabled={disabled}
                />
              </div>

              <div className="hp-field-group">
                <label htmlFor="hp-hero-emphasis" className="hp-sublabel">
                  Italic Emphasis Headline
                </label>
                <input
                  id="hp-hero-emphasis"
                  type="text"
                  value={hero.emphasis}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, emphasis: e.target.value },
                    }))
                  }
                  placeholder="Better in the cup."
                  className="hp-input"
                  maxLength={150}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="hp-field-group">
              <label htmlFor="hp-hero-desc" className="hp-sublabel">
                Story Description
              </label>
              <textarea
                id="hp-hero-desc"
                value={hero.description}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    hero: { ...prev.hero, description: e.target.value },
                  }))
                }
                rows={4}
                className="hp-textarea"
                maxLength={500}
                placeholder="Explore extraordinary tea through the language of origin, season and taste..."
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Imagery & Buttons */}
        <div className="hp-col">
          {/* Hero Visual Card */}
          <div className="hp-card">
            <h4 className="hp-card-title">
              <ImageIcon size={16} /> Hero Visual Canvas
            </h4>
            <ImageFieldWithPicker
              id="hp-hero-img"
              label="Hero Primary Photograph"
              description="Displays prominently on the right of the hero on desktop and under the headline on mobile."
              imageUrl={hero.image_url}
              imageAlt={hero.image_alt}
              onImageUrlChange={(url) =>
                onChange((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, image_url: url },
                }))
              }
              onImageAltChange={(alt) =>
                onChange((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, image_alt: alt },
                }))
              }
              aspectRatioHint="16:9 or 4:3 Ratio"
              recommendation="1920×1080 WebP / High Resolution"
              disabled={disabled}
            />
          </div>

          {/* Action CTAs */}
          <div className="hp-card">
            <h4 className="hp-card-title">Hero Navigation Actions</h4>
            <div className="hp-links-stack">
              <LinkControl
                idPrefix="hero-primary"
                title="Primary Action Button"
                value={hero.primary}
                onChange={(next) =>
                  onChange((prev) => ({
                    ...prev,
                    hero: { ...prev.hero, primary: next },
                  }))
                }
                required
                disabled={disabled}
              />

              <LinkControl
                idPrefix="hero-secondary"
                title="Secondary Text Link"
                value={hero.secondary}
                onChange={(next) =>
                  onChange((prev) => ({
                    ...prev,
                    hero: { ...prev.hero, secondary: next },
                  }))
                }
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
