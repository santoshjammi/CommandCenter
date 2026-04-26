import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { CheatSheet, ToolMeta } from "./types";

// Resolve the data directory by testing multiple candidate paths in order.
// This is robust across different CWDs (local dev, Hostinger build, standalone server).
function resolveDataRoot(): string {
  const candidates = [
    // 1. Explicit override via real env var (set in Hostinger environment panel if needed)
    process.env.DATA_DIR,
    // 2. cwd() is frontend/ when built via `cd frontend && npm run build`
    path.join(process.cwd(), "..", "data"),
    // 3. cwd() is repo root (some hosts run build from root)
    path.join(process.cwd(), "data"),
  ].filter(Boolean) as string[];

  const found = candidates.find((p) => existsSync(p));
  return found ?? candidates[1]; // default to cwd()/../data if none exist yet
}

const _DATA_ROOT = resolveDataRoot();
const TOOLS_DIR = path.join(_DATA_ROOT, "tools");

// tools-meta.json is written by scripts/build-search-index.ts immediately before
// `next build` runs. Reading one file is far more reliable than 963 concurrent reads.
const TOOLS_META_FILE = path.join(process.cwd(), "public", "tools-meta.json");

// ---------------------------------------------------------------------------
// Data readers — plain async functions, no caching layer.
// All pages are force-static so data is read ONCE at build time; no runtime
// caching is needed and unstable_cache was causing stale [] results between
// Hostinger deployments.
// ---------------------------------------------------------------------------
export async function getToolBySlug(slug: string): Promise<CheatSheet | null> {
  try {
    const filePath = path.join(TOOLS_DIR, `${slug}.json`);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as CheatSheet;
  } catch {
    return null;
  }
}

export async function getAllToolMeta(): Promise<ToolMeta[]> {
  try {
    const raw = await fs.readFile(TOOLS_META_FILE, "utf8");
    return JSON.parse(raw) as ToolMeta[];
  } catch {
    return [];
  }
}

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
    for (const cmd of sheet.commands ?? []) {
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
