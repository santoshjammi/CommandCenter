"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Fuse from "fuse.js";

interface SearchEntry {
  type: "tool" | "snippet";
  slug: string;
  title: string;
  description?: string;
  category?: string;
  audience?: string;
  sectionTitle?: string;
  intent?: string;
  command?: string;
  text: string;
}

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [index, setIndex] = useState<Fuse<SearchEntry> | null>(null);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Eagerly load search index after page is idle — so ⌘K opens without a network wait
  useEffect(() => {
    const load = () => {
      fetch("/search-index.json")
        .then((r) => r.json())
        .then((data: SearchEntry[]) => {
          const fuse = new Fuse(data, {
            keys: ["title", "text", "command", "description", "scenario", "tags"],
            threshold: 0.3,
            minMatchCharLength: 2,
            includeScore: true,
          });
          setIndex(fuse);
        })
        .catch(() => {});
    };

    let handle: ReturnType<typeof setTimeout> | number;
    if ("requestIdleCallback" in window) {
      handle = window.requestIdleCallback(load);
      return () => window.cancelIdleCallback(handle as number);
    } else {
      handle = setTimeout(load, 300);
      return () => clearTimeout(handle as ReturnType<typeof setTimeout>);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run search on query change
  useEffect(() => {
    if (!index || !query.trim()) {
      setResults([]);
      setSelected(0);
      return;
    }
    const raw = index.search(query, { limit: 12 });
    // Deduplicate by slug — prefer tool-level hits
    const seen = new Set<string>();
    const deduped: SearchEntry[] = [];
    for (const r of raw) {
      const item = r.item;
      const key = item.type === "tool" ? `tool-${item.slug}` : `snippet-${item.slug}-${item.command}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }
    setResults(deduped);
    setSelected(0);
  }, [query, index]);

  // Global CMD+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter" && results[selected]) {
        setOpen(false);
      }
    },
    [results, selected]
  );

  return (
    <>
      {/* Trigger button — secondary pill per design.md */}
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary items-center gap-2 text-sm hidden sm:inline-flex"
        aria-label="Search"
      >
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Search tools…
        <kbd
          className="inline-flex items-center px-1.5 py-0.5 text-xs rounded-md"
          style={{ background: "var(--light-mint)", color: "var(--dark-green)", fontFamily: "inherit" }}
        >
          ⌘K
        </kbd>
      </button>
      {/* Mobile icon-only trigger */}
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden nav-hover rounded-lg p-2 transition-all"
        style={{ color: "var(--muted-gray)" }}
        aria-label="Search"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

          {/* Panel — card with ring shadow */}
          <div
            className="relative w-full max-w-xl animate-fade-in overflow-hidden"
            style={{ borderRadius: 20, border: "1px solid var(--ring)", background: "var(--background)", boxShadow: "0 20px 60px rgba(14,15,12,0.12), rgba(14,15,12,0.08) 0px 0px 0px 1px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: "1px solid var(--ring)" }}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--muted-gray)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search tools, commands, shortcuts…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--foreground)", fontWeight: 600 }}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="nav-hover rounded p-0.5 transition-all"
                  style={{ color: "var(--muted-gray)" }}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Results */}
            {results.length > 0 && (
              <ul className="max-h-80 overflow-y-auto py-2">
                {results.map((r, i) => (
                  <li key={`${r.slug}-${i}`}>
                    <Link
                      href={`/${r.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-2.5 text-sm transition-colors"
                      style={{
                        background: i === selected ? "var(--light-mint)" : undefined,
                      }}
                      onMouseEnter={() => setSelected(i)}
                    >
                      <span
                        className="mt-0.5 shrink-0 badge-category"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {r.category ?? r.type}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate" style={{ fontWeight: 600, color: "var(--foreground)" }}>{r.title}</p>
                        {r.intent && (
                          <p className="text-xs truncate" style={{ color: "var(--muted-gray)" }}>{r.intent}</p>
                        )}
                        {!r.intent && r.description && (
                          <p className="text-xs truncate" style={{ color: "var(--muted-gray)" }}>{r.description}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {query && results.length === 0 && (
              <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--muted-gray)" }}>No results for "{query}"</p>
            )}

            {!query && (
              <p className="px-4 py-4 text-xs" style={{ color: "var(--muted-gray)" }}>
                Type to search across all cheat sheets and snippets
              </p>
            )}

            {/* Footer hint */}
            <div
              className="flex items-center gap-4 px-4 py-2 text-xs"
              style={{ borderTop: "1px solid var(--ring)", color: "var(--muted-gray)" }}
            >
              <span><kbd className="font-sans">↑↓</kbd> navigate</span>
              <span><kbd className="font-sans">↵</kbd> open</span>
              <span><kbd className="font-sans">Esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
