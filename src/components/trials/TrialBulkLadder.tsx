import React from "react";
import Link from "next/link";
import type { TrialPublicDto } from "@/lib/trials/types";
import { Tag } from "lucide-react";

export interface TrialBulkLadderProps {
  bulkLink?: TrialPublicDto["components"][0]["bulk_link"];
  componentName?: string;
  isOutOfStock?: boolean;
}

export function TrialBulkLadder({
  bulkLink,
  componentName = "Craft Tea",
  isOutOfStock = false,
}: TrialBulkLadderProps) {
  const tiers = [
    { size: "250g", discount: "Trial conversion", rate: "₹130", inStock: !isOutOfStock },
    { size: "500g", discount: "Save 12%", rate: "₹240", inStock: !isOutOfStock },
    { size: "1kg", discount: "Save 18%", rate: "₹450", inStock: !isOutOfStock },
    { size: "2kg", discount: "Save 22%", rate: "₹860", inStock: !isOutOfStock },
    { size: "5kg", discount: "Commercial Stall Tier", rate: "₹2,050", inStock: !isOutOfStock },
  ];

  return (
    <div
      data-testid="bulk-ladder"
      className="bulk-ladder bg-white border border-[#e6e0d4] rounded-[22px] p-6 sm:p-8 shadow-[0_20px_40px_rgba(20,59,47,0.06)] text-[#0d0b0a]"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-[#7c4f1c] mb-1">
            BULK CONVERSION LADDER
          </div>
          <h2 className="font-serif text-[28px] sm:text-[34px] leading-tight font-normal">
            Ready for a larger batch of <em className="italic text-[#ae8452]">{componentName}?</em>
          </h2>
          <p className="text-[#67756d] text-[13px] mt-1">
            Scale up from the 50g trial sachet to full wholesale bags with garden-direct discounts.
          </p>
        </div>

        {/* Voucher Callout */}
        <div className="bg-[#fff9e7] border border-[#e8d3a2] rounded-xl px-4 py-2 text-right">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#a36b2f]">
            <Tag className="w-3.5 h-3.5" />
            <span>STALL VOUCHER</span>
          </div>
          <strong className="block font-mono text-[16px] text-[#143b2f]">STALL150</strong>
          <span className="text-[10px] text-[#717b73]">₹150 off first bulk purchase</span>
        </div>
      </div>

      {/* Tiers List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {tiers.map((tier) => (
          <div
            key={tier.size}
            className={`border rounded-xl p-4 flex flex-col justify-between ${
              tier.inStock
                ? "bg-[#faf7f0] border-[#e8e2d4]"
                : "bg-[#fbf7f6] border-[#f0dedd] opacity-75"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <strong className="font-serif text-[20px] text-[#143b2f]">{tier.size}</strong>
                <span className="text-[10px] uppercase font-bold text-[#7c4f1c] bg-[#f2ecde] px-2 py-0.5 rounded">
                  {tier.discount}
                </span>
              </div>
              <span className="block text-[16px] font-bold text-[#0d0b0a] mb-1">{tier.rate}</span>
            </div>

            <div className="mt-3 pt-2 border-t border-[#e8e2d4]">
              {tier.inStock ? (
                bulkLink?.product_slug ? (
                  <Link
                    href={`/tea/${bulkLink.product_slug}`}
                    data-testid="bulk-variant-link"
                    className="block text-center w-full py-1.5 rounded-lg bg-[#143b2f] text-white text-[11px] font-bold hover:bg-[#1a4a3b] transition-colors"
                  >
                    View Bag ↗
                  </Link>
                ) : (
                  <span
                    data-testid="kit-exclusive-badge"
                    className="kit-exclusive block text-center text-[11px] font-bold text-[#ba8745] bg-[#fff9e7] py-1 rounded border border-[#eedab2]"
                  >
                    Kit Exclusive
                  </span>
                )
              ) : (
                <span className="block text-center text-[11px] font-bold text-[#9b1c1c] bg-[#fdf2f2] py-1 rounded border border-[#fbd5d5]">
                  Out of Stock
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[12px] text-[#78857c] border-t border-[#eeeae3] pt-4">
        {bulkLink?.product_slug ? (
          <p>
            Linked regular variant: <b>{bulkLink.variant_title || "Standard Pouch"}</b> under <code>/tea/{bulkLink.product_slug}</code>. Prices and stock update in real time.
          </p>
        ) : (
          <p>
            This tea expression is currently an <b>exclusive trial blend</b> formulated solely for the discovery flight. Regular bags become available upon commercial release.
          </p>
        )}
      </div>
    </div>
  );
}
