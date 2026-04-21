"""
Phase 0: Data Cleaner

Reads data/master_batch.json, normalises and deduplicates entries,
and writes a high-quality data/clean_tools.json ready for the generator.
"""

import json
import re
import os

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
INPUT_FILE = os.path.join(os.path.dirname(__file__), "data", "master_batch.json")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "data", "clean_tools.json")

# ---------------------------------------------------------------------------
# Navigation / UI noise — anything that is a site label rather than a tool
# ---------------------------------------------------------------------------
NAV_NOISE = {
    "Home", "About", "Sign in", "Sign up", "Login", "Logout", "Log out",
    "Download", "Next", "Previous", "Search", "Buy Me a Coffee",
    "Contributors", "Features", "Pricing", "Support", "Bookmarks",
    "Collections", "Categories", "All Sheets", "View all sheets",
    "On Review", "New CheatSheet", "Upload", "Language (EN)", "API",
    "Feature Requests", "Try Now!", "Stars", "Fork", "Share to Twitter",
    "Donate", "Atom",
    # Too generic — site/company names that aren't cheat-sheet topics
    "Adobe", "Adobe Systems", "Microsoft", "Google", "Apple", "Amazon",
    "After", "Advanced Search", "AI Directory", "AGENTS",
}

# Patterns that indicate navigation text even if not in the above set
_NOISE_PATTERNS = re.compile(
    r"""
    ^\d+(\.\d+)?k?$                     # pure number / GitHub star counts  (6.7k, 12, 3)
    | ^\W+$                             # only punctuation / symbols
    | ^[a-z]{1,2}(-[a-z]{2,3})?$       # ISO locale codes  (de, pt-br, zh-cn)
    | cheat\s*sheet$                    # "… Cheat Sheet" titles
    | pdf\s+version                     # ".pdf version"
    | ^\d+\s+\d+$                       # "101  101" residues after cleanup
    | ^fork\b                           # "Fork\n  6.7k" residues
    | ^\#+                              # starts with # (markdown anchors, #Notes)
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Expanded non-engineer keyword set
NON_ENGINEER_KEYWORDS = [
    "excel", "word", "powerpoint", "outlook", "onenote", "office",
    "figma", "photoshop", "illustrator", "lightroom", "premiere",
    "after effects", "indesign", "xd", "sketch",
    "notion", "airtable", "jira", "trello", "asana", "confluence",
    "slack", "zoom", "teams", "canva",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalise_name(raw: str) -> str:
    """
    Fix the devhints 'slug  Long Title' pattern and strip whitespace / newlines.
    """
    # Replace tabs and newlines with a single space first
    raw = re.sub(r"[\t\n\r]+", " ", raw).strip()
    # devhints: "angularjs  Angular.js"  ->  "Angular.js"
    if "  " in raw:
        raw = raw.split("  ", 1)[1].strip()
    return raw.strip()


def get_audience(name: str) -> str:
    n = name.lower()
    if any(kw in n for kw in NON_ENGINEER_KEYWORDS):
        return "non-engineer"
    return "engineer"


def is_valid(name: str) -> bool:
    if not name:
        return False
    if name in NAV_NOISE:
        return False
    if len(name) < 2 or len(name) > 60:
        return False
    if _NOISE_PATTERNS.search(name):
        return False
    return True


def make_slug(name: str) -> str:
    """
    Convert a tool name to a URL-safe slug.
    """
    s = name
    # Special substitutions before lowercasing
    substitutions = [
        ("C#", "csharp"), ("F#", "fsharp"), ("C++", "cpp"),
        (".NET", "dotnet"), ("Node.js", "nodejs"), ("Vue.js", "vuejs"),
        ("React.js", "reactjs"), ("Next.js", "nextjs"), ("Nuxt.js", "nuxtjs"),
        ("Express.js", "expressjs"), ("Angular.js", "angularjs"),
        ("Electron.js", "electronjs"), ("Three.js", "threejs"),
        ("Ember.js", "emberjs"), ("Backbone.js", "backbonejs"),
        ("Socket.io", "socketio"), (".js", "js"), ("Q#", "qsharp"),
    ]
    for src, dst in substitutions:
        s = s.replace(src, dst)
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)   # strip non-alnum except spaces and hyphens
    s = re.sub(r"\s+", "-", s.strip())
    s = re.sub(r"-+", "-", s)
    return s.strip("-") or "unknown"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        raw_data: list[dict] = json.load(f)

    seen: set[tuple[str, str]] = set()
    clean: list[dict] = []
    skipped = 0

    for item in raw_data:
        name = normalise_name(item.get("name", ""))
        if not is_valid(name):
            skipped += 1
            continue

        audience = get_audience(name)   # re-derive with expanded keyword list
        slug = make_slug(name)
        key = (name.lower(), audience)

        if key in seen:
            skipped += 1
            continue

        seen.add(key)
        clean.append({
            "name": name,
            "slug": slug,
            "audience": audience,
        })

    clean.sort(key=lambda x: x["name"].lower())

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(clean, f, indent=2)

    print(f"✅ Cleaning complete.")
    print(f"   Input entries   : {len(raw_data)}")
    print(f"   Skipped (noise) : {skipped}")
    print(f"   Clean tools     : {len(clean)}")
    print(f"   Engineers       : {sum(1 for d in clean if d['audience'] == 'engineer')}")
    print(f"   Non-engineers   : {sum(1 for d in clean if d['audience'] == 'non-engineer')}")
    print(f"📂 Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    run()
