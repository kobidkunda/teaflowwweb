import { describe, expect, it } from "vitest";
import { imagesForVariant } from "@/lib/imageVariants";

describe("imagesForVariant", () => {
  const variants = [
    { sku: "TEA-POUCH-100", packaging_format: "loose_leaf_pouch" },
    { sku: "TEA-POUCH-200", packaging_format: "loose_leaf_pouch" },
    { sku: "TEA-POUCH-300", packaging_format: "loose_leaf_pouch" },
    { sku: "TEA-TIN-100", packaging_format: "luxury_tin" },
    { sku: "TEA-TIN-300", packaging_format: "luxury_tin" },
    { sku: "TEA-BAGS-25", packaging_format: "pyramid_bags" },
  ];

  const images = [
    { url: "/images/pouch-general.jpg", variant_skus: ["TEA-POUCH-100", "TEA-POUCH-200", "TEA-POUCH-300"] },
    { url: "/images/tin-general.jpg", variant_skus: ["TEA-TIN-100", "TEA-TIN-300"] },
    { url: "/images/bags-general.jpg", variant_skus: ["TEA-BAGS-25"] },
    { url: "/images/shared-leaf.jpg", variant_skus: [] },
  ];

  it("returns loose leaf pouch image and shared images when loose leaf SKU is active", () => {
    const result = imagesForVariant(images, "TEA-POUCH-200", {
      format: "loose_leaf_pouch",
      variants,
    });
    expect(result.map((img) => img.url)).toEqual([
      "/images/pouch-general.jpg",
      "/images/shared-leaf.jpg",
    ]);
  });

  it("returns luxury tin image and shared images when tin SKU is active", () => {
    const result = imagesForVariant(images, "TEA-TIN-300", {
      format: "luxury_tin",
      variants,
    });
    expect(result.map((img) => img.url)).toEqual([
      "/images/tin-general.jpg",
      "/images/shared-leaf.jpg",
    ]);
  });

  it("returns pyramid bags image when pyramid bags SKU is active", () => {
    const result = imagesForVariant(images, "TEA-BAGS-25", {
      format: "pyramid_bags",
      variants,
    });
    expect(result.map((img) => img.url)).toEqual([
      "/images/bags-general.jpg",
      "/images/shared-leaf.jpg",
    ]);
  });

  it("falls back to format matching when an exact new SKU of the same format is selected", () => {
    // Suppose an image was only tagged with TEA-POUCH-100
    const singleTaggedImages = [
      { url: "/images/pouch-100.jpg", variant_skus: ["TEA-POUCH-100"] },
      { url: "/images/tin-100.jpg", variant_skus: ["TEA-TIN-100"] },
      { url: "/images/shared.jpg", variant_skus: [] },
    ];

    // Customer clicks 200g pouch (TEA-POUCH-200)
    const result = imagesForVariant(singleTaggedImages, "TEA-POUCH-200", {
      format: "loose_leaf_pouch",
      variants,
    });

    // Should still resolve the pouch image via format fallback, NOT the tin!
    expect(result.map((img) => img.url)).toEqual([
      "/images/pouch-100.jpg",
      "/images/shared.jpg",
    ]);
  });

  it("preserves backward compatibility when options are omitted", () => {
    const result = imagesForVariant(images, "TEA-POUCH-100");
    expect(result.map((img) => img.url)).toEqual([
      "/images/pouch-general.jpg",
      "/images/shared-leaf.jpg",
    ]);

    const fallback = imagesForVariant(images, "UNKNOWN-SKU");
    expect(fallback.map((img) => img.url)).toEqual(["/images/shared-leaf.jpg"]);
  });

  it("handles empty image array", () => {
    expect(imagesForVariant([], "TEA-POUCH-100")).toEqual([]);
  });
});
