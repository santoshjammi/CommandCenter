"use client";

import { useState } from "react";
import type { Command } from "@/lib/types";
import { CommandBlock } from "@/components/CommandBlock";

export default function CommandReferenceSection({ commands = [] }: { commands?: Command[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const curatedCommands = commands.filter((c) => c.is_curated);
  const otherCommands = commands.filter((c) => !c.is_curated);
  const displayCommands = isExpanded ? commands : curatedCommands;

  if (!commands || commands.length === 0) {
    return null;
  }

  return (
    <section className="mt-16 border-t border-zinc-800 pt-12">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Command Reference</h2>
          <p className="text-sm text-zinc-500">Quick access to essential commands and scenarios.</p>
        </div>
        {!isExpanded && otherCommands.length > 0 && (
          <button
            onClick={() => setIsExpanded(true)}
            className="text-sm font-semibold text-[#9fe870] hover:underline"
          >
            Show all {commands.length} commands
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        {displayCommands.map((cmd, idx) => (
          <CommandBlock
            key={idx}
            command={cmd.command}
            description={cmd.description}
            scenario={cmd.scenario}
            language={cmd.language}
            manPage={cmd.man_page}
            tags={cmd.tags}
          />
        ))}
      </div>

      {isExpanded && (
        <button
          onClick={() => setIsExpanded(false)}
          className="mt-8 text-sm font-semibold text-zinc-500 hover:text-zinc-300"
        >
          Show less
        </button>
      )}
    </section>
  );
}
