import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { PrivateLabelHero } from "@/components/private-label/landing/PrivateLabelHero";

describe("PrivateLabelHero Landing Component", () => {
  it("renders the primary CTA linking to studio", () => {
    const html = renderToString(React.createElement(PrivateLabelHero));
    expect(html).toContain('href="/private-label/studio"');
    expect(html).toContain("Start Your Brand");
  });

  it("renders the secondary CTA linking to packaging catalogue", () => {
    const html = renderToString(React.createElement(PrivateLabelHero));
    expect(html).toContain('href="/private-label/packaging"');
    expect(html).toContain("Explore Packaging Catalogue");
  });

  it("does not render the secondary WhatsApp CTA button in the hero", () => {
    const html = renderToString(React.createElement(PrivateLabelHero));
    expect(html).not.toContain("Chat on WhatsApp");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("whatsappCta");
  });

  it("renders editorial trust indicators and illustrative preview notice", () => {
    const html = renderToString(React.createElement(PrivateLabelHero));
    expect(html).toContain("Tea &amp; packaging selection");
    expect(html).toContain("Configuration-specific minimums");
    expect(html).toContain("Proof review before production");
    expect(html).toContain("AI-generated packaging concepts — illustrative only");
  });
});
