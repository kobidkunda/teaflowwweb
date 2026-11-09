import React from "react";
import { AbandonedCartsClient } from "@/components/admin/AbandonedCartsClient";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";

export const metadata = {
  title: "Abandoned Carts & Visitor Leads | Admin | Himalayan Tea House",
  description: "Track abandoned shopping bags, captured mobile numbers, client browser fingerprints, and 1-click WhatsApp recovery.",
};

export default function AdminAbandonedCartsPage() {
  return (
    <AdminAuthGate>
      <div className="abandoned-carts-page-shell">
        <div className="page-header" style={{ marginBottom: 24 }}>
          <p className="eyebrow">Sales & Customers</p>
          <h1 className="page-title" style={{ fontSize: "clamp(26px, 3.2vw, 36px)", color: "var(--forest, #1d2a24)", margin: "4px 0 8px", fontWeight: 700 }}>
            Abandoned Carts & Visitor Leads
          </h1>
          <p className="page-subtitle" style={{ color: "#555850", fontSize: 14, margin: 0, maxWidth: 740 }}>
            Real-time intelligence on customer shopping bags, captured high-intent mobile numbers, client-side
            device fingerprints, IP location data, and 1-click WhatsApp cart recovery messaging.
          </p>
        </div>

        <AbandonedCartsClient />
      </div>
    </AdminAuthGate>
  );
}
