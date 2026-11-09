"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState } from "react";
import { BarChart3, PieChart, Layers } from "lucide-react";

export interface ChartDatum {
  label: string;
  value: number;
  secondaryValue?: number;
  unit?: string;
  color?: string;
}

export interface TeaChartProps {
  type?: "bar" | "radar" | "comparison" | string;
  title: string;
  subtitle?: string;
  data?: ChartDatum[];
  unit?: string;
  scores?: Record<string, number>;
  compareItems?: Array<{
    feature: string;
    orthodox: string;
    ctc: string;
    highlight?: boolean;
  }>;
}

export function TeaChart({
  type = "bar",
  title,
  subtitle,
  data = [],
  unit = "",
  scores,
  compareItems,
}: TeaChartProps) {
  const [activeItem, setActiveItem] = useState<string | null>(null);

  // 1. Radar Chart implementation for cupping notes
  if (type === "radar" || scores) {
    const categories = [
      { key: "floral", label: "Floral", defaultVal: 4 },
      { key: "fruity", label: "Fruity", defaultVal: 3 },
      { key: "malty", label: "Malty", defaultVal: 5 },
      { key: "body", label: "Body", defaultVal: 4 },
      { key: "sweetness", label: "Sweetness", defaultVal: 4 },
      { key: "earthy", label: "Earthy", defaultVal: 2 },
    ];

    const currentScores = scores || {};
    const values = categories.map((c) => currentScores[c.key] ?? c.defaultVal);
    const size = 300;
    const center = size / 2;
    const radius = 100;
    const angleStep = (Math.PI * 2) / categories.length;

    // Calculate radar polygon points
    const points = values.map((val, idx) => {
      const angle = idx * angleStep - Math.PI / 2;
      const normalized = Math.min(Math.max(val, 0), 5) / 5;
      const r = normalized * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    });
    const polygonString = points.join(" ");

    // Axis grid polygons for levels 1 to 5
    const gridLevels = [1, 2, 3, 4, 5];

    return (
      <figure className="my-8 p-6 sm:p-8 bg-gradient-to-b from-[#fcfbf9] to-[#f7f4ed] border border-[#e8e2d4] rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <PieChart className="w-4 h-4 text-[#2c4e38]" />
          <figcaption className="font-serif text-lg sm:text-xl font-bold text-[#18231c]">
            {title || "Sensory Flavour Profile & Cupping Radar"}
          </figcaption>
        </div>
        {subtitle && (
          <p className="text-xs text-[#5f665a] mb-6 leading-relaxed">
            {subtitle}
          </p>
        )}

        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-4">
          <div className="relative w-[300px] h-[300px] flex-shrink-0">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full overflow-visible"
              aria-label={`Radar chart: ${title}`}
            >
              {/* Concentric spider rings */}
              {gridLevels.map((lvl) => {
                const ringRadius = (lvl / 5) * radius;
                const ringPoints = categories
                  .map((_, i) => {
                    const angle = i * angleStep - Math.PI / 2;
                    const x = center + ringRadius * Math.cos(angle);
                    const y = center + ringRadius * Math.sin(angle);
                    return `${x},${y}`;
                  })
                  .join(" ");
                return (
                  <polygon
                    key={lvl}
                    points={ringPoints}
                    fill="none"
                    stroke="#e4ded0"
                    strokeWidth="1"
                    strokeDasharray={lvl < 5 ? "3 3" : undefined}
                  />
                );
              })}

              {/* Axis spokes */}
              {categories.map((cat, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const x = center + radius * Math.cos(angle);
                const y = center + radius * Math.sin(angle);
                return (
                  <line
                    key={cat.key}
                    x1={center}
                    y1={center}
                    x2={x}
                    y2={y}
                    stroke="#dbd4c3"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Radar area polygon */}
              <polygon
                points={polygonString}
                fill="rgba(44, 78, 56, 0.22)"
                stroke="#2c4e38"
                strokeWidth="2.5"
                className="transition-all duration-300"
              />

              {/* Data points & Labels */}
              {categories.map((cat, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const normalized = Math.min(Math.max(values[i], 0), 5) / 5;
                const r = normalized * radius;
                const px = center + r * Math.cos(angle);
                const py = center + r * Math.sin(angle);

                // Label coordinates placed outside the circle
                const labelR = radius + 24;
                const lx = center + labelR * Math.cos(angle);
                const ly = center + labelR * Math.sin(angle);

                return (
                  <g key={cat.key}>
                    <circle
                      cx={px}
                      cy={py}
                      r="4.5"
                      fill="#b36b3d"
                      stroke="#fff"
                      strokeWidth="2"
                    />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-[11px] font-medium fill-[#363d33]"
                    >
                      {cat.label} ({values[i]}/5)
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Cupping Legend & Score Breakdown */}
          <div className="w-full md:w-64 space-y-2.5">
            <h4 className="text-xs uppercase font-bold tracking-wider text-[#2c4e38] mb-3"> <StorefrontText id="copy_6f96e1252705eac0" fallback="Cupping Score Breakdown (0 - 5)" /> </h4>
            {categories.map((cat, idx) => (
              <div
                key={cat.key}
                className="flex items-center justify-between text-xs py-1 border-b border-[#f0ede6]"
              >
                <span className="text-[#495045] font-medium">{cat.label}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-20 h-2 bg-[#e8e4db] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2c4e38] rounded-full"
                      style={{ width: `${(values[idx] / 5) * 100}%` }}
                    />
                  </div>
                  <span className="font-semibold text-[#18231c] w-6 text-right">
                    {values[idx]}/5
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </figure>
    );
  }

  // 2. Comparison Table format
  if (type === "comparison" && compareItems && compareItems.length > 0) {
    return (
      <figure className="my-8 bg-white border border-[#e4ded0] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 bg-[#f9f7f2] border-b border-[#e8e2d4]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2c4e38]" />
            <figcaption className="font-serif text-xl font-bold text-[#18231c]">
              {title}
            </figcaption>
          </div>
          {subtitle && (
            <p className="text-xs text-[#5f665a] mt-1">{subtitle}</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f4efe4] text-xs uppercase tracking-wider text-[#2c4e38]">
              <tr>
                <th className="py-3 px-5 font-bold"> <StorefrontText id="copy_3d377ae910dce03a" fallback="Feature" /> </th>
                <th className="py-3 px-5 font-bold"> <StorefrontText id="copy_aa3b1bdb91fb8eb2" fallback="Orthodox Leaf" /> </th>
                <th className="py-3 px-5 font-bold"> <StorefrontText id="copy_c635a207c1132360" fallback="CTC Curled Grain" /> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee8dc]">
              {compareItems.map((item, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-[#faf8f4] transition-colors ${
                    item.highlight ? "bg-[#f5f1e8]/60 font-medium" : ""
                  }`}
                >
                  <td className="py-3.5 px-5 text-[#18231c] font-semibold">
                    {item.feature}
                  </td>
                  <td className="py-3.5 px-5 text-[#3d433b]">{item.orthodox}</td>
                  <td className="py-3.5 px-5 text-[#3d433b]">{item.ctc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
    );
  }

  // 3. Default: Bar Chart
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <figure className="my-8 p-6 sm:p-8 bg-white border border-[#e4ded0] rounded-2xl shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-4 h-4 text-[#2c4e38]" />
        <figcaption className="font-serif text-lg sm:text-xl font-bold text-[#18231c]">
          {title}
        </figcaption>
      </div>
      {subtitle && (
        <p className="text-xs text-[#5f665a] mb-6 leading-relaxed">
          {subtitle}
        </p>
      )}

      <div className="space-y-4 mt-4">
        {data.map((item, idx) => {
          const percentage = (item.value / maxValue) * 100;
          const isHovered = activeItem === item.label;

          return (
            <div
              key={idx}
              className="space-y-1.5"
              onMouseEnter={() => setActiveItem(item.label)}
              onMouseLeave={() => setActiveItem(null)}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#18231c]">
                  {item.label}
                </span>
                <span className="font-bold text-[#2c4e38]">
                  {item.value.toLocaleString()} {item.unit || unit}
                </span>
              </div>
              <div className="w-full h-4 bg-[#f0ede6] rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    isHovered
                      ? "bg-[#b36b3d]"
                      : item.color || "bg-[#2c4e38]"
                  }`}
                  style={{ width: `${Math.max(percentage, 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
