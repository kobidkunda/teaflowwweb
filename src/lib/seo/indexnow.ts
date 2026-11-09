import { getSiteUrl } from "./site";

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation?: string;
  urlList: string[];
}

export interface IndexNowResult {
  success: boolean;
  status: number;
  message: string;
}

/**
 * Submits updated URLs to the IndexNow protocol endpoint (supported by Bing, Yandex, etc.).
 * Gracefully handles missing API keys in development/testing.
 */
export async function submitToIndexNow(
  urls: string[],
  apiKey: string = process.env.INDEXNOW_KEY || "himalayan-tea-house-indexnow-key"
): Promise<IndexNowResult> {
  const siteUrl = getSiteUrl();
  const host = new URL(siteUrl).host;

  const validUrls = urls.map((u) => {
    if (/^https?:\/\//i.test(u)) return u;
    return `${siteUrl}${u.startsWith("/") ? "" : "/"}${u}`;
  });

  const payload: IndexNowPayload = {
    host,
    key: apiKey,
    keyLocation: `${siteUrl}/${apiKey}.txt`,
    urlList: validUrls,
  };

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok || res.status === 200 || res.status === 202) {
      return {
        success: true,
        status: res.status,
        message: `Submitted ${validUrls.length} URLs to IndexNow successfully.`,
      };
    }

    return {
      success: false,
      status: res.status,
      message: `IndexNow returned HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      status: 500,
      message: error instanceof Error ? error.message : "IndexNow submission failed",
    };
  }
}
