import { detectImageDimensions } from "@/lib/uploads";

export const MAX_PREFLIGHT_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 26,214,400 bytes (25 MB)
export const MIN_PASS_DPI = 300;
export const MIN_WARNING_DPI = 150;
export const REQUIRED_BLEED_MM = 3.0;

export const PERMITTED_PREFLIGHT_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
] as const;

export type PermittedPreflightMime = (typeof PERMITTED_PREFLIGHT_MIMES)[number];

export interface PreflightInputOptions {
  buffer?: Buffer;
  fileData?: string; // base64 payload
  mimeType: string;
  originalFilename?: string;
  filename?: string;
  fileSizeBytes?: number;
  widthPx?: number;
  heightPx?: number;
  targetWidthMm?: number;
  targetHeightMm?: number;
  isEncrypted?: boolean;
  svgContent?: string;
}

export interface PreflightValidationResult {
  valid: boolean;
  status: "passed" | "warning" | "rejected";
  dpi: number;
  dimensions: { width: number; height: number };
  dimensions_mm: { width: number; height: number };
  width_mm: number;
  height_mm: number;
  color_space: "RGB" | "CMYK" | "GRAYSCALE";
  is_vector: boolean;
  has_bleed: boolean;
  bleed_margin_mm: number;
  prohibited_scripts_detected: boolean;
  warnings: string[];
  errors: string[];
  report_summary: string;
}

/**
 * Validates uploaded artwork asset against print standards, security rules, and size limits.
 */
export async function validatePreflight(
  options: PreflightInputOptions
): Promise<PreflightValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let isVector = false;
  let prohibitedScripts = false;
  const colorSpace: "RGB" | "CMYK" | "GRAYSCALE" = "RGB";

  const declaredMime = (options.mimeType || "").trim().toLowerCase();
  const filename = options.originalFilename || options.filename || "";

  // 1. File size checks (0 < size <= 25MB)
  let buffer: Buffer | null = options.buffer || null;

  if (!buffer && options.fileData) {
    // Attempt decoding base64 payload
    try {
      const cleanBase64 = options.fileData.replace(/^data:[^;]+;base64,/, "");
      // Validate valid base64 pattern
      if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64) || cleanBase64.length % 4 !== 0) {
        errors.push("Corrupt or invalid base64 image file payload.");
      } else {
        buffer = Buffer.from(cleanBase64, "base64");
      }
    } catch {
      errors.push("Failed to decode base64 file payload.");
    }
  }

  const size = buffer?.length ?? options.fileSizeBytes ?? 0;
  if (size <= 0) {
    errors.push("File size must be greater than 0 bytes.");
  } else if (size > MAX_PREFLIGHT_FILE_SIZE_BYTES) {
    errors.push(`File size (${(size / 1024 / 1024).toFixed(2)} MB) exceeds 25MB maximum upload limit.`);
  }

  // 2. MIME type check
  if (!PERMITTED_PREFLIGHT_MIMES.includes(declaredMime as PermittedPreflightMime)) {
    errors.push(
      `MIME type '${declaredMime || "unknown"}' is not supported. Permitted formats: PNG, JPEG, WebP, SVG, PDF.`
    );
  }

  // Check file extension mismatch if filename provided
  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    const disallowedExts = ["exe", "bin", "sh", "bat", "msi", "cmd", "js", "html", "php"];
    if (ext && disallowedExts.includes(ext)) {
      errors.push(`File extension '.${ext}' is an executable or script and cannot be accepted.`);
    }
  }

  let width = options.widthPx ?? 0;
  let height = options.heightPx ?? 0;

  // 3. Buffer inspection & magic bytes validation
  if (buffer && buffer.length > 0) {
    if (declaredMime === "image/svg+xml" || filename.endsWith(".svg") || options.svgContent) {
      isVector = true;
      const svgText = options.svgContent || buffer.toString("utf-8");
      const secCheck = sanitizeSvg(svgText);
      if (!secCheck.safe) {
        prohibitedScripts = true;
        errors.push(...secCheck.violations);
      }
      const svgDims = parseSvgDimensions(svgText);
      if (svgDims) {
        width = width || svgDims.width;
        height = height || svgDims.height;
      }
    } else if (declaredMime === "application/pdf" || filename.endsWith(".pdf")) {
      isVector = true;
      const pdfHeader = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("latin1");
      if (!pdfHeader.startsWith("%PDF")) {
        errors.push("Invalid PDF file header. File does not start with '%PDF-'.");
      }
      if (options.isEncrypted || buffer.includes(Buffer.from("/Encrypt"))) {
        errors.push("Password-protected or encrypted PDF files are not supported for prepress proofs.");
      }
    } else {
      // Raster image: PNG / JPEG / WebP
      // Verify magic bytes
      const isPngMagic =
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;
      const isJpegMagic = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
      const isWebpMagic =
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP";

      if (declaredMime === "image/png" && !isPngMagic) {
        errors.push("Payload magic bytes do not match declared PNG image format.");
      } else if (declaredMime === "image/jpeg" && !isJpegMagic) {
        errors.push("Payload magic bytes do not match declared JPEG image format.");
      } else if (declaredMime === "image/webp" && !isWebpMagic) {
        errors.push("Payload magic bytes do not match declared WebP image format.");
      }

      const dims = detectImageDimensions(buffer);
      if (dims) {
        width = dims.width;
        height = dims.height;
      } else if (!width || !height) {
        errors.push("Failed to decode image dimensions or file payload is corrupt.");
      }
    }
  } else if (options.svgContent) {
    isVector = true;
    const secCheck = sanitizeSvg(options.svgContent);
    if (!secCheck.safe) {
      prohibitedScripts = true;
      errors.push(...secCheck.violations);
    }
  }

  // Check encrypted PDF flag if no buffer provided
  if (options.isEncrypted) {
    errors.push("Password-protected or encrypted PDF files are not supported for prepress proofs.");
  }

  // 4. DPI Resolution Engine
  let dpi = 300;
  const targetW = options.targetWidthMm || 160;
  const targetH = options.targetHeightMm || 230;

  if (isVector) {
    dpi = 300;
  } else if (width > 0 && targetW > 0) {
    const widthInches = targetW / 25.4;
    dpi = Math.round(width / widthInches);
    if (dpi < MIN_WARNING_DPI) {
      errors.push(
        `Artwork resolution of ${dpi} DPI is below the 150 DPI minimum required for prepress plate engraving.`
      );
    } else if (dpi < MIN_PASS_DPI) {
      warnings.push(
        `Artwork resolution is ${dpi} DPI (below recommended 300 DPI print standard). Pixelation may occur.`
      );
    }
  }

  // 5. Dimensions calculation in mm at 300 DPI
  const widthMm = width > 0 ? Math.round((width / 300) * 25.4 * 10) / 10 : targetW;
  const heightMm = height > 0 ? Math.round((height / 300) * 25.4 * 10) / 10 : targetH;

  // 6. Bleed Margin Check
  const requiredWmm = targetW + REQUIRED_BLEED_MM * 2;
  const requiredHmm = targetH + REQUIRED_BLEED_MM * 2;
  let hasBleed = true;

  if (!isVector && width > 0 && targetW > 0) {
    const minPixelW = Math.round((requiredWmm / 25.4) * Math.min(dpi, 300));
    const minPixelH = Math.round((requiredHmm / 25.4) * Math.min(dpi, 300));
    if (width < minPixelW || height < minPixelH) {
      hasBleed = false;
      warnings.push(
        `Artwork dimensions (${width}x${height}px) do not supply the required 3mm bleed margin (${requiredWmm}x${requiredHmm}mm).`
      );
    }
  }

  const valid = errors.length === 0;
  let status: "passed" | "warning" | "rejected" = "passed";
  if (errors.length > 0) {
    status = "rejected";
  } else if (warnings.length > 0) {
    status = "warning";
  }

  let report_summary = `Preflight ${status.toUpperCase()}.`;
  if (errors.length > 0) {
    report_summary = `Preflight failed: ${errors[0]}`;
  } else if (warnings.length > 0) {
    report_summary = `Preflight passed with warnings: ${warnings[0]}`;
  } else {
    report_summary = `Artwork verified print-ready: ${dpi} DPI with valid ${REQUIRED_BLEED_MM}mm bleed.`;
  }

  return {
    valid,
    status,
    dpi,
    dimensions: { width, height },
    dimensions_mm: { width: widthMm, height: heightMm },
    width_mm: widthMm,
    height_mm: heightMm,
    color_space: colorSpace,
    is_vector: isVector,
    has_bleed: hasBleed,
    bleed_margin_mm: REQUIRED_BLEED_MM,
    prohibited_scripts_detected: prohibitedScripts,
    warnings,
    errors,
    report_summary,
  };
}

/**
 * Sanitizes and validates SVG content against XSS, XXE, and foreign objects.
 */
export function sanitizeSvg(svgContent: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const lower = svgContent.toLowerCase();

  if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(svgContent) || lower.includes("<script")) {
    violations.push("Security violation: Embedded <script> tag detected in SVG.");
  }

  if (/\bon[a-z]+\s*=/i.test(svgContent)) {
    violations.push("Security violation: Inline JavaScript event handler detected in SVG.");
  }

  if (
    lower.includes("<!entity") ||
    (lower.includes("<!doctype") && (lower.includes("system") || lower.includes("public")))
  ) {
    violations.push("Security violation: XML External Entity (XXE) declaration detected in SVG.");
  }

  if (lower.includes("<foreignobject")) {
    violations.push("Security violation: <foreignObject> element detected in SVG.");
  }

  if (
    /href\s*=\s*['"]\s*javascript:/i.test(svgContent) ||
    /xlink:href\s*=\s*['"]\s*javascript:/i.test(svgContent)
  ) {
    violations.push("Security violation: javascript: URI detected in SVG hyperlink.");
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}

function parseSvgDimensions(svgText: string): { width: number; height: number } | null {
  const vbMatch = svgText.match(
    /viewBox\s*=\s*["']\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*["']/i
  );
  if (vbMatch) {
    const w = parseFloat(vbMatch[3]);
    const h = parseFloat(vbMatch[4]);
    if (w > 0 && h > 0) return { width: Math.round(w), height: Math.round(h) };
  }
  const wMatch = svgText.match(/width\s*=\s*["']\s*([0-9.]+)(?:px)?\s*["']/i);
  const hMatch = svgText.match(/height\s*=\s*["']\s*([0-9.]+)(?:px)?\s*["']/i);
  if (wMatch && hMatch) {
    const w = parseFloat(wMatch[1]);
    const h = parseFloat(hMatch[1]);
    if (w > 0 && h > 0) return { width: Math.round(w), height: Math.round(h) };
  }
  return null;
}
