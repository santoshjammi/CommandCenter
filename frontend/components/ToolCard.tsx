import Link from "next/link";
import type { ToolMeta } from "@/lib/types";

interface ToolCardProps {
  tool: ToolMeta;
}

export default function ToolCard({ tool }: ToolCardProps) {
  return (
    <Link
      href={`/${tool.slug}`}
      className="tool-card group flex flex-col gap-2 px-4 py-4"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-sm leading-snug"
          style={{ fontWeight: 600, color: "var(--foreground)", fontFeatureSettings: "'calt' 1" }}
        >
          {tool.name}
        </span>
        {tool.category && (
          <span className="shrink-0 badge-category">{tool.category}</span>
        )}
      </div>
      {tool.description && (
        <p
          className="text-[13px] leading-snug line-clamp-2"
          style={{ color: "var(--muted-gray)" }}
        >
          {tool.description}
        </p>
      )}
      <div className="mt-auto pt-1">
        <span
          className={tool.audience === "engineer" ? "badge-engineer" : "badge-non-engineer"}
        >
          {tool.audience}
        </span>
      </div>
    </Link>
  );
}
