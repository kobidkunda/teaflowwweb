import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { FunnelAnalyticsClient } from "@/components/admin/funnel/FunnelAnalyticsClient";

export const metadata = {
  title: "Funnel, UTM & Remarketing Attribution | Himalayan Tea House Admin",
  description:
    "Unified first-party UTM, keyword, lead, form, WhatsApp conversation, abandoned cart, and order attribution with remarketing audience exports.",
};

export default function AdminFunnelPage() {
  return (
    <AdminAuthGate>
      <FunnelAnalyticsClient />
    </AdminAuthGate>
  );
}
