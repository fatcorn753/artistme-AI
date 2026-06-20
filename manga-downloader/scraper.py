"""
Manga scraper for kmansin09.top
Handles fetching manga info, chapter lists, and page images.
"""

import re
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

BASE_URL = "https://kmansin09.top"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ja,en;q=0.5",
    "Referer": BASE_URL,
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


def get_page(url, retries=3, delay=1.5):
    for attempt in range(retries):
        try:
            r = SESSION.get(url, timeout=15)
            r.raise_for_status()
            return r
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                raise e


def search_manga(query, max_pages=5):
    """Search manga by keyword across listing pages, returns list of {title, url, cover}"""
    query_lower = query.lower()
    results = []
    seen = set()

    for page in range(1, max_pages + 1):
        url = f"{BASE_URL}/manga/page/{page}/" if page > 1 else f"{BASE_URL}/manga/"
        try:
            r = get_page(url)
        except Exception:
            break
        soup = BeautifulSoup(r.text, "html.parser")

        # Each manga: title link is in h3.h5 > a
        for h3 in soup.select("h3.h5"):
            a = h3.find("a", href=lambda h: h and "/manga/" in h)
            if not a:
                continue
            title = a.get_text(strip=True)
            href = a["href"]
            if href in seen:
                continue
            # Filter by query
            if query_lower and query_lower not in title.lower() and query_lower not in href.lower():
                continue
            # Get cover from sibling .item-thumb img
            cover = ""
            parent = h3.find_parent("div", class_="col") or h3.find_parent("div")
            if parent:
                img = parent.find("img")
                if img:
                    cover = img.get("src") or img.get("data-src") or ""
            seen.add(href)
            results.append({"title": title, "url": href, "cover": cover})

    return results


def list_all_manga(page=1):
    """List all manga on a given page, returns list of {title, url, cover}"""
    url = f"{BASE_URL}/manga/page/{page}/" if page > 1 else f"{BASE_URL}/manga/"
    r = get_page(url)
    soup = BeautifulSoup(r.text, "html.parser")
    results = []
    seen = set()
    for h3 in soup.select("h3.h5"):
        a = h3.find("a", href=lambda h: h and "/manga/" in h)
        if not a:
            continue
        title = a.get_text(strip=True)
        href = a["href"]
        if href in seen:
            continue
        seen.add(href)
        cover = ""
        parent = h3.find_parent("div")
        if parent:
            img = parent.find("img")
            if img:
                cover = img.get("src") or img.get("data-src") or ""
        results.append({"title": title, "url": href, "cover": cover})
    return results


def get_manga_info(manga_url):
    """Get manga title, cover, description, and chapter list from manga page"""
    r = get_page(manga_url)
    soup = BeautifulSoup(r.text, "html.parser")

    title = ""
    for sel in ["h1.entry-title", "h1", ".infox h1", ".bgtitle h1"]:
        el = soup.select_one(sel)
        if el:
            title = el.get_text(strip=True)
            break

    cover = ""
    for sel in [".thumbook img", ".thumb img", ".infomanga img"]:
        el = soup.select_one(sel)
        if el:
            cover = el.get("src") or el.get("data-src") or ""
            break

    desc = ""
    for sel in [".entry-content p", ".sinopsis p", ".desc p"]:
        el = soup.select_one(sel)
        if el:
            desc = el.get_text(strip=True)
            break

    chapters = []
    for a in soup.select(".chapterlist li a, #chapterlist li a, .clstyle li a"):
        href = a.get("href", "")
        ch_title = a.get_text(strip=True)
        if href:
            chapters.append({"title": ch_title, "url": href})

    # Fallback
    if not chapters:
        for a in soup.select("a[href*='hua/']"):
            href = a.get("href", "")
            ch_title = a.get_text(strip=True)
            if href and ch_title:
                chapters.append({"title": ch_title, "url": href})

    # Remove duplicates, preserve order
    seen = set()
    unique_ch = []
    for c in chapters:
        if c["url"] not in seen:
            seen.add(c["url"])
            unique_ch.append(c)

    # Sort chapters ascending
    def ch_num(c):
        m = re.search(r"di(\d+)hua", c["url"])
        return int(m.group(1)) if m else 0

    unique_ch.sort(key=ch_num)

    return {"title": title, "cover": cover, "desc": desc, "chapters": unique_ch}


def get_chapter_images(chapter_url):
    """Get all image URLs from a chapter page"""
    r = get_page(chapter_url)
    soup = BeautifulSoup(r.text, "html.parser")

    images = []

    # Common reader containers
    for sel in ["#readerarea img", ".rdminimal img", ".chapter-inner img", ".reading-content img", "#chapterpage img"]:
        imgs = soup.select(sel)
        if imgs:
            for img in imgs:
                src = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or ""
                src = src.strip()
                if src and src.startswith("http") and not src.endswith(".gif"):
                    images.append(src)
            if images:
                return images

    # Fallback: all imgs with pstatic or cdn urls
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or ""
        src = src.strip()
        if src and ("pstatic" in src or "cdn" in src or "upload" in src.lower()):
            if not src.endswith(".gif"):
                images.append(src)

    # Fallback: all images that look like manga pages
    if not images:
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or ""
            src = src.strip()
            if src and src.startswith("http") and any(ext in src for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                images.append(src)

    return list(dict.fromkeys(images))  # deduplicate preserving order


def download_image(url, dest_path, referer=None):
    """Download a single image to dest_path"""
    headers = dict(HEADERS)
    if referer:
        headers["Referer"] = referer
    r = SESSION.get(url, headers=headers, timeout=20, stream=True)
    r.raise_for_status()
    with open(dest_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    return dest_path
