#!/usr/bin/env python3
"""
Kanban Board Mac App — フル機能カンバンボード
複数ボード・カスタム列・ドラッグ並び替え（疑似）・期限・担当者・
優先度・ラベル・サブタスク・検索・統計。標準ライブラリのみ。
"""

import tkinter as tk
from tkinter import ttk, colorchooser, simpledialog, messagebox
import json
import uuid
from pathlib import Path
from datetime import date, datetime


DATA_FILE = Path.home() / ".kanban_mac.json"

PRIORITIES = {"🔴 高": "#ef4444", "🟡 中": "#f59e0b", "🔵 低": "#3b82f6", "⚪ なし": "#6b7280"}
DEFAULT_COLUMNS = ["To Do", "In Progress", "Review", "Done"]
LABEL_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#6366f1","#ec4899","#8b5cf6"]


class KanbanMac(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Kanban Board 🗂")
        self.geometry("1200x720")
        self.configure(bg="#0f172a")
        self.resizable(True, True)

        self.boards = []
        self.current_board_idx = 0
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._refresh_board())

        self._load()
        if not self.boards:
            self._create_default_board()
        self._build_ui()
        self._refresh_board()

    # ── Persistence ───────────────────────────────────
    def _load(self):
        if DATA_FILE.exists():
            try: self.boards = json.loads(DATA_FILE.read_text())
            except: self.boards = []

    def _save(self):
        DATA_FILE.write_text(json.dumps(self.boards, ensure_ascii=False, indent=2))

    def _board(self): return self.boards[self.current_board_idx]

    def _create_default_board(self):
        board = {
            "id": str(uuid.uuid4()), "name": "マイボード",
            "columns": [{"id": str(uuid.uuid4()), "name": col, "color": "#334155", "cards": []}
                        for col in DEFAULT_COLUMNS]
        }
        # Sample cards
        board["columns"][0]["cards"] = [
            {"id":str(uuid.uuid4()), "title":"プロジェクト計画書を作成", "desc":"要件定義から始める",
             "priority":"🔴 高", "due":"2026-07-01", "assignee":"田中", "labels":["#ef4444"],
             "subtasks":[{"text":"要件収集","done":False},{"text":"文書作成","done":False}],
             "created":date.today().isoformat()},
            {"id":str(uuid.uuid4()), "title":"デザインレビュー", "desc":"",
             "priority":"🟡 中", "due":"", "assignee":"佐藤", "labels":["#6366f1"],
             "subtasks":[], "created":date.today().isoformat()},
        ]
        board["columns"][1]["cards"] = [
            {"id":str(uuid.uuid4()), "title":"APIエンドポイント実装", "desc":"REST API開発",
             "priority":"🔴 高", "due":"2026-06-30", "assignee":"山田", "labels":["#22c55e","#06b6d4"],
             "subtasks":[{"text":"設計","done":True},{"text":"実装","done":False},{"text":"テスト","done":False}],
             "created":date.today().isoformat()},
        ]
        self.boards = [board]
        self._save()

    # ── UI ────────────────────────────────────────────
    def _build_ui(self):
        s = ttk.Style(self); s.theme_use("clam")
        BG="#0f172a"; CARD="#1e293b"; FG="#e2e8f0"; FG2="#94a3b8"; BORDER="#334155"
        s.configure(".", background=BG, foreground=FG, fieldbackground=CARD)
        s.configure("TFrame", background=BG); s.configure("TLabel", background=BG, foreground=FG)
        s.configure("TButton", background=BORDER, foreground=FG, padding=5)
        s.map("TButton", background=[("active","#475569")])
        s.configure("TEntry", fieldbackground=CARD, foreground=FG, insertcolor=FG)
        s.configure("TCombobox", fieldbackground=CARD, foreground=FG)
        s.configure("TScrollbar", background=CARD, troughcolor=BG)
        s.configure("TCheckbutton", background=CARD, foreground=FG)

        # ── Top bar ──
        top = tk.Frame(self, bg="#0f172a")
        top.pack(fill="x", padx=12, pady=(8,4))

        # Board selector
        self.board_var = tk.StringVar()
        self.board_combo = ttk.Combobox(top, textvariable=self.board_var, state="readonly", width=18)
        self.board_combo.pack(side="left", padx=4)
        self.board_combo.bind("<<ComboboxSelected>>", self._on_board_select)

        for text, cmd in [("＋ ボード", self._new_board), ("✏ 名前変更", self._rename_board), ("🗑 削除", self._delete_board)]:
            ttk.Button(top, text=text, command=cmd).pack(side="left", padx=2)

        tk.Frame(top, bg="#334155", width=1, height=24).pack(side="left", padx=8, pady=2)

        ttk.Button(top, text="＋ 列を追加", command=self._add_column).pack(side="left", padx=2)

        # Search
        tk.Label(top, text="🔍", bg="#0f172a", fg="#94a3b8").pack(side="left", padx=(16,4))
        ttk.Entry(top, textvariable=self.search_var, width=18).pack(side="left")

        # Stats
        self.stats_var = tk.StringVar(value="")
        tk.Label(top, textvariable=self.stats_var, bg="#0f172a", fg="#64748b", font=("",10)).pack(side="right", padx=10)

        # ── Board area (scrollable) ──
        self.board_frame_outer = tk.Frame(self, bg="#0f172a")
        self.board_frame_outer.pack(fill="both", expand=True)

        self.h_scroll = ttk.Scrollbar(self.board_frame_outer, orient="horizontal")
        self.h_scroll.pack(side="bottom", fill="x")
        self.v_scroll = ttk.Scrollbar(self.board_frame_outer, orient="vertical")
        self.v_scroll.pack(side="right", fill="y")

        self.board_canvas = tk.Canvas(self.board_frame_outer, bg="#0f172a",
                                       xscrollcommand=self.h_scroll.set,
                                       yscrollcommand=self.v_scroll.set,
                                       bd=0, highlightthickness=0)
        self.board_canvas.pack(fill="both", expand=True)
        self.h_scroll.config(command=self.board_canvas.xview)
        self.v_scroll.config(command=self.board_canvas.yview)

        self.board_inner = tk.Frame(self.board_canvas, bg="#0f172a")
        self.board_canvas.create_window(0, 0, anchor="nw", window=self.board_inner)
        self.board_inner.bind("<Configure>",
            lambda e: self.board_canvas.configure(scrollregion=self.board_canvas.bbox("all")))

        self._update_board_combo()

    def _update_board_combo(self):
        names = [b["name"] for b in self.boards]
        self.board_combo["values"] = names
        if self.boards:
            self.board_var.set(self.boards[self.current_board_idx]["name"])

    # ── Board rendering ───────────────────────────────
    def _refresh_board(self):
        for w in self.board_inner.winfo_children(): w.destroy()
        if not self.boards: return

        board = self._board()
        q = self.search_var.get().lower()
        total_cards = sum(len(col["cards"]) for col in board["columns"])
        done_col = next((col for col in board["columns"] if col["name"].lower() in ["done","完了","済"]), None)
        done_cards = len(done_col["cards"]) if done_col else 0
        self.stats_var.set(f"カード: {total_cards}  完了: {done_cards}  進行中: {total_cards-done_cards}")

        for col_idx, col in enumerate(board["columns"]):
            self._render_column(col_idx, col, q)

    def _render_column(self, col_idx, col, q=""):
        col_frame = tk.Frame(self.board_inner, bg="#1e293b", width=280,
                             bd=1, relief="solid", highlightbackground="#334155", highlightthickness=1)
        col_frame.pack(side="left", fill="y", padx=6, pady=8, anchor="n")
        col_frame.pack_propagate(False)

        # Column header
        header = tk.Frame(col_frame, bg=col.get("color","#334155"), height=38)
        header.pack(fill="x"); header.pack_propagate(False)

        card_count = len([c for c in col["cards"] if not q or q in c["title"].lower() or q in c.get("desc","").lower()])
        tk.Label(header, text=f"{col['name']}  {card_count}",
                 font=("",12,"bold"), bg=col.get("color","#334155"), fg="#f1f5f9",
                 padx=10).pack(side="left", pady=6)

        # Column menu button
        menu_btn = tk.Label(header, text="⋯", font=("",14), bg=col.get("color","#334155"),
                            fg="#94a3b8", cursor="hand2", padx=8)
        menu_btn.pack(side="right", pady=4)
        menu_btn.bind("<Button-1>", lambda e, ci=col_idx: self._col_menu(e, ci))

        # Scrollable cards area
        cards_outer = tk.Frame(col_frame, bg="#1e293b")
        cards_outer.pack(fill="both", expand=True)

        col_scroll = ttk.Scrollbar(cards_outer, orient="vertical")
        col_scroll.pack(side="right", fill="y")

        col_canvas = tk.Canvas(cards_outer, bg="#1e293b", bd=0, highlightthickness=0,
                                yscrollcommand=col_scroll.set)
        col_canvas.pack(fill="both", expand=True, padx=4, pady=4)
        col_scroll.config(command=col_canvas.yview)

        cards_frame = tk.Frame(col_canvas, bg="#1e293b")
        col_canvas.create_window(0, 0, anchor="nw", window=cards_frame)
        cards_frame.bind("<Configure>",
            lambda e, c=col_canvas: c.configure(scrollregion=c.bbox("all")))
        col_canvas.bind("<MouseWheel>", lambda e, c=col_canvas: c.yview_scroll(-1 if e.delta>0 else 1, "units"))

        # Render cards
        filtered_cards = [c for c in col["cards"] if not q or q in c["title"].lower() or q in c.get("desc","").lower() or q in c.get("assignee","").lower()]
        for card_idx, card in enumerate(filtered_cards):
            self._render_card(cards_frame, col_idx, card_idx, card)

        # Add card button
        add_btn = tk.Button(col_frame, text="＋ カードを追加", bg="#1e293b", fg="#475569",
                            relief="flat", pady=6, cursor="hand2",
                            command=lambda ci=col_idx: self._add_card(ci))
        add_btn.pack(fill="x", padx=4, pady=4)
        add_btn.bind("<Enter>", lambda e: e.widget.config(fg="#94a3b8"))
        add_btn.bind("<Leave>", lambda e: e.widget.config(fg="#475569"))

    def _render_card(self, parent, col_idx, card_idx, card):
        today_str = date.today().isoformat()
        is_overdue = card.get("due") and card["due"] < today_str and not self._is_done_col(col_idx)
        border_color = "#ef4444" if is_overdue else "#334155"

        card_frame = tk.Frame(parent, bg="#0f172a", bd=1, relief="solid",
                              highlightbackground=border_color, highlightthickness=1,
                              cursor="hand2")
        card_frame.pack(fill="x", padx=2, pady=3)

        # Labels
        if card.get("labels"):
            label_row = tk.Frame(card_frame, bg="#0f172a")
            label_row.pack(fill="x", padx=6, pady=(5,0))
            for color in card["labels"]:
                tk.Label(label_row, bg=color, width=5, height=1).pack(side="left", padx=1)

        # Title
        title_lbl = tk.Label(card_frame, text=card["title"], font=("",11,"bold"),
                              bg="#0f172a", fg="#e2e8f0", wraplength=240, justify="left", anchor="w")
        title_lbl.pack(fill="x", padx=8, pady=(5,2))

        # Description (first line)
        if card.get("desc"):
            tk.Label(card_frame, text=card["desc"][:60]+("..." if len(card["desc"])>60 else ""),
                     font=("",10), bg="#0f172a", fg="#64748b", wraplength=240, justify="left", anchor="w"
                     ).pack(fill="x", padx=8)

        # Subtask progress
        if card.get("subtasks"):
            done_sub = sum(1 for st in card["subtasks"] if st["done"])
            total_sub = len(card["subtasks"])
            prog_frame = tk.Frame(card_frame, bg="#0f172a")
            prog_frame.pack(fill="x", padx=8, pady=2)
            tk.Label(prog_frame, text=f"☑ {done_sub}/{total_sub}", font=("",9),
                     bg="#0f172a", fg="#64748b").pack(side="left")
            bar_bg = tk.Frame(prog_frame, bg="#1e293b", height=4)
            bar_bg.pack(side="left", fill="x", expand=True, padx=6)
            if total_sub > 0:
                tk.Frame(bar_bg, bg="#22c55e" if done_sub==total_sub else "#3b82f6",
                         height=4, width=int(100*(done_sub/total_sub))).place(x=0,y=0)

        # Meta row
        meta_row = tk.Frame(card_frame, bg="#0f172a")
        meta_row.pack(fill="x", padx=8, pady=(3,6))

        # Priority
        pri_color = PRIORITIES.get(card.get("priority",""), "#6b7280")
        if card.get("priority") and card["priority"] != "⚪ なし":
            tk.Label(meta_row, text=card["priority"].split()[0], font=("",10),
                     bg="#0f172a", fg=pri_color).pack(side="left", padx=1)

        # Due date
        if card.get("due"):
            due_color = "#ef4444" if is_overdue else "#64748b"
            tk.Label(meta_row, text=f"📅{card['due'][5:]}", font=("",9),
                     bg="#0f172a", fg=due_color).pack(side="left", padx=3)

        # Assignee
        if card.get("assignee"):
            tk.Label(meta_row, text=f"👤{card['assignee']}", font=("",9),
                     bg="#0f172a", fg="#64748b").pack(side="right", padx=2)

        # Click to edit
        for w in [card_frame, title_lbl]:
            w.bind("<Button-1>", lambda e, ci=col_idx, ci2=card_idx: self._edit_card(ci, ci2))
        # Right click menu
        card_frame.bind("<Button-3>", lambda e, ci=col_idx, ci2=card_idx: self._card_context_menu(e, ci, ci2))

    def _is_done_col(self, col_idx):
        col = self._board()["columns"][col_idx]
        return col["name"].lower() in ["done","完了","済","finished"]

    # ── Card operations ───────────────────────────────
    def _add_card(self, col_idx):
        title = simpledialog.askstring("カードを追加", "タイトル:", parent=self)
        if not title or not title.strip(): return
        card = {"id": str(uuid.uuid4()), "title": title.strip(), "desc": "",
                "priority": "⚪ なし", "due": "", "assignee": "", "labels": [],
                "subtasks": [], "created": date.today().isoformat()}
        self._board()["columns"][col_idx]["cards"].append(card)
        self._save(); self._refresh_board()

    def _edit_card(self, col_idx, card_idx):
        board = self._board()
        cards = board["columns"][col_idx]["cards"]
        if card_idx >= len(cards): return
        card = cards[card_idx]

        dlg = tk.Toplevel(self)
        dlg.title("カードを編集"); dlg.configure(bg="#1e293b"); dlg.grab_set()
        dlg.geometry("480x640")

        def lbl(text):
            tk.Label(dlg, text=text, bg="#1e293b", fg="#94a3b8", font=("",10)).pack(anchor="w", padx=14, pady=(8,2))

        lbl("タイトル")
        title_var = tk.StringVar(value=card["title"])
        ttk.Entry(dlg, textvariable=title_var, width=50).pack(fill="x", padx=14)

        lbl("説明")
        desc_txt = tk.Text(dlg, bg="#0f172a", fg="#e2e8f0", insertbackground="#e2e8f0",
                           relief="flat", bd=1, font=("",11), height=3, padx=6, pady=4)
        desc_txt.pack(fill="x", padx=14, pady=2)
        desc_txt.insert("1.0", card.get("desc",""))

        grid = tk.Frame(dlg, bg="#1e293b"); grid.pack(fill="x", padx=14, pady=4)
        tk.Label(grid, text="優先度:", bg="#1e293b", fg="#94a3b8", font=("",10)).grid(row=0, column=0, sticky="w", pady=3)
        pri_var = tk.StringVar(value=card.get("priority","⚪ なし"))
        ttk.Combobox(grid, textvariable=pri_var, values=list(PRIORITIES.keys()), state="readonly", width=12).grid(row=0, column=1, sticky="ew", padx=6)

        tk.Label(grid, text="期限:", bg="#1e293b", fg="#94a3b8", font=("",10)).grid(row=1, column=0, sticky="w", pady=3)
        due_var = tk.StringVar(value=card.get("due",""))
        ttk.Entry(grid, textvariable=due_var, width=14).grid(row=1, column=1, sticky="ew", padx=6)

        tk.Label(grid, text="担当者:", bg="#1e293b", fg="#94a3b8", font=("",10)).grid(row=2, column=0, sticky="w", pady=3)
        assignee_var = tk.StringVar(value=card.get("assignee",""))
        ttk.Entry(grid, textvariable=assignee_var, width=14).grid(row=2, column=1, sticky="ew", padx=6)

        tk.Label(grid, text="列を移動:", bg="#1e293b", fg="#94a3b8", font=("",10)).grid(row=3, column=0, sticky="w", pady=3)
        col_names = [c["name"] for c in board["columns"]]
        move_var = tk.StringVar(value=board["columns"][col_idx]["name"])
        ttk.Combobox(grid, textvariable=move_var, values=col_names, state="readonly", width=12).grid(row=3, column=1, sticky="ew", padx=6)
        grid.columnconfigure(1, weight=1)

        lbl("サブタスク")
        sub_frame = tk.Frame(dlg, bg="#1e293b"); sub_frame.pack(fill="x", padx=14)
        sub_vars = []

        def render_subtasks():
            for w in sub_frame.winfo_children(): w.destroy()
            for i, st in enumerate(card["subtasks"]):
                r = tk.Frame(sub_frame, bg="#1e293b"); r.pack(fill="x", pady=1)
                v = tk.BooleanVar(value=st["done"]); sub_vars.append(v)
                tk.Checkbutton(r, text=st["text"], variable=v, bg="#1e293b", fg="#e2e8f0",
                               selectcolor="#0f172a", font=("",10)).pack(side="left")
                tk.Button(r, text="×", bg="#1e293b", fg="#64748b", relief="flat", font=("",10),
                          command=lambda i=i: (card["subtasks"].pop(i), render_subtasks())).pack(side="right")

        render_subtasks()

        sub_add_row = tk.Frame(dlg, bg="#1e293b"); sub_add_row.pack(fill="x", padx=14, pady=4)
        sub_entry = ttk.Entry(sub_add_row, width=30); sub_entry.pack(side="left")
        def add_subtask():
            t = sub_entry.get().strip()
            if t: card["subtasks"].append({"text":t,"done":False}); sub_entry.delete(0,"end"); render_subtasks()
        tk.Button(sub_add_row, text="追加", bg="#0369a1", fg="white", relief="flat", padx=8,
                  command=add_subtask).pack(side="left", padx=4)
        sub_entry.bind("<Return>", lambda _: add_subtask())

        def save_card():
            for i, v in enumerate(sub_vars):
                if i < len(card["subtasks"]): card["subtasks"][i]["done"] = v.get()
            card["title"] = title_var.get().strip() or card["title"]
            card["desc"] = desc_txt.get("1.0","end-1c").strip()
            card["priority"] = pri_var.get()
            card["due"] = due_var.get().strip()
            card["assignee"] = assignee_var.get().strip()
            # Move column
            new_col_name = move_var.get()
            new_col_idx = next((i for i,c in enumerate(board["columns"]) if c["name"]==new_col_name), col_idx)
            if new_col_idx != col_idx:
                cards.pop(card_idx)
                board["columns"][new_col_idx]["cards"].append(card)
            self._save(); self._refresh_board(); dlg.destroy()

        def delete_card():
            if messagebox.askyesno("確認","このカードを削除しますか？",parent=dlg):
                cards.pop(card_idx); self._save(); self._refresh_board(); dlg.destroy()

        btn_row = tk.Frame(dlg, bg="#1e293b"); btn_row.pack(fill="x", padx=14, pady=10)
        tk.Button(btn_row, text="💾 保存", bg="#0369a1", fg="white", relief="flat", padx=14, pady=7,
                  command=save_card).pack(side="left", padx=3)
        tk.Button(btn_row, text="🗑 削除", bg="#7f1d1d", fg="#fca5a5", relief="flat", padx=10, pady=7,
                  command=delete_card).pack(side="left", padx=3)
        tk.Button(btn_row, text="キャンセル", bg="#334155", fg="#e2e8f0", relief="flat", padx=10, pady=7,
                  command=dlg.destroy).pack(side="left", padx=3)

    def _card_context_menu(self, event, col_idx, card_idx):
        menu = tk.Menu(self, tearoff=False, bg="#1e293b", fg="#e2e8f0",
                       activebackground="#334155", activeforeground="#e2e8f0")
        # Move to columns
        board = self._board()
        for i, col in enumerate(board["columns"]):
            if i != col_idx:
                menu.add_command(label=f"→ {col['name']}へ移動",
                                 command=lambda src=col_idx, ci2=card_idx, dst=i: self._move_card(src, ci2, dst))
        menu.add_separator()
        menu.add_command(label="✏ 編集", command=lambda: self._edit_card(col_idx, card_idx))
        menu.add_command(label="🗑 削除", command=lambda: self._delete_card(col_idx, card_idx))
        menu.post(event.x_root, event.y_root)

    def _move_card(self, src_col, card_idx, dst_col):
        board = self._board()
        card = board["columns"][src_col]["cards"].pop(card_idx)
        board["columns"][dst_col]["cards"].append(card)
        self._save(); self._refresh_board()

    def _delete_card(self, col_idx, card_idx):
        if messagebox.askyesno("確認", "このカードを削除しますか？"):
            self._board()["columns"][col_idx]["cards"].pop(card_idx)
            self._save(); self._refresh_board()

    # ── Column operations ─────────────────────────────
    def _col_menu(self, event, col_idx):
        menu = tk.Menu(self, tearoff=False, bg="#1e293b", fg="#e2e8f0",
                       activebackground="#334155", activeforeground="#e2e8f0")
        menu.add_command(label="✏ 列名変更", command=lambda: self._rename_column(col_idx))
        menu.add_command(label="🎨 色変更", command=lambda: self._change_col_color(col_idx))
        menu.add_command(label="← 左へ移動", command=lambda: self._move_column(col_idx, -1))
        menu.add_command(label="→ 右へ移動", command=lambda: self._move_column(col_idx, 1))
        menu.add_separator()
        menu.add_command(label="🗑 列を削除", command=lambda: self._delete_column(col_idx))
        menu.post(event.x_root, event.y_root)

    def _add_column(self):
        name = simpledialog.askstring("列を追加", "列名:", parent=self)
        if not name: return
        self._board()["columns"].append({"id":str(uuid.uuid4()),"name":name,"color":"#334155","cards":[]})
        self._save(); self._refresh_board()

    def _rename_column(self, col_idx):
        col = self._board()["columns"][col_idx]
        new = simpledialog.askstring("列名変更", "新しい列名:", initialvalue=col["name"], parent=self)
        if new: col["name"] = new; self._save(); self._refresh_board()

    def _change_col_color(self, col_idx):
        col = self._board()["columns"][col_idx]
        result = colorchooser.askcolor(color=col.get("color","#334155"), parent=self)
        if result[1]: col["color"] = result[1]; self._save(); self._refresh_board()

    def _move_column(self, col_idx, delta):
        cols = self._board()["columns"]
        new_idx = col_idx + delta
        if 0 <= new_idx < len(cols):
            cols[col_idx], cols[new_idx] = cols[new_idx], cols[col_idx]
            self._save(); self._refresh_board()

    def _delete_column(self, col_idx):
        col = self._board()["columns"][col_idx]
        if col["cards"] and not messagebox.askyesno("確認", f"「{col['name']}」と{len(col['cards'])}枚のカードを削除しますか？"):
            return
        self._board()["columns"].pop(col_idx)
        self._save(); self._refresh_board()

    # ── Board operations ──────────────────────────────
    def _new_board(self):
        name = simpledialog.askstring("新規ボード", "ボード名:", parent=self)
        if not name: return
        board = {"id":str(uuid.uuid4()), "name":name,
                 "columns":[{"id":str(uuid.uuid4()),"name":c,"color":"#334155","cards":[]}
                             for c in DEFAULT_COLUMNS]}
        self.boards.append(board)
        self.current_board_idx = len(self.boards)-1
        self._save(); self._update_board_combo(); self._refresh_board()

    def _rename_board(self):
        new = simpledialog.askstring("名前変更", "新しいボード名:", initialvalue=self._board()["name"], parent=self)
        if new: self._board()["name"] = new; self._save(); self._update_board_combo()

    def _delete_board(self):
        if len(self.boards) <= 1: messagebox.showinfo("情報","最後のボードは削除できません"); return
        if messagebox.askyesno("確認", f"「{self._board()['name']}」を削除しますか？"):
            self.boards.pop(self.current_board_idx)
            self.current_board_idx = max(0, self.current_board_idx-1)
            self._save(); self._update_board_combo(); self._refresh_board()

    def _on_board_select(self, event=None):
        name = self.board_var.get()
        idx = next((i for i,b in enumerate(self.boards) if b["name"]==name), 0)
        self.current_board_idx = idx; self._refresh_board()


if __name__ == "__main__":
    app = KanbanMac()
    app.mainloop()
