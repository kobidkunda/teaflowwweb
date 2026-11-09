"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useEffect } from "react";
import { ListFilter, ChevronDown } from "lucide-react";

export interface TocItem {
  level: number;
  text: string;
  slug: string;
}

export function TableOfContents({ headings }: { headings: TocItem[] }) {
  const [activeSlug, setActiveSlug] = useState<string>(headings[0]?.slug || "");
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  useEffect(() => {
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id);
            break;
          }
        }
      },
      {
        rootMargin: "-80px 0% -60% 0%",
        threshold: 0,
      }
    );

    for (const h of headings) {
      const el = document.getElementById(h.slug);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (!headings || headings.length === 0) return null;

  return (
    <nav
      className="toc-container bg-[#fcfbf9] border border-[#ebe5d8] rounded-xl p-5 mb-8 lg:mb-0 lg:sticky lg:top-24 max-h-[calc(100vh-8rem)] overflow-y-auto"
      aria-label="Table of Contents"
    >
      <div className="flex items-center justify-between pb-3 border-b border-[#eee8db]">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2c4e38]">
          <ListFilter className="w-3.5 h-3.5" />
          <span> <StorefrontText id="copy_3979ebce26145af0" fallback="In This Article" /> </span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpenMobile((prev) => !prev)}
          className="lg:hidden text-xs text-[#52594e] flex items-center gap-1 font-medium hover:text-[#18231c]"
          aria-expanded={isOpenMobile}
        >
          <span>{isOpenMobile ? "Hide" : "Show"}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpenMobile ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      <ul
        className={`mt-4 space-y-2 text-xs leading-relaxed ${
          isOpenMobile ? "block" : "hidden lg:block"
        }`}
      >
        {headings.map((item) => {
          const isActive = activeSlug === item.slug;
          const paddingLeft =
            item.level === 3 ? "pl-5" : item.level === 2 ? "pl-2" : "pl-0";

          return (
            <li key={item.slug} className={paddingLeft}>
              <a
                href={`#${item.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  const target = document.getElementById(item.slug);
                  if (target) {
                    target.scrollIntoView({ behavior: "smooth", block: "start" });
                    setActiveSlug(item.slug);
                    setIsOpenMobile(false);
                    history.pushState(null, "", `#${item.slug}`);
                  }
                }}
                className={`block py-1 transition-colors duration-200 border-l-2 -ml-2 pl-3 ${
                  isActive
                    ? "border-[#2c4e38] text-[#18231c] font-semibold bg-[#f4efe4]/50 rounded-r"
                    : "border-transparent text-[#61685d] hover:text-[#18231c] hover:border-[#cfc8b8]"
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
