"""
MANGA Plus by SHUEISHA adapter.
https://mangaplus.shueisha.co.jp/

MangaPlus is a pure React SPA. All API calls require a SESSION-TOKEN
(generated per-user session). Without it, the API returns error responses.

What works without auth:
  - Title listing: scrape /manga_list/all (HTML, but it's an SPA so titles
    are loaded via JS — we parse __NEXT_DATA__ or use a known public endpoint)

What requires SESSION-TOKEN:
  - Chapter images (manga_viewer_v3 API)
  - Title detail / chapter list (title_detailV3 API)

Strategy:
  - Use the public /manga_list/all page + hard-coded popular series list
    as fallback, since the SPA doesn't embed data in HTML
  - Provide chapter URLs that open in the browser (for manual viewing)
  - Image download not supported
"""

import json
import re
import time
import uuid

import requests
from .base import MangaSite

BASE = "https://mangaplus.shueisha.co.jp"
API  = "https://jumpg-webapi.tokyo-cdn.com/api"

DOWNLOAD_SUPPORTED = False
DOWNLOAD_NOTE = (
    "MANGA Plusの画像はSESSION-TOKEN認証が必要なためダウンロード非対応です。\n"
    "シリーズ一覧の閲覧のみ利用可能です。"
)


class MangaPlusSite(MangaSite):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # MangaPlus requires a session token — generate a guest one
        self._token = str(uuid.uuid4())
        self.session.headers.update({
            "SESSION-TOKEN": self._token,
            "Referer": BASE,
            "Origin": BASE,
        })

    # ── Public API ─────────────────────────────────────────────────────────────

    def search(self, query):
        query_lower = query.lower()
        all_titles = self._get_all_titles()
        return [t for t in all_titles if query_lower in t["title"].lower()]

    def list_all(self, page=1):
        if page > 1:
            return []
        return self._get_all_titles()

    def get_manga_info(self, manga_url):
        """
        MangaPlus title pages are React SPA — no HTML data.
        We extract the title_id from the URL and try the protobuf API.
        Since full chapter list needs auth, we provide limited info.
        """
        title_id = self._extract_title_id(manga_url)
        if not title_id:
            raise ValueError(f"MANGA Plus: title_id をURLから取得できません: {manga_url}")

        # Try to get chapter list via protobuf API (may fail without proper auth)
        chapters = self._get_chapters_proto(title_id)
        title = f"MANGA Plus タイトル #{title_id}"

        return {
            "title": title,
            "cover": "",
            "desc": DOWNLOAD_NOTE,
            "chapters": chapters,
        }

    def get_chapter_images(self, chapter_url):
        raise NotImplementedError(DOWNLOAD_NOTE)

    # ── Internal ───────────────────────────────────────────────────────────────

    def _get_all_titles(self):
        """
        MangaPlus is a pure SPA; the all-titles endpoint requires protobuf auth.
        We fall back to a curated list of known free titles.
        """
        # Try the protobuf API (returns error without valid session, but try anyway)
        try:
            r = self.session.get(
                f"{API}/title_list/allV2",
                params={"lang": "0"},
                timeout=10
            )
            if r.status_code == 200 and len(r.content) > 100:
                return self._parse_title_list_proto(r.content)
        except Exception:
            pass

        # Fallback: return known popular free series
        return self._known_free_titles()

    def _parse_title_list_proto(self, data):
        """
        Minimal protobuf parser for MangaPlus title list.
        Without a .proto schema we use raw field parsing.
        Field encoding: (field_number << 3) | wire_type
        """
        # If the response is an error (small), skip
        if len(data) < 50:
            return self._known_free_titles()
        try:
            return self._brute_force_title_parse(data)
        except Exception:
            return self._known_free_titles()

    def _brute_force_title_parse(self, data):
        """Extract ASCII title strings from binary protobuf."""
        results = []
        # Look for readable strings (title names are Japanese UTF-8)
        # This is a heuristic approach without a proper schema
        i = 0
        titles_found = []
        while i < len(data) - 4:
            # Check for varint length-prefixed string field
            if data[i] in (0x0a, 0x12, 0x1a, 0x22):
                length = data[i + 1]
                if 2 <= length <= 100 and i + 2 + length <= len(data):
                    segment = data[i + 2: i + 2 + length]
                    try:
                        text = segment.decode("utf-8")
                        if any("　" <= c <= "鿿" for c in text):
                            titles_found.append(text)
                    except Exception:
                        pass
            i += 1

        # titles_found contains mixed content; filter to reasonable titles
        for t in titles_found[:200]:
            if 2 <= len(t) <= 50:
                results.append({
                    "title": t,
                    "url": f"{BASE}/manga_list/all",
                    "cover": "",
                })
        return results if results else self._known_free_titles()

    def _get_chapters_proto(self, title_id):
        """Try to get chapter list via protobuf API."""
        try:
            r = self.session.get(
                f"{API}/title_detailV3",
                params={"title_id": title_id, "clang": ""},
                timeout=10
            )
            if r.status_code == 200 and len(r.content) > 100:
                # Minimal parsing: find chapter IDs and titles
                return self._parse_chapters_proto(r.content, title_id)
        except Exception:
            pass

        return [{
            "title": "（チャプター一覧取得不可 — 認証が必要）",
            "url": f"{BASE}/titles/{title_id}",
        }]

    def _parse_chapters_proto(self, data, title_id):
        """Extract chapter info from binary protobuf."""
        chapters = []
        i = 0
        chapter_ids = []
        while i < len(data) - 8:
            # Chapter IDs tend to be 7-digit integers encoded as varint
            if data[i] in (0x08, 0x10, 0x18):
                # Try to read a varint
                val = 0
                shift = 0
                j = i + 1
                while j < i + 6 and j < len(data):
                    b = data[j]
                    val |= (b & 0x7f) << shift
                    shift += 7
                    j += 1
                    if not (b & 0x80):
                        break
                if 1000000 <= val <= 9999999:
                    chapter_ids.append(val)
            i += 1

        chapter_ids = sorted(set(chapter_ids))
        for cid in chapter_ids[:200]:
            chapters.append({
                "title": f"Chapter {cid}",
                "url": f"{BASE}/viewer/{cid}",
            })

        return chapters if chapters else [{
            "title": "（チャプター一覧取得不可）",
            "url": f"{BASE}/titles/{title_id}",
        }]

    def _extract_title_id(self, url):
        m = re.search(r"/titles?/(\d+)", url)
        return m.group(1) if m else None

    def _known_free_titles(self):
        """Curated list of popular MANGA Plus series."""
        titles = [
            ("ONE PIECE",                 100020),
            ("NARUTO",                    100016),
            ("BLEACH",                    100024),
            ("DRAGON BALL",               100021),
            ("BORUTO",                    100029),
            ("Jujutsu Kaisen",            100179),
            ("Chainsaw Man",              100191),
            ("My Hero Academia",          100022),
            ("Spy x Family",             100193),
            ("Black Clover",             100129),
            ("Hunter x Hunter",          100008),
            ("Tokyo Ghoul",              100022),
            ("SAKAMOTO DAYS",            100335),
            ("DANDADAN",                 100200),
            ("アオのハコ",               100309),
            ("あかね噺",                 100255),
            ("マッシュル",               100254),
            ("逃げ上手の若君",           100253),
            ("夜桜さんちの大作戦",       100224),
            ("最強の鑑定士って誰のこと？", 100301),
        ]
        return [
            {
                "title": name,
                "url": f"{BASE}/titles/{tid}",
                "cover": f"https://mangaplus.shueisha.co.jp/drm/title/{tid}/main.jpg",
            }
            for name, tid in titles
        ]
