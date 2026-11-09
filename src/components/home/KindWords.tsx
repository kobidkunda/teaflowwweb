import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import Image from "next/image";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { Star, ArrowRight } from "lucide-react";

export interface ReviewItem {
  id: number | string;
  quote: string;
  name: string;
  avatar: string;
}

export interface KindWordsProps {
  eyebrow?: string;
  title?: string;
  reviews?: ReviewItem[];
}

export function KindWords({
  eyebrow = "KIND WORDS",
  title = "Good tea brings good company.",
  reviews,
}: KindWordsProps = {}) {
  const displayReviews = reviews && reviews.length > 0 ? reviews : [];
  if (displayReviews.length === 0) return null;

  return (
    <section className="tf-kind-words-section" aria-label="Customer reviews and kind words">
      <div className="container">
        {/* Header row */}
        <div className="tf-kind-words-header">
          <div className="tf-kind-words-title-col">
            <span className="eyebrow">{eyebrow}</span>
            <div className="tf-kind-words-h2-wrap">
              <h2 className="tf-kind-words-h2">
                {title.includes("good company") ? (
                  <> <StorefrontText id="copy_43a61ccc32598676" fallback="Good tea brings" /> <em> <StorefrontText id="copy_3426116ad67abc6d" fallback="good company." /> </em></>
                ) : (
                  title
                )}
              </h2>
            </div>
          </div>
          <Link href="/shop" className="tf-reviews-link"> <StorefrontText id="copy_e7e510a403c85180" fallback="Read more reviews" /> <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {/* 3 Review cards grid with left botanical sketch decoration */}
        <div className="tf-reviews-wrapper">
          <div className="tf-reviews-botanical-art" aria-hidden="true">
            <svg width="120" height="180" viewBox="0 0 120 180" fill="none" stroke="#7e8c75" strokeWidth="1.5">
              <path d="M10 170 C30 120 50 80 80 10" />
              <path d="M35 120 C50 110 70 115 80 130 C65 140 45 135 35 120 Z" fill="#8f9d85" fillOpacity="0.25" />
              <path d="M50 80 C40 60 45 40 60 30 C70 45 65 65 50 80 Z" fill="#8f9d85" fillOpacity="0.25" />
              <path d="M65 50 C80 40 100 45 105 60 C90 70 75 65 65 50 Z" fill="#8f9d85" fillOpacity="0.25" />
              <path d="M20 150 C10 135 15 120 30 115 C35 130 30 145 20 150 Z" fill="#8f9d85" fillOpacity="0.25" />
            </svg>
          </div>

          <div className="tf-reviews-grid">
            {displayReviews.map((rev) => (
              <article key={rev.id} className="tf-review-card">
                <blockquote className="tf-review-quote">
                  &ldquo;{rev.quote}&rdquo;
                </blockquote>
                <div className="tf-review-stars" aria-label="5 out of 5 stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={13} fill="#d99b38" stroke="#d99b38" />
                  ))}
                </div>
                <div className="tf-review-author">
                  <div className="tf-review-avatar-wrap">
                    <Image
                      src={rev.avatar}
                      alt={`Customer portrait of ${rev.name}`}
                      width={38}
                      height={38}
                      sizes="38px"
                      loading="lazy"
                      className="tf-review-avatar"
                    />
                  </div>
                  <cite className="tf-review-name">{rev.name}</cite>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
