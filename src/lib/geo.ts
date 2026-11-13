/**
 * src/lib/geo.ts
 *
 * Server-side IP extraction and geolocation enrichment helper
 * for Himalayan Tea House.
 *
 * Lightweight, zero-dependency geolocation parsing:
 * - Extracts client IP safely from reverse-proxy and CDN headers
 * - Detects RFC 1918 private / loopback IP addresses
 * - Falls back to Siliguri, West Bengal, India for local development
 * - Decodes edge headers (Cloudflare, Vercel, reverse proxies) when deployed
 */

export interface GeoLocation {
  ip: string;
  city: string;
  region: string;
  country: string;
  isLocal: boolean;
}

const DEFAULT_GEO = {
  city: "Siliguri",
  region: "West Bengal",
  country: "India",
} as const;

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstHop = forwarded.split(",")[0]?.trim();
    if (firstHop) return firstHop;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  return "127.0.0.1";
}

export function isPrivateIp(ip: string): boolean {
  if (!ip || ip === "unknown" || ip === "localhost" || ip === "0.0.0.0") return true;
  if (ip === "127.0.0.1" || ip === "::1") return true;

  // RFC 1918 Private IPv4
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  // Link-local
  if (/^169\.254\./.test(ip)) return true;

  // IPv6 ULA & Link-local
  if (/^fe80:/i.test(ip)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true;

  return false;
}

function safeDecode(headerValue: string | null | undefined): string {
  if (!headerValue) return "";
  try {
    return decodeURIComponent(headerValue.trim());
  } catch {
    return headerValue.trim();
  }
}

export function extractGeo(request: Request): GeoLocation {
  const ip = extractClientIp(request);
  const isLocal = isPrivateIp(ip);

  if (isLocal) {
    return {
      ip,
      city: DEFAULT_GEO.city,
      region: DEFAULT_GEO.region,
      country: DEFAULT_GEO.country,
      isLocal: true,
    };
  }

  const country =
    safeDecode(request.headers.get("x-vercel-ip-country")) ||
    safeDecode(request.headers.get("cf-ipcountry")) ||
    safeDecode(request.headers.get("x-geo-country")) ||
    DEFAULT_GEO.country;

  const region =
    safeDecode(request.headers.get("x-vercel-ip-country-region")) ||
    safeDecode(request.headers.get("cf-region")) ||
    safeDecode(request.headers.get("x-geo-region")) ||
    DEFAULT_GEO.region;

  const city =
    safeDecode(request.headers.get("x-vercel-ip-city")) ||
    safeDecode(request.headers.get("cf-ipcity")) ||
    safeDecode(request.headers.get("x-geo-city")) ||
    DEFAULT_GEO.city;

  return {
    ip,
    city: city || DEFAULT_GEO.city,
    region: region || DEFAULT_GEO.region,
    country: country || DEFAULT_GEO.country,
    isLocal: false,
  };
}

const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const GEO_CACHE_MAX_SIZE = 1000;
const geoCache = new Map<string, { value: GeoLocation; expiresAt: number }>();

/**
 * Clears the in-memory IP geolocation cache (useful for tests).
 */
export function clearGeoCache(): void {
  geoCache.clear();
}

/**
 * Resolves geolocation for a request asynchronously:
 * 1. Returns Siliguri default for private/loopback IPs.
 * 2. Uses reverse-proxy/CDN geo headers immediately if present.
 * 3. Checks in-memory TTL cache, then queries ip-api.com with a short timeout.
 */
export async function resolveGeo(request: Request): Promise<GeoLocation> {
  const ip = extractClientIp(request);
  if (isPrivateIp(ip) || /^192\.0\.2\.|^198\.51\.100\.|^203\.0\.113\./.test(ip)) {
    return {
      ip,
      city: DEFAULT_GEO.city,
      region: DEFAULT_GEO.region,
      country: DEFAULT_GEO.country,
      isLocal: isPrivateIp(ip),
    };
  }

  const headerCountry =
    safeDecode(request.headers.get("x-vercel-ip-country")) ||
    safeDecode(request.headers.get("cf-ipcountry")) ||
    safeDecode(request.headers.get("x-geo-country"));
  const headerRegion =
    safeDecode(request.headers.get("x-vercel-ip-country-region")) ||
    safeDecode(request.headers.get("cf-region")) ||
    safeDecode(request.headers.get("x-geo-region"));
  const headerCity =
    safeDecode(request.headers.get("x-vercel-ip-city")) ||
    safeDecode(request.headers.get("cf-ipcity")) ||
    safeDecode(request.headers.get("x-geo-city"));

  if (headerCountry && headerCity) {
    return {
      ip,
      country: headerCountry,
      region: headerRegion || DEFAULT_GEO.region,
      city: headerCity,
      isLocal: false,
    };
  }

  const now = Date.now();
  const cached = geoCache.get(ip);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`,
      { signal: AbortSignal.timeout(1500), cache: "no-store" }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        country?: string;
        regionName?: string;
        city?: string;
      };
      if (data.status === "success") {
        const resolved: GeoLocation = {
          ip,
          country: data.country?.trim() || headerCountry || DEFAULT_GEO.country,
          region: data.regionName?.trim() || headerRegion || DEFAULT_GEO.region,
          city: data.city?.trim() || headerCity || DEFAULT_GEO.city,
          isLocal: false,
        };
        if (geoCache.size >= GEO_CACHE_MAX_SIZE) {
          const oldestKey = geoCache.keys().next().value;
          if (oldestKey) geoCache.delete(oldestKey);
        }
        geoCache.set(ip, { value: resolved, expiresAt: now + GEO_CACHE_TTL_MS });
        return resolved;
      }
    }
  } catch {
    // Never fail cart sync if ip-api.com times out or is unreachable
  }

  const fallback: GeoLocation = {
    ip,
    country: headerCountry || DEFAULT_GEO.country,
    region: headerRegion || DEFAULT_GEO.region,
    city: headerCity || DEFAULT_GEO.city,
    isLocal: false,
  };

  if (geoCache.size >= GEO_CACHE_MAX_SIZE) {
    const oldestKey = geoCache.keys().next().value;
    if (oldestKey) geoCache.delete(oldestKey);
  }
  geoCache.set(ip, { value: fallback, expiresAt: now + 10 * 60 * 1000 });

  return fallback;
}
