#!/usr/bin/env python3
"""
Expense Tracker — 家計簿・支出管理アプリ
カテゴリ別支出の記録・グラフ表示・CSV出力。標準ライブラリのみ。
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import json
import csv
from pathlib import Path
from datetime import datetime, date
import calendar


DATA_FILE = Path.home() / ".expense_tracker.json"

CATEGORIES = [
    "食費", "交通費", "住居費", "光熱費", "娯楽", "医療",
    "衣類", "通信費", "教育", "その他"
]

CAT_COLORS = {
    "食費":   "#ef4444", "交通費": "#f97316", "住居費": "#eab308",
    "光熱費":  "#22c55e", "娯楽":  "#06b6d4", "医療":  "#3b82f6",
    "衣類":   "#8b5cf6", "通信費": "#ec4899", "教育":  "#14b8a6",
    "その他":  "#94a3b8",
}


class ExpenseTracker(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Expense Tracker 💰")
        self.geometry("900x620")
        self.configure(bg="#0f172a")
        self.resizable(True, True)

        self.expenses: list[dict] = []
        self._load()
        self._build_ui()
        self._refresh()

    # ── Persistence ───────────────────────────────────
    def _load(self):
        if DATA_FILE.exists():
            try:
                self.expenses = json.loads(DATA_FILE.read_text())
            except Exception:
                self.expenses = []

    def _save(self):
        DATA_FILE.write_text(json.dumps(self.expenses, ensure_ascii=False, indent=2))

    # ── UI ────────────────────────────────────────────
    def _build_ui(self):
        s = ttk.Style(self)
        s.theme_use("clam")
        BG="#0f172a"; FG="#e2e8f0"; FG2="#94a3b8"; CARD="#1e293b"; BORDER="#334155"; ACC="#38bdf8"
        s.configure(".", background=BG, foreground=FG, fieldbackground=CARD)
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
        s.configure("Treeview", background=CARD, foreground=FG, fieldbackground=CARD, rowheight=26)
        s.configure("Treeview.Heading", background=BORDER, foreground=FG2, font=("",10))
        s.map("Treeview", background=[("selected","#0c4a6e")])

        # ── Header ──
        hdr = ttk.Frame(self)
        hdr.pack(fill="x", padx=16, pady=(12,8))
        ttk.Label(hdr, text="💰 Expense Tracker", font=("",16,"bold"),
                  foreground="#38bdf8").pack(side="left")

        # Month selector
        now = datetime.now()
        self.filter_year  = tk.IntVar(value=now.year)
        self.filter_month = tk.IntVar(value=now.month)
        month_frame = ttk.Frame(hdr)
        month_frame.pack(side="right")
        ttk.Button(month_frame, text="◀", width=3, command=lambda: self._shift_month(-1)).pack(side="left")
        self.month_label = ttk.Label(month_frame, text="", font=("",12,"bold"), width=14, anchor="center")
        self.month_label.pack(side="left")
        ttk.Button(month_frame, text="▶", width=3, command=lambda: self._shift_month(1)).pack(side="left")

        # ── Paned window ──
        paned = tk.PanedWindow(self, orient="horizontal", sashwidth=4,
                                bg="#1e293b", relief="flat")
        paned.pack(fill="both", expand=True, padx=10, pady=4)

        # ── Left: entry form + list ──
        left = tk.Frame(paned, bg="#0f172a")
        paned.add(left, minsize=380)

        # Entry form
        form = tk.LabelFrame(left, text="支出を追加", bg="#1e293b", fg="#94a3b8",
                              font=("",10), bd=1, relief="solid", padx=10, pady=8)
        form.pack(fill="x", padx=8, pady=(4,6))

        grid = tk.Frame(form, bg="#1e293b")
        grid.pack(fill="x")

        def lbl(text, row):
            tk.Label(grid, text=text, font=("",10), bg="#1e293b",
                     fg="#94a3b8").grid(row=row, column=0, sticky="w", padx=4, pady=3)

        lbl("金額 (¥)", 0)
        self.amount_var = tk.StringVar()
        ttk.Entry(grid, textvariable=self.amount_var, width=14,
                  font=("",13)).grid(row=0, column=1, sticky="ew", padx=4, pady=3)

        lbl("カテゴリ", 1)
        self.cat_var = tk.StringVar(value=CATEGORIES[0])
        ttk.Combobox(grid, textvariable=self.cat_var, values=CATEGORIES,
                     state="readonly", width=13).grid(row=1, column=1, sticky="ew", padx=4, pady=3)

        lbl("日付", 2)
        self.date_var = tk.StringVar(value=date.today().isoformat())
        ttk.Entry(grid, textvariable=self.date_var, width=14).grid(row=2, column=1, sticky="ew", padx=4, pady=3)

        lbl("メモ", 3)
        self.memo_var = tk.StringVar()
        ttk.Entry(grid, textvariable=self.memo_var, width=14).grid(row=3, column=1, sticky="ew", padx=4, pady=3)

        grid.columnconfigure(1, weight=1)

        btn_row = tk.Frame(form, bg="#1e293b")
        btn_row.pack(fill="x", pady=(6,0))
        tk.Button(btn_row, text="✚ 追加", bg="#0369a1", fg="white", font=("",11,"bold"),
                  relief="flat", padx=12, pady=6, cursor="hand2",
                  command=self._add_expense).pack(side="left")
        tk.Button(btn_row, text="削除", bg="#334155", fg="#94a3b8", font=("",10),
                  relief="flat", padx=8, pady=6, cursor="hand2",
                  command=self._delete_selected).pack(side="left", padx=6)
        tk.Button(btn_row, text="CSV出力", bg="#334155", fg="#94a3b8", font=("",10),
                  relief="flat", padx=8, pady=6, cursor="hand2",
                  command=self._export_csv).pack(side="right")

        # ── Expense list ──
        cols = ("日付","カテゴリ","金額","メモ")
        self.tree = ttk.Treeview(left, columns=cols, show="headings", height=14)
        for col, w in zip(cols, [90,80,90,160]):
            self.tree.heading(col, text=col)
            self.tree.column(col, width=w)
        vsb = ttk.Scrollbar(left, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)

        list_frame = tk.Frame(left, bg="#0f172a")
        list_frame.pack(fill="both", expand=True, padx=8, pady=4)
        self.tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        # Remove tree from left and re-add in frame
        self.tree.pack_forget(); vsb.pack_forget()
        self.tree = ttk.Treeview(list_frame, columns=cols, show="headings", height=14)
        for col, w in zip(cols, [90,80,90,160]):
            self.tree.heading(col, text=col)
            self.tree.column(col, width=w)
        vsb = ttk.Scrollbar(list_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        # ── Right: charts + summary ──
        right = tk.Frame(paned, bg="#0f172a")
        paned.add(right, minsize=280)

        # Summary cards
        sum_frame = tk.Frame(right, bg="#0f172a")
        sum_frame.pack(fill="x", padx=8, pady=(4,6))

        self.total_label = tk.Label(sum_frame, text="¥0", font=("",22,"bold"),
                                     bg="#0f172a", fg="#38bdf8")
        self.total_label.pack()
        tk.Label(sum_frame, text="今月の合計支出", font=("",10), bg="#0f172a",
                 fg="#64748b").pack()

        # Bar chart canvas
        chart_frame = tk.LabelFrame(right, text="カテゴリ別", bg="#1e293b", fg="#94a3b8",
                                     font=("",10), bd=1, relief="solid")
        chart_frame.pack(fill="both", expand=True, padx=8, pady=4)
        self.chart = tk.Canvas(chart_frame, bg="#1e293b", bd=0, highlightthickness=0)
        self.chart.pack(fill="both", expand=True, padx=6, pady=6)

    # ── Logic ─────────────────────────────────────────
    def _shift_month(self, delta):
        y, m = self.filter_year.get(), self.filter_month.get()
        m += delta
        if m > 12: m = 1;  y += 1
        if m < 1:  m = 12; y -= 1
        self.filter_year.set(y); self.filter_month.set(m)
        self._refresh()

    def _filtered(self):
        y, m = self.filter_year.get(), self.filter_month.get()
        return [e for e in self.expenses if e['date'].startswith(f"{y:04d}-{m:02d}")]

    def _add_expense(self):
        try:
            amount = float(self.amount_var.get().replace(',','').replace('¥',''))
        except ValueError:
            messagebox.showerror("エラー", "金額を数値で入力してください"); return
        if amount <= 0:
            messagebox.showerror("エラー", "金額は0より大きい値を入力してください"); return
        try:
            date.fromisoformat(self.date_var.get())
        except ValueError:
            messagebox.showerror("エラー", "日付はYYYY-MM-DD形式で入力してください"); return

        exp = {
            'id': int(datetime.now().timestamp() * 1000),
            'amount': amount,
            'category': self.cat_var.get(),
            'date': self.date_var.get(),
            'memo': self.memo_var.get(),
        }
        self.expenses.insert(0, exp)
        self._save()
        self.amount_var.set('')
        self.memo_var.set('')
        self._refresh()

    def _delete_selected(self):
        sel = self.tree.selection()
        if not sel: return
        if not messagebox.askyesno("確認", f"{len(sel)}件の支出を削除しますか？"): return
        ids = {int(self.tree.item(s)['tags'][0]) for s in sel if self.tree.item(s)['tags']}
        self.expenses = [e for e in self.expenses if e['id'] not in ids]
        self._save(); self._refresh()

    def _export_csv(self):
        path = filedialog.asksaveasfilename(
            title="CSV出力", defaultextension=".csv",
            filetypes=[("CSV","*.csv")]
        )
        if not path: return
        with open(path, 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.DictWriter(f, fieldnames=['date','category','amount','memo'])
            w.writeheader()
            for e in sorted(self._filtered(), key=lambda x: x['date']):
                w.writerow({k: e.get(k,'') for k in ['date','category','amount','memo']})
        messagebox.showinfo("完了", f"出力しました: {path}")

    def _refresh(self):
        y, m = self.filter_year.get(), self.filter_month.get()
        self.month_label.config(text=f"{y}年 {m}月")

        data = sorted(self._filtered(), key=lambda e: e['date'], reverse=True)

        # Update tree
        self.tree.delete(*self.tree.get_children())
        for e in data:
            self.tree.insert("", "end", iid=str(e['id']),
                              values=(e['date'], e['category'],
                                      f"¥{e['amount']:,.0f}", e.get('memo','')),
                              tags=(str(e['id']),))

        # Total
        total = sum(e['amount'] for e in data)
        self.total_label.config(text=f"¥{total:,.0f}")

        # Chart
        self._draw_chart(data)

    def _draw_chart(self, data):
        self.chart.update_idletasks()
        self.chart.delete("all")
        w = self.chart.winfo_width() or 240
        h = self.chart.winfo_height() or 300

        # Aggregate by category
        cat_totals = {}
        for e in data:
            cat_totals[e['category']] = cat_totals.get(e['category'], 0) + e['amount']

        if not cat_totals:
            self.chart.create_text(w//2, h//2, text="データなし", fill="#334155", font=("",12))
            return

        sorted_cats = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)
        max_val = max(v for _,v in sorted_cats)
        bar_h = min(28, (h - 20) // max(len(sorted_cats), 1) - 6)
        padding_left = 60
        padding_right = 16
        bar_area = w - padding_left - padding_right

        for i, (cat, val) in enumerate(sorted_cats):
            y0 = 10 + i * (bar_h + 6)
            bar_w = int(bar_area * val / max_val)
            color = CAT_COLORS.get(cat, "#94a3b8")

            # Category label
            self.chart.create_text(padding_left - 6, y0 + bar_h//2, text=cat,
                                    anchor="e", fill="#94a3b8", font=("",9))
            # Bar
            self.chart.create_rectangle(padding_left, y0,
                                         padding_left + bar_w, y0 + bar_h,
                                         fill=color, outline="")
            # Value
            self.chart.create_text(padding_left + bar_w + 4, y0 + bar_h//2,
                                    text=f"¥{val:,.0f}", anchor="w",
                                    fill="#cbd5e1", font=("",9))


if __name__ == "__main__":
    app = ExpenseTracker()
    app.mainloop()
