"""
Manga Downloader — macOS GUI
Multi-site support: GigaViewer (official JP publishers) + kmansin09.top
"""

import subprocess
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

from downloader import OUTPUT_ROOT, download_chapter
from sites import SITE_REGISTRY


# ── App state ──────────────────────────────────────────────────────────────────
class AppState:
    def __init__(self):
        self.site = SITE_REGISTRY[0]
        self.current_manga = None
        self.selected_chapters = set()
        self._stop = False

    def stop(self):
        self._stop = True

    def reset_stop(self):
        self._stop = False

    def should_stop(self):
        return self._stop


state = AppState()


# ── Main window ────────────────────────────────────────────────────────────────
class MangaDownloaderApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("漫画ダウンローダー")
        self.geometry("1060x720")
        self.minsize(900, 600)
        self.configure(bg="#1e1e2e")
        self._build_ui()

    def _build_ui(self):
        s = ttk.Style(self)
        s.theme_use("clam")
        s.configure("TFrame", background="#1e1e2e")
        s.configure("TLabel", background="#1e1e2e", foreground="#cdd6f4", font=("Helvetica", 12))
        s.configure("Header.TLabel", background="#1e1e2e", foreground="#89b4fa", font=("Helvetica", 17, "bold"))
        s.configure("Sub.TLabel", background="#1e1e2e", foreground="#a6adc8", font=("Helvetica", 10))
        s.configure("TButton", background="#313244", foreground="#cdd6f4", font=("Helvetica", 11), padding=5)
        s.map("TButton", background=[("active", "#45475a")])
        s.configure("Accent.TButton", background="#89b4fa", foreground="#1e1e2e",
                    font=("Helvetica", 11, "bold"), padding=5)
        s.map("Accent.TButton", background=[("active", "#74c7ec")])
        s.configure("TEntry", fieldbackground="#313244", foreground="#cdd6f4",
                    insertcolor="#cdd6f4", font=("Helvetica", 11))
        s.configure("TCombobox", fieldbackground="#313244", foreground="#cdd6f4",
                    selectbackground="#585b70", selectforeground="#cdd6f4", font=("Helvetica", 11))
        self.option_add("*TCombobox*Listbox.background", "#313244")
        self.option_add("*TCombobox*Listbox.foreground", "#cdd6f4")
        self.option_add("*TCombobox*Listbox.selectBackground", "#585b70")
        self.option_add("*TCombobox*Listbox.font", "Helvetica 11")
        s.configure("Treeview", background="#313244", foreground="#cdd6f4",
                    fieldbackground="#313244", rowheight=26, font=("Helvetica", 11))
        s.configure("Treeview.Heading", background="#45475a", foreground="#89b4fa",
                    font=("Helvetica", 11, "bold"))
        s.map("Treeview", background=[("selected", "#585b70")])
        s.configure("TProgressbar", troughcolor="#313244", background="#89b4fa", thickness=12)
        s.configure("TNotebook", background="#1e1e2e", tabmargins=[2, 2, 2, 0])
        s.configure("TNotebook.Tab", background="#313244", foreground="#cdd6f4",
                    padding=[12, 5], font=("Helvetica", 11))
        s.map("TNotebook.Tab",
              background=[("selected", "#45475a")],
              foreground=[("selected", "#89b4fa")])

        # Header
        hdr = ttk.Frame(self)
        hdr.pack(fill="x", padx=20, pady=(14, 0))
        ttk.Label(hdr, text="📚 漫画ダウンローダー", style="Header.TLabel").pack(side="left")
        self.site_meta_label = ttk.Label(hdr, text="", style="Sub.TLabel")
        self.site_meta_label.pack(side="right", pady=4)

        # Site selector
        sf = ttk.Frame(self)
        sf.pack(fill="x", padx=20, pady=(8, 4))
        ttk.Label(sf, text="サイト:").pack(side="left")
        self.site_var = tk.StringVar(value=SITE_REGISTRY[0].name)
        site_menu = tk.OptionMenu(sf, self.site_var, *[s.name for s in SITE_REGISTRY],
                                  command=lambda _: self._on_site_change())
        site_menu.configure(
            bg="#313244", fg="#cdd6f4", activebackground="#45475a",
            activeforeground="#cdd6f4", highlightthickness=0,
            font=("Helvetica", 11), width=30
        )
        site_menu["menu"].configure(bg="#313244", fg="#cdd6f4",
                                    activebackground="#585b70", activeforeground="#cdd6f4",
                                    font=("Helvetica", 11))
        site_menu.pack(side="left", padx=8)
        self.site_desc_label = ttk.Label(sf, text="", style="Sub.TLabel")
        self.site_desc_label.pack(side="left", padx=8)
        self._update_site_ui()

        # Search bar
        qf = ttk.Frame(self)
        qf.pack(fill="x", padx=20, pady=6)
        ttk.Label(qf, text="検索:").pack(side="left")
        self.search_var = tk.StringVar()
        ent = ttk.Entry(qf, textvariable=self.search_var, width=32)
        ent.pack(side="left", padx=6)
        ent.bind("<Return>", lambda _: self._do_search())
        ttk.Button(qf, text="🔍 検索", command=self._do_search).pack(side="left", padx=3)
        ttk.Button(qf, text="📋 全作品一覧", command=self._load_all).pack(side="left", padx=3)
        ttk.Label(qf, text="  URL直接:").pack(side="left", padx=(14, 0))
        self.url_var = tk.StringVar()
        ttk.Entry(qf, textvariable=self.url_var, width=32).pack(side="left", padx=6)
        ttk.Button(qf, text="→ 開く", command=self._open_url).pack(side="left", padx=3)

        # Notebook
        self.nb = ttk.Notebook(self)
        self.nb.pack(fill="both", expand=True, padx=20, pady=6)

        self.tab_results = ttk.Frame(self.nb)
        self.nb.add(self.tab_results, text="検索結果")
        self._build_results_tab()

        self.tab_chapters = ttk.Frame(self.nb)
        self.nb.add(self.tab_chapters, text="チャプター")
        self._build_chapters_tab()

        # Bottom
        bot = ttk.Frame(self)
        bot.pack(fill="x", padx=20, pady=(0, 10))

        ctrl = ttk.Frame(bot)
        ctrl.pack(fill="x")
        self.dl_btn = ttk.Button(ctrl, text="⬇️  ダウンロード開始",
                                  style="Accent.TButton", command=self._start_download)
        self.dl_btn.pack(side="right", padx=4)
        self.stop_btn = ttk.Button(ctrl, text="⏹ 停止",
                                    command=self._stop_download, state="disabled")
        self.stop_btn.pack(side="right", padx=4)
        ttk.Button(ctrl, text="📂 保存先を開く", command=self._open_output).pack(side="right", padx=4)
        ttk.Label(ctrl, text="保存先: ~/Downloads/MangaDownloader/<漫画>/<話>/001.jpg ...",
                  style="Sub.TLabel").pack(side="left")

        pf = ttk.Frame(bot)
        pf.pack(fill="x", pady=(5, 0))
        self.progress = ttk.Progressbar(pf, mode="determinate", maximum=100)
        self.progress.pack(fill="x", side="left", expand=True)
        self.pct_label = ttk.Label(pf, text="0%", width=5)
        self.pct_label.pack(side="left", padx=5)

        self.status_var = tk.StringVar(value="準備完了")
        ttk.Label(bot, textvariable=self.status_var, foreground="#a6e3a1",
                  background="#1e1e2e", font=("Helvetica", 10)).pack(anchor="w", pady=(3, 0))

    def _build_results_tab(self):
        cols = ("title", "url")
        self.results_tree = ttk.Treeview(self.tab_results, columns=cols,
                                          show="headings", selectmode="browse")
        self.results_tree.heading("title", text="タイトル")
        self.results_tree.heading("url", text="URL")
        self.results_tree.column("title", width=420)
        self.results_tree.column("url", width=460)
        self.results_tree.pack(fill="both", expand=True, side="left")
        sb = ttk.Scrollbar(self.tab_results, orient="vertical",
                            command=self.results_tree.yview)
        sb.pack(fill="y", side="right")
        self.results_tree.configure(yscrollcommand=sb.set)
        self.results_tree.bind("<Double-1>", self._on_result_select)
        self.results_tree.bind("<Return>", self._on_result_select)

    def _build_chapters_tab(self):
        top = ttk.Frame(self.tab_chapters)
        top.pack(fill="x", pady=5, padx=4)
        self.manga_title_var = tk.StringVar(value="（未選択）")
        ttk.Label(top, textvariable=self.manga_title_var,
                  style="Header.TLabel").pack(side="left")
        ttk.Button(top, text="全解除", command=self._deselect_all).pack(side="right", padx=3)
        ttk.Button(top, text="全選択", command=self._select_all).pack(side="right", padx=3)

        cols = ("sel", "chapter", "url")
        self.ch_tree = ttk.Treeview(self.tab_chapters, columns=cols,
                                     show="headings", selectmode="extended")
        self.ch_tree.heading("sel", text="✓")
        self.ch_tree.heading("chapter", text="チャプター")
        self.ch_tree.heading("url", text="URL")
        self.ch_tree.column("sel", width=34, anchor="center")
        self.ch_tree.column("chapter", width=340)
        self.ch_tree.column("url", width=480)
        self.ch_tree.pack(fill="both", expand=True, side="left")
        sb2 = ttk.Scrollbar(self.tab_chapters, orient="vertical",
                              command=self.ch_tree.yview)
        sb2.pack(fill="y", side="right")
        self.ch_tree.configure(yscrollcommand=sb2.set)
        self.ch_tree.bind("<space>", self._toggle_selection)
        self.ch_tree.bind("<Double-1>", self._toggle_selection)

    # ── Handlers ───────────────────────────────────────────────────────────────

    def _on_site_change(self, _=None):
        name = self.site_var.get()
        for s in SITE_REGISTRY:
            if s.name == name:
                state.site = s
                break
        self._update_site_ui()
        self._set_status(f"サイト切替: {state.site.name}")

    def _update_site_ui(self):
        s = state.site
        self.site_meta_label.configure(text=f"{s.publisher}  |  {s.base_url}")
        desc = s.description
        if not s.downloadable:
            desc = "⚠️ 一覧表示のみ（画像DL非対応）  " + desc
        self.site_desc_label.configure(
            text=desc,
            foreground="#f38ba8" if not s.downloadable else "#a6adc8"
        )
        # Grey out download button for non-downloadable sites
        if hasattr(self, "dl_btn"):
            dl_state = "normal" if s.downloadable else "disabled"
            self.dl_btn.configure(state=dl_state)

    def _do_search(self):
        q = self.search_var.get().strip()
        if not q:
            self._load_all()
            return
        self._set_status(f"「{q}」を検索中...")
        threading.Thread(target=self._search_thread, args=(q,), daemon=True).start()

    def _search_thread(self, q):
        try:
            results = state.site.search(q)
            self.after(0, lambda: self._show_results(results))
        except Exception as e:
            self.after(0, lambda: self._set_status(f"検索エラー: {e}"))

    def _load_all(self):
        self._set_status("全作品一覧を取得中...")
        threading.Thread(target=self._load_all_thread, daemon=True).start()

    def _load_all_thread(self):
        import time
        all_results, seen = [], set()
        for page in range(1, 100):
            try:
                items = state.site.list_all(page)
                if not items:
                    break
                for item in items:
                    if item["url"] not in seen:
                        seen.add(item["url"])
                        all_results.append(item)
                self.after(0, lambda c=len(all_results): self._set_status(f"取得中... {c} 件"))
                time.sleep(0.5)
            except Exception:
                break
        self.after(0, lambda: self._show_results(all_results))

    def _open_url(self):
        url = self.url_var.get().strip()
        if url:
            self._load_manga(url)

    def _show_results(self, results):
        self.results_tree.delete(*self.results_tree.get_children())
        for r in results:
            self.results_tree.insert("", "end", values=(r["title"], r["url"]))
        self._set_status(f"{len(results)} 件")
        self.nb.select(self.tab_results)

    def _on_result_select(self, _=None):
        sel = self.results_tree.selection()
        if not sel:
            return
        row = self.results_tree.item(sel[0])["values"]
        self._load_manga(row[1])

    def _load_manga(self, url):
        self._set_status("マンガ情報を取得中（チャプター一覧収集中）...")
        threading.Thread(target=self._load_manga_thread, args=(url,), daemon=True).start()

    def _load_manga_thread(self, url):
        try:
            info = state.site.get_manga_info(url)
            state.current_manga = info
            self.after(0, self._show_chapters)
        except Exception as e:
            self.after(0, lambda: self._set_status(f"エラー: {e}"))

    def _show_chapters(self):
        info = state.current_manga
        self.manga_title_var.set(info["title"] or "（タイトル不明）")
        self.ch_tree.delete(*self.ch_tree.get_children())
        state.selected_chapters = set()
        for ch in info["chapters"]:
            self.ch_tree.insert("", "end", values=("☐", ch["title"], ch["url"]))
        self._set_status(f"{len(info['chapters'])} チャプター")
        self.nb.select(self.tab_chapters)

    def _toggle_selection(self, _=None):
        for iid in self.ch_tree.selection():
            vals = list(self.ch_tree.item(iid)["values"])
            if vals[0] == "☐":
                vals[0] = "☑"
                state.selected_chapters.add(iid)
            else:
                vals[0] = "☐"
                state.selected_chapters.discard(iid)
            self.ch_tree.item(iid, values=vals)

    def _select_all(self):
        for iid in self.ch_tree.get_children():
            vals = list(self.ch_tree.item(iid)["values"])
            vals[0] = "☑"
            self.ch_tree.item(iid, values=vals)
            state.selected_chapters.add(iid)

    def _deselect_all(self):
        for iid in self.ch_tree.get_children():
            vals = list(self.ch_tree.item(iid)["values"])
            vals[0] = "☐"
            self.ch_tree.item(iid, values=vals)
        state.selected_chapters.clear()

    def _start_download(self):
        if not state.site.downloadable:
            messagebox.showinfo(
                "ダウンロード非対応",
                f"{state.site.name} は画像のダウンロードに対応していません。\n"
                "ブラウザで直接閲覧してください。"
            )
            return
        if not state.current_manga:
            messagebox.showwarning("未選択", "漫画を選択してください")
            return
        chapters_to_dl = [
            {"title": self.ch_tree.item(iid)["values"][1],
             "url": self.ch_tree.item(iid)["values"][2]}
            for iid in self.ch_tree.get_children()
            if iid in state.selected_chapters
        ]
        if not chapters_to_dl:
            messagebox.showwarning("未選択", "チャプターを選択してください（スペース or ダブルクリック）")
            return

        state.reset_stop()
        self.dl_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")
        self.progress["value"] = 0

        threading.Thread(
            target=self._download_thread,
            args=(state.site, state.current_manga["title"], chapters_to_dl),
            daemon=True,
        ).start()

    def _download_thread(self, site, manga_title, chapters):
        total = len(chapters)
        for i, ch in enumerate(chapters):
            if state.should_stop():
                break
            self.after(0, lambda t=ch["title"], n=i:
                       self._set_status(f"[{n + 1}/{total}] {t} ダウンロード中..."))

            def progress_cb(cur, tot, msg, n=i):
                pct = int((n / total) * 100 + (cur / max(tot, 1)) * (100 / total))
                self.after(0, lambda p=pct, m=msg: self._update_progress(p, m))

            download_chapter(
                site, manga_title, ch["title"], ch["url"],
                progress_cb=progress_cb,
                stop_flag=state.should_stop,
            )

        self.after(0, self._download_done)

    def _download_done(self):
        self.progress["value"] = 100
        self.pct_label.configure(text="100%")
        self._set_status("✅ ダウンロード完了！")
        self.dl_btn.configure(state="normal")
        self.stop_btn.configure(state="disabled")

    def _stop_download(self):
        state.stop()
        self._set_status("⏹ 停止中...")
        self.stop_btn.configure(state="disabled")

    def _open_output(self):
        OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
        subprocess.run(["open", str(OUTPUT_ROOT)])

    def _set_status(self, msg):
        self.status_var.set(msg)

    def _update_progress(self, pct, msg):
        self.progress["value"] = pct
        self.pct_label.configure(text=f"{pct}%")
        self.status_var.set(msg)


if __name__ == "__main__":
    MangaDownloaderApp().mainloop()
