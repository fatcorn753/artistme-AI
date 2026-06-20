"""
ComicWalker (カドコミ) adapter — Kadokawa's official free manga site.
https://comic-walker.com/

Series listing: /api/search/initial  (full catalog JSON, public)
Episode list:   __NEXT_DATA__ on /detail/{code}/episodes
Images:         Viewer session required — NOT downloadable via scraping.
                Only isActive=True episodes are currently free to read.
"""

import html
import json
import re
import time

from bs4 import BeautifulSoup
from .base import MangaSite

BASE = "https://comic-walker.com"
CDN  = "https://cdn.comic-walker.com"

DOWNLOAD_SUPPORTED = False
DOWNLOAD_NOTE = (
    "ComicWalkerの画像はビューワー認証が必要なためダウンロード非対応です。\n"
    "エピソード一覧の閲覧のみ利用可能です。"
)


class ComicWalkerSite(MangaSite):

    # ── Public API ─────────────────────────────────────────────────────────────

    def search(self, query):
        query_lower = query.lower()
        results = []
        seen = set()

        try:
            r = self._get(f"{BASE}/api/search/initial")
            catalog = json.loads(r.text)
        except Exception:
            return []

        for group in catalog:
            for item in group.get("items", []):
                title = item.get("title", "")
                code = item.get("code", "")
                if not code:
                    continue
                if query_lower and query_lower not in title.lower():
                    continue
                if code in seen:
                    continue
                seen.add(code)
                cover = item.get("thumbnail", "")
                url = f"{BASE}/detail/{code}/"
                results.append({"title": title, "url": url, "cover": cover})

        return results

    def list_all(self, page=1):
        """Return all manga from catalog (single API call, page param ignored)."""
        if page > 1:
            return []
        try:
            r = self._get(f"{BASE}/api/search/initial")
            catalog = json.loads(r.text)
        except Exception:
            return []

        results = []
        seen = set()
        for group in catalog:
            for item in group.get("items", []):
                code = item.get("code", "")
                title = item.get("title", "")
                if not code or code in seen:
                    continue
                seen.add(code)
                results.append({
                    "title": title,
                    "url": f"{BASE}/detail/{code}/",
                    "cover": item.get("thumbnail", ""),
                })
        return results

    def get_manga_info(self, manga_url):
        """Get title + episode list from series detail page."""
        # Normalize URL
        code = self._extract_code(manga_url)
        if not code:
            raise ValueError(f"ComicWalker: URLからシリーズコードが取得できません: {manga_url}")

        r = self._get(f"{BASE}/detail/{code}/episodes")
        data = self._extract_next_data(r.text)
        if not data:
            return {"title": code, "cover": "", "desc": "", "chapters": []}

        qs = data.get("dehydratedState", {}).get("queries", [])
        work_data = qs[0]["state"]["data"] if qs else {}
        work = work_data.get("work", {})
        title = work.get("title", code)
        cover = work.get("thumbnail", "")

        # Collect free episodes (isActive = True means currently free)
        first_eps = work_data.get("firstEpisodes", {}).get("result", []) or []
        latest_eps = work_data.get("latestEpisodes", {}).get("result", []) or []

        # Merge unique episodes
        seen_codes = set()
        all_eps = []
        for ep in first_eps + latest_eps:
            ep_code = ep.get("code", "")
            if ep_code and ep_code not in seen_codes:
                seen_codes.add(ep_code)
                all_eps.append(ep)

        # Sort by episode number embedded in code
        def ep_sort_key(ep):
            m = re.search(r"KC_\d+(\d{10})_E", ep.get("code", ""))
            return int(m.group(1)) if m else 0

        all_eps.sort(key=ep_sort_key)

        chapters = []
        for ep in all_eps:
            ep_code = ep.get("code", "")
            ep_title = ep.get("title", ep_code)
            is_free = ep.get("isActive", False)
            label = ep_title if is_free else f"[有料] {ep_title}"
            chapters.append({
                "title": label,
                "url": f"{BASE}/detail/{code}/episodes/{ep_code}",
                "free": is_free,
                "code": ep_code,
            })

        return {"title": title, "cover": cover, "desc": DOWNLOAD_NOTE, "chapters": chapters}

    def get_chapter_images(self, chapter_url):
        """ComicWalkerの画像はビューワー認証が必要なため取得できません。"""
        raise NotImplementedError(DOWNLOAD_NOTE)

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _extract_code(self, url):
        m = re.search(r"/(KC_[^/]+)(?:/|$)", url)
        return m.group(1) if m else None

    def _extract_next_data(self, html_text):
        m = re.search(
            r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
            html_text, re.DOTALL
        )
        if not m:
            return None
        try:
            d = json.loads(m.group(1))
            return d["props"]["pageProps"]
        except Exception:
            return None
