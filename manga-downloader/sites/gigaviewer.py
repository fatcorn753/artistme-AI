"""
GigaViewer adapter — covers all sites running the GigaViewer manga platform:
  - www.sunday-webry.com  (Shogakukan)
  - tonarinoyj.jp         (Shueisha)
  - yanmaga.jp            (Kodansha)
  - www.championcross.jp  (Akita Shoten)
  - morning.mobi          (Kodansha)
  - etc.

Episode pages embed page data in:
  <script id='episode-json' type='text/json' data-value='...'>

Series listing uses /series path.
"""

import html
import json
import re
import time

from bs4 import BeautifulSoup
from .base import MangaSite


class GigaViewerSite(MangaSite):

    # ── Public API ─────────────────────────────────────────────────────────────

    def search(self, query):
        """Search manga by scanning /series listing pages."""
        query_lower = query.lower()
        results = []
        seen = set()

        for page in range(1, 8):
            url = f"{self.base_url}/series?page={page}" if page > 1 else f"{self.base_url}/series"
            try:
                r = self._get(url)
            except Exception:
                break

            soup = BeautifulSoup(r.text, "html.parser")
            items = self._parse_series_list(soup)
            if not items:
                break

            for item in items:
                if item["url"] in seen:
                    continue
                if query_lower and query_lower not in item["title"].lower():
                    continue
                seen.add(item["url"])
                results.append(item)

            time.sleep(0.4)

        return results

    def list_all(self, page=1):
        """List all manga on a given page."""
        url = f"{self.base_url}/series?page={page}" if page > 1 else f"{self.base_url}/series"
        r = self._get(url)
        soup = BeautifulSoup(r.text, "html.parser")
        return self._parse_series_list(soup)

    def get_manga_info(self, manga_url):
        """
        Given a series URL or a first-episode URL, return manga info + chapter list.
        GigaViewer series pages don't always list all episodes, so we walk
        nextReadableProductUri chains from the first episode.
        """
        # Normalize: if this is an episode URL, get series info from it
        r = self._get(manga_url)
        soup = BeautifulSoup(r.text, "html.parser")

        # Detect if this is a series listing page or an episode page
        ep_data = self._extract_episode_json(r.text)
        if ep_data:
            # It's an episode page — get series info from embedded JSON
            rp = ep_data.get("readableProduct", {})
            series = rp.get("series", {})
            title = series.get("title", "")
            cover = series.get("thumbnailUri", "")

            # Find the first episode from the series page
            series_id = series.get("id", "")
            first_ep_url = self._find_first_episode(series_id, manga_url)
            chapters = self._collect_all_episodes(first_ep_url or manga_url)
        else:
            # It's a series listing — find first episode link
            title = self._extract_title(soup)
            cover = self._extract_cover(soup)
            first_link = self._find_first_episode_from_series_page(soup)
            chapters = self._collect_all_episodes(first_link) if first_link else []

        return {"title": title, "cover": cover, "desc": "", "chapters": chapters}

    def get_chapter_images(self, chapter_url):
        """Parse episode-json from the chapter page and return image URLs."""
        r = self._get(chapter_url)
        ep_data = self._extract_episode_json(r.text)
        if not ep_data:
            return []

        pages = ep_data.get("readableProduct", {}).get("pageStructure", {}).get("pages", [])
        urls = []
        for p in pages:
            if p.get("type") == "main":
                src = p.get("src", "")
                if src:
                    urls.append(src)
        return urls

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _extract_episode_json(self, html_text):
        m = re.search(r"<script id='episode-json' type='text/json' data-value='(.*?)'>", html_text, re.DOTALL)
        if not m:
            return None
        try:
            return json.loads(html.unescape(m.group(1)))
        except Exception:
            return None

    def _parse_series_list(self, soup):
        """Extract manga entries from a /series page."""
        results = []
        # Common GigaViewer series list patterns
        for a in soup.select("a[href*='/episode/']"):
            href = a.get("href", "")
            if not href:
                continue
            if not href.startswith("http"):
                href = self.base_url + href

            # Get title from alt, text, or parent heading
            title = ""
            img = a.find("img")
            if img:
                title = img.get("alt", "").strip()
            if not title:
                h = a.find(["h4", "h3", "h2", "h1", "p", "span"])
                if h:
                    title = h.get_text(strip=True)
            if not title:
                title = a.get_text(strip=True)

            cover = ""
            if img:
                cover = img.get("src") or img.get("data-src") or ""

            if title and href:
                results.append({"title": title, "url": href, "cover": cover})

        # Deduplicate by URL
        seen = set()
        unique = []
        for r in results:
            if r["url"] not in seen:
                seen.add(r["url"])
                unique.append(r)
        return unique

    def _find_first_episode(self, series_id, fallback_url):
        """Try to get the first episode URL for a series."""
        if not series_id:
            return fallback_url
        # Try series page
        for path in [f"/series/{series_id}", f"/title/{series_id}"]:
            try:
                r = self._get(self.base_url + path)
                soup = BeautifulSoup(r.text, "html.parser")
                link = self._find_first_episode_from_series_page(soup)
                if link:
                    return link
            except Exception:
                pass
        return fallback_url

    def _find_first_episode_from_series_page(self, soup):
        """Find the 'read from beginning' link on a series page."""
        # Look for "初めから" / "第1話" links
        for text in ["初めから", "第1話", "第１話", "1話", "１話"]:
            a = soup.find("a", string=lambda s: s and text in s)
            if a and a.get("href"):
                href = a["href"]
                return href if href.startswith("http") else self.base_url + href

        # Fallback: first /episode/ link
        a = soup.find("a", href=re.compile(r"/episode/\d+"))
        if a:
            href = a["href"]
            return href if href.startswith("http") else self.base_url + href
        return None

    def _collect_all_episodes(self, first_url, max_episodes=2000):
        """
        Walk the nextReadableProductUri chain to collect all episodes.
        GigaViewer doesn't provide a flat episode list, so we traverse
        episode by episode via the 'next' pointer in each page's JSON.
        """
        chapters = []
        visited = set()
        url = first_url

        while url and len(chapters) < max_episodes:
            if url in visited:
                break
            visited.add(url)

            try:
                r = self._get(url)
                ep_data = self._extract_episode_json(r.text)
            except Exception:
                break

            if not ep_data:
                break

            rp = ep_data.get("readableProduct", {})
            title = rp.get("title", url.split("/")[-1])
            is_public = rp.get("isPublic", False)

            if is_public:
                chapters.append({"title": title, "url": url})

            next_url = rp.get("nextReadableProductUri", "")
            if not next_url or next_url == url:
                break
            url = next_url
            time.sleep(0.3)

        return chapters

    def _extract_title(self, soup):
        for sel in ["h1", ".series-header-title", ".title"]:
            el = soup.select_one(sel)
            if el:
                return el.get_text(strip=True)
        return ""

    def _extract_cover(self, soup):
        img = soup.select_one(".series-header-image, .js-series-header-image")
        if img:
            return img.get("src") or img.get("data-src") or ""
        return ""
