"""
Adapter for kmansin09.top — WordPress-based free manga aggregator.
"""

import re
import time

from bs4 import BeautifulSoup
from .base import MangaSite


class KmansinSite(MangaSite):

    def search(self, query, max_pages=10):
        query_lower = query.lower()
        results = []
        seen = set()

        for page in range(1, max_pages + 1):
            url = f"{self.base_url}/manga/page/{page}/" if page > 1 else f"{self.base_url}/manga/"
            try:
                r = self._get(url)
            except Exception:
                break
            soup = BeautifulSoup(r.text, "html.parser")
            items = self._parse_manga_list(soup)
            if not items:
                break

            for item in items:
                if item["url"] in seen:
                    continue
                if query_lower and query_lower not in item["title"].lower() and query_lower not in item["url"].lower():
                    continue
                seen.add(item["url"])
                results.append(item)

            time.sleep(0.4)

        return results

    def list_all(self, page=1):
        url = f"{self.base_url}/manga/page/{page}/" if page > 1 else f"{self.base_url}/manga/"
        r = self._get(url)
        soup = BeautifulSoup(r.text, "html.parser")
        return self._parse_manga_list(soup)

    def get_manga_info(self, manga_url):
        r = self._get(manga_url)
        soup = BeautifulSoup(r.text, "html.parser")

        title = ""
        for sel in ["h1.entry-title", "h1", ".infox h1"]:
            el = soup.select_one(sel)
            if el:
                title = el.get_text(strip=True)
                break

        cover = ""
        for sel in [".thumbook img", ".thumb img"]:
            el = soup.select_one(sel)
            if el:
                cover = el.get("src") or el.get("data-src") or ""
                break

        chapters = []
        for a in soup.select(".chapterlist li a, #chapterlist li a, .clstyle li a"):
            href = a.get("href", "")
            ch_title = a.get_text(strip=True)
            if href and ch_title:
                chapters.append({"title": ch_title, "url": href})

        if not chapters:
            for a in soup.select("a[href*='hua/']"):
                href = a.get("href", "")
                ch_title = a.get_text(strip=True)
                if href and ch_title:
                    chapters.append({"title": ch_title, "url": href})

        seen = set()
        unique = []
        for c in chapters:
            if c["url"] not in seen:
                seen.add(c["url"])
                unique.append(c)

        def ch_num(c):
            m = re.search(r"di(\d+)hua", c["url"])
            return int(m.group(1)) if m else 0

        unique.sort(key=ch_num)
        return {"title": title, "cover": cover, "desc": "", "chapters": unique}

    def get_chapter_images(self, chapter_url):
        r = self._get(chapter_url)
        soup = BeautifulSoup(r.text, "html.parser")
        images = []

        for sel in ["#readerarea img", ".rdminimal img", ".chapter-inner img", ".reading-content img"]:
            imgs = soup.select(sel)
            if imgs:
                for img in imgs:
                    src = (img.get("src") or img.get("data-src") or img.get("data-lazy-src") or "").strip()
                    if src and src.startswith("http") and not src.endswith(".gif"):
                        images.append(src)
                if images:
                    return images

        for img in soup.find_all("img"):
            src = (img.get("src") or img.get("data-src") or "").strip()
            if src and src.startswith("http") and any(ext in src for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                images.append(src)

        return list(dict.fromkeys(images))

    # ── Internal ───────────────────────────────────────────────────────────────

    def _parse_manga_list(self, soup):
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
