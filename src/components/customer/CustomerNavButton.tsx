"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { User, Package, MapPin, LogOut, ChevronDown, Sparkles } from "lucide-react";
import type { SafeCustomer } from "@/lib/customerSessions";

export function CustomerNavButton() {
  const [customer, setCustomer] = useState<SafeCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/customer/me?optional=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) {
          setCustomer(data?.customer || null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dropdownOpen]);

  async function handleLogout() {
    try {
      await fetch("/api/customer/logout", { method: "POST" });
      setCustomer(null);
      setDropdownOpen(false);
      window.location.href = "/";
    } catch {
      window.location.reload();
    }
  }

  if (loading) {
    return (
      <div className="icon-button tf-nav-action-btn opacity-60" aria-hidden="true">
        <User size={19} strokeWidth={1.6} />
      </div>
    );
  }

  if (!customer) {
    return (
      <Link
        href="/login"
        className="icon-button tf-nav-action-btn"
        aria-label="Sign In or View Account"
        title="Sign In / My Account"
      >
        <User size={19} strokeWidth={1.6} />
      </Link>
    );
  }

  const initials = customer.name
    ? customer.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "TF";

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        className="tf-customer-nav-trigger flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-[#d6cfc0] bg-[#faf8f4] hover:bg-[#f0ebe0] transition-colors text-xs font-semibold text-[#1d2a24]"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
        aria-haspopup="true"
        aria-label={`Account menu for ${customer.name || customer.email}`}
      >
        <span className="w-5 h-5 rounded-full bg-[#23483a] text-white flex items-center justify-center text-[10px] font-bold">
          {initials}
        </span>
        <span className="hidden md:inline max-w-[85px] truncate text-[11px]">
          {customer.name?.split(" ")[0] || "Account"}
        </span>
        <ChevronDown size={13} className="text-[#697a55]" />
      </button>

      {dropdownOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-xl bg-[#fffefa] border border-[#d8d2c4] shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header Info */}
          <div className="px-3 py-2.5 border-b border-[#eee8dc]">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-[#b39156] flex items-center gap-1">
              <Sparkles size={11} /><StorefrontText id="copy_9c6f1ef2cbc44926" fallback="Tea Connoisseur" />
            </p>
            <p className="text-sm font-serif font-bold text-[#171713] truncate">
              {customer.name || "Member"}
            </p>
            <p className="text-xs text-[#5c6659] truncate">{customer.email}</p>
          </div>

          {/* Links */}
          <div className="py-1">
            <Link
              href="/account/orders"
              role="menuitem"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#171713] hover:bg-[#f5f1e8] rounded-lg transition-colors"
            >
              <Package size={15} className="text-[#23483a]" />
              <span><StorefrontText id="copy_00db793f2b8cff97" fallback="My Orders" /></span>
            </Link>

            <Link
              href="/account/addresses"
              role="menuitem"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#171713] hover:bg-[#f5f1e8] rounded-lg transition-colors"
            >
              <MapPin size={15} className="text-[#23483a]" />
              <span><StorefrontText id="copy_919b4b003f2a4701" fallback="Saved Addresses" /></span>
            </Link>

            <Link
              href="/account"
              role="menuitem"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#171713] hover:bg-[#f5f1e8] rounded-lg transition-colors"
            >
              <User size={15} className="text-[#23483a]" />
              <span><StorefrontText id="copy_a32e6e81a0339c77" fallback="Account Overview" /></span>
            </Link>
          </div>

          {/* Logout */}
          <div className="pt-1 border-t border-[#eee8dc]">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#992222] hover:bg-[#fee2e2] rounded-lg transition-colors text-left"
            >
              <LogOut size={15} />
              <span><StorefrontText id="copy_0b184bc5d5341998" fallback="Sign Out" /></span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
