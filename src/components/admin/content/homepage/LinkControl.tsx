"use client";

import React from "react";
import { AlertCircle, Link as LinkIcon, Compass } from "lucide-react";

export interface LinkValue {
  label: string;
  href: string;
}

export interface LinkControlProps {
  idPrefix: string;
  title: string;
  value: LinkValue;
  onChange: (next: LinkValue) => void;
  required?: boolean;
  disabled?: boolean;
}

const COMMON_PRESETS = [
  { label: "Shop All", href: "/shop" },
  { label: "Tea Finder", href: "/tea-finder" },
  { label: "Trials & Samples", href: "/trials" },
  { label: "Our Story", href: "/about" },
  { label: "Order Tracking", href: "/track" },
  { label: "Shopping Bag", href: "/cart" },
  { label: "Tea Journal", href: "/blog" },
];

export function LinkControl({
  idPrefix,
  title,
  value,
  onChange,
  required = false,
  disabled = false,
}: LinkControlProps) {
  const isValidLocalPath =
    !value.href || (/^\/(?!\/)/.test(value.href) && !/[\\\s\u0000-\u001f]/.test(value.href));

  return (
    <div className="hp-link-card">
      <div className="hp-link-header">
        <span className="hp-link-title">
          <LinkIcon size={14} />
          {title}
        </span>
        {required && <span className="req-pill">Required</span>}
      </div>

      <div className="hp-link-grid">
        <div className="hp-field-group">
          <label htmlFor={`${idPrefix}-label`} className="hp-sublabel">
            Button / Link Text
          </label>
          <input
            id={`${idPrefix}-label`}
            type="text"
            value={value.label}
            onChange={(e) => onChange({ ...value, label: e.target.value })}
            placeholder="e.g. Shop Collection"
            className="hp-input"
            maxLength={100}
            disabled={disabled}
          />
        </div>

        <div className="hp-field-group">
          <label htmlFor={`${idPrefix}-href`} className="hp-sublabel">
            Destination Path
          </label>
          <input
            id={`${idPrefix}-href`}
            type="text"
            value={value.href}
            onChange={(e) => onChange({ ...value, href: e.target.value })}
            placeholder="/shop"
            className={`hp-input ${!isValidLocalPath ? "input-error" : ""}`}
            maxLength={250}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Preset shortcuts */}
      <div className="hp-link-presets">
        <span className="hp-preset-title">
          <Compass size={12} />
          Presets:
        </span>
        <div className="hp-preset-pills">
          {COMMON_PRESETS.map((p) => (
            <button
              key={p.href}
              type="button"
              className={`hp-preset-pill ${value.href === p.href ? "active" : ""}`}
              onClick={() =>
                onChange({
                  label: value.label ? value.label : p.label,
                  href: p.href,
                })
              }
              disabled={disabled}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!isValidLocalPath && (
        <p className="hp-error-hint">
          <AlertCircle size={13} /> Destination must start with a local slash (e.g. /shop,
          /tea-finder). Protocol schemes and external domains are not permitted.
        </p>
      )}
    </div>
  );
}
