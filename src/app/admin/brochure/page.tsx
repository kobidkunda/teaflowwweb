import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { BrochureManager } from "@/components/admin/brochure/BrochureManager";

export const metadata = {
  title: "Brochure & Catalogue Management | TeaFloww Admin",
  description: "Upload and manage the downloadable tea brochure catalog for website visitors and wholesale partners.",
};

export default function AdminBrochurePage() {
  return (
    <AdminAuthGate>
      <BrochureManager />
    </AdminAuthGate>
  );
}
