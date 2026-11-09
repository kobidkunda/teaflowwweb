import React from "react";

export function TrialHero() {
  return (
    <section className="trial-hero relative overflow-hidden bg-[#143b2f] text-[#f7f2eb] py-16 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="max-w-3xl space-y-4">
          <p className="eyebrow text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#ba8745]">
            INTRODUCING TEAFLOWW TRIALS — THE CHAI STALL EDITION
          </p>
          <h1 className="font-serif text-[38px] sm:text-[56px] leading-[1.08] font-normal tracking-tight">
            Great chai begins with <em className="italic text-[#d9a86c]">one good trial.</em>
          </h1>
          <p className="text-[15px] sm:text-[18px] text-[#cfd7d1] leading-relaxed max-w-2xl">
            Sample four distinct 50g craft tea profiles in your own kettle. No guessing. No wholesale commitments.
          </p>
        </div>

        {/* 3 Stats Counters */}
        <div className="mt-12 grid grid-cols-3 gap-4 max-w-xl border-t border-[#2d5648] pt-8">
          <div>
            <strong className="block font-serif text-[32px] sm:text-[42px] leading-none text-[#ffffff]">4</strong>
            <span className="text-[12px] text-[#a9b5ac] uppercase font-bold tracking-wider mt-1 block">tea styles</span>
          </div>
          <div>
            <strong className="block font-serif text-[32px] sm:text-[42px] leading-none text-[#ffffff]">50g</strong>
            <span className="text-[12px] text-[#a9b5ac] uppercase font-bold tracking-wider mt-1 block">each flavour</span>
          </div>
          <div>
            <strong className="block font-serif text-[32px] sm:text-[42px] leading-none text-[#ffffff]">200g</strong>
            <span className="text-[12px] text-[#a9b5ac] uppercase font-bold tracking-wider mt-1 block">total net weight</span>
          </div>
        </div>

        <div className="mt-6 text-[11px] tracking-widest text-[#ba8745] font-extrabold uppercase">
          BREW.<br/>TASTE.<br/>DECIDE.
        </div>
      </div>
    </section>
  );
}
