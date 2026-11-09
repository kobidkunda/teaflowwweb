"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Monitor,
  Smartphone,
  ArrowRight,
  Leaf,
  Mountain,
  Coffee,
  Heart,
  Quote,
  Eye,
  Play,
} from "lucide-react";
import { homeTrialsPresentation } from "@/lib/homeTrialsPresentation";
import { BrandLogo } from "@/components/BrandLogo";
import type { HomepageContent, CategoryOption } from "./types";

export interface LiveHomepagePreviewProps {
  content: HomepageContent;
  categories: CategoryOption[];
}

const BENEFIT_ICONS = {
  leaf: Leaf,
  mountain: Mountain,
  cup: Coffee,
  heart: Heart,
};

export function LiveHomepagePreview({ content, categories }: LiveHomepagePreviewProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [showDraftQuotes, setShowDraftQuotes] = useState(false);

  const { hero, discovery, shelf, story, benefits, reviews, newsletter } = content;
  const trials = homeTrialsPresentation(content.trials);
  const trialImage = device === "mobile" ? (trials.mobile_image_url || trials.image_url) : (trials.image_url || trials.mobile_image_url);

  const validTestimonials = reviews?.entries?.filter((e) =>
    showDraftQuotes ? true : e.approved
  ) ?? [];

  return (
    <div className="hp-preview-container">
      {/* Device Toolbar */}
      <div className="hp-preview-bar">
        <div className="hp-preview-bar-left">
          <span className="hp-preview-tag">
            <Eye size={14} />
            Live Storefront Simulation
          </span>
          <span className="hp-preview-mode-desc">
            {device === "desktop" ? "Desktop 1200px" : "Mobile 390px (iPhone viewport)"}
          </span>
        </div>

        <div className="hp-preview-bar-right">
          <div className="hp-device-toggle" role="group" aria-label="Device Viewport">
            <button
              type="button"
              className={`hp-device-btn ${device === "desktop" ? "active" : ""}`}
              onClick={() => setDevice("desktop")}
              aria-pressed={device === "desktop"}
              title="Desktop view"
            >
              <Monitor size={15} />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              className={`hp-device-btn ${device === "mobile" ? "active" : ""}`}
              onClick={() => setDevice("mobile")}
              aria-pressed={device === "mobile"}
              title="Mobile view"
            >
              <Smartphone size={15} />
              <span>Mobile</span>
            </button>
          </div>

          {reviews && reviews.entries.length > 0 && (
            <label className="hp-preview-toggle-label">
              <input
                type="checkbox"
                checked={showDraftQuotes}
                onChange={(e) => setShowDraftQuotes(e.target.checked)}
              />
              <span>Show Draft Quotes</span>
            </label>
          )}
        </div>
      </div>

      {/* Viewport Canvas Wrapper */}
      <div className={`hp-canvas-stage ${device}`}>
        <div className={`hp-canvas-device-frame ${device}`}>
          {device === "mobile" && <div className="hp-iphone-notch" />}

          <div className="hp-storefront-mockup">
            {/* Header / Brand Nav */}
            <header className="mock-header">
              <div className="mock-header-inner">
                <div className="mock-brand" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <BrandLogo variant="symbol" size={20} aria-hidden={true} />
                  <div>
                    <span className="mock-brand-name">{content.brand || "TEAFLOWW"}</span>
                    {content.tagline && <span className="mock-brand-tagline">{content.tagline}</span>}
                  </div>
                </div>

                <nav className="mock-nav-links">
                  {content.navigation.map((link, idx) => (
                    <span key={idx} className="mock-nav-item">
                      {link.label || "Link"}
                    </span>
                  ))}
                </nav>
              </div>
            </header>

            {/* Hero Section */}
            <section className="mock-hero">
              <div className="mock-hero-grid">
                <div className="mock-hero-content">
                  {hero.eyebrow && <p className="mock-eyebrow">{hero.eyebrow}</p>}
                  <h1 className="mock-hero-title">
                    {hero.title} {hero.emphasis && <em>{hero.emphasis}</em>}
                  </h1>
                  {hero.description && <p className="mock-hero-desc">{hero.description}</p>}
                  <div className="mock-hero-actions">
                    {hero.primary?.label && (
                      <span className="mock-btn mock-btn-primary">
                        {hero.primary.label} <ArrowRight size={14} />
                      </span>
                    )}
                    {hero.secondary?.label && (
                      <span className="mock-btn mock-btn-outline">{hero.secondary.label}</span>
                    )}
                  </div>
                </div>

                <div className="mock-hero-visual">
                  {hero.image_url ? (
                    <Image
                      src={hero.image_url}
                      alt={hero.image_alt || "Hero visual"}
                      fill
                      sizes="500px"
                      className="mock-hero-img"
                      unoptimized
                    />
                  ) : (
                    <div className="mock-img-placeholder">Hero Artwork (Not configured)</div>
                  )}
                </div>
              </div>
            </section>

            {/* Discovery Panels */}
            {discovery.tiles.length > 0 && (
              <section className="mock-discovery">
                <div className="mock-sec-head">
                  <div>
                    {discovery.eyebrow && <p className="mock-eyebrow">{discovery.eyebrow}</p>}
                    <h2 className="mock-sec-title">
                      {discovery.title} {discovery.emphasis && <em>{discovery.emphasis}</em>}
                    </h2>
                  </div>
                  {discovery.description && (
                    <p className="mock-sec-desc">{discovery.description}</p>
                  )}
                </div>

                <div className="mock-discovery-grid">
                  {discovery.tiles.map((tile, i) => {
                    const cat = categories.find((c) => c.id === tile.category_id);
                    return (
                      <div key={i} className={`mock-tile tone-${tile.tone}`}>
                        {tile.image_url && (
                          <Image
                            src={tile.image_url}
                            alt={tile.image_alt || "Category tile"}
                            fill
                            sizes="300px"
                            className="mock-tile-bg"
                            unoptimized
                          />
                        )}
                        <div className="mock-tile-copy">
                          <p className="mock-eyebrow">
                            {tile.eyebrow || `0${i + 1} / ${cat?.name || "TEA"}`}
                          </p>
                          <h3>{tile.title || cat?.name || "Discovery"}</h3>
                          <span className="mock-tile-cta">
                            {tile.cta_label || "Explore"} <ArrowRight size={13} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Curated Shelf */}
            <section className="mock-shelf">
              <div className="mock-sec-head">
                <div>
                  {shelf.eyebrow && <p className="mock-eyebrow">{shelf.eyebrow}</p>}
                  <h2 className="mock-sec-title">
                    {shelf.title} {shelf.emphasis && <em>{shelf.emphasis}</em>}
                  </h2>
                </div>
                {shelf.cta?.label && (
                  <span className="mock-text-link">
                    {shelf.cta.label} <ArrowRight size={13} />
                  </span>
                )}
              </div>

              <div className="mock-shelf-grid">
                <div className="mock-product-card">
                  <div className="mock-prod-img-box">
                    {shelf.fallback_image_url ? (
                      <Image
                        src={shelf.fallback_image_url}
                        alt={shelf.fallback_image_alt || "Tea Packaging"}
                        fill
                        sizes="250px"
                        className="mock-prod-img"
                        unoptimized
                      />
                    ) : (
                      <div className="mock-img-placeholder">Illustrative Tea Tin</div>
                    )}
                  </div>
                  <div className="mock-prod-info">
                    <p className="mock-eyebrow">DARJEELING · FIRST FLUSH</p>
                    <h4>Risheehat Vintage Spring</h4>
                    <p className="mock-prod-price">₹1,450 · 50g</p>
                    <span className="mock-btn-add">Add to Bag</span>
                  </div>
                </div>

                <div className="mock-product-card">
                  <div className="mock-prod-img-box">
                    <div className="mock-img-placeholder">Single Estate Reserve</div>
                  </div>
                  <div className="mock-prod-info">
                    <p className="mock-eyebrow">ASSAM · SECOND FLUSH</p>
                    <h4>Halmari Golden Tips</h4>
                    <p className="mock-prod-price">₹1,650 · 50g</p>
                    <span className="mock-btn-add">Add to Bag</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Sample kit invitation; preview selects the art for its own device mode. */}
            {content.trials && trials.enabled && (
              <section className="mock-trials" style={{ padding: "24px 0", background: "#f6f1e7", textAlign: "center" }}>
                <p style={{ fontSize: "9px", letterSpacing: ".15em", color: "#87602b" }}>{trials.eyebrow}</p>
                <h3 style={{ font: "400 24px/1.15 Georgia,serif", margin: "12px 18px" }}>{trials.title}{" "}<em style={{ color: "#956a2e" }}>{trials.emphasis}</em>{" "}{trials.title_suffix}</h3>
                <p style={{ fontSize: "11px", color: "#46544a", margin: "12px 18px" }}>{trials.description}</p>
                {trialImage && <div style={{ position: "relative", aspectRatio: device === "mobile" ? "8 / 9" : "8 / 3" }}>
                  <Image src={trialImage} alt={trials.image_alt} fill sizes="600px" unoptimized style={{ objectFit: "cover" }} />
                  <span style={{ position: "absolute", bottom: 4, right: 6, fontSize: 9, background: "#f6f1e7e8", padding: "2px 4px" }}>{trials.image_caption}</span>
                </div>}
                <span style={{ display: "inline-block", background: "#23483a", color: "#fffdf6", padding: "10px 18px", borderRadius: 4, font: "17px Georgia,serif", margin: "15px 12px 0" }}>{trials.cta.label}</span>
                <p style={{ fontSize: 10, color: "#46544a", margin: "10px 16px 0" }}>{trials.supporting_text}</p>
              </section>
            )}

            {/* Artisan Story */}
            {story && (
              <section className="mock-story">
                <div className="mock-story-visual">
                  {story.image_url ? (
                    <Image
                      src={story.image_url}
                      alt={story.image_alt || "Story image"}
                      fill
                      sizes="400px"
                      className="mock-story-img"
                      unoptimized
                    />
                  ) : (
                    <div className="mock-img-placeholder">Artisan Harvest Story</div>
                  )}
                  {story.video_url && (
                    <div
                      style={{
                        position: "absolute",
                        top: "12px",
                        left: "12px",
                        zIndex: 2,
                        background: "rgba(23, 36, 29, 0.88)",
                        backdropFilter: "blur(4px)",
                        color: "#ffffff",
                        padding: "5px 12px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                      }}
                    >
                      <Play size={10} fill="currentColor" />
                      <span>{story.video_title || "Tea Rituals of North Bengal"}</span>
                    </div>
                  )}
                  {story.caption && <p className="mock-story-caption">{story.caption}</p>}
                </div>

                <div className="mock-story-copy">
                  <Leaf className="mock-story-leaf-icon" size={80} strokeWidth={0.7} />
                  {story.eyebrow && <p className="mock-eyebrow">{story.eyebrow}</p>}
                  <h2 className="mock-sec-title">
                    {story.title} {story.emphasis && <em>{story.emphasis}</em>}
                  </h2>
                  <p className="mock-story-desc">{story.description}</p>
                  {story.cta?.label && (
                    <span className="mock-btn mock-btn-primary">
                      {story.cta.label} <ArrowRight size={14} />
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* Shopping Guidance (Benefits) */}
            {benefits && benefits.length > 0 && (
              <section className="mock-benefits">
                <div className="mock-benefits-grid">
                  {benefits.map((b, idx) => {
                    const IconComponent = BENEFIT_ICONS[b.icon] || Leaf;
                    return (
                      <div key={idx} className="mock-benefit-card">
                        <div className="mock-benefit-icon">
                          <IconComponent size={26} strokeWidth={1.2} />
                        </div>
                        <div>
                          <h5>{b.title}</h5>
                          <p>{b.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Customer Stories */}
            {reviews && (
              <section className="mock-community">
                <div className="mock-sec-head">
                  <div>
                    {reviews.eyebrow && <p className="mock-eyebrow">{reviews.eyebrow}</p>}
                    <h2 className="mock-sec-title">
                      {reviews.title} {reviews.emphasis && <em>{reviews.emphasis}</em>}
                    </h2>
                  </div>
                  {reviews.cta?.label && (
                    <span className="mock-text-link">
                      {reviews.cta.label} <ArrowRight size={13} />
                    </span>
                  )}
                </div>

                {validTestimonials.length > 0 ? (
                  <div className="mock-reviews-grid">
                    {validTestimonials.map((t, idx) => (
                      <figure key={idx} className="mock-review-card">
                        <Quote size={20} className="mock-quote-icon" />
                        <blockquote>“{t.quote}”</blockquote>
                        <figcaption>
                          — {t.attribution}{" "}
                          {!t.approved && <span className="mock-draft-badge">[Draft]</span>}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <div className="mock-reviews-empty">
                    <Coffee size={32} />
                    <h4>{reviews.empty_title || "A new chapter, shared over tea."}</h4>
                    <p>{reviews.empty_description}</p>
                  </div>
                )}
              </section>
            )}

            {/* Tea Circle Newsletter */}
            {newsletter?.enabled && (
              <section className="mock-newsletter">
                {newsletter.image_url && (
                  <Image
                    src={newsletter.image_url}
                    alt={newsletter.image_alt || "Newsletter background"}
                    fill
                    sizes="100vw"
                    className="mock-nl-bg"
                    unoptimized
                  />
                )}
                <div className="mock-nl-content">
                  {newsletter.eyebrow && <p className="mock-eyebrow">{newsletter.eyebrow}</p>}
                  <h2>{newsletter.title}</h2>
                  <p>{newsletter.description}</p>
                  <div className="mock-nl-form">
                    <input
                      type="email"
                      placeholder={newsletter.placeholder || "Enter your email"}
                      disabled
                      className="mock-nl-input"
                    />
                    <button type="button" disabled className="mock-nl-btn">
                      {newsletter.button_label || "Join"}
                    </button>
                  </div>
                  {newsletter.consent_label && (
                    <p className="mock-nl-consent">
                      ✓ {newsletter.consent_label} (
                      {newsletter.privacy?.label || "Privacy Policy"})
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Storefront Footer */}
            <footer className="mock-footer">
              <div className="mock-footer-inner">
                <div className="mock-footer-brand">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <BrandLogo variant="symbol" size={18} aria-hidden={true} />
                    <span className="mock-brand-name">{content.brand || "TEAFLOWW"}</span>
                  </div>
                  <p className="mock-footer-text">
                    {content.footer_text || "A little time. A thoughtful cup."}
                  </p>
                </div>

                <div className="mock-footer-nav">
                  {content.footer_links.map((link, idx) => (
                    <span key={idx} className="mock-footer-link">
                      {link.label}
                    </span>
                  ))}
                </div>
              </div>

              {content.disclosure && (
                <p className="mock-footer-disclosure">{content.disclosure}</p>
              )}
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
