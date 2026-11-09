import React from "react";
import { ShippingSettingsForm } from "@/components/admin/settings/ShippingSettingsForm";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";

export const metadata = {
  title: "Shipping & Delivery Settings | Admin | TeaFloww",
  description: "Configure free shipping thresholds (₹599), flat delivery fees, and Shiprocket carrier automation.",
};

export default function AdminShippingSettingsPage() {
  return (
    <AdminAuthGate>
      <div className="shipping-settings-shell">
        <ShippingSettingsForm />
      </div>
    </AdminAuthGate>
  );
}
