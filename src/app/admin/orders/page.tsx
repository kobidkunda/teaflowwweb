import React from "react";
import { OrderListTable } from "@/components/admin/sales/OrderListTable";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";

export const metadata = {
  title: "Orders & Fulfillment | Admin | Himalayan Tea House",
  description: "Manage orders, dispatch workflows, customer details, and fulfillment state transitions.",
};

export default function AdminOrdersPage() {
  return (
    <AdminAuthGate>
      <div className="orders-page-shell">
        <div className="page-header" style={{ marginBottom: 24 }}>
          <p className="eyebrow">Sales & Customers</p>
          <h1 className="page-title" style={{ fontSize: "clamp(28px, 3.5vw, 38px)", color: "var(--forest, #1d2a24)", margin: "4px 0 8px" }}>
            Orders & Fulfillment
          </h1>
          <p className="page-subtitle" style={{ color: "#555850", fontSize: 14, margin: 0, maxWidth: 720 }}>
            Inspect incoming customer orders, manage sequential fulfillment dispatch transitions, record
            staff packaging notes, and review audit history timelines.
          </p>
        </div>

        <OrderListTable />
      </div>
    </AdminAuthGate>
  );
}
