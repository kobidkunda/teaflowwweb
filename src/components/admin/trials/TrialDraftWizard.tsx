"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Boxes,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
} from "lucide-react";

export interface DraftWizardInput {
  title: string;
  slug?: string;
  tagline?: string;
  description?: string;
  price_rupees: number | string;
  sku?: string;
  inventory_quantity?: number | string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateDraftInput(input: {
  title: string;
  price_rupees: number | string;
  slug?: string;
  sku?: string;
}): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.title || input.title.trim().length < 3) {
    errors.title = "Title is required and must be at least 3 characters.";
  } else if (input.title.trim().length > 180) {
    errors.title = "Title cannot exceed 180 characters.";
  }

  const priceNum = Number(input.price_rupees);
  if (isNaN(priceNum) || priceNum <= 0) {
    errors.price_rupees = "Price must be greater than ₹0.00.";
  }

  if (input.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    errors.slug = "Slug must contain only lowercase alphanumeric characters and single hyphens.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function TrialDraftWizard() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [priceRupees, setPriceRupees] = useState<string>("200");
  const [sku, setSku] = useState("");
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState(false);
  const [inventoryQty, setInventoryQty] = useState<string>("50");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!isSlugManuallyEdited) {
      const derivedSlug = slugify(val);
      setSlug(derivedSlug);
      if (!isSkuManuallyEdited) {
        setSku(derivedSlug ? `KIT-${derivedSlug.slice(0, 12).toUpperCase()}` : "");
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const validation = validateDraftInput({
      title,
      price_rupees: priceRupees,
      slug: slug || undefined,
      sku: sku || undefined,
    });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setFormError("Please fix the highlighted errors before submitting.");
      return;
    }

    setSubmitting(true);

    const pricePaise = Math.round(Number(priceRupees) * 100);
    const idempotencyKey = `trial_create_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const payload = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      tagline: tagline.trim() || undefined,
      description: description.trim() || undefined,
      price_paise: pricePaise,
      sku: sku.trim() || undefined,
      inventory_quantity: Number(inventoryQty) || 50,
      inventory_policy: "track",
    };

    try {
      const res = await fetch("/api/v1/admin/trials", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 201 || res.status === 200) {
        const created = await res.json();
        const createdId = created.id || created.trial?.id;
        if (createdId) {
          router.push(`/admin/trials/${createdId}`);
        } else {
          router.push("/admin/trials");
        }
        return;
      }

      if (res.status === 409) {
        const errData = await res.json().catch(() => null);
        setFormError(errData?.error || "A trial with this slug already exists.");
        setFieldErrors({ slug: "This slug is already taken. Please choose another." });
        return;
      }

      if (res.status === 400) {
        const errData = await res.json().catch(() => null);
        setFormError(errData?.error || "Validation failed. Please verify form values.");
        return;
      }

      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || "An unexpected error occurred while creating trial.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create trial kit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-trial-wizard-root" style={{ maxWidth: 840, margin: "0 auto", padding: "32px 24px" }}>
      {/* Navigation Breadcrumb / Back Link */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/admin/trials"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "#23483a",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Trials Listing</span>
        </Link>
      </div>

      {/* Header */}
      <div
        style={{
          background: "#ffffff",
          padding: "24px 32px",
          borderRadius: "8px 8px 0 0",
          border: "1px solid #d9d4c8",
          borderBottom: "1px solid #ede9df",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              background: "#f0f4f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#23483a",
            }}
          >
            <Boxes size={26} />
          </div>
          <div>
            <span
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#6a6e64",
                fontWeight: 600,
              }}
            >
              Draft Creation Wizard
            </span>
            <h1
              style={{
                margin: "2px 0 0",
                fontSize: 24,
                fontWeight: 700,
                color: "#1d2a24",
                fontFamily: "var(--font-serif, Georgia, serif)",
              }}
            >
              Create New Trial Kit
            </h1>
          </div>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 14, color: "#555850" }}>
          Start a new 4x50g discovery kit draft. Default placeholder sachet slots will be automatically provisioned
          for you to curate in the 5-tab Trial Studio.
        </p>
      </div>

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#ffffff",
          padding: "28px 32px",
          borderRadius: "0 0 8px 8px",
          border: "1px solid #d9d4c8",
          borderTop: "none",
          boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
        }}
      >
        {formError && (
          <div
            role="alert"
            style={{
              padding: "12px 16px",
              background: "#fdf2f2",
              border: "1px solid #f8b4b4",
              borderRadius: 6,
              color: "#9b1c1c",
              fontSize: 13,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle size={18} />
            <span>{formError}</span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Title */}
          <div>
            <label
              htmlFor="trial-title"
              style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
            >
              Trial Title <span style={{ color: "#8f2f2a" }}>*</span>
            </label>
            <input
              id="trial-title"
              type="text"
              name="title"
              data-testid="input-trial-title"
              placeholder="e.g., Darjeeling First Flush Exploration"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
              minLength={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                borderRadius: 6,
                border: fieldErrors.title ? "1px solid #8f2f2a" : "1px solid #c9c2b6",
                boxSizing: "border-box",
              }}
            />
            {fieldErrors.title && (
              <span style={{ fontSize: 12, color: "#8f2f2a", marginTop: 4, display: "block" }}>
                {fieldErrors.title}
              </span>
            )}
            <span style={{ fontSize: 12, color: "#7e786b", marginTop: 4, display: "block" }}>
              Public headline shown on catalogue and product detail pages (min 3 characters).
            </span>
          </div>

          {/* Slug & SKU Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Slug */}
            <div>
              <label
                htmlFor="trial-slug"
                style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
              >
                URL Slug
              </label>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span
                  style={{
                    padding: "10px 10px",
                    background: "#ede9df",
                    border: "1px solid #c9c2b6",
                    borderRight: "none",
                    borderRadius: "6px 0 0 6px",
                    fontSize: 13,
                    color: "#6a6e64",
                  }}
                >
                  /trials/
                </span>
                <input
                  id="trial-slug"
                  type="text"
                  name="slug"
                  placeholder="darjeeling-first-flush"
                  value={slug}
                  onChange={(e) => {
                    setIsSlugManuallyEdited(true);
                    setSlug(e.target.value);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    fontSize: 13,
                    borderRadius: "0 6px 6px 0",
                    border: fieldErrors.slug ? "1px solid #8f2f2a" : "1px solid #c9c2b6",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              {fieldErrors.slug && (
                <span style={{ fontSize: 12, color: "#8f2f2a", marginTop: 4, display: "block" }}>
                  {fieldErrors.slug}
                </span>
              )}
            </div>

            {/* SKU */}
            <div>
              <label
                htmlFor="trial-sku"
                style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
              >
                SKU Identifier
              </label>
              <input
                id="trial-sku"
                type="text"
                name="sku"
                placeholder="KIT-DARJ-4X50G"
                value={sku}
                onChange={(e) => {
                  setIsSkuManuallyEdited(true);
                  setSku(e.target.value);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #c9c2b6",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: 12, color: "#7e786b", marginTop: 4, display: "block" }}>
                Internal warehouse SKU code.
              </span>
            </div>
          </div>

          {/* Pricing & Stock Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Price (Rupees) */}
            <div>
              <label
                htmlFor="trial-price"
                style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
              >
                Kit Price (₹) <span style={{ color: "#8f2f2a" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontWeight: 700,
                    color: "#6a6e64",
                  }}
                >
                  ₹
                </span>
                <input
                  id="trial-price"
                  type="number"
                  name="price_rupees"
                  step="0.01"
                  min="1"
                  placeholder="200.00"
                  value={priceRupees}
                  onChange={(e) => setPriceRupees(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 28px",
                    fontSize: 14,
                    borderRadius: 6,
                    border: fieldErrors.price_rupees ? "1px solid #8f2f2a" : "1px solid #c9c2b6",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              {fieldErrors.price_rupees && (
                <span style={{ fontSize: 12, color: "#8f2f2a", marginTop: 4, display: "block" }}>
                  {fieldErrors.price_rupees}
                </span>
              )}
              <span style={{ fontSize: 12, color: "#7e786b", marginTop: 4, display: "block" }}>
                Stored internally as {Math.round(Number(priceRupees || 0) * 100)} paise.
              </span>
            </div>

            {/* Inventory Quantity */}
            <div>
              <label
                htmlFor="trial-stock"
                style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
              >
                Initial Stock Units
              </label>
              <input
                id="trial-stock"
                type="number"
                min="0"
                step="1"
                placeholder="50"
                value={inventoryQty}
                onChange={(e) => setInventoryQty(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  borderRadius: 6,
                  border: "1px solid #c9c2b6",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: 12, color: "#7e786b", marginTop: 4, display: "block" }}>
                Number of assembled 200g kits ready to ship.
              </span>
            </div>
          </div>

          {/* Tagline */}
          <div>
            <label
              htmlFor="trial-tagline"
              style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 6 }}
            >
              Tagline (Optional)
            </label>
            <input
              id="trial-tagline"
              type="text"
              name="tagline"
              placeholder="e.g., Four legendary Darjeeling flushes from high-elevation gardens"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid #c9c2b6",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Pack Format Info Pill */}
          <div
            style={{
              padding: "12px 16px",
              background: "#f0f4f1",
              borderRadius: 6,
              border: "1px solid #c8d8ce",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Boxes size={22} color="#23483a" />
            <div style={{ fontSize: 13, color: "#1d2a24" }}>
              <strong>Pack Format:</strong> <code>4x50g_sachets</code> (200g net kit weight invariant).
              <br />
              <span style={{ fontSize: 12, color: "#555850" }}>
                Upon creation, 4 placeholder slots (50g each) will be prepared for tea curation in Tab 2.
              </span>
            </div>
          </div>

          {/* Submit Action */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 10,
              paddingTop: 16,
              borderTop: "1px solid #ede9df",
            }}
          >
            <Link
              href="/admin/trials"
              className="button button-outline"
              style={{ padding: "10px 20px", fontSize: 14, textDecoration: "none" }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="button button-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                background: "#23483a",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                cursor: submitting ? "wait" : "pointer",
              }}
            >
              <Sparkles size={16} />
              <span>{submitting ? "Creating Draft…" : "Create Draft & Launch Studio"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
