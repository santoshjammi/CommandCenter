import requests
from bs4 import BeautifulSoup
import json
import os

def generate_master_batch(url=None):
    # url = "https://quickref.me/"
    print(f"🌍 Fetching data from {url}...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to reach the target URL: {e}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    master_batch = []
    
    # QuickRef organizes its tools inside specific container divs
    # We look for all links that point to a tool's cheat sheet
    tool_links = soup.find_all('a', href=True)
    
    # We use a set to avoid adding duplicates
    seen_tools = set()

    for link in tool_links:
        # Filter out navigation links, focusing only on the cheat sheet pages
        href = link['href']
        
        # Tools usually have simple relative paths like '/docker', '/python', '/excel'
        if href.startswith('/') and len(href.split('/')) == 2:
            
            # The text inside the span or directly in the 'a' tag is the tool name
            tool_name = link.text.strip()
            
            # Basic validation to ensure it's an actual tool name
            if tool_name and tool_name not in seen_tools and len(tool_name) < 20:
                seen_tools.add(tool_name)
                
                # Intelligent Audience Routing
                # If it's a known non-dev tool, tag it for 'non-engineer'. Default to 'engineer'.
                non_engineer_tools = ['Excel', 'Word', 'Figma', 'Photoshop', 'Notion', 'Jira']
                
                audience = "non-engineer" if any(ne.lower() in tool_name.lower() for ne in non_engineer_tools) else "engineer"

                master_batch.append({
                    "name": tool_name,
                    "audience": audience
                })

    # Sort alphabetically for cleanliness
    master_batch = sorted(master_batch, key=lambda x: x['name'])

    # Write the output to be consumed by our Async Engine
    output_dir = "./data"
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "master_batch.json")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(master_batch, f, indent=2)

    print(f"✅ Scraper Complete! Extracted {len(master_batch)} tools.")
    print(f"📂 Saved directly to {output_file}. Ready for the AI engine.")

def scrape_devhints():
    """
    Scrapes the homepage of Devhints.io to extract all listed developer tools 
    and appends them to the master batch queue for the AI Engine.
    """
    url = "https://devhints.io/"
    print(f"🌍 Fetching data from {url}...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to reach {url}: {e}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    new_tools = []
    seen_tool_names = set()

    # Devhints lists its cheat sheets as standard anchor tags on the homepage
    links = soup.find_all('a', href=True)

    for link in links:
        href = link['href']
        tool_name = link.text.strip()
        
        # Valid tools usually have relative paths (e.g., '/bash', '/react') and a concise name
        if href.startswith('/') and tool_name and len(tool_name) < 25:
            # Filter out generic navigation links that might slip through
            if tool_name not in seen_tool_names and "cheatsheet" not in tool_name.lower():
                seen_tool_names.add(tool_name)
                
                # Intelligent Audience Routing
                non_engineer_tools = ['excel', 'word', 'figma', 'photoshop', 'illustrator', 'sketch']
                audience = "non-engineer" if any(ne in tool_name.lower() for ne in non_engineer_tools) else "engineer"

                new_tools.append({
                    "name": tool_name,
                    "audience": audience
                })

    print(f"🔍 Discovered {len(new_tools)} tools from Devhints.")

    # Manage the JSON Output & Merge with Existing Data
    output_dir = "./data"
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "master_batch.json")
    
    master_batch = []
    
    # Check if we already have a master list to avoid overwriting QuickRef's data
    if os.path.exists(output_file):
        with open(output_file, 'r', encoding='utf-8') as f:
            try:
                master_batch = json.load(f)
            except json.JSONDecodeError:
                master_batch = []
                
    # Merge and Deduplicate (ensuring we don't add 'React' if QuickRef already found it)
    existing_names = {item['name'].lower() for item in master_batch}
    added_count = 0
    
    for tool in new_tools:
        if tool['name'].lower() not in existing_names:
            master_batch.append(tool)
            existing_names.add(tool['name'].lower())
            added_count += 1

    # Sort alphabetically for cleanliness
    master_batch = sorted(master_batch, key=lambda x: x['name'])

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(master_batch, f, indent=2)

    print(f"✅ Successfully appended {added_count} new unique tools!")
    print(f"📂 Master queue now contains {len(master_batch)} total tools ready for generation.")

if __name__ == "__main__":
    scrape_devhints()

    urls = [
        "https://quickref.me/", "https://cheatography.com/", "https://overapi.com/","https://cheatsheets.zip/","https://learnxinyminutes.com/","https://www.cheat-sheets.org/", "https://www.scribd.com/collections/4567890/Cheat-Sheets", "https://www.slideshare.net/tag/cheat-sheet","https://www.toptal.com/developers/cheat-sheet","https://www.git-tower.com/learn/git/cheat-sheet","https://www.makeuseof.com/tag/cheat-sheets-for-developers/","https://www.pcmag.com/picks/best-cheat-sheets-for-developers","https://www.freecodecamp.org/news/cheat-sheets-for-developers/","https://www.sitepoint.com/cheat-sheets-for-developers/","https://www.smashingmagazine.com/cheat-sheets-for-developers/","https://www.tutorialspoint.com/cheat_sheet.htm","https://codehouse.vercel.app/","https://devsheets.io/","https://www.cheat-sheets.org/","https://htmlcheatsheet.com/","https://github.com/LeCoupa/awesome-cheatsheets"
    ]
    for url in urls:
        generate_master_batch(url)