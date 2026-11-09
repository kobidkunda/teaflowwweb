"use client";

import React from "react";
import { Package, ShoppingBag } from "lucide-react";
import { ImageFieldWithPicker } from "./ImageFieldWithPicker";
import { LinkControl } from "./LinkControl";
import type { HomepageContent } from "./types";

export interface ShelfTabProps {
  content: HomepageContent;
  onChange: (updater: (prev: HomepageContent) => HomepageContent) => void;
  disabled?: boolean;
}

export function ShelfTab({ content, onChange, disabled = false }: ShelfTabProps) {
  const { shelf } = content;

  return (
    <div className="hp-tab-pane">
      <div className="hp-section-intro">
        <div className="hp-section-icon">
          <Package size={20} />
        </div>
        <div>
          <h3>Curated Shelf & Fallback Assets</h3>
          <p>
            The curated shelf automatically pulls featured single estate teas from the
            Catalogue. Configure its editorial headline, catalogue view-all button, and
            packaging artwork displayed when inventory is loading or empty.
          </p>
        </div>
      </div>

      <div className="hp-two-col-layout">
        {/* Left Column: Headlines & CTA */}
        <div className="hp-col">
          <div className="hp-card">
            <h4 className="hp-card-title">Shelf Editorial Typography</h4>
            <div className="hp-field-group">
              <label htmlFor="hp-shelf-eyebrow" className="hp-sublabel">
                Section Eyebrow
              </label>
              <input
                id="hp-shelf-eyebrow"
                type="text"
                value={shelf.eyebrow}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    shelf: { ...prev.shelf, eyebrow: e.target.value },
                  }))
                }
                placeholder="THE CURATED SHELF"
                className="hp-input"
                maxLength={100}
                disabled={disabled}
              />
            </div>

            <div className="hp-grid-2">
              <div className="hp-field-group">
                <label htmlFor="hp-shelf-title" className="hp-sublabel">
                  Headline
                </label>
                <input
                  id="hp-shelf-title"
                  type="text"
                  value={shelf.title}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      shelf: { ...prev.shelf, title: e.target.value },
                    }))
                  }
                  placeholder="Leaves worth "
                  className="hp-input"
                  maxLength={150}
                  disabled={disabled}
                />
              </div>

              <div className="hp-field-group">
                <label htmlFor="hp-shelf-emphasis" className="hp-sublabel">
                  Italic Emphasis
                </label>
                <input
                  id="hp-shelf-emphasis"
                  type="text"
                  value={shelf.emphasis}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      shelf: { ...prev.shelf, emphasis: e.target.value },
                    }))
                  }
                  placeholder="lingering over."
                  className="hp-input"
                  maxLength={150}
                  disabled={disabled}
                />
              </div>
            </div>

            <LinkControl
              idPrefix="shelf-cta"
              title="View Collection Callout"
              value={shelf.cta}
              onChange={(next) =>
                onChange((prev) => ({
                  ...prev,
                  shelf: { ...prev.shelf, cta: next },
                }))
              }
              disabled={disabled}
            />
          </div>

          {/* Empty Catalog State Card */}
          <div className="hp-card">
            <h4 className="hp-card-title">Empty / Restock State Messaging</h4>
            <p className="hp-card-desc">
              Displayed if no featured products have stock in the catalogue.
            </p>

            <div className="hp-field-group">
              <label htmlFor="hp-shelf-empty-title" className="hp-sublabel">
                Empty State Heading
              </label>
              <input
                id="hp-shelf-empty-title"
                type="text"
                value={shelf.empty_title}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    shelf: { ...prev.shelf, empty_title: e.target.value },
                  }))
                }
                placeholder="A fresh chapter is brewing."
                className="hp-input"
                maxLength={150}
                disabled={disabled}
              />
            </div>

            <div className="hp-field-group">
              <label htmlFor="hp-shelf-empty-desc" className="hp-sublabel">
                Empty State Message
              </label>
              <textarea
                id="hp-shelf-empty-desc"
                value={shelf.empty_description}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    shelf: { ...prev.shelf, empty_description: e.target.value },
                  }))
                }
                rows={3}
                className="hp-textarea"
                maxLength={400}
                placeholder="Our collection will return here soon. Explore the catalogue for available teas."
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Packaging Fallback Visual */}
        <div className="hp-col">
          <div className="hp-card">
            <h4 className="hp-card-title">
              <ShoppingBag size={16} /> Illustrative Packaging Asset
            </h4>
            <ImageFieldWithPicker
              id="hp-shelf-fallback-img"
              label="Default Packaging Tin Image"
              description="Used as the illustrative visual fallback for tea cards when a specific batch photo is pending."
              imageUrl={shelf.fallback_image_url}
              imageAlt={shelf.fallback_image_alt}
              onImageUrlChange={(url) =>
                onChange((prev) => ({
                  ...prev,
                  shelf: { ...prev.shelf, fallback_image_url: url },
                }))
              }
              onImageAltChange={(alt) =>
                onChange((prev) => ({
                  ...prev,
                  shelf: { ...prev.shelf, fallback_image_alt: alt },
                }))
              }
              aspectRatioHint="4:5 Portrait / Tin"
              recommendation="600×750 WebP"
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
