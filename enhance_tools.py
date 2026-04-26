"""
enhance_tools.py — Daily enhancement engine for DevKeys cheat sheets.

For every tool in the daily batch, this engine:
  1. Reads the existing data/tools/{slug}.json
  2. Shows GPT the commands already covered
  3. Asks for NEW tips, tricks, edge-cases, and advanced patterns
  4. Deduplicates against what already exists
  5. Appends the net-new commands (marked is_curated=False) and saves
  6. Records the run in data/enhancement_log.json for daily rotation

The rotation logic ensures every tool is revisited on a rolling basis —
no tool is enhanced twice before all others have had one pass.

Usage:
    python3 enhance_tools.py                       # default: 50 tools/day
    python3 enhance_tools.py --batch-size 20       # smaller batch
    python3 enhance_tools.py --category "AI Tools" # only one category
    python3 enhance_tools.py --slug cursor         # one specific tool
    python3 enhance_tools.py --dry-run             # preview without saving
    python3 enhance_tools.py --list                # show rotation order

Cron (daily at 03:00):
    0 3 * * * cd /path/to/CommandCenter && source ../venv/bin/activate && python3 enhance_tools.py >> logs/enhance.log 2>&1
"""

import argparse
import asyncio
import json
import os
import random
import sys
import time
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from openai import AsyncOpenAI, RateLimitError, APIStatusError, APIConnectionError
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Config — mirrors generator.py
# ---------------------------------------------------------------------------
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

OPENROUTER_API_KEY   = os.environ["OPENROUTER_API_KEY"]
OPENAI_API_KEY       = os.environ.get("OPENAI_API_KEY", "")
OPENROUTER_MODEL     = "google/gemma-4-26b-a4b-it"
OPENROUTER_BASE_URL  = "https://openrouter.ai/api/v1"
OPENAI_MODEL         = "gpt-4o"             # fallback only

CONCURRENCY          = 5
MAX_RETRIES_OPENROUTER = 3
MAX_RETRIES_OPENAI   = 2
BASE_RETRY_DELAY     = 2.0
DEFAULT_BATCH_SIZE   = 50
NEW_COMMANDS_PER_RUN = 5   # how many new commands to request per tool per run

CLEAN_FILE       = Path(__file__).parent / "data" / "clean_tools.json"
TOOLS_DIR        = Path(__file__).parent / "data" / "tools"
LOG_FILE         = Path(__file__).parent / "data" / "enhancement_log.json"
LOG_DIR          = Path(__file__).parent / "logs"

AI_CATEGORIES = {"AI Chatbot", "Coding Assistant", "Image Generation", "AI Search", "AI Tools"}

# ---------------------------------------------------------------------------
# Pydantic schema — only the new commands, not the full cheat sheet
# ---------------------------------------------------------------------------

class NewCommand(BaseModel):
    command: str     = Field(description="Exact runnable command, prompt phrase, shortcut, or parameter")
    description: str = Field(description="One-line summary of what it does")
    scenario: str    = Field(default="", description="Real-world situation where this is useful")
    language: str    = Field(default="text", description="Shiki language token: bash, python, text, json, etc.")
    tags: list[str]  = Field(default_factory=list, description="2-4 keyword tags")
    is_curated: bool = Field(default=False)   # always overridden to False on save
    man_page: str    = Field(default="", description="URL to official docs if applicable")


class EnhancementResult(BaseModel):
    new_commands: list[NewCommand] = Field(
        min_length=2,
        description=(
            f"Exactly {NEW_COMMANDS_PER_RUN} new commands/tips NOT already in the existing list. "
            "Focus on advanced usage, edge cases, lesser-known flags, and recently-added features."
        )
    )


# ---------------------------------------------------------------------------
# Enhancement log helpers
# ---------------------------------------------------------------------------

def load_log() -> dict:
    if LOG_FILE.exists():
        return json.loads(LOG_FILE.read_text(encoding="utf-8"))
    return {}


def save_log(log: dict) -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text(json.dumps(log, indent=2, ensure_ascii=False), encoding="utf-8")


def pick_batch(tools: list[dict], log: dict, batch_size: int,
               category_filter: Optional[str]) -> list[dict]:
    """
    Return up to `batch_size` tools sorted by enhancement priority:
    1. Never enhanced (oldest first by virtue of never appearing in log)
    2. Least recently enhanced
    Category filter applied before sorting.
    """
    if category_filter:
        tools = [t for t in tools if t.get("category") == category_filter]

    def priority_key(t: dict) -> tuple:
        entry = log.get(t["slug"])
        if entry is None:
            return (0, "")                         # never enhanced → highest priority
        return (1, entry.get("last_enhanced", "")) # earlier date → higher priority

    sorted_tools = sorted(tools, key=priority_key)
    return sorted_tools[:batch_size]


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

def _existing_summary(commands: list[dict]) -> str:
    """Compact representation of what already exists — avoids prompt bloat."""
    lines = []
    for cmd in commands:
        lines.append(f"• {cmd['command'][:120]}")
    return "\n".join(lines)


def build_enhancement_messages(tool_meta: dict, existing_commands: list[dict]) -> list[dict]:
    name     = tool_meta["name"]
    audience = tool_meta["audience"]
    category = tool_meta.get("category", "")
    is_ai    = category in AI_CATEGORIES

    existing_block = _existing_summary(existing_commands)

    if is_ai and audience == "engineer":
        focus = (
            "Focus on: advanced API parameters, undocumented flags, debugging techniques, "
            "performance optimisations, prompt-engineering patterns, and integration tricks."
        )
    elif is_ai:
        focus = (
            "Focus on: power-user prompt phrases, productivity shortcuts, lesser-known features, "
            "creative use cases, and time-saving workflows."
        )
    elif audience == "engineer":
        focus = (
            "Focus on: advanced CLI flags, config file options, performance tuning, debugging commands, "
            "lesser-known subcommands, and real-world workflow patterns."
        )
    else:
        focus = (
            "Focus on: power-user keyboard shortcuts, hidden menu options, accessibility features, "
            "time-saving workflows, and advanced formatting tricks."
        )

    system = f"""\
You are an expert technical writer enhancing a developer cheat sheet for {name}.
Your job is to find NEW tips and tricks that are NOT already covered in the existing cheat sheet.
{focus}
Return ONLY a JSON object with a 'new_commands' array. Each entry must follow the schema exactly.
Do NOT repeat or paraphrase anything already in the 'Already covered' list below.
Mark is_curated as false for all entries (they are supplementary tips).
"""

    user = f"""\
Tool: {name}
Category: {category}
Audience: {audience}

Already covered ({len(existing_commands)} commands):
{existing_block}

Generate exactly {NEW_COMMANDS_PER_RUN} NEW commands/tips for {name} that are NOT in the list above.
Return ONLY the JSON object — no markdown, no explanation."""

    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


# ---------------------------------------------------------------------------
# AI clients
# ---------------------------------------------------------------------------

_openai_client: Optional[AsyncOpenAI] = None
_openrouter_client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


def get_openrouter_client() -> AsyncOpenAI:
    global _openrouter_client
    if _openrouter_client is None:
        _openrouter_client = AsyncOpenAI(
            api_key=OPENROUTER_API_KEY, base_url=OPENROUTER_BASE_URL
        )
    return _openrouter_client


async def _retry_delay(attempt: int) -> None:
    delay = BASE_RETRY_DELAY * (2 ** attempt) + random.uniform(0, 1)
    await asyncio.sleep(delay)


async def enhance_with_openai(messages: list[dict]) -> EnhancementResult:
    client = get_openai_client()
    last_exc = None
    for attempt in range(MAX_RETRIES_OPENAI):
        try:
            response = await client.beta.chat.completions.parse(
                model=OPENAI_MODEL,
                messages=messages,
                response_format=EnhancementResult,
                temperature=0.5,   # slightly higher than generator → more creative tips
            )
            return response.choices[0].message.parsed
        except (RateLimitError, APIStatusError, APIConnectionError) as exc:
            last_exc = exc
            if attempt < MAX_RETRIES_OPENAI - 1:
                print(f"      ⚠️  OpenAI attempt {attempt + 1} failed, retrying...")
                await _retry_delay(attempt)
    raise last_exc


async def enhance_with_openrouter(messages: list[dict]) -> EnhancementResult:
    client = get_openrouter_client()
    last_exc = None
    for attempt in range(MAX_RETRIES_OPENROUTER):
        try:
            response = await client.chat.completions.create(
                model=OPENROUTER_MODEL,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.5,
                extra_headers={
                    "HTTP-Referer": "https://devkeys.countrysnews.com",
                    "X-Title": "DevKeys Enhancement Engine",
                },
            )
            raw = response.choices[0].message.content
            data = json.loads(raw)
            return EnhancementResult(**data)
        except (RateLimitError, APIStatusError, APIConnectionError) as exc:
            last_exc = exc
            if attempt < MAX_RETRIES_OPENROUTER - 1:
                await _retry_delay(attempt)
        except Exception as exc:
            last_exc = exc
            if attempt < MAX_RETRIES_OPENROUTER - 1:
                await _retry_delay(attempt)
    raise last_exc


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def _normalise(text: str) -> str:
    """Normalise command text for dedup comparison."""
    return " ".join(text.lower().split())


def deduplicate(new_commands: list[NewCommand], existing_commands: list[dict]) -> list[NewCommand]:
    """Return only those new_commands not already covered in existing_commands."""
    existing_normalised = {_normalise(c["command"]) for c in existing_commands}
    seen: set[str] = set()
    unique = []
    for cmd in new_commands:
        norm = _normalise(cmd.command)
        if norm not in existing_normalised and norm not in seen:
            seen.add(norm)
            unique.append(cmd)
    return unique


# ---------------------------------------------------------------------------
# Per-tool enhancement task
# ---------------------------------------------------------------------------

async def enhance_tool(
    tool_meta: dict,
    log: dict,
    semaphore: asyncio.Semaphore,
    dry_run: bool,
) -> dict:
    """Returns a status dict."""
    slug = tool_meta["slug"]
    tool_path = TOOLS_DIR / f"{slug}.json"

    if not tool_path.exists():
        return {"slug": slug, "status": "skipped", "reason": "no json file"}

    existing_sheet = json.loads(tool_path.read_text(encoding="utf-8"))
    existing_commands = existing_sheet.get("commands", [])

    async with semaphore:
        print(f"  🔍 Enhancing: {tool_meta['name']:<35} ({len(existing_commands)} existing commands)")

        messages = build_enhancement_messages(tool_meta, existing_commands)

        provider = "openrouter"
        try:
            result = await enhance_with_openrouter(messages)
        except Exception as exc:
            print(f"      ❌ OpenRouter failed ({exc.__class__.__name__}) — trying OpenAI...")
            provider = "openai"
            try:
                result = await enhance_with_openai(messages)
            except Exception as or_exc:
                print(f"      ❌ OpenAI also failed: {or_exc}")
                return {"slug": slug, "status": "error", "error": str(or_exc)}

        # Dedup
        net_new = deduplicate(result.new_commands, existing_commands)
        if not net_new:
            print(f"      ℹ️  All suggestions were duplicates — skipping save")
            return {"slug": slug, "status": "no_new", "provider": provider}

        if dry_run:
            print(f"      [dry-run] Would add {len(net_new)} commands:")
            for cmd in net_new:
                print(f"        + {cmd.command[:80]}")
            return {"slug": slug, "status": "dry_run", "would_add": len(net_new)}

        # Append to existing sheet
        appended = [
            {
                "command":     cmd.command,
                "description": cmd.description,
                "scenario":    cmd.scenario,
                "language":    cmd.language,
                "tags":        cmd.tags,
                "is_curated":  False,   # supplementary tips — not promoted to curated
                "man_page":    cmd.man_page,
            }
            for cmd in net_new
        ]
        existing_sheet["commands"] = existing_commands + appended
        tool_path.write_text(
            json.dumps(existing_sheet, indent=2, ensure_ascii=False), encoding="utf-8"
        )

        # Update log
        prev = log.get(slug, {"times_enhanced": 0, "commands_added": 0})
        log[slug] = {
            "last_enhanced":   date.today().isoformat(),
            "times_enhanced":  prev["times_enhanced"] + 1,
            "commands_added":  prev["commands_added"] + len(net_new),
        }

        print(f"      ✅ Added {len(net_new)} new commands [{provider}]  total={len(existing_sheet['commands'])}")
        return {"slug": slug, "status": "ok", "added": len(net_new), "provider": provider}


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

async def run_enhancement(
    batch_size: int,
    category_filter: Optional[str],
    slug_filter: Optional[str],
    dry_run: bool,
    list_only: bool,
) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    # Build tool list from the generated JSON files — they carry category + audience
    log = load_log()
    tools: list[dict] = []
    for path in sorted(TOOLS_DIR.glob("*.json")):
        try:
            sheet = json.loads(path.read_text(encoding="utf-8"))
            tools.append({
                "name":     sheet.get("title", path.stem),
                "slug":     sheet["slug"],
                "audience": sheet.get("audience", "engineer"),
                "category": sheet.get("category", "Other"),
            })
        except Exception:
            pass  # skip corrupt files silently

    if slug_filter:
        tools = [t for t in tools if t["slug"] == slug_filter]
        if not tools:
            print(f"❌ Slug '{slug_filter}' not found or not yet generated.")
            sys.exit(1)
        batch = tools
    else:
        batch = pick_batch(tools, log, batch_size, category_filter)

    if list_only:
        print(f"Enhancement rotation preview ({len(batch)} tools):")
        for t in batch:
            entry = log.get(t["slug"])
            last = entry["last_enhanced"] if entry else "never"
            times = entry["times_enhanced"] if entry else 0
            print(f"  {t['name']:<35} last={last:<12} times={times}  [{t.get('category','?')}]")
        return

    total = len(batch)
    print(f"🚀 DevKeys Enhancement Engine")
    print(f"   Batch size   : {total}")
    print(f"   New per tool : {NEW_COMMANDS_PER_RUN}")
    print(f"   Concurrency  : {CONCURRENCY}")
    print(f"   Dry run      : {dry_run}")
    if category_filter:
        print(f"   Category     : {category_filter}")
    print()

    semaphore = asyncio.Semaphore(CONCURRENCY)
    start = time.time()

    results = await asyncio.gather(
        *[enhance_tool(t, log, semaphore, dry_run) for t in batch],
        return_exceptions=False,
    )

    if not dry_run:
        save_log(log)

    elapsed = time.time() - start
    ok        = [r for r in results if r["status"] == "ok"]
    errors    = [r for r in results if r["status"] == "error"]
    no_new    = [r for r in results if r["status"] == "no_new"]
    skipped   = [r for r in results if r["status"] == "skipped"]
    total_added = sum(r.get("added", 0) for r in ok)

    print()
    print(f"✅ Done in {elapsed:.1f}s")
    print(f"   Enhanced      : {len(ok)} tools")
    print(f"   Commands added: {total_added}")
    print(f"   No new found  : {len(no_new)}")
    print(f"   Skipped       : {len(skipped)}")
    print(f"   Errors        : {len(errors)}")
    if errors:
        print("   Failed slugs:")
        for e in errors:
            print(f"     {e['slug']}: {e.get('error', '')}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Daily enhancement engine — adds new tips/tricks to existing cheat sheets."
    )
    parser.add_argument(
        "--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
        help=f"Number of tools to enhance per run (default: {DEFAULT_BATCH_SIZE})"
    )
    parser.add_argument(
        "--category", type=str, default=None,
        help="Only enhance tools in this category (e.g. 'AI Tools')"
    )
    parser.add_argument(
        "--slug", type=str, default=None,
        help="Enhance a single specific tool by slug (e.g. cursor)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview what would be added without saving any changes"
    )
    parser.add_argument(
        "--list", action="store_true",
        help="Print the rotation queue without enhancing anything"
    )
    args = parser.parse_args()

    asyncio.run(run_enhancement(
        batch_size=args.batch_size,
        category_filter=args.category,
        slug_filter=args.slug,
        dry_run=args.dry_run,
        list_only=args.list,
    ))


if __name__ == "__main__":
    main()
