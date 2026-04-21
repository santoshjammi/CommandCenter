#!/usr/bin/env node
/**
 * scripts/build-search-index.ts
 *
 * Generates public/search-index.json for the client-side Fuse.js search.
 * Run manually: npx tsx scripts/build-search-index.ts
 * Or add to package.json: "build": "tsx scripts/build-search-index.ts && next build"
 */

import fs from "fs";
import path from "path";

const TOOLS_DIR = path.join(process.cwd(), "..", "data", "tools");
const CLEAN_TOOLS = path.join(process.cwd(), "..", "data", "clean_tools.json");
const OUT_FILE = path.join(process.cwd(), "public", "search-index.json");

interface ToolEntry {
  slug: string;
  name: string;
  audience: string;
}

interface SearchRecord {
  type: "tool" | "snippet";
  slug: string;
  title: string;
  description?: string;
  category?: string;
  audience: string;
  // snippet-specific
  intent?: string;
  text?: string;
  tags?: string[];
}

async function main() {
  const records: SearchRecord[] = [];

  // Load clean tools for display names
  const cleanTools: ToolEntry[] = JSON.parse(
    fs.readFileSync(CLEAN_TOOLS, "utf-8")
  );
  const nameBySlug: Record<string, string> = {};
  for (const t of cleanTools) {
    nameBySlug[t.slug] = t.name;
  }

  if (!fs.existsSync(TOOLS_DIR)) {
    console.warn("No tools directory found — index will be empty.");
    fs.writeFileSync(OUT_FILE, "[]");
    return;
  }

  const files = fs.readdirSync(TOOLS_DIR).filter((f) => f.endsWith(".json"));
  console.log(`Indexing ${files.length} tool files…`);

  for (const file of files) {
    const slug = path.basename(file, ".json");
    try {
      const tool = JSON.parse(
        fs.readFileSync(path.join(TOOLS_DIR, file), "utf-8")
      );

      // Tool-level record
      records.push({
        type: "tool",
        slug,
        title: tool.title ?? nameBySlug[slug] ?? slug,
        description: tool.description,
        category: tool.category,
        audience: tool.audience ?? "engineer",
      });

      // One record per snippet for granular search
      for (const section of tool.sections ?? []) {
        for (const item of section.items ?? []) {
          records.push({
            type: "snippet",
            slug,
            title: tool.title ?? nameBySlug[slug] ?? slug,
            category: tool.category,
            audience: tool.audience ?? "engineer",
            intent: item.intent,
            text: item.command,
            tags: item.tags,
          });
        }
      }
    } catch (err) {
      console.warn(`Skipping ${file}: ${err}`);
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(records));
  console.log(`Wrote ${records.length} records to public/search-index.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
