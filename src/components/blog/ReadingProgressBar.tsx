"use client";

import React, { useState, useEffect } from "react";

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const totalHeight =
            document.documentElement.scrollHeight - window.innerHeight;
          if (totalHeight > 0) {
            const currentScroll = window.scrollY;
            const percentage = Math.min(
              100,
              Math.max(0, (currentScroll / totalHeight) * 100)
            );
            setProgress(percentage);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 z-50 pointer-events-none bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-[#2c4e38] via-[#467354] to-[#c69255] transition-[width] duration-150 ease-out shadow-[0_0_8px_rgba(70,115,84,0.5)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
