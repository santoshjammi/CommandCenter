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
const TOOLS_META_FILE = path.join(process.cwd(), "public", "tools-meta.json");

interface ToolEntry {
  slug: string;
  name: string;
  audience: string;
}

interface ToolMeta {
  slug: string;
  name: string;
  audience: string;
  description?: string;
  category?: string;
}

interface SearchRecord {
  type: "tool" | "snippet";
  slug: string;
  title: string;
  description?: string;
  category?: string;
  audience: string;
  text?: string;
  // snippet-specific
  command?: string;
  scenario?: string;
  tags?: string;
}

async function main() {
  const records: SearchRecord[] = [];
  const toolsMeta: ToolMeta[] = [];

  // Load clean tools for display names
  const cleanTools: ToolEntry[] = JSON.parse(
    fs.readFileSync(CLEAN_TOOLS, "utf-8")
  );
  const nameBySlug: Record<string, string> = {};
  const audienceBySlug: Record<string, string> = {};
  for (const t of cleanTools) {
    nameBySlug[t.slug] = t.name;
    audienceBySlug[t.slug] = t.audience;
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
        text: (tool.title ?? "") + " " + (tool.description ?? ""),
      });

      // Enriched metadata for the homepage
      toolsMeta.push({
        slug,
        name: nameBySlug[slug] ?? tool.title ?? slug,
        audience: tool.audience ?? audienceBySlug[slug] ?? "engineer",
        description: tool.description,
        category: tool.category,
      });

      // Per-command snippet records for granular search
      for (const cmd of tool.commands ?? []) {
        records.push({
          type: "snippet",
          slug,
          title: tool.title ?? nameBySlug[slug] ?? slug,
          category: tool.category,
          audience: tool.audience ?? "engineer",
          command: cmd.command,
          description: cmd.description,
          scenario: cmd.scenario,
          tags: (cmd.tags ?? []).join(" "),
          text: [cmd.command, cmd.description, cmd.scenario, ...(cmd.tags ?? [])].filter(Boolean).join(" "),
        });
      }
    } catch (err) {
      console.warn(`Skipping ${file}: ${err}`);
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(records));
  console.log(`Wrote ${records.length} records to public/search-index.json`);

  fs.writeFileSync(TOOLS_META_FILE, JSON.stringify(toolsMeta));
  console.log(`Wrote ${toolsMeta.length} records to public/tools-meta.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
