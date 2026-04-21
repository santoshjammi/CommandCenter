import re
import requests
from bs4 import BeautifulSoup
import json
import os

# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}
OUTPUT_DIR = "./data"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "master_batch.json")
NON_ENGINEER_KEYWORDS = [
    'excel', 'word', 'figma', 'photoshop', 'illustrator',
    'sketch', 'notion', 'jira',
]


def _get_audience(tool_name: str) -> str:
    name_lower = tool_name.lower()
    return "non-engineer" if any(k in name_lower for k in NON_ENGINEER_KEYWORDS) else "engineer"


def _append_to_master_batch(new_tools: list) -> tuple[int, int]:
    """Load master_batch.json, merge new_tools by (name, audience) key, save, return (added, total)."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    master_batch = []
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            try:
                master_batch = json.load(f)
            except json.JSONDecodeError:
                master_batch = []

    existing_keys = {(item['name'].lower(), item['audience']) for item in master_batch}
    added_count = 0
    for tool in new_tools:
        key = (tool['name'].lower(), tool['audience'])
        if key not in existing_keys:
            master_batch.append(tool)
            existing_keys.add(key)
            added_count += 1

    master_batch = sorted(master_batch, key=lambda x: x['name'])
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(master_batch, f, indent=2)
    return added_count, len(master_batch)


# ---------------------------------------------------------------------------
# Generic scraper – single-segment relative paths (/tool-name)
# ---------------------------------------------------------------------------
def generate_master_batch(url=None):
    """Generic scraper for sites with simple /tool-name relative href patterns."""
    print(f"🌍 Fetching data from {url}...")
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to reach the target URL: {e}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    new_tools = []
    seen_tool_keys = set()

    for link in soup.find_all('a', href=True):
        href = link['href']
        if href == '/':
            continue
        # Normalize trailing slash; keep only single-segment paths like /python or /bash/
        clean = href.rstrip('/')
        if not clean.startswith('/') or len(clean.split('/')) != 2:
            continue
        tool_name = link.text.strip()
        if not tool_name or len(tool_name) >= 20:
            continue
        audience = _get_audience(tool_name)
        key = (tool_name, audience)
        if key not in seen_tool_keys:
            seen_tool_keys.add(key)
            new_tools.append({"name": tool_name, "audience": audience})

    added_count, total = _append_to_master_batch(new_tools)
    print(f"✅ {url}: appended {added_count} new tools. Master queue: {total} total.")

def scrape_devhints():
    """
    Scrapes the homepage of Devhints.io to extract all listed developer tools 
    and appends them to the master batch queue for the AI Engine.
    """
    url = "https://devhints.io/"
    print(f"🌍 Fetching data from {url}...")
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to reach {url}: {e}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    new_tools = []
    seen_tool_keys = set()

    for link in soup.find_all('a', href=True):
        href = link['href']
        tool_name = link.text.strip()
        if href.startswith('/') and tool_name and len(tool_name) < 25:
            if "cheatsheet" not in tool_name.lower():
                audience = _get_audience(tool_name)
                key = (tool_name, audience)
                if key not in seen_tool_keys:
                    seen_tool_keys.add(key)
                    new_tools.append({"name": tool_name, "audience": audience})

    print(f"🔍 Discovered {len(new_tools)} tools from Devhints.")
    added_count, total = _append_to_master_batch(new_tools)
    print(f"✅ Appended {added_count} new unique tools! Master queue: {total} total.")


# ---------------------------------------------------------------------------
# Custom scrapers for sites that need special link extraction logic
# ---------------------------------------------------------------------------

def scrape_cheat_sheets_org():
    """cheat-sheets.org uses #anchor hrefs for each tool category."""
    url = "https://www.cheat-sheets.org/"
    print(f"🌍 Fetching data from {url}...")
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to reach {url}: {e}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    new_tools = []
    seen_tool_keys = set()
    # Skip utility anchors that are not tool categories
    skip_anchors = {'#Donate', '#Feed'}

    for link in soup.find_all('a', href=True):
        href = link['href']
        if not href.startswith('#') or href in skip_anchors:
            continue
        tool_name = link.text.strip()
        if not tool_name or len(tool_name) > 40:
            continue
        audience = _get_audience(tool_name)
        key = (tool_name, audience)
        if key not in seen_tool_keys:
            seen_tool_keys.add(key)
            new_tools.append({"name": tool_name, "audience": audience})

    print(f"🔍 Discovered {len(new_tools)} tools from cheat-sheets.org.")
    added_count, total = _append_to_master_batch(new_tools)
    print(f"✅ Appended {added_count} new tools. Master queue: {total} total.")


def scrape_git_tower():
    """git-tower.com lists cheat sheets at absolute /learn/cheat-sheets/{slug} URLs."""
    url = "https://www.git-tower.com/learn/cheat-sheets/"
    print(f"🌍 Fetching data from {url}...")
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to reach {url}: {e}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    new_tools = []
    seen_slugs = set()

    for link in soup.find_all('a', href=True):
        href = link['href']
        if '/learn/cheat-sheets/' not in href:
            continue
        slug = href.rstrip('/').split('/learn/cheat-sheets/')[-1]
        if not slug or slug in seen_slugs:
            continue
        seen_slugs.add(slug)
        tool_name = slug.replace('-', ' ').title()
        audience = _get_audience(tool_name)
        new_tools.append({"name": tool_name, "audience": audience})

    print(f"🔍 Discovered {len(new_tools)} tools from git-tower.com.")
    added_count, total = _append_to_master_batch(new_tools)
    print(f"✅ Appended {added_count} new tools. Master queue: {total} total.")


def scrape_devsheets_io():
    """devsheets.io technology cards expose the tool name in the img alt attribute."""
    url = "https://devsheets.io/"
    print(f"🌍 Fetching data from {url}...")
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to reach {url}: {e}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    new_tools = []
    seen_tool_keys = set()

    for link in soup.find_all('a', href=True):
        if not link['href'].startswith('/technology/'):
            continue
        img = link.find('img', alt=True)
        if not img:
            continue
        # alt text is "{ToolName} logo"
        tool_name = img['alt'].replace(' logo', '').strip()
        if not tool_name:
            continue
        audience = _get_audience(tool_name)
        key = (tool_name, audience)
        if key not in seen_tool_keys:
            seen_tool_keys.add(key)
            new_tools.append({"name": tool_name, "audience": audience})

    print(f"🔍 Discovered {len(new_tools)} tools from devsheets.io.")
    added_count, total = _append_to_master_batch(new_tools)
    print(f"✅ Appended {added_count} new tools. Master queue: {total} total.")


def scrape_learnxinyminutes():
    """learnxinyminutes.com uses /slug/ paths; locale-code links must be filtered out."""
    url = "https://learnxinyminutes.com/"
    print(f"🌍 Fetching data from {url}...")
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to reach {url}: {e}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    new_tools = []
    seen_tool_keys = set()
    # Matches ISO 639-1 locale codes like "de", "ca", "pt-br", "zh-cn"
    locale_pattern = re.compile(r'^[a-z]{2}(-[a-z]{2,3})?$')

    for link in soup.find_all('a', href=True):
        href = link['href']
        tool_name = link.text.strip()
        clean = href.rstrip('/')
        if not clean.startswith('/') or len(clean.split('/')) != 2:
            continue
        if not tool_name or len(tool_name) > 35:
            continue
        # Skip locale redirect links (all-lowercase 2-5 char codes)
        if locale_pattern.match(tool_name):
            continue
        audience = _get_audience(tool_name)
        key = (tool_name, audience)
        if key not in seen_tool_keys:
            seen_tool_keys.add(key)
            new_tools.append({"name": tool_name, "audience": audience})

    print(f"🔍 Discovered {len(new_tools)} tools from learnxinyminutes.com.")
    added_count, total = _append_to_master_batch(new_tools)
    print(f"✅ Appended {added_count} new tools. Master queue: {total} total.")


if __name__ == "__main__":
    # Custom scrapers for sites with non-standard link structures
    scrape_devhints()
    scrape_cheat_sheets_org()
    scrape_git_tower()
    scrape_devsheets_io()
    scrape_learnxinyminutes()

    # Generic scraper for sites with simple /tool-name relative hrefs
    working_urls = [
        "https://quickref.me/",
        "https://overapi.com/",
        "https://cheatsheets.zip/",
        "https://github.com/LeCoupa/awesome-cheatsheets",
    ]
    for url in working_urls:
        generate_master_batch(url)