"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { CategoryForm, type CategoryFormData } from "@/components/admin/catalog/CategoryForm";
import { ArrowLeft } from "lucide-react";

export default function EditCategoryPage() {
  return (
    <AdminAuthGate>
      <EditCategoryContent />
    </AdminAuthGate>
  );
}

function EditCategoryContent() {
  const params = useParams();
  const idStr = params?.id as string;
  const categoryId = Number(idStr);

  const [categoryData, setCategoryData] = useState<CategoryFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchCategory() {
      try {
        const res = await fetch(`/api/admin/categories/${categoryId}`, { credentials: "same-origin" });
        if (!res.ok) {
          if (mounted) setError("Category not found or unable to load.");
          return;
        }
        const data = (await res.json()) as { category: CategoryFormData };
        if (mounted) setCategoryData(data.category);
      } catch {
        if (mounted) setError("Network error loading category.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (categoryId) void fetchCategory();
    return () => {
      mounted = false;
    };
  }, [categoryId]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6a6e64" }}>
        <p role="status">Loading category for editing…</p>
      </div>
    );
  }

  if (error || !categoryData) {
    return (
      <div style={{ padding: 32, background: "#fbf8f1", borderRadius: 8, border: "1px solid #d9d4c8" }}>
        <h2 style={{ color: "#8f2f2a" }}>Unable to load category</h2>
        <p>{error || "Category not found."}</p>
        <Link href="/admin/categories" className="button button-outline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={14} />
          <span>Back to Categories</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="edit-category-page-container">
      <CategoryForm initialData={categoryData} isEdit={true} categoryId={categoryId} />
    </div>
  );
}
