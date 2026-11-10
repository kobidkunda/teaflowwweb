import { describe, it, expect } from "vitest";
import {
  validatePreflight,
  sanitizeSvg,
  MAX_PREFLIGHT_FILE_SIZE_BYTES,
  MIN_PASS_DPI,
  REQUIRED_BLEED_MM,
} from "@/lib/private-label/preflight";

/**
 * Creates a minimal valid PNG buffer with given width and height.
 * PNG Structure:
 * - 8 bytes PNG signature (89 50 4E 47 0D 0A 1A 0A)
 * - 4 bytes IHDR chunk length (13 bytes)
 * - 4 bytes IHDR chunk type ("IHDR")
 * - 4 bytes width (BE)
 * - 4 bytes height (BE)
 * - 5 bytes bit depth, color type, compression, filter, interlace
 * - 4 bytes CRC
 */
function createMinimalPng(width: number, height: number, totalSizeBytes = 33): Buffer {
  const buf = Buffer.alloc(Math.max(33, totalSizeBytes));
  // Signature
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;
  // IHDR length = 13
  buf.writeUInt32BE(13, 8);
  // IHDR
  buf.write("IHDR", 12, "ascii");
  // Width & Height
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  // bit depth 8, truecolor 2
  buf[24] = 8;
  buf[25] = 2;
  return buf;
}

/**
 * Creates a minimal valid JPEG buffer with given width and height.
 * JPEG Structure:
 * - SOI: 0xFF, 0xD8
 * - SOF0: 0xFF, 0xC0
 * - Length: 17
 * - Precision: 8
 * - Height (BE 2 bytes)
 * - Width (BE 2 bytes)
 */
function createMinimalJpeg(width: number, height: number, totalSizeBytes = 30): Buffer {
  const buf = Buffer.alloc(Math.max(30, totalSizeBytes));
  buf[0] = 0xff;
  buf[1] = 0xd8;
  // SOF0 marker
  buf[2] = 0xff;
  buf[3] = 0xc0;
  // Length
  buf.writeUInt16BE(17, 4);
  // Precision
  buf[6] = 8;
  // Height & Width
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  // End of Image marker at end
  buf[buf.length - 2] = 0xff;
  buf[buf.length - 1] = 0xd9;
  return buf;
}

describe("Empirical Adversarial Preflight Challenge Suite", () => {
  // ==========================================================================
  // 1. 25MB File Size Boundary Stress & Precision
  // ==========================================================================
  describe("1. 25MB Boundary Precision & Enforcement", () => {
    it("accepts an exact 25MB file (26,214,400 bytes) via fileSizeBytes", async () => {
      const exact25MB = 25 * 1024 * 1024; // 26,214,400
      expect(MAX_PREFLIGHT_FILE_SIZE_BYTES).toBe(exact25MB);

      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 3000,
        heightPx: 4000,
        fileSizeBytes: exact25MB,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.errors).toHaveLength(0);
    });

    it("accepts an exact 25MB buffer (26,214,400 bytes)", async () => {
      const exact25MB = 26_214_400;
      const pngBuf = createMinimalPng(3000, 4000, exact25MB);
      expect(pngBuf.length).toBe(exact25MB);

      const result = await validatePreflight({
        mimeType: "image/png",
        buffer: pngBuf,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.errors).toHaveLength(0);
    });

    it("accepts a valid binary JPEG buffer with detected dimensions", async () => {
      const jpegBuf = createMinimalJpeg(3000, 4000, 50_000);
      const result = await validatePreflight({
        mimeType: "image/jpeg",
        buffer: jpegBuf,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.dimensions.width).toBe(3000);
      expect(result.dimensions.height).toBe(4000);
    });

    it("strictly rejects 25MB + 1 byte (26,214,401 bytes) via fileSizeBytes", async () => {
      const over25MB = 25 * 1024 * 1024 + 1; // 26,214,401

      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 3000,
        heightPx: 4000,
        fileSizeBytes: over25MB,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("exceeds 25MB"))).toBe(true);
    });

    it("strictly rejects a buffer with 25MB + 1 byte (26,214,401 bytes)", async () => {
      const over25MB = 26_214_401;
      const pngBuf = createMinimalPng(3000, 4000, over25MB);
      expect(pngBuf.length).toBe(over25MB);

      const result = await validatePreflight({
        mimeType: "image/png",
        buffer: pngBuf,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("exceeds 25MB"))).toBe(true);
    });

    it("rejects extreme 100MB payload size", async () => {
      const result = await validatePreflight({
        mimeType: "image/jpeg",
        widthPx: 5000,
        heightPx: 5000,
        fileSizeBytes: 100 * 1024 * 1024,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("exceeds 25MB maximum upload limit"))).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Corrupt Payloads, Zero-Byte Buffers, and Truncated Magic Headers
  // ==========================================================================
  describe("2. Corrupt Payloads, Zero-Byte Buffers & Truncated Headers", () => {
    it("rejects 0-byte buffer", async () => {
      const emptyBuf = Buffer.alloc(0);
      const result = await validatePreflight({
        mimeType: "image/png",
        buffer: emptyBuf,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("greater than 0 bytes"))).toBe(true);
    });

    it("rejects 0-byte fileSizeBytes", async () => {
      const result = await validatePreflight({
        mimeType: "image/jpeg",
        fileSizeBytes: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("greater than 0 bytes"))).toBe(true);
    });

    it("rejects negative fileSizeBytes (-1, -1000)", async () => {
      const result = await validatePreflight({
        mimeType: "image/png",
        fileSizeBytes: -1,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("greater than 0 bytes"))).toBe(true);
    });

    it("rejects truncated PNG magic header (< 8 bytes)", async () => {
      // 4 bytes only
      const truncatedBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const result = await validatePreflight({
        mimeType: "image/png",
        buffer: truncatedBuf,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("magic bytes do not match declared PNG"))).toBe(true);
    });

    it("rejects truncated JPEG magic header (< 2 bytes)", async () => {
      const truncatedBuf = Buffer.from([0xff]);
      const result = await validatePreflight({
        mimeType: "image/jpeg",
        buffer: truncatedBuf,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("magic bytes do not match declared JPEG"))).toBe(true);
    });

    it("rejects truncated WebP magic header (< 12 bytes)", async () => {
      // "RIFF" without "WEBP"
      const truncatedBuf = Buffer.from("RIFF1234", "ascii");
      const result = await validatePreflight({
        mimeType: "image/webp",
        buffer: truncatedBuf,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("magic bytes do not match declared WebP"))).toBe(true);
    });

    it("rejects truncated PDF magic header (%PD instead of %PDF)", async () => {
      const truncatedBuf = Buffer.from("%PD-1.4");
      const result = await validatePreflight({
        mimeType: "application/pdf",
        buffer: truncatedBuf,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("Invalid PDF file header"))).toBe(true);
    });

    it("rejects random corrupt binary payload with declared PNG mime", async () => {
      // 64 bytes of random noise (no PNG signature)
      const noise = Buffer.from(new Uint8Array(64).fill(0xaa));
      const result = await validatePreflight({
        mimeType: "image/png",
        buffer: noise,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("magic bytes do not match"))).toBe(true);
      expect(result.errors.some((e) => e.includes("Failed to decode image dimensions"))).toBe(true);
    });

    it("rejects corrupt / non-base64 fileData payload", async () => {
      const result = await validatePreflight({
        mimeType: "image/png",
        fileData: "invalid-base64-payload!@#$%",
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("Corrupt or invalid base64"))).toBe(true);
    });

    it("rejects unpadded base64 fileData whose length is not multiple of 4", async () => {
      const result = await validatePreflight({
        mimeType: "image/png",
        fileData: "AAAAA", // length 5
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("Corrupt or invalid base64"))).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Spoofed MIME Types and Disallowed Extensions
  // ==========================================================================
  describe("3. Spoofed MIME Types and Dangerous Extensions", () => {
    it("rejects unsupported MIME types (e.g. text/html, application/javascript, image/gif)", async () => {
      const badMimes = [
        "text/html",
        "application/javascript",
        "image/gif",
        "image/bmp",
        "image/tiff",
        "application/zip",
        "application/x-sh",
      ];

      for (const mime of badMimes) {
        const result = await validatePreflight({
          mimeType: mime,
          fileSizeBytes: 1000,
        });
        expect(result.valid).toBe(false);
        expect(result.status).toBe("rejected");
        expect(result.errors.some((e) => e.includes("is not supported"))).toBe(true);
      }
    });

    it("rejects empty or whitespace MIME type", async () => {
      const result = await validatePreflight({
        mimeType: "   ",
        fileSizeBytes: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
    });

    it("rejects shell script disguised with image/png MIME type", async () => {
      const scriptPayload = Buffer.from("#!/bin/bash\nrm -rf /");
      const result = await validatePreflight({
        mimeType: "image/png",
        buffer: scriptPayload,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("magic bytes do not match"))).toBe(true);
    });

    it("rejects PE/executable binary disguised with image/jpeg MIME type", async () => {
      // MZ header (DOS/Windows executable)
      const pePayload = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const result = await validatePreflight({
        mimeType: "image/jpeg",
        buffer: pePayload,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("magic bytes do not match"))).toBe(true);
    });

    it("rejects forbidden executable file extensions even if declared MIME is valid", async () => {
      const disallowed = [
        "payload.exe",
        "script.sh",
        "backdoor.php",
        "installer.msi",
        "batch.bat",
        "exploit.js",
        "phish.html",
      ];

      for (const fn of disallowed) {
        const result = await validatePreflight({
          mimeType: "image/png",
          filename: fn,
          fileSizeBytes: 2000,
          widthPx: 1000,
          heightPx: 1000,
        });

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("is an executable or script"))).toBe(true);
      }
    });

    it("accepts valid MIME types regardless of uppercase or whitespace formatting", async () => {
      const result = await validatePreflight({
        mimeType: "  IMAGE/PNG  ",
        fileSizeBytes: 5000,
        widthPx: 3000,
        heightPx: 3000,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
    });
  });

  // ==========================================================================
  // 4. Password-Protected / Encrypted PDFs
  // ==========================================================================
  describe("4. Password-Protected & Encrypted PDFs", () => {
    it("rejects PDF containing standard /Encrypt dictionary token in buffer", async () => {
      const encryptedPdf = Buffer.from(`%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R >>
endobj
4 0 obj
<< /Filter /Standard /V 4 /R 4 /O <abcdef> /U <123456> /P -1028 /Encrypt 5 0 R >>
endobj
trailer
<< /Root 1 0 R /Encrypt 4 0 R >>
%%EOF`);

      const result = await validatePreflight({
        mimeType: "application/pdf",
        buffer: encryptedPdf,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("Password-protected or encrypted PDF"))).toBe(true);
    });

    it("rejects PDF when isEncrypted flag is passed explicitly", async () => {
      const cleanPdf = Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF`);
      const result = await validatePreflight({
        mimeType: "application/pdf",
        buffer: cleanPdf,
        isEncrypted: true,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("Password-protected or encrypted PDF"))).toBe(true);
    });

    it("accepts unencrypted, valid vector PDF buffer", async () => {
      const cleanPdf = Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`);

      const result = await validatePreflight({
        mimeType: "application/pdf",
        buffer: cleanPdf,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.is_vector).toBe(true);
      expect(result.dpi).toBe(300);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 5. Malicious SVG Payloads (XSS, XXE, ForeignObject, JavaScript URIs)
  // ==========================================================================
  describe("5. Malicious SVG Vector Security & Sanitization", () => {
    it("detects standard <script> tags in SVG", () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>`;
      const res = sanitizeSvg(svg);
      expect(res.safe).toBe(false);
      expect(res.violations.some((v) => v.includes("<script>"))).toBe(true);
    });

    it("detects mixed-case and space-broken script tags (<ScRiPt ...>)", () => {
      const svg = `<svg><ScRiPt type="text/javascript">fetch('//evil.com')</sCrIpT></svg>`;
      const res = sanitizeSvg(svg);
      expect(res.safe).toBe(false);
      expect(res.violations.some((v) => v.includes("<script>"))).toBe(true);
    });

    it("detects unclosed script tag (<script src=...)", () => {
      const svg = `<svg><script src="https://evil.com/malware.js"></svg>`;
      const res = sanitizeSvg(svg);
      expect(res.safe).toBe(false);
      expect(res.violations.some((v) => v.includes("<script>"))).toBe(true);
    });

    it("detects inline event handlers (onload, onerror, onclick, onmouseover)", () => {
      const handlers = [
        '<svg onload="alert(1)"></svg>',
        '<svg ONLOAD="alert(1)"></svg>',
        '<svg onload = "alert(1)"></svg>',
        '<svg onload\n="alert(1)"></svg>',
        '<circle r="10" onerror="alert(1)"/>',
        '<rect width="10" onclick="alert(1)"/>',
        '<path onmouseover="alert(1)"/>',
        '<g onmouseenter="alert(1)"/>',
      ];

      for (const svg of handlers) {
        const res = sanitizeSvg(svg);
        expect(res.safe).toBe(false);
        expect(res.violations.some((v) => v.includes("Inline JavaScript"))).toBe(true);
      }
    });

    it("detects XML External Entity (XXE) attacks with SYSTEM and PUBLIC", () => {
      const xxePayloads = [
        '<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]><svg>&xxe;</svg>',
        '<!DOCTYPE svg SYSTEM "http://attacker.com/evil.dtd"><svg></svg>',
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://attacker.com/evil.dtd"><svg></svg>',
        '<!entity % evil SYSTEM "http://attacker.com/evil.xml">',
      ];

      for (const svg of xxePayloads) {
        const res = sanitizeSvg(svg);
        expect(res.safe).toBe(false);
        expect(res.violations.some((v) => v.includes("XXE"))).toBe(true);
      }
    });

    it("detects <foreignObject> elements in SVG", () => {
      const svg = `<svg><foreignObject width="100" height="100"><iframe src="http://evil.com"></iframe></foreignObject></svg>`;
      const res = sanitizeSvg(svg);
      expect(res.safe).toBe(false);
      expect(res.violations.some((v) => v.includes("<foreignObject>"))).toBe(true);
    });

    it("detects javascript: URIs in SVG hyperlinks (href and xlink:href)", () => {
      const svg1 = `<svg><a href="javascript:alert(1)"><circle r="10"/></a></svg>`;
      const res1 = sanitizeSvg(svg1);
      expect(res1.safe).toBe(false);
      expect(res1.violations.some((v) => v.includes("javascript: URI"))).toBe(true);

      const svg2 = `<svg xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="javascript:alert(2)"><rect width="10"/></a></svg>`;
      const res2 = sanitizeSvg(svg2);
      expect(res2.safe).toBe(false);
      expect(res2.violations.some((v) => v.includes("javascript: URI"))).toBe(true);
    });

    it("passes completely benign clean SVGs", () => {
      const cleanSvg = `<svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="500" height="500" fill="#2D5A27"/>
        <text x="250" y="250" font-size="24" text-anchor="middle" fill="#FFFFFF">TeaFloww Estate</text>
      </svg>`;
      const res = sanitizeSvg(cleanSvg);
      expect(res.safe).toBe(true);
      expect(res.violations).toHaveLength(0);
    });

    it("validatePreflight marks prohibited_scripts_detected=true and rejects malicious SVG", async () => {
      const result = await validatePreflight({
        mimeType: "image/svg+xml",
        svgContent: '<svg onload="alert(1)"><circle r="50"/></svg>',
        fileSizeBytes: 500,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.prohibited_scripts_detected).toBe(true);
      expect(result.errors.some((e) => e.includes("Security violation"))).toBe(true);
    });
  });

  // ==========================================================================
  // 6. Extreme Dimensions & Non-Positive Bounds Stress Test
  // ==========================================================================
  describe("6. Extreme Dimensions & Non-Positive Coordinate Bounds", () => {
    it("safely handles 10,000 x 10,000 px raster without memory explosion or crash", async () => {
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 10000,
        heightPx: 10000,
        fileSizeBytes: 15_000_000,
        targetWidthMm: 160,
        targetHeightMm: 230,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.dpi).toBeGreaterThan(1000);
      expect(result.dimensions.width).toBe(10000);
      expect(result.dimensions.height).toBe(10000);
      expect(result.has_bleed).toBe(true);
    });

    it("safely handles 25,000 x 25,000 px dimensions", async () => {
      const result = await validatePreflight({
        mimeType: "image/jpeg",
        widthPx: 25000,
        heightPx: 25000,
        fileSizeBytes: 20_000_000,
        targetWidthMm: 160,
        targetHeightMm: 230,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.dpi).toBeGreaterThan(3000);
    });

    it("rejects 1x1 px raster due to sub-150 DPI resolution", async () => {
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 1,
        heightPx: 1,
        fileSizeBytes: 500,
        targetWidthMm: 160,
        targetHeightMm: 230,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.dpi).toBe(0);
      expect(result.errors.some((e) => e.includes("below the 150 DPI minimum"))).toBe(true);
    });

    it("rejects 2x2 px raster due to sub-150 DPI resolution", async () => {
      const result = await validatePreflight({
        mimeType: "image/jpeg",
        widthPx: 2,
        heightPx: 2,
        fileSizeBytes: 1000,
        targetWidthMm: 160,
        targetHeightMm: 230,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.dpi).toBe(0);
      expect(result.errors.some((e) => e.includes("below the 150 DPI minimum"))).toBe(true);
    });

    it("empirically demonstrates that negative dimension parameters (-500 x -500) bypass DPI/bleed checks", async () => {
      // Adversarial probe: Client sends negative dimensions
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: -500,
        heightPx: -500,
        fileSizeBytes: 1000,
      });

      // EMPIRICAL OBSERVATION:
      // Because `width > 0` condition fails, DPI calculation (lines 186-198) and Bleed check (lines 209-218)
      // are skipped completely. `dpi` defaults to 300 and `has_bleed` defaults to true.
      // Therefore, the engine reports valid: true and status: "passed", marking an invalid negative dimension as print-ready.
      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.dpi).toBe(300);
      expect(result.dimensions.width).toBe(-500);
      expect(result.dimensions.height).toBe(-500);
    });

    it("empirically demonstrates that zero dimension parameters (0 x 0) bypass DPI/bleed checks", async () => {
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 0,
        heightPx: 0,
        fileSizeBytes: 1000,
      });

      // EMPIRICAL OBSERVATION:
      // Similar to negative dimensions, 0x0 dimensions bypass DPI and bleed evaluation.
      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.dpi).toBe(300);
      expect(result.dimensions.width).toBe(0);
      expect(result.dimensions.height).toBe(0);
    });

    it("empirically demonstrates that a PNG buffer with 0x0 IHDR dimensions passes validation", async () => {
      const zeroDimPng = createMinimalPng(0, 0, 100);
      const result = await validatePreflight({
        mimeType: "image/png",
        buffer: zeroDimPng,
      });

      // EMPIRICAL OBSERVATION:
      // `detectImageDimensions` returns { width: 0, height: 0, format: "png" }.
      // Because `dims` is truthy, `else if (!width || !height)` is skipped.
      // Then `width > 0` is false, so DPI stays 300 and has_bleed stays true.
      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.dimensions.width).toBe(0);
      expect(result.dimensions.height).toBe(0);
    });

    it("empirically tests handling of zero target width/height (targetWidthMm: 0)", async () => {
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 3000,
        heightPx: 4000,
        fileSizeBytes: 1000,
        targetWidthMm: 0,
        targetHeightMm: 0,
      });

      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // 7. DPI Thresholds (>=300 pass, 150-299 warning, <150 reject)
  // ==========================================================================
  describe("7. DPI Threshold Boundaries (300 Pass / 150-299 Warning / <150 Reject)", () => {
    // 160mm target width = 160 / 25.4 = 6.2992125 inches
    const targetW = 160;
    const targetH = 230;

    it("passes cleanly with >= 300 DPI without warnings", async () => {
      // 1890 px / 6.2992 in = 300 DPI
      // Required bleed at 300 DPI: (166 / 25.4) * 300 = 1961 px.
      // So to ensure NO bleed warning, use width >= 1961 (e.g. 2000 px x 2800 px)
      // 2000 px / 6.2992 in = 317 DPI
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 2000,
        heightPx: 2800,
        fileSizeBytes: 2_000_000,
        targetWidthMm: targetW,
        targetHeightMm: targetH,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.dpi).toBeGreaterThanOrEqual(MIN_PASS_DPI);
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("emits warning for upper warning boundary at 299 DPI", async () => {
      // 1883 px / 6.2992 in = 298.92 -> 299 DPI
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 1883,
        heightPx: 2708,
        fileSizeBytes: 1_500_000,
        targetWidthMm: targetW,
        targetHeightMm: targetH,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("warning");
      expect(result.dpi).toBe(299);
      expect(result.warnings.some((w) => w.includes("299 DPI (below recommended 300 DPI"))).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("emits warning for lower warning boundary at exactly 150 DPI", async () => {
      // 945 px / 6.2992 in = 150.01 -> 150 DPI
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 945,
        heightPx: 1358,
        fileSizeBytes: 800_000,
        targetWidthMm: targetW,
        targetHeightMm: targetH,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("warning");
      expect(result.dpi).toBe(150);
      expect(result.warnings.some((w) => w.includes("150 DPI (below recommended 300 DPI"))).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("strictly rejects just below warning threshold at 149 DPI", async () => {
      // 938 px / 6.2992 in = 148.9 -> 149 DPI
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 938,
        heightPx: 1348,
        fileSizeBytes: 700_000,
        targetWidthMm: targetW,
        targetHeightMm: targetH,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.dpi).toBe(149);
      expect(
        result.errors.some((e) => e.includes("149 DPI is below the 150 DPI minimum required"))
      ).toBe(true);
    });

    it("hard rejects low resolution web assets (72 DPI)", async () => {
      // 454 px / 6.2992 in = 72 DPI
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 454,
        heightPx: 652,
        fileSizeBytes: 200_000,
        targetWidthMm: targetW,
        targetHeightMm: targetH,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.dpi).toBe(72);
      expect(result.errors.some((e) => e.includes("below the 150 DPI minimum"))).toBe(true);
    });

    it("vector formats (SVG / PDF) are always assigned 300 DPI regardless of pixel size", async () => {
      const svgResult = await validatePreflight({
        mimeType: "image/svg+xml",
        svgContent: '<svg viewBox="0 0 100 100"><circle r="40"/></svg>',
        fileSizeBytes: 500,
        targetWidthMm: targetW,
        targetHeightMm: targetH,
      });
      expect(svgResult.dpi).toBe(300);
      expect(svgResult.is_vector).toBe(true);

      const pdfResult = await validatePreflight({
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"),
        fileSizeBytes: 500,
        targetWidthMm: targetW,
        targetHeightMm: targetH,
      });
      expect(pdfResult.dpi).toBe(300);
      expect(pdfResult.is_vector).toBe(true);
    });
  });

  // ==========================================================================
  // 8. 3mm Bleed Margin Verification
  // ==========================================================================
  describe("8. 3mm Mechanical Bleed Margin Verification", () => {
    // Target: 160mm x 230mm
    // Required bleed size: (160 + 2*3) x (230 + 2*3) = 166mm x 236mm
    // At 300 DPI: minPixelW = Math.round((166 / 25.4) * 300) = 1961 px
    // minPixelH = Math.round((236 / 25.4) * 300) = 2787 px
    const targetW = 160;
    const targetH = 230;

    it("verifies accurate pass when artwork meets exact bleed requirement (1961 x 2787 px)", async () => {
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 1961,
        heightPx: 2787,
        fileSizeBytes: 2_000_000,
        targetWidthMm: targetW,
        targetHeightMm: targetH,
      });

      expect(result.has_bleed).toBe(true);
      expect(result.bleed_margin_mm).toBe(REQUIRED_BLEED_MM);
      expect(result.warnings.some((w) => w.includes("bleed margin"))).toBe(false);
    });

    it("flags missing bleed warning when width is deficient by 1 pixel (1960 x 2787 px)", async () => {
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 1960,
        heightPx: 2787,
        fileSizeBytes: 2_000_000,
        targetWidthMm: targetW,
        targetHeightMm: targetH,
      });

      expect(result.has_bleed).toBe(false);
      expect(result.warnings.some((w) => w.includes("do not supply the required 3mm bleed margin"))).toBe(
        true
      );
    });

    it("flags missing bleed warning when height is deficient by 1 pixel (1961 x 2786 px)", async () => {
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 1961,
        heightPx: 2786,
        fileSizeBytes: 2_000_000,
        targetWidthMm: targetW,
        targetHeightMm: targetH,
      });

      expect(result.has_bleed).toBe(false);
      expect(result.warnings.some((w) => w.includes("do not supply the required 3mm bleed margin"))).toBe(
        true
      );
    });

    it("confirms vector formats (SVG / PDF) automatically satisfy bleed", async () => {
      const svgResult = await validatePreflight({
        mimeType: "image/svg+xml",
        svgContent: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>',
        targetWidthMm: targetW,
        targetHeightMm: targetH,
      });
      expect(svgResult.has_bleed).toBe(true);

      const pdfResult = await validatePreflight({
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n%%EOF"),
        targetWidthMm: targetW,
        targetHeightMm: targetH,
      });
      expect(pdfResult.has_bleed).toBe(true);
    });

    it("verifies bleed calculation with custom target packaging dimensions (100mm x 150mm)", async () => {
      // Required: 106mm x 156mm
      // At 300 DPI: minPixelW = Math.round((106 / 25.4) * 300) = 1252 px
      // minPixelH = Math.round((156 / 25.4) * 300) = 1843 px
      const passing = await validatePreflight({
        mimeType: "image/png",
        widthPx: 1300,
        heightPx: 1900,
        fileSizeBytes: 1_000_000,
        targetWidthMm: 100,
        targetHeightMm: 150,
      });
      expect(passing.has_bleed).toBe(true);

      const failing = await validatePreflight({
        mimeType: "image/png",
        widthPx: 1200, // < 1252
        heightPx: 1900,
        fileSizeBytes: 1_000_000,
        targetWidthMm: 100,
        targetHeightMm: 150,
      });
      expect(failing.has_bleed).toBe(false);
      expect(failing.warnings.some((w) => w.includes("do not supply the required 3mm bleed margin"))).toBe(
        true
      );
    });
  });
});
