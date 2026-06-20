#!/usr/bin/env python3
"""
Habit Calendar — 月次カレンダー型習慣トラッカー
複数習慣を月カレンダーで管理。週次統計グラフ、完了率、
エクスポート機能付き。標準ライブラリのみ。
"""

import tkinter as tk
from tkinter import ttk, colorchooser, simpledialog, messagebox, filedialog
import json
import calendar
from datetime import date, timedelta
from pathlib import Path
import csv


DATA_FILE = Path.home() / ".habit_calendar.json"

MONTH_JP = ['','1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
WEEKDAY_JP = ['月','火','水','木','金','土','日']

DEFAULT_HABITS = [
    {'id':'h1','name':'運動','color':'#4ade80','records':{}},
    {'id':'h2','name':'読書','color':'#60a5fa','records':{}},
    {'id':'h3','name':'瞑想','color':'#f59e0b','records':{}},
]


class HabitCalendar(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Habit Calendar 📅")
        self.geometry("1000x680")
        self.configure(bg="#0f172a")
        self.resizable(True, True)

        now = date.today()
        self.year  = tk.IntVar(value=now.year)
        self.month = tk.IntVar(value=now.month)
        self.habits = []
        self.selected_habits: set = set()

        self._load()
        if not self.habits: self.habits = DEFAULT_HABITS
        for h in self.habits: self.selected_habits.add(h['id'])

        self._build_ui()
        self._refresh()

    # ── Persistence ───────────────────────────────────
    def _load(self):
        if DATA_FILE.exists():
            try: self.habits = json.loads(DATA_FILE.read_text())
            except: self.habits = []

    def _save(self):
        DATA_FILE.write_text(json.dumps(self.habits, ensure_ascii=False, indent=2))

    def _date_key(self, d: date) -> str: return d.isoformat()

    def _is_done(self, habit_id: str, d: date) -> bool:
        h = next((h for h in self.habits if h['id'] == habit_id), None)
        return h and self._date_key(d) in h.get('records', {})

    def _toggle(self, habit_id: str, d: date):
        h = next((h for h in self.habits if h['id'] == habit_id), None)
        if not h: return
        k = self._date_key(d)
        recs = h.setdefault('records', {})
        if k in recs: del recs[k]
        else: recs[k] = True
        self._save()
        self._refresh()

    # ── UI ────────────────────────────────────────────
    def _build_ui(self):
        s = ttk.Style(self); s.theme_use("clam")
        BG="#0f172a"; CARD="#1e293b"; FG="#e2e8f0"; FG2="#94a3b8"; BORDER="#334155"; ACC="#60a5fa"
        s.configure(".", background=BG, foreground=FG)
        s.configure("TFrame", background=BG); s.configure("TLabel", background=BG, foreground=FG)
        s.configure("TButton", background="#334155", foreground=FG, padding=5)
        s.map("TButton", background=[("active","#475569")])
        s.configure("TCheckbutton", background=BG, foreground=FG)
        s.configure("TLabelframe", background=CARD, foreground=FG2)
        s.configure("TLabelframe.Label", background=BG, foreground=FG2, font=("",10))
        s.configure("TScrollbar", background=CARD, troughcolor=BG)

        # ── Header ──
        hdr = tk.Frame(self, bg=BG)
        hdr.pack(fill="x", padx=14, pady=(10,6))
        tk.Label(hdr, text="📅 Habit Calendar", font=("",15,"bold"), bg=BG, fg=ACC).pack(side="left")

        nav = tk.Frame(hdr, bg=BG)
        nav.pack(side="right")
        ttk.Button(nav, text="◀", width=3, command=lambda: self._shift_month(-1)).pack(side="left")
        self.nav_label = ttk.Label(nav, text="", font=("",13,"bold"), width=16, anchor="center")
        self.nav_label.pack(side="left")
        ttk.Button(nav, text="▶", width=3, command=lambda: self._shift_month(1)).pack(side="left")
        ttk.Button(nav, text="今月", command=self._go_today).pack(side="left", padx=8)

        # ── Main layout ──
        main = tk.Frame(self, bg=BG)
        main.pack(fill="both", expand=True, padx=10, pady=4)

        # Left: Habit list + stats
        left = tk.Frame(main, bg=BG, width=220)
        left.pack(side="left", fill="y", padx=(0,8))
        left.pack_propagate(False)

        # Habit controls
        h_hdr = tk.Frame(left, bg=BG)
        h_hdr.pack(fill="x", pady=(0,4))
        tk.Label(h_hdr, text="習慣リスト", font=("",11,"bold"), bg=BG, fg=FG2).pack(side="left")
        ttk.Button(h_hdr, text="＋", command=self._add_habit, width=3).pack(side="right")

        self.habit_frame = tk.Frame(left, bg=BG)
        self.habit_frame.pack(fill="x")

        # Stats
        stats_fr = tk.LabelFrame(left, text="今月の統計", bg=CARD, fg=FG2, font=("",10),
                                  bd=1, relief="solid")
        stats_fr.pack(fill="x", pady=8)
        self.stats_canvas = tk.Canvas(stats_fr, height=160, bg=CARD, bd=0, highlightthickness=0)
        self.stats_canvas.pack(fill="x", padx=6, pady=6)

        # Completion rates
        rates_fr = tk.LabelFrame(left, text="完了率", bg=CARD, fg=FG2, font=("",10),
                                  bd=1, relief="solid")
        rates_fr.pack(fill="x", pady=4)
        self.rates_frame = tk.Frame(rates_fr, bg=CARD)
        self.rates_frame.pack(fill="x", padx=6, pady=6)

        # Export button
        ttk.Button(left, text="📊 CSVエクスポート", command=self._export_csv).pack(fill="x", pady=8)

        # Right: Calendar
        right = tk.Frame(main, bg=BG)
        right.pack(side="left", fill="both", expand=True)

        # Weekday header
        wd_frame = tk.Frame(right, bg=BG)
        wd_frame.pack(fill="x", pady=(0,2))
        for i, wd in enumerate(WEEKDAY_JP):
            color = '#f87171' if i == 6 else '#64748b' if i == 5 else FG2
            tk.Label(wd_frame, text=wd, font=("",10,"bold"), bg=BG, fg=color,
                     width=8).grid(row=0, column=i, sticky="ew")
            wd_frame.columnconfigure(i, weight=1)

        # Calendar grid
        self.cal_frame = tk.Frame(right, bg=BG)
        self.cal_frame.pack(fill="both", expand=True)
        for c in range(7): self.cal_frame.columnconfigure(c, weight=1)
        for r in range(6): self.cal_frame.rowconfigure(r, weight=1)

        self.day_cells = {}  # (row, col) -> frame

    def _build_habit_checkboxes(self):
        for w in self.habit_frame.winfo_children(): w.destroy()
        for h in self.habits:
            row = tk.Frame(self.habit_frame, bg="#0f172a")
            row.pack(fill="x", pady=2)
            var = tk.BooleanVar(value=h['id'] in self.selected_habits)
            cb = tk.Checkbutton(row, text=h['name'], variable=var, bg="#0f172a", fg=h['color'],
                                 selectcolor="#1e293b", activebackground="#0f172a",
                                 font=("",11,"bold"), cursor="hand2",
                                 command=lambda hid=h['id'], v=var: self._toggle_habit(hid, v))
            cb.pack(side="left")
            # Edit button
            tk.Label(row, text="●", fg=h['color'], bg="#0f172a", font=("",12)).pack(side="left", padx=2)
            tk.Button(row, text="✏", bg="#1e293b", fg="#64748b", relief="flat", padx=3, pady=1,
                      cursor="hand2", command=lambda hid=h['id']: self._edit_habit(hid)).pack(side="right")
            tk.Button(row, text="🗑", bg="#1e293b", fg="#64748b", relief="flat", padx=3, pady=1,
                      cursor="hand2", command=lambda hid=h['id']: self._del_habit(hid)).pack(side="right")

    def _toggle_habit(self, hid, var):
        if var.get(): self.selected_habits.add(hid)
        else: self.selected_habits.discard(hid)
        self._refresh()

    # ── Calendar ──────────────────────────────────────
    def _refresh(self):
        y, m = self.year.get(), self.month.get()
        self.nav_label.config(text=f"{y}年 {MONTH_JP[m]}")

        self._build_habit_checkboxes()
        self._draw_calendar(y, m)
        self._draw_stats(y, m)

    def _draw_calendar(self, y, m):
        # Clear old cells
        for w in self.cal_frame.winfo_children(): w.destroy()
        self.day_cells.clear()

        cal = calendar.monthcalendar(y, m)
        today = date.today()

        selected = [h for h in self.habits if h['id'] in self.selected_habits]

        for row_i, week in enumerate(cal):
            for col_i, day in enumerate(week):
                cell = tk.Frame(self.cal_frame, bg="#1e293b", bd=1, relief="solid",
                                 highlightbackground="#334155", highlightthickness=1)
                cell.grid(row=row_i, column=col_i, sticky="nsew", padx=1, pady=1)

                if day == 0:
                    cell.configure(bg="#0f172a")
                    continue

                d = date(y, m, day)
                is_today = d == today
                is_weekend = col_i >= 5

                # Day number
                day_color = '#f87171' if is_weekend else '#e2e8f0'
                if is_today: day_color = '#60a5fa'
                day_lbl = tk.Label(cell, text=str(day), font=("",10,"bold"),
                                    bg="#1e293b", fg=day_color)
                day_lbl.pack(anchor="w", padx=4, pady=(2,0))

                if is_today:
                    cell.configure(highlightbackground="#60a5fa", highlightthickness=2)

                # Habit dots
                dots_frame = tk.Frame(cell, bg="#1e293b")
                dots_frame.pack(fill="x", padx=4, pady=(1,3))

                for h in selected:
                    done = self._is_done(h['id'], d)
                    dot = tk.Label(dots_frame, text="●" if done else "○",
                                   font=("",9), bg="#1e293b",
                                   fg=h['color'] if done else "#334155",
                                   cursor="hand2")
                    dot.pack(side="left", padx=1)
                    dot.bind("<Button-1>", lambda e, hid=h['id'], dd=d: self._toggle(hid, dd))

                day_lbl.bind("<Button-1>", lambda e, dd=d: self._on_day_click(dd))
                self.day_cells[(row_i, col_i)] = cell

        # Configure rows
        for r in range(len(cal)):
            self.cal_frame.rowconfigure(r, weight=1)

    def _on_day_click(self, d: date):
        # Toggle all selected habits for this day
        for h in self.habits:
            if h['id'] in self.selected_habits:
                self._toggle(h['id'], d)

    def _draw_stats(self, y, m):
        canvas = self.stats_canvas
        canvas.update_idletasks()
        canvas.delete("all")
        W = canvas.winfo_width() or 200; H = 160
        days_in_month = calendar.monthrange(y, m)[1]

        # Weekly bar chart
        weeks = {}
        for d_num in range(1, days_in_month+1):
            d = date(y, m, d_num)
            week = d.isocalendar()[1]
            if week not in weeks: weeks[week] = 0
            for h in self.habits:
                if h['id'] in self.selected_habits and self._is_done(h['id'], d):
                    weeks[week] += 1

        if not weeks:
            canvas.create_text(W//2, H//2, text="データなし", fill="#334155", font=("",10))
            return

        n_weeks = len(weeks)
        max_v = max(weeks.values()) or 1
        bar_w = (W - 20) / n_weeks
        pad = 10

        for i, (week, count) in enumerate(sorted(weeks.items())):
            bh = (H-30) * count / max_v
            bx = pad + i * bar_w
            canvas.create_rectangle(bx+2, H-20-bh, bx+bar_w-4, H-20,
                                     fill="#1e3a5f", outline="")
            canvas.create_rectangle(bx+2, H-20-bh, bx+bar_w-4, H-20,
                                     fill="#60a5fa", outline="")
            canvas.create_text(bx + bar_w/2, H-10, text=f"W{i+1}", fill="#334155", font=("",8))

        # Completion rates
        for w in self.rates_frame.winfo_children(): w.destroy()
        for h in self.habits:
            if h['id'] not in self.selected_habits: continue
            done = sum(1 for d_num in range(1, days_in_month+1)
                       if self._is_done(h['id'], date(y,m,d_num)))
            past = sum(1 for d_num in range(1, min(date.today().day+1, days_in_month+1))
                       if date(y,m,d_num) <= date.today())
            pct = done / past * 100 if past > 0 else 0

            row = tk.Frame(self.rates_frame, bg="#1e293b")
            row.pack(fill="x", pady=2)
            tk.Label(row, text=h['name'][:6], font=("",9), bg="#1e293b",
                      fg=h['color'], width=6, anchor="w").pack(side="left")
            bar_bg = tk.Frame(row, bg="#334155", height=8)
            bar_bg.pack(side="left", fill="x", expand=True, padx=4)
            tk.Frame(bar_bg, bg=h['color'], width=int(pct), height=8).place(x=0,y=0)
            tk.Label(row, text=f"{pct:.0f}%", font=("",9), bg="#1e293b",
                      fg=h['color'], width=5).pack(side="right")

    # ── Navigation ────────────────────────────────────
    def _shift_month(self, delta):
        y, m = self.year.get(), self.month.get()
        m += delta
        if m > 12: m=1; y+=1
        if m < 1:  m=12; y-=1
        self.year.set(y); self.month.set(m); self._refresh()

    def _go_today(self):
        t = date.today()
        self.year.set(t.year); self.month.set(t.month); self._refresh()

    # ── Habit management ──────────────────────────────
    def _add_habit(self):
        name = simpledialog.askstring("習慣を追加", "習慣名を入力:", parent=self)
        if not name or not name.strip(): return
        result = colorchooser.askcolor(color="#4ade80", title="色を選択", parent=self)
        color = result[1] or "#4ade80"
        import uuid
        hid = str(uuid.uuid4())[:8]
        self.habits.append({'id':hid,'name':name.strip(),'color':color,'records':{}})
        self.selected_habits.add(hid)
        self._save(); self._refresh()

    def _edit_habit(self, hid):
        h = next((h for h in self.habits if h['id']==hid), None)
        if not h: return
        name = simpledialog.askstring("名前変更", "新しい名前:", initialvalue=h['name'], parent=self)
        if name and name.strip(): h['name'] = name.strip()
        result = colorchooser.askcolor(color=h['color'], title="色を変更", parent=self)
        if result[1]: h['color'] = result[1]
        self._save(); self._refresh()

    def _del_habit(self, hid):
        h = next((h for h in self.habits if h['id']==hid), None)
        if not h: return
        if messagebox.askyesno("確認", f"「{h['name']}」を削除しますか？", parent=self):
            self.habits = [x for x in self.habits if x['id'] != hid]
            self.selected_habits.discard(hid)
            self._save(); self._refresh()

    # ── Export ────────────────────────────────────────
    def _export_csv(self):
        path = filedialog.asksaveasfilename(title="CSVエクスポート",
                                             defaultextension=".csv",
                                             filetypes=[("CSV","*.csv")])
        if not path: return
        y, m = self.year.get(), self.month.get()
        days_in_month = calendar.monthrange(y, m)[1]
        with open(path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            header = ['日付'] + [h['name'] for h in self.habits]
            writer.writerow(header)
            for d_num in range(1, days_in_month+1):
                d = date(y, m, d_num)
                row = [d.isoformat()] + [('✓' if self._is_done(h['id'], d) else '') for h in self.habits]
                writer.writerow(row)
        messagebox.showinfo("完了", f"エクスポートしました:\n{path}", parent=self)


if __name__ == "__main__":
    app = HabitCalendar()
    app.mainloop()
