"""
Download manager — saves chapter pages as raw image files.
Output structure:
  ~/Downloads/MangaDownloader/<manga_title>/<chapter_title>/001.jpg, 002.jpg ...
"""

import os
import re
import time
from pathlib import Path

OUTPUT_ROOT = Path.home() / "Downloads" / "MangaDownloader"


def sanitize(name):
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip()


def chapter_dir(manga_title, chapter_title):
    d = OUTPUT_ROOT / sanitize(manga_title) / sanitize(chapter_title)
    d.mkdir(parents=True, exist_ok=True)
    return d


def download_chapter(site, manga_title, chapter_title, chapter_url,
                     progress_cb=None, stop_flag=None):
    """
    Download all pages of a chapter as raw image files.

    Args:
        site: MangaSite instance (provides get_chapter_images + download_image)
        manga_title: folder name for the manga
        chapter_title: folder name for the chapter
        chapter_url: URL of the chapter/episode page
        progress_cb(current, total, message): optional GUI callback
        stop_flag(): callable returning True to abort

    Returns:
        List of downloaded file paths.
    """
    try:
        images = site.get_chapter_images(chapter_url)
    except Exception as e:
        if progress_cb:
            progress_cb(0, 0, f"画像取得エラー: {e}")
        return []

    if not images:
        if progress_cb:
            progress_cb(0, 0, f"画像が見つかりません: {chapter_url}")
        return []

    out_dir = chapter_dir(manga_title, chapter_title)
    downloaded = []

    for i, img_url in enumerate(images):
        if stop_flag and stop_flag():
            break

        ext = img_url.split("?")[0].rsplit(".", 1)[-1].lower()
        if ext not in ("jpg", "jpeg", "png", "webp"):
            ext = "jpg"
        dest = out_dir / f"{i + 1:03d}.{ext}"

        if dest.exists() and dest.stat().st_size > 0:
            downloaded.append(str(dest))
        else:
            try:
                site.download_image(img_url, str(dest))
                downloaded.append(str(dest))
            except Exception as e:
                if progress_cb:
                    progress_cb(i + 1, len(images), f"DLエラー: {e}")

        if progress_cb:
            progress_cb(i + 1, len(images), f"ページ {i + 1}/{len(images)}")

        time.sleep(0.3)

    return downloaded
