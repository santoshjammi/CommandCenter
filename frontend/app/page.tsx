import { getAllToolMeta } from "@/lib/data";
import type { ToolMeta } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import ToolCard from "@/components/ToolCard";
import AudienceFilter from "@/components/AudienceFilter";

// Fully static — rebuild every hour on ISR or at next deploy
export const revalidate = 3600;

export default async function Home() {
  const tools = await getAllToolMeta();
  const generated = tools.filter((t) => t.description !== undefined);
  const total = tools.length;

  // Group generated tools by category, then sort categories
  const grouped: Record<string, ToolMeta[]> = {};
  for (const tool of generated) {
    const cat = tool.category ?? "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(tool);
  }
  const orderedCategories = CATEGORIES.filter((c) => grouped[c]?.length > 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Hero — design.md §3: 64px Wise-style at weight 900, 0.9 line-height */}
      <div className="mb-12">
        <h1
          className="text-[52px] sm:text-[64px]"
          style={{
            fontWeight: 900,
            lineHeight: 0.9,
            color: "var(--foreground)",
            letterSpacing: "-1px",
            fontFeatureSettings: "'calt' 1",
          }}
        >
          Developer<br />
          <span style={{ color: "var(--dark-green)" }}>Cheat Sheets</span>
        </h1>
        <p className="mt-4 text-base" style={{ color: "var(--muted-gray)", fontWeight: 600 }}>
          {generated.length} of {total} tools generated — press{" "}
          <kbd
            className="px-1.5 py-0.5 text-[11px] rounded-md"
            style={{ background: "var(--light-mint)", color: "var(--dark-green)", fontFamily: "inherit", fontWeight: 700 }}
          >
            ⌘K
          </kbd>{" "}
          to search.
        </p>
      </div>

      {/* Audience filter (client island) */}
      <AudienceFilter tools={generated} grouped={grouped} orderedCategories={orderedCategories} />
    </div>
  );
}
