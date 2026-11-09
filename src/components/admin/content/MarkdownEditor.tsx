"use client";

import React, { useState } from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  Quote,
  List,
  Link as LinkIcon,
  Eye,
  Edit3,
  Columns,
  BarChart2,
  PieChart,
  ShoppingBag,
  Clock,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import { BlogContentRenderer } from "@/components/blog/BlogContentRenderer";

export type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  id?: string;
  placeholder?: string;
};

export function MarkdownEditor({
  value,
  onChange,
  label = "Content",
  id = "markdown-editor",
  placeholder = "Write your editorial article in markdown...",
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<"write" | "split" | "preview">("split");

  // Helper to insert markdown or rich widget templates
  function insertTemplate(template: string) {
    const textarea = document.getElementById(id) as HTMLTextAreaElement | null;
    if (!textarea) {
      onChange(value + "\n\n" + template + "\n\n");
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.substring(0, start);
    const after = value.substring(end);

    const needsNewlineBefore = before.length > 0 && !before.endsWith("\n\n");
    const prefix = needsNewlineBefore ? "\n\n" : "";
    const replacement = prefix + template + "\n\n";

    const nextValue = before + replacement + after;
    onChange(nextValue);

    setTimeout(() => {
      textarea.focus();
      const newCursor = start + replacement.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  }

  function insertFormatting(prefix: string, suffix: string = "") {
    const textarea = document.getElementById(id) as HTMLTextAreaElement | null;
    if (!textarea) {
      onChange(value + prefix + suffix);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const replacement = prefix + (selectedText || "text") + suffix;

    const nextValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(nextValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selectedText.length || 4));
    }, 0);
  }

  // Word count and reading time estimate
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  return (
    <div className="markdown-editor-root border border-[#d9d4c8] rounded-2xl bg-white overflow-hidden shadow-sm">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#f7f5f0] border-b border-[#e6decb]">
        <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-[#18231c]">
          {label}
        </label>

        {/* Tab switchers: Write vs Split vs Preview */}
        <div className="inline-flex bg-[#e8e2d4] rounded-lg p-1 gap-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "write"}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === "write"
                ? "bg-white text-[#18231c] shadow-xs"
                : "text-[#555850] hover:text-[#18231c]"
            }`}
            onClick={() => setActiveTab("write")}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Write</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "split"}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === "split"
                ? "bg-white text-[#18231c] shadow-xs"
                : "text-[#555850] hover:text-[#18231c]"
            }`}
            onClick={() => setActiveTab("split")}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Live Split</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "preview"}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === "preview"
                ? "bg-white text-[#18231c] shadow-xs"
                : "text-[#555850] hover:text-[#18231c]"
            }`}
            onClick={() => setActiveTab("preview")}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Formatting & Widget Inserter Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-[#fcfbf9] border-b border-[#ece7dc] text-xs">
        {/* Markdown Basics */}
        <button
          type="button"
          className="p-1.5 rounded hover:bg-[#ece7dc] text-[#555850] hover:text-[#18231c] transition-colors"
          onClick={() => insertFormatting("**", "**")}
          title="Bold (**text**)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-[#ece7dc] text-[#555850] hover:text-[#18231c] transition-colors"
          onClick={() => insertFormatting("*", "*")}
          title="Italic (*text*)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-[#ece7dc] text-[#555850] hover:text-[#18231c] transition-colors"
          onClick={() => insertFormatting("## ", "")}
          title="Heading 2 (## Section)"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-[#ece7dc] text-[#555850] hover:text-[#18231c] transition-colors"
          onClick={() => insertFormatting("### ", "")}
          title="Heading 3 (### Subtitle)"
        >
          <Heading3 className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-[#ece7dc] text-[#555850] hover:text-[#18231c] transition-colors"
          onClick={() => insertFormatting("> ", "")}
          title="Blockquote (> Quote)"
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-[#ece7dc] text-[#555850] hover:text-[#18231c] transition-colors"
          onClick={() => insertFormatting("- ", "")}
          title="Bullet list (- Item)"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-[#ece7dc] text-[#555850] hover:text-[#18231c] transition-colors"
          onClick={() => insertFormatting("[", "](https://)")}
          title="Link ([Text](url))"
        >
          <LinkIcon className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-[#cfc8b8] mx-1" />

        {/* Interactive Widget Inserters */}
        <span className="text-[10px] uppercase font-bold tracking-wider text-[#2c4e38] mr-1">
          Insert Widget:
        </span>

        <button
          type="button"
          onClick={() =>
            insertTemplate(
              '```chart\n{\n  "type": "bar",\n  "title": "Terroir Elevation & Aroma Volatility (ft)",\n  "data": [\n    {"label": "Terai & Dooars", "value": 450},\n    {"label": "Assam Plains", "value": 600},\n    {"label": "Darjeeling Valley", "value": 3500},\n    {"label": "High Terroir Single-Estate", "value": 6800}\n  ],\n  "unit": "ft"\n}\n```'
            )
          }
          className="px-2.5 py-1 bg-white hover:bg-[#2c4e38] text-[#2c4e38] hover:text-white border border-[#2c4e38]/30 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all"
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>+ Chart</span>
        </button>

        <button
          type="button"
          onClick={() =>
            insertTemplate(
              '```tasting-radar\n{\n  "title": "Sensory Cupping Wheel",\n  "scores": {\n    "floral": 5,\n    "fruity": 4,\n    "malty": 2,\n    "body": 3,\n    "sweetness": 4,\n    "earthy": 1\n  }\n}\n```'
            )
          }
          className="px-2.5 py-1 bg-white hover:bg-[#2c4e38] text-[#2c4e38] hover:text-white border border-[#2c4e38]/30 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all"
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>+ Radar</span>
        </button>

        <button
          type="button"
          onClick={() =>
            insertTemplate(
              '```product\n{\n  "slug": "darjeeling-first-flush",\n  "highlight": "Recommended Terroir Pairing"\n}\n```'
            )
          }
          className="px-2.5 py-1 bg-white hover:bg-[#2c4e38] text-[#2c4e38] hover:text-white border border-[#2c4e38]/30 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>+ Product</span>
        </button>

        <button
          type="button"
          onClick={() =>
            insertTemplate(
              '```steep-guide\n{\n  "title": "Gongfu Steeping Ritual",\n  "temp_c": 92,\n  "time_seconds": 180,\n  "dose_g": 2.5,\n  "water_ml": 200,\n  "steeps": 3,\n  "tips": "Preheat vessel. Decant completely between infusions."\n}\n```'
            )
          }
          className="px-2.5 py-1 bg-white hover:bg-[#2c4e38] text-[#2c4e38] hover:text-white border border-[#2c4e38]/30 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>+ Steep Timer</span>
        </button>

        <button
          type="button"
          onClick={() =>
            insertTemplate(
              '```figure\n{\n  "url": "/images/orthodox-vs-ctc.jpg",\n  "caption": "Hand-rolled orthodox whole leaf with visible silver tips",\n  "credit": "Teafloww Single-Estate Archive"\n}\n```'
            )
          }
          className="px-2.5 py-1 bg-white hover:bg-[#2c4e38] text-[#2c4e38] hover:text-white border border-[#2c4e38]/30 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>+ Figure</span>
        </button>

        <button
          type="button"
          onClick={() =>
            insertTemplate(
              '```callout\n{\n  "type": "tip",\n  "title": "Master Blender Secret",\n  "text": "Never use rolling boiling water on delicate orthodox leaves; 85°C to 90°C preserves delicate linalool aroma compounds."\n}\n```'
            )
          }
          className="px-2.5 py-1 bg-white hover:bg-[#2c4e38] text-[#2c4e38] hover:text-white border border-[#2c4e38]/30 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>+ Tip Callout</span>
        </button>
      </div>

      {/* Editor Body Area: Write / Split / Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Write Pane */}
        {(activeTab === "write" || activeTab === "split") && (
          <div
            className={`p-4 ${
              activeTab === "split" ? "md:border-r border-[#ece7dc]" : "col-span-2"
            }`}
          >
            <textarea
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={22}
              className="w-full h-full min-h-[460px] p-3 text-sm font-mono leading-relaxed bg-[#fdfcf9] border border-[#e4ded0] rounded-xl outline-none focus:border-[#2c4e38] focus:bg-white resize-y"
            />
          </div>
        )}

        {/* Live Preview Pane */}
        {(activeTab === "preview" || activeTab === "split") && (
          <div
            className={`p-6 bg-[#faf8f4] overflow-y-auto max-h-[640px] ${
              activeTab === "preview" ? "col-span-2" : ""
            }`}
          >
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#686f64] mb-3 pb-2 border-b border-[#e4ded0] flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-[#2c4e38]" />
              <span>Live Article &amp; Widget Preview Canvas</span>
            </div>
            {value.trim() ? (
              <BlogContentRenderer content={value} />
            ) : (
              <p className="text-xs text-[#8a9184] italic">
                Type in the editor or insert rich widgets (+ Chart, + Product, + Steep Timer) to see live interactive rendering here.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#f7f5f0] border-t border-[#e6decb] text-xs text-[#6e746a]">
        <div className="flex items-center gap-3">
          <span>
            <strong className="text-[#18231c]">{words}</strong> words
          </span>
          <span>•</span>
          <span>
            <strong className="text-[#18231c]">{value.length}</strong> characters
          </span>
          <span>•</span>
          <span>
            ~<strong className="text-[#18231c]">{readingTimeMinutes}</strong> min read
          </span>
        </div>
        <span className="text-[11px] font-semibold text-[#2c4e38]">
          Markdown + Fenced Directives Enabled
        </span>
      </div>
    </div>
  );
}
