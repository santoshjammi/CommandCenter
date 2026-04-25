"use client";

import { useState } from "react";
import ToolCard from "./ToolCard";
import type { ToolMeta } from "@/lib/types";

type Audience = "all" | "engineer" | "non-engineer";

interface AudienceFilterProps {
  tools: ToolMeta[];
  grouped: Record<string, ToolMeta[]>;
  orderedCategories: readonly string[];
}

export default function AudienceFilter({
  tools: _tools,
  grouped,
  orderedCategories,
}: AudienceFilterProps) {
  const [audience, setAudience] = useState<Audience>("all");

  const filteredGrouped: Record<string, ToolMeta[]> = {};
  for (const cat of orderedCategories) {
    const items =
      audience === "all"
        ? grouped[cat]
        : grouped[cat].filter((t) => t.audience === audience);
    if (items?.length > 0) filteredGrouped[cat] = items;
  }
  const visibleCategories = orderedCategories.filter(
    (c) => filteredGrouped[c]?.length > 0
  );

  const tabs: { value: Audience; label: string }[] = [
    { value: "all", label: "All" },
    { value: "engineer", label: "Engineer" },
    { value: "non-engineer", label: "Non-engineer" },
  ];

  return (
    <div>
      {/* Pill tabs — design.md §4: pill buttons with scale hover */}
      <div className="mb-8 flex gap-2 flex-wrap">
        {tabs.map((tab) => {
          const isActive = audience === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setAudience(tab.value)}
              className={isActive ? "btn-primary" : "btn-secondary"}
              style={{
                padding: "6px 18px",
                fontSize: 13,
                fontFeatureSettings: "'calt' 1",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Category sections */}
      {visibleCategories.length === 0 ? (
        <p className="py-16 text-center text-sm" style={{ color: "var(--muted-gray)" }}>
          No tools found.
        </p>
      ) : (
        /* design.md §5: alternating pale-surface bands per category — the Apple section rhythm */
        <div className="-mx-6">
          {visibleCategories.map((cat, idx) => (
            <section
              key={cat}
              className="px-6 py-10"
              style={{ background: idx % 2 === 1 ? "var(--pale-surface)" : "var(--background)" }}
            >
              <h2
                className="mb-5 text-[11px] font-semibold uppercase"
                style={{ color: "var(--muted-gray)", letterSpacing: "0.1em" }}
              >
                {cat}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredGrouped[cat].map((tool, index) => (
                  <ToolCard key={`${tool.slug}-${index}`} tool={tool} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
