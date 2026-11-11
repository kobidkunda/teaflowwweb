import React from "react";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products";
import { listProductImages, type ProductImage } from "@/lib/productImages";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { ProductForm, type ProductFormData } from "@/components/admin/catalog/ProductForm";

export const metadata = {
  title: "Edit Product | Admin | Himalayan Tea House",
  description: "Update product attributes, cupping scores, tasting notes, and variants.",
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (!productId || isNaN(productId)) {
    notFound();
  }

  const product = getProduct(productId);
  if (!product) {
    notFound();
  }

  let images: ProductImage[] = [];

  try {
    images = listProductImages(productId);
  } catch {
    images = [];
  }

  const initialData: ProductFormData = {
    ...product,
    verified_origin: product.verified_origin || "",
    ingredients: product.ingredients || "",
    status: product.status || "published",
    wholesale_moq: product.wholesale_moq ?? null,
    variants: (product.variants || []).map((v) => ({
      id: v.id,
      sku: v.sku,
      packaging_format: v.packaging_format,
      grams: v.grams,
      price_paise: v.price_paise,
      compare_at_price_paise: v.compare_at_price_paise ?? null,
      stock: v.stock,
      servings: v.servings,
      wholesale_slabs: v.wholesale_slabs || [],
    })),
    price:
      product.price ??
      (product.variants?.[0]?.price_paise
        ? Math.round(product.variants[0].price_paise / 100)
        : 199),
    images: images.map((img) => ({
      id: img.id,
      url: img.url,
      alt_text: img.alt_text || "Product image",
      sort_order: img.sort_order ?? 0,
      is_primary: img.is_primary ?? 0,
      variant_skus: img.variant_skus ?? [],
    })),
  };

  return (
    <AdminAuthGate>
      <div className="edit-product-page-container">
        <ProductForm initialData={initialData} isEdit={true} productId={productId} />
      </div>
    </AdminAuthGate>
  );
}
