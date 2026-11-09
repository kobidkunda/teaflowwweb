import React from "react";
import { StoreSettingsForm } from "@/components/admin/settings/StoreSettingsForm";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";

export const metadata = {
  title: "Operational Settings | Himalayan Tea House Admin",
  description: "Configure currency, taxes, flat delivery fees, and free shipping thresholds",
};

export default function AdminSettingsPage() {
  return (
    <AdminAuthGate>
      <StoreSettingsForm />
    </AdminAuthGate>
  );
}
