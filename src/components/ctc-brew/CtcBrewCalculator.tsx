"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState } from "react";
import {
  Sliders,
  Droplet,
  Coffee,
  Sparkles,
  Flame,
  CheckCircle2,
  Timer,
  ChevronDown,
} from "lucide-react";

interface MethodConfig {
  id: string;
  name: string;
  waterPerCup: number; // ml
  milkPerCup: number; // ml
  teaGramsPerCup: number; // g
  brewMinutes: number;
  flameTip: string;
  spices: string;
}

const METHODS_CONFIG: Record<string, MethodConfig> = {
  kadak: {
    id: "kadak",
    name: "Classic Kadak",
    waterPerCup: 120,
    milkPerCup: 120,
    teaGramsPerCup: 3.5,
    brewMinutes: 5,
    flameTip: "Rolling boil with milk, drop flame twice as froth crests.",
    spices: "Optional 1 cracked cardamom pod.",
  },
  masala: {
    id: "masala",
    name: "Royal Masala",
    waterPerCup: 140,
    milkPerCup: 100,
    teaGramsPerCup: 4.0,
    brewMinutes: 6,
    flameTip: "Boil water with crushed spices for 2 minutes before adding CTC.",
    spices: "Cardamom, fresh ginger, cinnamon quill, clove & black pepper.",
  },
  kulhad: {
    id: "kulhad",
    name: "Kolkata Kulhad",
    waterPerCup: 100,
    milkPerCup: 140,
    teaGramsPerCup: 4.5,
    brewMinutes: 5,
    flameTip: "High-flame surging boil, ladle and aerate 3 times from height.",
    spices: "Crushed green cardamom and bruised ginger.",
  },
  sulaimani: {
    id: "sulaimani",
    name: "Citrus Sulaimani (No Milk)",
    waterPerCup: 220,
    milkPerCup: 0,
    teaGramsPerCup: 2.5,
    brewMinutes: 3,
    flameTip: "Gentle 2-minute steep off direct flame. Stir in lemon juice last.",
    spices: "Cinnamon, cardamom pod, fresh lemon juice & mint.",
  },
  adrak: {
    id: "adrak",
    name: "Adrak-Tulsi Tonic",
    waterPerCup: 150,
    milkPerCup: 90,
    teaGramsPerCup: 3.5,
    brewMinutes: 6,
    flameTip: "Pound ginger and tulsi in mortar; boil in water for 3m before milk.",
    spices: "Fresh juicy root ginger & whole holy basil (tulsi) leaves.",
  },
  iced: {
    id: "iced",
    name: "Iced CTC Latte",
    waterPerCup: 90,
    milkPerCup: 140,
    teaGramsPerCup: 6.0,
    brewMinutes: 4,
    flameTip: "Flash-brew double concentrate hot; pour directly over glass of ice.",
    spices: "Cardamom, cinnamon powder dust, sweetened condensed milk.",
  },
  butter: {
    id: "butter",
    name: "Himalayan Butter Mountain",
    waterPerCup: 160,
    milkPerCup: 80,
    teaGramsPerCup: 4.5,
    brewMinutes: 7,
    flameTip: "Whisk or churn dark hot decoction with butter & pink salt for 30s.",
    spices: "Pink rock salt, fresh unsalted butter or cultured ghee.",
  },
};

export function CtcBrewCalculator() {
  const [selectedMethod, setSelectedMethod] = useState<string>("kadak");
  const [cups, setCups] = useState<number>(2);
  const [strength, setStrength] = useState<"mild" | "balanced" | "extra">("balanced");
  const [milkType, setMilkType] = useState<string>("whole");
  const [sweetener, setSweetener] = useState<string>("sugar");

  const method = METHODS_CONFIG[selectedMethod] || METHODS_CONFIG.kadak;

  // Strength multiplier
  const strengthFactor = strength === "mild" ? 0.85 : strength === "extra" ? 1.3 : 1.0;

  // Total calculations
  const totalWater = Math.round(method.waterPerCup * cups);
  const totalMilk = Math.round(method.milkPerCup * cups);
  const totalTeaGrams = (method.teaGramsPerCup * cups * strengthFactor).toFixed(1);
  const teaTeaspoons = (Number(totalTeaGrams) / 2.3).toFixed(1);

  return (
    <section
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-[#ded9cb]"
      aria-labelledby="calculator-heading"
    >
      {/* Intro Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#e8e2d4] text-[#2c4e38] text-xs font-bold uppercase tracking-[0.2em] mb-4">
          <Sliders size={14} className="text-[#a47148]" />
          <span> <StorefrontText id="copy_dc3bbde4d8141d2d" fallback="Interactive Ratio Customizer" /> </span>
        </div>
        <h2
          id="calculator-heading"
          className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#18231c] tracking-tight mb-4"
        > <StorefrontText id="copy_2b4799f8f7666442" fallback="Craft Your Exact Cup Profile" /> </h2>
        <p className="text-base text-[#5c685b] leading-relaxed"> <StorefrontText id="copy_7928571b5526c41d" fallback="Dial in your preferred method, cup count, strength, and milk choice. Our dynamic algorithm computes the ideal water-to-milk ratio and boiling timeline to ensure balanced extraction without astringency." /> </p>
      </div>

      {/* Main Interactive Tool Card */}
      <div className="bg-[#11241c] text-[#f7f5ee] rounded-3xl p-6 sm:p-10 border border-[#234233] shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Controls Column (Left 7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Method Selector */}
            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-[#d6c7a9] font-bold mb-3"> <StorefrontText id="copy_d735dcc47d6c8712" fallback="1. Select Brewing Method" /> </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.values(METHODS_CONFIG).map((m) => {
                  const isSelected = m.id === selectedMethod;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      className={`p-3 rounded-xl text-left border text-xs font-semibold transition-all ${
                        isSelected
                          ? "bg-[#254636] border-[#d8bb88] text-white shadow-md ring-1 ring-[#d8bb88]"
                          : "bg-[#162f25] border-[#224032] text-[#c2cfbf] hover:bg-[#1b382c] hover:text-white"
                      }`}
                    >
                      <span className="block font-medium truncate">{m.name}</span>
                      <span className="text-[10px] opacity-75 font-mono">
                        {m.brewMinutes} <StorefrontText id="copy_891f4f2ad349b029" fallback="m boil" /> </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Cup Count Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase tracking-[0.18em] text-[#d6c7a9] font-bold"> <StorefrontText id="copy_3a42da739678b889" fallback="2. Number of Cups" /> </label>
                <span className="text-sm font-mono text-[#d8bb88] font-bold">
                  {cups} {cups === 1 ? "Cup" : "Cups"} <StorefrontText id="copy_2a2ad0558452a5f9" fallback="(180ml each)" /> </span>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCups(num)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-mono transition-all ${
                      cups === num
                        ? "bg-[#d8bb88] text-[#11241c] shadow-md scale-[1.02]"
                        : "bg-[#162f25] border border-[#224032] text-[#dce4d9] hover:bg-[#1b382c]"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Desired Strength */}
            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-[#d6c7a9] font-bold mb-2"> <StorefrontText id="copy_c357fc2aacf8ad33" fallback="3. Desired Strength" /> </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "mild", label: "Mild & Mellow", hint: "-15% tea granules" },
                  { id: "balanced", label: "Classic Balanced", hint: "Standard ratio" },
                  { id: "extra", label: "Extra Kadak", hint: "+30% robust intensity" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStrength(s.id as "mild" | "balanced" | "extra")}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      strength === s.id
                        ? "bg-[#254636] border-[#d8bb88] text-white"
                        : "bg-[#162f25] border-[#224032] text-[#c2cfbf] hover:bg-[#1b382c]"
                    }`}
                  >
                    <span className="block text-xs font-bold">{s.label}</span>
                    <span className="text-[10px] text-[#9db09a]">{s.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Milk & Sweetener Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-[0.18em] text-[#d6c7a9] font-bold mb-1.5"> <StorefrontText id="copy_8189b395d3a9428b" fallback="Milk Preference" /> </label>
                <div className="relative">
                  <select
                    value={milkType}
                    onChange={(e) => setMilkType(e.target.value)}
                    className="w-full bg-[#162f25] border border-[#224032] text-xs text-[#f3eedd] rounded-xl px-3 py-2.5 appearance-none focus:outline-none focus:border-[#d8bb88]"
                  >
                    <option value="whole">Whole Cow Milk (3.5% Fat)</option>
                    <option value="buffalo">Buffalo Milk (Creamy Dhaba Style, 6% Fat)</option>
                    <option value="oat">Barista Oat Milk (Silky Dairy-Free)</option>
                    <option value="almond">Almond / Soy Milk</option>
                    <option value="none">Zero Milk (Clear Decoction)</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#a5b8a3]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.18em] text-[#d6c7a9] font-bold mb-1.5"> <StorefrontText id="copy_99eb70285a3b1c57" fallback="Sweetener" /> </label>
                <div className="relative">
                  <select
                    value={sweetener}
                    onChange={(e) => setSweetener(e.target.value)}
                    className="w-full bg-[#162f25] border border-[#224032] text-xs text-[#f3eedd] rounded-xl px-3 py-2.5 appearance-none focus:outline-none focus:border-[#d8bb88]"
                  >
                    <option value="sugar">Unrefined Cane Sugar (Classic)</option>
                    <option value="jaggery">Desi Jaggery / Gur (Add off flame)</option>
                    <option value="honey">Raw Mountain Honey (Post-strain)</option>
                    <option value="condensed">Sweetened Condensed Milk</option>
                    <option value="none">Unsweetened (Zero Sugar)</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#a5b8a3]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results Blueprint Card (Right 5 Cols) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#18362a] to-[#12281e] rounded-2xl p-6 border border-[#294c3c] shadow-inner">
            <div className="flex items-center justify-between pb-3 border-b border-[#294c3c] mb-5">
              <span className="text-xs uppercase tracking-[0.2em] text-[#d8bb88] font-bold flex items-center gap-1.5">
                <Sparkles size={14} /> <StorefrontText id="copy_4e1fd0be76c5e09f" fallback="Calculated Recipe" /> </span>
              <span className="text-xs font-mono text-[#a5b8a3]">
                {method.name} ({cups} {cups === 1 ? "Cup" : "Cups"})
              </span>
            </div>

            {/* Metric Big Badges */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-[#0f211a] p-3.5 rounded-xl border border-[#234233]">
                <span className="text-[10px] uppercase tracking-wider text-[#9db09a] block mb-1 flex items-center gap-1">
                  <Droplet size={11} className="text-[#6495ed]" /> <StorefrontText id="copy_a0f3fd5c71b09ab0" fallback="Spring Water" /> </span>
                <span className="text-2xl font-mono font-bold text-white">
                  {totalWater} <span className="text-xs font-normal text-[#a5b8a3]">ml</span>
                </span>
              </div>

              <div className="bg-[#0f211a] p-3.5 rounded-xl border border-[#234233]">
                <span className="text-[10px] uppercase tracking-wider text-[#9db09a] block mb-1 flex items-center gap-1">
                  <Droplet size={11} className="text-[#f7e7ce]" />
                  {milkType === "none" ? "Milk (Omitted)" : "Milk"}
                </span>
                <span className="text-2xl font-mono font-bold text-white">
                  {milkType === "none" ? 0 : totalMilk}{" "}
                  <span className="text-xs font-normal text-[#a5b8a3]">ml</span>
                </span>
              </div>

              <div className="bg-[#0f211a] p-3.5 rounded-xl border border-[#234233] col-span-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-[#9db09a] block mb-1 flex items-center gap-1">
                    <Coffee size={11} className="text-[#d8bb88]" /> <StorefrontText id="copy_45c610e862d32bc1" fallback="CTC Black Tea Granules" /> </span>
                  <span className="text-xs font-mono text-[#d8bb88]"> <StorefrontText id="copy_5597c98cd7820717" fallback="approx." /> {teaTeaspoons} <StorefrontText id="copy_a8c690fa56e35a3b" fallback="level tsp" /> </span>
                </div>
                <span className="text-3xl font-mono font-bold text-[#ecd8b5]">
                  {totalTeaGrams} <span className="text-sm font-normal text-[#a5b8a3]"> <StorefrontText id="copy_7c06c42706d532ba" fallback="grams" /> </span>
                </span>
              </div>
            </div>

            {/* Brewing Steps Summary */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-2.5 text-xs text-[#dce4d9]">
                <Timer size={15} className="text-[#d8bb88] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block"> <StorefrontText id="copy_71c4c4be3208107b" fallback="Extraction Duration:" /> </strong>
                  <span>{method.brewMinutes} <StorefrontText id="copy_d8c30988bf24edb5" fallback="minutes total cooking time" /> </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-[#dce4d9]">
                <Flame size={15} className="text-[#e29362] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block"> <StorefrontText id="copy_9564fc644c9f3057" fallback="Heat Management:" /> </strong>
                  <span>{method.flameTip}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-[#dce4d9]">
                <CheckCircle2 size={15} className="text-[#98d488] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Aromatics &amp; Spices:</strong>
                  <span>{method.spices}</span>
                </div>
              </div>
            </div>

            {/* Jaggery Alert if Jaggery is selected */}
            {sweetener === "jaggery" && (
              <div className="mt-4 p-2.5 rounded-lg bg-[#3a2916] border border-[#785323] text-[11px] text-[#f7e0b5]">
                <strong> <StorefrontText id="copy_496d6960431c6302" fallback="Important:" /> </strong> <StorefrontText id="copy_17ec4ff6b99d570d" fallback="Add desi jaggery (gur) strictly AFTER taking the pan off the flame and straining to prevent milk curdling." /> </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
