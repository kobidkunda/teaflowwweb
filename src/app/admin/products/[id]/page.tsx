"use client";
import type { TeaMomentsContent } from "@/lib/teaMoments";
import { ProductTranslateButton } from "@/components/admin/international/ProductTranslateButton";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ProductPublicationControl } from "@/components/admin/catalog/ProductPublicationControl";
import { ProductImagesEditor } from "@/components/admin/catalog/ProductImagesEditor";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import {
  ArrowLeft,
  Edit,
  Trash2,
  ExternalLink,
  Coffee,
  Sliders,
  Layers,
  FileText,
  Download,
} from "lucide-react";

interface Variant {
  id: number;
  sku: string;
  packaging_format: string;
  grams: number;
  price_paise: number;
  stock: number;
  servings: number;
}

interface ProductImage {
  id: number;
  url: string;
  alt_text: string;
  sort_order: number;
  is_primary: number;
  variant_skus?: string[];
}

interface ProductDossier {
  tea_moments?: TeaMomentsContent | null;
  id: number;
  slug: string;
  name: string;
  category: string;
  category_id?: number | null;
  origin: string;
  verified_origin?: string;
  ingredients?: string;
  status?: string;
  is_enabled?: number;
  estate: string;
  flush: string;
  harvest_date: string;
  description: string;
  tasting_notes: string;
  floral: number;
  fruity: number;
  malty: number;
  body: number;
  sweetness: number;
  earthy: number;
  aroma_tags: string[];
  dry_leaf_appearance: string;
  dry_leaf_grade: string;
  dry_leaf_aroma: string;
  liquor_hue_hex: string;
  liquor_hue_name: string;
  liquor_clarity: string;
  liquor_body: string;
  wet_leaf_aroma: string;
  wet_leaf_oxidation: string;
  brew_temp: number;
  brew_seconds: number;
  leaf_dose_grams: number;
  water_ml: number;
  steep_count: number;
  steep_instructions: string;
  elevation_feet: number;
  elevation_display: string;
  lot_number: string;
  cultivar: string;
  estate_story: string;
  featured: number;
  pdf_url?: string | null;
  pdf_title?: string | null;
  variants: Variant[];
  images: ProductImage[];
}

export default function ProductDossierPage() {
  return (
    <AdminAuthGate>
      <ProductDossierContent />
    </AdminAuthGate>
  );
}

function ProductDossierContent() {
  const params = useParams();
  const productId = params?.id as string;

  const [product, setProduct] = useState<ProductDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadProduct() {
      try {
        const res = await fetch(`/api/admin/products/${productId}`, { credentials: "same-origin" });
        if (!res.ok) {
          if (mounted) setError("Product not found or unable to load dossier.");
          return;
        }
        const data = (await res.json()) as { product: ProductDossier };
        if (mounted) setProduct(data.product);
      } catch {
        if (mounted) setError("Network error loading product dossier.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (productId) void loadProduct();
    return () => {
      mounted = false;
    };
  }, [productId]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6a6e64" }}>
        <p role="status">Loading product dossier…</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ padding: 40, background: "#fbf8f1", borderRadius: 8, border: "1px solid #d9d4c8" }}>
        <h2 style={{ color: "#8f2f2a" }}>Product Dossier Error</h2>
        <p>{error || "Product not found."}</p>
        <Link href="/admin/products" className="button button-outline">
          Back to Products List
        </Link>
      </div>
    );
  }

  const primaryImage = product.images?.find((img) => img.is_primary === 1) || product.images?.[0];

  return (
    <div className="product-dossier-container" style={{ maxWidth: 1100 }}>
      {/* Top Header & Action Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          paddingBottom: 20,
          borderBottom: "1px solid #d9d4c8",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Link
              href="/admin/products"
              className="button button-outline"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 10px" }}
            >
              <ArrowLeft size={14} />
              <span>All Products</span>
            </Link>
            <span
              style={{
                background: "#ede9df",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 12,
                color: "#1d2a24",
                fontWeight: 600,
              }}
            >
              {product.category || "Single Estate"}
            </span>
            <span
              style={{
                background: product.status === "draft" ? "#fef3c7" : product.status === "archived" ? "#f3f4f6" : "#e6f4ea",
                color: product.status === "draft" ? "#92400e" : product.status === "archived" ? "#374151" : "#137333",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {product.status || "Published"}
            </span>
            {product.featured === 1 && (
              <span
                style={{
                  background: "rgba(179, 145, 86, 0.2)",
                  color: "#6d531d",
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ★ Featured
              </span>
            )}
          </div>

          <ProductTranslateButton productId={Number(product.id)} />
          <h1 style={{ margin: "0 0 6px 0", fontSize: 28, color: "#1d2a24", fontFamily: "Georgia, serif" }}>
            {product.name}
          </h1>
          <p style={{ margin: 0, color: "#555850", fontSize: 13 }}>
            Slug: <code style={{ background: "#ede9df", padding: "1px 5px", borderRadius: 3 }}>{product.slug}</code> ·
            ID: #{product.id}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <ProductPublicationControl id={product.id} name={product.name} status={product.status} enabled={product.is_enabled} onChange={(value) => setProduct((current) => current ? { ...current, ...value } : current)} />
          <a
            href={`/tea/${product.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span>Storefront View</span>
            <ExternalLink size={14} />
          </a>
          <Link
            href={`/admin/products/${product.id}/edit`}
            className="button button-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Edit size={15} />
            <span>Edit Product</span>
          </Link>
          <Link
            href={`/admin/products/${product.id}/delete`}
            className="button button-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#8f2f2a", borderColor: "#f2c7c5" }}
          >
            <Trash2 size={15} />
            <span>Delete</span>
          </Link>
        </div>
      </div>

      <ProductImagesEditor productId={product.id} images={product.images || []} variants={product.variants || []} onSaved={(images) => setProduct((current) => current ? { ...current, images } : current)} />

      {/* Grid Layout: Left Details, Right Imagery & Quick Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 30 }}>
        {/* Left Column: Tasting & Cupping Dossier */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Overview, Description & Ingredients */}
          {(product.description || product.ingredients) && (
            <div style={{ background: "#fbf8f1", border: "1px solid #d9d4c8", borderRadius: 8, padding: 20 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: "#23483a" }}>
                Product Overview &amp; Provenance
              </h3>
              {product.description && (
                <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "#2c302a", lineHeight: 1.6 }}>
                  {product.description}
                </p>
              )}
              {product.ingredients && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#23483a" }}>Ingredients: </span>
                  <span style={{ fontSize: 13, color: "#2c302a" }}>{product.ingredients}</span>
                </div>
              )}

            </div>
          )}

          {/* Estate Batch Dossier & Certification (PDF) */}
          <div style={{ background: "#fbf8f1", border: "1px solid #d9d4c8", borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: "#23483a", display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={18} color="#b36b3d" />
              <span>Estate Batch Dossier &amp; Certification (PDF)</span>
            </h3>
            {product.pdf_url ? (
              <div style={{ background: "#ffffff", border: "1px solid #cfc7b6", borderRadius: 6, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 48,
                      background: "linear-gradient(135deg, #b91c1c, #991b1b)",
                      borderRadius: 4,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={18} />
                    <span style={{ fontSize: 8, fontWeight: 800 }}>PDF</span>
                  </div>
                  <div>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: 14, fontWeight: 700, color: "#1d2a24" }}>
                      {product.pdf_title || `${product.name} — Estate Tasting Dossier`}
                    </h4>
                    <p style={{ margin: 0, fontSize: 12, color: "#6b7266" }}>
                      Attached document accessible from storefront PDP
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid #ebe5d8" }}>
                  <a
                    href={product.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button button-outline"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px" }}
                  >
                    <ExternalLink size={13} />
                    <span>View Dossier</span>
                  </a>
                  <a
                    href={`${product.pdf_url}?download=1`}
                    download
                    className="button button-outline"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px" }}
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </a>
                  <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="button button-outline"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px" }}
                  >
                    <Edit size={13} />
                    <span>Replace / Edit</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ padding: "16px", background: "#f6f1e7", borderRadius: 6, fontSize: 13, color: "#6a6e64", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>No PDF dossier attached to this product.</span>
                <Link
                  href={`/admin/products/${product.id}/edit`}
                  style={{ color: "#23483a", fontWeight: 600, fontSize: 12, textDecoration: "underline" }}
                >
                  + Add PDF
                </Link>
              </div>
            )}
          </div>

          {/* Cupping Scores */}
          <div style={{ background: "#fbf8f1", border: "1px solid #d9d4c8", borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16, color: "#23483a", display: "flex", alignItems: "center", gap: 8 }}>
              <Sliders size={18} />
              <span>Sensory Cupping Profile (0–5)</span>
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Floral", score: product.floral, icon: "🌸" },
                { label: "Fruity", score: product.fruity, icon: "🍇" },
                { label: "Malty", score: product.malty, icon: "🌾" },
                { label: "Body", score: product.body, icon: "☕" },
                { label: "Sweetness", score: product.sweetness, icon: "🍯" },
                { label: "Earthy", score: product.earthy, icon: "🍃" },
              ].map(({ label, score, icon }) => (
                <div key={label} style={{ background: "#f6f1e7", padding: "10px 12px", borderRadius: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 18 }}>{icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6a6e64", marginTop: 2 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2a24", marginTop: 2 }}>{score} / 5</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6a6e64" }}>Tasting Notes:</div>
              <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 500, color: "#1d2a24" }}>
                {product.tasting_notes || "None recorded"}
              </p>
            </div>

            {product.aroma_tags && product.aroma_tags.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6a6e64", marginBottom: 6 }}>Aroma Tags:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {product.aroma_tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        background: "#ede9df",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "#23483a",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3-Stage Evaluation */}
          <div style={{ background: "#fbf8f1", border: "1px solid #d9d4c8", borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16, color: "#23483a" }}>
              Three-Stage Connoisseur Evaluation
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#23483a" }}>Dry Leaf:</div>
                <div style={{ fontSize: 13, color: "#1d2a24" }}>
                  <strong>Grade:</strong> {product.dry_leaf_grade || "FTGFOP1"} · <strong>Appearance:</strong>{" "}
                  {product.dry_leaf_appearance || "Whole twisted leaves"}
                </div>
                <div style={{ fontSize: 12, color: "#6a6e64" }}>Aroma: {product.dry_leaf_aroma || "Floral"}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#23483a" }}>Liquor Infusion:</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      background: product.liquor_hue_hex || "#d49a3d",
                      border: "1px solid #c9c2b6",
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{product.liquor_hue_name || "Bright Amber"}</span>
                  <span style={{ fontSize: 12, color: "#6a6e64" }}>({product.liquor_clarity || "Clear"})</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#23483a" }}>Spent Wet Leaf:</div>
                <div style={{ fontSize: 13, color: "#1d2a24" }}>
                  {product.wet_leaf_aroma || "Orchid and apricot notes"} · Oxidation: {product.wet_leaf_oxidation || "Light"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Imagery Gallery & Terroir */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Image Gallery */}
          <div style={{ background: "#fbf8f1", border: "1px solid #d9d4c8", borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16, color: "#23483a" }}>
              Product Imagery ({product.images?.length || 0})
            </h3>

            {primaryImage ? (
              <div style={{ borderRadius: 6, overflow: "hidden", border: "1px solid #d9d4c8", marginBottom: 12 }}>
                <Image
                  src={primaryImage.url}
                  alt={primaryImage.alt_text || product.name}
                  width={400}
                  height={220}
                  sizes="(max-width: 768px) 100vw, 400px"
                  style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
                />
                <div style={{ padding: "8px 12px", background: "#f6f1e7", fontSize: 12, color: "#6a6e64" }}>
                  Primary Cover: {primaryImage.alt_text}
                </div>
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "#6a6e64", background: "#f6f1e7", borderRadius: 6 }}>
                No images attached.
              </div>
            )}

            {product.images && product.images.length > 1 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))", gap: 8 }}>
                {product.images.map((img, idx) => (
                  <div
                    key={img.url + idx}
                    style={{
                      height: 60,
                      borderRadius: 4,
                      overflow: "hidden",
                      border: img.is_primary ? "2px solid #23483a" : "1px solid #d9d4c8",
                    }}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt_text || `Gallery image ${idx + 1}`}
                      width={70}
                      height={60}
                      sizes="70px"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {product.tea_moments && <section aria-label="Tea Moments" style={{ background: "#fbf8f1", border: "1px solid #d9d4c8", borderRadius: 8, padding: 20 }}>
            <h3>{product.tea_moments.headline || "Make it your moment."}</h3>
            <p>{product.tea_moments.introduction || "Add an introduction to show Tea Moments on the product page."}</p>
            <dl>{[["The moment", product.tea_moments.occasion], ["Serve it your way", product.tea_moments.serving_suggestion], ["Pair it with", product.tea_moments.food_pairing]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </section>}

          {/* Terroir & Steeping */}
          <div style={{ background: "#fbf8f1", border: "1px solid #d9d4c8", borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16, color: "#23483a", display: "flex", alignItems: "center", gap: 8 }}>
              <Coffee size={18} />
              <span>Brewing Guide</span>
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, marginBottom: 16 }}>
              <div>
                <strong>Water Temp:</strong> {product.brew_temp}°C
              </div>
              <div>
                <strong>Steep Time:</strong> {product.brew_seconds}s
              </div>
              <div>
                <strong>Leaf Dose:</strong> {product.leaf_dose_grams}g
              </div>
              <div>
                <strong>Water Vol:</strong> {product.water_ml}ml
              </div>

            </div>


          </div>
        </div>
      </div>

      {/* Packaging & Variants Section */}
      <section
        style={{
          background: "#fbf8f1",
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          padding: 24,
          marginBottom: 30,
        }}
      >
        <h3 style={{ margin: "0 0 16px 0", fontSize: 18, color: "#1d2a24", display: "flex", alignItems: "center", gap: 8 }}>
          <Layers size={20} color="#23483a" />
          <span>Packaging Formats &amp; Inventory Stock</span>
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Packaging Format</th>
                <th>Net Weight</th>
                <th>Price (INR)</th>
                <th>Per-Cup Price</th>
                <th>Stock Units</th>
              </tr>
            </thead>
            <tbody>
              {product.variants?.map((v) => {
                const priceInr = (v.price_paise / 100).toFixed(2);
                const servings = v.servings || Math.max(1, Math.round(v.grams / 2.5));
                const perCup = ((v.price_paise / 100) / servings).toFixed(1);

                return (
                  <tr key={v.sku}>
                    <td style={{ fontWeight: 600 }}>{v.sku}</td>
                    <td>{v.packaging_format.replace(/_/g, " ")}</td>
                    <td>{v.grams}g</td>
                    <td>₹{priceInr}</td>
                    <td style={{ color: "#6a6e64" }}>~₹{perCup} / cup</td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color: v.stock <= 0 ? "#8f2f2a" : v.stock <= 10 ? "#9e6428" : "#23483a",
                        }}
                      >
                        {v.stock}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
