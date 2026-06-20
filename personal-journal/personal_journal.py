#!/usr/bin/env python3
"""
Personal Journal — プライベート日記アプリ
暗号化オプション付き日記。気分トラッカー、タグ、検索、
カレンダービュー、エクスポート、年間ヒートマップ。
標準ライブラリのみ。
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog, simpledialog
import json
import hashlib
import base64
import os
from datetime import date, timedelta
from pathlib import Path
import calendar
import re


DATA_FILE = Path.home() / ".personal_journal.json"
KEY_FILE  = Path.home() / ".journal_key"

MOODS = {"😄 最高": 5, "😊 良い": 4, "😐 普通": 3, "😔 悪い": 2, "😢 最悪": 1}
MOOD_COLORS = {5:"#4ade80", 4:"#a3e635", 3:"#fbbf24", 2:"#fb923c", 1:"#f87171"}
WEATHER = ["☀️","⛅","🌧","❄️","🌩","🌫"]


def simple_encrypt(text: str, key: str) -> str:
    """XOR-based simple encryption (not cryptographically secure, for privacy only)"""
    key_bytes = key.encode() * (len(text.encode()) // len(key.encode()) + 1)
    encrypted = bytes([b ^ k for b, k in zip(text.encode(), key_bytes)])
    return base64.b64encode(encrypted).decode()


def simple_decrypt(ciphertext: str, key: str) -> str:
    try:
        encrypted = base64.b64decode(ciphertext)
        key_bytes = key.encode() * (len(encrypted) // len(key.encode()) + 1)
        decrypted = bytes([b ^ k for b, k in zip(encrypted, key_bytes)])
        return decrypted.decode()
    except Exception:
        return ""


class PersonalJournal(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Personal Journal 📔")
        self.geometry("1050x680")
        self.configure(bg="#0f0f1a")
        self.resizable(True, True)

        self.entries = {}   # date_str -> entry_dict
        self.encrypt_key = None
        self.selected_date = date.today().isoformat()
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._refresh_list())
        self.tag_filter_var = tk.StringVar(value="全て")
        self.mood_filter_var = tk.StringVar(value="全て")
        self.view_mode = tk.StringVar(value="list")

        self._check_password()
        self._load()
        self._build_ui()
        self._refresh_list()
        self._load_entry(self.selected_date)

    # ── Auth ──────────────────────────────────────────
    def _check_password(self):
        if KEY_FILE.exists():
            pwd = simpledialog.askstring("🔒 パスワード", "日記のパスワードを入力:",
                                          show="*", parent=self)
            if pwd is None: self.destroy(); return
            stored = KEY_FILE.read_text().strip()
            if hashlib.sha256(pwd.encode()).hexdigest() != stored:
                messagebox.showerror("エラー", "パスワードが違います")
                self.destroy(); return
            self.encrypt_key = pwd
        else:
            set_pwd = messagebox.askyesno("初回設定", "パスワードを設定しますか？\n（設定しない場合は暗号化されません）")
            if set_pwd:
                pwd = simpledialog.askstring("パスワード設定", "新しいパスワード:", show="*", parent=self)
                if pwd:
                    KEY_FILE.write_text(hashlib.sha256(pwd.encode()).hexdigest())
                    self.encrypt_key = pwd

    # ── Persistence ───────────────────────────────────
    def _load(self):
        if DATA_FILE.exists():
            try: self.entries = json.loads(DATA_FILE.read_text())
            except: self.entries = {}

    def _save(self):
        DATA_FILE.write_text(json.dumps(self.entries, ensure_ascii=False, indent=2))

    def _get_content(self, entry: dict) -> str:
        raw = entry.get("content", "")
        if self.encrypt_key and entry.get("encrypted"):
            return simple_decrypt(raw, self.encrypt_key)
        return raw

    def _set_content(self, entry: dict, text: str):
        if self.encrypt_key:
            entry["content"] = simple_encrypt(text, self.encrypt_key)
            entry["encrypted"] = True
        else:
            entry["content"] = text
            entry["encrypted"] = False

    # ── UI ────────────────────────────────────────────
    def _build_ui(self):
        s = ttk.Style(self); s.theme_use("clam")
        BG="#0f0f1a"; CARD="#1a1a2e"; FG="#e0e0f0"; FG2="#6b7280"; BORDER="#2d2d4e"; ACC="#c084fc"
        s.configure(".", background=BG, foreground=FG, fieldbackground=CARD)
        s.configure("TFrame", background=BG); s.configure("TLabel", background=BG, foreground=FG)
        s.configure("TButton", background=BORDER, foreground=FG, padding=5)
        s.map("TButton", background=[("active","#3d2d5e")])
        s.configure("TEntry", fieldbackground=CARD, foreground=FG, insertcolor=FG)
        s.configure("TCombobox", fieldbackground=CARD, foreground=FG)
        s.configure("TScrollbar", background=CARD, troughcolor=BG)
        s.configure("TCheckbutton", background=BG, foreground=FG)
        s.configure("TScale", background=BG, troughcolor=BORDER)

        # Header
        hdr = tk.Frame(self, bg=BG)
        hdr.pack(fill="x", padx=12, pady=(10,6))
        tk.Label(hdr, text="📔 Personal Journal", font=("",15,"bold"), bg=BG, fg=ACC).pack(side="left")

        # Nav
        nav = tk.Frame(hdr, bg=BG)
        nav.pack(side="right")
        ttk.Button(nav, text="◀", width=3, command=lambda: self._nav_date(-1)).pack(side="left")
        self.date_lbl = ttk.Label(nav, text="", font=("",12,"bold"), width=16, anchor="center")
        self.date_lbl.pack(side="left")
        ttk.Button(nav, text="▶", width=3, command=lambda: self._nav_date(1)).pack(side="left")
        ttk.Button(nav, text="今日", command=self._go_today).pack(side="left", padx=6)

        # View mode tabs
        for mode, label in [("list","📋 リスト"), ("calendar","📅 カレンダー"), ("heatmap","🗓 年間")]:
            btn = tk.Button(nav, text=label, bg=BORDER, fg=FG2,
                            relief="flat", padx=8, pady=3, font=("",10), cursor="hand2",
                            command=lambda m=mode: self._set_view(m))
            btn.pack(side="left", padx=2)

        # Export / New
        ttk.Button(nav, text="📤 エクスポート", command=self._export).pack(side="left", padx=4)
        ttk.Button(nav, text="＋ 新規", command=self._new_entry).pack(side="left")

        # ── Main layout ──
        main = tk.PanedWindow(self, orient="horizontal", bg=BG, sashwidth=4)
        main.pack(fill="both", expand=True, padx=10, pady=4)

        # Left: list / calendar
        left = tk.Frame(main, bg=BG)
        main.add(left, minsize=260)
        self._build_left_panel(left)

        # Right: editor
        right = tk.Frame(main, bg=BG)
        main.add(right, minsize=600)
        self._build_editor(right)

    def _build_left_panel(self, parent):
        # Search + filters
        search_row = tk.Frame(parent, bg="#0f0f1a")
        search_row.pack(fill="x", pady=(0,4))
        ttk.Entry(search_row, textvariable=self.search_var, width=20).pack(fill="x", pady=2)

        filter_row = tk.Frame(parent, bg="#0f0f1a")
        filter_row.pack(fill="x", pady=2)
        ttk.Combobox(filter_row, textvariable=self.mood_filter_var,
                     values=["全て"] + list(MOODS.keys()), state="readonly", width=10).pack(side="left", padx=2)

        # List
        self.list_frame = tk.Frame(parent, bg="#0f0f1a")
        self.list_frame.pack(fill="both", expand=True)
        self._build_entry_list()

        # Stats
        self.stats_var = tk.StringVar(value="")
        tk.Label(parent, textvariable=self.stats_var, bg="#0f0f1a", fg="#374151", font=("",9)).pack(pady=4)

    def _build_entry_list(self):
        for w in self.list_frame.winfo_children(): w.destroy()
        cols = ("日付", "気分", "プレビュー")
        self.entry_tree = ttk.Treeview(self.list_frame, columns=cols, show="headings", height=20)
        for col, w in zip(cols, [80, 50, 110]):
            self.entry_tree.heading(col, text=col)
            self.entry_tree.column(col, width=w)
        vsb = ttk.Scrollbar(self.list_frame, orient="vertical", command=self.entry_tree.yview)
        self.entry_tree.configure(yscrollcommand=vsb.set)
        self.entry_tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")
        self.entry_tree.bind("<ButtonRelease-1>", self._on_entry_select)

    def _build_editor(self, parent):
        # Entry meta bar
        meta_bar = tk.Frame(parent, bg="#1a1a2e", pady=6)
        meta_bar.pack(fill="x")

        # Mood selector
        tk.Label(meta_bar, text="気分:", bg="#1a1a2e", fg="#6b7280", font=("",10)).pack(side="left", padx=(12,4))
        self.mood_var = tk.StringVar(value="😊 良い")
        mood_cb = ttk.Combobox(meta_bar, textvariable=self.mood_var,
                                values=list(MOODS.keys()), state="readonly", width=10)
        mood_cb.pack(side="left", padx=4)
        mood_cb.bind("<<ComboboxSelected>>", lambda e: self._auto_save())

        # Weather
        tk.Label(meta_bar, text="天気:", bg="#1a1a2e", fg="#6b7280", font=("",10)).pack(side="left", padx=(8,4))
        self.weather_var = tk.StringVar(value="☀️")
        weather_cb = ttk.Combobox(meta_bar, textvariable=self.weather_var,
                                   values=WEATHER, state="readonly", width=4)
        weather_cb.pack(side="left", padx=4)
        weather_cb.bind("<<ComboboxSelected>>", lambda e: self._auto_save())

        # Tags
        tk.Label(meta_bar, text="タグ:", bg="#1a1a2e", fg="#6b7280", font=("",10)).pack(side="left", padx=(8,4))
        self.tags_var = tk.StringVar()
        ttk.Entry(meta_bar, textvariable=self.tags_var, width=20).pack(side="left", padx=4)
        self.tags_var.trace_add("write", lambda *_: self._auto_save())

        # Word count
        self.word_count_var = tk.StringVar(value="0文字")
        tk.Label(meta_bar, textvariable=self.word_count_var, bg="#1a1a2e",
                 fg="#374151", font=("",9)).pack(side="right", padx=12)

        # Entry title
        self.entry_title_var = tk.StringVar()
        title_entry = tk.Entry(parent, textvariable=self.entry_title_var,
                               bg="#0f0f1a", fg="#e0e0f0", insertbackground="#e0e0f0",
                               font=("",16,"bold"), relief="flat", bd=0)
        title_entry.pack(fill="x", padx=14, pady=(10,4))
        title_entry.bind("<KeyRelease>", lambda _: self._auto_save())

        # Toolbar
        toolbar = tk.Frame(parent, bg="#1a1a2e")
        toolbar.pack(fill="x")
        for fmt, label in [("bold","**B**"), ("italic","*I*"), ("h2","## H"),
                           ("bullet","• リスト"), ("quote","> 引用"), ("code","`コード`"), ("hr","---")]:
            btn = tk.Button(toolbar, text=label, bg="#1a1a2e", fg="#6b7280",
                            relief="flat", padx=6, pady=3, font=("",10,"bold" if fmt=="bold" else "normal"),
                            cursor="hand2", command=lambda f=fmt: self._insert_fmt(f))
            btn.pack(side="left", padx=2, pady=4)

        # Main text area
        text_frame = tk.Frame(parent, bg="#0f0f1a")
        text_frame.pack(fill="both", expand=True, padx=14, pady=8)

        self.editor = tk.Text(text_frame, bg="#0f0f1a", fg="#e0e0f0",
                               insertbackground="#c084fc", relief="flat", bd=0,
                               font=("",13), wrap="word", undo=True,
                               padx=4, pady=4, spacing1=3, spacing3=3,
                               selectbackground="#2d2d4e")
        vsb = ttk.Scrollbar(text_frame, orient="vertical", command=self.editor.yview)
        self.editor.configure(yscrollcommand=vsb.set)
        self.editor.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        self.editor.bind("<KeyRelease>", self._on_edit)
        self.editor.bind("<Control-z>", lambda e: self.editor.edit_undo())
        self.editor.bind("<Control-y>", lambda e: self.editor.edit_redo())
        # Tab → spaces
        self.editor.bind("<Tab>", lambda e: (self.editor.insert(tk.INSERT, "    "), "break"))

        # Streak display
        self.streak_frame = tk.Frame(parent, bg="#1a1a2e")
        self.streak_frame.pack(fill="x", padx=14, pady=(0,8))
        self.streak_lbl = tk.Label(self.streak_frame, text="", bg="#1a1a2e", fg="#4b5563", font=("",10))
        self.streak_lbl.pack(side="left", padx=6, pady=4)
        self.delete_btn = tk.Button(self.streak_frame, text="🗑 この日記を削除", bg="#1a1a2e",
                                     fg="#374151", relief="flat", font=("",10), cursor="hand2",
                                     command=self._delete_entry)
        self.delete_btn.pack(side="right", padx=6)

    # ── Entry operations ──────────────────────────────
    def _load_entry(self, date_str: str):
        self.selected_date = date_str
        self.date_lbl.config(text=self._format_date(date_str))
        entry = self.entries.get(date_str, {})

        self.entry_title_var.set(entry.get("title", ""))
        self.mood_var.set(entry.get("mood", "😊 良い"))
        self.weather_var.set(entry.get("weather", "☀️"))
        self.tags_var.set(" ".join("#"+t for t in entry.get("tags",[])))

        content = self._get_content(entry) if entry else ""
        self.editor.delete("1.0", "end")
        self.editor.insert("1.0", content)
        self._update_word_count()
        self._update_streak()

    def _format_date(self, date_str: str) -> str:
        try:
            d = date.fromisoformat(date_str)
            wd = ["月","火","水","木","金","土","日"][d.weekday()]
            return f"{d.year}年{d.month}月{d.day}日({wd})"
        except: return date_str

    def _auto_save(self):
        content = self.editor.get("1.0", "end-1c").strip()
        title = self.entry_title_var.get().strip()
        if not content and not title: return
        entry = self.entries.get(self.selected_date, {})
        entry["date"] = self.selected_date
        entry["title"] = title
        entry["mood"] = self.mood_var.get()
        entry["weather"] = self.weather_var.get()
        raw_tags = self.tags_var.get()
        entry["tags"] = re.findall(r'#(\w+)', raw_tags)
        self._set_content(entry, content)
        entry.setdefault("created", self.selected_date)
        entry["modified"] = date.today().isoformat()
        self.entries[self.selected_date] = entry
        self._save()
        self._refresh_list()

    def _on_edit(self, event=None):
        self._auto_save()
        self._update_word_count()

    def _update_word_count(self):
        text = self.editor.get("1.0", "end-1c")
        self.word_count_var.set(f"{len(text.replace(chr(10),''))}文字 / {len(text.split())}語")

    def _update_streak(self):
        streak = 0; d = date.today()
        while d.isoformat() in self.entries:
            streak += 1; d -= timedelta(days=1)
        total = len(self.entries)
        self.streak_lbl.config(text=f"🔥 連続: {streak}日  📝 総エントリ: {total}件")

    def _new_entry(self):
        d = simpledialog.askstring("日付選択", "日付 (YYYY-MM-DD):",
                                    initialvalue=date.today().isoformat(), parent=self)
        if d:
            try: date.fromisoformat(d)
            except: messagebox.showerror("エラー","日付形式が違います"); return
            self._load_entry(d)
            self.editor.focus()

    def _delete_entry(self):
        if self.selected_date not in self.entries: return
        if messagebox.askyesno("確認", f"{self._format_date(self.selected_date)} の日記を削除しますか？"):
            del self.entries[self.selected_date]
            self._save(); self._refresh_list()
            self.editor.delete("1.0","end")

    def _insert_fmt(self, fmt):
        sel_start, sel_end = "sel.first", "sel.last"
        try:
            sel = self.editor.get(sel_start, sel_end)
        except tk.TclError:
            sel = ""
        inserts = {
            "bold":   f"**{sel or 'テキスト'}**",
            "italic": f"*{sel or 'テキスト'}*",
            "h2":     f"\n## {sel or '見出し'}",
            "bullet": f"\n- {sel or 'アイテム'}",
            "quote":  f"\n> {sel or '引用'}",
            "code":   f"`{sel or 'code'}`",
            "hr":     "\n---\n",
        }
        self.editor.focus()
        self.editor.insert(tk.INSERT, inserts.get(fmt, ""))
        self._auto_save()

    # ── List ──────────────────────────────────────────
    def _refresh_list(self):
        self.entry_tree.delete(*self.entry_tree.get_children())
        q = self.search_var.get().lower()
        mf = self.mood_filter_var.get()

        entries = sorted(self.entries.items(), key=lambda x: x[0], reverse=True)
        count = 0
        for date_str, entry in entries:
            content = self._get_content(entry)
            mood = entry.get("mood","")
            if mf != "全て" and mood != mf: continue
            if q and q not in content.lower() and q not in entry.get("title","").lower(): continue
            preview = (entry.get("title") or content[:20]).replace("\n"," ")[:20]
            mood_icon = mood.split()[0] if mood else ""
            self.entry_tree.insert("", "end", iid=date_str,
                                    values=(date_str[5:], mood_icon, preview))
            count += 1
        self.stats_var.set(f"エントリ: {count}/{len(self.entries)}件")

    def _on_entry_select(self, event=None):
        sel = self.entry_tree.selection()
        if sel: self._load_entry(sel[0])

    # ── Navigation ────────────────────────────────────
    def _nav_date(self, delta):
        try:
            d = date.fromisoformat(self.selected_date) + timedelta(days=delta)
            self._load_entry(d.isoformat())
        except: pass

    def _go_today(self):
        self._load_entry(date.today().isoformat())

    def _set_view(self, mode):
        self.view_mode.set(mode)
        # Future: switch left panel view
        if mode == "heatmap":
            self._show_heatmap_window()

    def _show_heatmap_window(self):
        win = tk.Toplevel(self)
        win.title("年間ヒートマップ"); win.configure(bg="#0f0f1a")
        win.geometry("820x200")
        canvas = tk.Canvas(win, bg="#0f0f1a", bd=0, highlightthickness=0)
        canvas.pack(fill="both", expand=True, padx=10, pady=10)

        days = 365; cell = 14; gap = 2; step = cell + gap
        today = date.today()
        start = today - timedelta(days=days-1)
        start = start - timedelta(days=start.weekday())

        d = start; col = 0
        while d <= today:
            for row in range(7):
                dd = d + timedelta(days=row)
                if dd > today: break
                ds = dd.isoformat()
                entry = self.entries.get(ds)
                if entry:
                    mood_num = MOODS.get(entry.get("mood",""), 3)
                    color = MOOD_COLORS[mood_num]
                else:
                    color = "#1a1a2e"
                x = 30 + col * step; y = 20 + row * step
                rect = canvas.create_rectangle(x, y, x+cell, y+cell, fill=color, outline="", tags=ds)
                canvas.tag_bind(rect, "<Button-1>", lambda e, dd2=dd.isoformat(): (win.destroy(), self._load_entry(dd2)))
                canvas.tag_bind(rect, "<Enter>", lambda e, dd2=dd.isoformat(): canvas.itemconfig(e.widget, outline="#fff") if False else None)
            d += timedelta(weeks=1); col += 1

        # Legend
        for mood_str, num in MOODS.items():
            x = 30 + (num-1)*70; y = 7*step + 30
            canvas.create_rectangle(x, y, x+cell, y+cell, fill=MOOD_COLORS[num], outline="")
            canvas.create_text(x+cell+4, y+7, text=mood_str.split()[0], fill="#6b7280", font=("",9), anchor="w")

    # ── Export ────────────────────────────────────────
    def _export(self):
        path = filedialog.asksaveasfilename(title="エクスポート",
            defaultextension=".md",
            filetypes=[("Markdown","*.md"),("テキスト","*.txt"),("JSON","*.json")])
        if not path: return
        if path.endswith(".json"):
            with open(path,"w",encoding="utf-8") as f:
                export_data = {}
                for ds, entry in self.entries.items():
                    e2 = dict(entry)
                    e2["content"] = self._get_content(entry)
                    e2.pop("encrypted", None)
                    export_data[ds] = e2
                json.dump(export_data, f, ensure_ascii=False, indent=2)
        else:
            with open(path,"w",encoding="utf-8") as f:
                for ds in sorted(self.entries.keys(), reverse=True):
                    entry = self.entries[ds]
                    f.write(f"# {self._format_date(ds)}")
                    title = entry.get("title")
                    if title: f.write(f" — {title}")
                    f.write(f"\n\n気分: {entry.get('mood','')} | 天気: {entry.get('weather','')}")
                    if entry.get("tags"): f.write(f" | タグ: {' '.join('#'+t for t in entry['tags'])}")
                    f.write(f"\n\n{self._get_content(entry)}\n\n---\n\n")
        messagebox.showinfo("完了", f"エクスポートしました:\n{path}")


if __name__ == "__main__":
    app = PersonalJournal()
    app.mainloop()
