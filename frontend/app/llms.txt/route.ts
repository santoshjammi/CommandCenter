import { type NextRequest, NextResponse } from "next/server";
import { getAllToolMeta } from "@/lib/data";

// Pre-render at build time so AI crawlers get a fast static response
export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://devkeys.countrysnews.com";

export async function GET(_req: NextRequest) {
  const tools = await getAllToolMeta();
  const generated = tools.filter((t) => t.description);

  const lines: string[] = [
    "# DevKeys — Developer Command Reference",
    `> ${SITE_URL}`,
    "",
    "## About",
    `DevKeys is a comprehensive developer cheat sheet covering ${generated.length}+ CLI tools, languages, frameworks,`,
    "databases, DevOps platforms, and cloud providers. Every page lists copy-ready commands alongside",
    "real-world usage scenarios so developers can find the right command instantly.",
    "",
    "## Cheat Sheet Pages",
  ];

  for (const tool of generated) {
    lines.push(
      `- [${tool.name} Cheat Sheet](${SITE_URL}/${tool.slug}): ${tool.description ?? ""}`
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
