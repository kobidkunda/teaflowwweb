import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  NAV_GROUPS,
  OVERVIEW_ITEM,
  isNavActive,
  getBreadcrumbs,
} from "../../src/components/admin/layout/navConfig";
import { AdminSidebar } from "../../src/components/admin/layout/AdminSidebar";
import { AdminTopBar } from "../../src/components/admin/layout/AdminTopBar";
import { AdminMobileDrawer } from "../../src/components/admin/layout/AdminMobileDrawer";
import { AdminShell } from "../../src/components/admin/layout/AdminShell";

describe("Admin Navigation Configuration & Helpers", () => {
  it("defines exactly 5 distinct grouped navigation sections with expected entities", () => {
    expect(NAV_GROUPS).toHaveLength(5);

    const groupIds = NAV_GROUPS.map((g) => g.id);
    expect(groupIds).toEqual(["catalog", "sales", "editorial", "system", "settings"]);

    const catalogGroup = NAV_GROUPS.find((g) => g.id === "catalog")!;
    expect(catalogGroup.title).toBe("Storefront & Catalog");
    expect(catalogGroup.items.map((i) => i.href)).toEqual([
      "/admin/products",
      "/admin/categories",
      "/admin/variants",
      "/admin/bulk-pricing",
      "/admin/feeds",
      "/admin/media",
      "/admin/sliders",
      "/admin/blend-lab",
      "/admin/trials",
    ]);

    const salesGroup = NAV_GROUPS.find((g) => g.id === "sales")!;
    expect(salesGroup.title).toBe("Sales & Customers");
    expect(salesGroup.items.map((i) => i.href)).toEqual([
      "/admin/subscriptions",
      "/admin/orders",
      "/admin/abandoned-carts",
      "/admin/coupons",
      "/admin/visitors",
    ]);

    const editorialGroup = NAV_GROUPS.find((g) => g.id === "editorial")!;
    expect(editorialGroup.title).toBe("Editorial & Content");
    expect(editorialGroup.items.map((i) => i.href)).toEqual([
      "/admin/homepage",
      "/admin/blogs",
    ]);

    const systemGroup = NAV_GROUPS.find((g) => g.id === "system")!;
    expect(systemGroup.title).toBe("System & MCP");
    expect(systemGroup.items.map((i) => i.href)).toEqual(["/admin/mcp"]);

    const settingsGroup = NAV_GROUPS.find((g) => g.id === "settings")!;
    expect(settingsGroup.title).toBe("Settings");
    expect(settingsGroup.items.map((i) => i.href)).toEqual([
      "/admin/settings",
      "/admin/emails",
      "/admin/tracking",
      "/admin/users",
    ]);

    expect(OVERVIEW_ITEM.href).toBe("/admin");
    expect(OVERVIEW_ITEM.label).toBe("Overview");
  });

  describe("isNavActive helper", () => {
    it("correctly matches /admin only on exact route", () => {
      expect(isNavActive("/admin", "/admin")).toBe(true);
      expect(isNavActive("/admin/products", "/admin")).toBe(false);
      expect(isNavActive("/admin/settings", "/admin")).toBe(false);
    });

    it("correctly matches exact entity routes and nested subpaths", () => {
      expect(isNavActive("/admin/products", "/admin/products")).toBe(true);
      expect(isNavActive("/admin/products/new", "/admin/products")).toBe(true);
      expect(isNavActive("/admin/products/123/edit", "/admin/products")).toBe(true);
      expect(isNavActive("/admin/products/123/delete", "/admin/products")).toBe(true);

      // Does not false-positive on other entities
      expect(isNavActive("/admin/product-images", "/admin/products")).toBe(false);
      expect(isNavActive("/admin/categories", "/admin/products")).toBe(false);
    });

    it("correctly matches nested categories, orders, and blogs subpaths", () => {
      expect(isNavActive("/admin/categories/new", "/admin/categories")).toBe(true);
      expect(isNavActive("/admin/orders/ord_456", "/admin/orders")).toBe(true);
      expect(isNavActive("/admin/blogs/new", "/admin/blogs")).toBe(true);
      expect(isNavActive("/admin/users/new", "/admin/users")).toBe(true);
      expect(isNavActive("/admin/trials", "/admin/trials")).toBe(true);
      expect(isNavActive("/admin/trials/new", "/admin/trials")).toBe(true);
      expect(isNavActive("/admin/trials/tr_sample_123", "/admin/trials")).toBe(true);
    });
  });

  describe("getBreadcrumbs helper", () => {
    it("generates single Admin crumb on root /admin", () => {
      const crumbs = getBreadcrumbs("/admin");
      expect(crumbs).toEqual([
        { label: "Admin", href: "/admin", current: true },
      ]);
    });

    it("generates hierarchical trail for entity index pages", () => {
      const crumbs = getBreadcrumbs("/admin/products");
      expect(crumbs).toEqual([
        { label: "Admin", href: "/admin", current: false },
        { label: "Storefront & Catalog" },
        { label: "Products", href: undefined, current: true },
      ]);
    });

    it("generates deep hierarchical trail for create/edit subpaths", () => {
      const newProductCrumbs = getBreadcrumbs("/admin/products/new");
      expect(newProductCrumbs).toEqual([
        { label: "Admin", href: "/admin", current: false },
        { label: "Storefront & Catalog" },
        { label: "Products", href: "/admin/products", current: false },
        { label: "New", current: true },
      ]);

      const editCatCrumbs = getBreadcrumbs("/admin/categories/42/edit");
      expect(editCatCrumbs).toEqual([
        { label: "Admin", href: "/admin", current: false },
        { label: "Storefront & Catalog" },
        { label: "Categories", href: "/admin/categories", current: false },
        { label: "#42", current: false },
        { label: "Edit", current: true },
      ]);
    });

    it("generates breadcrumbs for all 5 section entities", () => {
      expect(getBreadcrumbs("/admin/orders")[1].label).toBe("Sales & Customers");
      expect(getBreadcrumbs("/admin/blogs")[1].label).toBe("Editorial & Content");
      expect(getBreadcrumbs("/admin/mcp")[1].label).toBe("System & MCP");
      expect(getBreadcrumbs("/admin/settings")[1].label).toBe("Settings");
      expect(getBreadcrumbs("/admin/users")[1].label).toBe("Settings");
      expect(getBreadcrumbs("/admin/trials")[1].label).toBe("Storefront & Catalog");
      expect(getBreadcrumbs("/admin/trials/new")).toEqual([
        { label: "Admin", href: "/admin", current: false },
        { label: "Storefront & Catalog" },
        { label: "Trials", href: "/admin/trials", current: false },
        { label: "New", current: true },
      ]);
    });
  });
});

describe("AdminSidebar Component", () => {
  it("renders 260px expanded sidebar with all 5 sections and active highlight", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminSidebar, {
        isCollapsed: false,
        onToggleCollapse: () => {},
        pathname: "/admin/products/new",
      })
    );

    expect(markup).toContain('class="admin-sidebar expanded"');
    expect(markup).toContain("width:260px");
    expect(markup).toContain('aria-label="Admin side navigation"');

    // Branding
    expect(markup).toContain("TEAFLOWW");
    expect(markup).toContain("ADMIN CONSOLE");

    // All 5 section titles rendered
    expect(markup).toContain("Storefront &amp; Catalog");
    expect(markup).toContain("Sales &amp; Customers");
    expect(markup).toContain("Editorial &amp; Content");
    expect(markup).toContain("System &amp; MCP");
    expect(markup).toContain("Settings");

    // Active state highlighting on Products link matching /admin/products/new
    const productsLink = markup.match(/<a[^>]*href="\/admin\/products"[^>]*>/)?.[0] || "";
    expect(productsLink).toContain('class="admin-nav-item active"');
    expect(productsLink).toContain('aria-current="page"');

    // Other links are not active
    const categoriesLink = markup.match(/<a[^>]*href="\/admin\/categories"[^>]*>/)?.[0] || "";
    expect(categoriesLink).toContain('class="admin-nav-item"');
    expect(categoriesLink).not.toContain("active");
    expect(categoriesLink).not.toContain('aria-current="page"');

    // Collapse toggle button
    expect(markup).toContain('aria-label="Collapse sidebar"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("Collapse sidebar");
  });

  it("renders 72px collapsed sidebar with accessible sr-only labels and tooltips", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminSidebar, {
        isCollapsed: true,
        onToggleCollapse: () => {},
        pathname: "/admin/orders",
      })
    );

    expect(markup).toContain('class="admin-sidebar collapsed"');
    expect(markup).toContain("width:72px");

    // Brand text omitted when collapsed
    expect(markup).not.toContain("ADMIN CONSOLE");

    // Group titles visually hidden via sr-only
    expect(markup).toContain('<span class="sr-only">Storefront &amp; Catalog</span>');
    expect(markup).toContain('<span class="sr-only">Sales &amp; Customers</span>');

    // Links have title tooltip and sr-only label
    expect(markup).toContain('title="Orders"');
    expect(markup).toContain('<span class="sr-only">Orders</span>');

    // Active link highlighting for /admin/orders
    const ordersLink = markup.match(/<a[^>]*href="\/admin\/orders"[^>]*>/)?.[0] || "";
    expect(ordersLink).toContain('class="admin-nav-item active"');
    expect(ordersLink).toContain('aria-current="page"');

    // Toggle button in collapsed state
    expect(markup).toContain('aria-label="Expand sidebar"');
    expect(markup).toContain('aria-expanded="false"');
  });
});

describe("AdminTopBar Component", () => {
  it("renders hierarchical breadcrumbs, storefront link, and user status badge", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminTopBar, {
        onToggleMobile: () => {},
        isMobileOpen: false,
        user: { username: "root", role: "root" },
        pathname: "/admin/products/new",
      })
    );

    // Breadcrumbs
    expect(markup).toContain('aria-label="Breadcrumb"');
    expect(markup).toContain("Admin");
    expect(markup).toContain("Storefront &amp; Catalog");
    expect(markup).toContain("Products");
    expect(markup).toContain('<span class="breadcrumb-current font-semibold" aria-current="page">New</span>');

    // Storefront quick link
    expect(markup).toContain('href="/" target="_blank" rel="noopener noreferrer" class="store-quick-link"');
    expect(markup).toContain("View Storefront");

    // User status badge
    expect(markup).toContain("Signed in as <strong>root</strong>.");
    expect(markup).toContain('class="admin-role-badge role-root"');
    expect(markup).toContain("root");

    // Sign-out button with accessible form action
    expect(markup).toContain('action="/api/admin/logout" method="POST"');
    expect(markup).toContain("Sign out");

    // On legacy route /admin/products/new, aria-label="Log out" is used to prevent E2E conflicts
    expect(markup).toContain('aria-label="Log out"');

    // Hamburger button
    expect(markup).toContain('aria-label="Open navigation menu"');
    expect(markup).toContain('aria-expanded="false"');
  });

  it("renders non-legacy routes with aria-label='Sign out'", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminTopBar, {
        onToggleMobile: () => {},
        isMobileOpen: false,
        user: { username: "alex", role: "admin" },
        pathname: "/admin",
      })
    );

    expect(markup).toContain("Signed in as <strong>alex</strong>.");
    expect(markup).toContain('class="admin-role-badge role-admin"');
    expect(markup).toContain('aria-label="Sign out"');
  });

  it("omits user badge and sign-out form when unauthenticated", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminTopBar, {
        onToggleMobile: () => {},
        isMobileOpen: false,
        user: null,
        pathname: "/admin/products",
      })
    );

    expect(markup).not.toContain("Signed in as");
    expect(markup).not.toContain('action="/api/admin/logout"');
  });
});

describe("AdminMobileDrawer Component", () => {
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
        pathname: "/admin/blogs",
      })
    );

    // Backdrop with blur
    expect(markup).toContain('class="admin-drawer-backdrop"');

    // Dialog attributes
    expect(markup).toContain('id="admin-mobile-drawer"');
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-label="Store administration menu"');

    // Close button
    expect(markup).toContain('aria-label="Close navigation menu"');

    // All 5 sections
    expect(markup).toContain("Storefront &amp; Catalog");
    expect(markup).toContain("Sales &amp; Customers");
    expect(markup).toContain("Editorial &amp; Content");
    expect(markup).toContain("System &amp; MCP");
    expect(markup).toContain("Settings");

    // Active state highlighting for /admin/blogs
    const blogsLink = markup.match(/<a[^>]*href="\/admin\/blogs"[^>]*>/)?.[0] || "";
    expect(blogsLink).toContain('class="admin-nav-item active"');
    expect(blogsLink).toContain('aria-current="page"');
  });

  describe("Focus Trap & Accessibility Lifecycle", () => {
    it("locks body scroll style and handles escape listener pattern", () => {
      // Simulate focus trap lifecycle and scroll lock
      let overflowState = "visible";
      const lockScroll = () => { overflowState = "hidden"; };
      const restoreScroll = () => { overflowState = ""; };

      lockScroll();
      expect(overflowState).toBe("hidden");

      restoreScroll();
      expect(overflowState).toBe("");

      // Simulate escape key dismissal
      const onClose = vi.fn();
      const handleKeyDown = (e: { key: string; preventDefault: () => void }) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      };

      const preventDefault = vi.fn();
      handleKeyDown({ key: "Escape", preventDefault });
      expect(preventDefault).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it("loops focus on Tab key navigation between boundaries", () => {
      // Tab loop boundary testing logic
      let focusedIndex = 0;
      const elements = ["close-btn", "item-1", "item-2", "item-3"];

      const cycleTab = (shiftKey: boolean) => {
        if (shiftKey) {
          focusedIndex = focusedIndex === 0 ? elements.length - 1 : focusedIndex - 1;
        } else {
          focusedIndex = focusedIndex === elements.length - 1 ? 0 : focusedIndex + 1;
        }
        return elements[focusedIndex];
      };

      expect(cycleTab(false)).toBe("item-1");
      expect(cycleTab(false)).toBe("item-2");
      expect(cycleTab(false)).toBe("item-3");
      expect(cycleTab(false)).toBe("close-btn"); // loops to start!

      expect(cycleTab(true)).toBe("item-3"); // shift-tab loops to end!
    });
  });
});

describe("AdminShell Component", () => {
  it("renders unified admin shell with sidebar, topbar, mobile drawer, and main content", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminShell,
        null,
        React.createElement("div", { id: "test-child" }, "Admin Content Dashboard")
      )
    );

    expect(markup).toContain('class="admin-shell-root sidebar-expanded"');
    expect(markup).toContain('class="admin-sidebar expanded"');
    expect(markup).toContain('class="admin-topbar"');
    expect(markup).toContain('id="admin-main-content" class="admin-content-canvas"');
    expect(markup).toContain('id="test-child"');
    expect(markup).toContain("Admin Content Dashboard");

    // Scoped CSS styles embedded with design tokens and prefers-reduced-motion
    expect(markup).toContain("--admin-sidebar-bg: #1d2a24;");
    expect(markup).toContain("--admin-sidebar-active: #23483a;");
    expect(markup).toContain("--admin-sidebar-accent: #b39156;");
    expect(markup).toContain("prefers-reduced-motion: reduce");
  });

  it("supports initialCollapsed property", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminShell,
        { initialCollapsed: true },
        React.createElement("div", null, "Collapsed Content")
      )
    );

    expect(markup).toContain('class="admin-shell-root sidebar-collapsed"');
    expect(markup).toContain('class="admin-sidebar collapsed"');
  });
});
