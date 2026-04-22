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

def slugify(name: str) -> str:
    """Convert a tool name to a URL-safe slug."""
    s = name.strip().lower()
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

    parser.add_argument("--dry-run", action="store_true", help="Show what would be added without making changes.")
    parser.add_argument("--no-generate", action="store_true", help="Only update clean_tools.json, skip generation.")
    parser.add_argument("--force", action="store_true", help="Re-generate JSON even if it already exists (deletes existing file).")
    args = parser.parse_args()

    # --- Parse input ---
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
