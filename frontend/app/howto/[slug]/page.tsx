import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getHowToBySlug, getHowToSlugs, getAllHowToMeta } from "@/lib/data";
import { CodeEditorCard } from "@/components/CodeEditorCard";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://devkeys.countrysnews.com";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const slugs = await getHowToSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const howto = await getHowToBySlug(slug);
  if (!howto) return { title: "Not found" };

  const title = `${howto.question} — DevKeys How-To`;
  const description = howto.description;

  return {
    title,
    description,
    keywords: [
      howto.question,
      ...howto.tags,
      howto.topic,
      "how to",
      "web development",
    ],
    alternates: { canonical: `/howto/${slug}` },
    openGraph: {
      type: "article",
      url: `/howto/${slug}`,
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

const DIFFICULTY_STYLE: Record<string, { bg: string; color: string }> = {
  beginner:     { bg: "var(--light-mint)",  color: "var(--dark-green)" },
  intermediate: { bg: "#fff3cd",            color: "#856404" },
  advanced:     { bg: "#fde8e8",            color: "#c0392b" },
};

export default async function HowToDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [howto, allMeta] = await Promise.all([
    getHowToBySlug(slug),
    getAllHowToMeta(),
  ]);
  if (!howto) notFound();

  const howtoSlugSet = new Set(allMeta.map((m) => m.slug));
  const howtoBySlug = Object.fromEntries(allMeta.map((m) => [m.slug, m]));

  const ds = DIFFICULTY_STYLE[howto.difficulty] ?? DIFFICULTY_STYLE.beginner;

  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: howto.question,
    description: howto.description,
    url: `${SITE_URL}/howto/${slug}`,
    step: howto.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.explanation,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="mb-6 flex items-center gap-2 text-sm flex-wrap"
          style={{ color: "var(--muted-gray)" }}
        >
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <Link href="/howto" className="hover:underline">
            How-To&apos;s
          </Link>
          <span>/</span>
          <span style={{ color: "var(--foreground)" }}>{howto.question}</span>
        </nav>

        {/* Badges */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="badge-category">{howto.topic}</span>
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full"
            style={{ background: ds.bg, color: ds.color }}
          >
            {howto.difficulty}
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-[32px] sm:text-[40px] font-semibold leading-tight tracking-tight mb-4"
          style={{ color: "var(--foreground)" }}
        >
          {howto.question}
        </h1>

        <p
          className="text-base leading-relaxed mb-6"
          style={{ color: "var(--muted-gray)" }}
        >
          {howto.description}
        </p>

        {/* Tags */}
        {howto.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-10">
            {howto.tags.map((tag) => (
              <span key={tag} className="tag-pill">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Steps */}
        <ol className="space-y-10">
          {howto.steps.map((step, i) => (
            <li key={i}>
              <div className="flex items-start gap-4">
                {/* Step number */}
                <span
                  className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                  style={{
                    background: "var(--light-mint)",
                    color: "var(--dark-green)",
                  }}
                >
                  {i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <h2
                    className="text-lg font-semibold mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    {step.title}
                  </h2>
                  <p
                    className="text-sm leading-relaxed mb-4"
                    style={{ color: "var(--muted-gray)" }}
                  >
                    {step.explanation}
                  </p>
                  {step.code && (
                    <CodeEditorCard
                      title={step.title}
                      value={step.code}
                      language={step.language}
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {/* Full example */}
        {howto.full_example && (
          <section className="mt-12">
            <h2
              className="text-xl font-semibold mb-4"
              style={{ color: "var(--foreground)" }}
            >
              Full Example
            </h2>
            <CodeEditorCard
              title="Complete working example"
              value={howto.full_example.code}
              language={howto.full_example.language}
            />
          </section>
        )}

        {/* Related how-tos */}
        {howto.related_slugs && howto.related_slugs.length > 0 && (
          <section className="mt-12">
            <h2
              className="text-xl font-semibold mb-4"
              style={{ color: "var(--foreground)" }}
            >
              Related Guides
            </h2>
            <div className="flex flex-col gap-2">
              {howto.related_slugs.map((relSlug) => {
                const isHowTo = howtoSlugSet.has(relSlug);
                const href = isHowTo ? `/howto/${relSlug}` : `/${relSlug}`;
                const label = isHowTo
                  ? howtoBySlug[relSlug]?.question ?? relSlug
                  : relSlug;
                return (
                  <Link
                    key={relSlug}
                    href={href}
                    className="tool-card block px-5 py-3 text-sm font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
