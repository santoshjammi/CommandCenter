"use client";

import { useEffect, useRef, useState } from "react";

interface TableOfContentsProps {
  sections: { sectionTitle: string }[];
}

function toAnchor(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function TableOfContents({ sections }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const ids = sections.map((s) => toAnchor(s.sectionTitle));

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "0% 0% -70% 0%", threshold: 0 }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav aria-label="Table of contents" className="space-y-0.5">
      <p
        className="mb-3 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted-gray)", letterSpacing: "0.12em" }}
      >
        Contents
      </p>
      {sections.map((section) => {
        const anchor = toAnchor(section.sectionTitle);
        const isActive = activeId === anchor;
        return (
          <a
            key={anchor}
            href={`#${anchor}`}
            className="block px-3 py-1.5 text-[13px] transition-all"
            style={{
              borderRadius: 8,
              borderLeft: isActive ? "2px solid var(--wise-green)" : "2px solid transparent",
              background: isActive ? "var(--light-mint)" : undefined,
              color: isActive ? "var(--dark-green)" : "var(--muted-gray)",
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {section.sectionTitle}
          </a>
        );
      })}
    </nav>
  );
}
