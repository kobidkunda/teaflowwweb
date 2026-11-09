"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import { ArrowRight, Compass } from "lucide-react";
import type { SitePlacement } from "@/lib/media";

interface LeafToCupTeaserProps {
  placement?: SitePlacement | null;
}

export function LeafToCupTeaser({ placement }: LeafToCupTeaserProps = {}) {
  const craftImage = placement?.image_url || "/images/craft/stage-01-plucking.jpg";
  const craftAlt = placement?.alt_text || "Teafloww interactive orthodox tea craft preview";
  const craftTitle = placement?.title || "From fresh harvest to your cup.";
  const craftSubtitle = placement?.subtitle || "Follow the 7 stages of orthodox tea.";
  const craftCtaLabel = placement?.cta_label || "Explore Leaf to Cup Journey";
  const craftCtaHref = placement?.cta_href || "/leaf-to-cup";

  return (
    <section
      className="w-full py-16 bg-[#10261f] text-[#f6f2e8] relative overflow-hidden"
      aria-label="From Leaf to Cup interactive craft story teaser"
    >
      {/* Background Subtle Gradient & Grain */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1d3f32] via-[#10261f] to-[#0a1813] opacity-80 pointer-events-none z-0" />

      <div className="relative z-[1] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Copy Side */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e3c2f] border border-[#3b5e4c] text-xs font-bold uppercase tracking-[0.2em] text-[#d4c5a6] mb-5">
              <Compass size={13} className="text-[#c1a376]" />
              <span> <StorefrontText id="copy_484dbb9aa7779a52" fallback="Interactive Story" /> </span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight text-white mb-5">
              {craftTitle}
              <br />
              <em className="text-[#c1a376] not-italic font-normal">
                {craftSubtitle}
              </em>
            </h2>

            <p className="text-base sm:text-lg text-[#c8d1c5] leading-relaxed max-w-2xl mb-8"> <StorefrontText id="copy_94589d7a6cdd7dc3" fallback="Before the first sip, there is an entire mountain story. Discover how fresh green shoots are hand-harvested, withered, rolled, oxidised, fired, and graded into world-renowned Himalayan loose leaves." /> </p>

            {/* Stages Pipeline Preview: Connected flow that never orphans trailing arrows */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-mono text-[#b3c2b1] mb-8">
              {[
                { num: "01", name: "Plucking" },
                { num: "02", name: "Withering" },
                { num: "03", name: "Rolling" },
                { num: "04", name: "Oxidation" },
                { num: "05", name: "Drying" },
                { num: "06", name: "Sorting" },
                { num: "07", name: "Brewing" },
              ].map((stage, idx, arr) => {
                const isFinal = idx === arr.length - 1;
                return (
                  <div key={stage.num} className="inline-flex items-center gap-1.5 sm:gap-2">
                    <span
                      className={`px-2.5 py-1 rounded border transition-colors ${
                        isFinal
                          ? "bg-[#1f4233] border-[#3e684f] text-[#e8d2a6] font-semibold"
                          : "bg-[#173327]/90 border-[#264c39] text-[#b3c2b1]"
                      }`}
                    >
                      <span className={`${isFinal ? "text-[#f3e3be]" : "text-[#d8ede2]"} font-medium mr-1`}>{stage.num}</span>
                      <span>{stage.name}</span>
                    </span>
                    {!isFinal && (
                      <span className="text-[#597564] select-none text-[11px]" aria-hidden="true">
                        →
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <Link
              href={craftCtaHref}
              className="tf-leaf-to-cup-btn inline-flex items-center gap-3 px-7 py-3.5 rounded-full bg-[#ead8b6] text-[#142d24] font-bold text-sm tracking-wide hover:bg-[#fae8c8] hover:text-[#0f211a] hover:translate-x-1 transition-all duration-200 shadow-lg border border-[#dcc69e] group"
            >
              <span>{craftCtaLabel}</span>
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Visual Preview Side */}
          <div className="lg:col-span-5">
            <Link
              href={craftCtaHref}
              className="group block relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-[#2c4e3b] shadow-2xl bg-[#142d24] transition-all duration-300 hover:border-[#c1a376]/50 hover:shadow-[0_12px_36px_rgba(0,0,0,0.4)]"
            >
              <Image
                src={craftImage}
                alt={craftAlt}
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                loading="lazy"
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#d4c5a6] block mb-0.5"> <StorefrontText id="copy_643c57809d2c0713" fallback="Interactive Scrollytelling" /> </span>
                  <strong className="text-white text-base font-serif"> <StorefrontText id="copy_abac3709ece3f63a" fallback="The Art of Orthodox Tea" /> </strong>
                </div>
                <span className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-[#ead8b6] group-hover:text-[#142d24] transition-all duration-300 group-hover:scale-110 shadow-md">
                  <ArrowRight size={18} className="transition-colors group-hover:text-[#142d24]" />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
