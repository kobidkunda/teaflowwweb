"use client";

import React from "react";
import { Compass, Plus, Trash2 } from "lucide-react";
import { ImageFieldWithPicker } from "./ImageFieldWithPicker";
import type { HomepageContent, CategoryOption } from "./types";

export interface DiscoveryTabProps {
  content: HomepageContent;
  categories: CategoryOption[];
  onChange: (updater: (prev: HomepageContent) => HomepageContent) => void;
  disabled?: boolean;
}

export function DiscoveryTab({
  content,
  categories,
  onChange,
  disabled = false,
}: DiscoveryTabProps) {
  const { discovery } = content;

  function updateTile(index: number, patch: Partial<(typeof discovery.tiles)[number]>) {
    onChange((prev) => {
      const nextTiles = [...prev.discovery.tiles];
      nextTiles[index] = { ...nextTiles[index], ...patch };
      return {
        ...prev,
        discovery: { ...prev.discovery, tiles: nextTiles },
      };
    });
  }

  function removeTile(index: number) {
    if (discovery.tiles.length <= 1) return;
    onChange((prev) => ({
      ...prev,
      discovery: {
        ...prev.discovery,
        tiles: prev.discovery.tiles.filter((_, i) => i !== index),
      },
    }));
  }

  function addTile() {
    if (discovery.tiles.length >= 4) return;
    const nextIndex = discovery.tiles.length + 1;
    const defaultCatId = categories[0]?.id ?? 1;

    onChange((prev) => ({
      ...prev,
      discovery: {
        ...prev.discovery,
        tiles: [
          ...prev.discovery.tiles,
          {
            category_id: defaultCatId,
            eyebrow: `0${nextIndex} / DISCOVERY`,
            title: "Fresh & aromatic.",
            image_url: "/images/home/green-ritual.webp",
            image_alt: "Artisan tea leaves",
            cta_label: "Explore collection",
            tone: "dark",
          },
        ],
      },
    }));
  }

  return (
    <div className="hp-tab-pane">
      <div className="hp-section-intro">
        <div className="hp-section-icon">
          <Compass size={20} />
        </div>
        <div>
          <h3>Curated Discovery Panels</h3>
          <p>
            Feature up to 4 tea categories with distinctive photography and tone settings.
            Tiles link directly to filtered catalogue views.
          </p>
        </div>
      </div>

      {/* Discovery Section Header Card */}
      <div className="hp-card mb-6">
        <h4 className="hp-card-title">Section Header</h4>
        <div className="hp-grid-3">
          <div className="hp-field-group">
            <label htmlFor="hp-disc-eyebrow" className="hp-sublabel">
              Section Eyebrow
            </label>
            <input
              id="hp-disc-eyebrow"
              type="text"
              value={discovery.eyebrow}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  discovery: { ...prev.discovery, eyebrow: e.target.value },
                }))
              }
              placeholder="A TEA FOR EVERY MOMENT"
              className="hp-input"
              maxLength={150}
              disabled={disabled}
            />
          </div>

          <div className="hp-field-group">
            <label htmlFor="hp-disc-title" className="hp-sublabel">
              Main Headline
            </label>
            <input
              id="hp-disc-title"
              type="text"
              value={discovery.title}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  discovery: { ...prev.discovery, title: e.target.value },
                }))
              }
              placeholder="How do you like"
              className="hp-input"
              maxLength={150}
              disabled={disabled}
            />
          </div>

          <div className="hp-field-group">
            <label htmlFor="hp-disc-emphasis" className="hp-sublabel">
              Italic Emphasis
            </label>
            <input
              id="hp-disc-emphasis"
              type="text"
              value={discovery.emphasis}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  discovery: { ...prev.discovery, emphasis: e.target.value },
                }))
              }
              placeholder="your cup?"
              className="hp-input"
              maxLength={150}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="hp-field-group">
          <label htmlFor="hp-disc-desc" className="hp-sublabel">
            Introductory Copy
          </label>
          <textarea
            id="hp-disc-desc"
            value={discovery.description}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                discovery: { ...prev.discovery, description: e.target.value },
              }))
            }
            rows={2}
            className="hp-textarea"
            maxLength={350}
            placeholder="Whether you know every estate by name or simply know what you love..."
            disabled={disabled}
          />
        </div>
      </div>

      {/* Discovery Tiles List */}
      <div className="hp-tiles-manager">
        <div className="hp-tiles-header">
          <h4>Discovery Tiles ({discovery.tiles.length} of 4 configured)</h4>
          <button
            type="button"
            className="hp-action-btn add-item-btn"
            onClick={addTile}
            disabled={disabled || discovery.tiles.length >= 4}
          >
            <Plus size={16} />
            <span>Add Panel</span>
          </button>
        </div>

        <div className="hp-tiles-grid">
          {discovery.tiles.map((tile, index) => {
            return (
              <div key={index} className="hp-tile-editor-card">
                <div className="hp-tile-editor-header">
                  <span className="hp-tile-badge">Panel 0{index + 1}</span>
                  {discovery.tiles.length > 1 && (
                    <button
                      type="button"
                      className="hp-tile-remove-btn"
                      onClick={() => removeTile(index)}
                      title="Remove this panel"
                      disabled={disabled}
                    >
                      <Trash2 size={14} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="hp-tile-fields">
                  <div className="hp-field-group">
                    <label htmlFor={`tile-${index}-cat`} className="hp-sublabel">
                      Target Category
                    </label>
                    <select
                      id={`tile-${index}-cat`}
                      value={tile.category_id}
                      onChange={(e) =>
                        updateTile(index, { category_id: Number(e.target.value) })
                      }
                      className="hp-select"
                      disabled={disabled}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (ID: {c.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="hp-grid-2">
                    <div className="hp-field-group">
                      <label htmlFor={`tile-${index}-eyebrow`} className="hp-sublabel">
                        Eyebrow Label
                      </label>
                      <input
                        id={`tile-${index}-eyebrow`}
                        type="text"
                        value={tile.eyebrow}
                        onChange={(e) => updateTile(index, { eyebrow: e.target.value })}
                        placeholder="01 / THE MORNING RITUAL"
                        className="hp-input"
                        maxLength={100}
                        disabled={disabled}
                      />
                    </div>

                    <div className="hp-field-group">
                      <label htmlFor={`tile-${index}-title`} className="hp-sublabel">
                        Tile Title
                      </label>
                      <input
                        id={`tile-${index}-title`}
                        type="text"
                        value={tile.title}
                        onChange={(e) => updateTile(index, { title: e.target.value })}
                        placeholder="Bold & beautiful."
                        className="hp-input"
                        maxLength={100}
                        disabled={disabled}
                      />
                    </div>
                  </div>

                  <div className="hp-grid-2">
                    <div className="hp-field-group">
                      <label htmlFor={`tile-${index}-cta`} className="hp-sublabel">
                        CTA Button Text
                      </label>
                      <input
                        id={`tile-${index}-cta`}
                        type="text"
                        value={tile.cta_label}
                        onChange={(e) => updateTile(index, { cta_label: e.target.value })}
                        placeholder="Explore black tea"
                        className="hp-input"
                        maxLength={60}
                        disabled={disabled}
                      />
                    </div>

                    <div className="hp-field-group">
                      <label className="hp-sublabel">Contrast Tone</label>
                      <div className="hp-tone-options" role="radiogroup">
                        <button
                          type="button"
                          className={`hp-tone-btn tone-dark ${
                            tile.tone === "dark" ? "active" : ""
                          }`}
                          onClick={() => updateTile(index, { tone: "dark" })}
                          disabled={disabled}
                        >
                          <span className="hp-tone-swatch dark" />
                          <span>Dark Overlay (White text)</span>
                        </button>
                        <button
                          type="button"
                          className={`hp-tone-btn tone-light ${
                            tile.tone === "light" ? "active" : ""
                          }`}
                          onClick={() => updateTile(index, { tone: "light" })}
                          disabled={disabled}
                        >
                          <span className="hp-tone-swatch light" />
                          <span>Light Overlay (Dark text)</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <ImageFieldWithPicker
                    id={`tile-${index}-img`}
                    label="Panel Visual Artwork"
                    imageUrl={tile.image_url}
                    imageAlt={tile.image_alt}
                    onImageUrlChange={(url) => updateTile(index, { image_url: url })}
                    onImageAltChange={(alt) => updateTile(index, { image_alt: alt })}
                    aspectRatioHint="1:1 or 4:5 Portrait"
                    recommendation="800×800 WebP"
                    disabled={disabled}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
