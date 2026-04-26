import { existsSync, readdirSync } from "fs";
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
    try {
      toolCount = readdirSync(path.join(p, "tools")).filter((f) => f.endsWith(".json")).length;
    } catch {
      // tools dir not found
    }
    return { path: p, exists, hasCleanTools, toolCount };
  });

  return NextResponse.json({
    cwd,
    DATA_DIR_env,
    node_env: process.env.NODE_ENV,
    paths,
  });
}
