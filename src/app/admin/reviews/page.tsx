"use client";

import React, { useEffect, useState } from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import type { ProductReview, ReviewStatus } from "@/lib/reviews";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = async (status: ReviewStatus | "all") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews?status=${status}`, {
        credentials: "same-origin",
      });
      if (res.ok) {
        const data = (await res.json()) as { reviews: ProductReview[] };
        setReviews(data.reviews || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(filter);
  }, [filter]);

  const handleModerate = async (id: number, status: ReviewStatus) => {
    setMessage(null);
    const res = await fetch("/api/admin/reviews", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setMessage(`Review #${id} marked ${status}.`);
      await load(filter);
    }
  };

  return (
    <AdminAuthGate>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#18231c]">
              Verified Product Reviews
            </h1>
            <p className="text-xs text-[#5a6655]">
              Approve verified buyer reviews to include live ratings in Product JSON-LD, Google Product Ratings XML, and OpenAI Commerce feeds.
            </p>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ReviewStatus | "all")}
            className="px-3 py-2 text-xs font-semibold border border-[#d6cfc2] rounded-md bg-white"
            aria-label="Filter reviews by status"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {message && (
          <div className="p-3 rounded bg-[#eaf3e9] border border-[#b7d6be] text-xs font-medium text-[#1e5631]">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#5a6655]">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#fbf8f1] border border-[#e3ddd0] text-center text-sm text-[#5a6655]">
            No reviews found for this filter.
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-lg bg-white border border-[#e3ddd0] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#18231c]">{r.rating}/5 ★</span>
                    <span className="text-[#5a6655]">
                      {r.entity_type} #{r.entity_id}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#f4f1ea] text-[10px] font-bold uppercase">
                      {r.status}
                    </span>
                    {r.verified_purchase && (
                      <span className="text-[#2e683f] font-semibold">Verified Order</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-[#18231c]">{r.title}</div>
                  <p className="text-xs text-[#4a5047]">{r.body}</p>
                  <div className="text-[11px] text-[#73786f]">
                    By {r.reviewer_name} · {r.created_at}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleModerate(r.id, "approved")}
                    className="px-3 py-1.5 rounded bg-[#1d2a24] text-white text-xs font-semibold cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModerate(r.id, "rejected")}
                    className="px-3 py-1.5 rounded border border-[#dca9a4] text-[#8f2f2a] text-xs font-semibold cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminAuthGate>
  );
}
