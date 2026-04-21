import requests
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}

# Check learnxinyminutes sample
r = requests.get("https://learnxinyminutes.com/", headers=headers, timeout=10)
soup = BeautifulSoup(r.text, 'html.parser')
links = soup.find_all('a', href=True)
rel = [a for a in links if a['href'].startswith('/') and a.text.strip() and len(a.text.strip()) < 30]
print(f"learnxinyminutes - {len(rel)} relative links, sample:")
for a in rel[:20]:
    print(f"  {a['href']!r:40} {a.text.strip()!r}")

# Check all git-tower cheatsheet links
print("\n===== git-tower cheat sheets =====")
r2 = requests.get("https://www.git-tower.com/learn/cheat-sheets/", headers=headers, timeout=10)
soup2 = BeautifulSoup(r2.text, 'html.parser')
for a in soup2.find_all('a', href=True):
    href = a['href']
    if '/learn/cheat-sheets/' in href and href != 'https://www.git-tower.com/learn/cheat-sheets':
        print(f"  {href!r:70} {a.text.strip()[:50]!r}")
