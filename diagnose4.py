import requests
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}

r = requests.get("https://devsheets.io/", headers=headers, timeout=10)
soup = BeautifulSoup(r.text, 'html.parser')

print("===== devsheets.io - raw inner HTML of technology links =====")
for a in soup.find_all('a', href=True):
    if a['href'].startswith('/technology/'):
        print(f"href: {a['href']}")
        print(f"  inner html: {str(a)[:300]}")
        print()
