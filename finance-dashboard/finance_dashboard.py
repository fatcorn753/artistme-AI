#!/usr/bin/env python3
"""
Finance Dashboard — 個人財務ダッシュボード
資産・負債・純資産の追跡、月次キャッシュフロー、
投資ポートフォリオ、財務指標計算、目標設定。
標準ライブラリのみ。
"""

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import json
import math
from pathlib import Path
from datetime import date


DATA_FILE = Path.home() / ".finance_dashboard.json"

ASSET_CATEGORIES = ["現金・預金","株式","投資信託","不動産","その他資産"]
LIABILITY_CATEGORIES = ["住宅ローン","カードローン","学生ローン","その他負債"]
INCOME_CATS   = ["給与","副業","投資配当","その他収入"]
EXPENSE_CATS  = ["住居費","食費","交通費","光熱費","通信費","娯楽","医療","保険","その他"]
GOAL_TYPES    = ["貯蓄目標","投資目標","負債返済","購入目標","緊急資金"]


class FinanceDashboard(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Finance Dashboard 💹")
        self.geometry("1150x720")
        self.configure(bg="#0a0f1e")
        self.resizable(True, True)

        self.data = {
            "assets": [], "liabilities": [], "transactions": [],
            "goals": [], "monthly_budget": {}, "notes": ""
        }
        self._load()
        self._build_ui()
        self._refresh_all()

    # ── Persistence ───────────────────────────────────
    def _load(self):
        if DATA_FILE.exists():
            try: self.data = json.loads(DATA_FILE.read_text())
            except: pass
        # Ensure keys exist
        for k in ["assets","liabilities","transactions","goals","monthly_budget"]:
            self.data.setdefault(k, [] if k!="monthly_budget" else {})

    def _save(self):
        DATA_FILE.write_text(json.dumps(self.data, ensure_ascii=False, indent=2))

    # ── Computed values ───────────────────────────────
    def _total_assets(self): return sum(a.get("value",0) for a in self.data["assets"])
    def _total_liab(self):   return sum(l.get("value",0) for l in self.data["liabilities"])
    def _net_worth(self):    return self._total_assets() - self._total_liab()

    def _this_month_flow(self):
        today = date.today()
        prefix = f"{today.year:04d}-{today.month:02d}"
        inc = exp = 0
        for t in self.data["transactions"]:
            if t.get("date","").startswith(prefix):
                if t.get("type") == "income": inc += t.get("amount",0)
                else: exp += t.get("amount",0)
        return inc, exp

    # ── UI ────────────────────────────────────────────
    def _build_ui(self):
        s = ttk.Style(self); s.theme_use("clam")
        BG="#0a0f1e"; CARD="#0f172a"; FG="#e2e8f0"; FG2="#94a3b8"; BORDER="#1e293b"
        s.configure(".", background=BG, foreground=FG, fieldbackground=CARD)
        s.configure("TFrame", background=BG); s.configure("TLabel", background=BG, foreground=FG)
        s.configure("TButton", background="#1e293b", foreground=FG, padding=5)
        s.map("TButton", background=[("active","#334155")])
        s.configure("TEntry", fieldbackground=CARD, foreground=FG, insertcolor=FG)
        s.configure("TCombobox", fieldbackground=CARD, foreground=FG)
        s.configure("Treeview", background=CARD, foreground=FG, fieldbackground=CARD, rowheight=24)
        s.configure("Treeview.Heading", background=BORDER, foreground=FG2, font=("",10))
        s.map("Treeview", background=[("selected","#1e3a5f")])
        s.configure("TLabelframe", background=CARD, foreground=FG2)
        s.configure("TLabelframe.Label", background=BG, foreground=FG2, font=("",10))
        s.configure("TNotebook", background=BG)
        s.configure("TNotebook.Tab", background=CARD, foreground=FG2, padding=[10,5])
        s.map("TNotebook.Tab", background=[("selected","#0c2040")], foreground=[("selected","#38bdf8")])

        # ── Header ──
        hdr = tk.Frame(self, bg=BG)
        hdr.pack(fill="x", padx=14, pady=(10,6))
        tk.Label(hdr, text="💹 Finance Dashboard", font=("",15,"bold"), bg=BG, fg="#38bdf8").pack(side="left")
        tk.Label(hdr, text=date.today().strftime("%Y年%m月%d日"), font=("",11), bg=BG, fg="#475569").pack(side="left", padx=12)
        ttk.Button(hdr, text="↻ 更新", command=self._refresh_all).pack(side="right", padx=4)

        # ── KPI cards ──
        kpi_frame = tk.Frame(self, bg=BG)
        kpi_frame.pack(fill="x", padx=12, pady=4)
        self.kpi_labels = {}
        kpi_defs = [
            ("純資産", "net_worth", "#38bdf8"),
            ("総資産", "total_assets", "#4ade80"),
            ("総負債", "total_liab", "#f87171"),
            ("今月収入", "income", "#34d399"),
            ("今月支出", "expense", "#fb923c"),
            ("今月差引", "cashflow", "#a78bfa"),
            ("貯蓄率", "savings_rate", "#fbbf24"),
            ("自己資本比率", "equity_ratio", "#60a5fa"),
        ]
        for i, (label, key, color) in enumerate(kpi_defs):
            card = tk.Frame(kpi_frame, bg="#0f172a", bd=1, relief="solid",
                            highlightbackground="#1e293b", highlightthickness=1)
            card.grid(row=0, column=i, padx=3, sticky="ew")
            kpi_frame.columnconfigure(i, weight=1)
            tk.Label(card, text=label, font=("",9), bg="#0f172a", fg="#475569").pack(pady=(6,1))
            lbl = tk.Label(card, text="—", font=("",15,"bold"), bg="#0f172a", fg=color)
            lbl.pack(pady=(0,6))
            self.kpi_labels[key] = lbl

        # ── Notebook ──
        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True, padx=10, pady=4)

        # Tab 1: Balance Sheet
        bs_tab = tk.Frame(nb, bg=BG); nb.add(bs_tab, text="📊 バランスシート")
        self._build_balance_sheet(bs_tab)

        # Tab 2: Cash Flow
        cf_tab = tk.Frame(nb, bg=BG); nb.add(cf_tab, text="💸 キャッシュフロー")
        self._build_cashflow(cf_tab)

        # Tab 3: Goals
        goals_tab = tk.Frame(nb, bg=BG); nb.add(goals_tab, text="🎯 財務目標")
        self._build_goals(goals_tab)

        # Tab 4: Charts
        chart_tab = tk.Frame(nb, bg=BG); nb.add(chart_tab, text="📈 グラフ")
        self._build_charts(chart_tab)

        # Tab 5: Calculator
        calc_tab = tk.Frame(nb, bg=BG); nb.add(calc_tab, text="🧮 計算ツール")
        self._build_calculator(calc_tab)

        nb.bind("<<NotebookTabChanged>>", lambda _: self._refresh_all())
        self._nb = nb

    # ── Balance Sheet ─────────────────────────────────
    def _build_balance_sheet(self, parent):
        paned = tk.PanedWindow(parent, orient="horizontal", bg="#0a0f1e", sashwidth=4)
        paned.pack(fill="both", expand=True, padx=8, pady=6)

        for side_label, data_key, cats, total_fn, color in [
            ("資産", "assets",      ASSET_CATEGORIES,     self._total_assets, "#4ade80"),
            ("負債", "liabilities", LIABILITY_CATEGORIES, self._total_liab,   "#f87171"),
        ]:
            frame = tk.Frame(paned, bg="#0a0f1e")
            paned.add(frame, minsize=350)

            # Header
            hdr = tk.Frame(frame, bg="#0a0f1e")
            hdr.pack(fill="x", pady=(0,4))
            tk.Label(hdr, text=side_label, font=("",12,"bold"), bg="#0a0f1e", fg=color).pack(side="left")
            tk.Button(hdr, text=f"＋ {side_label}を追加",
                      bg="#0f172a", fg=color, relief="flat", padx=8, pady=3, cursor="hand2",
                      command=lambda dk=data_key, c=cats: self._add_item(dk, c)).pack(side="right")

            # Tree
            cols = ("カテゴリ","名称","金額","割合")
            tree = ttk.Treeview(frame, columns=cols, show="headings", height=10)
            for col, w in zip(cols, [100,140,100,60]):
                tree.heading(col, text=col); tree.column(col, width=w)
            vsb = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
            tree.configure(yscrollcommand=vsb.set)

            tf = tk.Frame(frame, bg="#0a0f1e")
            tf.pack(fill="both", expand=True)
            tree.pack(side="left", fill="both", expand=True)
            vsb.pack(side="right", fill="y")
            tree.bind("<Double-1>", lambda e, dk=data_key, t=tree: self._edit_item(dk, t))
            tree.bind("<Delete>",    lambda e, dk=data_key, t=tree: self._del_item(dk, t))

            if data_key == "assets":
                self.asset_tree = tree
            else:
                self.liab_tree = tree

            # Total
            total_lbl = tk.Label(frame, text="合計: ¥0", font=("",12,"bold"),
                                  bg="#0a0f1e", fg=color)
            total_lbl.pack(anchor="e", padx=4, pady=4)
            if data_key == "assets": self.asset_total_lbl = total_lbl
            else: self.liab_total_lbl = total_lbl

    def _add_item(self, data_key, categories):
        dlg = tk.Toplevel(self); dlg.title("追加"); dlg.configure(bg="#0f172a"); dlg.grab_set()
        dlg.geometry("320x220")
        fields = {}
        for row_i, (label, default) in enumerate([("カテゴリ",categories[0]),("名称",""),("金額","0"),("メモ","")]):
            tk.Label(dlg, text=label, bg="#0f172a", fg="#94a3b8", font=("",10)).grid(row=row_i, column=0, sticky="w", padx=14, pady=5)
            if label == "カテゴリ":
                var = tk.StringVar(value=default)
                w = ttk.Combobox(dlg, textvariable=var, values=categories, state="readonly", width=18)
                fields[label] = var
            else:
                var = tk.StringVar(value=default)
                w = ttk.Entry(dlg, textvariable=var, width=20)
                fields[label] = var
            w.grid(row=row_i, column=1, sticky="ew", padx=10, pady=5)
        dlg.columnconfigure(1, weight=1)

        def save():
            try: amount = float(fields["金額"].get().replace(",",""))
            except: messagebox.showerror("エラー","金額を数値で入力", parent=dlg); return
            self.data[data_key].append({
                "id": str(hash(fields["名称"].get()+str(amount))),
                "category": fields["カテゴリ"].get(), "name": fields["名称"].get(),
                "value": amount, "note": fields["メモ"].get(),
                "date": date.today().isoformat()
            })
            self._save(); self._refresh_all(); dlg.destroy()

        tk.Button(dlg, text="追加", bg="#0369a1", fg="white", relief="flat", padx=14, pady=6,
                  command=save).grid(row=4, column=1, sticky="e", padx=14, pady=10)

    def _edit_item(self, data_key, tree):
        sel = tree.selection()
        if not sel: return
        name = tree.item(sel[0])["values"][1]
        item = next((i for i in self.data[data_key] if i["name"]==name), None)
        if not item: return
        new_val = simpledialog.askfloat("金額変更", f"「{name}」の新しい金額:", initialvalue=item["value"], parent=self)
        if new_val is not None: item["value"] = new_val; self._save(); self._refresh_all()

    def _del_item(self, data_key, tree):
        sel = tree.selection()
        if not sel: return
        name = tree.item(sel[0])["values"][1]
        if messagebox.askyesno("削除", f"「{name}」を削除しますか？"):
            self.data[data_key] = [i for i in self.data[data_key] if i["name"] != name]
            self._save(); self._refresh_all()

    # ── Cash Flow ─────────────────────────────────────
    def _build_cashflow(self, parent):
        top = tk.Frame(parent, bg="#0a0f1e")
        top.pack(fill="x", padx=8, pady=6)
        ttk.Button(top, text="＋ 取引追加", command=self._add_transaction).pack(side="left", padx=2)
        ttk.Button(top, text="🗑 選択削除", command=self._del_transaction).pack(side="left", padx=2)

        cols = ("日付","種別","カテゴリ","内容","金額")
        self.tx_tree = ttk.Treeview(parent, columns=cols, show="headings", height=18)
        for col, w in zip(cols, [90,55,100,180,90]):
            self.tx_tree.heading(col, text=col); self.tx_tree.column(col, width=w)
        vsb = ttk.Scrollbar(parent, orient="vertical", command=self.tx_tree.yview)
        self.tx_tree.configure(yscrollcommand=vsb.set)
        tf = tk.Frame(parent, bg="#0a0f1e"); tf.pack(fill="both", expand=True, padx=8)
        self.tx_tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")
        self.tx_tree.tag_configure("income",  foreground="#4ade80")
        self.tx_tree.tag_configure("expense", foreground="#fb923c")

    def _add_transaction(self):
        dlg = tk.Toplevel(self); dlg.title("取引追加"); dlg.configure(bg="#0f172a"); dlg.grab_set()
        dlg.geometry("340x280")
        vars_ = {}
        today = date.today().isoformat()
        for r, (label, default, choices) in enumerate([
            ("日付", today, None), ("種別", "expense", ["income","expense"]),
            ("カテゴリ", EXPENSE_CATS[0], INCOME_CATS+EXPENSE_CATS),
            ("内容", "", None), ("金額", "0", None)
        ]):
            tk.Label(dlg, text=label, bg="#0f172a", fg="#94a3b8", font=("",10)).grid(row=r, column=0, sticky="w", padx=14, pady=5)
            var = tk.StringVar(value=default)
            if choices:
                w = ttk.Combobox(dlg, textvariable=var, values=choices, state="readonly", width=18)
            else:
                w = ttk.Entry(dlg, textvariable=var, width=20)
            w.grid(row=r, column=1, sticky="ew", padx=10, pady=5)
            vars_[label] = var
        dlg.columnconfigure(1, weight=1)

        def save():
            try: amt = float(vars_["金額"].get().replace(",",""))
            except: messagebox.showerror("エラー","金額を数値で", parent=dlg); return
            self.data["transactions"].append({
                "date": vars_["日付"].get(), "type": vars_["種別"].get(),
                "category": vars_["カテゴリ"].get(), "desc": vars_["内容"].get(), "amount": amt
            })
            self.data["transactions"].sort(key=lambda x: x["date"], reverse=True)
            self._save(); self._refresh_all(); dlg.destroy()

        tk.Button(dlg, text="追加", bg="#0369a1", fg="white", relief="flat", padx=14, pady=6,
                  command=save).grid(row=5, column=1, sticky="e", padx=14, pady=10)

    def _del_transaction(self):
        sel = self.tx_tree.selection()
        if not sel: return
        idx = int(self.tx_tree.item(sel[0])["values"][0]) if False else None
        # Find by content
        vals = self.tx_tree.item(sel[0])["values"]
        self.data["transactions"] = [
            t for t in self.data["transactions"]
            if not (t["date"]==vals[0] and t["desc"]==vals[3])
        ]
        self._save(); self._refresh_all()

    # ── Goals ─────────────────────────────────────────
    def _build_goals(self, parent):
        hdr = tk.Frame(parent, bg="#0a0f1e"); hdr.pack(fill="x", padx=8, pady=6)
        ttk.Button(hdr, text="＋ 目標追加", command=self._add_goal).pack(side="left")
        self.goals_canvas = tk.Canvas(parent, bg="#0a0f1e", bd=0, highlightthickness=0)
        vsb = ttk.Scrollbar(parent, orient="vertical", command=self.goals_canvas.yview)
        self.goals_canvas.configure(yscrollcommand=vsb.set)
        self.goals_canvas.pack(side="left", fill="both", expand=True, padx=8)
        vsb.pack(side="right", fill="y")
        self.goals_inner = tk.Frame(self.goals_canvas, bg="#0a0f1e")
        self.goals_canvas.create_window(0, 0, anchor="nw", window=self.goals_inner)
        self.goals_inner.bind("<Configure>", lambda e: self.goals_canvas.configure(scrollregion=self.goals_canvas.bbox("all")))

    def _add_goal(self):
        dlg = tk.Toplevel(self); dlg.title("目標追加"); dlg.configure(bg="#0f172a"); dlg.grab_set()
        dlg.geometry("340x260")
        vars_ = {}
        for r, (label, default, choices) in enumerate([
            ("タイプ", GOAL_TYPES[0], GOAL_TYPES),
            ("名称", "緊急資金", None),
            ("目標額", "1000000", None),
            ("現在額", "0", None),
            ("期限", "2027-12-31", None),
        ]):
            tk.Label(dlg, text=label, bg="#0f172a", fg="#94a3b8", font=("",10)).grid(row=r, column=0, sticky="w", padx=14, pady=5)
            var = tk.StringVar(value=default)
            w = ttk.Combobox(dlg, textvariable=var, values=choices, state="readonly", width=18) if choices else ttk.Entry(dlg, textvariable=var, width=20)
            w.grid(row=r, column=1, sticky="ew", padx=10, pady=5)
            vars_[label] = var
        dlg.columnconfigure(1, weight=1)

        def save():
            try:
                target = float(vars_["目標額"].get().replace(",",""))
                current = float(vars_["現在額"].get().replace(",",""))
            except: messagebox.showerror("エラー","金額を数値で", parent=dlg); return
            self.data["goals"].append({
                "type": vars_["タイプ"].get(), "name": vars_["名称"].get(),
                "target": target, "current": current, "deadline": vars_["期限"].get()
            })
            self._save(); self._refresh_all(); dlg.destroy()

        tk.Button(dlg, text="追加", bg="#0369a1", fg="white", relief="flat", padx=14, pady=6,
                  command=save).grid(row=5, column=1, sticky="e", padx=14, pady=10)

    # ── Charts ────────────────────────────────────────
    def _build_charts(self, parent):
        paned = tk.PanedWindow(parent, orient="horizontal", bg="#0a0f1e", sashwidth=4)
        paned.pack(fill="both", expand=True)
        left = tk.Frame(paned, bg="#0a0f1e"); paned.add(left, minsize=400)
        right= tk.Frame(paned, bg="#0a0f1e"); paned.add(right, minsize=350)

        tk.Label(left,  text="資産配分", font=("",12,"bold"), bg="#0a0f1e", fg="#38bdf8").pack(pady=6)
        tk.Label(right, text="月次キャッシュフロー", font=("",12,"bold"), bg="#0a0f1e", fg="#38bdf8").pack(pady=6)

        self.asset_pie_canvas  = tk.Canvas(left,  bg="#0a0f1e", bd=0, highlightthickness=0, height=280)
        self.asset_pie_canvas.pack(fill="both", expand=True, padx=10)
        self.cf_bar_canvas = tk.Canvas(right, bg="#0a0f1e", bd=0, highlightthickness=0, height=280)
        self.cf_bar_canvas.pack(fill="both", expand=True, padx=10)

    # ── Calculator ────────────────────────────────────
    def _build_calculator(self, parent):
        nb2 = ttk.Notebook(parent)
        nb2.pack(fill="both", expand=True, padx=8, pady=6)

        # Compound interest
        ci_frame = tk.Frame(nb2, bg="#0a0f1e"); nb2.add(ci_frame, text="複利計算")
        self._build_compound_calc(ci_frame)

        # Loan
        loan_frame = tk.Frame(nb2, bg="#0a0f1e"); nb2.add(loan_frame, text="ローン計算")
        self._build_loan_calc(loan_frame)

        # FIRE
        fire_frame = tk.Frame(nb2, bg="#0a0f1e"); nb2.add(fire_frame, text="FIRE計算")
        self._build_fire_calc(fire_frame)

    def _calc_field(self, parent, label, default, row):
        tk.Label(parent, text=label, bg="#0a0f1e", fg="#94a3b8", font=("",10)).grid(row=row, column=0, sticky="w", padx=10, pady=5)
        var = tk.StringVar(value=default)
        ttk.Entry(parent, textvariable=var, width=16).grid(row=row, column=1, sticky="ew", padx=8, pady=5)
        return var

    def _build_compound_calc(self, parent):
        grid = tk.Frame(parent, bg="#0a0f1e"); grid.pack(padx=20, pady=10)
        vars_ = {}
        for r,(l,d) in enumerate([("初期投資額(¥)","500000"),("毎月積立(¥)","30000"),
                                   ("年利(%)","5"),("期間(年)","20")]):
            vars_[l] = self._calc_field(grid, l, d, r)
        grid.columnconfigure(1, weight=1)
        result_lbl = tk.Label(parent, text="", font=("",12), bg="#0a0f1e", fg="#38bdf8")
        result_lbl.pack(pady=6)

        def calc():
            try:
                P = float(vars_["初期投資額(¥)"].get().replace(",",""))
                m = float(vars_["毎月積立(¥)"].get().replace(",",""))
                r = float(vars_["年利(%)"].get()) / 100 / 12
                n = int(vars_["期間(年)"].get()) * 12
                fv = P * (1+r)**n + m * (((1+r)**n - 1) / r) if r > 0 else P + m*n
                invested = P + m * n
                gain = fv - invested
                result_lbl.config(text=f"最終資産: ¥{fv:,.0f}\n  投資元本: ¥{invested:,.0f}  運用益: ¥{gain:,.0f} ({gain/invested*100:.1f}%)")
            except Exception as e: result_lbl.config(text=f"計算エラー: {e}")

        tk.Button(parent, text="計算", bg="#0369a1", fg="white", relief="flat", padx=16, pady=7,
                  cursor="hand2", command=calc).pack(pady=4)

    def _build_loan_calc(self, parent):
        grid = tk.Frame(parent, bg="#0a0f1e"); grid.pack(padx=20, pady=10)
        vars_ = {}
        for r,(l,d) in enumerate([("借入額(¥)","5000000"),("金利(%)","1.5"),("返済期間(年)","35")]):
            vars_[l] = self._calc_field(grid, l, d, r)
        grid.columnconfigure(1, weight=1)
        result_lbl = tk.Label(parent, text="", font=("",12), bg="#0a0f1e", fg="#38bdf8")
        result_lbl.pack(pady=6)

        def calc():
            try:
                P = float(vars_["借入額(¥)"].get().replace(",",""))
                r = float(vars_["金利(%)"].get()) / 100 / 12
                n = int(vars_["返済期間(年)"].get()) * 12
                if r > 0:
                    monthly = P * r * (1+r)**n / ((1+r)**n - 1)
                else:
                    monthly = P / n
                total = monthly * n
                interest = total - P
                result_lbl.config(text=f"毎月返済額: ¥{monthly:,.0f}\n  総返済額: ¥{total:,.0f}  利息合計: ¥{interest:,.0f}")
            except Exception as e: result_lbl.config(text=f"計算エラー: {e}")

        tk.Button(parent, text="計算", bg="#0369a1", fg="white", relief="flat", padx=16, pady=7,
                  cursor="hand2", command=calc).pack(pady=4)

    def _build_fire_calc(self, parent):
        tk.Label(parent, text="FIRE (経済的自立・早期退職) 計算", font=("",12,"bold"),
                 bg="#0a0f1e", fg="#38bdf8").pack(pady=(10,4))
        grid = tk.Frame(parent, bg="#0a0f1e"); grid.pack(padx=20, pady=6)
        vars_ = {}
        for r,(l,d) in enumerate([("年間生活費(¥)","3600000"),("現在資産(¥)","5000000"),
                                   ("年利(%)","4"),("毎年積立(¥)","1200000"),("取崩率(%)","4")]):
            vars_[l] = self._calc_field(grid, l, d, r)
        grid.columnconfigure(1, weight=1)
        result_lbl = tk.Label(parent, text="", font=("",11), bg="#0a0f1e", fg="#4ade80", justify="left")
        result_lbl.pack(pady=6)

        def calc():
            try:
                annual_exp = float(vars_["年間生活費(¥)"].get().replace(",",""))
                current    = float(vars_["現在資産(¥)"].get().replace(",",""))
                rate       = float(vars_["年利(%)"].get()) / 100
                annual_save= float(vars_["毎年積立(¥)"].get().replace(",",""))
                wr         = float(vars_["取崩率(%)"].get()) / 100
                fire_num   = annual_exp / wr
                years = 0; assets = current
                while assets < fire_num and years < 100:
                    assets = assets * (1 + rate) + annual_save
                    years += 1
                result_lbl.config(text=
                    f"FIRE目標額: ¥{fire_num:,.0f} ({wr*100:.0f}%ルール)\n"
                    f"現在の不足額: ¥{max(0, fire_num-current):,.0f}\n"
                    f"推定FIRE達成年数: {years}年\n"
                    f"達成時資産: ¥{assets:,.0f}")
            except Exception as e: result_lbl.config(text=f"計算エラー: {e}")

        tk.Button(parent, text="FIRE計算", bg="#166534", fg="white", relief="flat", padx=16, pady=7,
                  cursor="hand2", command=calc).pack(pady=4)

    # ── Refresh all ───────────────────────────────────
    def _refresh_all(self):
        self._refresh_kpis()
        self._refresh_trees()
        self._refresh_charts()
        self._refresh_goals_panel()
        self._refresh_cashflow_tree()

    def _refresh_kpis(self):
        tw = self._total_assets(); tl = self._total_liab(); nw = self._net_worth()
        inc, exp = self._this_month_flow()
        cf = inc - exp
        sr = (cf/inc*100) if inc > 0 else 0
        er = (nw/tw*100) if tw > 0 else 0
        defs = [("net_worth",nw,"#38bdf8"),("total_assets",tw,"#4ade80"),("total_liab",tl,"#f87171"),
                ("income",inc,"#34d399"),("expense",exp,"#fb923c"),("cashflow",cf,"#a78bfa"),
                ("savings_rate",sr,"#fbbf24"),("equity_ratio",er,"#60a5fa")]
        for key, val, color in defs:
            if key in ("savings_rate","equity_ratio"):
                text = f"{val:.1f}%"
            else:
                text = f"¥{abs(val):,.0f}" if key!="cashflow" else f"{'+'if val>=0 else ''}¥{val:,.0f}"
            self.kpi_labels[key].config(text=text, fg=color if key not in ("cashflow",) or val>=0 else "#f87171")

    def _refresh_trees(self):
        tw = self._total_assets(); tl = self._total_liab()
        for tree, data_key, total_fn, lbl in [
            (self.asset_tree, "assets", self._total_assets, self.asset_total_lbl),
            (self.liab_tree,  "liabilities", self._total_liab, self.liab_total_lbl),
        ]:
            tree.delete(*tree.get_children())
            total = total_fn()
            for item in self.data[data_key]:
                pct = f"{item['value']/total*100:.1f}%" if total > 0 else "—"
                tree.insert("", "end", values=(item.get("category",""), item.get("name",""),
                                               f"¥{item.get('value',0):,.0f}", pct))
            lbl.config(text=f"合計: ¥{total:,.0f}")

    def _refresh_cashflow_tree(self):
        self.tx_tree.delete(*self.tx_tree.get_children())
        for t in self.data["transactions"][:100]:
            tag = t.get("type","expense")
            self.tx_tree.insert("", "end", tags=(tag,),
                values=(t.get("date",""), "収入" if tag=="income" else "支出",
                        t.get("category",""), t.get("desc",""), f"¥{t.get('amount',0):,.0f}"))

    def _refresh_goals_panel(self):
        for w in self.goals_inner.winfo_children(): w.destroy()
        for i, goal in enumerate(self.data["goals"]):
            target = goal.get("target", 1)
            current= goal.get("current", 0)
            pct = min(100, current/target*100) if target > 0 else 0
            color = "#4ade80" if pct >= 100 else "#38bdf8" if pct >= 50 else "#fbbf24"

            card = tk.Frame(self.goals_inner, bg="#0f172a", bd=1, relief="solid")
            card.pack(fill="x", padx=6, pady=4)

            tk.Label(card, text=f"{goal.get('type','')}  {goal.get('name','')}",
                     font=("",12,"bold"), bg="#0f172a", fg=color).pack(anchor="w", padx=12, pady=(8,3))

            prog_row = tk.Frame(card, bg="#0f172a"); prog_row.pack(fill="x", padx=12, pady=3)
            bg = tk.Frame(prog_row, bg="#1e293b", height=10); bg.pack(fill="x")
            tk.Frame(bg, bg=color, height=10, width=int(max(1,pct))).place(x=0, y=0)

            info_row = tk.Frame(card, bg="#0f172a"); info_row.pack(fill="x", padx=12, pady=(2,8))
            tk.Label(info_row, text=f"¥{current:,.0f} / ¥{target:,.0f} ({pct:.1f}%)",
                     font=("",10), bg="#0f172a", fg="#94a3b8").pack(side="left")
            tk.Label(info_row, text=f"期限: {goal.get('deadline','')}",
                     font=("",10), bg="#0f172a", fg="#4b5563").pack(side="right")

            def update_current(g=goal, idx=i):
                val = simpledialog.askfloat("進捗更新", f"「{g['name']}」の現在額:", initialvalue=g["current"], parent=self)
                if val is not None: g["current"] = val; self._save(); self._refresh_all()
            tk.Button(card, text="進捗更新", bg="#1e293b", fg="#94a3b8", relief="flat",
                      padx=8, pady=2, cursor="hand2", command=update_current).pack(anchor="e", padx=12, pady=(0,6))

    def _refresh_charts(self):
        self._draw_asset_pie()
        self._draw_cf_bars()

    def _draw_asset_pie(self):
        c = self.asset_pie_canvas; c.delete("all")
        c.update_idletasks()
        W = c.winfo_width() or 380; H = c.winfo_height() or 260
        items = self.data["assets"]
        total = self._total_assets()
        if not items or total == 0: c.create_text(W//2,H//2,text="資産データなし",fill="#334155"); return

        colors = ["#38bdf8","#4ade80","#fbbf24","#f97316","#a78bfa","#f87171","#34d399","#60a5fa"]
        cx,cy = W*0.45, H//2; r = min(cx,cy) - 30
        start = -math.pi/2
        for i, item in enumerate(items):
            pct = item["value"] / total
            sweep = 2 * math.pi * pct
            end = start + sweep
            x1,y1 = cx+r*math.cos(start), cy+r*math.sin(start)
            x2,y2 = cx+r*math.cos(end),   cy+r*math.sin(end)
            # Polygon approximation for arc
            pts = [cx, cy]
            steps = max(3, int(sweep * 20))
            for step in range(steps+1):
                a = start + sweep * step / steps
                pts += [cx + r*math.cos(a), cy + r*math.sin(a)]
            color = colors[i % len(colors)]
            c.create_polygon(pts, fill=color, outline="#0a0f1e", width=2)

            # Label
            mid_a = start + sweep/2
            lx = cx + r*0.65*math.cos(mid_a); ly = cy + r*0.65*math.sin(mid_a)
            if pct > 0.05:
                c.create_text(lx, ly, text=f"{pct*100:.0f}%", fill="#0a0f1e", font=("",9,"bold"))

            # Legend
            lx2 = W*0.82; ly2 = 20 + i*22
            c.create_rectangle(lx2, ly2, lx2+12, ly2+12, fill=color, outline="")
            c.create_text(lx2+16, ly2+6, text=item["name"][:10], fill="#94a3b8", font=("",9), anchor="w")
            start = end

    def _draw_cf_bars(self):
        c = self.cf_bar_canvas; c.delete("all")
        c.update_idletasks()
        W = c.winfo_width() or 320; H = c.winfo_height() or 260

        # Last 6 months
        months = []
        today = date.today()
        for i in range(5,-1,-1):
            yr = today.year + (today.month - 1 - i) // 12 * (1 if (today.month-1-i)>=0 else -1)
            mo = ((today.month - 1 - i) % 12) + 1
            months.append((yr, mo, f"{yr:04d}-{mo:02d}"))

        data_by_month = {}
        for t in self.data["transactions"]:
            pfx = t.get("date","")[:7]
            data_by_month.setdefault(pfx, {"income":0,"expense":0})
            data_by_month[pfx][t.get("type","expense")] += t.get("amount",0)

        inc_vals = [data_by_month.get(m[2],{}).get("income",0) for m in months]
        exp_vals = [data_by_month.get(m[2],{}).get("expense",0) for m in months]
        max_val = max(max(inc_vals), max(exp_vals), 1)

        pad = {"l":30,"r":10,"t":10,"b":30}; n=6
        bw = (W-pad["l"]-pad["r"]) / n
        bh_total = H - pad["t"] - pad["b"]

        for i, (yr,mo,pfx) in enumerate(months):
            x_center = pad["l"] + (i+0.5)*bw
            inc_h = bh_total * inc_vals[i] / max_val
            exp_h = bh_total * exp_vals[i] / max_val
            bw2 = bw * 0.35

            c.create_rectangle(x_center-bw2*2, H-pad["b"]-inc_h, x_center-bw2*0.2, H-pad["b"],
                                fill="#4ade80", outline="")
            c.create_rectangle(x_center+bw2*0.2, H-pad["b"]-exp_h, x_center+bw2*2, H-pad["b"],
                                fill="#fb923c", outline="")
            c.create_text(x_center, H-pad["b"]+14, text=f"{mo}月", fill="#475569", font=("",9), anchor="center")

        c.create_text(pad["l"]+20, pad["t"]+6, text="■ 収入", fill="#4ade80", font=("",9), anchor="w")
        c.create_text(pad["l"]+80, pad["t"]+6, text="■ 支出", fill="#fb923c", font=("",9), anchor="w")


if __name__ == "__main__":
    app = FinanceDashboard()
    app.mainloop()
