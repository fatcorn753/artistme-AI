#!/usr/bin/env python3
"""
Budget Planner — 予算管理・財務計画アプリ
月次収入/支出の予算設定、実績入力、達成率グラフ、年間サマリー。標準ライブラリのみ。
"""

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import json
from pathlib import Path
from datetime import date, datetime


DATA_FILE = Path.home() / ".budget_planner.json"

INCOME_CATS = ["給与", "副業", "投資", "その他収入"]
EXPENSE_CATS = ["住居費", "食費", "交通費", "光熱費", "通信費",
                "娯楽", "医療", "衣類", "教育", "貯蓄", "その他"]

CAT_COLORS = {
    "給与": "#4ade80", "副業": "#34d399", "投資": "#10b981", "その他収入": "#6ee7b7",
    "住居費": "#f87171", "食費": "#fb923c", "交通費": "#fbbf24", "光熱費": "#a3e635",
    "通信費": "#22d3ee", "娯楽": "#818cf8", "医療": "#c084fc", "衣類": "#f472b6",
    "教育": "#60a5fa", "貯蓄": "#34d399", "その他": "#94a3b8",
}


class BudgetPlanner(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Budget Planner 💰")
        self.geometry("960x640")
        self.configure(bg="#0f172a")
        self.resizable(True, True)

        now = date.today()
        self.year_var  = tk.IntVar(value=now.year)
        self.month_var = tk.IntVar(value=now.month)
        self.data = {}   # {year: {month: {category: {budget, actual, transactions: []}}}}
        self._load()
        self._build_ui()
        self._refresh()

    # ── Persistence ───────────────────────────────────
    def _load(self):
        if DATA_FILE.exists():
            try: self.data = json.loads(DATA_FILE.read_text())
            except: self.data = {}

    def _save(self):
        DATA_FILE.write_text(json.dumps(self.data, ensure_ascii=False, indent=2))

    def _month_data(self, year=None, month=None):
        if year is None:  year  = self.year_var.get()
        if month is None: month = self.month_var.get()
        k_y = str(year); k_m = str(month)
        if k_y not in self.data:       self.data[k_y] = {}
        if k_m not in self.data[k_y]: self.data[k_y][k_m] = {}
        return self.data[k_y][k_m]

    def _cat_data(self, cat, year=None, month=None):
        md = self._month_data(year, month)
        if cat not in md:
            md[cat] = {"budget": 0, "transactions": []}
        return md[cat]

    # ── UI ────────────────────────────────────────────
    def _build_ui(self):
        s = ttk.Style(self); s.theme_use("clam")
        BG="#0f172a"; CARD="#1e293b"; FG="#e2e8f0"; FG2="#94a3b8"; BORDER="#334155"; ACC="#38bdf8"
        s.configure(".", background=BG, foreground=FG)
        s.configure("TFrame", background=BG)
        s.configure("TLabel", background=BG, foreground=FG)
        s.configure("TButton", background="#334155", foreground=FG, padding=6)
        s.map("TButton", background=[("active","#475569")])
        s.configure("Accent.TButton", background="#0369a1", foreground="white")
        s.map("Accent.TButton", background=[("active","#0284c7")])
        s.configure("TEntry", fieldbackground=CARD, foreground=FG, insertcolor=FG)
        s.configure("TCombobox", fieldbackground=CARD, foreground=FG)
        s.configure("TLabelframe", background=CARD, foreground=FG2)
        s.configure("TLabelframe.Label", background=BG, foreground=FG2, font=("",10))
        s.configure("TNotebook", background=BG)
        s.configure("TNotebook.Tab", background=CARD, foreground=FG2, padding=[10,5])
        s.map("TNotebook.Tab", background=[("selected","#1e3a5f")], foreground=[("selected",ACC)])
        s.configure("Treeview", background=CARD, foreground=FG, fieldbackground=CARD, rowheight=24)
        s.configure("Treeview.Heading", background=BORDER, foreground=FG2, font=("",10))
        s.map("Treeview", background=[("selected","#0c4a6e")])
        s.configure("TProgressbar", troughcolor=BORDER, background=ACC, thickness=10)

        # Header
        hdr = tk.Frame(self, bg=BG)
        hdr.pack(fill="x", padx=14, pady=(10,6))
        tk.Label(hdr, text="💰 Budget Planner", font=("",15,"bold"), bg=BG, fg=ACC).pack(side="left")

        nav = tk.Frame(hdr, bg=BG)
        nav.pack(side="right")
        ttk.Button(nav, text="◀", width=3, command=lambda: self._shift_month(-1)).pack(side="left")
        self.month_label = ttk.Label(nav, text="", font=("",12,"bold"), width=14, anchor="center")
        self.month_label.pack(side="left")
        ttk.Button(nav, text="▶", width=3, command=lambda: self._shift_month(1)).pack(side="left")

        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True, padx=10, pady=4)

        # ── Tab 1: Overview ──
        ov = tk.Frame(nb, bg=BG); nb.add(ov, text="📊 概要")
        self._build_overview(ov)

        # ── Tab 2: Income ──
        inc = tk.Frame(nb, bg=BG); nb.add(inc, text="💚 収入")
        self._build_category_tab(inc, INCOME_CATS, "income")

        # ── Tab 3: Expenses ──
        exp = tk.Frame(nb, bg=BG); nb.add(exp, text="❤️ 支出")
        self._build_category_tab(exp, EXPENSE_CATS, "expense")

        # ── Tab 4: Transactions ──
        tr = tk.Frame(nb, bg=BG); nb.add(tr, text="📝 明細")
        self._build_transactions_tab(tr)

        # ── Tab 5: Annual ──
        an = tk.Frame(nb, bg=BG); nb.add(an, text="📅 年間")
        self._build_annual_tab(an)

        self._nb = nb
        nb.bind("<<NotebookTabChanged>>", lambda _: self._refresh())

    def _build_overview(self, parent):
        paned = tk.PanedWindow(parent, orient="horizontal", bg="#0f172a", sashwidth=4)
        paned.pack(fill="both", expand=True)

        left = tk.Frame(paned, bg="#0f172a")
        paned.add(left, minsize=280)

        # Summary cards
        sum_frame = tk.Frame(left, bg="#0f172a")
        sum_frame.pack(fill="x", padx=8, pady=8)

        self.total_income_lbl  = self._summary_card(sum_frame, "収入合計", "¥0", "#4ade80")
        self.total_expense_lbl = self._summary_card(sum_frame, "支出合計", "¥0", "#f87171")
        self.balance_lbl       = self._summary_card(sum_frame, "収支バランス", "¥0", "#38bdf8")

        # Budget bars
        bars_frame = tk.LabelFrame(left, text="カテゴリ別達成率", bg="#1e293b", fg="#94a3b8",
                                    font=("",10), bd=1, relief="solid")
        bars_frame.pack(fill="both", expand=True, padx=8, pady=4)
        self._bars_canvas = tk.Canvas(bars_frame, bg="#1e293b", bd=0, highlightthickness=0)
        bars_vsb = ttk.Scrollbar(bars_frame, orient="vertical", command=self._bars_canvas.yview)
        self._bars_canvas.configure(yscrollcommand=bars_vsb.set)
        self._bars_canvas.pack(side="left", fill="both", expand=True)
        bars_vsb.pack(side="right", fill="y")
        self._bars_frame_inner = tk.Frame(self._bars_canvas, bg="#1e293b")
        self._bars_canvas.create_window(0, 0, anchor="nw", window=self._bars_frame_inner)
        self._bars_frame_inner.bind("<Configure>",
            lambda e: self._bars_canvas.configure(scrollregion=self._bars_canvas.bbox("all")))

        # Pie chart placeholder
        right = tk.Frame(paned, bg="#0f172a")
        paned.add(right, minsize=240)
        self.pie_canvas = tk.Canvas(right, bg="#0f172a", bd=0, highlightthickness=0, height=260)
        self.pie_canvas.pack(fill="both", expand=True, padx=8, pady=8)
        self.pie_legend = tk.Frame(right, bg="#0f172a")
        self.pie_legend.pack(fill="x", padx=8)

    def _summary_card(self, parent, title, value, color):
        f = tk.Frame(parent, bg="#1e293b", bd=1, relief="solid", pady=8, padx=10)
        f.pack(side="left", fill="both", expand=True, padx=3)
        tk.Label(f, text=title, font=("",9), bg="#1e293b", fg="#94a3b8").pack()
        lbl = tk.Label(f, text=value, font=("",16,"bold"), bg="#1e293b", fg=color)
        lbl.pack()
        return lbl

    def _build_category_tab(self, parent, cats, kind):
        frame = tk.Frame(parent, bg="#0f172a")
        frame.pack(fill="both", expand=True, padx=10, pady=8)

        cols = ("カテゴリ", "予算", "実績", "差額", "達成率")
        tree = ttk.Treeview(frame, columns=cols, show="headings", height=12)
        for col, w in zip(cols, [120, 90, 90, 90, 80]):
            tree.heading(col, text=col)
            tree.column(col, width=w)
        vsb = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=vsb.set)
        tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        if kind == "income": self._income_tree = tree
        else: self._expense_tree = tree

        # Edit on double click
        def on_dbl(event):
            item = tree.focus()
            if not item: return
            cat = tree.item(item)["values"][0]
            current = self._cat_data(cat)["budget"]
            new_val = simpledialog.askinteger("予算設定", f"{cat} の月次予算を入力 (¥):", initialvalue=current, minvalue=0, parent=self)
            if new_val is not None:
                self._cat_data(cat)["budget"] = new_val
                self._save(); self._refresh()
        tree.bind("<Double-1>", on_dbl)

        btn_row = tk.Frame(parent, bg="#0f172a")
        btn_row.pack(fill="x", padx=10, pady=4)
        ttk.Label(btn_row, text="ダブルクリックで予算を編集", foreground="#475569", font=("",9)).pack(side="left")
        ttk.Button(btn_row, text="＋ 取引を追加",
                   command=lambda: self._add_transaction_dialog(cats),
                   style="Accent.TButton").pack(side="right")

    def _build_transactions_tab(self, parent):
        top = tk.Frame(parent, bg="#0f172a")
        top.pack(fill="x", padx=10, pady=(8,4))
        ttk.Button(top, text="＋ 取引追加", style="Accent.TButton",
                   command=lambda: self._add_transaction_dialog()).pack(side="left")
        ttk.Button(top, text="🗑 選択削除",
                   command=self._delete_transaction).pack(side="left", padx=6)

        cols = ("日付","カテゴリ","金額","メモ")
        self._tr_tree = ttk.Treeview(parent, columns=cols, show="headings", height=18)
        for col, w in zip(cols, [90,100,90,200]):
            self._tr_tree.heading(col, text=col)
            self._tr_tree.column(col, width=w)
        vsb = ttk.Scrollbar(parent, orient="vertical", command=self._tr_tree.yview)
        self._tr_tree.configure(yscrollcommand=vsb.set)
        tr_frame = tk.Frame(parent, bg="#0f172a")
        tr_frame.pack(fill="both", expand=True, padx=10, pady=4)
        self._tr_tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

    def _build_annual_tab(self, parent):
        self._annual_canvas = tk.Canvas(parent, bg="#0f172a", bd=0, highlightthickness=0)
        self._annual_canvas.pack(fill="both", expand=True, padx=10, pady=8)

    # ── Add transaction dialog ────────────────────────
    def _add_transaction_dialog(self, cats=None):
        dlg = tk.Toplevel(self)
        dlg.title("取引を追加"); dlg.configure(bg="#1e293b")
        dlg.grab_set()
        dlg.geometry("340x280")

        fields = {}
        all_cats = INCOME_CATS + EXPENSE_CATS
        today = date.today().isoformat()

        for row_i, (label, kind, default) in enumerate([
            ("日付", "entry", today), ("カテゴリ", "combo", all_cats[0]),
            ("金額 (¥)", "entry", ""), ("メモ", "entry", "")
        ]):
            tk.Label(dlg, text=label, bg="#1e293b", fg="#94a3b8", font=("",10)).grid(
                row=row_i, column=0, sticky="w", padx=14, pady=6)
            if kind == "entry":
                w = ttk.Entry(dlg, width=20); w.insert(0, default)
            else:
                var = tk.StringVar(value=default)
                w = ttk.Combobox(dlg, textvariable=var, values=all_cats, state="readonly", width=18)
            w.grid(row=row_i, column=1, padx=10, pady=6, sticky="ew")
            fields[label] = w

        def submit():
            try:
                d = fields["日付"].get().strip()
                date.fromisoformat(d)
            except ValueError:
                messagebox.showerror("エラー", "日付形式: YYYY-MM-DD", parent=dlg); return
            try: amount = float(fields["金額 (¥)"].get().replace(",",""))
            except ValueError:
                messagebox.showerror("エラー", "金額は数値で入力", parent=dlg); return
            if amount <= 0:
                messagebox.showerror("エラー", "金額は0より大きい値", parent=dlg); return

            cat  = fields["カテゴリ"].get()
            memo = fields["メモ"].get()
            dt = date.fromisoformat(d)
            cd = self._cat_data(cat, dt.year, dt.month)
            cd["transactions"].append({"date": d, "amount": amount, "memo": memo})
            self._save(); self._refresh(); dlg.destroy()

        tk.Button(dlg, text="追加", bg="#0369a1", fg="white", font=("",11,"bold"),
                  relief="flat", padx=14, pady=6, cursor="hand2", command=submit).grid(
                  row=4, column=1, sticky="e", padx=14, pady=10)
        dlg.columnconfigure(1, weight=1)

    def _delete_transaction(self):
        sel = self._tr_tree.selection()
        if not sel: return
        item = self._tr_tree.item(sel[0])
        vals = item["values"]
        d, cat, amount, memo = vals[0], vals[1], float(str(vals[2]).replace("¥","").replace(",","")), vals[3]
        dt = date.fromisoformat(str(d))
        cd = self._cat_data(cat, dt.year, dt.month)
        cd["transactions"] = [t for t in cd["transactions"]
                               if not (t["date"]==str(d) and abs(t["amount"]-amount)<0.01)]
        self._save(); self._refresh()

    # ── Refresh ───────────────────────────────────────
    def _shift_month(self, delta):
        y, m = self.year_var.get(), self.month_var.get()
        m += delta
        if m > 12: m=1; y+=1
        if m < 1:  m=12; y-=1
        self.year_var.set(y); self.month_var.set(m)
        self._refresh()

    def _refresh(self):
        y, m = self.year_var.get(), self.month_var.get()
        self.month_label.config(text=f"{y}年 {m}月")
        md = self._month_data()

        # Compute totals
        total_income = total_expense = 0
        for cat in INCOME_CATS:
            total_income += sum(t["amount"] for t in self._cat_data(cat).get("transactions",[]))
        for cat in EXPENSE_CATS:
            total_expense += sum(t["amount"] for t in self._cat_data(cat).get("transactions",[]))

        balance = total_income - total_expense
        self.total_income_lbl.config(text=f"¥{total_income:,.0f}")
        self.total_expense_lbl.config(text=f"¥{total_expense:,.0f}")
        bal_color = "#4ade80" if balance >= 0 else "#f87171"
        self.balance_lbl.config(text=f"¥{balance:,.0f}", fg=bal_color)

        # Category bars
        for w in self._bars_frame_inner.winfo_children(): w.destroy()
        for cat in INCOME_CATS + EXPENSE_CATS:
            cd = self._cat_data(cat)
            actual = sum(t["amount"] for t in cd.get("transactions",[]))
            budget = cd.get("budget", 0)
            pct = min(100, actual/budget*100) if budget > 0 else 0
            color = CAT_COLORS.get(cat, "#94a3b8")

            row = tk.Frame(self._bars_frame_inner, bg="#1e293b")
            row.pack(fill="x", padx=6, pady=2)
            tk.Label(row, text=cat, font=("",9), bg="#1e293b", fg="#cbd5e1", width=8, anchor="w").pack(side="left")
            bar_bg = tk.Frame(row, bg="#334155", height=8, width=120)
            bar_bg.pack(side="left", padx=4); bar_bg.pack_propagate(False)
            if pct > 0:
                tk.Frame(bar_bg, bg=color, width=int(120*pct/100), height=8).place(x=0,y=0)
            tk.Label(row, text=f"¥{actual:,.0f}", font=("",9), bg="#1e293b", fg=color, width=8).pack(side="left")

        # Pie chart
        self._draw_pie(EXPENSE_CATS)

        # Category trees
        self._refresh_tree(self._income_tree, INCOME_CATS)
        self._refresh_tree(self._expense_tree, EXPENSE_CATS)

        # Transactions
        self._tr_tree.delete(*self._tr_tree.get_children())
        all_tr = []
        for cat in INCOME_CATS + EXPENSE_CATS:
            for t in self._cat_data(cat).get("transactions",[]):
                all_tr.append((t["date"], cat, t["amount"], t.get("memo","")))
        for tr in sorted(all_tr, key=lambda x: x[0], reverse=True):
            self._tr_tree.insert("", "end", values=(tr[0], tr[1], f"¥{tr[2]:,.0f}", tr[3]))

        # Annual chart
        self._draw_annual()

    def _refresh_tree(self, tree, cats):
        tree.delete(*tree.get_children())
        for cat in cats:
            cd = self._cat_data(cat)
            actual = sum(t["amount"] for t in cd.get("transactions",[]))
            budget = cd.get("budget", 0)
            diff   = budget - actual
            pct    = f"{actual/budget*100:.0f}%" if budget > 0 else "—"
            tree.insert("", "end", values=(cat, f"¥{budget:,.0f}", f"¥{actual:,.0f}", f"¥{diff:,.0f}", pct))

    def _draw_pie(self, cats):
        self.pie_canvas.update_idletasks()
        self.pie_canvas.delete("all")
        w = self.pie_canvas.winfo_width() or 220
        h = self.pie_canvas.winfo_height() or 240
        cx, cy, r = w//2, h//2-10, min(w,h)//2 - 20

        for w2 in self.pie_legend.winfo_children(): w2.destroy()

        totals = [(cat, sum(t["amount"] for t in self._cat_data(cat).get("transactions",[])))
                  for cat in cats]
        totals = [(c,v) for c,v in totals if v > 0]
        if not totals:
            self.pie_canvas.create_text(cx, cy, text="データなし", fill="#334155", font=("",12))
            return

        grand = sum(v for _,v in totals)
        import math; angle = -90
        for cat, val in totals:
            sweep = 360 * val / grand
            color = CAT_COLORS.get(cat, "#94a3b8")
            self.pie_canvas.create_arc(cx-r, cy-r, cx+r, cy+r,
                start=angle, extent=sweep, fill=color, outline="#0f172a", width=1)
            angle += sweep
            # Legend
            f = tk.Frame(self.pie_legend, bg="#0f172a")
            f.pack(anchor="w", pady=1)
            tk.Label(f, bg=color, width=2, height=1).pack(side="left", padx=3)
            tk.Label(f, text=f"{cat} {val/grand*100:.0f}%", font=("",9),
                     bg="#0f172a", fg="#94a3b8").pack(side="left")

    def _draw_annual(self):
        self._annual_canvas.update_idletasks()
        self._annual_canvas.delete("all")
        w = self._annual_canvas.winfo_width() or 700
        h = self._annual_canvas.winfo_height() or 300
        year = self.year_var.get()

        months_data = []
        for m in range(1, 13):
            inc = sum(sum(t["amount"] for t in self._cat_data(cat,year,m).get("transactions",[]))
                      for cat in INCOME_CATS)
            exp = sum(sum(t["amount"] for t in self._cat_data(cat,year,m).get("transactions",[]))
                      for cat in EXPENSE_CATS)
            months_data.append((inc, exp))

        max_val = max((max(a,b) for a,b in months_data), default=1) or 1
        pad_l, pad_r, pad_t, pad_b = 50, 20, 20, 40
        bar_area_w = w - pad_l - pad_r
        bar_area_h = h - pad_t - pad_b
        bar_w = bar_area_w / 12
        grp_w = bar_w * 0.8

        # Axes
        self._annual_canvas.create_line(pad_l, pad_t, pad_l, h-pad_b, fill="#334155")
        self._annual_canvas.create_line(pad_l, h-pad_b, w-pad_r, h-pad_b, fill="#334155")

        for i, (inc, exp) in enumerate(months_data):
            x_center = pad_l + (i + 0.5) * bar_w
            # Income bar
            inc_h = bar_area_h * inc / max_val
            self._annual_canvas.create_rectangle(
                x_center - grp_w/2, h-pad_b-inc_h,
                x_center, h-pad_b, fill="#4ade80", outline="")
            # Expense bar
            exp_h = bar_area_h * exp / max_val
            self._annual_canvas.create_rectangle(
                x_center, h-pad_b-exp_h,
                x_center + grp_w/2, h-pad_b, fill="#f87171", outline="")
            # Month label
            self._annual_canvas.create_text(x_center, h-pad_b+12, text=f"{i+1}月",
                                             fill="#64748b", font=("",8))

        # Y axis labels
        for fraction in [0.25, 0.5, 0.75, 1.0]:
            y = h - pad_b - bar_area_h * fraction
            self._annual_canvas.create_line(pad_l-4, y, pad_l, y, fill="#334155")
            val = max_val * fraction
            lbl = f"¥{val/10000:.0f}万" if val >= 10000 else f"¥{val:.0f}"
            self._annual_canvas.create_text(pad_l-6, y, text=lbl, fill="#64748b", font=("",8), anchor="e")

        # Legend
        for color, label in [("#4ade80","収入"),("#f87171","支出")]:
            f = tk.Frame(self, bg="#0f172a")  # just draw on canvas
        self._annual_canvas.create_rectangle(pad_l, pad_t, pad_l+12, pad_t+8, fill="#4ade80", outline="")
        self._annual_canvas.create_text(pad_l+16, pad_t+4, text="収入", fill="#4ade80", font=("",9), anchor="w")
        self._annual_canvas.create_rectangle(pad_l+50, pad_t, pad_l+62, pad_t+8, fill="#f87171", outline="")
        self._annual_canvas.create_text(pad_l+66, pad_t+4, text="支出", fill="#f87171", font=("",9), anchor="w")


if __name__ == "__main__":
    app = BudgetPlanner()
    app.mainloop()
