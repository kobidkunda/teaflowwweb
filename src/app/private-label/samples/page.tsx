"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";

export default function SampleOrderPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<"tea_kit" | "packaged_mockup" | "full_pack_sample">("tea_kit");
  const [quantity, setQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState("");
  const [address, setAddress] = useState({
    name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kitOptions = [
    {
      id: "tea_kit" as const,
      testId: "sample-kit-card-tea_kit",
      title: "Harvest Tasting Flight",
      pricePaise: 75000,
      description: "4 estate-direct Darjeeling & Assam flush lots (50g each) + cupping scorecards and notes.",
      features: ["Tea selection confirmed by our team", "Sample contents confirmed before dispatch", "Cupping spoon & evaluation notes"],
    },
    {
      id: "packaged_mockup" as const,
      testId: "sample-kit-card-packaged_mockup",
      title: "Packaging Swatch & Substrate Kit",
      pricePaise: 49900,
      description: "Tactile material kit with stand-up pouches, tins, cold-foil swatches, and matte finishes.",
      features: ["Kraft, BOPP, and tin substrates", "Degassing valve & zipper tactile feel", "Delta-E color sign-off chips"],
    },
    {
      id: "full_pack_sample" as const,
      testId: "sample-kit-card-full_pack_sample",
      title: "Printed Pre-Production Proof",
      pricePaise: 250000,
      description: "Full custom-printed dieline prototype rendered with your exact brand artwork.",
      features: ["Your custom vector dieline", "Press-sheet color calibration", "Label requirements discussed with our team"],
    },
  ];

  const selectedKit = kitOptions.find((k) => k.id === selectedType)!;
  const displayPrice = selectedKit.pricePaise * quantity;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!address.name.trim() || !address.line1.trim() || !address.city.trim() || !address.state.trim()) {
      setError("Please complete recipient name, address line 1, city and state.");
      return;
    }

    if (!/^[1-9][0-9]{5}$/.test(address.pincode.trim())) {
      setError("Enter a valid 6-digit Indian PIN code (e.g. 734001).");
      return;
    }

    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) { setError("Choose a whole number of samples between 1 and 10."); return; }
    if (address.phone.trim() && !/^\d{10,15}$/.test(address.phone.replace(/\D/g, ""))) { setError("Enter a valid 10–15 digit contact number."); return; }
    try {
      setLoading(true);
      const res = await fetch("/api/v1/private-label/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sample_type: selectedType,
          quantity,
          coupon_code: couponCode.trim() || null,
          shipping_address: address,
        }),
      });

      const data = await res.json();
      if (res.status === 401) {
        setNeedsLogin(true);
        setError("Sign in to request samples. Your address remains on this page while you open sign-in.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Failed to submit sample request.");
        return;
      }

      router.push("/account/private-label");
    } catch {
      setError("Network error submitting sample order.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FBF9F4] py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-[#143C31] font-semibold">
            Tactile Evaluation
          </span>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#143C31] mt-1">
            Order Trial Sample Kits
          </h1>
          <p className="text-sm text-[#65746D] mt-2 max-w-2xl">
            Evaluate orthodox tea grades and high-barrier packaging finishes before committing to full cleanroom MOQs.
          </p>
        </div>

        {/* 100% Bulk Credit Guarantee Banner */}
        <div className="bg-[#EBF3EF] border border-[#C5D6CC] rounded-xl p-4 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-[#143C31] shrink-0" />
          <div className="text-xs text-[#143C31]">
            <span className="font-bold">Sample credit terms: </span>
            Ask our team whether sample costs can be credited toward your production order. Terms must be confirmed in your quotation.
          </div>
        </div>

        {/* Sample Kit Selector */}
        <div className="space-y-4">
          <h2 className="text-base font-serif font-bold text-[#143C31]">1. Select Sample Kit</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {kitOptions.map((kit) => {
              const active = selectedType === kit.id;
              return (
                <button
                  type="button"
                  key={kit.id}
                  data-testid={kit.testId}
                  aria-pressed={active}
                  onClick={() => setSelectedType(kit.id)}
                  className={`p-5 rounded-xl text-left border-2 transition-all flex flex-col justify-between ${
                    active
                      ? "border-[#143C31] bg-white shadow-sm ring-1 ring-[#143C31]"
                      : "border-[#E8E4DC] bg-white hover:border-[#C5D6CC]"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#143C31]">{kit.title}</span>
                      {active && <Check size={18} className="text-[#143C31]" />}
                    </div>
                    <p className="text-xs text-[#65746D] leading-relaxed">{kit.description}</p>
                    <ul className="text-[11px] text-[#4A5550] space-y-1 pt-2">
                      {kit.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#143C31]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-4 mt-4 border-t border-[#E8E4DC]">
                    <span className="text-base font-serif font-bold text-[#143C31]">
                      ₹{(kit.pricePaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Address & Submission Form */}
        <form onSubmit={handleSubmit} data-testid="sample-order-form" className="space-y-6">
          <div className="bg-white border border-[#E8E4DC] rounded-xl p-6 shadow-2xs space-y-5">
            <h2 className="text-base font-serif font-bold text-[#143C31] pb-3 border-b border-[#E8E4DC]">
              2. Delivery Address & Contact
            </h2>

            {needsLogin && <p><Link href="/login?redirect=%2Fprivate-label%2Fsamples" target="_blank" rel="noopener noreferrer">Open sign-in in a new tab, then retry here</Link></p>}
            {error && (
              <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-lg flex items-center gap-2">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label htmlFor="sample-name" className="block font-medium text-[#143C31] mb-1">Contact Name *</label>
                <input
                  type="text"
                  required
                  id="sample-name"
                  value={address.name}
                  onChange={(e) => setAddress({ ...address, name: e.target.value })}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-3 py-2 border border-[#DDE4DC] rounded-lg focus:outline-hidden focus:border-[#143C31]"
                />
              </div>

              <div>
                <label htmlFor="sample-phone" className="block font-medium text-[#143C31] mb-1">Mobile Number</label>
                <input
                  type="tel"
                  id="sample-phone"
                  value={address.phone}
                  onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 border border-[#DDE4DC] rounded-lg focus:outline-hidden focus:border-[#143C31]"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="sample-line1" className="block font-medium text-[#143C31] mb-1">Street Address Line 1 *</label>
                <input
                  type="text"
                  required
                  id="sample-line1"
                  value={address.line1}
                  onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                  placeholder="Premises name, street, road"
                  className="w-full px-3 py-2 border border-[#DDE4DC] rounded-lg focus:outline-hidden focus:border-[#143C31]"
                />
              </div>

              <div>
                <label htmlFor="sample-city" className="block font-medium text-[#143C31] mb-1">City *</label>
                <input
                  type="text"
                  required
                  id="sample-city"
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  placeholder="e.g. Siliguri"
                  className="w-full px-3 py-2 border border-[#DDE4DC] rounded-lg focus:outline-hidden focus:border-[#143C31]"
                />
              </div>

              <div>
                <label htmlFor="sample-state" className="block font-medium text-[#143C31] mb-1">State / Union Territory *</label>
                <input id="sample-state" type="text" required minLength={2} maxLength={100} autoComplete="address-level1" value={address.state} onChange={event => setAddress({ ...address, state: event.target.value })} className="w-full px-3 py-2 border border-[#DDE4DC] rounded-lg" />
              </div>
              <div>
                <label htmlFor="sample-pincode" className="block font-medium text-[#143C31] mb-1">6-Digit PIN Code *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  id="sample-pincode"
                  value={address.pincode}
                  onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                  placeholder="e.g. 734001"
                  className="w-full px-3 py-2 border border-[#DDE4DC] rounded-lg focus:outline-hidden focus:border-[#143C31]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#E8E4DC] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="text-xs">
                  <label htmlFor="sample-quantity" className="block font-medium text-[#143C31] mb-1">Quantity (Max 10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    id="sample-quantity"
                    value={quantity || ""}
                    step={1}
                    onChange={(e) => setQuantity(Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)}
                    className="w-20 px-3 py-1.5 border border-[#DDE4DC] rounded-lg text-center"
                  />
                </div>
                <div className="text-xs">
                  <label htmlFor="sample-coupon" className="block font-medium text-[#143C31] mb-1">Promo Coupon</label>
                  <input
                    type="text"
                    id="sample-coupon"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Optional code"
                    className="w-36 px-3 py-1.5 border border-[#DDE4DC] rounded-lg uppercase"
                  />
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-[#65746D]">Indicative sample subtotal</span>
                <p className="text-xl font-serif font-bold text-[#143C31]">
                  {`₹${(displayPrice / 100).toLocaleString("en-IN")}`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href="/private-label"
              className="px-5 py-2.5 rounded-lg text-xs font-semibold border border-[#DDE4DC] text-[#65746D] hover:bg-white"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              data-testid="sample-submit-btn"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#143C31] text-white hover:bg-[#1E5244] transition-colors shadow-2xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Submitting Request...
                </>
              ) : (
                <>
                  Request Sample Order <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
