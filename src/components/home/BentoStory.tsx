"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { Play, ArrowRight, X, ExternalLink } from "lucide-react";
import type { SitePlacement } from "@/lib/media";
import { getYouTubeEmbedUrl, getYouTubeWatchUrl, isYouTubeUrl, isDirectVideoUrl } from "@/lib/videoUtils";

export interface BentoStoryProps {
  placement?: SitePlacement | null;
  /** site_placement for the right-column top collage image (hands + tea leaves) */
  collageTopPlacement?: SitePlacement | null;
  /** site_placement for the right-column bottom collage image (blossom) */
  collageBotPlacement?: SitePlacement | null;
  // Card 1: Scenic overrides
  scenicImage?: string;
  scenicAlt?: string;
  scenicTag?: string;
  scenicTitle?: string;
  scenicCtaLabel?: string;
  // Card 2: Editorial
  eyebrow?: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  // Card 3: Collage & banner
  bannerWords?: string[];
  collageTopImage?: string;
  collageTopAlt?: string;
  collageBotImage?: string;
  collageBotAlt?: string;
  // Video
  videoUrl?: string;
  videoTitle?: string;
}

export function BentoStory({
  placement,
  collageTopPlacement,
  collageBotPlacement,
  scenicImage,
  scenicAlt,
  scenicTag,
  scenicTitle,
  scenicCtaLabel,
  eyebrow = "WHY TEAFLOWW",
  title = "Rooted in tea culture.",
  body = "Inspired by the gardens and daily tea rituals of Darjeeling, Dooars, the Terai and Bengal, Teafloww shares regional origins, brewing knowledge and thoughtfully developed flavour ideas.",
  ctaLabel = "Read our story",
  ctaHref = "/blog/about-teafloww",
  bannerWords = ["PEOPLE", "PLANET", "BETTER TEA"],
  collageTopImage,
  collageTopAlt,
  collageBotImage,
  collageBotAlt,
  videoUrl = "",
  videoTitle = "Tea Rituals of North Bengal",
}: BentoStoryProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const storyImage = scenicImage || placement?.image_url || "/uploads/bento-plantation.jpg";
  const storyAlt = scenicAlt || placement?.alt_text || "Panoramic view of mountain tea estate slopes";
  const scenicTagText = scenicTag || placement?.subtitle || "TEA RITUALS & HERITAGE";
  const scenicTitleText = scenicTitle || placement?.title || "A deeper connection to nature, people and a calmer way of living.";
  const scenicCta = scenicCtaLabel || placement?.cta_label || "Watch Our Story";

  // Right-column collage images — editable via site placements or homepage content
  const effectiveCollageTopImage = collageTopImage || collageTopPlacement?.image_url || "/uploads/bento-pluck.jpg";
  const effectiveCollageTopAlt = collageTopAlt || collageTopPlacement?.alt_text || "Hands holding freshly harvested organic tea leaves";
  const effectiveCollageBotImage = collageBotImage || collageBotPlacement?.image_url || "/uploads/bento-blossom.jpg";
  const effectiveCollageBotAlt = collageBotAlt || collageBotPlacement?.alt_text || "Fresh white camellia sinensis tea blossom";

  const effectiveVideoUrl = videoUrl?.trim() || "";
  const effectiveVideoTitle = videoTitle?.trim() || "Tea Rituals of North Bengal";

  const isYouTube = isYouTubeUrl(effectiveVideoUrl);
  const isDirect = isDirectVideoUrl(effectiveVideoUrl);
  const embedUrl = isYouTube ? getYouTubeEmbedUrl(effectiveVideoUrl, true) : null;
  const watchUrl = isYouTube ? getYouTubeWatchUrl(effectiveVideoUrl) : null;
  const hasVideo = Boolean(embedUrl || isDirect);

  // Close modal on Escape key press for keyboard accessibility
  useEffect(() => {
    if (!modalOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setModalOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  return (
    <section className="tf-bento-section" aria-label="Our philosophy and origin story" id="story">
      <div className="container">
        <div className="tf-bento-grid">
          {/* Card 1: Left Landscape Panel with Dark Overlay */}
          <div className="tf-bento-card tf-bento-scenic">
            <div className="tf-bento-bg story-art" data-testid="story-art">
              {storyImage ? (
                <Image
                  src={storyImage}
                  alt={storyAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  loading="lazy"
                  className="tf-bento-bg-img"
                />
              ) : (
                <svg
                  role="img"
                  aria-label={storyAlt}
                  viewBox="0 0 600 400"
                  className="tf-bento-bg-img"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                >
                  <title>Himalayan Tea Plantation Slopes</title>
                  <desc>Slopes of high mountain organic gardens</desc>
                  <rect width="600" height="400" fill="#1d2a24" />
                  <path d="M0 300 Q150 200 300 270 T600 240 L600 400 L0 400 Z" fill="#23483a" />
                </svg>
              )}
              <div className="tf-bento-scenic-overlay" />
            </div>
            <div className="tf-bento-scenic-content">
              <span className="tf-scenic-tag">{scenicTagText}</span>
              <h2 className="tf-scenic-title">
                {scenicTitleText}
              </h2>
              <button
                type="button"
                className="tf-scenic-play-btn"
                onClick={() => setModalOpen(true)}
              >
                <span className="tf-play-pill-circle">
                  <Play size={13} fill="currentColor" />
                </span>
                <span>
                  {hasVideo ? `Watch: ${effectiveVideoTitle}` : scenicCta}
                </span>
              </button>
            </div>
          </div>

          {/* Card 2: Center Philosophy Editorial Card */}
          <div className="tf-bento-card tf-bento-philosophy">
            <div className="tf-philosophy-content">
              <span className="eyebrow">{eyebrow}</span>
              <h2 className="tf-philosophy-title">{title}</h2>
              <p className="tf-philosophy-body">{body}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-start" }}>
                <Link href={ctaHref} className="tf-philosophy-cta">
                  {ctaLabel} <ArrowRight size={14} aria-hidden="true" />
                </Link>

                {hasVideo && (
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="tf-story-video-link"
                  >
                    <Play size={12} fill="currentColor" aria-hidden="true" />
                    <span> <StorefrontText id="copy_c63ae649e0f4cd53" fallback="Watch:" /> {effectiveVideoTitle}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Right Photo Collage & Terracotta Banner */}
          <div className="tf-bento-card tf-bento-collage">
            <div className="tf-collage-photos">
              <div className="tf-collage-photo-top">
                <Image
                  src={effectiveCollageTopImage}
                  alt={effectiveCollageTopAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 20vw"
                  loading="lazy"
                  className="object-cover"
                />
              </div>
              <div className="tf-collage-photo-bottom">
                <Image
                  src={effectiveCollageBotImage}
                  alt={effectiveCollageBotAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 20vw"
                  loading="lazy"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="tf-collage-terracotta-banner">
              <div className="tf-terracotta-leaf-art" aria-hidden="true">
                <svg width="60" height="90" viewBox="0 0 60 90" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5">
                  <path d="M30 85 C30 50 10 30 10 10 C30 10 50 30 50 50 C50 70 30 85 30 85 Z" />
                  <path d="M30 85 L30 10" />
                  <path d="M30 65 L45 50" />
                  <path d="M30 45 L15 32" />
                  <path d="M30 30 L45 20" />
                </svg>
              </div>
              <div className="tf-terracotta-text">
                {bannerWords.map((word, idx) => (
                  <span key={idx}>{word}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accessible Interactive Video Story Modal Dialog */}
      {modalOpen && (
        <div
          className="tf-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="story-dialog-title"
          onClick={() => setModalOpen(false)}
        >
          <div
            className={`tf-modal-box ${hasVideo ? "tf-modal-video-box" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tf-modal-close"
              aria-label="Close modal"
              onClick={() => setModalOpen(false)}
            >
              <X size={20} />
            </button>

            {embedUrl ? (
              <div className="tf-video-modal-content">
                <div className="tf-video-modal-header">
                  <span className="tf-video-modal-tag"> <StorefrontText id="copy_ea1f3e35439415d0" fallback="TEA RITUALS OF NORTH BENGAL" /> </span>
                  <h3 id="story-dialog-title" className="tf-video-modal-heading">
                    {effectiveVideoTitle}
                  </h3>
                </div>

                <div className="tf-video-embed-container">
                  <iframe
                    src={embedUrl}
                    title={effectiveVideoTitle}
                    className="tf-video-iframe"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>

                <div className="tf-video-modal-footer">
                  <p className="tf-video-modal-desc">
                    {body}
                  </p>
                  <div className="tf-video-modal-actions">
                    {watchUrl ? (
                      <a
                        href={watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tf-video-ext-btn"
                      > <StorefrontText id="copy_818cd7480430ffb4" fallback="Watch on YouTube" /> <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    ) : <span />}

                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <Link
                        href={ctaHref}
                        onClick={() => setModalOpen(false)}
                        className="button button-primary"
                        style={{ padding: "8px 18px", fontSize: "13px" }}
                      >
                        {ctaLabel} <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => setModalOpen(false)}
                        style={{ padding: "8px 14px", fontSize: "13px", color: "#ded1b8" }}
                      > <StorefrontText id="copy_7d9eb7acb13e2462" fallback="Close" /> </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : isDirect ? (
              <div className="tf-video-modal-content">
                <div className="tf-video-modal-header">
                  <span className="tf-video-modal-tag"> <StorefrontText id="copy_ea1f3e35439415d0" fallback="TEA RITUALS OF NORTH BENGAL" /> </span>
                  <h3 id="story-dialog-title" className="tf-video-modal-heading">
                    {effectiveVideoTitle}
                  </h3>
                </div>
                <div className="tf-video-embed-container">
                  <video
                    src={effectiveVideoUrl}
                    controls
                    autoPlay
                    playsInline
                    className="tf-video-iframe"
                  />
                </div>
                <div className="tf-video-modal-footer">
                  <p className="tf-video-modal-desc">{body}</p>
                  <div className="tf-video-modal-actions">
                    <Link
                      href={ctaHref}
                      onClick={() => setModalOpen(false)}
                      className="button button-primary"
                      style={{ padding: "8px 18px", fontSize: "13px" }}
                    >
                      {ctaLabel} <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h3 id="story-dialog-title"> <StorefrontText id="copy_4465513192935249" fallback="Rooted in Tea Culture" /> </h3>
                <p style={{ marginTop: "12px", color: "#4a5047", lineHeight: 1.6 }}>
                  {body}
                </p>
                <div style={{ marginTop: "1.5rem", display: "flex", gap: "12px", alignItems: "center" }}>
                  <Link
                    href={ctaHref}
                    className="button button-primary"
                    onClick={() => setModalOpen(false)}
                  >
                    {ctaLabel} <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => setModalOpen(false)}
                  > <StorefrontText id="copy_6c8429b40af02bbb" fallback="Close Story" /> </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
