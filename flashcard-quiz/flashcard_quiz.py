#!/usr/bin/env python3
"""
Flashcard Quiz — 間隔反復学習フラッシュカードアプリ
デッキ管理・カード作成・SRS(Spaced Repetition)ベースの学習。標準ライブラリのみ。
"""

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import json
import random
from pathlib import Path
from datetime import date, timedelta


DATA_FILE = Path.home() / ".flashcard_quiz.json"


def today_str() -> str:
    return date.today().isoformat()


class FlashcardApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Flashcard Quiz 🃏")
        self.geometry("800x580")
        self.configure(bg="#0d0d1a")
        self.resizable(True, True)

        self.data = {"decks": []}
        self.current_deck_idx = None
        self.quiz_cards = []
        self.quiz_idx = 0
        self.show_answer = False
        self.session_correct = 0
        self.session_total = 0

        self._load()
        self._build_ui()

    # ── Persistence ──────────────────────────────────
    def _load(self):
        if DATA_FILE.exists():
            try: self.data = json.loads(DATA_FILE.read_text())
            except: pass

    def _save(self):
        DATA_FILE.write_text(json.dumps(self.data, ensure_ascii=False, indent=2))

    # ── UI ───────────────────────────────────────────
    def _build_ui(self):
        s = ttk.Style(self); s.theme_use("clam")
        BG="#0d0d1a"; CARD="#1a1a2e"; FG="#e0e0f0"; FG2="#6b7280"; BORDER="#2d2d4e"; ACC="#818cf8"
        for k,v in [(".",{"background":BG,"foreground":FG}),("TFrame",{"background":BG}),
                    ("TLabel",{"background":BG,"foreground":FG}),
                    ("TButton",{"background":"#2d2d4e","foreground":FG,"padding":6}),
                    ("TEntry",{"fieldbackground":CARD,"foreground":FG,"insertcolor":FG}),
                    ("Treeview",{"background":CARD,"foreground":FG,"fieldbackground":CARD,"rowheight":26}),
                    ("Treeview.Heading",{"background":BORDER,"foreground":FG2}),
                    ("TNotebook",{"background":BG}),("TNotebook.Tab",{"background":CARD,"foreground":FG2,"padding":[12,5]})]:
            s.configure(k,**v)
        s.map("TButton",background=[("active","#3d3d6e")])
        s.map("Treeview",background=[("selected","#3b2f6e")])
        s.map("TNotebook.Tab",background=[("selected","#2d2d4e")],foreground=[("selected",FG)])

        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True, padx=8, pady=8)

        # ── Tab 1: Decks ──
        self.deck_tab = tk.Frame(nb, bg=BG)
        nb.add(self.deck_tab, text="📚 デッキ")
        self._build_deck_tab()

        # ── Tab 2: Cards ──
        self.cards_tab = tk.Frame(nb, bg=BG)
        nb.add(self.cards_tab, text="🃏 カード")
        self._build_cards_tab()

        # ── Tab 3: Quiz ──
        self.quiz_tab = tk.Frame(nb, bg=BG)
        nb.add(self.quiz_tab, text="📝 クイズ")
        self._build_quiz_tab()

        self.nb = nb
        nb.bind("<<NotebookTabChanged>>", self._on_tab_change)

    # ── Deck Tab ─────────────────────────────────────
    def _build_deck_tab(self):
        top = ttk.Frame(self.deck_tab)
        top.pack(fill="x", padx=10, pady=(10,6))
        tk.Label(top, text="デッキ一覧", font=("",13,"bold"), bg="#0d0d1a", fg="#818cf8").pack(side="left")
        ttk.Button(top, text="+ 新規デッキ", command=self._add_deck).pack(side="right")

        cols = ("デッキ名","カード数","要復習","最終学習")
        self.deck_tree = ttk.Treeview(self.deck_tab, columns=cols, show="headings", height=16)
        for col, w in zip(cols, [200,80,80,120]):
            self.deck_tree.heading(col, text=col)
            self.deck_tree.column(col, width=w)
        vsb = ttk.Scrollbar(self.deck_tab, orient="vertical", command=self.deck_tree.yview)
        self.deck_tree.configure(yscrollcommand=vsb.set)
        self.deck_tree.pack(side="left", fill="both", expand=True, padx=(10,0), pady=4)
        vsb.pack(side="right", fill="y", pady=4, padx=(0,6))

        self.deck_tree.bind("<Double-1>", self._select_deck_for_cards)

        btn_row = ttk.Frame(self.deck_tab)
        btn_row.pack(fill="x", padx=10, pady=4)
        ttk.Button(btn_row, text="✏ 名前変更", command=self._rename_deck).pack(side="left", padx=2)
        ttk.Button(btn_row, text="🗑 削除", command=self._delete_deck).pack(side="left", padx=2)
        ttk.Button(btn_row, text="📝 このデッキを学習", command=self._start_quiz_selected).pack(side="right")

        self._refresh_deck_list()

    def _refresh_deck_list(self):
        self.deck_tree.delete(*self.deck_tree.get_children())
        for i, deck in enumerate(self.data["decks"]):
            cards = deck.get("cards", [])
            due = sum(1 for c in cards if c.get("next_review","") <= today_str())
            last = deck.get("last_studied","—")
            self.deck_tree.insert("", "end", iid=str(i),
                                   values=(deck["name"], len(cards), due, last))

    def _add_deck(self):
        name = simpledialog.askstring("新規デッキ", "デッキ名:", parent=self)
        if name and name.strip():
            self.data["decks"].append({"name": name.strip(), "cards": []})
            self._save(); self._refresh_deck_list()

    def _rename_deck(self):
        sel = self.deck_tree.selection()
        if not sel: return
        idx = int(sel[0]); deck = self.data["decks"][idx]
        new = simpledialog.askstring("名前変更", "新しいデッキ名:", initialvalue=deck["name"], parent=self)
        if new and new.strip():
            deck["name"] = new.strip(); self._save(); self._refresh_deck_list()

    def _delete_deck(self):
        sel = self.deck_tree.selection()
        if not sel: return
        idx = int(sel[0])
        if not messagebox.askyesno("確認", f"デッキ「{self.data['decks'][idx]['name']}」を削除しますか？"): return
        self.data["decks"].pop(idx); self._save(); self._refresh_deck_list()

    def _select_deck_for_cards(self, event=None):
        sel = self.deck_tree.selection()
        if not sel: return
        self.current_deck_idx = int(sel[0])
        self._refresh_cards_list()
        self.nb.select(1)

    def _start_quiz_selected(self):
        sel = self.deck_tree.selection()
        if not sel: return
        self.current_deck_idx = int(sel[0])
        self._init_quiz(); self.nb.select(2)

    # ── Cards Tab ────────────────────────────────────
    def _build_cards_tab(self):
        top = ttk.Frame(self.cards_tab)
        top.pack(fill="x", padx=10, pady=(10,4))
        self.deck_label = tk.Label(top, text="デッキを選択してください", font=("",12,"bold"),
                                    bg="#0d0d1a", fg="#818cf8")
        self.deck_label.pack(side="left")
        ttk.Button(top, text="+ カード追加", command=self._add_card).pack(side="right")

        # Add form
        form = tk.LabelFrame(self.cards_tab, text="カードを追加", bg="#1a1a2e", fg="#6b7280",
                              font=("",10), bd=1, relief="solid", padx=10, pady=8)
        form.pack(fill="x", padx=10, pady=4)

        for row_i, (lbl, attr) in enumerate([("表面（問題）","front_var"),("裏面（答え）","back_var")]):
            tk.Label(form, text=lbl, font=("",10), bg="#1a1a2e", fg="#6b7280").grid(
                row=row_i, column=0, sticky="w", padx=4, pady=4)
            setattr(self, attr, tk.StringVar())
            ttk.Entry(form, textvariable=getattr(self, attr), width=50).grid(
                row=row_i, column=1, sticky="ew", padx=4, pady=4)

        form.columnconfigure(1, weight=1)
        tk.Button(form, text="追加", bg="#3730a3", fg="white", font=("",11),
                  relief="flat", padx=10, pady=4, cursor="hand2",
                  command=self._add_card).grid(row=2, column=1, sticky="e", pady=4)

        # Card list
        cols = ("表面","裏面","復習回数","次の復習")
        self.card_tree = ttk.Treeview(self.cards_tab, columns=cols, show="headings", height=12)
        for col, w in zip(cols, [200,200,70,100]):
            self.card_tree.heading(col, text=col)
            self.card_tree.column(col, width=w)
        vsb2 = ttk.Scrollbar(self.cards_tab, orient="vertical", command=self.card_tree.yview)
        self.card_tree.configure(yscrollcommand=vsb2.set)

        lf = tk.Frame(self.cards_tab, bg="#0d0d1a")
        lf.pack(fill="both", expand=True, padx=10, pady=4)
        self.card_tree.pack(side="left", fill="both", expand=True)
        vsb2.pack(side="right", fill="y")

        btn_row2 = ttk.Frame(self.cards_tab)
        btn_row2.pack(fill="x", padx=10, pady=4)
        ttk.Button(btn_row2, text="🗑 カードを削除", command=self._delete_card).pack(side="left")
        ttk.Button(btn_row2, text="📝 このデッキを学習", command=lambda: (self._init_quiz(), self.nb.select(2))).pack(side="right")

    def _refresh_cards_list(self):
        if self.current_deck_idx is None: return
        deck = self.data["decks"][self.current_deck_idx]
        self.deck_label.config(text=f"デッキ: {deck['name']}")
        self.card_tree.delete(*self.card_tree.get_children())
        for i, c in enumerate(deck.get("cards", [])):
            self.card_tree.insert("", "end", iid=str(i),
                                   values=(c["front"][:30], c["back"][:30],
                                           c.get("reps", 0), c.get("next_review","未学習")))

    def _add_card(self):
        if self.current_deck_idx is None:
            messagebox.showinfo("情報","まずデッキを選んでください"); return
        front = self.front_var.get().strip()
        back  = self.back_var.get().strip()
        if not front or not back:
            messagebox.showerror("エラー","表面と裏面を入力してください"); return
        deck = self.data["decks"][self.current_deck_idx]
        deck["cards"].append({"front": front, "back": back, "reps": 0,
                               "ef": 2.5, "interval": 1,
                               "next_review": today_str()})
        self.front_var.set(""); self.back_var.set("")
        self._save(); self._refresh_cards_list(); self._refresh_deck_list()

    def _delete_card(self):
        sel = self.card_tree.selection()
        if not sel: return
        idx = int(sel[0])
        deck = self.data["decks"][self.current_deck_idx]
        deck["cards"].pop(idx)
        self._save(); self._refresh_cards_list(); self._refresh_deck_list()

    # ── Quiz Tab ─────────────────────────────────────
    def _build_quiz_tab(self):
        self.quiz_header = tk.Label(self.quiz_tab, text="デッキを選んで学習を始めてください",
                                     font=("",13,"bold"), bg="#0d0d1a", fg="#818cf8")
        self.quiz_header.pack(pady=(16,6))

        self.progress_var = tk.DoubleVar()
        self.quiz_progress = ttk.Progressbar(self.quiz_tab, variable=self.progress_var, maximum=100)
        self.quiz_progress.pack(fill="x", padx=20, pady=4)

        self.quiz_stats_label = tk.Label(self.quiz_tab, text="", font=("",10), bg="#0d0d1a", fg="#6b7280")
        self.quiz_stats_label.pack()

        # Card display
        self.card_frame = tk.Frame(self.quiz_tab, bg="#1a1a2e", bd=1, relief="solid")
        self.card_frame.pack(fill="both", expand=True, padx=20, pady=8)

        self.card_front_lbl = tk.Label(self.card_frame, text="", font=("",20,"bold"),
                                        bg="#1a1a2e", fg="#e0e0f0", wraplength=550)
        self.card_front_lbl.pack(expand=True, pady=(30,10))

        self.separator = tk.Frame(self.card_frame, bg="#2d2d4e", height=1)

        self.card_back_lbl = tk.Label(self.card_frame, text="", font=("",16),
                                       bg="#1a1a2e", fg="#818cf8", wraplength=550)
        self.card_back_lbl.pack(expand=True, pady=(10,30))

        # Buttons
        btn_area = tk.Frame(self.quiz_tab, bg="#0d0d1a")
        btn_area.pack(fill="x", padx=20, pady=8)

        self.show_btn = tk.Button(btn_area, text="答えを見る (Space)",
                                   bg="#312e81", fg="white", font=("",13,"bold"),
                                   relief="flat", padx=20, pady=10, cursor="hand2",
                                   command=self._show_answer)
        self.show_btn.pack()

        self.rating_frame = tk.Frame(btn_area, bg="#0d0d1a")
        ratings = [("❌ 不正解\n(1)", 1, "#7f1d1d", "#f87171"),
                   ("😕 難しい\n(2)", 2, "#422006", "#fb923c"),
                   ("✅ 正解\n(3)", 3, "#14532d", "#4ade80"),
                   ("⚡ 簡単\n(4)", 4, "#1e3a5f", "#60a5fa")]
        for label, score, bg2, fg2 in ratings:
            tk.Button(self.rating_frame, text=label, bg=bg2, fg=fg2,
                      font=("",11), relief="flat", padx=16, pady=8,
                      cursor="hand2", width=8,
                      command=lambda s=score: self._rate(s)).pack(side="left", padx=4)

        self.quiz_done_frame = tk.Frame(self.quiz_tab, bg="#0d0d1a")
        self.done_label = tk.Label(self.quiz_done_frame, text="", font=("",14),
                                    bg="#0d0d1a", fg="#4ade80")
        self.done_label.pack(pady=10)
        ttk.Button(self.quiz_done_frame, text="もう一度", command=self._init_quiz).pack(pady=4)

        self.bind("<space>", lambda e: self._show_answer() if not self.show_answer else None)
        self.bind("1", lambda e: self._rate(1) if self.show_answer else None)
        self.bind("2", lambda e: self._rate(2) if self.show_answer else None)
        self.bind("3", lambda e: self._rate(3) if self.show_answer else None)
        self.bind("4", lambda e: self._rate(4) if self.show_answer else None)

    def _init_quiz(self):
        if self.current_deck_idx is None:
            messagebox.showinfo("情報","デッキを選んでください"); return
        deck = self.data["decks"][self.current_deck_idx]
        due = [c for c in deck.get("cards",[]) if c.get("next_review","") <= today_str()]
        if not due:
            all_cards = deck.get("cards",[])
            if not all_cards:
                messagebox.showinfo("情報","カードがありません"); return
            due = random.sample(all_cards, min(10, len(all_cards)))

        random.shuffle(due)
        self.quiz_cards = due
        self.quiz_idx = 0
        self.session_correct = 0
        self.session_total = 0
        self.quiz_done_frame.pack_forget()
        self._show_quiz_card()

    def _show_quiz_card(self):
        if self.quiz_idx >= len(self.quiz_cards):
            self._quiz_done(); return

        card = self.quiz_cards[self.quiz_idx]
        total = len(self.quiz_cards)
        self.quiz_header.config(text=f"デッキ: {self.data['decks'][self.current_deck_idx]['name']}")
        self.progress_var.set(self.quiz_idx / total * 100)
        self.quiz_stats_label.config(text=f"{self.quiz_idx+1}/{total}  ✅{self.session_correct}  合計:{self.session_total}")

        self.card_front_lbl.config(text=card["front"])
        self.card_back_lbl.config(text="")
        self.separator.pack_forget()
        self.show_answer = False
        self.show_btn.pack()
        self.rating_frame.pack_forget()

    def _show_answer(self):
        if not self.quiz_cards or self.quiz_idx >= len(self.quiz_cards): return
        card = self.quiz_cards[self.quiz_idx]
        self.card_back_lbl.config(text=card["back"])
        self.separator.pack(fill="x", padx=20)
        self.show_answer = True
        self.show_btn.pack_forget()
        self.rating_frame.pack(pady=4)

    def _rate(self, quality: int):
        if not self.show_answer: return
        card = self.quiz_cards[self.quiz_idx]
        self.session_total += 1
        if quality >= 3: self.session_correct += 1

        # SM-2 algorithm
        ef  = max(1.3, card.get("ef", 2.5) + 0.1 - (5-quality)*(0.08 + (5-quality)*0.02))
        reps = card.get("reps", 0)
        if quality < 3:
            interval = 1; reps = 0
        elif reps == 0:
            interval = 1
        elif reps == 1:
            interval = 6
        else:
            interval = round(card.get("interval", 6) * ef)

        card["ef"] = ef
        card["reps"] = reps + 1
        card["interval"] = interval
        card["next_review"] = (date.today() + timedelta(days=interval)).isoformat()

        # Update in main data
        deck = self.data["decks"][self.current_deck_idx]
        for c in deck["cards"]:
            if c["front"] == card["front"] and c["back"] == card["back"]:
                c.update({"ef": ef, "reps": reps+1, "interval": interval,
                           "next_review": card["next_review"]})
                break
        deck["last_studied"] = today_str()
        self._save()

        self.quiz_idx += 1
        self.show_answer = False
        self.rating_frame.pack_forget()
        self._show_quiz_card()

    def _quiz_done(self):
        pct = round(self.session_correct / max(1, self.session_total) * 100)
        self.card_front_lbl.config(text="🎉 完了！")
        self.card_back_lbl.config(text=f"正解率: {pct}%  ({self.session_correct}/{self.session_total})")
        self.separator.pack_forget()
        self.quiz_done_frame.pack()
        self.progress_var.set(100)
        self._refresh_deck_list()
        self._refresh_cards_list()

    def _on_tab_change(self, e=None):
        tab = self.nb.index("current")
        if tab == 0: self._refresh_deck_list()
        elif tab == 1: self._refresh_cards_list()
        elif tab == 2 and not self.quiz_cards: pass


if __name__ == "__main__":
    app = FlashcardApp()
    app.mainloop()
