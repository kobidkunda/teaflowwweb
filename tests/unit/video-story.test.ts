import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  extractYouTubeId,
  getYouTubeEmbedUrl,
  getYouTubeWatchUrl,
  isYouTubeUrl,
  isValidVideoUrl,
} from "../../src/lib/videoUtils";
import { homepageSchema } from "../../src/lib/homepageSchema";
import { BentoStory } from "../../src/components/home/BentoStory";
import { SECURITY_HEADERS } from "../../src/lib/security";

describe("YouTube and Video Story Utilities", () => {
  it("extracts YouTube video IDs correctly across formats", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=0hBfp43vJ_c")).toBe(true);
    expect(isYouTubeUrl("https://youtu.be/0hBfp43vJ_c")).toBe(true);
    expect(isYouTubeUrl("https://example.com/other-video")).toBe(false);
    expect(extractYouTubeId("https://www.youtube.com/watch?v=0hBfp43vJ_c")).toBe("0hBfp43vJ_c");
    expect(extractYouTubeId("https://www.youtube.com/watch?v=0hBfp43vJ_c&t=120s")).toBe("0hBfp43vJ_c");
    expect(extractYouTubeId("https://youtu.be/0hBfp43vJ_c")).toBe("0hBfp43vJ_c");
    expect(extractYouTubeId("https://www.youtube.com/shorts/0hBfp43vJ_c")).toBe("0hBfp43vJ_c");
    expect(extractYouTubeId("https://www.youtube.com/embed/0hBfp43vJ_c")).toBe("0hBfp43vJ_c");
    expect(extractYouTubeId("0hBfp43vJ_c")).toBe("0hBfp43vJ_c");
    expect(extractYouTubeId("https://example.com/other-video")).toBeNull();
    expect(extractYouTubeId("")).toBeNull();
    expect(extractYouTubeId(null)).toBeNull();
  });

  it("generates privacy-enhanced YouTube embed URLs with autoplay controls", () => {
    const embedAutoplay = getYouTubeEmbedUrl("https://youtu.be/0hBfp43vJ_c", true);
    expect(embedAutoplay).toContain("https://www.youtube-nocookie.com/embed/0hBfp43vJ_c");
    expect(embedAutoplay).toContain("autoplay=1");
    expect(embedAutoplay).toContain("rel=0");

    const embedStandard = getYouTubeEmbedUrl("https://youtu.be/0hBfp43vJ_c", false);
    expect(embedStandard).not.toContain("autoplay=1");
    expect(embedStandard).toContain("rel=0");
  });

  it("generates canonical YouTube watch URLs", () => {
    expect(getYouTubeWatchUrl("0hBfp43vJ_c")).toBe("https://www.youtube.com/watch?v=0hBfp43vJ_c");
  });

  it("validates safe video URLs and rejects malicious scripts", () => {
    expect(isValidVideoUrl("https://www.youtube.com/watch?v=0hBfp43vJ_c")).toBe(true);
    expect(isValidVideoUrl("https://youtu.be/0hBfp43vJ_c")).toBe(true);
    expect(isValidVideoUrl("0hBfp43vJ_c")).toBe(true);
    expect(isValidVideoUrl("/uploads/tea-rituals.mp4")).toBe(true);
    expect(isValidVideoUrl("javascript:alert('xss')")).toBe(false);
    expect(isValidVideoUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isValidVideoUrl("")).toBe(false);
  });
});

describe("Homepage Schema with Video Story Feature", () => {
  const baseContent = {
    brand: "TEAFLOWW",
    tagline: "FROM BENGAL, A BETTER CUP OF CHA",
    navigation: [{ label: "Our story", href: "/blog/about-teafloww" }],
    footer_links: [{ label: "About", href: "/blog/about-teafloww" }],
    hero: {
      eyebrow: "TEA STORIES",
      title: "From the hills to the teacup.",
      emphasis: "Discover the world of tea.",
      description: "Explore the tea-growing regions of Darjeeling, Dooars and the Terai.",
      image_url: "/uploads/hero.webp",
      image_alt: "Tea garden landscape",
      primary: { label: "Explore", href: "/blog" },
      secondary: { label: "Read story", href: "/blog/about-teafloww" },
    },
    discovery: {
      eyebrow: "FIND YOUR CHA",
      title: "Tea for you",
      emphasis: "crafted well",
      description: "Understand Bengal's favourite cups",
      tiles: [],
    },
    shelf: {
      eyebrow: "SHELF",
      title: "Leaves worth lingering",
      emphasis: "over",
      cta: { label: "Journal", href: "/blog" },
      empty_title: "Validating blends",
      empty_description: "New teas coming soon",
      fallback_image_url: "",
      fallback_image_alt: "",
    },
    story: {
      eyebrow: "WHY TEAFLOWW",
      title: "Rooted in tea culture.",
      emphasis: "Guided by curiosity.",
      description:
        "Inspired by the gardens and daily tea rituals of Darjeeling, Dooars, the Terai and Bengal.",
      image_url: "/uploads/story.webp",
      image_alt: "Cup of tea in the hills",
      caption: "More than tea.\nA moment for yourself.",
      cta: { label: "Read our story", href: "/blog/about-teafloww" },
      video_url: "https://www.youtube.com/watch?v=0hBfp43vJ_c",
      video_title: "Tea Rituals of North Bengal",
    },
    disclosure: "Illustrative packaging and blends.",
    footer_text: "Teafloww — rooted in Bengal's tea culture.",
  };

  it("successfully parses homepage content with video_url and video_title", () => {
    const parsed = homepageSchema.safeParse(baseContent);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.story?.video_url).toBe("https://www.youtube.com/watch?v=0hBfp43vJ_c");
      expect(parsed.data.story?.video_title).toBe("Tea Rituals of North Bengal");
    }
  });

  it("rejects malicious script schemes in video_url", () => {
    const malicious = {
      ...baseContent,
      story: {
        ...baseContent.story,
        video_url: "javascript:alert(1)",
      },
    };
    const parsed = homepageSchema.safeParse(malicious);
    expect(parsed.success).toBe(false);
  });
});

describe("BentoStory Component Rendering", () => {
  it("renders story headline, Read our story link, and video watch action", () => {
    const html = renderToStaticMarkup(
      React.createElement(BentoStory, {
        eyebrow: "WHY TEAFLOWW",
        title: "Rooted in tea culture.",
        body: "Inspired by the gardens and daily tea rituals of Darjeeling, Dooars, the Terai and Bengal.",
        ctaLabel: "Read our story",
        ctaHref: "/blog/about-teafloww",
        videoUrl: "https://www.youtube.com/watch?v=0hBfp43vJ_c",
        videoTitle: "Tea Rituals of North Bengal",
      })
    );

    expect(html).toContain("WHY TEAFLOWW");
    expect(html).toContain("Rooted in tea culture.");
    expect(html).toContain("Read our story");
    expect(html).toContain("/blog/about-teafloww");
    expect(html).toContain("Watch: Tea Rituals of North Bengal");
    expect(html).toContain('class="tf-story-video-link"');
    expect(html).not.toContain('aria-label="Watch video:');
  });

  it("ensures Content Security Policy permits YouTube iframe embeds", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toMatch(/frame-src[^;]*https:\/\/www\.youtube\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/www\.youtube-nocookie\.com/);
    expect(csp).toMatch(/media-src[^;]*'self'/);
  });
});

