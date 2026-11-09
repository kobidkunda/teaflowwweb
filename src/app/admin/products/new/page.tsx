"use client";

import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { ProductForm } from "@/components/admin/catalog/ProductForm";

export default function NewProductPage() {
  return (
    <AdminAuthGate>
      <div className="new-product-page-container">
        <ProductForm isEdit={false} />
      </div>
    </AdminAuthGate>
  );
}
