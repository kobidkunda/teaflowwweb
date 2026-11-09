"use client";

import React, { useState } from "react";

export interface RadarChartProps {
  floral?: number;
  fruity?: number;
  sweetness?: number;
  body?: number;
  astringency?: number;
  umami?: number;
  className?: string;
}

interface AxisDef {
  key: string;
  label: string;
  value: number; // 0 to 10 scale
  angleDeg: number; // degrees
  textAnchor: "start" | "middle" | "end";
  dx: number;
  dy: number;
}

export function RadarChart({
  floral = 8,
  fruity = 6,
  sweetness = 7,
  body = 5,
  astringency = 3,
  umami = 6,
  className = "",
}: RadarChartProps) {
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);

  const cx = 160;
  const cy = 135;
  const radius = 85;

  const axes: AxisDef[] = [
    { key: "floral", label: "Floral", value: floral, angleDeg: -90, textAnchor: "middle", dx: 0, dy: -12 },
    { key: "fruity", label: "Fruity", value: fruity, angleDeg: -30, textAnchor: "start", dx: 10, dy: 4 },
    { key: "sweetness", label: "Sweetness", value: sweetness, angleDeg: 30, textAnchor: "start", dx: 10, dy: 6 },
    { key: "body", label: "Body", value: body, angleDeg: 90, textAnchor: "middle", dx: 0, dy: 18 },
    { key: "astringency", label: "Astringency", value: astringency, angleDeg: 150, textAnchor: "end", dx: -10, dy: 6 },
    { key: "umami", label: "Umami", value: umami, angleDeg: 210, textAnchor: "end", dx: -10, dy: 4 },
  ];

  // Helper to compute (x, y) given angle in degrees and distance r
  const getPoint = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  // Concentric polygon grid points
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPolygons = gridLevels.map((lvl) => {
    const pts = axes.map((a) => {
      const p = getPoint(a.angleDeg, radius * lvl);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    });
    return pts.join(" ");
  });

  // Data polygon points
  const dataPoints = axes.map((a) => {
    // Normalise to 1..10
    const val = Math.max(0.5, Math.min(10, a.value));
    const r = (val / 10) * radius;
    return getPoint(a.angleDeg, r);
  });
  const dataPolygonString = dataPoints
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className={`radar-chart-container relative flex flex-col items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 320 270"
        className="w-full max-w-[320px] h-auto overflow-visible select-none"
        role="img"
        aria-label={`6-Axis Sensory Radar Chart: Floral ${floral}/10, Fruity ${fruity}/10, Sweetness ${sweetness}/10, Body ${body}/10, Astringency ${astringency}/10, Umami ${umami}/10`}
      >
        <defs>
          <radialGradient id="radarFillGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#436b4e" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#2c5137" stopOpacity="0.25" />
          </radialGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1b3022" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Concentric Web Polygons */}
        {gridPolygons.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill={i === gridPolygons.length - 1 ? "#faf7f0" : "none"}
            stroke="#d8d2c4"
            strokeWidth={i === gridPolygons.length - 1 ? "1.2" : "0.8"}
            strokeDasharray={i < gridPolygons.length - 1 ? "3 3" : undefined}
          />
        ))}

        {/* Axis Spokes from center to outer vertex */}
        {axes.map((a) => {
          const outer = getPoint(a.angleDeg, radius);
          return (
            <line
              key={a.key}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke="#cfc8b8"
              strokeWidth="0.9"
            />
          );
        })}

        {/* Data Filled Polygon */}
        <polygon
          points={dataPolygonString}
          fill="url(#radarFillGrad)"
          stroke="#2a5236"
          strokeWidth="2"
          filter="url(#glow)"
          className="transition-all duration-300"
        />

        {/* Vertex Points & Interactive Hit Targets */}
        {dataPoints.map((p, idx) => {
          const a = axes[idx];
          const isHovered = hoveredAxis === a.key;
          return (
            <g key={a.key}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 5.5 : 3.5}
                fill="#ffffff"
                stroke="#2a5236"
                strokeWidth={isHovered ? 2.5 : 2}
                className="transition-all duration-150 cursor-pointer"
              />
              {/* Invisible larger target for easy touch/hover */}
              <circle
                cx={p.x}
                cy={p.y}
                r={16}
                fill="transparent"
                onMouseEnter={() => setHoveredAxis(a.key)}
                onMouseLeave={() => setHoveredAxis(null)}
              />
            </g>
          );
        })}

        {/* Axis Labels */}
        {axes.map((a) => {
          const outer = getPoint(a.angleDeg, radius);
          const isHovered = hoveredAxis === a.key;
          return (
            <text
              key={a.key}
              x={outer.x + a.dx}
              y={outer.y + a.dy}
              textAnchor={a.textAnchor}
              className={`text-[11px] font-sans transition-colors duration-150 ${
                isHovered ? "font-bold fill-[#1b3022]" : "font-medium fill-[#5c6158]"
              }`}
              onMouseEnter={() => setHoveredAxis(a.key)}
              onMouseLeave={() => setHoveredAxis(null)}
            >
              {a.label}
              {isHovered && ` (${a.value}/10)`}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default RadarChart;
