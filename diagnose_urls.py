import requests
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}

urls = [
    "https://devhints.io/",
    "https://quickref.me/",
    "https://cheatography.com/",
    "https://overapi.com/",
    "https://cheatsheets.zip/",
    "https://learnxinyminutes.com/",
    "https://www.cheat-sheets.org/",
    "https://www.scribd.com/collections/4567890/Cheat-Sheets",
    "https://www.slideshare.net/tag/cheat-sheet",
    "https://www.toptal.com/developers/cheat-sheet",
    "https://www.git-tower.com/learn/git/cheat-sheet",
    "https://www.makeuseof.com/tag/cheat-sheets-for-developers/",
    "https://www.pcmag.com/picks/best-cheat-sheets-for-developers",
    "https://www.freecodecamp.org/news/cheat-sheets-for-developers/",
    "https://www.sitepoint.com/cheat-sheets-for-developers/",
    "https://www.smashingmagazine.com/cheat-sheets-for-developers/",
    "https://www.tutorialspoint.com/cheat_sheet.htm",
    "https://codehouse.vercel.app/",
    "https://devsheets.io/",
    "https://htmlcheatsheet.com/",
    "https://github.com/LeCoupa/awesome-cheatsheets",
]

for url in urls:
    try:
        r = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
        soup = BeautifulSoup(r.text, 'html.parser')
        links = soup.find_all('a', href=True)
        candidates = [
            l.text.strip() for l in links
            if l['href'].startswith('/') and l.text.strip() and len(l.text.strip()) < 30
        ]
        print(f"[{r.status_code}] {url}  -> {len(candidates)} candidate links | final_url={r.url}")
    except Exception as e:
        print(f"[FAIL] {url}  -> {e}")
