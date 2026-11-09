import React from "react";

export function ValueHighlights() {
  const highlights = [
    {
      title: "Single Estate",
      subtitle: "Direct Sourced",
      icon: (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {/* Hand cradling estate leaf */}
          <path d="M12 2a9 9 0 0 0-9 9c0 4.97 4.03 9 9 9 4.97 0 9-4.03 9-9A9 9 0 0 0 12 2Z" opacity="0.2" fill="currentColor" />
          <path d="M12 3v14" />
          <path d="M12 7c2.5-2.5 5.5-1.5 7 1-1.5 2.5-4.5 2.5-7-1Z" />
          <path d="M12 11c-2.5-2.5-5.5-1.5-7 1 1.5 2.5 4.5 2.5 7-1Z" />
          <path d="M7 19c2 2 8 2 10 0" />
        </svg>
      ),
    },
    {
      title: "First Flush",
      subtitle: "Harvest",
      icon: (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {/* Sprout / first spring harvest leaves */}
          <path d="M12 22v-9" />
          <path d="M12 13c-3-4-8-3-9 2 4 1 8-1 9-2Z" />
          <path d="M12 9c3-4 8-3 9 2-4 1-8-1-9-2Z" />
          <path d="M12 6V2" />
        </svg>
      ),
    },
    {
      title: "100% Natural",
      subtitle: "No Additives",
      icon: (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {/* Natural leaf with sparkle purity */}
          <path d="M11 20A7 7 0 0 1 4 13C4 7 11 3 11 3s7 4 7 10a7 7 0 0 1-7 7Z" />
          <path d="M11 9v7" />
          <path d="M18 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />
        </svg>
      ),
    },
    {
      title: "Small Batch",
      subtitle: "Crafted",
      icon: (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {/* Hands holding crafted artisan leaf */}
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <circle cx="12" cy="16" r="1.5" />
        </svg>
      ),
    },
    {
      title: "Lab Tested",
      subtitle: "For Quality",
      icon: (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {/* Scientific test flask */}
          <path d="M10 2v5.5L4.5 18A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3L14 7.5V2" />
          <path d="M8.5 2h7" />
          <path d="M7 16h10" />
          <circle cx="10" cy="18.5" r="0.5" fill="currentColor" />
          <circle cx="13.5" cy="17.5" r="0.75" fill="currentColor" />
        </svg>
      ),
    },
  ];

  return (
    <section
      className="value-highlights w-full bg-[#faf7f0] border-y border-[#ded8cb] py-7 my-8"
      aria-label="Quality and sourcing commitments"
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 text-center">
          {highlights.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center justify-center p-2 group transition-transform hover:-translate-y-0.5"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-[#254631] mb-2.5 transition-colors group-hover:text-[#183222]">
                {item.icon}
              </div>
              <strong className="text-sm font-semibold text-[#18231c] tracking-tight block">
                {item.title}
              </strong>
              <span className="text-xs text-[#63685f] block mt-0.5 font-normal">
                {item.subtitle}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ValueHighlights;
