"use client";

import React from "react";
import { Quote, Plus, Trash2, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import { LinkControl } from "./LinkControl";
import type { HomepageContent } from "./types";

export interface ReviewsTabProps {
  content: HomepageContent;
  onChange: (updater: (prev: HomepageContent) => HomepageContent) => void;
  disabled?: boolean;
}

export function ReviewsTab({ content, onChange, disabled = false }: ReviewsTabProps) {
  const reviews = content.reviews ?? {
    eyebrow: "THE TEA CIRCLE",
    title: "Good tea.",
    emphasis: "Your stories next.",
    empty_title: "A new chapter, shared over tea.",
    empty_description:
      "Customer stories will appear here as our community grows. For now, let the tasting notes lead you to your first cup.",
    cta: { label: "Find your first cup", href: "/tea-finder" },
    entries: [],
  };

  const entries = reviews.entries ?? [];
  const approvedCount = entries.filter((e) => e.approved).length;

  function updateEntry(
    index: number,
    patch: Partial<(typeof entries)[number]>
  ) {
    onChange((prev) => {
      const currentReviews = prev.reviews ?? reviews;
      const nextEntries = [...currentReviews.entries];
      nextEntries[index] = { ...nextEntries[index], ...patch };
      return {
        ...prev,
        reviews: { ...currentReviews, entries: nextEntries },
      };
    });
  }

  function removeEntry(index: number) {
    onChange((prev) => {
      const currentReviews = prev.reviews ?? reviews;
      return {
        ...prev,
        reviews: {
          ...currentReviews,
          entries: currentReviews.entries.filter((_, i) => i !== index),
        },
      };
    });
  }

  function addEntry() {
    if (entries.length >= 6) return;
    onChange((prev) => {
      const currentReviews = prev.reviews ?? reviews;
      return {
        ...prev,
        reviews: {
          ...currentReviews,
          entries: [
            ...currentReviews.entries,
            {
              quote: "The subtle muscatel aroma and clean finish took me straight to the hills.",
              attribution: "Kiran S., Verified Patron",
              approved: false,
            },
          ],
        },
      };
    });
  }

  return (
    <div className="hp-tab-pane">
      <div className="hp-section-intro">
        <div className="hp-section-icon">
          <Quote size={20} />
        </div>
        <div>
          <h3>Customer Stories & Genuine Testimonials</h3>
          <p>
            Share authentic words from real patrons. Respect customer trust: draft quotes
            remain strictly confidential and never appear on the public storefront until verified
            and approved.
          </p>
        </div>
      </div>

      {/* Compliance / Truthful Provenance Banner */}
      <div className="hp-compliance-banner">
        <ShieldAlert size={18} className="hp-compliance-icon" />
        <div className="hp-compliance-text">
          <strong>Truthful Commerce Policy</strong>
          <p>
            Never fabricate customer reviews or claim false quotes. Only toggle approval once
            express customer consent has been obtained to publish their review and display name.
          </p>
        </div>
      </div>

      {/* Section Typography & CTA */}
      <div className="hp-card mb-6">
        <h4 className="hp-card-title">Testimonials Section Header</h4>
        <div className="hp-grid-3">
          <div className="hp-field-group">
            <label htmlFor="hp-rev-eyebrow" className="hp-sublabel">
              Section Eyebrow
            </label>
            <input
              id="hp-rev-eyebrow"
              type="text"
              value={reviews.eyebrow}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  reviews: { ...(prev.reviews ?? reviews), eyebrow: e.target.value },
                }))
              }
              placeholder="THE TEA CIRCLE"
              className="hp-input"
              maxLength={100}
              disabled={disabled}
            />
          </div>

          <div className="hp-field-group">
            <label htmlFor="hp-rev-title" className="hp-sublabel">
              Headline
            </label>
            <input
              id="hp-rev-title"
              type="text"
              value={reviews.title}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  reviews: { ...(prev.reviews ?? reviews), title: e.target.value },
                }))
              }
              placeholder="Good tea."
              className="hp-input"
              maxLength={100}
              disabled={disabled}
            />
          </div>

          <div className="hp-field-group">
            <label htmlFor="hp-rev-emphasis" className="hp-sublabel">
              Italic Emphasis
            </label>
            <input
              id="hp-rev-emphasis"
              type="text"
              value={reviews.emphasis}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  reviews: { ...(prev.reviews ?? reviews), emphasis: e.target.value },
                }))
              }
              placeholder="Your stories next."
              className="hp-input"
              maxLength={100}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="hp-grid-2 mt-4">
          <div className="hp-field-group">
            <label htmlFor="hp-rev-empty-title" className="hp-sublabel">
              Empty State Headline
            </label>
            <input
              id="hp-rev-empty-title"
              type="text"
              value={reviews.empty_title}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  reviews: { ...(prev.reviews ?? reviews), empty_title: e.target.value },
                }))
              }
              placeholder="A new chapter, shared over tea."
              className="hp-input"
              maxLength={150}
              disabled={disabled}
            />
          </div>

          <div className="hp-field-group">
            <label htmlFor="hp-rev-empty-desc" className="hp-sublabel">
              Empty State Description
            </label>
            <input
              id="hp-rev-empty-desc"
              type="text"
              value={reviews.empty_description}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  reviews: {
                    ...(prev.reviews ?? reviews),
                    empty_description: e.target.value,
                  },
                }))
              }
              placeholder="Customer stories will appear here as our community grows..."
              className="hp-input"
              maxLength={300}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="mt-4">
          <LinkControl
            idPrefix="reviews-cta"
            title="Discovery Callout Button"
            value={reviews.cta}
            onChange={(next) =>
              onChange((prev) => ({
                ...prev,
                reviews: { ...(prev.reviews ?? reviews), cta: next },
              }))
            }
            disabled={disabled}
          />
        </div>
      </div>

      {/* Testimonials List */}
      <div className="hp-reviews-manager">
        <div className="hp-reviews-header">
          <div className="hp-reviews-counts">
            <h4>Genuine Customer Quotes ({entries.length} of 6)</h4>
            <span className="hp-reviews-stat-pill">
              {approvedCount} Published · {entries.length - approvedCount} Drafts
            </span>
          </div>
          <button
            type="button"
            className="hp-action-btn add-item-btn"
            onClick={addEntry}
            disabled={disabled || entries.length >= 6}
          >
            <Plus size={16} />
            <span>Add Testimonial</span>
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="hp-card text-center p-8">
            <p className="hp-muted-text">
              No testimonials added yet. Click &ldquo;Add Testimonial&rdquo; above to register
              patron feedback.
            </p>
          </div>
        ) : (
          <div className="hp-reviews-stack">
            {entries.map((entry, index) => {
              return (
                <div
                  key={index}
                  className={`hp-review-card ${entry.approved ? "is-approved" : "is-draft"}`}
                >
                  <div className="hp-review-card-head">
                    <div className="hp-review-status-wrap">
                      <span className="hp-review-num">Quote #{index + 1}</span>
                      <span
                        className={`hp-approval-pill ${
                          entry.approved ? "approved" : "draft"
                        }`}
                      >
                        {entry.approved ? (
                          <>
                            <CheckCircle2 size={13} /> Approved & Public on Storefront
                          </>
                        ) : (
                          <>
                            <AlertCircle size={13} /> Draft (Consent pending · Hidden)
                          </>
                        )}
                      </span>
                    </div>

                    <div className="hp-review-actions">
                      <label className="hp-switch-wrap" title="Toggle publication status">
                        <input
                          type="checkbox"
                          checked={entry.approved}
                          onChange={(e) =>
                            updateEntry(index, { approved: e.target.checked })
                          }
                          disabled={disabled}
                        />
                        <span className="hp-switch-slider" />
                        <span className="hp-switch-text">Approved with consent</span>
                      </label>

                      <button
                        type="button"
                        className="hp-tile-remove-btn"
                        onClick={() => removeEntry(index)}
                        title="Delete quote"
                        disabled={disabled}
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="hp-review-body">
                    <div className="hp-field-group">
                      <label htmlFor={`rev-${index}-quote`} className="hp-sublabel">
                        Customer Quote <span className="req-star">*</span>
                      </label>
                      <textarea
                        id={`rev-${index}-quote`}
                        value={entry.quote}
                        onChange={(e) => updateEntry(index, { quote: e.target.value })}
                        rows={2}
                        className="hp-textarea"
                        placeholder="The subtle muscatel notes were exquisite..."
                        maxLength={400}
                        disabled={disabled}
                      />
                    </div>

                    <div className="hp-field-group">
                      <label htmlFor={`rev-${index}-attr`} className="hp-sublabel">
                        Attribution / Public Display Name <span className="req-star">*</span>
                      </label>
                      <input
                        id={`rev-${index}-attr`}
                        type="text"
                        value={entry.attribution}
                        onChange={(e) =>
                          updateEntry(index, { attribution: e.target.value })
                        }
                        placeholder="e.g. Aarti M., First Flush Club Member"
                        className="hp-input"
                        maxLength={120}
                        disabled={disabled}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
