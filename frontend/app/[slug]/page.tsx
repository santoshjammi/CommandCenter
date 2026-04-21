import { notFound } from "next/navigation";
import { getToolBySlug, getGeneratedSlugs } from "@/lib/data";
import type { Command } from "@/lib/types";
import TableOfContents from "@/components/TableOfContents";
import { CommandBlock } from "@/components/CommandBlock";
import CommandReferenceSection from "@/components/CommandReferenceSection";

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
}) {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) return { title: "Not found" };
  return {
    title: `${tool.title} Cheat Sheet`,
    description: tool.description,
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

  return (
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
            <h1 className="text-[48px] font-black leading-[0.9] tracking-tight text-white">
              {tool.title}
            </h1>
            <p className="mt-4 text-lg text-zinc-400">{tool.description}</p>
          </div>

          <CommandReferenceSection commands={tool.commands} />
        </main>
      </div>
    </div>
  );
}
