"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Feather, Youtube, Play, ExternalLink, X, Film, Images } from "lucide-react";
import { ImageFieldWithPicker } from "./ImageFieldWithPicker";
import { LinkControl } from "./LinkControl";
import { getYouTubeEmbedUrl, extractYouTubeId, isYouTubeUrl } from "@/lib/videoUtils";
import type { HomepageContent } from "./types";

export interface StoryTabProps {
  content: HomepageContent;
  onChange: (updater: (prev: HomepageContent) => HomepageContent) => void;
  disabled?: boolean;
}

/** Persists a site placement image update via the admin placements API */
async function savePlacementImage(
  sectionKey: string,
  imageUrl: string,
  altText: string,
): Promise<void> {
  await fetch("/api/admin/placements", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section_key: sectionKey, image_url: imageUrl, alt_text: altText }),
  });
}


const DEFAULT_STORY = {
  eyebrow: "OUR PHILOSOPHY",
  title: "Rooted in tea culture.",
  emphasis: "Guided by curiosity.",
  description:
    "Inspired by the gardens and daily tea rituals of Darjeeling, Dooars, the Terai and Bengal, Teafloww shares regional origins, brewing knowledge and thoughtfully developed flavour ideas.",
  image_url: "/uploads/bento-plantation.jpg",
  image_alt: "Panoramic view of mountain tea estate slopes",
  caption: "More than tea.\nA moment for yourself.",
  scenic_tag: "MORE THAN TEA.",
  scenic_title: "A deeper connection to nature, people and a calmer way of living.",
  scenic_cta_label: "Watch Our Story",
  collage_top_image_url: "/uploads/bento-pluck.jpg",
  collage_top_image_alt: "Hands holding freshly harvested organic tea leaves",
  collage_bottom_image_url: "/uploads/bento-blossom.jpg",
  collage_bottom_image_alt: "Fresh white camellia sinensis tea blossom",
  banner_words: ["PEOPLE", "PLANET", "BETTER TEA"],
  cta: {
    label: "Read our story",
    href: "/blog/about-teafloww",
  },
  video_url: "",
  video_title: "Tea Rituals of North Bengal",
};

export function StoryTab({ content, onChange, disabled = false }: StoryTabProps) {
  const { story } = content;

  // Local state for the two right-column collage images
  const [collageTopUrl, setCollageTopUrl] = useState(story?.collage_top_image_url || "/uploads/bento-pluck.jpg");
  const [collageTopAlt, setCollageTopAlt] = useState(story?.collage_top_image_alt || "Hands holding freshly harvested organic tea leaves");
  const [collageBotUrl, setCollageBotUrl] = useState(story?.collage_bottom_image_url || "/uploads/bento-blossom.jpg");
  const [collageBotAlt, setCollageBotAlt] = useState(story?.collage_bottom_image_alt || "Fresh white camellia sinensis tea blossom");

  // Keep state synced if content changes from outside
  useEffect(() => {
    if (story?.collage_top_image_url) setCollageTopUrl(story.collage_top_image_url);
    if (story?.collage_top_image_alt) setCollageTopAlt(story.collage_top_image_alt);
    if (story?.collage_bottom_image_url) setCollageBotUrl(story.collage_bottom_image_url);
    if (story?.collage_bottom_image_alt) setCollageBotAlt(story.collage_bottom_image_alt);
  }, [story?.collage_top_image_url, story?.collage_top_image_alt, story?.collage_bottom_image_url, story?.collage_bottom_image_alt]);

  // Load existing placement values on mount if unset in story
  useEffect(() => {
    void (async () => {
      const [topRes, botRes] = await Promise.all([
        fetch("/api/admin/placements?key=home_story_collage_top"),
        fetch("/api/admin/placements?key=home_story_collage_bot"),
      ]);
      if (topRes.ok) {
        const data = await topRes.json() as { placement?: { image_url?: string; alt_text?: string } | null };
        if (data.placement?.image_url && !story?.collage_top_image_url) {
          setCollageTopUrl(data.placement.image_url);
          onChange((prev) => ({
            ...prev,
            story: { ...prev.story!, collage_top_image_url: data.placement!.image_url! },
          }));
        }
        if (data.placement?.alt_text && !story?.collage_top_image_alt) {
          setCollageTopAlt(data.placement.alt_text);
        }
      }
      if (botRes.ok) {
        const data = await botRes.json() as { placement?: { image_url?: string; alt_text?: string } | null };
        if (data.placement?.image_url && !story?.collage_bottom_image_url) {
          setCollageBotUrl(data.placement.image_url);
          onChange((prev) => ({
            ...prev,
            story: { ...prev.story!, collage_bottom_image_url: data.placement!.image_url! },
          }));
        }
        if (data.placement?.alt_text && !story?.collage_bottom_image_alt) {
          setCollageBotAlt(data.placement.alt_text);
        }
      }
    })();
  }, []);

  if (!story) {
    return (
      <div className="hp-tab-pane">
        <div className="hp-section-intro">
          <div className="hp-section-icon">
            <BookOpen size={20} />
          </div>
          <div>
            <h3>Artisan Story & Philosophy</h3>
            <p>This section is currently disabled in your homepage configuration.</p>
          </div>
        </div>
        <div className="hp-card text-center p-8">
          <p className="mb-4">
            Enable the Artisan Story chapter to showcase single-estate terroir and harvesting
            craftsmanship.
          </p>
          <button
            type="button"
            className="hp-action-btn primary"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                story: DEFAULT_STORY,
              }))
            }
            disabled={disabled}
          >
            Enable Artisan Story Section
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hp-tab-pane">
      <div className="hp-section-intro">
        <div className="hp-section-icon">
          <BookOpen size={20} />
        </div>
        <div>
          <h3>Artisan Story & Estate Terroir</h3>
          <p>
            An intimate editorial section highlighting the craftsmanship, elevation, and
            meditative nature of Himalayan loose-leaf tea. All 3 panel images and copy are editable here.
          </p>
        </div>
      </div>

      <div className="hp-two-col-layout">
        {/* Left Column: Story Editorial Copy */}
        <div className="hp-col">
          <div className="hp-card">
            <h4 className="hp-card-title">
              <Feather size={16} /> Story Narrative (Center Panel)
            </h4>

            <div className="hp-field-group">
              <label htmlFor="hp-story-eyebrow" className="hp-sublabel">
                Story Eyebrow
              </label>
              <input
                id="hp-story-eyebrow"
                type="text"
                value={story.eyebrow}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    story: { ...prev.story!, eyebrow: e.target.value },
                  }))
                }
                placeholder="OUR PHILOSOPHY"
                className="hp-input"
                maxLength={100}
                disabled={disabled}
              />
            </div>

            <div className="hp-grid-2">
              <div className="hp-field-group">
                <label htmlFor="hp-story-title" className="hp-sublabel">
                  Headline
                </label>
                <input
                  id="hp-story-title"
                  type="text"
                  value={story.title}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      story: { ...prev.story!, title: e.target.value },
                    }))
                  }
                  placeholder="A more mindful cup for a brighter tomorrow."
                  className="hp-input"
                  maxLength={150}
                  disabled={disabled}
                />
              </div>

              <div className="hp-field-group">
                <label htmlFor="hp-story-emphasis" className="hp-sublabel">
                  Italic Emphasis
                </label>
                <input
                  id="hp-story-emphasis"
                  type="text"
                  value={story.emphasis}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      story: { ...prev.story!, emphasis: e.target.value },
                    }))
                  }
                  placeholder="Let taste lead."
                  className="hp-input"
                  maxLength={150}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="hp-field-group">
              <label htmlFor="hp-story-desc" className="hp-sublabel">
                Narrative Paragraph
              </label>
              <textarea
                id="hp-story-desc"
                value={story.description}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    story: { ...prev.story!, description: e.target.value },
                  }))
                }
                rows={4}
                className="hp-textarea"
                maxLength={500}
                placeholder="We believe tea is more than a beverage — it's a moment of pause..."
                disabled={disabled}
              />
            </div>

            <LinkControl
              idPrefix="story-cta"
              title="Story Button Link"
              value={story.cta}
              onChange={(next) =>
                onChange((prev) => ({
                  ...prev,
                  story: { ...prev.story!, cta: next },
                }))
              }
              disabled={disabled}
            />
          </div>
        </div>

        {/* Right Column: Imagery & Visual Caption */}
        <div className="hp-col">
          {/* Image 1: Left Landscape Panel with Overlay */}
          <div className="hp-card">
            <h4 className="hp-card-title">Image 1: Scenic Landscape Panel</h4>

            <ImageFieldWithPicker
              id="hp-story-img"
              label="Landscape Photograph (Left Panel)"
              description="Displays in the left scenic panel with dark overlay and play action button."
              imageUrl={story.image_url}
              imageAlt={story.image_alt}
              onImageUrlChange={(url) => {
                onChange((prev) => ({
                  ...prev,
                  story: { ...prev.story!, image_url: url },
                }));
                void savePlacementImage("home_story", url, story.image_alt || "Scenic Himalayan tea estate");
              }}
              onImageAltChange={(alt) => {
                onChange((prev) => ({
                  ...prev,
                  story: { ...prev.story!, image_alt: alt },
                }));
                void savePlacementImage("home_story", story.image_url, alt);
              }}
              aspectRatioHint="3:2 or 4:3 Ratio"
              recommendation="1200×800 WebP"
              disabled={disabled}
            />

            <div className="hp-field-group mt-4">
              <label htmlFor="hp-story-scenic-tag" className="hp-sublabel">
                Scenic Panel Overline / Tag
              </label>
              <input
                id="hp-story-scenic-tag"
                type="text"
                value={story.scenic_tag || ""}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    story: { ...prev.story!, scenic_tag: e.target.value },
                  }))
                }
                placeholder="MORE THAN TEA."
                className="hp-input"
                maxLength={80}
                disabled={disabled}
              />
            </div>

            <div className="hp-field-group mt-3">
              <label htmlFor="hp-story-scenic-title" className="hp-sublabel">
                Scenic Panel Headline
              </label>
              <textarea
                id="hp-story-scenic-title"
                value={story.scenic_title || ""}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    story: { ...prev.story!, scenic_title: e.target.value },
                  }))
                }
                rows={2}
                className="hp-textarea"
                maxLength={200}
                placeholder="A deeper connection to nature, people and a calmer way of living."
                disabled={disabled}
              />
            </div>

            <div className="hp-field-group mt-3">
              <label htmlFor="hp-story-scenic-cta" className="hp-sublabel">
                Scenic Watch Button Label
              </label>
              <input
                id="hp-story-scenic-cta"
                type="text"
                value={story.scenic_cta_label || ""}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    story: { ...prev.story!, scenic_cta_label: e.target.value },
                  }))
                }
                placeholder="Watch Our Story"
                className="hp-input"
                maxLength={50}
                disabled={disabled}
              />
            </div>

            <div className="hp-field-group mt-3">
              <label htmlFor="hp-story-caption" className="hp-sublabel">
                Image Inset Caption (Multi-line supported)
              </label>
              <textarea
                id="hp-story-caption"
                value={story.caption}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    story: { ...prev.story!, caption: e.target.value },
                  }))
                }
                rows={2}
                className="hp-textarea"
                maxLength={200}
                placeholder="More than tea.&#10;A moment for yourself."
                disabled={disabled}
              />
            </div>
          </div>

          {/* Image 2: Right Collage — Top Image */}
          <div className="hp-card mt-6">
            <h4 className="hp-card-title">
              <Images size={16} /> Image 2: Collage Photo — Top (Tea Plucking)
            </h4>
            <p style={{ fontSize: "12px", color: "#5f6358", lineHeight: 1.5, marginBottom: "14px" }}>
              Top photo in the right-side collage panel. Typically shows fresh plucking in the gardens.
            </p>
            <ImageFieldWithPicker
              id="hp-story-collage-top"
              label="Top Collage Photograph"
              description="Hands holding freshly plucked tea leaves. 4:3 ratio."
              imageUrl={story.collage_top_image_url || collageTopUrl}
              imageAlt={story.collage_top_image_alt || collageTopAlt}
              onImageUrlChange={(url) => {
                setCollageTopUrl(url);
                onChange((prev) => ({
                  ...prev,
                  story: { ...prev.story!, collage_top_image_url: url },
                }));
                void savePlacementImage("home_story_collage_top", url, story.collage_top_image_alt || collageTopAlt);
              }}
              onImageAltChange={(alt) => {
                setCollageTopAlt(alt);
                onChange((prev) => ({
                  ...prev,
                  story: { ...prev.story!, collage_top_image_alt: alt },
                }));
                void savePlacementImage("home_story_collage_top", story.collage_top_image_url || collageTopUrl, alt);
              }}
              aspectRatioHint="4:3 Ratio"
              recommendation="800×600 WebP"
              disabled={disabled}
            />
          </div>

          {/* Image 3: Right Collage — Bottom Image */}
          <div className="hp-card mt-6">
            <h4 className="hp-card-title">
              <Images size={16} /> Image 3: Collage Photo — Bottom (Blossom / Terroir)
            </h4>
            <p style={{ fontSize: "12px", color: "#5f6358", lineHeight: 1.5, marginBottom: "14px" }}>
              Bottom photo in the right-side collage panel. Typically shows a Camellia Sinensis blossom or garden detail.
            </p>
            <ImageFieldWithPicker
              id="hp-story-collage-bot"
              label="Bottom Collage Photograph"
              description="Camellia sinensis blossom or high-terroir detail. 4:3 ratio."
              imageUrl={story.collage_bottom_image_url || collageBotUrl}
              imageAlt={story.collage_bottom_image_alt || collageBotAlt}
              onImageUrlChange={(url) => {
                setCollageBotUrl(url);
                onChange((prev) => ({
                  ...prev,
                  story: { ...prev.story!, collage_bottom_image_url: url },
                }));
                void savePlacementImage("home_story_collage_bot", url, story.collage_bottom_image_alt || collageBotAlt);
              }}
              onImageAltChange={(alt) => {
                setCollageBotAlt(alt);
                onChange((prev) => ({
                  ...prev,
                  story: { ...prev.story!, collage_bottom_image_alt: alt },
                }));
                void savePlacementImage("home_story_collage_bot", story.collage_bottom_image_url || collageBotUrl, alt);
              }}
              aspectRatioHint="4:3 Ratio"
              recommendation="800×600 WebP"
              disabled={disabled}
            />

            <div className="hp-field-group mt-4">
              <label htmlFor="hp-story-banner-words" className="hp-sublabel">
                Terracotta Banner Words (Comma-separated)
              </label>
              <input
                id="hp-story-banner-words"
                type="text"
                value={(story.banner_words || ["PEOPLE", "PLANET", "BETTER TEA"]).join(", ")}
                onChange={(e) => {
                  const words = e.target.value
                    .split(",")
                    .map((w) => w.trim())
                    .filter(Boolean);
                  onChange((prev) => ({
                    ...prev,
                    story: { ...prev.story!, banner_words: words },
                  }));
                }}
                placeholder="PEOPLE, PLANET, BETTER TEA"
                className="hp-input"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Video / YouTuber Feature Card */}
          <div className="hp-card mt-6">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <h4 className="hp-card-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Youtube size={18} style={{ color: "#dc2626" }} /> YouTuber &amp; Video Feature
              </h4>
              {story.video_url ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      story: { ...prev.story!, video_url: "", video_title: "" },
                    }))
                  }
                  style={{
                    fontSize: "12px",
                    color: "#dc2626",
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: 0,
                  }}
                  disabled={disabled}
                >
                  <X size={13} /> Remove Video
                </button>
              ) : null}
            </div>

            <p style={{ fontSize: "12px", color: "#5f6358", lineHeight: 1.5, marginBottom: "16px" }}>
              Link a YouTube video, shorts, or video story (e.g. YouTuber documentary on{" "}
              <strong>tea rituals of North Bengal</strong>, Darjeeling harvesting, or Bengal Adda).
              Visitors can watch directly in a responsive, accessible modal from the homepage story section.
            </p>

            <div className="hp-field-group">
              <label htmlFor="hp-story-video-url" className="hp-sublabel">
                YouTube Video Link or Video URL
              </label>
              <input
                id="hp-story-video-url"
                type="url"
                value={story.video_url || ""}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    story: { ...prev.story!, video_url: e.target.value },
                  }))
                }
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                className="hp-input"
                disabled={disabled}
              />
              <span style={{ fontSize: "11px", color: "#787d72", marginTop: "4px", display: "block" }}>
                Accepts YouTube watch links, youtu.be shortlinks, shorts, embed URLs, or video IDs.
              </span>
            </div>

            <div className="hp-field-group" style={{ marginTop: "14px" }}>
              <label htmlFor="hp-story-video-title" className="hp-sublabel">
                Video Feature Headline / Label
              </label>
              <input
                id="hp-story-video-title"
                type="text"
                value={story.video_title || ""}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    story: { ...prev.story!, video_title: e.target.value },
                  }))
                }
                placeholder="Tea Rituals of North Bengal"
                className="hp-input"
                maxLength={120}
                disabled={disabled}
              />
            </div>

            {/* YouTube Detection & Interactive Preview */}
            {story.video_url ? (
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px",
                  background: "#f5f2ea",
                  borderRadius: "8px",
                  border: "1px solid #e2dcd0",
                }}
              >
                {isYouTubeUrl(story.video_url) ? (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#1d2a24",
                        marginBottom: "10px",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#166534" }}>
                        <Play size={13} fill="currentColor" />
                        YouTube Video Linked (ID: {extractYouTubeId(story.video_url)})
                      </span>
                      <a
                        href={
                          story.video_url && story.video_url.startsWith("http")
                            ? story.video_url
                            : `https://www.youtube.com/watch?v=${extractYouTubeId(story.video_url)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "#b36b3d",
                          textDecoration: "underline",
                        }}
                      >
                        Open on YouTube <ExternalLink size={11} />
                      </a>
                    </div>

                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: "16 / 9",
                        borderRadius: "6px",
                        overflow: "hidden",
                        background: "#000000",
                      }}
                    >
                      <iframe
                        src={getYouTubeEmbedUrl(story.video_url, false) || ""}
                        title={story.video_title || "Tea Rituals of North Bengal"}
                        style={{ width: "100%", height: "100%", border: 0 }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", color: "#52574b", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Film size={16} />
                    <span>Video configured: {story.video_url}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
