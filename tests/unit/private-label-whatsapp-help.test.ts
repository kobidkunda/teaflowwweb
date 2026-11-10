import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  formatWhatsAppDigits,
  formatWhatsAppDisplay,
  buildPrivateLabelWhatsAppMessage,
  QUICK_HELP_TOPICS,
} from "@/lib/private-label/whatsapp";
import { PrivateLabelWhatsAppHelp } from "@/components/private-label/shared/PrivateLabelWhatsAppHelp";

// Mock next/navigation usePathname
let currentMockPathname = "/private-label";
vi.mock("next/navigation", () => ({
  usePathname: () => currentMockPathname,
}));

describe("Private Label WhatsApp Help Widget & Messaging", () => {
  describe("1. Phone Number Sanitization & Formatting", () => {
    it("handles undefined, null, or empty string with default 917001304853", () => {
      expect(formatWhatsAppDigits()).toBe("917001304853");
      expect(formatWhatsAppDigits("")).toBe("917001304853");
      expect(formatWhatsAppDigits("   ")).toBe("917001304853");
    });

    it("automatically prepends India 91 prefix to 10-digit mobile numbers", () => {
      expect(formatWhatsAppDigits("7001304853")).toBe("917001304853");
      expect(formatWhatsAppDigits("9832012345")).toBe("919832012345");
    });

    it("strips spaces, dashes, parentheses and plus signs", () => {
      expect(formatWhatsAppDigits("+91 70013 04853")).toBe("917001304853");
      expect(formatWhatsAppDigits("+91-98320-12345")).toBe("919832012345");
      expect(formatWhatsAppDigits("+91 (700) 130-4853")).toBe("917001304853");
    });

    it("formats human display presentation cleanly", () => {
      expect(formatWhatsAppDisplay("+91 7001304853")).toBe("+91 70013 04853");
      expect(formatWhatsAppDisplay("7001304853")).toBe("+91 70013 04853");
      expect(formatWhatsAppDisplay("9832012345")).toBe("+91 98320 12345");
    });
  });

  describe("2. Context-Aware Assistance Messages", () => {
    it("generates bespoke message for /private-label main overview", () => {
      const msg = buildPrivateLabelWhatsAppMessage({
        pathname: "/private-label",
      });
      expect(msg).toContain("exploring your Private Label tea services");
      expect(msg).toContain("URL: https://teafloww.com/private-label");
      expect(msg).toContain("Ref Section: Private Label Tea Services");
    });

    it("generates studio-specific message for /private-label/studio", () => {
      const msg = buildPrivateLabelWhatsAppMessage({
        pathname: "/private-label/studio",
        topic: "MOQs & Volume Pricing",
      });
      expect(msg).toContain("in the Private Label Studio designing a custom blend");
      expect(msg).toContain("Topic: MOQs & Volume Pricing");
      expect(msg).toContain("Ref Section: Studio Configurator");
      expect(msg).toContain("URL: https://teafloww.com/private-label/studio");
    });

    it("generates packaging catalogue message for /private-label/packaging", () => {
      const msg = buildPrivateLabelWhatsAppMessage({
        pathname: "/private-label/packaging/pack_pouch_mbk_250g",
        customNote: "Need 250g barrier specs",
      });
      expect(msg).toContain("Packaging Catalogue");
      expect(msg).toContain("Note: Need 250g barrier specs");
      expect(msg).toContain("URL: https://teafloww.com/private-label/packaging/pack_pouch_mbk_250g");
    });

    it("generates quote message for /private-label/quotes/:id", () => {
      const msg = buildPrivateLabelWhatsAppMessage({
        pathname: "/private-label/quotes/qte_sample_123",
      });
      expect(msg).toContain("Quotation");
      expect(msg).toContain("URL: https://teafloww.com/private-label/quotes/qte_sample_123");
    });

    it("generates samples message for /private-label/samples", () => {
      const msg = buildPrivateLabelWhatsAppMessage({
        pathname: "/private-label/samples",
      });
      expect(msg).toContain("Tasting Sample Kits");
      expect(msg).toContain("URL: https://teafloww.com/private-label/samples");
    });

    it("generates orders message for /private-label/orders/:id", () => {
      const msg = buildPrivateLabelWhatsAppMessage({
        pathname: "/private-label/orders/ord_sample_456",
      });
      expect(msg).toContain("production run");
      expect(msg).toContain("URL: https://teafloww.com/private-label/orders/ord_sample_456");
    });

    it("has 5 predefined quick help topics covering private label workflows", () => {
      expect(QUICK_HELP_TOPICS.length).toBeGreaterThanOrEqual(5);
      const labels = QUICK_HELP_TOPICS.map((t) => t.label);
      expect(labels).toContain("MOQs & Volume Pricing");
      expect(labels).toContain("Packaging Specs & Dielines");
      expect(labels).toContain("Custom Blend Matching");
    });
  });

  describe("3. Component SSR Rendering & Target WhatsApp URL", () => {
    it("renders trigger button with WhatsApp icon and aria-label", () => {
      currentMockPathname = "/private-label";
      const html = renderToString(
        React.createElement(PrivateLabelWhatsAppHelp, {
          whatsappNumber: "+91 98320 12345",
          storeName: "TeaFloww",
        })
      );

      expect(html).toContain("aria-label=\"Private Label WhatsApp Help Widget\"");
      expect(html).toContain("Need Help? Chat on WhatsApp");
      expect(html).toContain("print:hidden");
    });

    it("positions widget with studio offset when on /private-label/studio", () => {
      currentMockPathname = "/private-label/studio";
      const html = renderToString(
        React.createElement(PrivateLabelWhatsAppHelp, {
          whatsappNumber: "+91 7001304853",
        })
      );

      // On studio, bottom spacing is 88px to stay clear of StudioMobileBottomBar
      expect(html).toContain("bottom:88px");
    });

    it("positions widget with standard 24px bottom offset on non-studio pages", () => {
      currentMockPathname = "/private-label/packaging";
      const html = renderToString(
        React.createElement(PrivateLabelWhatsAppHelp, {
          whatsappNumber: "+91 7001304853",
        })
      );

      expect(html).toContain("bottom:24px");
    });
  });
});
