"use client";

import { CodeEditorCard } from "@/components/CodeEditorCard";

interface CommandBlockProps {
  command: string;
  description: string;
  scenario?: string;
  language?: string;
  manPage?: string;
  tags?: string[];
}

export function CommandBlock({
  command,
  description,
  scenario,
  language,
  manPage,
  tags,
}: CommandBlockProps) {
  return (
    <div className="flex flex-col gap-2">
      <CodeEditorCard
        title={description}
        helperText={scenario}
        value={command}
        redirectUrl={manPage || undefined}
        language={language}
      />

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1" role="list" aria-label="Tags">
          {tags.map((tag) => (
            <span
              key={tag}
              role="listitem"
              className="rounded-full bg-white/[0.05] border border-white/[0.07] px-2 py-0.5 font-mono text-[10px] text-white/30"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
