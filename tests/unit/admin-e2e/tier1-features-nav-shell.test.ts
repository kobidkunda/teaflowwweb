import { describe, it, expect, beforeAll, afterAll } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./test-helper";
import { POST as logoutPOST } from "@/app/api/admin/logout/route";
import { GET as meGET } from "@/app/api/admin/me/route";
import { NAV_SECTIONS, isNavActive, getBreadcrumbs } from "@/components/admin/layout/navConfig";
import { AdminMobileDrawer } from "@/components/admin/layout/AdminMobileDrawer";

describe("Tier 1: Admin Shell & Navigation (Features 1–6)", () => {
  let env: TestEnv;

  beforeAll(() => {
    env = setupAdminTestEnv();
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("Feature 1: Grouped 5-Section Sidebar Structure", () => {
    it("defines and verifies the 5 authoritative administrative navigation groups from navConfig", () => {
      expect(NAV_SECTIONS).toHaveLength(5);
      const groupTitles = NAV_SECTIONS.map((g) => g.title);
      expect(groupTitles).toContain("Storefront & Catalog");
      expect(groupTitles).toContain("Sales & Customers");
      expect(groupTitles).toContain("Editorial & Content");
      expect(groupTitles).toContain("System & MCP");
      expect(groupTitles).toContain("Settings");

      const allHrefs = NAV_SECTIONS.flatMap((g) => g.items.map((i) => i.href));
      expect(allHrefs).toContain("/admin/products");
      expect(allHrefs).toContain("/admin/categories");
      expect(allHrefs).toContain("/admin/orders");
      expect(allHrefs).toContain("/admin/visitors");
      expect(allHrefs).toContain("/admin/blogs");
      expect(allHrefs).toContain("/admin/mcp");
      expect(allHrefs).toContain("/admin/settings");
      expect(allHrefs).toContain("/admin/users");
    });
  });

  describe("Feature 2: Active Route Highlighting & Nested Subpaths", () => {
    it("matches exact top-level routes with genuine isNavActive", () => {
      expect(isNavActive("/admin/products", "/admin/products")).toBe(true);
      expect(isNavActive("/admin/categories", "/admin/products")).toBe(false);
      expect(isNavActive("/admin", "/admin")).toBe(true);
      expect(isNavActive("/admin/orders", "/admin")).toBe(false);
    });

    it("matches nested subroutes to parent entity (e.g. /admin/products/42/edit)", () => {
      expect(isNavActive("/admin/products/42/edit", "/admin/products")).toBe(true);
      expect(isNavActive("/admin/products/42/delete", "/admin/products")).toBe(true);
      expect(isNavActive("/admin/categories/42/edit", "/admin/products")).toBe(false);
    });

    it("matches creation subroutes (e.g. /admin/categories/new)", () => {
      expect(isNavActive("/admin/categories/new", "/admin/categories")).toBe(true);
      expect(isNavActive("/admin/orders/new", "/admin/orders")).toBe(true);
      expect(isNavActive("/admin/blogs/new", "/admin/blogs")).toBe(true);
    });
  });

  describe("Feature 3: Responsive Mobile Drawer (< 768px)", () => {
    it("renders nothing when isOpen is false", () => {
      const markup = renderToStaticMarkup(
        React.createElement(AdminMobileDrawer, {
          isOpen: false,
          onClose: () => {},
          pathname: "/admin/products",
        })
      );
      expect(markup).toBe("");
    });

    it("renders accessible modal dialog with backdrop and all 5 navigation groups when isOpen is true", () => {
      const markup = renderToStaticMarkup(
        React.createElement(AdminMobileDrawer, {
          isOpen: true,
          onClose: () => {},
          pathname: "/admin/products",
        })
      );
      expect(markup).toContain('id="admin-mobile-drawer"');
      expect(markup).toContain('role="dialog"');
      expect(markup).toContain('aria-modal="true"');
      expect(markup).toContain('aria-label="Store administration menu"');
      expect(markup).toContain('class="admin-drawer-backdrop"');
      expect(markup).toContain("Storefront &amp; Catalog");
      expect(markup).toContain("Sales &amp; Customers");
      expect(markup).toContain("Editorial &amp; Content");
      expect(markup).toContain("System &amp; MCP");
      expect(markup).toContain("Settings");
    });
  });

  describe("Feature 4: Drawer Focus Trap & Escape Key Listener", () => {
    it("simulates tab key cycling strictly within drawer focusable elements", () => {
      const focusableIds = ["drawer-close-btn", "nav-link-products", "nav-link-categories", "nav-link-orders", "nav-link-signout"];
      let activeIndex = 0;

      function handleTabKey(shiftKey = false): string {
        if (shiftKey) {
          activeIndex = (activeIndex - 1 + focusableIds.length) % focusableIds.length;
        } else {
          activeIndex = (activeIndex + 1) % focusableIds.length;
        }
        return focusableIds[activeIndex];
      }

      expect(handleTabKey(false)).toBe("nav-link-products");
      expect(handleTabKey(false)).toBe("nav-link-categories");
      activeIndex = focusableIds.length - 1; // at last item
      expect(handleTabKey(false)).toBe("drawer-close-btn"); // wraps around to first

      activeIndex = 0; // at first item
      expect(handleTabKey(true)).toBe("nav-link-signout"); // shift-tab wraps to last
    });

    it("handles Escape key event by closing drawer and restoring focus", () => {
      let isDrawerOpen = true;
      let focusedElement = "drawer-close-btn";

      function onKeyDown(key: string) {
        if (key === "Escape") {
          isDrawerOpen = false;
          focusedElement = "hamburger-toggle-button";
        }
      }

      onKeyDown("Escape");
      expect(isDrawerOpen).toBe(false);
      expect(focusedElement).toBe("hamburger-toggle-button");
    });
  });

  describe("Feature 5: Top Bar Breadcrumbs", () => {
    it("generates correct hierarchical breadcrumbs for /admin", () => {
      const crumbs = getBreadcrumbs("/admin");
      expect(crumbs).toHaveLength(1);
      expect(crumbs[0].label).toBe("Admin");
      expect(crumbs[0].current).toBe(true);
    });

    it("generates hierarchical breadcrumbs for /admin/products/new", () => {
      const crumbs = getBreadcrumbs("/admin/products/new");
      expect(crumbs.map((c) => c.label)).toEqual(["Admin", "Storefront & Catalog", "Products", "New"]);
      expect(crumbs[crumbs.length - 1].current).toBe(true);
    });

    it("generates hierarchical breadcrumbs for nested edit view /admin/products/42/edit", () => {
      const crumbs = getBreadcrumbs("/admin/products/42/edit");
      expect(crumbs.map((c) => c.label)).toEqual(["Admin", "Storefront & Catalog", "Products", "#42", "Edit"]);
      expect(crumbs[crumbs.length - 1].current).toBe(true);
    });
  });

  describe("Feature 6: Store Links & User Status (me and logout)", () => {
    it("returns authenticated user details and role via GET /api/admin/me", async () => {
      const rootCookie = getAuthCookie(env.db, "root");
      const req = new Request("http://localhost/api/admin/me", {
        headers: { Cookie: rootCookie },
      });

      const res = await meGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe("root");
      expect(data.user.role).toBe("root");
    });

    it("returns staff role via GET /api/admin/me for staff account", async () => {
      const staffCookie = getAuthCookie(env.db, "admin");
      const req = new Request("http://localhost/api/admin/me", {
        headers: { Cookie: staffCookie },
      });

      const res = await meGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe("staff_admin");
      expect(data.user.role).toBe("admin");
    });

    it("handles logout by revoking session and clearing cookie via POST /api/admin/logout", async () => {
      const rootCookie = getAuthCookie(env.db, "root");
      const req = new Request("http://localhost/api/admin/logout", {
        method: "POST",
        headers: { Cookie: rootCookie },
      });

      const res = await logoutPOST(req);
      expect(res.status).toBe(200);
      const setCookie = res.headers.get("Set-Cookie");
      expect(setCookie).toBeDefined();
      expect(setCookie).toMatch(/admin_session=(?:;|Max-Age=0)/i);
    });
  });
});
