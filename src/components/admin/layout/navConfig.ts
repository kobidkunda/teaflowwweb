import type { LucideIcon } from "lucide-react";
import {
  Package,
  FolderTree,
  Layers,
  FileSpreadsheet,
  Image as ImageIcon,
  Sliders,
  Rss,
  ShoppingBag,
  Ticket,
  TrendingUp,
  BookOpen,
  Cpu,
  Settings,
  Users,
  Home,
  Activity,
  ShoppingCart,
  Mail,
  FlaskConical,
  Truck,
  CreditCard,
  Boxes,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  section: string;
};

export type NavGroup = {
  id: string;
  title: string;
  items: NavItem[];
};

export const OVERVIEW_ITEM: NavItem = {
  href: "/admin",
  label: "Overview",
  icon: Home,
  section: "Overview",
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "catalog",
    title: "Storefront & Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, section: "Storefront & Catalog" },
      { href: "/admin/categories", label: "Categories", icon: FolderTree, section: "Storefront & Catalog" },
      { href: "/admin/variants", label: "Variants", icon: Layers, section: "Storefront & Catalog" },
      { href: "/admin/bulk-pricing", label: "Bulk Pricing", icon: FileSpreadsheet, section: "Storefront & Catalog" },
      { href: "/admin/feeds", label: "Product Feeds", icon: Rss, section: "Storefront & Catalog" },
      { href: "/admin/media", label: "Media", icon: ImageIcon, section: "Storefront & Catalog" },
      { href: "/admin/sliders", label: "Hero Sliders", icon: Sliders, section: "Storefront & Catalog" },
      { href: "/admin/blend-lab", label: "Blend Lab (Atelier)", icon: FlaskConical, section: "Storefront & Catalog" },
      { href: "/admin/trials", label: "Trials", icon: Boxes, section: "Storefront & Catalog" },
    ],
  },
  {
    id: "sales",
    title: "Sales & Customers",
    items: [
      { href: "/admin/subscriptions", label: "Subscriptions", icon: ShoppingBag, section: "Sales & Customers" },
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag, section: "Sales & Customers" },
      { href: "/admin/abandoned-carts", label: "Abandoned Carts", icon: ShoppingCart, section: "Sales & Customers" },
      { href: "/admin/coupons", label: "Coupons", icon: Ticket, section: "Sales & Customers" },
      { href: "/admin/visitors", label: "Visitors & Analytics", icon: TrendingUp, section: "Sales & Customers" },
    ],
  },
  {
    id: "editorial",
    title: "Editorial & Content",
    items: [
      { href: "/admin/homepage", label: "Homepage", icon: Home, section: "Editorial & Content" },
      { href: "/admin/blogs", label: "Journal & Blog", icon: BookOpen, section: "Editorial & Content" },
    ],
  },
  {
    id: "system",
    title: "System & MCP",
    items: [
      { href: "/admin/mcp", label: "MCP Server & Tools", icon: Cpu, section: "System & MCP" },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    items: [
      { href: "/admin/settings", label: "Operational Settings", icon: Settings, section: "Settings" },
      { href: "/admin/emails", label: "Email Templates", icon: Mail, section: "Settings" },
      { href: "/admin/tracking", label: "Analytics & Pixels", icon: Activity, section: "Settings" },
      { href: "/admin/users", label: "Staff Accounts", icon: Users, section: "Settings" },
    ],
  },
];

export const SHIPPING_PAYMENT_NAV_ITEMS: NavItem[] = [
  { href: "/admin/shipping-settings", label: "Shipping Settings", icon: Truck, section: "Settings" },
  { href: "/admin/payment-settings", label: "Payment Settings", icon: CreditCard, section: "Settings" },
];

export const INTERNATIONAL_NAV_ITEMS: NavItem[] = [
  { href: "/admin/markets", label: "Markets & Delivery", icon: Settings, section: "Settings" },
  { href: "/admin/translations", label: "Translation Studio", icon: BookOpen, section: "Settings" },
  { href: "/admin/fulfillment", label: "Commerce Operations", icon: Package, section: "Settings" },
];

export const SIDEBAR_NAV_GROUPS: NavGroup[] = NAV_GROUPS.map((group) => {
  if (group.id === "settings") {
    return {
      ...group,
      items: [...SHIPPING_PAYMENT_NAV_ITEMS, ...INTERNATIONAL_NAV_ITEMS, ...group.items],
    };
  }
  return group;
});

export const NAV_SECTIONS = NAV_GROUPS;

/**
 * Checks if a given navigation href is active for the current pathname.
 * Handles exact match for /admin and prefix match for subpaths (e.g. /admin/products/new).
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type BreadcrumbItem = {
  label: string;
  href?: string;
  current?: boolean;
};

/**
 * Generates hierarchical breadcrumbs based on the current pathname.
 * Example: /admin/products/new -> [Admin, Storefront & Catalog, Products, New]
 */
export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [
    { label: "Admin", href: "/admin", current: pathname === "/admin" },
  ];

  if (pathname === "/admin") {
    return crumbs;
  }

  // Find matching nav item
  for (const group of SIDEBAR_NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        crumbs.push({ label: group.title });
        const isItemPage = pathname === item.href;
        crumbs.push({
          label: item.label,
          href: isItemPage ? undefined : item.href,
          current: isItemPage,
        });

        // Add subpath actions (e.g., /new, /[id], /[id]/edit)
        const subpath = pathname.slice(item.href.length).replace(/^\//, "");
        if (subpath) {
          const parts = subpath.split("/").filter(Boolean);
          parts.forEach((part, idx) => {
            const isLast = idx === parts.length - 1;
            let partLabel = part;
            if (part === "new") partLabel = "New";
            else if (part === "edit") partLabel = "Edit";
            else if (part === "delete") partLabel = "Delete";
            else if (/^\d+$/.test(part)) partLabel = `#${part}`;
            else partLabel = part.charAt(0).toUpperCase() + part.slice(1);

            crumbs.push({
              label: partLabel,
              current: isLast,
            });
          });
        }
        return crumbs;
      }
    }
  }

  // Fallback for unmatched subpaths under /admin
  const remaining = pathname.replace(/^\/admin\/?/, "");
  if (remaining) {
    const parts = remaining.split("/").filter(Boolean);
    parts.forEach((part, idx) => {
      crumbs.push({
        label: part.charAt(0).toUpperCase() + part.slice(1),
        current: idx === parts.length - 1,
      });
    });
  }

  return crumbs;
}
