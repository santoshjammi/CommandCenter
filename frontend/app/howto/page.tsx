import type { Metadata } from "next";
import Link from "next/link";
import { getAllHowToMeta } from "@/lib/data";
import type { HowToMeta } from "@/lib/types";

export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://devkeys.countrysnews.com";

export const metadata: Metadata = {
  title: "How-To Guides — Step-by-Step Web Development Solutions | DevKeys",
  description:
    "Step-by-step guides for common HTML, CSS, and JavaScript tasks. Build dropdowns, modals, responsive images, and more with copy-ready code.",
  keywords: [
    "html how to",
    "web development guides",
    "html tutorial",
    "html examples",
    "html5 elements",
    "web dev how-to",
  ],
  alternates: { canonical: "/howto" },
  openGraph: {
    type: "website",
    url: "/howto",
    title: "How-To Guides — Step-by-Step Web Development Solutions",
    description:
      "Step-by-step guides for common HTML, CSS, and JavaScript tasks. Copy-ready code for every answer.",
    siteName: "DevKeys",
  },
};

const DIFFICULTY_STYLE: Record<string, { bg: string; color: string }> = {
  beginner:     { bg: "var(--light-mint)",  color: "var(--dark-green)" },
  intermediate: { bg: "#fff3cd",            color: "#856404" },
  advanced:     { bg: "#fde8e8",            color: "#c0392b" },
};

export default async function HowToListingPage() {
  const howtos = await getAllHowToMeta();

  // Group by topic
  const grouped: Record<string, HowToMeta[]> = {};
  for (const h of howtos) {
    const topic = h.topic ?? "Other";
    if (!grouped[topic]) grouped[topic] = [];
    grouped[topic].push(h);
  }

  const topicLabels: Record<string, string> = {
    html: "HTML",
    css:  "CSS",
    js:   "JavaScript",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "How-To Guides",
            description:
              "Step-by-step guides for common HTML, CSS, and JavaScript tasks.",
            url: `${SITE_URL}/howto`,
            publisher: { "@type": "Organization", name: "DevKeys", url: SITE_URL },
          }),
        }}
      />

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Hero */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge-category">How-To&apos;s</span>
          </div>
          <h1
            className="text-[48px] sm:text-[56px] font-semibold leading-tight tracking-tight"
            style={{
              fontFamily:
                "var(--font-inter-tight), var(--font-inter), system-ui, sans-serif",
              color: "var(--foreground)",
            }}
          >
            How-To Guides
          </h1>
          <p
            className="mt-3 text-lg leading-relaxed"
            style={{ color: "var(--muted-gray)", maxWidth: 560 }}
          >
            Step-by-step answers to common web development questions. Every
            guide includes copy-ready code snippets.
          </p>
        </div>

        {/* Topic sections */}
        {Object.keys(grouped).length === 0 ? (
          <p style={{ color: "var(--muted-gray)" }}>No guides available yet.</p>
        ) : (
          Object.entries(grouped).map(([topic, items]) => (
            <section key={topic} className="mb-14">
              <h2
                className="mb-5 text-sm font-semibold uppercase tracking-[0.1em]"
                style={{ color: "var(--muted-gray)" }}
              >
                {topicLabels[topic] ?? topic.toUpperCase()}
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((h) => {
                  const ds = DIFFICULTY_STYLE[h.difficulty] ?? DIFFICULTY_STYLE.beginner;
                  return (
                    <Link
                      key={h.slug}
                      href={`/howto/${h.slug}`}
                      className="tool-card block p-5 group"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="badge-category">
                          {topicLabels[h.topic] ?? h.topic}
                        </span>
                        <span
                          className="text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full"
                          style={{ background: ds.bg, color: ds.color }}
                        >
                          {h.difficulty}
                        </span>
                      </div>

                      <h3
                        className="text-[15px] font-semibold leading-snug mb-2"
                        style={{ color: "var(--foreground)" }}
                      >
                        {h.question}
                      </h3>

                      <p
                        className="text-sm leading-relaxed line-clamp-2"
                        style={{ color: "var(--muted-gray)" }}
                      >
                        {h.description}
                      </p>

                      {h.tags && h.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {h.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="tag-pill">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
