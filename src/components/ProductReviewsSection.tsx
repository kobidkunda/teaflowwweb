"use client";

import React, { useState } from "react";
import { Star, ShieldCheck, MessageSquarePlus } from "lucide-react";
import type { ProductReview, ReviewEntityType, ReviewSummary } from "@/lib/reviews";

export interface ProductReviewsSectionProps {
  entityType: ReviewEntityType;
  entityId: string;
  productName: string;
  summary: ReviewSummary | null;
  reviews: ProductReview[];
}

export function ProductReviewsSection({
  entityType,
  entityId,
  productName,
  summary,
  reviews,
}: ProductReviewsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [orderReference, setOrderReference] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          order_reference: orderReference,
          reviewer_email: reviewerEmail,
          reviewer_name: reviewerName,
          rating,
          title,
          body,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Unable to verify purchase for this review.",
        });
      } else {
        setFeedback({
          type: "ok",
          text: data.message || "Thank you! Your verified review is queued for approval.",
        });
        setOrderReference("");
        setReviewerEmail("");
        setReviewerName("");
        setTitle("");
        setBody("");
        setShowForm(false);
      }
    } catch {
      setFeedback({ type: "error", text: "Network error submitting review." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="verified-reviews"
      aria-labelledby="verified-reviews-heading"
      className="my-10 p-6 sm:p-8 rounded-xl bg-[#fbf8f1] border border-[#e3ddd0]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#e8e1d5]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5a6655] mb-1">
            Verified Buyer Notes
          </p>
          <h2 id="verified-reviews-heading" className="font-serif text-2xl text-[#18231c]">
            {summary && summary.reviewCount > 0 ? (
              <span className="inline-flex items-center gap-2.5">
                <span>Customer Reviews</span>
                <span className="inline-flex items-center gap-1 text-base font-sans font-bold text-[#1d2a24] bg-[#eaf3e9] border border-[#b7d6be] px-2.5 py-0.5 rounded-full">
                  <Star size={14} className="fill-[#b36b3d] text-[#b36b3d]" aria-hidden="true" />
                  <span>{summary.ratingValue.toFixed(1)}</span>
                  <span className="text-xs font-medium text-[#4a5047]">({summary.reviewCount})</span>
                </span>
              </span>
            ) : (
              <span>Verified Buyer Reviews</span>
            )}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-[#1d2a24] text-xs font-bold text-[#1d2a24] hover:bg-[#1d2a24] hover:text-white transition-colors cursor-pointer"
        >
          <MessageSquarePlus size={14} aria-hidden="true" />
          <span>{showForm ? "Cancel" : "Write a Verified Review"}</span>
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`mt-4 p-3 rounded-lg text-xs font-medium border ${
            feedback.type === "ok"
              ? "bg-[#eaf3e9] border-[#b7d6be] text-[#1e5631]"
              : "bg-[#f7e8e6] border-[#dca9a4] text-[#8f2f2a]"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-5 p-5 rounded-lg bg-white border border-[#e3ddd0] space-y-4">
          <p className="text-xs text-[#556358]">
            Only verified buyers of <strong>{productName}</strong> can submit a review. Enter your Order ID and the email address used at checkout.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rev-order-id" className="block text-xs font-semibold text-[#18231c] mb-1">
                Order ID
              </label>
              <input
                id="rev-order-id"
                type="text"
                required
                value={orderReference}
                onChange={(e) => setOrderReference(e.target.value)}
                placeholder="Order UUID from confirmation email"
                className="w-full px-3 py-2 text-sm border border-[#cfc8b8] rounded-md bg-[#fbf8f1]"
              />
            </div>
            <div>
              <label htmlFor="rev-email" className="block text-xs font-semibold text-[#18231c] mb-1">
                Checkout Email
              </label>
              <input
                id="rev-email"
                type="email"
                required
                value={reviewerEmail}
                onChange={(e) => setReviewerEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 text-sm border border-[#cfc8b8] rounded-md bg-[#fbf8f1]"
              />
            </div>
            <div>
              <label htmlFor="rev-name" className="block text-xs font-semibold text-[#18231c] mb-1">
                Your Display Name
              </label>
              <input
                id="rev-name"
                type="text"
                required
                minLength={2}
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="e.g. Ananya S."
                className="w-full px-3 py-2 text-sm border border-[#cfc8b8] rounded-md bg-[#fbf8f1]"
              />
            </div>
            <div>
              <label htmlFor="rev-rating" className="block text-xs font-semibold text-[#18231c] mb-1">
                Rating (1–5)
              </label>
              <select
                id="rev-rating"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-[#cfc8b8] rounded-md bg-[#fbf8f1]"
              >
                <option value={5}>5 Stars — Exceptional</option>
                <option value={4}>4 Stars — Very Good</option>
                <option value={3}>3 Stars — Good</option>
                <option value={2}>2 Stars — Fair</option>
                <option value={1}>1 Star — Poor</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="rev-title" className="block text-xs font-semibold text-[#18231c] mb-1">
              Review Headline
            </label>
            <input
              id="rev-title"
              type="text"
              required
              minLength={2}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Crisp floral aroma and clean finish"
              className="w-full px-3 py-2 text-sm border border-[#cfc8b8] rounded-md bg-[#fbf8f1]"
            />
          </div>

          <div>
            <label htmlFor="rev-body" className="block text-xs font-semibold text-[#18231c] mb-1">
              Your Tasting Experience
            </label>
            <textarea
              id="rev-body"
              rows={3}
              required
              minLength={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share how you brewed it and what stood out in the cup..."
              className="w-full px-3 py-2 text-sm border border-[#cfc8b8] rounded-md bg-[#fbf8f1]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-md bg-[#1d2a24] text-white text-xs font-bold hover:bg-[#23483a] disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Verifying purchase..." : "Submit Verified Review"}
          </button>
        </form>
      )}

      {reviews.length > 0 ? (
        <ul className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((rev) => (
            <li
              key={rev.id}
              className="p-4 rounded-lg bg-white border border-[#ece7dc] flex flex-col justify-between gap-2"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1" aria-label={`Rated ${rev.rating} out of 5`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={13}
                        className={
                          i < rev.rating
                            ? "fill-[#b36b3d] text-[#b36b3d]"
                            : "text-[#d6cfc2]"
                        }
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  {rev.verified_purchase && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#2e683f] bg-[#eaf3e9] px-2 py-0.5 rounded">
                      <ShieldCheck size={11} aria-hidden="true" />
                      Verified Buyer
                    </span>
                  )}
                </div>
                {rev.title && (
                  <h3 className="text-sm font-bold text-[#18231c] mb-1">{rev.title}</h3>
                )}
                <p className="text-xs text-[#4a5047] leading-relaxed">{rev.body}</p>
              </div>
              <div className="text-[11px] text-[#73786f] pt-2 border-t border-[#f4f0e8] flex items-center justify-between">
                <span className="font-semibold text-[#18231c]">{rev.reviewer_name}</span>
                {rev.created_at && <span>{rev.created_at.slice(0, 10)}</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-xs text-[#5a6655]">
          No verified customer reviews yet for {productName}. We never display unverified or synthetic ratings.
        </p>
      )}
    </section>
  );
}
