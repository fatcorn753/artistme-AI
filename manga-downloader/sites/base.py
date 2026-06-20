"""Base class for manga site adapters."""

import time
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en;q=0.5",
}


class MangaSite:
    def __init__(self, name, base_url, publisher="", description="", downloadable=True):
        self.name = name
        self.base_url = base_url
        self.publisher = publisher
        self.description = description
        self.downloadable = downloadable
        self.session = requests.Session()
        self.session.headers.update({**HEADERS, "Referer": base_url})

    def _get(self, url, retries=3, delay=1.5):
        for attempt in range(retries):
            try:
                r = self.session.get(url, timeout=15)
                r.raise_for_status()
                return r
            except Exception as e:
                if attempt < retries - 1:
                    time.sleep(delay)
                else:
                    raise e

    def search(self, query) -> list[dict]:
        """Returns [{title, url, cover}]"""
        raise NotImplementedError

    def get_manga_info(self, manga_url) -> dict:
        """Returns {title, cover, desc, chapters: [{title, url}]}"""
        raise NotImplementedError

    def get_chapter_images(self, chapter_url) -> list[str]:
        """Returns list of image URLs for a chapter"""
        raise NotImplementedError

    def download_image(self, url, dest_path):
        r = self.session.get(url, timeout=20, stream=True)
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
