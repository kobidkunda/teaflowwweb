import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";

export function TrialHero() {
  return (
    <section className="trial-hero relative overflow-hidden bg-[#143b2f] text-[#f7f2eb] py-16 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="max-w-3xl space-y-4">
          <p className="eyebrow text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#ba8745]"><StorefrontText id="copy_b97ff4f9ed9f996e" fallback="INTRODUCING TEAFLOWW TRIALS — THE CHAI STALL EDITION" />
          </p>
          <h1 className="font-serif text-[38px] sm:text-[56px] leading-[1.08] font-normal tracking-tight"><StorefrontText id="copy_9da85deabc443968" fallback="Great chai begins with" /> <em className="italic text-[#d9a86c]"><StorefrontText id="copy_d3f12dbe38a0a94f" fallback="one good trial." /></em>
          </h1>
          <p className="text-[15px] sm:text-[18px] text-[#cfd7d1] leading-relaxed max-w-2xl"><StorefrontText id="copy_9e1d7945689b365a" fallback="Sample four distinct 50g craft tea profiles in your own kettle. No guessing. No wholesale commitments." />
          </p>
        </div>

        {/* 3 Stats Counters */}
        <div className="mt-12 grid grid-cols-3 gap-4 max-w-xl border-t border-[#2d5648] pt-8">
          <div>
            <strong className="block font-serif text-[32px] sm:text-[42px] leading-none text-[#ffffff]">4</strong>
            <span className="text-[12px] text-[#a9b5ac] uppercase font-bold tracking-wider mt-1 block"><StorefrontText id="copy_c130b32dc2fedc48" fallback="tea styles" /></span>
          </div>
          <div>
            <strong className="block font-serif text-[32px] sm:text-[42px] leading-none text-[#ffffff]"><StorefrontText id="copy_f2f97022576197fd" fallback="50g" /></strong>
            <span className="text-[12px] text-[#a9b5ac] uppercase font-bold tracking-wider mt-1 block"><StorefrontText id="copy_65c047aaca094525" fallback="each flavour" /></span>
          </div>
          <div>
            <strong className="block font-serif text-[32px] sm:text-[42px] leading-none text-[#ffffff]"><StorefrontText id="copy_c4662f26ee090df5" fallback="200g" /></strong>
            <span className="text-[12px] text-[#a9b5ac] uppercase font-bold tracking-wider mt-1 block"><StorefrontText id="copy_dc8392cc3fc406c4" fallback="total net weight" /></span>
          </div>
        </div>

        <div className="mt-6 text-[11px] tracking-widest text-[#ba8745] font-extrabold uppercase"><StorefrontText id="copy_6665c86f9abecc14" fallback="BREW." /><br/><StorefrontText id="copy_626e59db5d7f2004" fallback="TASTE." /><br/><StorefrontText id="copy_c72ee4fc96e0497f" fallback="DECIDE." />
        </div>
      </div>
    </section>
  );
}
