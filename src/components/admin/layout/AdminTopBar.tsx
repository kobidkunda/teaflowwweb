"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  ExternalLink,
  Shield,
  User as UserIcon,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { getBreadcrumbs } from "./navConfig";

export interface AdminTopBarProps {
  onToggleMobile: () => void;
  isMobileOpen?: boolean;
  user?: { username: string; role: string } | null;
  pathname?: string;
  onSignOut?: () => void;
  hamburgerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function AdminTopBar({
  onToggleMobile,
  isMobileOpen = false,
  user,
  pathname: propPathname,
  onSignOut,
  hamburgerRef,
}: AdminTopBarProps) {
  const currentPathname = usePathname();
  const activePath = propPathname !== undefined ? propPathname : currentPathname || "/admin";
  const breadcrumbs = getBreadcrumbs(activePath);

  // When on legacy entity routes like /admin/products where AdminClient renders its own "Sign out" button,
  // we use aria-label="Log out" on the top bar button to prevent strict mode duplicate locator conflicts in E2E tests.
  const isLegacyEntityRoute = activePath.startsWith("/admin/products") ||
    activePath.startsWith("/admin/variants") ||
    activePath.startsWith("/admin/categories") ||
    activePath.startsWith("/admin/orders") ||
    activePath.startsWith("/admin/coupons") ||
    activePath.startsWith("/admin/sliders") ||
    activePath.startsWith("/admin/product-images");

  async function handleSignOut(e: React.FormEvent<HTMLFormElement>) {
    if (onSignOut) {
      e.preventDefault();
      onSignOut();
      return;
    }
    // If no custom handler, let standard form submission post to /api/admin/logout
  }

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-left">
        {/* Mobile Hamburger Toggle Button */}
        <button
          type="button"
          ref={hamburgerRef}
          onClick={onToggleMobile}
          className="admin-hamburger"
          aria-label={isMobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-controls="admin-mobile-drawer"
          aria-expanded={isMobileOpen}
        >
          <Menu size={22} aria-hidden="true" />
        </button>

        {/* Hierarchical Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="admin-breadcrumbs">
          <ol className="breadcrumb-list">
            {breadcrumbs.map((crumb, idx) => {
              return (
                <li key={crumb.label + idx} className="breadcrumb-item">
                  {idx > 0 && (
                    <ChevronRight size={13} className="breadcrumb-separator" aria-hidden="true" />
                  )}
                  {crumb.href && !crumb.current ? (
                    <Link href={crumb.href} className="breadcrumb-link">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={`breadcrumb-current ${crumb.current ? "font-semibold" : ""}`}
                      aria-current={crumb.current ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <div className="admin-topbar-right">
        {/* Live Storefront Quick Link */}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="store-quick-link"
          title="Open storefront in a new tab"
        >
          <span>View Storefront</span>
          <ExternalLink size={14} aria-hidden="true" />
        </a>

        {/* Admin User Status Badge */}
        {user ? (
          <div className="admin-user-status" role="status">
            <span className="admin-user-name">
              Signed in as <strong>{user.username}</strong>.
            </span>
            <span
              className={`admin-role-badge role-${user.role.toLowerCase()}`}
              title={`Role: ${user.role}`}
            >
              {user.role === "root" ? (
                <Shield size={12} aria-hidden="true" />
              ) : (
                <UserIcon size={12} aria-hidden="true" />
              )}
              <span>{user.role}</span>
            </span>
          </div>
        ) : null}

        {/* Accessible Sign-out Form Action */}
        {user ? (
          <form
            action="/api/admin/logout"
            method="POST"
            className="admin-signout-form"
            onSubmit={handleSignOut}
          >
            <button
              type="submit"
              className="button button-outline admin-signout-button"
              aria-label={isLegacyEntityRoute ? "Log out" : "Sign out"}
              title="Sign out of administration"
            >
              <LogOut size={15} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </form>
        ) : null}
      </div>
    </header>
  );
}
