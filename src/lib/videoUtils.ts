/**
 * Utility functions for parsing, validating, and embedding video URLs
 * (YouTube videos, shorts, embeds, and local/HTML5 videos).
 */

export function extractYouTubeId(urlOrId: string | null | undefined): string | null {
  if (!urlOrId || typeof urlOrId !== "string") return null;
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;

  // 1. Direct 11-character YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Standard watch URL, shorts, embed, or youtu.be shortlinks
  const match = trimmed.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

export function getYouTubeEmbedUrl(urlOrId: string | null | undefined, autoPlay = false): string | null {
  const id = extractYouTubeId(urlOrId);
  if (!id) return null;
  const params = new URLSearchParams();
  if (autoPlay) params.set("autoplay", "1");
  params.set("rel", "0");
  params.set("modestbranding", "1");
  params.set("playsinline", "1");
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function getYouTubeWatchUrl(urlOrId: string | null | undefined): string | null {
  const id = extractYouTubeId(urlOrId);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

export function isYouTubeUrl(urlOrId: string | null | undefined): boolean {
  return extractYouTubeId(urlOrId) !== null;
}

export function isDirectVideoUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const clean = url.trim().toLowerCase();
  return clean.endsWith(".mp4") || clean.endsWith(".webm") || clean.endsWith(".ogg") || clean.endsWith(".mov");
}

export function isValidVideoUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;
  if (isYouTubeUrl(trimmed)) return true;
  if (/^\/(?!\/)/.test(trimmed) && !/[\\\s\u0000-\u001f]/.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
