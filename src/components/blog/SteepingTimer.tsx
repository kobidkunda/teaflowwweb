"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Flame, Droplets, Clock, Sparkles } from "lucide-react";

export interface SteepingTimerProps {
  title?: string;
  temp_c?: number;
  time_seconds?: number;
  dose_g?: number;
  water_ml?: number;
  steeps?: number;
  notes?: string;
  tips?: string;
}

export function SteepingTimer({
  title = "Interactive Steeping Ritual",
  temp_c = 95,
  time_seconds = 180,
  dose_g = 2.5,
  water_ml = 200,
  steeps = 3,
  notes,
  tips,
}: SteepingTimerProps) {
  const totalSeconds = time_seconds;
  const [remaining, setRemaining] = useState(time_seconds);
  const [isRunning, setIsRunning] = useState(false);
  const [useFahrenheit, setUseFahrenheit] = useState(false);
  const [currentSteep, setCurrentSteep] = useState(1);
  const [isFinished, setIsFinished] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Play gentle completion chime via Web Audio API
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            setIsFinished(true);
            setCurrentSteep((s) => Math.min(s + 1, steeps));
            playChime();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const toggleTimer = () => {
    if (remaining === 0) {
      setRemaining(totalSeconds);
      setIsFinished(false);
    }
    setIsRunning((prev) => !prev);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setRemaining(totalSeconds);
    setIsFinished(false);
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const progressPercent = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;
  const tempDisplay = useFahrenheit
    ? `${Math.round((temp_c * 9) / 5 + 32)}°F`
    : `${temp_c}°C`;

  return (
    <div className="my-8 p-6 sm:p-8 bg-[#fdfcf9] border-2 border-[#e6decb] rounded-2xl shadow-sm relative overflow-hidden">
      {/* Background visual water mark */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#eee8db]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2c4e38] mb-1">
            <Clock className="w-3.5 h-3.5 text-[#b36b3d]" />
            <span> <StorefrontText id="copy_8b369865c29b6452" fallback="Steeping Assistant" /> </span>
          </div>
          <h4 className="font-serif text-xl sm:text-2xl font-bold text-[#18231c]">
            {title}
          </h4>
        </div>

        {/* Temperature unit toggle */}
        <button
          type="button"
          onClick={() => setUseFahrenheit((prev) => !prev)}
          className="text-xs px-3 py-1 bg-white border border-[#cfc8b8] rounded-full text-[#52594e] font-medium hover:border-[#18231c] transition-colors"
          title="Switch temperature unit"
        > <StorefrontText id="copy_e979ce75295d1369" fallback="Viewing:" /> <span className="font-bold text-[#18231c]">{useFahrenheit ? "°F" : "°C"}</span> <StorefrontText id="copy_3287d8b4da2d3462" fallback="(toggle)" /> </button>
      </div>

      {/* Steeping Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
        <div className="p-3.5 bg-white border border-[#ede7dc] rounded-xl text-center">
          <div className="flex items-center justify-center gap-1 text-[#b36b3d] mb-1">
            <Flame className="w-4 h-4" />
            <span className="text-[11px] uppercase tracking-wider font-semibold"> <StorefrontText id="copy_0fc4ba1b38380d98" fallback="Water Temp" /> </span>
          </div>
          <div className="font-serif text-lg font-bold text-[#18231c]">{tempDisplay}</div>
        </div>

        <div className="p-3.5 bg-white border border-[#ede7dc] rounded-xl text-center">
          <div className="flex items-center justify-center gap-1 text-[#2c4e38] mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-[11px] uppercase tracking-wider font-semibold"> <StorefrontText id="copy_1bafe6aea1c88b15" fallback="Leaf Dose" /> </span>
          </div>
          <div className="font-serif text-lg font-bold text-[#18231c]">{dose_g} <StorefrontText id="copy_b2de9ad2e6f3ebe2" fallback="g (~1 tsp)" /> </div>
        </div>

        <div className="p-3.5 bg-white border border-[#ede7dc] rounded-xl text-center">
          <div className="flex items-center justify-center gap-1 text-[#2c4e38] mb-1">
            <Droplets className="w-4 h-4" />
            <span className="text-[11px] uppercase tracking-wider font-semibold"> <StorefrontText id="copy_05b23e37fee1d40a" fallback="Water Volume" /> </span>
          </div>
          <div className="font-serif text-lg font-bold text-[#18231c]">{water_ml} ml</div>
        </div>

        <div className="p-3.5 bg-white border border-[#ede7dc] rounded-xl text-center">
          <div className="flex items-center justify-center gap-1 text-[#52594e] mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-[11px] uppercase tracking-wider font-semibold"> <StorefrontText id="copy_3fa1e3b887801bf2" fallback="Infusions" /> </span>
          </div>
          <div className="font-serif text-lg font-bold text-[#18231c]">{steeps} <StorefrontText id="copy_7d7dbf00f6abe870" fallback="steeps" /> </div>
        </div>
      </div>

      {/* Timer Display & Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 bg-white border border-[#e4ded0] rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="34"
                stroke="#ece7dc"
                strokeWidth="6"
                fill="none"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                stroke={isFinished ? "#b36b3d" : "#2c4e38"}
                strokeWidth="6"
                strokeDasharray="213.6"
                strokeDashoffset={213.6 - (213.6 * progressPercent) / 100}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-300"
              />
            </svg>
            <span className="absolute font-mono text-base font-bold text-[#18231c]">
              {formattedTime}
            </span>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-[#686f64] font-medium">
              {isFinished
                ? "Steeping Complete! Decant liquor fully."
                : isRunning
                ? "Extracting aromatics & liquor..."
                : "Ready to infuse"}
            </div>
            <div className="text-sm font-semibold text-[#18231c]"> <StorefrontText id="copy_28418298f5689745" fallback="Infusion #" /> {currentSteep} of {steeps}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={toggleTimer}
            className={`flex-1 sm:flex-initial px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all ${
              isRunning
                ? "bg-[#b36b3d] text-white hover:bg-[#975429]"
                : "bg-[#2c4e38] text-white hover:bg-[#1f3827]"
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                <span> <StorefrontText id="copy_858e4ba7a29fd38b" fallback="Pause" /> </span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>{remaining === 0 ? "Restart" : "Start Timer"}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={resetTimer}
            className="p-3 bg-[#f7f5f0] border border-[#cfc8b8] rounded-xl hover:bg-[#eee8dc] text-[#52594e] transition-colors"
            title="Reset Timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {(tips || notes) && (
        <div className="mt-4 text-xs text-[#52594e] bg-[#f8f6f0] p-4 rounded-xl border border-[#ede7dc] leading-relaxed">
          <strong className="text-[#18231c] font-semibold"> <StorefrontText id="copy_3d15b547031030c9" fallback="Steeping Wisdom:" /> </strong>
          {tips || notes}
        </div>
      )}
    </div>
  );
}
