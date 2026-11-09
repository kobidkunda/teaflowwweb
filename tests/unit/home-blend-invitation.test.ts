import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BlendLabDiscoverySection } from "@/components/home/BlendLabDiscoverySection";

const state = vi.hoisted(() => ({ copy: {} as Record<string, string>, placement: null as null | { image_url: string; alt_text: string; cta_label: string } }));
vi.mock("@/lib/contentBlocks", () => ({ getContentBlock: (key: string, fallback: string) => state.copy[key] ?? fallback }));
vi.mock("@/lib/media", () => ({ getSitePlacement: () => state.placement }));

const render = () => renderToStaticMarkup(React.createElement(BlendLabDiscoverySection));

describe("Homepage Blend Lab invitation", () => {
  it("links to the real service and methodology without inventing scores or promises", () => {
    const html = render();
    expect(html).toContain('href="/blend-lab"');
    expect(html).toContain('href="/blend-lab#method"');
    expect(html).toContain("AI-generated illustrative imagery");
    expect(html).toContain("Your Blend Lab journey");
    for (const retired of ["Verified Sensory", "9.1 / 10", "14% lower cost", "nationwide", "₹299", "certified sensory"]) expect(html).not.toContain(retired);
  });

  it("preserves custom operator copy, artwork, alt text and CTA label", () => {
    state.copy = { "blend_lab.home_title": "Your operator headline", "blend_lab.home_description": "Your operator description" };
    state.placement = { image_url: "/uploads/operator.webp", alt_text: "Operator tasting room", cta_label: "Discover our service" };
    const html = render();
    expect(html).toContain("Your operator headline");
    expect(html).toContain("Your operator description");
    expect(html).toContain("Operator tasting room");
    expect(html).toContain("Discover our service");
    expect(html).not.toContain("AI-generated illustrative imagery");
    state.copy = {};
    state.placement = null;
  });
});
