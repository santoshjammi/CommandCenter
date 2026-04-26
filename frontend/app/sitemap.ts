import type { MetadataRoute } from "next";
import { getGeneratedSlugs, getHowToSlugs } from "@/lib/data";
import fs from "fs/promises";
import path from "path";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://devkeys.countrysnews.com";
// Use the same baked DATA_DIR that data.ts uses — avoids process.cwd() ambiguity
const TOOLS_DIR = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "..", "data"), "tools");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, howtoSlugs] = await Promise.all([
    getGeneratedSlugs(),
    getHowToSlugs(),
  ]);

  const toolPages: MetadataRoute.Sitemap = await Promise.all(
    slugs.map(async (slug) => {
      let lastModified: Date;
      try {
        const stat = await fs.stat(path.join(TOOLS_DIR, `${slug}.json`));
        lastModified = stat.mtime;
      } catch {
        lastModified = new Date();
      }
      return {
        url: `${SITE_URL}/${slug}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      };
    })
  );

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/howto`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...howtoSlugs.map((slug) => ({
      url: `${SITE_URL}/howto/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...toolPages,
  ];
}
