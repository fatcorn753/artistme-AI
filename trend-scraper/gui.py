"""
Trend Scraper GUI
"""

import json
import threading
import datetime
import time
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path
import webbrowser

import requests
from bs4 import BeautifulSoup
import schedule

import scraper

DATA_DIR = Path(__file__).parent / "data"


# ──────────────────────────────────────────────
# ヘルパー
# ──────────────────────────────────────────────

def load_all_results() -> dict:
    tree: dict = {}
    for p in sorted(DATA_DIR.glob("*.json")):
        try:
            dt = datetime.datetime.strptime(p.stem, "%Y-%m-%d_%H-%M-%S")
        except ValueError:
            continue
        month_key = dt.strftime("%Y年%m月")
        day_key = dt.strftime("%d日 (%a)")
        tree.setdefault(month_key, {}).setdefault(day_key, []).append((dt, p))
    return tree


def fetch_article_text(url: str) -> str:
    """URLから記事本文を取得して返す。失敗時は空文字列。"""
    if not url or not url.startswith("http"):
        return ""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; TrendBot/1.0)"}
    try:
        resp = requests.get(url, headers=headers, timeout=12)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        # <script>/<style> 除去
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        # 本文候補セレクター（優先順）
        for sel in ["article", "[class*='article']", "[class*='body']",
                    "[class*='content']", "main", ".paragraph", "p"]:
            blocks = soup.select(sel)
            text = "\n".join(b.get_text(" ", strip=True) for b in blocks if len(b.get_text(strip=True)) > 60)
            if len(text) > 200:
                return text
        return soup.get_text(" ", strip=True)[:3000]
    except Exception as e:
        return f"（取得エラー: {e}）"


# ──────────────────────────────────────────────
# 記事ビューアーダイアログ
# ──────────────────────────────────────────────

class ArticleViewer(tk.Toplevel):
    def __init__(self, parent, title: str, url: str):
        super().__init__(parent)
        self.title(f"記事: {title[:60]}")
        self.geometry("800x600")
        self.configure(bg="#1e1e2e")

        # ツールバー
        bar = tk.Frame(self, bg="#313244", pady=6)
        bar.pack(fill="x")
        tk.Label(bar, text=title, bg="#313244", fg="#cdd6f4",
                 font=("Helvetica", 11, "bold"), wraplength=600,
                 justify="left").pack(side="left", padx=10)
        tk.Button(bar, text="🌐 ブラウザで開く",
                  bg="#89b4fa", fg="#1e1e2e", relief="flat",
                  padx=8, pady=3,
                  command=lambda: webbrowser.open(url)).pack(side="right", padx=10)

        # URL表示
        url_frame = tk.Frame(self, bg="#1e1e2e")
        url_frame.pack(fill="x", padx=10, pady=2)
        tk.Label(url_frame, text="URL:", bg="#1e1e2e", fg="#6c7086",
                 font=("Helvetica", 9)).pack(side="left")
        url_lbl = tk.Label(url_frame, text=url, bg="#1e1e2e", fg="#74c7ec",
                           font=("Helvetica", 9), cursor="hand2")
        url_lbl.pack(side="left", padx=4)
        url_lbl.bind("<Button-1>", lambda e: webbrowser.open(url))

        # ステータス
        self._status = tk.StringVar(value="記事を取得中...")
        tk.Label(self, textvariable=self._status, bg="#1e1e2e", fg="#a6e3a1",
                 font=("Helvetica", 9)).pack(anchor="w", padx=10)

        # テキストエリア
        txt_frame = tk.Frame(self, bg="#1e1e2e")
        txt_frame.pack(fill="both", expand=True, padx=10, pady=6)
        self._text = tk.Text(txt_frame, bg="#181825", fg="#cdd6f4",
                             font=("Helvetica", 11), wrap="word",
                             relief="flat", padx=12, pady=8,
                             insertbackground="#cdd6f4", state="disabled")
        vsb = ttk.Scrollbar(txt_frame, orient="vertical", command=self._text.yview)
        self._text.configure(yscrollcommand=vsb.set)
        vsb.pack(side="right", fill="y")
        self._text.pack(fill="both", expand=True)

        self._url = url
        threading.Thread(target=self._load, daemon=True).start()

    def _load(self):
        text = fetch_article_text(self._url)
        self.after(0, lambda: self._display(text))

    def _display(self, text: str):
        if not text:
            text = "記事本文を取得できませんでした。\nブラウザで開くボタンをお試しください。"
            self._status.set("取得失敗")
        else:
            self._status.set(f"取得完了（{len(text)}文字）")
        self._text.config(state="normal")
        self._text.delete("1.0", "end")
        self._text.insert("1.0", text)
        self._text.config(state="disabled")


# ──────────────────────────────────────────────
# メインウィンドウ
# ──────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("トレンドスクレイパー")
        self.geometry("1100x700")
        self.minsize(800, 500)
        self.configure(bg="#1e1e2e")

        self._schedule_running = False
        self._file_map: dict[str, Path] = {}
        # iid -> (month_key, day_key) for folder nodes
        self._folder_map: dict[str, tuple] = {}

        self._build_ui()
        self._refresh_tree()

    # ── UI構築 ────────────────────────────────

    def _build_ui(self):
        # ── 上部ツールバー ──
        toolbar = tk.Frame(self, bg="#313244", pady=6)
        toolbar.pack(fill="x", side="top")

        tk.Label(toolbar, text="📡 トレンドスクレイパー",
                 bg="#313244", fg="#cdd6f4",
                 font=("Helvetica", 14, "bold")).pack(side="left", padx=12)

        self._run_btn = tk.Button(
            toolbar, text="▶ 今すぐ取得",
            bg="#89b4fa", fg="#1e1e2e",
            activebackground="#74c7ec",
            font=("Helvetica", 11, "bold"),
            relief="flat", padx=14, pady=4,
            command=self._run_now,
        )
        self._run_btn.pack(side="right", padx=12)

        self._status_var = tk.StringVar(value="待機中")
        tk.Label(toolbar, textvariable=self._status_var,
                 bg="#313244", fg="#a6e3a1",
                 font=("Helvetica", 10)).pack(side="right", padx=8)

        # ── メイン領域 ──
        paned = tk.PanedWindow(self, orient="horizontal",
                               bg="#1e1e2e", sashwidth=6, sashrelief="flat")
        paned.pack(fill="both", expand=True, padx=8, pady=6)

        # 左ペイン
        left = tk.Frame(paned, bg="#1e1e2e", width=230)
        paned.add(left, minsize=180)

        header = tk.Frame(left, bg="#1e1e2e")
        header.pack(fill="x", padx=8, pady=(4, 2))
        tk.Label(header, text="履歴", bg="#1e1e2e", fg="#cdd6f4",
                 font=("Helvetica", 11, "bold")).pack(side="left")
        self._del_btn = tk.Button(
            header, text="🗑 削除",
            bg="#f38ba8", fg="#1e1e2e",
            activebackground="#eba0ac",
            font=("Helvetica", 9, "bold"),
            relief="flat", padx=6, pady=2,
            command=self._delete_selected,
            state="disabled",
        )
        self._del_btn.pack(side="right")

        tree_frame = tk.Frame(left, bg="#1e1e2e")
        tree_frame.pack(fill="both", expand=True, padx=4)

        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("Treeview",
                         background="#181825", foreground="#cdd6f4",
                         fieldbackground="#181825", rowheight=24,
                         font=("Helvetica", 10))
        style.configure("Treeview.Heading",
                         background="#313244", foreground="#cdd6f4",
                         font=("Helvetica", 10, "bold"))
        style.map("Treeview", background=[("selected", "#585b70")])

        self._tree = ttk.Treeview(tree_frame, show="tree", selectmode="browse")
        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=self._tree.yview)
        self._tree.configure(yscrollcommand=vsb.set)
        vsb.pack(side="right", fill="y")
        self._tree.pack(fill="both", expand=True)
        self._tree.bind("<<TreeviewSelect>>", self._on_tree_select)
        self._tree.bind("<Button-2>", self._on_tree_rightclick)   # macOS右クリック
        self._tree.bind("<Button-3>", self._on_tree_rightclick)   # Windows/Linux右クリック

        # 右クリックメニュー
        self._ctx_menu = tk.Menu(self, tearoff=0, bg="#313244", fg="#cdd6f4",
                                 activebackground="#585b70", activeforeground="#cdd6f4")
        self._ctx_menu.add_command(label="🗑  この記録を削除", command=self._delete_selected)
        self._ctx_menu.add_command(label="🗑  この日のデータをすべて削除", command=self._delete_day)
        self._ctx_menu.add_command(label="🗑  この月のデータをすべて削除", command=self._delete_month)

        # 右ペイン
        right = tk.Frame(paned, bg="#1e1e2e")
        paned.add(right, minsize=400)

        self._tab_ctrl = ttk.Notebook(right)
        style.configure("TNotebook", background="#1e1e2e", borderwidth=0)
        style.configure("TNotebook.Tab",
                         background="#313244", foreground="#cdd6f4",
                         padding=[12, 5], font=("Helvetica", 10))
        style.map("TNotebook.Tab",
                  background=[("selected", "#89b4fa")],
                  foreground=[("selected", "#1e1e2e")])

        self._tables: dict[str, ttk.Treeview] = {}

        tab_specs = [
            ("Google Trends", ["順位", "キーワード", "検索数"]),
            ("Yahoo! News",   ["順位", "タイトル", "URL"]),
            ("NHK News",      ["順位", "タイトル", "公開日時", "URL"]),
        ]
        for tab_name, columns in tab_specs:
            frame = ttk.Frame(self._tab_ctrl)
            self._tab_ctrl.add(frame, text=f"  {tab_name}  ")
            hint = tk.Label(frame,
                            text="💡 行をダブルクリックでアプリ内に記事を表示 / URLをクリックでブラウザへ",
                            bg="#1e1e2e", fg="#6c7086", font=("Helvetica", 9))
            hint.pack(anchor="w", padx=6, pady=(4, 0))
            tbl = self._make_table(frame, columns, tab_name)
            self._tables[tab_name] = tbl

        self._tab_ctrl.pack(fill="both", expand=True, padx=4, pady=4)

        self._detail_label = tk.Label(right, text="← 左の履歴から日時を選択してください",
                                      bg="#1e1e2e", fg="#6c7086",
                                      font=("Helvetica", 10))
        self._detail_label.pack(side="bottom", pady=4)

        # ── スケジューラー ──
        sched_frame = tk.LabelFrame(self, text=" スケジューラー設定 ",
                                    bg="#1e1e2e", fg="#cdd6f4",
                                    font=("Helvetica", 10, "bold"),
                                    relief="groove", bd=1)
        sched_frame.pack(fill="x", padx=8, pady=(0, 8))

        inner = tk.Frame(sched_frame, bg="#1e1e2e")
        inner.pack(padx=10, pady=6)

        self._sched_mode = tk.StringVar(value="interval")
        for text, val in [("定期実行（分おき）", "interval"), ("毎日指定時刻", "daily")]:
            tk.Radiobutton(inner, text=text, variable=self._sched_mode, value=val,
                           bg="#1e1e2e", fg="#cdd6f4", selectcolor="#313244",
                           activebackground="#1e1e2e", activeforeground="#cdd6f4",
                           command=self._on_mode_change).pack(side="left", padx=6)

        self._interval_frame = tk.Frame(inner, bg="#1e1e2e")
        self._interval_frame.pack(side="left", padx=8)
        tk.Label(self._interval_frame, text="間隔:", bg="#1e1e2e", fg="#cdd6f4").pack(side="left")
        self._interval_var = tk.StringVar(value="60")
        tk.Entry(self._interval_frame, textvariable=self._interval_var,
                 width=5, bg="#313244", fg="#cdd6f4",
                 insertbackground="#cdd6f4", relief="flat").pack(side="left", padx=2)
        tk.Label(self._interval_frame, text="分", bg="#1e1e2e", fg="#cdd6f4").pack(side="left")

        self._daily_frame = tk.Frame(inner, bg="#1e1e2e")
        tk.Label(self._daily_frame, text="時刻:", bg="#1e1e2e", fg="#cdd6f4").pack(side="left")
        self._hour_var = tk.StringVar(value="08")
        self._min_var = tk.StringVar(value="00")
        tk.Spinbox(self._daily_frame, textvariable=self._hour_var,
                   from_=0, to=23, width=3, format="%02.0f",
                   bg="#313244", fg="#cdd6f4", buttonbackground="#44475a",
                   relief="flat").pack(side="left", padx=2)
        tk.Label(self._daily_frame, text=":", bg="#1e1e2e", fg="#cdd6f4").pack(side="left")
        tk.Spinbox(self._daily_frame, textvariable=self._min_var,
                   from_=0, to=59, width=3, format="%02.0f",
                   bg="#313244", fg="#cdd6f4", buttonbackground="#44475a",
                   relief="flat").pack(side="left", padx=2)

        self._sched_btn = tk.Button(
            inner, text="スケジュール開始",
            bg="#a6e3a1", fg="#1e1e2e",
            activebackground="#94e2d5",
            font=("Helvetica", 10, "bold"),
            relief="flat", padx=10, pady=3,
            command=self._toggle_schedule,
        )
        self._sched_btn.pack(side="left", padx=16)

        self._next_run_var = tk.StringVar(value="")
        tk.Label(inner, textvariable=self._next_run_var,
                 bg="#1e1e2e", fg="#f9e2af",
                 font=("Helvetica", 9)).pack(side="left", padx=4)

    def _make_table(self, parent, columns: list[str], tab_name: str) -> ttk.Treeview:
        frame = tk.Frame(parent, bg="#1e1e2e")
        frame.pack(fill="both", expand=True, padx=4, pady=4)

        tbl = ttk.Treeview(frame, columns=columns, show="headings")
        vsb = ttk.Scrollbar(frame, orient="vertical", command=tbl.yview)
        hsb = ttk.Scrollbar(frame, orient="horizontal", command=tbl.xview)
        tbl.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        col_widths = {"順位": 50, "キーワード": 200, "検索数": 90,
                      "タイトル": 360, "URL": 280, "公開日時": 160}
        for col in columns:
            tbl.heading(col, text=col)
            tbl.column(col, width=col_widths.get(col, 120), anchor="w")

        vsb.pack(side="right", fill="y")
        hsb.pack(side="bottom", fill="x")
        tbl.pack(fill="both", expand=True)

        # ダブルクリックで記事ビューアー
        tbl.bind("<Double-1>", lambda e, t=tab_name: self._on_row_double_click(e, t))
        return tbl

    # ── ツリー操作 ────────────────────────────

    def _refresh_tree(self):
        self._tree.delete(*self._tree.get_children())
        self._file_map = {}
        self._folder_map = {}

        data = load_all_results()
        for month in sorted(data.keys(), reverse=True):
            m_node = self._tree.insert("", "end", text=f"📅 {month}", open=True)
            self._folder_map[m_node] = (month, None)
            days = data[month]
            for day in sorted(days.keys(), reverse=True):
                d_node = self._tree.insert(m_node, "end", text=f"  {day}", open=True)
                self._folder_map[d_node] = (month, day)
                for dt, path in sorted(days[day], reverse=True):
                    iid = self._tree.insert(d_node, "end",
                                            text=f"    {dt.strftime('%H:%M:%S')}")
                    self._file_map[iid] = path

    def _on_tree_select(self, _event):
        sel = self._tree.selection()
        if not sel:
            return
        iid = sel[0]
        # ファイルノードのみ削除ボタン有効
        self._del_btn.config(state="normal" if iid in self._file_map or iid in self._folder_map else "disabled")

        path = self._file_map.get(iid)
        if not path:
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            messagebox.showerror("読込エラー", str(e))
            return

        self._detail_label.config(text=f"取得日時: {data.get('fetched_at', '')}")
        self._load_google(data.get("google_trends", []))
        self._load_yahoo(data.get("yahoo_news", []))
        self._load_nhk(data.get("nhk_news", []))

    def _on_tree_rightclick(self, event):
        iid = self._tree.identify_row(event.y)
        if iid:
            self._tree.selection_set(iid)
            self._ctx_menu.tk_popup(event.x_root, event.y_root)

    # ── 削除 ─────────────────────────────────

    def _delete_selected(self):
        sel = self._tree.selection()
        if not sel:
            return
        iid = sel[0]
        if iid in self._file_map:
            path = self._file_map[iid]
            if messagebox.askyesno("削除確認",
                                   f"この記録を削除しますか？\n{path.name}"):
                path.unlink(missing_ok=True)
                self._refresh_tree()
                self._clear_all_tables()
        elif iid in self._folder_map:
            month, day = self._folder_map[iid]
            label = f"{month} {day}" if day else month
            if messagebox.askyesno("削除確認", f"「{label}」のデータをすべて削除しますか？"):
                self._delete_folder_node(iid)
                self._refresh_tree()
                self._clear_all_tables()

    def _delete_day(self):
        sel = self._tree.selection()
        if not sel:
            return
        iid = sel[0]
        # 親を辿って日ノードを特定
        target = iid
        if iid in self._file_map:
            target = self._tree.parent(iid)
        if target in self._folder_map:
            month, day = self._folder_map[target]
            if day is None:
                # 月ノードが選択されていた場合は最初の日を対象にしない
                return
            if messagebox.askyesno("削除確認", f"「{month} {day}」のデータをすべて削除しますか？"):
                self._delete_folder_node(target)
                self._refresh_tree()
                self._clear_all_tables()

    def _delete_month(self):
        sel = self._tree.selection()
        if not sel:
            return
        iid = sel[0]
        # 月ノードを探す
        node = iid
        while node and node not in self._folder_map:
            node = self._tree.parent(node)
        if node in self._folder_map:
            month_node = node
            while self._folder_map.get(month_node, (None, None))[1] is not None:
                month_node = self._tree.parent(month_node)
            if month_node in self._folder_map:
                month, _ = self._folder_map[month_node]
                if messagebox.askyesno("削除確認", f"「{month}」のデータをすべて削除しますか？"):
                    self._delete_folder_node(month_node)
                    self._refresh_tree()
                    self._clear_all_tables()

    def _delete_folder_node(self, node_iid: str):
        """ツリーノード以下のすべてのファイルを削除"""
        # 直接の子がファイルの場合
        for child in self._tree.get_children(node_iid):
            if child in self._file_map:
                self._file_map[child].unlink(missing_ok=True)
            else:
                self._delete_folder_node(child)

    # ── テーブル操作 ──────────────────────────

    def _clear_table(self, name: str):
        self._tables[name].delete(*self._tables[name].get_children())

    def _clear_all_tables(self):
        for name in self._tables:
            self._clear_table(name)
        self._detail_label.config(text="← 左の履歴から日時を選択してください")

    def _load_google(self, items: list[dict]):
        self._clear_table("Google Trends")
        tbl = self._tables["Google Trends"]
        for it in items:
            tbl.insert("", "end", values=(it.get("rank"), it.get("keyword"), it.get("approx_traffic")))

    def _load_yahoo(self, items: list[dict]):
        self._clear_table("Yahoo! News")
        tbl = self._tables["Yahoo! News"]
        for it in items:
            tbl.insert("", "end", values=(it.get("rank"), it.get("title"), it.get("url")))

    def _load_nhk(self, items: list[dict]):
        self._clear_table("NHK News")
        tbl = self._tables["NHK News"]
        for it in items:
            tbl.insert("", "end", values=(
                it.get("rank"), it.get("title"),
                it.get("published_at"), it.get("url"),
            ))

    # ── 記事ビューアー ────────────────────────

    def _on_row_double_click(self, event, tab_name: str):
        tbl = self._tables[tab_name]
        sel = tbl.selection()
        if not sel:
            return
        values = tbl.item(sel[0], "values")
        if not values:
            return

        if tab_name == "Google Trends":
            keyword = values[1] if len(values) > 1 else ""
            url = f"https://www.google.com/search?q={requests.utils.quote(keyword)}"
            title = keyword
        else:
            # Yahoo / NHK: タイトルはindex 1, URLは最後
            title = values[1] if len(values) > 1 else ""
            url = values[-1] if values else ""

        if not url:
            messagebox.showinfo("URL なし", "このアイテムにはURLがありません。")
            return

        ArticleViewer(self, title, url)

    # ── スクレイピング実行 ─────────────────────

    def _run_now(self):
        self._run_btn.config(state="disabled")
        self._status_var.set("取得中...")
        threading.Thread(target=self._do_scrape, daemon=True).start()

    def _do_scrape(self):
        try:
            result, _ = scraper.run(DATA_DIR)
            errors = result.get("errors", [])
            counts = (
                f"完了  Google: {len(result['google_trends'])}件  "
                f"Yahoo: {len(result['yahoo_news'])}件  "
                f"NHK: {len(result['nhk_news'])}件"
            )
            msg = counts + (f"  ⚠ {'; '.join(errors)}" if errors else "")
            self.after(0, lambda: self._on_scrape_done(msg, result))
        except Exception as e:
            self.after(0, lambda: self._on_scrape_done(f"エラー: {e}", None))

    def _on_scrape_done(self, msg: str, result):
        self._status_var.set(msg)
        self._run_btn.config(state="normal")
        self._refresh_tree()
        if result:
            self._load_google(result.get("google_trends", []))
            self._load_yahoo(result.get("yahoo_news", []))
            self._load_nhk(result.get("nhk_news", []))
            children = self._tree.get_children()
            if children:
                days = self._tree.get_children(children[0])
                if days:
                    times = self._tree.get_children(days[0])
                    if times:
                        self._tree.selection_set(times[0])

    # ── スケジューラー ────────────────────────

    def _on_mode_change(self):
        if self._sched_mode.get() == "interval":
            self._interval_frame.pack(side="left", padx=8)
            self._daily_frame.pack_forget()
        else:
            self._interval_frame.pack_forget()
            self._daily_frame.pack(side="left", padx=8)

    def _toggle_schedule(self):
        if self._schedule_running:
            self._stop_schedule()
        else:
            self._start_schedule()

    def _start_schedule(self):
        schedule.clear()
        mode = self._sched_mode.get()
        try:
            if mode == "interval":
                minutes = int(self._interval_var.get())
                if minutes < 1:
                    raise ValueError
                schedule.every(minutes).minutes.do(self._run_now)
                label = f"次回: {minutes}分後"
            else:
                hh = self._hour_var.get().zfill(2)
                mm = self._min_var.get().zfill(2)
                schedule.every().day.at(f"{hh}:{mm}").do(self._run_now)
                label = f"次回: 毎日 {hh}:{mm}"
        except ValueError:
            messagebox.showerror("入力エラー", "正しい値を入力してください")
            return

        self._schedule_running = True
        self._sched_btn.config(text="スケジュール停止", bg="#f38ba8")
        self._next_run_var.set(label)
        threading.Thread(target=self._schedule_loop, daemon=True).start()

    def _stop_schedule(self):
        self._schedule_running = False
        schedule.clear()
        self._sched_btn.config(text="スケジュール開始", bg="#a6e3a1")
        self._next_run_var.set("")

    def _schedule_loop(self):
        while self._schedule_running:
            schedule.run_pending()
            time.sleep(10)


if __name__ == "__main__":
    app = App()
    app.mainloop()
