"""
Phase 1: Async Cheat Sheet Generator

Reads data/clean_tools.json, generates a structured cheat sheet for every tool
that does not yet have a data/tools/{slug}.json file, and saves the output.

Primary AI provider : OpenRouter (google/gemma-4-26b-a4b-it, JSON mode)
Fallback provider   : OpenAI (GPT-4o, structured output via Pydantic)

Run:
    python3 generator.py              # process all pending tools
    python3 generator.py --limit 20   # dry-run / staged rollout
    python3 generator.py --list       # print pending tools without generating
"""

import argparse
import asyncio
import json
import os
import random
import sys
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from openai import AsyncOpenAI, RateLimitError, APIStatusError, APIConnectionError
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

OPENROUTER_API_KEY = os.environ["OPENROUTER_API_KEY"]
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

OPENROUTER_MODEL = "google/gemma-4-26b-a4b-it"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENAI_MODEL = "gpt-4o"                     # fallback only

CONCURRENCY = 5                             # simultaneous requests
MAX_RETRIES_OPENROUTER = 3
MAX_RETRIES_OPENAI = 2
BASE_RETRY_DELAY = 2.0                      # seconds; doubles each attempt

CLEAN_FILE = Path(__file__).parent / "data" / "clean_tools.json"
TOOLS_DIR = Path(__file__).parent / "data" / "tools"

# ---------------------------------------------------------------------------
# Taxonomy
# ---------------------------------------------------------------------------
CATEGORIES = [
    "Languages",
    "Frameworks",
    "Databases",
    "DevOps",
    "CLI Tools",
    "Cloud",
    "Editors",
    "Design",
    "Productivity",
    "Networking",
    "Security",
    "AI Chatbot",
    "Coding Assistant",
    "Image Generation",
    "AI Search",
    "AI Tools",
    "Other",
]

# Categories that use the AI-optimised prompt instead of the CLI prompt
AI_CATEGORIES = {"AI Chatbot", "Coding Assistant", "Image Generation", "AI Search", "AI Tools"}

# ---------------------------------------------------------------------------
# Pydantic Models (must match the frontend JSON schema exactly)
# ---------------------------------------------------------------------------

class Command(BaseModel):
    command: str = Field(description="The actual runnable command, code snippet, shortcut, or step")
    description: str = Field(description="Brief one-line description of what this command does")
    scenario: str = Field(description="Real-world scenario: when/why would you run this command?")
    language: str = Field(description="Shiki language token for syntax highlighting, e.g. bash, python, text")
    tags: list[str] = Field(default_factory=list, description="2-4 keyword tags")
    is_curated: bool = Field(default=True, description="True for the most important commands shown by default")
    man_page: str = Field(default="", description="URL to official documentation or man page for this command")


class CheatSheet(BaseModel):
    title: str
    slug: str
    description: str = Field(description="One-sentence summary (max 120 chars)")
    audience: str = Field(description="engineer or non-engineer")
    category: str = Field(description=f"One of: {', '.join(CATEGORIES)}")
    commands: list[Command] = Field(
        min_length=8,
        description=(
            "12-20 commands covering essential use cases. "
            "Mark the 6-8 most important ones as is_curated=true, the rest as is_curated=false. "
            "Include real man-page or docs URLs where known."
        )
    )


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

ENGINEER_SYSTEM = """\
You are an expert developer who writes concise, accurate cheat sheets for software engineers.
Generate a comprehensive cheat sheet as valid JSON matching the schema exactly.
Focus on: CLI commands, code syntax, flags, configuration snippets, and common real-world patterns.
Each command must have:
- 'command': actual runnable code or syntax — never pseudo-code
- 'description': one-line summary of what it does
- 'scenario': a real-world reason to use it (e.g. 'Use when you need to check running containers')
- 'language': Shiki-supported token (bash, python, javascript, yaml, etc.) or 'text'
- 'tags': 2-4 keywords
- 'is_curated': true for the 6-8 most essential commands, false for the rest
- 'man_page': official docs URL if known, empty string otherwise
Generate 12-20 commands total."""

NON_ENGINEER_SYSTEM = """\
You are a UX expert who writes concise, accurate cheat sheets for non-technical users.
Generate a comprehensive cheat sheet as valid JSON matching the schema exactly.
Focus on: keyboard shortcuts, menu paths, GUI interactions, and step-by-step workflows.
Each command must have:
- 'command': shortcut or menu path like 'Ctrl+Z' or 'File > Save As' — never CLI syntax
- 'description': one-line summary of what it does
- 'scenario': when a user would need this (e.g. 'When you accidentally delete text')
- 'language': always 'text' for shortcuts and steps
- 'tags': 2-4 keywords
- 'is_curated': true for the 6-8 most essential shortcuts, false for the rest
- 'man_page': official docs URL if known, empty string otherwise
Generate 12-20 commands total."""

AI_ENGINEER_SYSTEM = """\
You are an expert AI prompt engineer and developer advocate. Write a practical cheat sheet for engineers using the given AI tool.
Generate a comprehensive cheat sheet as valid JSON matching the schema exactly.
Focus on: API parameters, CLI flags, prompt techniques, model options, integration patterns, and advanced settings.
Each command must have:
- 'command': the exact prompt pattern, API parameter, CLI flag, or configuration setting
  e.g. "temperature=0.2" or "Think step by step. Then verify your answer." or "--model gpt-4o --stream"
- 'description': one-line summary of what it does or why it matters
- 'scenario': a real engineering use case (e.g. 'When building a code review bot that needs deterministic output')
- 'language': 'text' for prompt patterns, 'bash' for CLI flags, 'json' or 'python' for API config
- 'tags': 2-4 keywords from: accuracy, speed, creativity, cost, reasoning, formatting, context, vision, code, streaming
- 'is_curated': true for the 6-8 most impactful techniques, false for the rest
- 'man_page': official docs URL if known, empty string otherwise
Generate 12-20 entries total covering prompt engineering, API usage, and advanced features."""

AI_NON_ENGINEER_SYSTEM = """\
You are a plain-language AI coach. Write a practical cheat sheet for everyday users of the given AI tool.
Generate a comprehensive cheat sheet as valid JSON matching the schema exactly.
Focus on: everyday prompt phrases, formatting tricks, productivity shortcuts, and common use cases.
Each command must have:
- 'command': a plain-English prompt phrase or action the user types/clicks
  e.g. "Rewrite this in simpler language" or "Summarise this in 3 bullet points"
- 'description': one-line summary of what it produces
- 'scenario': when an everyday user would need this (e.g. 'When an email sounds too formal')
- 'language': always 'text'
- 'tags': 2-4 keywords from: writing, summarise, explain, reformat, brainstorm, images, research, study
- 'is_curated': true for the 6-8 most useful tips, false for the rest
- 'man_page': link to official help page if known, empty string otherwise
Generate 12-20 entries total covering everyday productivity use cases."""


def build_messages(tool: dict) -> list[dict]:
    category = tool.get("category", "")
    is_ai = category in AI_CATEGORIES
    if is_ai:
        system = AI_ENGINEER_SYSTEM if tool["audience"] == "engineer" else AI_NON_ENGINEER_SYSTEM
    else:
        system = ENGINEER_SYSTEM if tool["audience"] == "engineer" else NON_ENGINEER_SYSTEM
    user = (
        f"Create a cheat sheet for: {tool['name']}\n"
        f"Slug: {tool['slug']}\n"
        f"Audience: {tool['audience']}\n"
        f"Category: {category}\n"
        f"Pick the most appropriate category from: {', '.join(CATEGORIES)}\n"
        f"Return ONLY the JSON object — no markdown, no explanation."
    )
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
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
        )
    return _openrouter_client


# ---------------------------------------------------------------------------
# Generation helpers
# ---------------------------------------------------------------------------

async def _retry_delay(attempt: int) -> None:
    delay = BASE_RETRY_DELAY * (2 ** attempt) + random.uniform(0, 1)
    await asyncio.sleep(delay)


async def generate_with_openai(tool: dict) -> CheatSheet:
    client = get_openai_client()
    messages = build_messages(tool)
    last_exc = None
    for attempt in range(MAX_RETRIES_OPENAI):
        try:
            response = await client.beta.chat.completions.parse(
                model=OPENAI_MODEL,
                messages=messages,
                response_format=CheatSheet,
                temperature=0.3,
            )
            return response.choices[0].message.parsed
        except (RateLimitError, APIStatusError, APIConnectionError) as exc:
            last_exc = exc
            if attempt < MAX_RETRIES_OPENAI - 1:
                print(f"    ⚠️  OpenAI attempt {attempt + 1} failed ({exc.__class__.__name__}), retrying...")
                await _retry_delay(attempt)
    raise last_exc


async def generate_with_openrouter(tool: dict) -> CheatSheet:
    client = get_openrouter_client()
    messages = build_messages(tool)
    last_exc = None
    for attempt in range(MAX_RETRIES_OPENROUTER):
        try:
            response = await client.chat.completions.create(
                model=OPENROUTER_MODEL,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.3,
                extra_headers={
                    "HTTP-Referer": "https://devcheatsheets.app",
                    "X-Title": "Dev Cheat Sheets",
                },
            )
            raw = response.choices[0].message.content
            data = json.loads(raw)
            return CheatSheet(**data)
        except (RateLimitError, APIStatusError, APIConnectionError) as exc:
            last_exc = exc
            if attempt < MAX_RETRIES_OPENROUTER - 1:
                print(f"    ⚠️  OpenRouter attempt {attempt + 1} failed ({exc.__class__.__name__}), retrying...")
                await _retry_delay(attempt)
        except (json.JSONDecodeError, Exception) as exc:
            last_exc = exc
            if attempt < MAX_RETRIES_OPENROUTER - 1:
                await _retry_delay(attempt)
    raise last_exc


async def generate_tool(tool: dict, semaphore: asyncio.Semaphore) -> dict:
    """
    Returns a status dict: {"slug": ..., "status": "ok"|"skipped"|"error", "provider": ...}
    """
    slug = tool["slug"]
    out_path = TOOLS_DIR / f"{slug}.json"

    if out_path.exists():
        return {"slug": slug, "status": "skipped"}

    async with semaphore:
        print(f"  🔨 Generating: {tool['name']} ({slug})")
        provider = "openrouter"
        try:
            sheet = await generate_with_openrouter(tool)
        except Exception as or_exc:
            print(f"    ❌ OpenRouter failed for {slug}: {or_exc.__class__.__name__} — trying OpenAI...")
            provider = "openai"
            try:
                sheet = await generate_with_openrouter(tool)
            except Exception as or_exc:
                print(f"    ❌ OpenRouter also failed for {slug}: {or_exc}")
                return {"slug": slug, "status": "error", "error": str(or_exc)}

        # Write output in the new commands schema
        TOOLS_DIR.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(sheet.model_dump(), f, indent=2, ensure_ascii=False)

        print(f"    ✅ Saved [{provider}]: {slug}")
        return {"slug": slug, "status": "ok", "provider": provider}


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

async def run_generator(limit: Optional[int] = None, list_only: bool = False):
    with open(CLEAN_FILE, "r", encoding="utf-8") as f:
        all_tools: list[dict] = json.load(f)

    TOOLS_DIR.mkdir(parents=True, exist_ok=True)
    existing = {p.stem for p in TOOLS_DIR.glob("*.json")}

    pending = [t for t in all_tools if t["slug"] not in existing]

    if list_only:
        print(f"Pending ({len(pending)} tools):")
        for t in pending[:limit or len(pending)]:
            print(f"  {t['name']!r:35} [{t['audience']}]  -> {t['slug']}")
        return

    if limit:
        pending = pending[:limit]

    total = len(pending)
    already_done = len(all_tools) - len([t for t in all_tools if t["slug"] not in existing])

    print(f"🚀 Generator starting")
    print(f"   Total tools     : {len(all_tools)}")
    print(f"   Already generated: {already_done}")
    print(f"   To generate     : {total}")
    print(f"   Concurrency     : {CONCURRENCY}")
    print()

    if total == 0:
        print("✅ Nothing to do — all tools already generated.")
        return

    semaphore = asyncio.Semaphore(CONCURRENCY)
    start = time.time()

    results = await asyncio.gather(
        *[generate_tool(tool, semaphore) for tool in pending],
        return_exceptions=False,
    )

    elapsed = time.time() - start
    ok = sum(1 for r in results if r["status"] == "ok")
    errors = [r for r in results if r["status"] == "error"]

    print()
    print(f"✅ Done in {elapsed:.1f}s")
    print(f"   Generated: {ok}")
    print(f"   Errors   : {len(errors)}")
    if errors:
        print("   Failed slugs:")
        for e in errors:
            print(f"     {e['slug']}: {e.get('error', '')}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate cheat sheet JSON files for all tools.")
    parser.add_argument("--limit", type=int, default=None, help="Only generate N tools (for staged rollout)")
    parser.add_argument("--list", action="store_true", help="List pending tools without generating")
    args = parser.parse_args()

    asyncio.run(run_generator(limit=args.limit, list_only=args.list))
