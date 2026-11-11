"use client";

import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import type { Category } from "@/lib/storefront";

interface CategoryCirclesProps {
  categories: Category[];
}

export function CategoryCircles({ categories }: CategoryCirclesProps) {
  if (!categories || categories.length === 0) return null;

  // Filter out any hidden categories (is_active !== 0) and map display items
  const displayItems = categories
    .filter((c) => c && (c as { is_active?: number }).is_active !== 0)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      cover: c.cover_image_url || "/uploads/cat-green-tea.jpg",
    }));

  if (displayItems.length === 0) return null;

  return (
    <section className="tf-categories-strip" aria-label="Browse teas by category">
      <div className="container tf-categories-container">
        <div className="tf-categories-grid">
          {displayItems.map((cat) => (
            <Link
              key={cat.slug}
              href={`/shop?category=${encodeURIComponent(cat.name)}`}
              className="tf-category-circle-item group"
            >
              <div className="tf-category-circle-thumb">
                <Image
                  src={cat.cover}
                  alt={`${cat.name} thumbnail`}
                  width={96}
                  height={96}
                  sizes="96px"
                  loading="lazy"
                  className="tf-category-circle-img"
                />
              </div>
              <span className="tf-category-circle-name">{cat.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
