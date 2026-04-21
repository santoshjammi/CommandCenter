"use client";

import { useState } from "react";

interface CommandBlockProps {
  command: string;
  description: string;
  scenario?: string;
  language?: string;
  manPage?: string;
  tags?: string[];
}

export function CommandBlock({
  command,
  description,
  scenario,
  language,
  manPage,
  tags,
}: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            {language && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {language}
              </span>
            )}
            <code className="font-mono text-sm font-semibold text-[#9fe870]">
              {command}
            </code>
          </div>
          <p className="text-sm text-zinc-400">{description}</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={copyToClipboard}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            title="Copy command"
          >
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#9fe870]">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          {manPage && (
            <a
              href={manPage}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              title="View Man Page"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {scenario && (
        <div className="flex items-start gap-2 rounded-lg bg-zinc-950/50 p-2 text-xs text-zinc-500">
          <span className="mt-0.5 shrink-0 text-[#9fe870]/70">&#128161;</span>
          <span>{scenario}</span>
        </div>
      )}

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-800/50 px-2 py-0.5 text-[10px] text-zinc-400"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
