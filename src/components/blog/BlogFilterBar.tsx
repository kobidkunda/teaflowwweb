"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { Search, X, Sparkles } from "lucide-react";

export interface BlogFilterBarProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount: number;
}

export function BlogFilterBar({
  categories,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  totalCount,
}: BlogFilterBarProps) {
  return (
    <div className="mb-10 space-y-4">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#757c6f]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search guides, steeping recipes, terroirs..."
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-[#cfc8b8] focus:border-[#2c4e38] focus:ring-1 focus:ring-[#2c4e38] rounded-xl text-sm text-[#18231c] placeholder-[#8a9184] transition-all outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#757c6f] hover:text-[#18231c]"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Counter */}
        <div className="text-xs text-[#6e7468] font-medium flex items-center gap-1.5 self-end md:self-center">
          <Sparkles className="w-3.5 h-3.5 text-[#b36b3d]" />
          <span> <StorefrontText id="copy_d604310a789a1848" fallback="Showing" /> <strong className="text-[#18231c]">{totalCount}</strong> <StorefrontText id="copy_f0fc939fe7c82d81" fallback="curated article" /> {totalCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all ${
                isSelected
                  ? "bg-[#2c4e38] text-white shadow-sm"
                  : "bg-white border border-[#ded8cb] text-[#4d5348] hover:border-[#2c4e38] hover:text-[#18231c]"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
