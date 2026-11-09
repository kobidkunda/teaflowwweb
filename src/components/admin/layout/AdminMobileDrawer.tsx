"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  SIDEBAR_NAV_GROUPS,
  OVERVIEW_ITEM,
  isNavActive,
} from "./navConfig";

export interface AdminMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  pathname?: string;
}

export function AdminMobileDrawer({
  isOpen,
  onClose,
  triggerRef,
  pathname: propPathname,
}: AdminMobileDrawerProps) {
  const currentPathname = usePathname();
  const activePath = propPathname !== undefined ? propPathname : currentPathname || "/admin";

  const drawerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Body scroll lock & Focus trap implementation (WCAG 2.2 AA compliant)
  useEffect(() => {
    if (!isOpen) return;

    // 1. Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 2. Focus close button on open
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    // 3. Trap keyboard focus and handle Escape
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        triggerRef?.current?.focus();
        return;
      }

      if (e.key === "Tab") {
        const container = drawerRef.current;
        if (!container) return;

        const focusableSelector =
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(
          container.querySelectorAll<HTMLElement>(focusableSelector)
        ).filter((el) => el.offsetParent !== null || el === closeButtonRef.current);

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) {
    return null;
  }

  const isOverviewActive = isNavActive(activePath, OVERVIEW_ITEM.href);
  const OverviewIcon = OVERVIEW_ITEM.icon;

  return (
    <>
      {/* Dark Backdrop with Backdrop-Filter Blur */}
      <div
        className="admin-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Accessible Dialog Container */}
      <aside
        id="admin-mobile-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Store administration menu"
        className="admin-mobile-drawer"
      >
        <div className="admin-drawer-header">
          <div className="admin-drawer-brand">
            <BrandLogo variant="symbol-gold" size={22} aria-hidden={true} className="admin-brand-icon" />
            <span className="admin-drawer-title">Admin Navigation</span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => {
              onClose();
              triggerRef?.current?.focus();
            }}
            className="admin-drawer-close"
            aria-label="Close navigation menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="admin-drawer-nav" aria-label="Admin mobile navigation">
          {/* Overview link */}
          <div className="admin-drawer-section">
            <Link
              href={OVERVIEW_ITEM.href}
              onClick={onClose}
              className={isOverviewActive ? "admin-nav-item active" : "admin-nav-item"}
              aria-current={isOverviewActive ? "page" : undefined}
            >
              <OverviewIcon size={18} className="admin-nav-icon" aria-hidden="true" />
              <span className="admin-nav-label">{OVERVIEW_ITEM.label}</span>
            </Link>
          </div>

          {/* 5 Distinct Grouped Sections */}
          {SIDEBAR_NAV_GROUPS.map((group) => (
            <div key={group.id} className="admin-drawer-group" role="group" aria-label={group.title}>
              <div className="admin-drawer-group-title">{group.title}</div>
              <ul className="admin-drawer-list">
                {group.items.map((item) => {
                  const isActive = isNavActive(activePath, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href} className="admin-drawer-list-item">
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={isActive ? "admin-nav-item active" : "admin-nav-item"}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon size={18} className="admin-nav-icon" aria-hidden="true" />
                        <span className="admin-nav-label">{item.label}</span>
                        {item.badge && <span className="admin-nav-badge">{item.badge}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
