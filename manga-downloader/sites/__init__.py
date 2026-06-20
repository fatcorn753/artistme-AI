from .gigaviewer import GigaViewerSite
from .kmansin import KmansinSite
from .comicwalker import ComicWalkerSite
from .mangaplus import MangaPlusSite

# Registry — order determines dropdown order
# downloadable=True  → chapter images can be fetched
# downloadable=False → listing only (viewer auth required)

SITE_REGISTRY = [
    GigaViewerSite(
        name="サンデーうぇぶり",
        base_url="https://www.sunday-webry.com",
        publisher="小学館",
        description="名探偵コナン、葬送のフリーレン、トニカクカワイイ など",
        downloadable=True,
    ),
    GigaViewerSite(
        name="となりのヤングジャンプ",
        base_url="https://tonarinoyj.jp",
        publisher="集英社",
        description="ワンパンマン、彼女、お借りします など",
        downloadable=True,
    ),
    GigaViewerSite(
        name="ヤンマガWeb",
        base_url="https://yanmaga.jp",
        publisher="講談社",
        description="進撃の巨人 など",
        downloadable=True,
    ),
    GigaViewerSite(
        name="チャンピオンクロス",
        base_url="https://www.championcross.jp",
        publisher="秋田書店",
        description="刃牙、ドカベン など",
        downloadable=True,
    ),
    GigaViewerSite(
        name="モーニング公式サイト",
        base_url="https://morning.mobi",
        publisher="講談社",
        description="島耕作シリーズ など",
        downloadable=True,
    ),
    ComicWalkerSite(
        name="ComicWalker (カドコミ)",
        base_url="https://comic-walker.com",
        publisher="KADOKAWA",
        description="ひぐらし、ソードアート・オンライン など（一覧のみ）",
        downloadable=False,
    ),
    MangaPlusSite(
        name="MANGA Plus (集英社)",
        base_url="https://mangaplus.shueisha.co.jp",
        publisher="集英社",
        description="ONE PIECE、呪術廻戦、チェンソーマン など（一覧のみ）",
        downloadable=False,
    ),
    KmansinSite(
        name="Kmansin09.top",
        base_url="https://kmansin09.top",
        publisher="まとめサイト",
        description="多数の漫画を無料公開",
        downloadable=True,
    ),
]


def get_site(name):
    for s in SITE_REGISTRY:
        if s.name == name:
            return s
    return None
