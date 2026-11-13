"use client";

import React from "react";
import { Navigation as NavIcon, Plus, Trash2, Globe, Shield, Link as LinkIcon } from "lucide-react";
import type { HomepageContent } from "./types";

export interface NavigationTabProps {
  content: HomepageContent;
  onChange: (updater: (prev: HomepageContent) => HomepageContent) => void;
  disabled?: boolean;
}

const COMMON_PATH_PRESETS = [
  { label: "All teas", href: "/shop" },
  { label: "Find your tea", href: "/tea-finder" },
  { label: "Trials & Samples", href: "/trials" },
  { label: "About Us", href: "/about" },
  { label: "Blog & Tea Journal", href: "/blog" },
  { label: "Track order", href: "/track" },
  { label: "Your bag", href: "/cart" },
  { label: "Privacy policy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function NavigationTab({ content, onChange, disabled = false }: NavigationTabProps) {
  const { navigation, footer_links, disclosure, footer_text } = content;

  function updateNavLink(index: number, patch: { label?: string; href?: string }) {
    onChange((prev) => {
      const nextNav = [...prev.navigation];
      nextNav[index] = { ...nextNav[index], ...patch };
      return { ...prev, navigation: nextNav };
    });
  }

  function removeNavLink(index: number) {
    if (navigation.length <= 1) return;
    onChange((prev) => ({
      ...prev,
      navigation: prev.navigation.filter((_, i) => i !== index),
    }));
  }

  function addNavLink() {
    if (navigation.length >= 8) return;
    onChange((prev) => ({
      ...prev,
      navigation: [...prev.navigation, { label: "New Link", href: "/shop" }],
    }));
  }

  function updateFooterLink(index: number, patch: { label?: string; href?: string }) {
    onChange((prev) => {
      const nextFoot = [...prev.footer_links];
      nextFoot[index] = { ...nextFoot[index], ...patch };
      return { ...prev, footer_links: nextFoot };
    });
  }

  function removeFooterLink(index: number) {
    if (footer_links.length <= 1) return;
    onChange((prev) => ({
      ...prev,
      footer_links: prev.footer_links.filter((_, i) => i !== index),
    }));
  }

  function addFooterLink() {
    if (footer_links.length >= 8) return;
    onChange((prev) => ({
      ...prev,
      footer_links: [...prev.footer_links, { label: "New Link", href: "/shop" }],
    }));
  }

  return (
    <div className="hp-tab-pane">
      <div className="hp-section-intro">
        <div className="hp-section-icon">
          <NavIcon size={20} />
        </div>
        <div>
          <h3>Store Navigation & Global Footer</h3>
          <p>
            Manage the primary header navigation menu, footer links, demo collection disclosure,
            and closing brand statement.
          </p>
        </div>
      </div>

      <div className="hp-two-col-layout">
        {/* Left Column: Header Navigation Links */}
        <div className="hp-col">
          <div className="hp-card">
            <div className="hp-links-mgr-header">
              <div>
                <h4 className="hp-card-title m-0">
                  <Globe size={16} /> Header Navigation ({navigation.length} of 8)
                </h4>
                <p className="hp-card-desc">Appears in the sticky top bar on the storefront.</p>
              </div>
              <button
                type="button"
                className="hp-action-btn add-item-btn"
                onClick={addNavLink}
                disabled={disabled || navigation.length >= 8}
              >
                <Plus size={15} />
                <span>Add Link</span>
              </button>
            </div>

            <div className="hp-links-table">
              {navigation.map((link, idx) => {
                const isValid =
                  !link.href ||
                  (/^\/(?!\/)/.test(link.href) && !/[\\\s\u0000-\u001f]/.test(link.href));

                return (
                  <div key={idx} className="hp-link-row">
                    <span className="hp-link-drag-idx">{idx + 1}</span>

                    <div className="hp-link-inputs">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => updateNavLink(idx, { label: e.target.value })}
                        placeholder="Label"
                        className="hp-input sm"
                        maxLength={50}
                        disabled={disabled}
                      />
                      <input
                        type="text"
                        value={link.href}
                        onChange={(e) => updateNavLink(idx, { href: e.target.value })}
                        placeholder="/path"
                        className={`hp-input sm ${!isValid ? "input-error" : ""}`}
                        maxLength={200}
                        disabled={disabled}
                      />
                    </div>

                    {navigation.length > 1 && (
                      <button
                        type="button"
                        className="hp-link-del-btn"
                        onClick={() => removeNavLink(idx)}
                        title="Remove link"
                        disabled={disabled}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Navigation Links */}
          <div className="hp-card">
            <div className="hp-links-mgr-header">
              <div>
                <h4 className="hp-card-title m-0">
                  <LinkIcon size={16} /> Footer Links ({footer_links.length} of 8)
                </h4>
                <p className="hp-card-desc">Appears in the global bottom footer navigation.</p>
              </div>
              <button
                type="button"
                className="hp-action-btn add-item-btn"
                onClick={addFooterLink}
                disabled={disabled || footer_links.length >= 8}
              >
                <Plus size={15} />
                <span>Add Link</span>
              </button>
            </div>

            <div className="hp-links-table">
              {footer_links.map((link, idx) => {
                const isValid =
                  !link.href ||
                  (/^\/(?!\/)/.test(link.href) && !/[\\\s\u0000-\u001f]/.test(link.href));

                return (
                  <div key={idx} className="hp-link-row">
                    <span className="hp-link-drag-idx">{idx + 1}</span>

                    <div className="hp-link-inputs">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => updateFooterLink(idx, { label: e.target.value })}
                        placeholder="Label"
                        className="hp-input sm"
                        maxLength={50}
                        disabled={disabled}
                      />
                      <input
                        type="text"
                        value={link.href}
                        onChange={(e) => updateFooterLink(idx, { href: e.target.value })}
                        placeholder="/path"
                        className={`hp-input sm ${!isValid ? "input-error" : ""}`}
                        maxLength={200}
                        disabled={disabled}
                      />
                    </div>

                    {footer_links.length > 1 && (
                      <button
                        type="button"
                        className="hp-link-del-btn"
                        onClick={() => removeFooterLink(idx)}
                        title="Remove link"
                        disabled={disabled}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Legal Disclosure & Footer Quote */}
        <div className="hp-col">
          <div className="hp-card">
            <h4 className="hp-card-title">
              <Shield size={16} /> Legal & Demonstration Disclosure
            </h4>
            <p className="hp-card-desc">
              Mandatory disclaimer shown across the storefront footer.
            </p>

            <div className="hp-field-group">
              <label htmlFor="hp-disclosure" className="hp-sublabel">
                Disclosure Statement
              </label>
              <textarea
                id="hp-disclosure"
                value={disclosure}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, disclosure: e.target.value }))
                }
                rows={4}
                className="hp-textarea"
                maxLength={400}
                placeholder="Demo collection · Tea details and packaging are illustrative..."
                disabled={disabled}
              />
            </div>
          </div>

          <div className="hp-card">
            <h4 className="hp-card-title">Closing Brand Quote</h4>
            <p className="hp-card-desc">
              Sentimental closing message rendered in the footer brand column.
            </p>

            <div className="hp-field-group">
              <label htmlFor="hp-footer-text" className="hp-sublabel">
                Footer Closing Message
              </label>
              <textarea
                id="hp-footer-text"
                value={footer_text}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, footer_text: e.target.value }))
                }
                rows={3}
                className="hp-textarea"
                maxLength={300}
                placeholder="A little time. A thoughtful cup. Your daily ritual, rediscovered."
                disabled={disabled}
              />
            </div>
          </div>

          {/* Quick Route Presets Box */}
          <div className="hp-card">
            <h4 className="hp-card-title">Common Local Route Shortcuts</h4>
            <div className="hp-route-pills">
              {COMMON_PATH_PRESETS.map((p) => (
                <span key={p.href} className="hp-route-pill">
                  <strong>{p.label}</strong>
                  <code>{p.href}</code>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
