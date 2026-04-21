import json, re

with open('data/master_batch.json') as f:
    data = json.load(f)

NAV = {
    'Home','About','Sign in','Sign up','Login','Logout','Download','Next','Previous',
    'Search','Buy Me a Coffee','Contributors','Features','Pricing','Support',
    'Bookmarks','Collections','Categories','All Sheets','View all sheets',
    'On Review','New CheatSheet','Upload','Language (EN)','API','Feature Requests'
}

def clean(n):
    if '  ' in n:
        return n.split('  ', 1)[1].strip()
    return n.strip()

def valid(n):
    if not n or '\n' in n or '\t' in n:
        return False
    if n in NAV:
        return False
    if n.startswith('#'):
        return False
    if 'pdf' in n.lower() and 'version' in n.lower():
        return False
    return True

seen, out = set(), []
for item in data:
    n = clean(item['name'])
    if not valid(n):
        continue
    aud = item['audience']
    k = (n.lower(), aud)
    if k in seen:
        continue
    seen.add(k)
    out.append({'name': n, 'audience': aud})

out.sort(key=lambda x: x['name'].lower())
print(f'After cleaning: {len(out)} tools')
print(f'Engineers: {sum(1 for d in out if d["audience"] == "engineer")}')
print(f'Non-engineers: {sum(1 for d in out if d["audience"] == "non-engineer")}')

# Show first 30
print('\nSample:')
for d in out[:30]:
    print(f'  {d["name"]!r:35} {d["audience"]}')
