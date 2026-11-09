/**
 * src/lib/fingerprint.ts
 *
 * Non-invasive, privacy-conscious client-side device fingerprinter and
 * persistent session manager for Himalayan Tea House.
 *
 * Collects non-invasive hardware/graphics signals:
 * - Canvas 2D render hash
 * - WebGL unmasked renderer string
 * - OfflineAudioContext DSP signature
 * - Screen dimensions & pixel density
 * - Timezone name
 * - Approximate device memory & hardware concurrency
 *
 * Fully SSR-safe (checks typeof window !== "undefined").
 */

export interface ClientFingerprint {
  fingerprintHash: string;
  canvasHash?: string;
  webglRenderer?: string;
  audioSignature?: string;
  screenResolution?: string;
  timezone?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

const SESSION_STORAGE_KEY = "tea-house-session-id";

/**
 * Fast, lightweight 32-bit FNV-1a hash algorithm.
 */
export function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Retrieves the persistent session UUID from localStorage or creates a new one.
 * SSR-safe: returns empty string if window is undefined.
 */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";

  try {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && /^[0-9a-fA-F-]{16,64}$/.test(existing)) {
      return existing;
    }

    const newId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    try {
      localStorage.setItem(SESSION_STORAGE_KEY, newId);
    } catch {
      // Storage quota or privacy restriction
    }
    return newId;
  } catch {
    // Storage access blocked in private browsing
    return `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Extracts a 2D canvas render hash without appending to the DOM.
 */
export function getCanvasHash(): string | undefined {
  if (typeof window === "undefined" || !window.document) return undefined;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    // Draw multi-color background geometry
    ctx.textBaseline = "top";
    ctx.fillStyle = "#f60";
    ctx.fillRect(100, 5, 80, 40);

    // Render complex text and emoji for font-rasterization differentiation
    ctx.fillStyle = "#069";
    ctx.font = "14px 'Arial', 'Times New Roman', sans-serif";
    ctx.fillText("Himalayan Tea 🍃 100°C", 10, 15);

    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.font = "16px 'Helvetica', 'Times', serif";
    ctx.fillText("Darjeeling Risheehat & Sikkim Oolong", 15, 35);

    // Add arc and geometric curves
    ctx.beginPath();
    ctx.arc(50, 30, 20, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.stroke();

    const dataUrl = canvas.toDataURL();
    return fnv1a(dataUrl);
  } catch {
    return undefined;
  }
}

/**
 * Extracts the WebGL unmasked renderer string and safely releases the context.
 */
export function getWebGLRenderer(): string | undefined {
  if (typeof window === "undefined" || !window.document) return undefined;

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return undefined;

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    let vendor = "";
    let renderer = "";

    if (debugInfo) {
      vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "";
      renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
    } else {
      vendor = gl.getParameter(gl.VENDOR) || "";
      renderer = gl.getParameter(gl.RENDERER) || "";
    }

    // Critical: release WebGL context immediately to avoid exhausting browser GPU contexts
    const loseContext = gl.getExtension("WEBGL_lose_context");
    if (loseContext) {
      loseContext.loseContext();
    }

    const result = `${vendor} ~ ${renderer}`.trim();
    return result || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extracts a non-invasive AudioContext signature using OfflineAudioContext.
 * Audio is rendered entirely in memory with no sound played through speakers.
 */
export async function getAudioSignature(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;

  try {
    const AudioCtx =
      window.OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;
    if (!AudioCtx) return undefined;

    // 1 channel, 44100 frames, 44100 Hz
    const context = new AudioCtx(1, 44100, 44100);
    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = 10000;

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    oscillator.connect(compressor);
    compressor.connect(context.destination);
    oscillator.start(0);

    // Race rendering with a 250ms timeout to avoid hanging if blocked
    const renderPromise = context.startRendering();
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 250)
    );

    const buffer = await Promise.race([renderPromise, timeoutPromise]);
    if (!buffer) return undefined;

    const channelData = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 4500; i < 5000; i++) {
      sum += Math.abs(channelData[i] || 0);
    }
    return sum.toFixed(6);
  } catch {
    return undefined;
  }
}

export function getScreenResolution(): string | undefined {
  if (typeof window === "undefined" || !window.screen) return undefined;
  try {
    const { width, height, colorDepth } = window.screen;
    const dpr = window.devicePixelRatio || 1;
    return `${width}x${height}x${colorDepth}@${dpr}`;
  } catch {
    return undefined;
  }
}

export function getTimezone(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    try {
      return `UTC${new Date().getTimezoneOffset()}`;
    } catch {
      return undefined;
    }
  }
}

export function getDeviceMemory(): number | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    return typeof mem === "number" ? mem : undefined;
  } catch {
    return undefined;
  }
}

export function getHardwareConcurrency(): number | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const cores = navigator.hardwareConcurrency;
    return typeof cores === "number" ? cores : undefined;
  } catch {
    return undefined;
  }
}

// In-memory cache to ensure signals are calculated at most once per session
let cachedFingerprint: ClientFingerprint | null = null;
let fingerprintPromise: Promise<ClientFingerprint> | null = null;

/**
 * Returns the cached or computed client device fingerprint.
 */
export async function getClientFingerprint(): Promise<ClientFingerprint> {
  if (cachedFingerprint) return cachedFingerprint;
  if (fingerprintPromise) return fingerprintPromise;

  fingerprintPromise = (async () => {
    if (typeof window === "undefined") {
      return { fingerprintHash: "ssr" };
    }

    const canvasHash = getCanvasHash();
    const webglRenderer = getWebGLRenderer();
    const audioSignature = await getAudioSignature();
    const screenResolution = getScreenResolution();
    const timezone = getTimezone();
    const deviceMemory = getDeviceMemory();
    const hardwareConcurrency = getHardwareConcurrency();

    const compositeRaw = [
      canvasHash || "no-canvas",
      webglRenderer || "no-webgl",
      audioSignature || "no-audio",
      screenResolution || "no-screen",
      timezone || "no-tz",
      deviceMemory !== undefined ? String(deviceMemory) : "no-mem",
      hardwareConcurrency !== undefined ? String(hardwareConcurrency) : "no-cores",
    ].join("|||");

    const fingerprintHash = fnv1a(compositeRaw);

    const result: ClientFingerprint = {
      fingerprintHash,
      canvasHash,
      webglRenderer,
      audioSignature,
      screenResolution,
      timezone,
      deviceMemory,
      hardwareConcurrency,
    };

    cachedFingerprint = result;
    return result;
  })();

  return fingerprintPromise;
}
