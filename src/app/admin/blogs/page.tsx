import React from "react";
import { BlogListTable } from "@/components/admin/content/BlogListTable";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";

export const metadata = {
  title: "Journal & Blog Articles | Admin | Himalayan Tea House",
  description: "Manage editorial articles, single-estate stories, harvest chronicles, and brewing guides.",
};

export default function AdminBlogsPage() {
  return (
    <AdminAuthGate>
      <div className="blogs-page-shell">
        <div className="page-header" style={{ marginBottom: 24 }}>
          <p className="eyebrow">Editorial & Content</p>
          <h1
            className="page-title"
            style={{
              fontSize: "clamp(28px, 3.5vw, 38px)",
              color: "var(--forest, #1d2a24)",
              margin: "4px 0 8px",
            }}
          >
            Journal & Blog Articles
          </h1>
          <p
            className="page-subtitle"
            style={{ color: "#555850", fontSize: 14, margin: 0, maxWidth: 720 }}
          >
            Publish tea connoisseur journal entries, single-estate provenance chronicles, and interactive
            steeping guides for the storefront.
          </p>
        </div>

        <BlogListTable />
      </div>
    </AdminAuthGate>
  );
}
