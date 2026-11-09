import { getSiteUrl } from "./site";

const TRACKING_QUERY_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "ref",
  "sessionId",
  "session_id",
]);

/**
 * Normalizes a URL path according to canonical guidelines:
 * 1. Ensures leading slash.
 * 2. Removes redundant trailing slash (except for root "/").
 * 3. Strips query parameters or strips only known tracking parameters.
 * 4. Lowercases the path.
 */
export function normalizePath(path: string): string {
  if (!path || path.trim() === "" || path === "/") {
    return "/";
  }

  // Parse path and potential query
  const [pathname] = path.trim().split("?");
  let cleanPath = pathname.replace(/\/+/g, "/");

  // Ensure leading slash
  if (!cleanPath.startsWith("/")) {
    cleanPath = `/${cleanPath}`;
  }

  // Strip trailing slash unless root
  if (cleanPath.length > 1 && cleanPath.endsWith("/")) {
    cleanPath = cleanPath.slice(0, -1);
  }

  // Lowercase path
  cleanPath = cleanPath.toLowerCase();

  return cleanPath;
}

/**
 * Builds an absolute canonical HTTPS URL.
 * 
 * @param path Relative path (e.g. "/tea/darjeeling-spring") or full URL.
 * @param allowedQueryParams Optional list of query params permitted in canonical (e.g. ['category']).
 * @returns Fully qualified canonical URL (e.g. "https://himalayantea.com/tea/darjeeling-spring").
 */
export function buildCanonicalUrl(
  path: string,
  allowedQueryParams: string[] = []
): string {
  const baseUrl = getSiteUrl();

  // If already absolute with http/https
  if (/^https?:\/\//i.test(path)) {
    try {
      const parsed = new URL(path);
      const cleanPath = normalizePath(parsed.pathname);
      
      const newParams = new URLSearchParams();
      if (allowedQueryParams.length > 0) {
        for (const [key, val] of parsed.searchParams.entries()) {
          if (allowedQueryParams.includes(key) && !TRACKING_QUERY_PARAMS.has(key)) {
            newParams.set(key, val);
          }
        }
      }
      
      const searchStr = newParams.toString();
      return `${baseUrl}${cleanPath === "/" ? "" : cleanPath}${searchStr ? `?${searchStr}` : ""}` || baseUrl;
    } catch {
      // Fallback
    }
  }

  // Handle path with optional query string
  const [pathname, queryString] = path.split("?");
  const cleanPath = normalizePath(pathname);

  let searchStr = "";
  if (queryString && allowedQueryParams.length > 0) {
    const params = new URLSearchParams(queryString);
    const filteredParams = new URLSearchParams();
    for (const [key, val] of params.entries()) {
      if (allowedQueryParams.includes(key) && !TRACKING_QUERY_PARAMS.has(key)) {
        filteredParams.set(key, val);
      }
    }
    searchStr = filteredParams.toString();
  }

  const finalPath = cleanPath === "/" ? "" : cleanPath;
  return `${baseUrl}${finalPath}${searchStr ? `?${searchStr}` : ""}` || baseUrl;
}

/**
 * Cleans a URL string by stripping all known tracking parameters while preserving functional query parameters.
 */
export function stripTrackingParams(urlString: string): string {
  try {
    const url = new URL(urlString, getSiteUrl());
    for (const param of Array.from(url.searchParams.keys())) {
      if (TRACKING_QUERY_PARAMS.has(param.toLowerCase())) {
        url.searchParams.delete(param);
      }
    }
    return url.toString();
  } catch {
    return urlString;
  }
}
