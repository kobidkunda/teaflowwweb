"use client";

import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { TeaChart } from "./TeaChart";
import { BlogProductCard } from "./BlogProductCard";
import { BlogFigure } from "./BlogFigure";
import { SteepingTimer } from "./SteepingTimer";
import { EditorialCallout } from "./EditorialCallout";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-");
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/;

  while (remaining) {
    const match = remaining.match(tokenRegex);
    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }

    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index));
    }

    const fullMatch = match[0];
    if (fullMatch.startsWith("[") && match[2] && match[3]) {
      const isInternal = match[3].startsWith("/");
      if (isInternal) {
        parts.push(
          <Link
            key={key++}
            href={match[3]}
            className="text-[#2c4e38] font-medium underline underline-offset-4 decoration-[#2c4e38]/30 hover:decoration-[#2c4e38] transition-colors"
          >
            {match[2]}
          </Link>
        );
      } else {
        parts.push(
          <a
            key={key++}
            href={match[3]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2c4e38] font-medium underline underline-offset-4 decoration-[#2c4e38]/30 hover:decoration-[#2c4e38] transition-colors"
          >
            {match[2]}
          </a>
        );
      }
    } else if (fullMatch.startsWith("**") && match[4]) {
      parts.push(
        <strong key={key++} className="font-semibold text-[#18231c]">
          {match[4]}
        </strong>
      );
    } else if (fullMatch.startsWith("*") && match[5]) {
      parts.push(
        <em key={key++} className="italic font-serif">
          {match[5]}
        </em>
      );
    } else if (fullMatch.startsWith("`") && match[6]) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 text-xs bg-[#f4efe4] text-[#2c4e38] rounded font-mono"
        >
          {match[6]}
        </code>
      );
    }

    remaining = remaining.slice(match.index + fullMatch.length);
  }

  return parts;
}

export function BlogContentRenderer({ content }: { content: string }) {
  if (!content) return null;

  // Split into raw blocks while preserving multi-line code blocks
  const blocks: string[] = [];
  const lines = content.split("\n");
  let inCode = false;
  let codeBuffer: string[] = [];
  let textBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (inCode) {
        // Closing code block
        codeBuffer.push(line);
        blocks.push(codeBuffer.join("\n"));
        codeBuffer = [];
        inCode = false;
      } else {
        // Flush any text before opening code block
        if (textBuffer.length > 0) {
          const txt = textBuffer.join("\n").trim();
          if (txt) blocks.push(txt);
          textBuffer = [];
        }
        inCode = true;
        codeBuffer.push(line);
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
    } else {
      if (line.trim() === "") {
        if (textBuffer.length > 0) {
          const txt = textBuffer.join("\n").trim();
          if (txt) blocks.push(txt);
          textBuffer = [];
        }
      } else {
        textBuffer.push(line);
      }
    }
  }

  if (inCode && codeBuffer.length > 0) {
    blocks.push(codeBuffer.join("\n"));
  }
  if (textBuffer.length > 0) {
    const txt = textBuffer.join("\n").trim();
    if (txt) blocks.push(txt);
  }

  return (
    <div className="blog-content-body max-w-[80ch] text-[#2d322c] leading-[1.75] space-y-6">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();

        // 1. Fenced Code Directives
        if (trimmed.startsWith("```")) {
          const firstLineEnd = trimmed.indexOf("\n");
          if (firstLineEnd === -1) return null;
          const header = trimmed.slice(3, firstLineEnd).trim().toLowerCase();
          const body = trimmed.slice(firstLineEnd + 1, trimmed.lastIndexOf("```")).trim();

          try {
            // Interactive Chart
            if (header === "chart") {
              const data = JSON.parse(body);
              return <TeaChart key={idx} {...data} />;
            }

            // Tasting Cupping Radar
            if (header === "tasting-radar" || header === "radar") {
              const data = JSON.parse(body);
              return <TeaChart key={idx} type="radar" {...data} />;
            }

            // Interactive Product Card with Add to Cart
            if (header === "product") {
              const data = JSON.parse(body);
              return <BlogProductCard key={idx} {...data} />;
            }

            // Figure with Lightbox
            if (header === "figure") {
              const data = JSON.parse(body);
              return <BlogFigure key={idx} {...data} />;
            }

            // Steeping Timer
            if (header === "steep-guide" || header === "steep-timer") {
              const data = JSON.parse(body);
              return <SteepingTimer key={idx} {...data} />;
            }

            // Editorial Callout
            if (header === "callout") {
              const data = JSON.parse(body);
              return <EditorialCallout key={idx} {...data} />;
            }
          } catch {
            // Fallback for standard code block
          }

          return (
            <pre
              key={idx}
              className="my-6 p-4 rounded-xl bg-[#18231c] text-[#f7f5f0] text-xs font-mono overflow-x-auto"
            >
              <code>{body}</code>
            </pre>
          );
        }

        // 2. Headings with Slug IDs for TOC Scroll-spy
        if (trimmed.startsWith("# ")) {
          const text = trimmed.replace(/^#\s+/, "");
          const id = slugify(text);
          return (
            <h1
              key={idx}
              id={id}
              className="font-serif text-3xl sm:text-4xl font-bold text-[#18231c] tracking-tight mt-10 mb-4 [text-wrap:balance]"
            >
              {parseInline(text)}
            </h1>
          );
        }

        if (trimmed.startsWith("## ")) {
          const text = trimmed.replace(/^##\s+/, "");
          const id = slugify(text);
          return (
            <h2
              key={idx}
              id={id}
              className="font-serif text-2xl sm:text-3xl font-bold text-[#18231c] tracking-tight mt-10 mb-3 pt-4 border-t border-[#f0ece2] [text-wrap:balance]"
            >
              {parseInline(text)}
            </h2>
          );
        }

        if (trimmed.startsWith("### ")) {
          const text = trimmed.replace(/^###\s+/, "");
          const id = slugify(text);
          return (
            <h3
              key={idx}
              id={id}
              className="font-serif text-xl sm:text-2xl font-bold text-[#18231c] tracking-tight mt-8 mb-2 [text-wrap:balance]"
            >
              {parseInline(text)}
            </h3>
          );
        }

        // 3. GitHub style Callouts / Blockquotes
        if (trimmed.startsWith("> ")) {
          const quoteLines = trimmed.split("\n").map((l) => l.replace(/^>\s*/, ""));
          const first = quoteLines[0]?.trim();

          if (first?.startsWith("[!TIP]")) {
            return (
              <EditorialCallout key={idx} type="tip" title="Sommelier Tip">
                {parseInline(quoteLines.slice(1).join(" "))}
              </EditorialCallout>
            );
          }
          if (first?.startsWith("[!NOTE]")) {
            return (
              <EditorialCallout key={idx} type="note" title="Origin Note">
                {parseInline(quoteLines.slice(1).join(" "))}
              </EditorialCallout>
            );
          }
          if (first?.startsWith("[!WARNING]") || first?.startsWith("[!CAUTION]")) {
            return (
              <EditorialCallout key={idx} type="warning" title="Brewing Warning">
                {parseInline(quoteLines.slice(1).join(" "))}
              </EditorialCallout>
            );
          }

          return (
            <blockquote
              key={idx}
              className="my-6 pl-5 py-2 border-l-4 border-[#2c4e38] bg-[#faf8f4] text-[#4a5047] italic font-serif text-lg leading-relaxed rounded-r-lg"
            >
              {parseInline(quoteLines.join(" "))}
            </blockquote>
          );
        }

        // 4. Markdown Tables
        if (trimmed.includes("|") && trimmed.split("\n").length >= 2) {
          const rows = trimmed
            .split("\n")
            .filter((r) => r.trim().startsWith("|") && !r.includes("---"));
          if (rows.length >= 2) {
            const headerCols = rows[0]
              .split("|")
              .slice(1, -1)
              .map((c) => c.trim());
            const bodyRows = rows.slice(1);

            return (
              <div
                key={idx}
                className="my-8 overflow-x-auto border border-[#e4ded0] rounded-xl shadow-sm bg-white"
              >
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f7f5f0] border-b border-[#e4ded0] text-xs uppercase tracking-wider text-[#2c4e38]">
                    <tr>
                      {headerCols.map((col, cIdx) => (
                        <th key={cIdx} className="py-3 px-4 font-bold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee8dc]">
                    {bodyRows.map((r, rIdx) => {
                      const cells = r
                        .split("|")
                        .slice(1, -1)
                        .map((c) => c.trim());
                      return (
                        <tr key={rIdx} className="hover:bg-[#faf8f4]">
                          {cells.map((cell, cIdx) => (
                            <td key={cIdx} className="py-3 px-4 text-[#3d433b]">
                              {parseInline(cell)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          }
        }

        // 5. Unordered Lists
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          const items = trimmed.split("\n").map((li) => li.replace(/^(\*|-)\s+/, "").trim());
          return (
            <ul key={idx} className="my-5 pl-6 space-y-2.5 text-[#3d433b] list-disc marker:text-[#2c4e38]">
              {items.map((it, i) => (
                <li key={i} className="leading-relaxed">
                  {parseInline(it)}
                </li>
              ))}
            </ul>
          );
        }

        // 6. Ordered Lists
        if (/^\d+\.\s/.test(trimmed)) {
          const items = trimmed.split("\n").map((li) => li.replace(/^\d+\.\s+/, "").trim());
          return (
            <ol key={idx} className="my-5 pl-6 space-y-2.5 text-[#3d433b] list-decimal marker:text-[#2c4e38] marker:font-semibold">
              {items.map((it, i) => (
                <li key={i} className="leading-relaxed">
                  {parseInline(it)}
                </li>
              ))}
            </ol>
          );
        }

        // 7. Standard Paragraph
        return (
          <p
            key={idx}
            className="text-base sm:text-[17px] text-[#3d433b] leading-relaxed [text-wrap:pretty] font-normal"
          >
            {parseInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
