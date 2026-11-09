"use client";

import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { VariantForm } from "@/components/admin/catalog/VariantForm";

export default function NewVariantPage() {
  return (
    <AdminAuthGate>
      <div className="new-variant-page-container" style={{ maxWidth: 840, margin: "0 auto" }}>
        <VariantForm isEdit={false} />
      </div>
    </AdminAuthGate>
  );
}
