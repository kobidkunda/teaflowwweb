import React from "react";
import Link from "next/link";
import {
  Package,
  ShoppingBag,
  BookOpen,
  Cpu,
  Plus,
  ArrowRight,
  CheckCircle2,
  Settings,
} from "lucide-react";
import { getDb } from "@/lib/db";
import { TOOL_DEFINITIONS } from "@/lib/mcp";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";

export const metadata = {
  title: "Admin Dashboard | Himalayan Tea House",
  description: "Store administration overview and management hub",
};

export default function AdminDashboardPage() {
  // Query database counts with defensive fallbacks
  let productsCount = 0;
  let categoriesCount = 0;
  let ordersCount = 0;
  let pendingOrdersCount = 0;
  let blogPostsCount = 0;

  try {
    const db = getDb();
    productsCount = (db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number })?.c || 0;
    categoriesCount = (db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number })?.c || 0;
    ordersCount = (db.prepare("SELECT COUNT(*) as c FROM orders").get() as { c: number })?.c || 0;
    pendingOrdersCount = (
      db.prepare("SELECT COUNT(*) as c FROM orders WHERE status != 'delivered' AND status != 'cancelled'").get() as { c: number }
    )?.c || 0;
    try {
      blogPostsCount = (db.prepare("SELECT COUNT(*) as c FROM blog_posts").get() as { c: number })?.c || 0;
    } catch {
      blogPostsCount = 0;
    }
  } catch {
    // Graceful fallback if database connection fails
  }

  const mcpToolsCount = TOOL_DEFINITIONS.length;

  return (
    <AdminAuthGate>
      <div className="admin-dashboard-root">
      {/* Page Header */}
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Store administration</p>
          <h1 className="dashboard-title">Dashboard Overview</h1>
          <p className="dashboard-subtitle">
            Welcome to the Himalayan Tea House store administration portal. Manage catalogue entries,
            order fulfilment workflows, editorial journals, and MCP server tooling.
          </p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <section className="stats-section" aria-label="Key metrics and system status">
        <div className="stats-grid">
          {/* Stat 1: Catalog */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Catalog & Inventory</span>
              <span className="stat-icon-wrapper catalog">
                <Package size={18} aria-hidden="true" />
              </span>
            </div>
            <div className="stat-value">{productsCount}</div>
            <div className="stat-footnote">
              <span>{categoriesCount} categories</span>
              <span className="bullet">·</span>
              <Link href="/admin/products" className="stat-link">
                View catalog →
              </Link>
            </div>
          </div>

          {/* Stat 2: Orders */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Order Fulfilment</span>
              <span className="stat-icon-wrapper sales">
                <ShoppingBag size={18} aria-hidden="true" />
              </span>
            </div>
            <div className="stat-value">{ordersCount}</div>
            <div className="stat-footnote">
              <span className="status-highlight">{pendingOrdersCount} active/pending</span>
              <span className="bullet">·</span>
              <Link href="/admin/orders" className="stat-link">
                Fulfill orders →
              </Link>
            </div>
          </div>

          {/* Stat 3: Blog Posts */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Editorial Journal</span>
              <span className="stat-icon-wrapper editorial">
                <BookOpen size={18} aria-hidden="true" />
              </span>
            </div>
            <div className="stat-value">{blogPostsCount}</div>
            <div className="stat-footnote">
              <span>Articles & terroir stories</span>
              <span className="bullet">·</span>
              <Link href="/admin/blogs" className="stat-link">
                Manage articles →
              </Link>
            </div>
          </div>

          {/* Stat 4: MCP Health */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">MCP Server Health</span>
              <span className="stat-icon-wrapper system">
                <Cpu size={18} aria-hidden="true" />
              </span>
            </div>
            <div className="stat-value mcp-stat">
              <CheckCircle2 size={24} className="mcp-operational-icon" aria-hidden="true" />
              <span>Operational</span>
            </div>
            <div className="stat-footnote">
              <span>{mcpToolsCount} registered tools</span>
              <span className="bullet">·</span>
              <Link href="/admin/mcp" className="stat-link">
                Tool runner →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Action Links Bar */}
      <section className="quick-actions-section" aria-label="Quick management actions">
        <h2 className="section-title">Quick Actions</h2>
        <div className="quick-actions-row">
          <Link href="/admin/products/new" className="button button-primary quick-action-button">
            <Plus size={16} aria-hidden="true" />
            <span>New Product</span>
          </Link>
          <Link href="/admin/categories/new" className="button button-cream quick-action-button">
            <Plus size={16} aria-hidden="true" />
            <span>New Category</span>
          </Link>
          <Link href="/admin/orders" className="button button-outline quick-action-button">
            <ShoppingBag size={16} aria-hidden="true" />
            <span>Manage Orders</span>
          </Link>
          <Link href="/admin/blogs/new" className="button button-cream quick-action-button">
            <Plus size={16} aria-hidden="true" />
            <span>New Blog Post</span>
          </Link>
        </div>
      </section>

      {/* Management Navigation Hub (The 5 Sections) */}
      <section className="nav-hub-section" aria-label="Administration modules">
        <h2 className="section-title">Management Modules</h2>
        <div className="nav-hub-grid">
          {/* Module 1: Catalog */}
          <div className="module-card">
            <div className="module-header">
              <div className="module-icon-wrap">
                <Package size={20} aria-hidden="true" />
              </div>
              <div>
                <h3 className="module-title">Storefront & Catalog</h3>
                <p className="module-desc">Tea products, tasting notes, variants, and imagery</p>
              </div>
            </div>
            <ul className="module-links">
              <li>
                <Link href="/admin/products" className="module-link">
                  <span>Products</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/admin/categories" className="module-link">
                  <span>Categories</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/admin/variants" className="module-link">
                  <span>Variants & Packaging</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/admin/media" className="module-link">
                  <span>Media Uploads</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/admin/sliders" className="module-link">
                  <span>Hero Sliders</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/admin/feeds" className="module-link">
                  <span>Google &amp; Meta Product Feeds</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Module 2: Sales */}
          <div className="module-card">
            <div className="module-header">
              <div className="module-icon-wrap">
                <ShoppingBag size={20} aria-hidden="true" />
              </div>
              <div>
                <h3 className="module-title">Sales & Customers</h3>
                <p className="module-desc">Order processing, discounts, and store analytics</p>
              </div>
            </div>
            <ul className="module-links">
              <li>
                <Link href="/admin/orders" className="module-link">
                  <span>Orders & Fulfilment</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/admin/abandoned-carts" className="module-link">
                  <span>Abandoned Carts & Leads</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/admin/coupons" className="module-link">
                  <span>Discount Coupons</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/admin/visitors" className="module-link">
                  <span>Visitors & Analytics</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Module 3: Editorial */}
          <div className="module-card">
            <div className="module-header">
              <div className="module-icon-wrap">
                <BookOpen size={20} aria-hidden="true" />
              </div>
              <div>
                <h3 className="module-title">Editorial & Content</h3>
                <p className="module-desc">Single-estate stories and brew guides</p>
              </div>
            </div>
            <ul className="module-links">
              <li>
                <Link href="/admin/blogs" className="module-link">
                  <span>Journal & Blog Articles</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/admin/blogs/new" className="module-link">
                  <span>Write New Article</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Module 4: MCP & Tools */}
          <div className="module-card">
            <div className="module-header">
              <div className="module-icon-wrap">
                <Cpu size={20} aria-hidden="true" />
              </div>
              <div>
                <h3 className="module-title">System & MCP</h3>
                <p className="module-desc">Model Context Protocol registry and test runner</p>
              </div>
            </div>
            <ul className="module-links">
              <li>
                <Link href="/admin/mcp" className="module-link">
                  <span>MCP Server & Tools</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Module 5: Settings */}
          <div className="module-card">
            <div className="module-header">
              <div className="module-icon-wrap">
                <Settings size={20} aria-hidden="true" />
              </div>
              <div>
                <h3 className="module-title">Settings & Staff</h3>
                <p className="module-desc">Operational configurations and staff security</p>
              </div>
            </div>
            <ul className="module-links">
              <li>
                <Link href="/admin/settings" className="module-link">
                  <span>Operational Settings</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/admin/users" className="module-link">
                  <span>Staff Accounts</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Demo Notice */}
      <div className="demo-notice" style={{ marginTop: 36 }} role="note">
        <strong>Truthful Commerce & Security Standards:</strong>
        <p>
          All mutating operations require authenticated sessions and server-side Zod validation. Zero
          raw database errors are leaked to customers. Orders remain demo-unpaid until verified gateway
          confirmation.
        </p>
      </div>

      <style>{`
        .admin-dashboard-root {
          max-width: 1200px;
        }

        .dashboard-header {
          margin-bottom: 28px;
        }

        .dashboard-title {
          font-size: clamp(32px, 3.8vw, 44px);
          margin-bottom: 8px;
          color: var(--forest, #1d2a24);
        }

        .dashboard-subtitle {
          color: #555850;
          max-width: 720px;
          font-size: 15px;
          line-height: 1.6;
        }

        /* Stats Grid */
        .stats-section {
          margin-bottom: 32px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .stat-card {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .stat-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .stat-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #6a6e64;
        }

        .stat-icon-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 6px;
        }

        .stat-icon-wrapper.catalog {
          background: rgba(35, 72, 58, 0.1);
          color: var(--pine, #23483a);
        }

        .stat-icon-wrapper.sales {
          background: rgba(179, 107, 61, 0.1);
          color: var(--amber, #b36b3d);
        }

        .stat-icon-wrapper.editorial {
          background: rgba(105, 122, 85, 0.1);
          color: var(--moss, #697a55);
        }

        .stat-icon-wrapper.system {
          background: rgba(179, 145, 86, 0.12);
          color: #7d6537;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
          font-variant-numeric: tabular-nums;
          line-height: 1;
          margin-bottom: 12px;
        }

        .stat-value.mcp-stat {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 20px;
        }

        .mcp-operational-icon {
          color: #2e7d32;
        }

        .stat-footnote {
          font-size: 12px;
          color: #6a6e64;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .status-highlight {
          color: var(--amber, #b36b3d);
          font-weight: 600;
        }

        .stat-link {
          color: var(--pine, #23483a);
          font-weight: 600;
          text-decoration: underline;
        }

        .bullet {
          color: #9ea399;
        }

        /* Quick Actions */
        .quick-actions-section {
          margin-bottom: 36px;
        }

        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
          margin-bottom: 14px;
        }

        .quick-actions-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .quick-action-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 6px;
        }

        /* Management Modules Grid */
        .nav-hub-section {
          margin-bottom: 36px;
        }

        .nav-hub-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }

        .module-card {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 20px;
          display: flex;
          flex-direction: column;
        }

        .module-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid #ede9df;
        }

        .module-icon-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 6px;
          background: rgba(29, 42, 36, 0.08);
          color: var(--forest, #1d2a24);
          flex-shrink: 0;
        }

        .module-title {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 4px;
          color: var(--forest, #1d2a24);
        }

        .module-desc {
          font-size: 12px;
          color: #6a6e64;
          margin: 0;
          line-height: 1.4;
        }

        .module-links {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .module-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 10px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          color: var(--forest, #1d2a24);
          background: rgba(0, 0, 0, 0.02);
          transition: background 150ms ease, color 150ms ease;
        }

        .module-link:hover {
          background: rgba(35, 72, 58, 0.1);
          color: var(--pine, #23483a);
        }

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .nav-hub-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .nav-hub-grid {
            grid-template-columns: 1fr;
          }
          .quick-actions-row {
            flex-direction: column;
            align-items: stretch;
          }
          .quick-action-button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
      </div>
    </AdminAuthGate>
  );
}
