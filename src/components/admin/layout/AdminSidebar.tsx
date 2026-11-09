"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  SIDEBAR_NAV_GROUPS,
  OVERVIEW_ITEM,
  isNavActive,
} from "./navConfig";

export interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  pathname?: string;
}

export function AdminSidebar({
  isCollapsed,
  onToggleCollapse,
  pathname: propPathname,
}: AdminSidebarProps) {
  const currentPathname = usePathname();
  const activePath = propPathname !== undefined ? propPathname : currentPathname || "/admin";

  const isOverviewActive = isNavActive(activePath, OVERVIEW_ITEM.href);
  const OverviewIcon = OVERVIEW_ITEM.icon;

  return (
    <aside
      className={`admin-sidebar ${isCollapsed ? "collapsed" : "expanded"}`}
      aria-label="Admin side navigation"
      style={{
        width: isCollapsed ? 72 : 260,
        minWidth: isCollapsed ? 72 : 260,
      }}
    >
      <div className="admin-sidebar-header">
        <Link href="/admin" className="admin-brand-link" aria-label="Teafloww Admin Console">
          <span className="admin-brand-icon" aria-hidden="true">
            <BrandLogo variant="symbol-gold" size={24} aria-hidden={true} />
          </span>
          {!isCollapsed && (
            <div className="admin-brand-text">
              <span className="admin-brand-title">TEAFLOWW</span>
              <span className="admin-brand-subtitle">ADMIN CONSOLE</span>
            </div>
          )}
        </Link>
      </div>

      <nav className="admin-sidebar-nav" aria-label="Admin main navigation">
        {/* Overview Link */}
        <div className="admin-nav-section admin-overview-section">
          <Link
            href={OVERVIEW_ITEM.href}
            className={isOverviewActive ? "admin-nav-item active" : "admin-nav-item"}
            aria-current={isOverviewActive ? "page" : undefined}
            title={isCollapsed ? OVERVIEW_ITEM.label : undefined}
          >
            <OverviewIcon size={19} className="admin-nav-icon" aria-hidden="true" />
            {!isCollapsed ? (
              <span className="admin-nav-label">{OVERVIEW_ITEM.label}</span>
            ) : (
              <span className="sr-only">{OVERVIEW_ITEM.label}</span>
            )}
          </Link>
        </div>

        {/* 5 Distinct Grouped Navigation Sections */}
        {SIDEBAR_NAV_GROUPS.map((group) => {
          return (
            <div key={group.id} className="admin-nav-group" role="group" aria-label={group.title}>
              <div className="admin-nav-group-title">
                {!isCollapsed ? (
                  <span>{group.title}</span>
                ) : (
                  <span className="sr-only">{group.title}</span>
                )}
              </div>
              <ul className="admin-nav-list">
                {group.items.map((item) => {
                  const isActive = isNavActive(activePath, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href} className="admin-nav-list-item">
                      <Link
                        href={item.href}
                        className={isActive ? "admin-nav-item active" : "admin-nav-item"}
                        aria-current={isActive ? "page" : undefined}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <Icon size={18} className="admin-nav-icon" aria-hidden="true" />
                        {!isCollapsed ? (
                          <span className="admin-nav-label">{item.label}</span>
                        ) : (
                          <span className="sr-only">{item.label}</span>
                        )}
                        {item.badge && !isCollapsed && (
                          <span className="admin-nav-badge">{item.badge}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Sidebar Collapse Toggle */}
      <div className="admin-sidebar-footer">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="admin-collapse-toggle"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight size={18} aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft size={18} aria-hidden="true" />
              <span className="admin-collapse-text">Collapse sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
