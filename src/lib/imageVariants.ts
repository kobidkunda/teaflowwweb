export function parseImageVariantSkus(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((sku): sku is string => typeof sku === "string");
  if (typeof value === "string") {
    try { return parseImageVariantSkus(JSON.parse(value)); } catch { return []; }
  }
  return [];
}

export type VariantOption = { sku: string; packaging_format: string };

function isBulkSku(s: string): boolean {
  return /-(5|10|25|35)KG$/i.test(s) || /-(5000|10000|25000|35000)G$/i.test(s);
}

/** Matching pack images come first, followed by format-fallback images and shared gallery images. */
export function imagesForVariant<T extends { variant_skus?: string[] }>(
  images: T[],
  sku?: string,
  options?: {
    format?: string;
    variants?: VariantOption[];
  }
): T[] {
  if (!images.length) return [];

  // Determine current format
  let format = options?.format;
  if (!format && sku && options?.variants) {
    format = options.variants.find((v) => v.sku === sku)?.packaging_format;
  }

  // 1. Direct exact SKU match
  const exactMatches = sku ? images.filter((image) => image.variant_skus?.includes(sku)) : [];

  // 2. Format fallback (when variants list or format is known)
  let formatMatches: T[] = [];
  if (format && options?.variants) {
    const isTargetBulk = sku ? isBulkSku(sku) : false;
    const skusOfSameFormat = new Set(
      options.variants
        .filter((v) => {
          if (v.packaging_format !== format) return false;
          // Avoid crossing retail (<5kg) vs bulk wholesale (>=5kg) boundaries during format fallback
          if (sku) {
            const isVBulk = isBulkSku(v.sku);
            if (isTargetBulk !== isVBulk) return false;
          }
          return true;
        })
        .map((v) => v.sku)
    );
    formatMatches = images.filter(
      (image) =>
        !exactMatches.includes(image) &&
        image.variant_skus?.some((s) => skusOfSameFormat.has(s))
    );
  }

  // 3. Shared images: images without variant restrictions
  const shared = images.filter((image) => !image.variant_skus?.length);

  // If we have exact or format matches, include them along with shared images
  if (exactMatches.length > 0 || formatMatches.length > 0) {
    return [...exactMatches, ...formatMatches, ...shared];
  }

  // If no exact match and no format match was found:
  // Return shared images if any exist
  if (shared.length > 0) {
    return shared;
  }

  // Fallback to first image if none matched and no shared images exist
  return images.slice(0, 1);
}
