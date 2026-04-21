"use client";

import { useState } from "react";

interface SnippetItem {
  command: string;
  description?: string;
  language?: string;
  tags: string[];
}

interface CodeSnippetProps {
  item: SnippetItem;
  html: string; // pre-rendered by Shiki on the server
}

export default function CodeSnippet({ item, html }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(item.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div
      className="group relative overflow-hidden"
      style={{ borderRadius: 16, border: "1px solid var(--ring)", background: "var(--background)" }}
    >
      {/* Intent row */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid var(--ring)" }}
      >
        <span className="text-xs" style={{ color: "var(--warm-dark)", fontWeight: 600 }}>{item.description}</span>
        <button
          onClick={handleCopy}
          className="shrink-0 text-[11px] font-semibold transition-all"
          style={{
            padding: "2px 8px",
            borderRadius: 9999,
            background: copied ? "var(--wise-green)" : "transparent",
            color: copied ? "var(--dark-green)" : "var(--muted-gray)",
          }}
          aria-label="Copy command"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {/* Code block */}
      <div
        className="shiki-wrap overflow-x-auto px-3 py-2.5 text-[13px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap px-3 pb-2">
          {item.tags.map((tag) => (
            <span key={tag} className="tag-pill">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
