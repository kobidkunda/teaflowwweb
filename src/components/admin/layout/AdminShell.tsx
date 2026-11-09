"use client";

import React, { useState, useEffect, useRef } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";
import { AdminMobileDrawer } from "./AdminMobileDrawer";
import { useAdminAuth } from "./AdminAuthContext";

export interface AdminShellProps {
  children?: React.ReactNode;
  initialCollapsed?: boolean;
}

export function AdminShell({ children, initialCollapsed = false }: AdminShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const auth = useAdminAuth();
  const [fallbackUser, setFallbackUser] = useState<{ username: string; role: string } | null>(null);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);

  // If rendered outside AdminAuthProvider (standalone component/test), check session locally
  useEffect(() => {
    if (auth.isProviderReady) return;
    let mounted = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/admin/me", { credentials: "same-origin" });
        if (mounted && res.ok) {
          const data = (await res.json()) as { user?: { username?: string; role?: string } };
          if (data.user) {
            setFallbackUser({
              username: data.user.username || "admin",
              role: data.user.role || "admin",
            });
          }
        }
      } catch {
        // Not authenticated
      }
    }
    void checkAuth();
    return () => {
      mounted = false;
    };
  }, [auth.isProviderReady]);

  const user = auth.isProviderReady ? auth.user : fallbackUser;

  return (
    <div className={`admin-shell-root ${isCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}>
      {/* Desktop Sidebar (Collapsible 260px / 72px) */}
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Main Column */}
      <div
        className="admin-main-wrapper"
        style={{
          marginLeft: isCollapsed ? 72 : 260,
        }}
      >
        {/* Top Navigation Bar */}
        <AdminTopBar
          onToggleMobile={() => setIsMobileOpen(true)}
          isMobileOpen={isMobileOpen}
          user={user}
          hamburgerRef={hamburgerRef}
        />

        {/* Main Content Area */}
        <div id="admin-main-content" className="admin-content-canvas">
          {children}
        </div>
      </div>

      {/* Mobile Drawer Navigation (< 768px) with Focus Trap */}
      <AdminMobileDrawer
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        triggerRef={hamburgerRef}
      />

      {/* Admin Shell Styles & Design Tokens */}
      <style>{`
        :root {
          --admin-sidebar-bg: #1d2a24;
          --admin-sidebar-text: #e6ebe5;
          --admin-sidebar-active: #23483a;
          --admin-sidebar-accent: #b39156;
          --admin-topbar-bg: #fbf8f1;
          --admin-border: #d9d4c8;
          --admin-table-header: #ede9df;
          --admin-status-success: #23483a;
          --admin-status-warning: #9e6428;
          --admin-status-danger: #8f2f2a;
        }

        .admin-shell-root {
          display: flex;
          min-height: 100vh;
          background: var(--paper, #f6f1e7);
          color: var(--ink, #171713);
          position: relative;
          box-sizing: border-box;
          max-width: 100vw;
          overflow-x: hidden;
        }

        /* Sidebar Desktop */
        .admin-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          background: var(--admin-sidebar-bg, #1d2a24);
          color: var(--admin-sidebar-text, #e6ebe5);
          display: flex;
          flex-direction: column;
          z-index: 30;
          transition: width 200ms ease, min-width 200ms ease;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          overflow-y: auto;
          overflow-x: hidden;
        }

        .admin-sidebar-header {
          padding: 18px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          min-height: 64px;
        }

        .admin-brand-link {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: inherit;
        }

        .admin-brand-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--admin-sidebar-accent, #b39156);
          flex-shrink: 0;
        }

        .admin-brand-text {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
        }

        .admin-brand-title {
          font-family: Georgia, serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #ffffff;
        }

        .admin-brand-subtitle {
          font-size: 8px;
          letter-spacing: 0.16em;
          color: #aeb7aa;
          margin-top: 2px;
        }

        .admin-sidebar-nav {
          flex: 1;
          padding: 16px 8px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .admin-nav-group-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #8c9b88;
          padding: 6px 12px;
          margin-bottom: 2px;
        }

        .admin-nav-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .admin-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 12px;
          border-radius: 6px;
          color: var(--admin-sidebar-text, #e6ebe5);
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          min-height: 40px;
          transition: background 150ms ease, color 150ms ease, border-left-color 150ms ease;
          border-left: 3px solid transparent;
        }

        .admin-nav-item:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
        }

        .admin-nav-item.active {
          background: rgba(35, 72, 58, 0.7);
          color: #ffffff;
          font-weight: 600;
          border-left-color: var(--admin-sidebar-accent, #b39156);
        }

        .admin-nav-icon {
          flex-shrink: 0;
        }

        .admin-nav-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-sidebar-footer {
          padding: 12px 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .admin-collapse-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          color: #aeb7aa;
          font-size: 12px;
          cursor: pointer;
          min-height: 40px;
          transition: background 150ms ease, color 150ms ease;
        }

        .admin-collapse-toggle:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        /* Top Bar */
        .admin-main-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          transition: margin-left 200ms ease;
        }

        .admin-topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          background: var(--admin-topbar-bg, #fbf8f1);
          border-bottom: 1px solid var(--admin-border, #d9d4c8);
          height: 64px;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .admin-topbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .admin-hamburger {
          display: none;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          padding: 8px;
          color: var(--forest, #1d2a24);
          cursor: pointer;
          min-height: 40px;
          min-width: 40px;
        }

        .admin-breadcrumbs {
          display: flex;
          align-items: center;
          font-size: 13px;
          min-width: 0;
        }

        .breadcrumb-list {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .breadcrumb-item {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #63665e;
        }

        .breadcrumb-separator {
          color: #9ea399;
        }

        .breadcrumb-link {
          color: inherit;
          text-decoration: none;
        }

        .breadcrumb-link:hover {
          color: var(--amber, #b36b3d);
          text-decoration: underline;
        }

        .breadcrumb-current {
          color: var(--forest, #1d2a24);
          font-weight: 600;
        }

        .admin-topbar-right {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;
        }

        .store-quick-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--pine, #23483a);
          text-decoration: none;
          padding: 6px 10px;
          border-radius: 4px;
          background: rgba(35, 72, 58, 0.08);
          transition: background 150ms ease;
        }

        .store-quick-link:hover {
          background: rgba(35, 72, 58, 0.15);
        }

        .admin-user-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #555850;
        }

        .admin-role-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          background: #ede9df;
          color: var(--forest, #1d2a24);
          border: 1px solid #d9d4c8;
        }

        .admin-role-badge.role-root {
          background: rgba(179, 145, 86, 0.2);
          border-color: #b39156;
          color: #6d531d;
        }

        .admin-signout-form {
          margin: 0;
        }

        .admin-signout-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 36px;
          padding: 6px 14px;
          font-size: 12px;
        }

        /* Content Canvas */
        .admin-content-canvas {
          padding: 28px 32px;
          max-width: 1440px;
          width: 100%;
          box-sizing: border-box;
        }

        /* Mobile Drawer */
        .admin-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(23, 23, 19, 0.55);
          backdrop-filter: blur(4px);
          z-index: 90;
        }

        .admin-mobile-drawer {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: min(320px, 85vw);
          background: var(--admin-sidebar-bg, #1d2a24);
          color: var(--admin-sidebar-text, #e6ebe5);
          z-index: 100;
          display: flex;
          flex-direction: column;
          box-shadow: 4px 0 24px rgba(0, 0, 0, 0.35);
          overflow-y: auto;
        }

        .admin-drawer-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .admin-drawer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #ffffff;
          font-weight: 700;
          font-size: 14px;
        }

        .admin-drawer-close {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          border-radius: 6px;
          padding: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          min-width: 36px;
        }

        .admin-drawer-nav {
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .admin-drawer-group-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #8c9b88;
          padding: 4px 10px;
          margin-bottom: 2px;
        }

        .admin-drawer-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        /* Screen Reader Only Utility */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        /* Responsive Breakpoints */
        @media (max-width: 767px) {
          .admin-sidebar {
            display: none !important;
          }
          .admin-main-wrapper {
            margin-left: 0 !important;
            width: 100% !important;
            max-width: 100vw !important;
          }
          .admin-hamburger {
            display: inline-flex !important;
          }
          .admin-topbar {
            padding: 0 16px;
          }
          .admin-content-canvas {
            padding: 20px 16px;
          }
          .store-quick-link span {
            display: none;
          }
          .admin-user-name {
            display: none;
          }
        }

        @media (min-width: 768px) {
          .admin-hamburger {
            display: none !important;
          }
          .admin-drawer-backdrop,
          .admin-mobile-drawer {
            display: none !important;
          }
        }

        /* Prefers-reduced-motion compliance */
        @media (prefers-reduced-motion: reduce) {
          .admin-sidebar,
          .admin-main-wrapper,
          .admin-nav-item,
          .admin-collapse-toggle,
          .admin-mobile-drawer {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
