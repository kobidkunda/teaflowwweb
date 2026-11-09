"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Star,
} from "lucide-react";
import type { CustomerAddress, CustomerAddressInput } from "@/lib/customerAddresses";

const EMPTY_FORM: CustomerAddressInput = {
  name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  landmark: "",
  city: "",
  state: "",
  postal_code: "",
  country: "IN",
  is_default: false,
};

export default function AddressesPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomerAddressInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAddresses() {
      try {
        const res = await fetch("/api/customer/addresses");
        if (res.status === 401) {
          router.push("/login?redirect=/account/addresses");
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (active) setAddresses(data.addresses || []);
      } catch {
        if (active) setAddresses([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAddresses();
    return () => {
      active = false;
    };
  }, [router]);

  function openCreateModal() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(addr: CustomerAddress) {
    setEditingId(addr.id);
    setFormData({
      name: addr.name,
      phone: addr.phone,
      address_line1: addr.address_line1,
      address_line2: addr.address_line2 || "",
      landmark: addr.landmark || "",
      city: addr.city,
      state: addr.state,
      postal_code: addr.postal_code,
      country: addr.country || "IN",
      is_default: addr.is_default === 1,
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingId
        ? `/api/customer/addresses/${editingId}`
        : "/api/customer/addresses";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save address.");

      if (editingId) {
        setAddresses((prev) =>
          prev.map((a) => {
            if (a.id === editingId) return data.address;
            if (data.address.is_default === 1) return { ...a, is_default: 0 };
            return a;
          })
        );
      } else {
        setAddresses((prev) => {
          const list = data.address.is_default === 1
            ? prev.map((a) => ({ ...a, is_default: 0 }))
            : [...prev];
          return [data.address, ...list];
        });
      }

      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save address.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this delivery address?")) return;
    try {
      const res = await fetch(`/api/customer/addresses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert("Failed to delete address.");
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const res = await fetch(`/api/customer/addresses/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error();
      setAddresses((prev) =>
        prev.map((a) => ({
          ...a,
          is_default: a.id === id ? 1 : 0,
        }))
      );
    } catch {
      alert("Failed to set default address.");
    }
  }

  return (
    <div className="container page-shell py-10 max-w-5xl mx-auto px-4 sm:px-6">
      {/* Breadcrumb */}
      <nav className="breadcrumbs mb-4 text-xs text-[#737067]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#171713]">
          Teafloww
        </Link>{" "}
        /{" "}
        <Link href="/account" className="hover:text-[#171713]">
          Account
        </Link>{" "}
        / <span className="text-[#171713] font-bold" aria-current="page">Saved Addresses</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-[#ded7cb]">
        <div>
          <p className="eyebrow text-xs font-bold uppercase tracking-wider text-[#b39156]">
            Delivery Destinations
          </p>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal">
            Address Book
          </h1>
          <p className="text-xs sm:text-sm text-[#5c6659] mt-1">
            Manage your home, office, and gifting addresses for fast 1-click checkout across India.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#23483a] text-white text-xs font-bold hover:bg-[#1a362b] transition-colors self-start sm:self-center shadow-sm"
        >
          <Plus size={16} />
          <span>Add New Address</span>
        </button>
      </div>

      {/* Address Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[#5c6659]">
          <p>Loading your saved addresses…</p>
        </div>
      ) : addresses.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-[#ded7cb] bg-[#fffefa] my-6">
          <div className="w-14 h-14 rounded-full bg-[#f4f7f2] border border-[#dce5da] text-[#23483a] flex items-center justify-center mx-auto mb-3">
            <MapPin size={26} />
          </div>
          <h2 className="text-lg font-serif font-bold text-[#171713]">
            No saved addresses yet
          </h2>
          <p className="text-xs text-[#5c6659] mt-1 max-w-sm mx-auto">
            Add your primary shipping destination to enjoy one-click checkout and accurate delivery quotes from our Siliguri hub.
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={openCreateModal}
              className="px-5 py-2.5 rounded-lg bg-[#23483a] text-white text-xs font-bold hover:bg-[#1a362b] transition-colors inline-flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Add Your First Address</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {addresses.map((addr) => {
            const isDefault = addr.is_default === 1;

            return (
              <div
                key={addr.id}
                className={`p-5 sm:p-6 rounded-2xl border transition-all ${
                  isDefault
                    ? "border-[#23483a] bg-[#fffefa] shadow-md ring-1 ring-[#23483a]"
                    : "border-[#ded7cb] bg-[#fffefa] shadow-sm hover:border-[#b39156]"
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#171713]">
                      {addr.name}
                    </span>
                    {isDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f4f7f2] text-[#23483a] text-[10px] font-bold uppercase tracking-wider border border-[#c4d6c4]">
                        <CheckCircle2 size={11} /> Default
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(addr)}
                      className="p-1.5 text-[#5c6659] hover:text-[#23483a] hover:bg-[#f4f7f2] rounded-lg transition-colors"
                      title="Edit address"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(addr.id)}
                      className="p-1.5 text-[#737067] hover:text-[#b91c1c] hover:bg-[#fee2e2] rounded-lg transition-colors"
                      title="Delete address"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Address Body */}
                <div className="text-xs text-[#46524a] space-y-1 leading-relaxed">
                  <p>{addr.address_line1}</p>
                  {addr.address_line2 && <p>{addr.address_line2}</p>}
                  {addr.landmark && (
                    <p className="text-[11px] text-[#737067]">
                      Landmark: {addr.landmark}
                    </p>
                  )}
                  <p className="font-semibold text-[#171713]">
                    {addr.city}, {addr.state} — {addr.postal_code}
                  </p>
                  <p className="text-[#5c6659] pt-1">
                    Contact: <span className="font-medium">{addr.phone}</span>
                  </p>
                </div>

                {/* Bottom Actions */}
                {!isDefault && (
                  <div className="mt-4 pt-3 border-t border-[#eee8dc]">
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr.id)}
                      className="text-xs font-semibold text-[#23483a] hover:underline inline-flex items-center gap-1"
                    >
                      <Star size={13} /> Set as default delivery address
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Address Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="address-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#fffefa] border border-[#ded7cb] p-6 shadow-2xl my-8">
            <h2 id="address-modal-title" className="text-xl font-serif font-bold text-[#171713]">
              {editingId ? "Edit Delivery Address" : "Add New Delivery Address"}
            </h2>
            <p className="text-xs text-[#5c6659] mt-1">
              Enter your complete shipping destination details below.
            </p>

            {error && (
              <div role="alert" className="my-4 p-3 rounded-lg bg-[#fef2f2] border border-[#fca5a5] text-xs text-[#991b1b]">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modal-name" className="block text-xs font-semibold text-[#171713] mb-1">
                    Recipient Full Name *
                  </label>
                  <input
                    id="modal-name"
                    name="name"
                    type="text"
                    required
                    maxLength={100}
                    autoComplete="name"
                    placeholder="e.g. Ananya Roy"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full min-h-[44px] rounded-lg border border-[#b8b5a8] px-3 py-2 text-xs text-[#171713] outline-none focus:border-[#23483a]"
                  />
                </div>

                <div>
                  <label htmlFor="modal-phone" className="block text-xs font-semibold text-[#171713] mb-1">
                    Contact Phone Number *
                  </label>
                  <input
                    id="modal-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    required
                    maxLength={20}
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full min-h-[44px] rounded-lg border border-[#b8b5a8] px-3 py-2 text-xs text-[#171713] outline-none focus:border-[#23483a]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="modal-line1" className="block text-xs font-semibold text-[#171713] mb-1">
                  Flat / House No., Building Name, Street *
                </label>
                <input
                  id="modal-line1"
                  name="address-line1"
                  type="text"
                  required
                  maxLength={150}
                  autoComplete="address-line1"
                  placeholder="e.g. Flat 4B, Hill Cart Residency"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  className="w-full min-h-[44px] rounded-lg border border-[#b8b5a8] px-3 py-2 text-xs text-[#171713] outline-none focus:border-[#23483a]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modal-line2" className="block text-xs font-semibold text-[#171713] mb-1">
                    Area / Colony / Sector
                  </label>
                  <input
                    id="modal-line2"
                    name="address-line2"
                    type="text"
                    maxLength={150}
                    autoComplete="address-line2"
                    placeholder="e.g. Pradhan Nagar"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                    className="w-full min-h-[44px] rounded-lg border border-[#b8b5a8] px-3 py-2 text-xs text-[#171713] outline-none focus:border-[#23483a]"
                  />
                </div>

                <div>
                  <label htmlFor="modal-landmark" className="block text-xs font-semibold text-[#171713] mb-1">
                    Landmark (Optional)
                  </label>
                  <input
                    id="modal-landmark"
                    name="landmark"
                    type="text"
                    maxLength={100}
                    autoComplete="address-line3"
                    placeholder="e.g. Near Junction Station"
                    value={formData.landmark}
                    onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                    className="w-full min-h-[44px] rounded-lg border border-[#b8b5a8] px-3 py-2 text-xs text-[#171713] outline-none focus:border-[#23483a]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="modal-city" className="block text-xs font-semibold text-[#171713] mb-1">
                    City *
                  </label>
                  <input
                    id="modal-city"
                    name="city"
                    type="text"
                    required
                    maxLength={100}
                    autoComplete="address-level2"
                    placeholder="e.g. Siliguri"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full min-h-[44px] rounded-lg border border-[#b8b5a8] px-3 py-2 text-xs text-[#171713] outline-none focus:border-[#23483a]"
                  />
                </div>

                <div>
                  <label htmlFor="modal-state" className="block text-xs font-semibold text-[#171713] mb-1">
                    State *
                  </label>
                  <input
                    id="modal-state"
                    name="state"
                    type="text"
                    required
                    maxLength={100}
                    autoComplete="address-level1"
                    placeholder="e.g. West Bengal"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full min-h-[44px] rounded-lg border border-[#b8b5a8] px-3 py-2 text-xs text-[#171713] outline-none focus:border-[#23483a]"
                  />
                </div>

                <div>
                  <label htmlFor="modal-pincode" className="block text-xs font-semibold text-[#171713] mb-1">
                    6-Digit PIN Code *
                  </label>
                  <input
                    id="modal-pincode"
                    name="postal-code"
                    type="text"
                    inputMode="numeric"
                    required
                    pattern="[1-9][0-9]{5}"
                    maxLength={6}
                    autoComplete="postal-code"
                    placeholder="734001"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full min-h-[44px] rounded-lg border border-[#b8b5a8] px-3 py-2 text-xs text-[#171713] outline-none focus:border-[#23483a]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#171713] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 rounded text-[#23483a] accent-[#23483a]"
                  />
                  <span>Set as my default shipping address</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#eee8dc]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-[#c2bcae] text-xs font-semibold text-[#171713] hover:bg-[#f5f1e8] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#23483a] text-white text-xs font-bold hover:bg-[#1a362b] transition-colors shadow-sm disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingId ? "Update Address" : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
