import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug, getGeneratedSlugs } from "@/lib/data";
import TableOfContents from "@/components/TableOfContents";
import CommandReferenceSection from "@/components/CommandReferenceSection";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://devkeys.countrysnews.com";

// Every slug page is statically generated at build time
export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getGeneratedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) return { title: "Not found" };

  const title = `${tool.title} Cheat Sheet — Commands & Quick Reference`;
  const description = `Complete ${tool.title} command reference with copy-ready examples and real-world scenarios. ${tool.description}`;

  return {
    title,
    description,
    keywords: [
      tool.title,
      `${tool.title} commands`,
      `${tool.title} cheat sheet`,
      `${tool.title} reference`,
      `${tool.title} quick reference`,
      ...(tool.category ? [tool.category] : []),
    ],
    alternates: { canonical: `/${slug}` },
    openGraph: {
      type: "article",
      url: `/${slug}`,
      title,
      description,
      siteName: "DevKeys",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) notFound();

  const commands = tool.commands ?? [];
  const faqItems = commands.slice(0, 8).map((cmd) => ({
    "@type": "Question",
    name: `${tool.title}: ${cmd.scenario}`,
    acceptedAnswer: {
      "@type": "Answer",
      text: `${cmd.command}${cmd.description ? ` — ${cmd.description}` : ""}`,
    },
  }));
  const schema: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: `${tool.title} Cheat Sheet`,
      description: tool.description,
      url: `${SITE_URL}/${slug}`,
      author: { "@type": "Organization", name: "DevKeys", url: SITE_URL },
      publisher: { "@type": "Organization", name: "DevKeys", url: SITE_URL },
      keywords: `${tool.title}, ${tool.title} commands, ${tool.title} cheat sheet`,
      about: { "@type": "SoftwareApplication", name: tool.title },
      inLanguage: "en-US",
    },
    ...(faqItems.length > 0
      ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqItems }]
      : []),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex gap-10">
        {/* Sticky ToC sidebar */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-24">
            <TableOfContents sections={[]} />
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              {tool.category && (
                <span className="badge-category">{tool.category}</span>
              )}
              <span className={tool.audience === "engineer" ? "badge-engineer" : "badge-non-engineer"}>
                {tool.audience}
              </span>
            </div>
            <h1
              className="text-[48px] font-semibold leading-tight tracking-tight text-white"
              style={{
                fontFamily: "var(--font-inter-tight), var(--font-inter), system-ui, sans-serif",
                letterSpacing: "-0.5px",
              }}
            >
              {tool.title}
            </h1>
            <p className="mt-4 text-lg text-zinc-400">{tool.description}</p>
          </div>

          <CommandReferenceSection commands={tool.commands} />
        </main>
      </div>
    </div>
    </>
  );
}
