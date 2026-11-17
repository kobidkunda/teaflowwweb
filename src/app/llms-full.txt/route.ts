import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { applySecurityHeaders } from "@/lib/security";
import { listProducts } from "@/lib/products";
import { TrialService } from "@/lib/trials/service";
import { PrivateLabelService } from "@/lib/private-label/service";
import { resolveBaseUrl } from "@/lib/feeds";
import { resolveProductCommercePolicy } from "@/lib/seo/productPolicy";
import { getBulkApprovedReviewSummaries } from "@/lib/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatInrAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildShippingSummary(
  computeRate: (p: number) => number,
  pricePaise: number,
  freeEnabled: boolean,
  thresholdPaise: number,
  flatPaise: number
): string {
  const rate = computeRate(pricePaise);
  if (rate === 0) return "Free delivery";
  if (freeEnabled && thresholdPaise > 0) {
    return `${formatInrAmount(rate)} delivery (Free above ${formatInrAmount(thresholdPaise)})`;
  }
  return `${formatInrAmount(flatPaise)} delivery`;
}

export function GET(request: Request) {
  const filePath = path.join(process.cwd(), "public", "llms-full.txt");
  let baseManifest = "";
  try {
    baseManifest = fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    baseManifest = "# TeaFloww — Full Documentation\n\n> Direct-from-origin single-estate orthodox teas.";
  }

  const baseUrl = resolveBaseUrl(request.url);
  const lines: string[] = [baseManifest, "", "## Live Available Product Catalog"];

  try {
    const productReviews = getBulkApprovedReviewSummaries("product");
    const products = listProducts({ status: "published" });

    if (products.length > 0) {
      lines.push("", "### Single-Estate & Blended Teas");
      for (const p of products) {
        const policy = resolveProductCommercePolicy({
          entityType: "product",
          entityId: p.id,
          overrides: p,
          reviewSummary: productReviews.get(String(p.id)) || null,
          siteUrlOverride: baseUrl,
        });
        const prices = (p.variants || []).map((v) => v.price_paise).filter((v) => v >= 0);
        const minP = prices.length ? Math.min(...prices) : p.price_paise || 0;
        const maxP = prices.length ? Math.max(...prices) : minP;
        const priceStr =
          minP !== maxP ? `${formatInrAmount(minP)} to ${formatInrAmount(maxP)}` : formatInrAmount(minP);
        const inStock = (p.variants || []).some((v) => v.stock > 0);
        const stockStr = inStock ? "In stock" : "Out of stock";
        const shippingStr = buildShippingSummary(
          policy.computeShippingRatePaise,
          minP,
          policy.freeShippingEnabled,
          policy.freeShippingThresholdPaise,
          policy.flatShippingPaise
        );
        const ratingPart = policy.reviewSummary
          ? ` · ${policy.reviewSummary.ratingValue.toFixed(1)} (${policy.reviewSummary.reviewCount})`
          : "";
        lines.push(
          `- [${p.name}](${baseUrl}/tea/${p.slug}): ${priceStr} · ${stockStr}${ratingPart} · ${policy.deliveryWindowLabel} · ${shippingStr} · ${policy.returnWindowDays}-day returns`
        );
      }
    }
  } catch {
    // Graceful fallback if catalog query is unavailable
  }

  try {
    const trialReviews = getBulkApprovedReviewSummaries("trial");
    const trials = TrialService.listPublic({ limit: 100 });
    if (trials.trials.length > 0) {
      lines.push("", "### Craft Tea Trial Kits");
      for (const t of trials.trials) {
        const policy = resolveProductCommercePolicy({
          entityType: "trial",
          entityId: t.id,
          overrides: t.policy_overrides,
          reviewSummary: trialReviews.get(t.id) || null,
          siteUrlOverride: baseUrl,
        });
        const shippingStr = buildShippingSummary(
          policy.computeShippingRatePaise,
          t.price_paise,
          policy.freeShippingEnabled,
          policy.freeShippingThresholdPaise,
          policy.flatShippingPaise
        );
        const ratingPart = policy.reviewSummary
          ? ` · ${policy.reviewSummary.ratingValue.toFixed(1)} (${policy.reviewSummary.reviewCount})`
          : "";
        lines.push(
          `- [${t.title}](${baseUrl}/trials/${t.slug}): ${formatInrAmount(t.price_paise)} · ${t.in_stock ? "In stock" : "Out of stock"}${ratingPart} · ${policy.deliveryWindowLabel} · ${shippingStr} · ${policy.returnWindowDays}-day returns`
        );
      }
    }
  } catch {
    // Graceful fallback
  }

  try {
    const packagingReviews = getBulkApprovedReviewSummaries("packaging");
    const packaging = PrivateLabelService.listPublicPackagingVariants({ limit: 100 });
    if (packaging.items.length > 0) {
      lines.push("", "### Private Label Packaging Structures");
      for (const pk of packaging.items) {
        const policy = resolveProductCommercePolicy({
          entityType: "packaging",
          entityId: pk.id,
          extraHandlingDays: pk.lead_time_days || 14,
          reviewSummary: packagingReviews.get(pk.id) || null,
          siteUrlOverride: baseUrl,
        });
        const unitPaise = pk.starting_price?.unit_price_paise ?? 0;
        const priceStr = unitPaise > 0 ? `${formatInrAmount(unitPaise)}/unit (MOQ ${pk.moq_units})` : `MOQ ${pk.moq_units} units`;
        const ratingPart = policy.reviewSummary
          ? ` · ${policy.reviewSummary.ratingValue.toFixed(1)} (${policy.reviewSummary.reviewCount})`
          : "";
        lines.push(
          `- [${pk.title}](${baseUrl}/private-label/packaging/${pk.slug}): ${priceStr} · In stock${ratingPart} · ${policy.deliveryWindowLabel} · ${policy.returnWindowDays}-day returns`
        );
      }
    }
  } catch {
    // Graceful fallback
  }

  lines.push(
    "",
    "## Structured Product Feeds",
    `- OpenAI / ChatGPT Commerce Feed (JSONL): ${baseUrl}/feeds/openai.jsonl`,
    `- Google Merchant Center Feed (XML): ${baseUrl}/feeds/google.xml`,
    `- Google Product Ratings Feed (XML): ${baseUrl}/feeds/google-reviews.xml`,
    `- Meta Catalog Feed (CSV): ${baseUrl}/feeds/catalog.csv`
  );

  const response = new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=600",
    },
  });

  return applySecurityHeaders(response);
}
