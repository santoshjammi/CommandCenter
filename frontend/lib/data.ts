import fs from "fs/promises";
import path from "path";
import { unstable_cache } from "next/cache";
import type { CheatSheet, ToolMeta } from "./types";

// Absolute path to the data/tools directory — one level up from the Next.js project
const TOOLS_DIR = path.join(process.cwd(), "..", "data", "tools");
const CLEAN_TOOLS_FILE = path.join(process.cwd(), "..", "data", "clean_tools.json");

// ---------------------------------------------------------------------------
// Raw readers (not exported — called only through the cached wrappers)
// ---------------------------------------------------------------------------
async function _getToolBySlug(slug: string): Promise<CheatSheet | null> {
  try {
    const filePath = path.join(TOOLS_DIR, `${slug}.json`);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as CheatSheet;
  } catch {
    return null;
  }
}

async function _getAllToolMeta(): Promise<ToolMeta[]> {
  try {
    const raw = await fs.readFile(CLEAN_TOOLS_FILE, "utf8");
    const base: ToolMeta[] = JSON.parse(raw);

    // Enrich with category/description from individual tool files where available
    const enriched = await Promise.all(
      base.map(async (tool) => {
        try {
          const sheet = await _getToolBySlug(tool.slug);
          if (sheet) {
            return {
              ...tool,
              description: sheet.description,
              category: sheet.category,
            };
          }
        } catch {
          // tool not yet generated — return base meta
        }
        return tool;
      })
    );

    return enriched;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Cached public API — avoids N+1 reads on every dev-server request
// ---------------------------------------------------------------------------

/** All tool metadata (base + enriched from generated files). Cached 1 h. */
export const getAllToolMeta = unstable_cache(_getAllToolMeta, ["all-tool-meta"], {
  revalidate: 3600,
});

/** Single cheat sheet by slug. Cached 1 h per slug. */
export const getToolBySlug = unstable_cache(
  _getToolBySlug,
  ["tool-by-slug"],
  { revalidate: 3600 }
);

// ---------------------------------------------------------------------------
// Load generated tools only (have a JSON file in data/tools/)
// ---------------------------------------------------------------------------
export async function getGeneratedToolMeta(): Promise<ToolMeta[]> {
  try {
    const files = await fs.readdir(TOOLS_DIR);
    const slugs = new Set(files.filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")));

    const all = await getAllToolMeta();
    return all.filter((t) => slugs.has(t.slug));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Generate static params for Next.js [slug] route
// ---------------------------------------------------------------------------
export async function getGeneratedSlugs(): Promise<string[]> {
  try {
    const files = await fs.readdir(TOOLS_DIR);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Build the Fuse.js search index (serialisable — written to public/ at build)
// ---------------------------------------------------------------------------
export async function buildSearchIndex(): Promise<object[]> {
  const tools = await getGeneratedToolMeta();
  const index: object[] = [];

  for (const tool of tools) {
    const sheet = await getToolBySlug(tool.slug);
    if (!sheet) continue;

    // Top-level entry
    index.push({
      type: "tool",
      slug: tool.slug,
      title: sheet.title,
      description: sheet.description,
      category: sheet.category,
      audience: tool.audience,
      text: sheet.title + " " + sheet.description,
    });

// Per-snippet entries for deep search
    for (const cmd of sheet.commands) {
      index.push({
        type: "snippet",
        slug: tool.slug,
        title: sheet.title,
        command: cmd.command,
        description: cmd.description,
        scenario: cmd.scenario,
        tags: cmd.tags.join(" "),
        text: cmd.command + " " + cmd.description + " " + cmd.scenario + " " + cmd.tags.join(" "),
      });
    }
  }

  return index;
}
