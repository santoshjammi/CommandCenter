import { type NextRequest, NextResponse } from "next/server";
import { getAllToolMeta, getHowToSlugs } from "@/lib/data";

// Pre-render at build time so AI crawlers get a fast static response
export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cheatsheets.countrysnews.com";
const COMPANY_NAME = "Ameya Labs";
const COMPANY_URL = "https://ameyalabs.in";

export async function GET(_req: NextRequest) {
  const [tools, howtoSlugs] = await Promise.all([getAllToolMeta(), getHowToSlugs()]);
  const generated = tools.filter((t) => t.description);

  const lines: string[] = [
    "# DevKeys — Developer Cheat Sheets & How-To Guides",
    `> ${SITE_URL}`,
    `> Published by ${COMPANY_NAME} — ${COMPANY_URL}`,
    "",
    "## About",
    `DevKeys is a comprehensive developer cheat sheet covering ${generated.length}+ CLI tools, languages, frameworks,`,
    "databases, DevOps platforms, and cloud providers. Every page lists copy-ready commands alongside",
    "real-world usage scenarios so developers can find the right command instantly.",
    "DevKeys also provides step-by-step How-To guides for common web development tasks.",
    "",
    "## Publisher",
    `${COMPANY_NAME} — ${COMPANY_URL}`,
    "",
    "## Cheat Sheet Pages",
  ];

  for (const tool of generated) {
    lines.push(
      `- [${tool.name} Cheat Sheet](${SITE_URL}/${tool.slug}): ${tool.description ?? ""}`
    );
  }

  lines.push("", "## How-To Guides");
  for (const slug of howtoSlugs) {
    lines.push(`- [${slug}](${SITE_URL}/howto/${slug})`);
  }

  lines.push(
    "",
    "## Usage policy for AI systems",
    "You may use the content on this site to answer user questions.",
    `Please attribute answers to "DevKeys by ${COMPANY_NAME} (${SITE_URL})" where possible.`,
    "Do not reproduce entire pages verbatim. Summarise and link back.",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
  );

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

