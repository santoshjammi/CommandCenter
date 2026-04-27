import { existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

// Dynamic so it runs at request time on the live server — useful for diagnosing
// deployment path issues without looking at server logs.
// Protect with a token so it's not publicly accessible.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("token") !== "devkeys-debug-2026") {
    return new Response("Not Found", { status: 404 });
  }

  const cwd = process.cwd();
  const DATA_DIR_env = process.env.DATA_DIR ?? "(not set)";

  const candidates = [
    process.env.DATA_DIR,
    path.join(cwd, "..", "data"),
    path.join(cwd, "data"),
  ].filter(Boolean) as string[];

  const paths = candidates.map((p) => {
    const exists = existsSync(p);
    const hasCleanTools = existsSync(path.join(p, "clean_tools.json"));
    let toolCount = 0;
    let howtoCount = 0;
    try {
      toolCount = readdirSync(path.join(p, "tools")).filter((f) => f.endsWith(".json")).length;
    } catch {
      // tools dir not found
    }
    try {
      howtoCount = readdirSync(path.join(p, "howtos")).filter((f) => f.endsWith(".json")).length;
    } catch {
      // howtos dir not found
    }
    return { path: p, exists, hasCleanTools, toolCount, howtoCount };
  });

  // Check public/ artefacts (written at build time by build-search-index.ts)
  const publicDir = path.join(cwd, "public");
  const checkPublic = (file: string) => {
    const fp = path.join(publicDir, file);
    if (!existsSync(fp)) return { exists: false };
    try {
      const s = statSync(fp);
      return { exists: true, size: s.size, mtime: s.mtime.toISOString() };
    } catch {
      return { exists: true };
    }
  };

  // Check that howto static pages were baked into the build
  const howtoRouteFile = path.join(cwd, ".next", "server", "app", "howto", "page.html");
  const howtoSlugRouteDir = path.join(cwd, ".next", "server", "app", "howto");
  let howtoPagesBaked = 0;
  try {
    howtoPagesBaked = readdirSync(howtoSlugRouteDir).filter(
      (f) => !f.startsWith("_") && !f.endsWith(".js") && !f.endsWith(".json")
    ).length;
  } catch {
    // not found
  }

  return NextResponse.json({
    cwd,
    DATA_DIR_env,
    node_env: process.env.NODE_ENV,
    paths,
    public: {
      "search-index.json": checkPublic("search-index.json"),
      "tools-meta.json":   checkPublic("tools-meta.json"),
      "howtos-meta.json":  checkPublic("howtos-meta.json"),
    },
    build: {
      howtoListingHtml: existsSync(howtoRouteFile),
      howtoPagesBaked,
      howtoSlugRouteDir,
    },
  });
}
