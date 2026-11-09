"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { CategoryForm } from "@/components/admin/catalog/CategoryForm";

function NewCategoryInner() {
  const searchParams = useSearchParams();
  const parentIdParam = searchParams.get("parent_id");
  const defaultParentId = parentIdParam ? Number(parentIdParam) : null;

  return <CategoryForm isEdit={false} defaultParentId={defaultParentId} />;
}

export default function NewCategoryPage() {
  return (
    <AdminAuthGate>
      <div className="new-category-page-container">
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#6a6e64" }}>Loading form…</div>}>
          <NewCategoryInner />
        </Suspense>
      </div>
    </AdminAuthGate>
  );
}
