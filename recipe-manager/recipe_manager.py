#!/usr/bin/env python3
"""
Recipe Manager — 料理レシピ管理アプリ
レシピ登録・検索・カテゴリ管理・材料リスト・手順表示。
栄養素メモ、評価、お気に入り、印刷プレビュー。標準ライブラリのみ。
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog, simpledialog
import json
from pathlib import Path
import re
import uuid
import webbrowser
import tempfile


DATA_FILE = Path.home() / ".recipe_manager.json"

CATEGORIES = ["和食","洋食","中華","イタリアン","デザート","ベーカリー","飲み物","その他"]
DIFFICULTIES = ["簡単","普通","難しい","上級"]
TAGS_SUGGEST = ["ヘルシー","スピード","節約","作り置き","子供向け","おもてなし","ビーガン","グルテンフリー"]


class RecipeManager(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Recipe Manager 🍳")
        self.geometry("1100x700")
        self.configure(bg="#0f172a")
        self.resizable(True, True)

        self.recipes = []
        self.filtered_recipes = []
        self.current_recipe_id = None
        self.edit_mode = False

        self._load()
        self._build_ui()
        self._filter_recipes()

    # ── Persistence ───────────────────────────────────
    def _load(self):
        if DATA_FILE.exists():
            try: self.recipes = json.loads(DATA_FILE.read_text())
            except: self.recipes = []
        if not self.recipes:
            self._add_sample_recipes()

    def _save(self):
        DATA_FILE.write_text(json.dumps(self.recipes, ensure_ascii=False, indent=2))

    def _add_sample_recipes(self):
        self.recipes = [
            {
                'id': str(uuid.uuid4()), 'title': '親子丼', 'category': '和食',
                'difficulty': '簡単', 'time_min': 20, 'servings': 2, 'rating': 5,
                'favorite': True, 'tags': ['スピード','節約'],
                'description': '定番の日本の丼物。ふわとろ卵が絶品。',
                'ingredients': [
                    {'name': '鶏もも肉', 'amount': '200g'},
                    {'name': '卵', 'amount': '3個'},
                    {'name': '玉ねぎ', 'amount': '1/2個'},
                    {'name': 'だし汁', 'amount': '150ml'},
                    {'name': '醤油', 'amount': '大さじ2'},
                    {'name': 'みりん', 'amount': '大さじ2'},
                    {'name': '砂糖', 'amount': '小さじ1'},
                    {'name': 'ご飯', 'amount': '2杯分'},
                ],
                'steps': [
                    '鶏肉を一口大に切る。玉ねぎを薄切りにする。',
                    'だし汁・醤油・みりん・砂糖を合わせてたれを作る。',
                    'フライパンにたれと玉ねぎを入れて中火で煮る。',
                    '鶏肉を加えて火が通るまで煮る（5分）。',
                    '溶き卵を回し入れ、半熟になったら火を止める。',
                    'ご飯の上に盛りつけて完成。',
                ],
                'notes': 'カツ丼にするには鶏肉の代わりに揚げたカツを使う。',
                'created_at': '2026-01-01',
            },
            {
                'id': str(uuid.uuid4()), 'title': 'パスタカルボナーラ', 'category': 'イタリアン',
                'difficulty': '普通', 'time_min': 25, 'servings': 2, 'rating': 4,
                'favorite': False, 'tags': ['おもてなし'],
                'description': '本格的なローマ式カルボナーラ。クリームは使わない。',
                'ingredients': [
                    {'name': 'スパゲッティ', 'amount': '200g'},
                    {'name': 'パンチェッタ/ベーコン', 'amount': '80g'},
                    {'name': '卵', 'amount': '2個'},
                    {'name': '卵黄', 'amount': '2個'},
                    {'name': 'ペコリーノ/パルメザン', 'amount': '60g'},
                    {'name': '黒胡椒', 'amount': '適量'},
                    {'name': '塩', 'amount': '適量'},
                ],
                'steps': [
                    '大鍋に湯を沸かし塩を加える。',
                    'ベーコンを短冊切りにしてフライパンで炒める。',
                    '卵・卵黄・チーズ・黒胡椒を混ぜてソースを作る。',
                    'パスタをアルデンテに茹でる。',
                    'フライパンの火を止め、パスタとゆで汁を加える。',
                    'ソースを加えて素早く和え、余熱で仕上げる。',
                ],
                'notes': '卵が固まらないよう火を止めてから混ぜること。',
                'created_at': '2026-01-02',
            },
        ]
        self._save()

    # ── UI ────────────────────────────────────────────
    def _build_ui(self):
        s = ttk.Style(self); s.theme_use("clam")
        BG="#0f172a"; CARD="#1e293b"; FG="#e2e8f0"; FG2="#94a3b8"; BORDER="#334155"; ACC="#f97316"
        s.configure(".", background=BG, foreground=FG, fieldbackground=CARD)
        s.configure("TFrame", background=BG)
        s.configure("TLabel", background=BG, foreground=FG)
        s.configure("TButton", background="#334155", foreground=FG, padding=5)
        s.map("TButton", background=[("active","#475569")])
        s.configure("Orange.TButton", background="#9a3412", foreground="white")
        s.map("Orange.TButton", background=[("active","#c2410c")])
        s.configure("TEntry", fieldbackground=CARD, foreground=FG, insertcolor=FG)
        s.configure("TCombobox", fieldbackground=CARD, foreground=FG)
        s.configure("TTextarea", fieldbackground=CARD, foreground=FG)
        s.configure("TSpinbox", fieldbackground=CARD, foreground=FG)
        s.configure("TCheckbutton", background=BG, foreground=FG)
        s.configure("Treeview", background=CARD, foreground=FG, fieldbackground=CARD, rowheight=26)
        s.configure("Treeview.Heading", background=BORDER, foreground=FG2, font=("",10))
        s.map("Treeview", background=[("selected","#7c2d12")])
        s.configure("TLabelframe", background=CARD, foreground=FG2)
        s.configure("TLabelframe.Label", background=BG, foreground=FG2, font=("",10))
        s.configure("TScrollbar", background=CARD, troughcolor=BG)
        s.configure("TNotebook", background=BG)
        s.configure("TNotebook.Tab", background=CARD, foreground=FG2, padding=[8,4])
        s.map("TNotebook.Tab", background=[("selected","#431407")], foreground=[("selected",ACC)])

        # ── Top bar ──
        top = tk.Frame(self, bg=BG)
        top.pack(fill="x", padx=14, pady=(10,6))
        tk.Label(top, text="🍳 Recipe Manager", font=("",15,"bold"), bg=BG, fg=ACC).pack(side="left")

        # Search
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._filter_recipes())
        search_entry = ttk.Entry(top, textvariable=self.search_var, width=24)
        search_entry.pack(side="left", padx=12)
        tk.Label(top, text="🔍", bg=BG, fg=FG2).place_in(search_entry) if False else None

        # Category filter
        self.cat_var = tk.StringVar(value="全て")
        cat_combo = ttk.Combobox(top, textvariable=self.cat_var,
                                   values=["全て"] + CATEGORIES, state="readonly", width=10)
        cat_combo.pack(side="left", padx=4)
        self.cat_var.trace_add("write", lambda *_: self._filter_recipes())

        # Difficulty filter
        self.diff_var = tk.StringVar(value="全て")
        diff_combo = ttk.Combobox(top, textvariable=self.diff_var,
                                   values=["全て"] + DIFFICULTIES, state="readonly", width=8)
        diff_combo.pack(side="left", padx=4)
        self.diff_var.trace_add("write", lambda *_: self._filter_recipes())

        # Favorite filter
        self.fav_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(top, text="★お気に入り", variable=self.fav_var,
                        command=self._filter_recipes).pack(side="left", padx=4)

        # Sort
        self.sort_var = tk.StringVar(value="タイトル")
        sort_cb = ttk.Combobox(top, textvariable=self.sort_var,
                                values=["タイトル","評価","調理時間","作成日"], state="readonly", width=9)
        sort_cb.pack(side="left", padx=4)
        self.sort_var.trace_add("write", lambda *_: self._filter_recipes())

        ttk.Button(top, text="＋ 新規レシピ", style="Orange.TButton",
                   command=self._new_recipe).pack(side="right", padx=4)

        # ── Main layout ──
        main = tk.PanedWindow(self, orient="horizontal", bg="#0f172a", sashwidth=4)
        main.pack(fill="both", expand=True, padx=10, pady=4)

        # Left: Recipe list
        left = tk.Frame(main, bg=BG)
        main.add(left, minsize=280)
        self._build_recipe_list(left)

        # Right: Detail / Edit
        right = tk.Frame(main, bg=BG)
        main.add(right, minsize=500)
        self._build_detail_panel(right)

    def _build_recipe_list(self, parent):
        tk.Label(parent, text="レシピ一覧", font=("",11,"bold"), bg="#0f172a", fg="#94a3b8").pack(anchor="w", padx=6, pady=2)
        self.count_var = tk.StringVar(value="0件")
        tk.Label(parent, textvariable=self.count_var, bg="#0f172a", fg="#475569", font=("",9)).pack(anchor="e", padx=6)

        cols = ("★","タイトル","時間","難度","評価")
        self.recipe_tree = ttk.Treeview(parent, columns=cols, show="headings", height=22)
        for col, w in zip(cols, [20,180,50,55,40]):
            self.recipe_tree.heading(col, text=col)
            self.recipe_tree.column(col, width=w)
        vsb = ttk.Scrollbar(parent, orient="vertical", command=self.recipe_tree.yview)
        self.recipe_tree.configure(yscrollcommand=vsb.set)

        lf = tk.Frame(parent, bg=BG)
        lf.pack(fill="both", expand=True, padx=4, pady=4)
        self.recipe_tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        self.recipe_tree.bind("<ButtonRelease-1>", self._on_recipe_select)
        self.recipe_tree.bind("<Double-1>", self._on_recipe_dbl)
        self.recipe_tree.tag_configure("favorite", foreground="#f97316")

    def _build_detail_panel(self, parent):
        self.detail_nb = ttk.Notebook(parent)
        self.detail_nb.pack(fill="both", expand=True)

        # ── View tab ──
        view_frame = tk.Frame(self.detail_nb, bg="#0f172a")
        self.detail_nb.add(view_frame, text="📖 レシピ")
        self._build_view_tab(view_frame)

        # ── Edit tab ──
        edit_frame = tk.Frame(self.detail_nb, bg="#0f172a")
        self.detail_nb.add(edit_frame, text="✏ 編集")
        self._build_edit_tab(edit_frame)

    def _build_view_tab(self, parent):
        # Header
        self.v_title = tk.Label(parent, text="レシピを選択してください", font=("",18,"bold"),
                                 bg="#0f172a", fg="#f97316", wraplength=600, anchor="w")
        self.v_title.pack(fill="x", padx=14, pady=(10,4))

        meta_row = tk.Frame(parent, bg="#0f172a")
        meta_row.pack(fill="x", padx=14, pady=2)
        self.v_meta = tk.Label(meta_row, text="", font=("",11), bg="#0f172a", fg="#94a3b8")
        self.v_meta.pack(side="left")
        self.v_fav_btn = tk.Label(meta_row, text="☆", font=("",16), bg="#0f172a", fg="#475569", cursor="hand2")
        self.v_fav_btn.pack(side="right", padx=4)
        self.v_fav_btn.bind("<Button-1>", self._toggle_favorite)
        self.v_rating = tk.Label(meta_row, text="", font=("",12), bg="#0f172a", fg="#fbbf24")
        self.v_rating.pack(side="right", padx=8)

        self.v_desc = tk.Label(parent, text="", font=("",11), bg="#1e293b", fg="#94a3b8",
                                wraplength=600, justify="left", anchor="w", padx=10, pady=6)
        self.v_desc.pack(fill="x", padx=14, pady=4)

        paned = tk.PanedWindow(parent, orient="horizontal", bg="#0f172a", sashwidth=4)
        paned.pack(fill="both", expand=True, padx=14, pady=4)

        # Ingredients
        ing_frame = tk.LabelFrame(paned, text="材料", bg="#1e293b", fg="#94a3b8", font=("",10), bd=1, relief="solid")
        paned.add(ing_frame, minsize=180)
        self.v_ing_text = tk.Text(ing_frame, bg="#1e293b", fg="#e2e8f0", font=("",11),
                                   relief="flat", bd=0, wrap="word", state="disabled", padx=8, pady=6)
        self.v_ing_text.pack(fill="both", expand=True)

        # Steps
        steps_frame = tk.LabelFrame(paned, text="手順", bg="#1e293b", fg="#94a3b8", font=("",10), bd=1, relief="solid")
        paned.add(steps_frame, minsize=280)
        self.v_steps_text = tk.Text(steps_frame, bg="#1e293b", fg="#e2e8f0", font=("",11),
                                     relief="flat", bd=0, wrap="word", state="disabled", padx=8, pady=6)
        vsb2 = ttk.Scrollbar(steps_frame, orient="vertical", command=self.v_steps_text.yview)
        self.v_steps_text.configure(yscrollcommand=vsb2.set)
        self.v_steps_text.pack(side="left", fill="both", expand=True)
        vsb2.pack(side="right", fill="y")

        # Action buttons
        act_row = tk.Frame(parent, bg="#0f172a")
        act_row.pack(fill="x", padx=14, pady=6)
        for text, cmd in [("✏ 編集", lambda: self.detail_nb.select(1)),
                          ("🖨 印刷", self._print_recipe),
                          ("🗑 削除", self._delete_recipe)]:
            tk.Button(act_row, text=text, bg="#334155", fg="#e2e8f0", relief="flat",
                      padx=10, pady=5, cursor="hand2", command=cmd).pack(side="left", padx=3)

    def _build_edit_tab(self, parent):
        scroll = tk.Frame(parent, bg="#0f172a")
        scroll.pack(fill="both", expand=True)

        canvas = tk.Canvas(scroll, bg="#0f172a", bd=0, highlightthickness=0)
        vsb = ttk.Scrollbar(scroll, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=vsb.set)
        canvas.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        inner = tk.Frame(canvas, bg="#0f172a", padx=14)
        canvas.create_window(0, 0, anchor="nw", window=inner)
        inner.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))

        def row(label, widget_fn):
            r = tk.Frame(inner, bg="#0f172a")
            r.pack(fill="x", pady=3)
            tk.Label(r, text=label, bg="#0f172a", fg="#94a3b8", font=("",10), width=10, anchor="w").pack(side="left")
            w = widget_fn(r)
            return w

        self.e_title_var = tk.StringVar()
        row("タイトル*", lambda p: ttk.Entry(p, textvariable=self.e_title_var, width=40).pack(side="left") or None)

        self.e_cat_var = tk.StringVar(value=CATEGORIES[0])
        row("カテゴリ", lambda p: ttk.Combobox(p, textvariable=self.e_cat_var, values=CATEGORIES, state="readonly", width=12).pack(side="left") or None)

        self.e_diff_var = tk.StringVar(value="普通")
        row("難易度", lambda p: ttk.Combobox(p, textvariable=self.e_diff_var, values=DIFFICULTIES, state="readonly", width=8).pack(side="left") or None)

        self.e_time_var = tk.IntVar(value=30)
        row("調理時間(分)", lambda p: ttk.Spinbox(p, textvariable=self.e_time_var, from_=1, to=480, width=6).pack(side="left") or None)

        self.e_servings_var = tk.IntVar(value=2)
        row("人数", lambda p: ttk.Spinbox(p, textvariable=self.e_servings_var, from_=1, to=20, width=5).pack(side="left") or None)

        self.e_rating_var = tk.IntVar(value=5)
        row("評価(1-5)", lambda p: ttk.Spinbox(p, textvariable=self.e_rating_var, from_=1, to=5, width=4).pack(side="left") or None)

        self.e_fav_var = tk.BooleanVar(value=False)
        row("お気に入り", lambda p: ttk.Checkbutton(p, variable=self.e_fav_var, text="★").pack(side="left") or None)

        self.e_tags_var = tk.StringVar()
        row("タグ", lambda p: ttk.Entry(p, textvariable=self.e_tags_var, width=30).pack(side="left") or None)

        tk.Label(inner, text="説明", bg="#0f172a", fg="#94a3b8", font=("",10)).pack(anchor="w", pady=(6,2))
        self.e_desc = tk.Text(inner, bg="#1e293b", fg="#e2e8f0", insertbackground="#e2e8f0",
                               relief="flat", bd=1, font=("",11), height=3, wrap="word", padx=6, pady=4)
        self.e_desc.pack(fill="x", pady=2)

        tk.Label(inner, text="材料 (1行1材料: 名前,量)", bg="#0f172a", fg="#94a3b8", font=("",10)).pack(anchor="w", pady=(8,2))
        self.e_ing = tk.Text(inner, bg="#1e293b", fg="#e2e8f0", insertbackground="#e2e8f0",
                              relief="flat", bd=1, font=("",11), height=8, wrap="word", padx=6, pady=4)
        self.e_ing.pack(fill="x", pady=2)

        tk.Label(inner, text="手順 (1行1ステップ)", bg="#0f172a", fg="#94a3b8", font=("",10)).pack(anchor="w", pady=(8,2))
        self.e_steps = tk.Text(inner, bg="#1e293b", fg="#e2e8f0", insertbackground="#e2e8f0",
                                relief="flat", bd=1, font=("",11), height=10, wrap="word", padx=6, pady=4)
        self.e_steps.pack(fill="x", pady=2)

        tk.Label(inner, text="メモ", bg="#0f172a", fg="#94a3b8", font=("",10)).pack(anchor="w", pady=(8,2))
        self.e_notes = tk.Text(inner, bg="#1e293b", fg="#e2e8f0", insertbackground="#e2e8f0",
                                relief="flat", bd=1, font=("",11), height=3, wrap="word", padx=6, pady=4)
        self.e_notes.pack(fill="x", pady=2)

        btn_row = tk.Frame(inner, bg="#0f172a")
        btn_row.pack(fill="x", pady=12)
        tk.Button(btn_row, text="💾 保存", bg="#9a3412", fg="white", font=("",12,"bold"),
                  relief="flat", padx=16, pady=8, cursor="hand2",
                  command=self._save_recipe).pack(side="left", padx=4)
        tk.Button(btn_row, text="キャンセル", bg="#334155", fg="#e2e8f0",
                  relief="flat", padx=10, pady=8, cursor="hand2",
                  command=lambda: self.detail_nb.select(0)).pack(side="left", padx=4)

    # ── Logic ─────────────────────────────────────────
    def _filter_recipes(self):
        q    = self.search_var.get().lower()
        cat  = self.cat_var.get()
        diff = self.diff_var.get()
        fav  = self.fav_var.get()
        sort = self.sort_var.get()

        result = [r for r in self.recipes
                  if (not q or q in r['title'].lower() or q in r.get('description','').lower()
                      or any(q in t.lower() for t in r.get('tags',[])))
                  and (cat == "全て" or r.get('category') == cat)
                  and (diff == "全て" or r.get('difficulty') == diff)
                  and (not fav or r.get('favorite', False))]

        if sort == "評価":      result.sort(key=lambda r: -r.get('rating',0))
        elif sort == "調理時間": result.sort(key=lambda r: r.get('time_min',0))
        elif sort == "作成日":   result.sort(key=lambda r: r.get('created_at',''), reverse=True)
        else:                    result.sort(key=lambda r: r['title'])

        self.filtered_recipes = result
        self.count_var.set(f"{len(result)}件")
        self.recipe_tree.delete(*self.recipe_tree.get_children())
        for r in result:
            fav_mark = "★" if r.get('favorite') else ""
            stars = "⭐" * r.get('rating', 0)
            tags = ["favorite"] if r.get('favorite') else []
            self.recipe_tree.insert("", "end", iid=r['id'], tags=tags,
                values=(fav_mark, r['title'], f"{r.get('time_min','?')}分",
                        r.get('difficulty',''), stars))

    def _on_recipe_select(self, event=None):
        sel = self.recipe_tree.selection()
        if not sel: return
        self.current_recipe_id = sel[0]
        r = next((r for r in self.recipes if r['id'] == self.current_recipe_id), None)
        if r: self._show_recipe(r)

    def _on_recipe_dbl(self, event=None):
        self._on_recipe_select()
        self.detail_nb.select(1)
        self._load_edit_form()

    def _show_recipe(self, r):
        self.v_title.config(text=r['title'])
        cats = f"[{r.get('category','')}] {r.get('difficulty','')} · {r.get('time_min','?')}分 · {r.get('servings','?')}人前"
        tags = '  ' + ' '.join('#'+t for t in r.get('tags',[])) if r.get('tags') else ''
        self.v_meta.config(text=cats+tags)
        self.v_rating.config(text="⭐"*r.get('rating',0))
        self.v_fav_btn.config(text="★" if r.get('favorite') else "☆",
                               fg="#f97316" if r.get('favorite') else "#475569")
        self.v_desc.config(text=r.get('description',''))

        # Ingredients
        self.v_ing_text.config(state="normal"); self.v_ing_text.delete("1.0","end")
        for i, ing in enumerate(r.get('ingredients',[])):
            self.v_ing_text.insert("end", f"• {ing['name']}: {ing['amount']}\n")
        self.v_ing_text.config(state="disabled")

        # Steps
        self.v_steps_text.config(state="normal"); self.v_steps_text.delete("1.0","end")
        for i, step in enumerate(r.get('steps',[])):
            self.v_steps_text.insert("end", f"  {i+1}. {step}\n\n")
        if r.get('notes'):
            self.v_steps_text.insert("end", f"\n📝 メモ:\n{r['notes']}")
        self.v_steps_text.config(state="disabled")

    def _load_edit_form(self):
        if not self.current_recipe_id: return
        r = next((r for r in self.recipes if r['id'] == self.current_recipe_id), None)
        if not r: return
        self.e_title_var.set(r['title'])
        self.e_cat_var.set(r.get('category', CATEGORIES[0]))
        self.e_diff_var.set(r.get('difficulty', '普通'))
        self.e_time_var.set(r.get('time_min', 30))
        self.e_servings_var.set(r.get('servings', 2))
        self.e_rating_var.set(r.get('rating', 5))
        self.e_fav_var.set(r.get('favorite', False))
        self.e_tags_var.set(' '.join('#'+t for t in r.get('tags',[])))
        self.e_desc.delete("1.0","end"); self.e_desc.insert("1.0", r.get('description',''))
        ing_text = '\n'.join(f"{i['name']},{i['amount']}" for i in r.get('ingredients',[]))
        self.e_ing.delete("1.0","end"); self.e_ing.insert("1.0", ing_text)
        steps_text = '\n'.join(r.get('steps',[]))
        self.e_steps.delete("1.0","end"); self.e_steps.insert("1.0", steps_text)
        self.e_notes.delete("1.0","end"); self.e_notes.insert("1.0", r.get('notes',''))

    def _save_recipe(self):
        title = self.e_title_var.get().strip()
        if not title: messagebox.showerror("エラー","タイトルを入力してください"); return

        tags = re.findall(r'#(\w+)', self.e_tags_var.get())
        ingredients = []
        for line in self.e_ing.get("1.0","end-1c").split('\n'):
            line = line.strip()
            if ',' in line:
                name, *amount = line.split(',')
                ingredients.append({'name': name.strip(), 'amount': ','.join(amount).strip()})
            elif line:
                ingredients.append({'name': line, 'amount': ''})
        steps = [s.strip() for s in self.e_steps.get("1.0","end-1c").split('\n') if s.strip()]

        if self.current_recipe_id:
            r = next((r for r in self.recipes if r['id'] == self.current_recipe_id), None)
            if r:
                r.update({'title':title,'category':self.e_cat_var.get(),'difficulty':self.e_diff_var.get(),
                           'time_min':self.e_time_var.get(),'servings':self.e_servings_var.get(),
                           'rating':self.e_rating_var.get(),'favorite':self.e_fav_var.get(),
                           'tags':tags,'description':self.e_desc.get("1.0","end-1c").strip(),
                           'ingredients':ingredients,'steps':steps,
                           'notes':self.e_notes.get("1.0","end-1c").strip()})
        else:
            from datetime import date as _date
            new_r = {'id':str(uuid.uuid4()),'title':title,'category':self.e_cat_var.get(),
                     'difficulty':self.e_diff_var.get(),'time_min':self.e_time_var.get(),
                     'servings':self.e_servings_var.get(),'rating':self.e_rating_var.get(),
                     'favorite':self.e_fav_var.get(),'tags':tags,
                     'description':self.e_desc.get("1.0","end-1c").strip(),
                     'ingredients':ingredients,'steps':steps,
                     'notes':self.e_notes.get("1.0","end-1c").strip(),
                     'created_at':_date.today().isoformat()}
            self.recipes.insert(0, new_r)
            self.current_recipe_id = new_r['id']

        self._save()
        self._filter_recipes()
        r = next((r for r in self.recipes if r['id'] == self.current_recipe_id), None)
        if r: self._show_recipe(r)
        self.detail_nb.select(0)
        messagebox.showinfo("保存完了", f"「{title}」を保存しました")

    def _new_recipe(self):
        self.current_recipe_id = None
        for w in [self.e_title_var, self.e_tags_var]:
            w.set('')
        self.e_cat_var.set(CATEGORIES[0]); self.e_diff_var.set("普通")
        self.e_time_var.set(30); self.e_servings_var.set(2); self.e_rating_var.set(5)
        self.e_fav_var.set(False)
        for w in [self.e_desc, self.e_ing, self.e_steps, self.e_notes]:
            w.delete("1.0","end")
        self.detail_nb.select(1)

    def _delete_recipe(self):
        if not self.current_recipe_id: return
        r = next((r for r in self.recipes if r['id'] == self.current_recipe_id), None)
        if not r: return
        if messagebox.askyesno("確認", f"「{r['title']}」を削除しますか？"):
            self.recipes = [x for x in self.recipes if x['id'] != self.current_recipe_id]
            self.current_recipe_id = None
            self.v_title.config(text="レシピを選択してください")
            self._save(); self._filter_recipes()

    def _toggle_favorite(self, event=None):
        if not self.current_recipe_id: return
        r = next((r for r in self.recipes if r['id'] == self.current_recipe_id), None)
        if r:
            r['favorite'] = not r.get('favorite', False)
            self.v_fav_btn.config(text="★" if r['favorite'] else "☆",
                                   fg="#f97316" if r['favorite'] else "#475569")
            self._save(); self._filter_recipes()

    def _print_recipe(self):
        if not self.current_recipe_id: return
        r = next((r for r in self.recipes if r['id'] == self.current_recipe_id), None)
        if not r: return
        html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{{font-family:sans-serif;max-width:700px;margin:40px auto;color:#333}}
h1{{color:#c2410c;border-bottom:3px solid #c2410c;padding-bottom:8px}}
h2{{color:#7c3aed;margin-top:20px}}.meta{{color:#666;font-size:13px;margin:8px 0}}
.ing li{{line-height:1.8}}.step{{counter-increment:step;margin:10px 0;padding-left:30px;position:relative}}
.step::before{{content:counter(step);position:absolute;left:0;background:#c2410c;color:white;width:22px;height:22px;border-radius:50%;text-align:center;line-height:22px;font-weight:bold;font-size:12px}}
ol{{counter-reset:step;list-style:none;padding:0}}.note{{background:#fff7ed;padding:12px;border-left:4px solid #f97316;margin-top:16px}}
</style></head><body>
<h1>{r['title']}</h1>
<p class="meta">{r.get('category','')} · {r.get('difficulty','')} · {r.get('time_min','?')}分 · {r.get('servings','?')}人前 · ⭐{"★"*r.get('rating',0)}</p>
<p>{r.get('description','')}</p>
<h2>材料</h2><ul class="ing">
{''.join(f"<li>{i['name']}: {i['amount']}</li>" for i in r.get('ingredients',[]))}
</ul>
<h2>手順</h2><ol>
{''.join(f"<li class='step'>{s}</li>" for s in r.get('steps',[]))}
</ol>
{'<div class="note">📝 '+r["notes"]+'</div>' if r.get("notes") else ""}
</body></html>"""
        with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False, encoding='utf-8') as f:
            f.write(html); path = f.name
        webbrowser.open('file://' + path)


if __name__ == "__main__":
    app = RecipeManager()
    app.mainloop()
