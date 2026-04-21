import requests
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}

for site_url in ["https://cheatography.com/", "https://overapi.com/", "https://cheatsheets.zip/"]:
    print(f"\n===== {site_url} =====")
    r = requests.get(site_url, headers=headers, timeout=10)
    soup = BeautifulSoup(r.text, 'html.parser')
    links = soup.find_all('a', href=True)
    # Show links that would match current generate_master_batch logic
    matches = [a for a in links if a['href'].startswith('/') and len(a['href'].split('/')) == 2 and a.text.strip() and len(a.text.strip()) < 20]
    print(f"  Matches current logic: {len(matches)}")
    for a in matches[:15]:
        print(f"    {a['href']!r:30} {a.text.strip()!r}")
    # Also show all relative paths to understand the structure
    rel = [a for a in links if a['href'].startswith('/') and a.text.strip() and len(a.text.strip()) < 30]
    print(f"  All relative links: {len(rel)}, sample:")
    for a in rel[:10]:
        print(f"    {a['href']!r:40} {a.text.strip()!r}")
