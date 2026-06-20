"""
Trend Scraper - Google Trends, Yahoo News Japan, NHK News
"""

import json
import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup


def fetch_google_trends(count: int = 20) -> list[dict]:
    url = "https://trends.google.co.jp/trending/rss?geo=JP"
    headers = {"User-Agent": "Mozilla/5.0 (compatible; TrendBot/1.0)"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "xml")
        items = []
        for i, item in enumerate(soup.find_all("item")[:count], 1):
            title = item.find("title")
            traffic = item.find("ht:approx_traffic")
            items.append({
                "rank": i,
                "keyword": title.get_text(strip=True) if title else "",
                "approx_traffic": traffic.get_text(strip=True) if traffic else "",
            })
        return items
    except Exception as e:
        raise RuntimeError(f"Google Trends: {e}")


def fetch_yahoo_news(count: int = 20) -> list[dict]:
    url = "https://news.yahoo.co.jp/topics/top-picks"
    headers = {"User-Agent": "Mozilla/5.0 (compatible; TrendBot/1.0)"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        items = []
        for i, a in enumerate(soup.select("a[href*='/articles/']")[:count], 1):
            title = a.get_text(strip=True)
            if title:
                items.append({"rank": i, "title": title, "url": a.get("href", "")})
        return items
    except Exception as e:
        raise RuntimeError(f"Yahoo News: {e}")


def fetch_nhk_news(count: int = 20) -> list[dict]:
    url = "https://www.nhk.or.jp/rss/news/cat0.xml"
    headers = {"User-Agent": "Mozilla/5.0 (compatible; TrendBot/1.0)"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "xml")
        items = []
        for i, item in enumerate(soup.find_all("item")[:count], 1):
            title = item.find("title")
            link = item.find("link")
            pub_date = item.find("pubDate")
            items.append({
                "rank": i,
                "title": title.get_text(strip=True) if title else "",
                "url": link.get_text(strip=True) if link else "",
                "published_at": pub_date.get_text(strip=True) if pub_date else "",
            })
        return items
    except Exception as e:
        raise RuntimeError(f"NHK News: {e}")


def run(data_dir: Path = Path("data")) -> dict:
    """スクレイピングを実行し、タイムスタンプ付きJSONに保存して結果dictを返す"""
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    timestamp = now.isoformat()

    errors = []
    google, yahoo, nhk = [], [], []

    try:
        google = fetch_google_trends()
    except RuntimeError as e:
        errors.append(str(e))

    try:
        yahoo = fetch_yahoo_news()
    except RuntimeError as e:
        errors.append(str(e))

    try:
        nhk = fetch_nhk_news()
    except RuntimeError as e:
        errors.append(str(e))

    result = {
        "fetched_at": timestamp,
        "google_trends": google,
        "yahoo_news": yahoo,
        "nhk_news": nhk,
        "errors": errors,
    }

    data_dir.mkdir(parents=True, exist_ok=True)
    filename = now.strftime("%Y-%m-%d_%H-%M-%S") + ".json"
    out = data_dir / filename
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    return result, out
