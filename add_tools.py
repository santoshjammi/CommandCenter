"""
add_tools.py — Add new tools to the CommandCenter pipeline.

This script:
  1. Reads a CSV of tools (Name, Category, Description, Audience)
  2. Generates a slug for each tool
  3. Appends new entries to data/clean_tools.json (skips duplicates)
  4. Runs generator.py for only the newly added tools

Usage:
  # From a CSV file:
  python3 add_tools.py --csv my_tools.csv

  # Inline CSV string (no file needed):
  python3 add_tools.py --inline "Packer,DevOps,Automated machine image creation,engineer"

  # Multiple inline entries (one per line, use quotes):
  python3 add_tools.py --inline $'Packer,DevOps,Automated machine image creation,engineer\\nNomad,DevOps,Workload orchestrator and scheduler,engineer'

  # Dry run — shows what would be added without modifying anything:
  python3 add_tools.py --csv my_tools.csv --dry-run

  # Skip generation (only update clean_tools.json):
  python3 add_tools.py --csv my_tools.csv --no-generate

CSV Format:
  Tool Name, Category, Description, Audience
  - Audience is optional (defaults to "engineer")
  - Header row is optional (auto-detected)

Valid Categories:
  Languages, Frameworks, Databases, DevOps, CLI Tools,
  Cloud, Editors, Design, Productivity, Networking, Security, Other
"""

import argparse
import asyncio
import csv
import io
import json
import re
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CLEAN_FILE = Path(__file__).parent / "data" / "clean_tools.json"
TOOLS_DIR  = Path(__file__).parent / "data" / "tools"

VALID_CATEGORIES = [
    "Languages", "Frameworks", "Databases", "DevOps", "CLI Tools",
    "Cloud", "Editors", "Design", "Productivity", "Networking", "Security", "Other",
]

VALID_AUDIENCES = {"engineer", "non-engineer"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Explicit symbol replacements before slugification
_SYMBOL_MAP = [
    ("c++", "cplusplus"),
    ("c#",  "csharp"),
    ("f#",  "fsharp"),
    ("q#",  "qsharp"),
    ("g#",  "gsharp"),
    (".net", "dotnet"),
]


def slugify(name: str) -> str:
    """Convert a tool name to a URL-safe slug."""
    s = name.strip().lower()
    # Apply symbol substitutions before stripping non-alnum chars
    for src, dst in _SYMBOL_MAP:
        if s == src or s.startswith(src + " "):
            s = s.replace(src, dst, 1)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s


def normalize_category(raw: str) -> str:
    """Try to map a free-form category string to a valid CATEGORIES value."""
    raw = raw.strip()
    for cat in VALID_CATEGORIES:
        if cat.lower() == raw.lower():
            return cat
    # Fuzzy fallback mappings (e.g. HashiCorp "Core" → "DevOps")
    FALLBACKS = {
        "core": "DevOps",
        "additional": "DevOps",
        "infrastructure": "DevOps",
        "secrets": "Security",
        "networking": "Networking",
        "orchestration": "DevOps",
        "identity": "Security",
        "access": "Security",
    }
    for keyword, mapped in FALLBACKS.items():
        if keyword in raw.lower():
            return mapped
    # Default
    print(f"  ⚠️  Unknown category '{raw}' — defaulting to 'Other'. Edit clean_tools.json to fix.")
    return "Other"


# Names that are clearly navigation/meta, not real tools
_JUNK_NAMES = {
    "about", "bookmarks", "browse all sheets", "all sheets",
    "buy me a coffee", "social bookmarks", "social media",
    "advanced search", "pdf version", "ai directory",
    "notes", "search", "home", "categories", "collections",
    "contributors", "feature requests", "sign in", "sign up",
    "support", "on review", "new cheatsheet", "view all sheets",
    "try now", "try now!", "cheatsheets.zip", "devhints.io", "quickref.me",
    "google", "after", "adobe systems", "html cheat sheet",
    "adobe",
}

# Regex patterns for junk detection
import re as _re
_GITHUB_STARS_RE = _re.compile(r"\d+[\.,]?\d*[kmb]?", _re.IGNORECASE)


def _is_junk(name: str) -> str | None:
    """Return a reason string if this entry should be skipped, or None if it's valid."""
    # Contains newline (multi-line scrape artifact like "Star\n45.7k")
    if "\n" in name or "\r" in name:
        return "contains newline (scrape artifact)"
    # Double-space = duplicated name formatting artifact (e.g. "101  101")
    if "  " in name:
        return "double-space in name (formatting artifact)"
    # Starts with # (meta notes)
    if name.startswith("#"):
        return "starts with # (meta entry)"
    # Starts with . followed by a space or special word
    if name.startswith(".") and not any(name.lower().startswith(p) for p in [".net"]):
        return "starts with . (navigation/file entry)"
    # Ends with 'version' (navigation link, not a tool)
    if name.lower().endswith("version"):
        return "ends with 'version' (navigation entry)"
    # Looks like a website URL (contains .io, .me, .org, .com — not a tool name)
    lowered = name.lower()
    if any(lowered.endswith(ext) for ext in (".io", ".me", ".zip", ".org", ".net") if lowered not in (".net",)):
        return "looks like a website URL, not a tool"
    # Non-ASCII dominant (e.g. Chinese characters)
    ascii_chars = sum(1 for c in name if ord(c) < 128)
    if ascii_chars / max(len(name), 1) < 0.5:
        return "non-ASCII dominant (likely foreign-language scrape artifact)"
    # Known junk names
    if name.lower().strip("!") in _JUNK_NAMES or name.lower() in _JUNK_NAMES:
        return "known non-tool entry"
    # Very short (1-2 chars), likely noise
    if len(name.strip()) <= 2:
        return "too short to be a real tool name"
    return None


def parse_master_batch(path: Path) -> tuple[list[dict], list[tuple[str, str]]]:
    """Parse master_batch.json into tool dicts. Returns (valid_tools, skipped_list)."""
    with open(path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    tools = []
    skipped = []
    existing_tool_files = {p.stem for p in TOOLS_DIR.glob("*.json")}
    for entry in entries:
        name = entry.get("name", "").strip()
        if not name:
            continue
        reason = _is_junk(name)
        if reason:
            skipped.append((name, reason))
            continue
        audience = entry.get("audience", "engineer").strip().lower()
        if audience not in VALID_AUDIENCES:
            audience = "engineer"
        slug = slugify(name)
        if slug in existing_tool_files:
            skipped.append((name, f"data/tools/{slug}.json already exists"))
            continue
        tools.append({
            "name": name,
            "slug": slug,
            "category": "Other",   # AI will pick the correct category during generation
            "description": f"{name} cheat sheet.",
            "audience": audience,
        })
    return tools, skipped


def parse_csv(text: str) -> list[dict]:
    """Parse CSV text into a list of tool dicts."""
    reader = csv.reader(io.StringIO(text.strip()))
    rows = list(reader)

    if not rows:
        return []

    # Auto-detect header row: if first cell looks like "tool" or "name"
    has_header = rows[0][0].strip().lower() in {"tool name", "name", "tool", "tool_name"}
    data_rows = rows[1:] if has_header else rows

    tools = []
    for i, row in enumerate(data_rows):
        if not row or not row[0].strip():
            continue
        if len(row) < 2:
            print(f"  ⚠️  Skipping row {i+1} — needs at least Name and Category: {row}")
            continue

        name = row[0].strip()
        category = normalize_category(row[1].strip()) if len(row) > 1 else "Other"
        description = row[2].strip() if len(row) > 2 else f"{name} cheat sheet."
        audience = row[3].strip().lower() if len(row) > 3 else "engineer"

        if audience not in VALID_AUDIENCES:
            print(f"  ⚠️  Invalid audience '{audience}' for {name} — defaulting to 'engineer'.")
            audience = "engineer"

        tools.append({
            "name": name,
            "slug": slugify(name),
            "category": category,
            "description": description,
            "audience": audience,
        })

    return tools


def load_clean_tools() -> list[dict]:
    if CLEAN_FILE.exists():
        with open(CLEAN_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_clean_tools(tools: list[dict]) -> None:
    with open(CLEAN_FILE, "w", encoding="utf-8") as f:
        json.dump(tools, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Add tools to CommandCenter and generate their cheat sheets.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--csv", metavar="FILE", help="Path to a CSV file of tools to add.")
    input_group.add_argument("--inline", metavar="CSV_STRING", help="Inline CSV string of tools.")
    input_group.add_argument("--json", metavar="FILE", dest="json_file", help="Path to a master_batch.json file.")

    parser.add_argument("--dry-run", action="store_true", help="Show what would be added without making changes.")
    parser.add_argument("--no-generate", action="store_true", help="Only update clean_tools.json, skip generation.")
    parser.add_argument("--force", action="store_true", help="Re-generate JSON even if it already exists (deletes existing file).")
    args = parser.parse_args()

    # --- Parse input ---
    if args.json_file:
        json_path = Path(args.json_file)
        if not json_path.exists():
            print(f"❌ JSON file not found: {json_path}")
            sys.exit(1)
        new_tools, skipped = parse_master_batch(json_path)
        if skipped:
            print(f"  ⏭️  Skipping {len(skipped)} junk/meta entries:")
            for name, reason in skipped:
                print(f"      '{name}' — {reason}")
        if not new_tools:
            print("❌ No valid tools found in input after filtering.")
            sys.exit(1)
    else:
        if args.csv:
            csv_path = Path(args.csv)
            if not csv_path.exists():
                print(f"❌ CSV file not found: {csv_path}")
                sys.exit(1)
            text = csv_path.read_text(encoding="utf-8")
        else:
            text = args.inline
        new_tools = parse_csv(text)
        if not new_tools:
            print("❌ No valid tools found in input.")
            sys.exit(1)

    # --- Deduplicate against existing clean_tools.json ---
    existing_tools = load_clean_tools()
    existing_slugs = {t["slug"] for t in existing_tools}

    to_add = []
    for t in new_tools:
        if t["slug"] in existing_slugs:
            print(f"  ℹ️  Already in clean_tools.json — skipping: {t['name']} ({t['slug']})")
        else:
            to_add.append(t)

    if not to_add:
        print("\n✅ All provided tools are already registered. Nothing to add.")
        sys.exit(0)

    # --- Report ---
    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Adding {len(to_add)} new tool(s):\n")
    for t in to_add:
        print(f"  + {t['name']:<30} slug={t['slug']:<30} category={t['category']:<15} audience={t['audience']}")

    if args.dry_run:
        print("\n[Dry run] No changes made.")
        sys.exit(0)

    # --- If --force, delete existing JSON files so generator re-creates them ---
    if args.force:
        for t in to_add:
            out = TOOLS_DIR / f"{t['slug']}.json"
            if out.exists():
                out.unlink()
                print(f"  🗑️  Deleted existing: {t['slug']}.json")

    # --- Update clean_tools.json ---
    updated = existing_tools + to_add
    save_clean_tools(updated)
    print(f"\n✅ Updated clean_tools.json ({len(existing_tools)} → {len(updated)} tools)")

    if args.no_generate:
        print("ℹ️  Skipping generation (--no-generate). Run `python3 generator.py` when ready.")
        sys.exit(0)

    # --- Run generator for new slugs only ---
    # The generator already skips existing files, so it will only process our new ones
    print(f"\n🚀 Running generator for {len(to_add)} new tool(s)...\n")
    result = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "generator.py")],
        cwd=str(Path(__file__).parent),
    )

    if result.returncode != 0:
        print("\n❌ Generator exited with errors.")
        sys.exit(result.returncode)

    print("\n✅ All done! New tools are ready in data/tools/")
    print("   Rebuild the search index: cd frontend && npm run build:search-index")


if __name__ == "__main__":
    main()
