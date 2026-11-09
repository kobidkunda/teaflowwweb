"use client";

import React from "react";
import { ShieldCheck, Plus, Trash2, Leaf, Mountain, Coffee, Heart } from "lucide-react";
import type { HomepageContent } from "./types";

export interface BenefitsTabProps {
  content: HomepageContent;
  onChange: (updater: (prev: HomepageContent) => HomepageContent) => void;
  disabled?: boolean;
}

const ICON_OPTIONS: Array<{
  id: "leaf" | "mountain" | "cup" | "heart";
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  hint: string;
}> = [
  { id: "leaf", label: "Leaf", icon: Leaf, hint: "Fresh leaves, botanical purity" },
  { id: "mountain", label: "Mountain", icon: Mountain, hint: "High elevation terroir & estate" },
  { id: "cup", label: "Cup", icon: Coffee, hint: "Steeping ritual & cupping notes" },
  { id: "heart", label: "Heart", icon: Heart, hint: "Wellness, calm & passion" },
];

export function BenefitsTab({ content, onChange, disabled = false }: BenefitsTabProps) {
  const benefits = content.benefits ?? [];

  function updateBenefit(
    index: number,
    patch: Partial<(typeof benefits)[number]>
  ) {
    onChange((prev) => {
      const nextBenefits = [...(prev.benefits ?? [])];
      nextBenefits[index] = { ...nextBenefits[index], ...patch };
      return {
        ...prev,
        benefits: nextBenefits,
      };
    });
  }

  function removeBenefit(index: number) {
    if (benefits.length <= 1) return;
    onChange((prev) => ({
      ...prev,
      benefits: (prev.benefits ?? []).filter((_, i) => i !== index),
    }));
  }

  function addBenefit() {
    if (benefits.length >= 4) return;
    const icons: Array<"leaf" | "mountain" | "cup" | "heart"> = [
      "leaf",
      "mountain",
      "cup",
      "heart",
    ];
    const nextIcon = icons[benefits.length % icons.length];

    onChange((prev) => ({
      ...prev,
      benefits: [
        ...(prev.benefits ?? []),
        {
          icon: nextIcon,
          title: "Thoughtful Ritual",
          description: "Curated experiences crafted for intentional moments.",
        },
      ],
    }));
  }

  return (
    <div className="hp-tab-pane">
      <div className="hp-section-intro">
        <div className="hp-section-icon">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h3>Shopping Guidance & Value Pillars</h3>
          <p>
            Feature 4 distinct value pillars that guide customer confidence: tasting notes,
            single estate provenance, step-by-step steeping methods, and personal tea matching.
          </p>
        </div>
      </div>

      <div className="hp-benefits-header">
        <h4>Value Pillars ({benefits.length} of 4 configured)</h4>
        <button
          type="button"
          className="hp-action-btn add-item-btn"
          onClick={addBenefit}
          disabled={disabled || benefits.length >= 4}
        >
          <Plus size={16} />
          <span>Add Pillar</span>
        </button>
      </div>

      <div className="hp-benefits-grid">
        {benefits.map((benefit, index) => {
          return (
            <div key={index} className="hp-benefit-card">
              <div className="hp-benefit-card-header">
                <span className="hp-benefit-num">Pillar 0{index + 1}</span>
                {benefits.length > 1 && (
                  <button
                    type="button"
                    className="hp-tile-remove-btn"
                    onClick={() => removeBenefit(index)}
                    title="Remove pillar"
                    disabled={disabled}
                  >
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Icon Selection Group */}
              <div className="hp-field-group">
                <label className="hp-sublabel">Emblem Icon</label>
                <div className="hp-icon-picker" role="radiogroup" aria-label="Pillar Icon">
                  {ICON_OPTIONS.map((opt) => {
                    const IconComp = opt.icon;
                    const isSelected = benefit.icon === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`hp-icon-option ${isSelected ? "selected" : ""}`}
                        onClick={() => updateBenefit(index, { icon: opt.id })}
                        title={`${opt.label}: ${opt.hint}`}
                        aria-pressed={isSelected}
                        disabled={disabled}
                      >
                        <IconComp size={22} strokeWidth={1.3} />
                        <span className="hp-icon-name">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="hp-field-group">
                <label htmlFor={`benefit-${index}-title`} className="hp-sublabel">
                  Pillar Headline
                </label>
                <input
                  id={`benefit-${index}-title`}
                  type="text"
                  value={benefit.title}
                  onChange={(e) => updateBenefit(index, { title: e.target.value })}
                  placeholder="Explore the leaves"
                  className="hp-input"
                  maxLength={100}
                  disabled={disabled}
                />
              </div>

              <div className="hp-field-group">
                <label htmlFor={`benefit-${index}-desc`} className="hp-sublabel">
                  Description / Guidance
                </label>
                <textarea
                  id={`benefit-${index}-desc`}
                  value={benefit.description}
                  onChange={(e) => updateBenefit(index, { description: e.target.value })}
                  rows={2}
                  className="hp-textarea"
                  maxLength={250}
                  placeholder="Tasting notes and harvest profiles to guide every cup."
                  disabled={disabled}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
