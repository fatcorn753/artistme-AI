#!/usr/bin/env python3
"""
Habit Tracker — 習慣トラッカー
GitHub風ヒートマップで365日の記録を可視化。標準ライブラリのみ。
"""

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog, colorchooser
import json
from pathlib import Path
from datetime import date, timedelta
import calendar


DATA_FILE = Path.home() / ".habit_tracker.json"
WEEK_LABELS = ["月","火","水","木","金","土","日"]
MONTH_LABELS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"]


class HabitTracker(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Habit Tracker 🌱")
        self.geometry("960x640")
        self.configure(bg="#0d1117")
        self.resizable(True, True)

        self.habits: list[dict] = []
        self.selected_habit_idx: int = 0
        self._load()
        self._build_ui()
        if self.habits:
            self._select_habit(0)

    # ── Persistence ───────────────────────────────────
    def _load(self):
        if DATA_FILE.exists():
            try: self.habits = json.loads(DATA_FILE.read_text())
            except: self.habits = []

    def _save(self):
        DATA_FILE.write_text(json.dumps(self.habits, ensure_ascii=False, indent=2))

    # ── UI ────────────────────────────────────────────
    def _build_ui(self):
        s = ttk.Style(self)
        s.theme_use("clam")
        BG="#0d1117"; FG="#e6edf3"; FG2="#8b949e"; CARD="#161b22"; BORDER="#30363d"
        s.configure(".", background=BG, foreground=FG)
        s.configure("TFrame", background=BG)
        s.configure("TLabel", background=BG, foreground=FG)
        s.configure("TButton", background="#21262d", foreground=FG, padding=5)
        s.map("TButton", background=[("active","#30363d")])
        s.configure("Accent.TButton", background="#238636", foreground="white")
        s.map("Accent.TButton", background=[("active","#2ea043")])
        s.configure("TEntry", fieldbackground=CARD, foreground=FG, insertcolor=FG)
        s.configure("TScrollbar", background=CARD, troughcolor=BG, arrowcolor=FG2)

        # ── Header ──
        hdr = tk.Frame(self, bg=BG)
        hdr.pack(fill="x", padx=16, pady=(12,6))
        tk.Label(hdr, text="🌱 Habit Tracker", font=("",15,"bold"),
                 bg=BG, fg="#3fb950").pack(side="left")

        btn_frame = tk.Frame(hdr, bg=BG)
        btn_frame.pack(side="right")
        ttk.Button(btn_frame, text="+ 習慣を追加", style="Accent.TButton",
                   command=self._add_habit).pack(side="left", padx=3)
        ttk.Button(btn_frame, text="今日を記録", command=self._toggle_today).pack(side="left", padx=3)

        # ── Main area ──
        main = tk.Frame(self, bg=BG)
        main.pack(fill="both", expand=True, padx=10)

        # Sidebar: habit list
        self.sidebar = tk.Frame(main, bg=CARD, width=200)
        self.sidebar.pack(side="left", fill="y", padx=(0,8), pady=4)
        self.sidebar.pack_propagate(False)

        tk.Label(self.sidebar, text="習慣一覧", font=("",11,"bold"),
                 bg=CARD, fg=FG2).pack(anchor="w", padx=10, pady=(8,4))

        self.habit_list_frame = tk.Frame(self.sidebar, bg=CARD)
        self.habit_list_frame.pack(fill="both", expand=True)

        # Content area
        self.content = tk.Frame(main, bg=BG)
        self.content.pack(side="left", fill="both", expand=True)

        # Habit title + streak
        self.habit_title = tk.Label(self.content, text="", font=("",18,"bold"),
                                     bg=BG, fg="#3fb950", anchor="w")
        self.habit_title.pack(fill="x", padx=4, pady=(4,2))

        # Stats row
        self.stats_frame = tk.Frame(self.content, bg=BG)
        self.stats_frame.pack(fill="x", padx=4, pady=(0,8))

        # Heatmap canvas
        hm_wrap = tk.Frame(self.content, bg=CARD, bd=1, relief="solid")
        hm_wrap.pack(fill="x", padx=4, pady=4)
        self.heatmap = tk.Canvas(hm_wrap, bg=CARD, bd=0, highlightthickness=0, height=130)
        self.heatmap.pack(fill="x", padx=10, pady=8)

        # Today toggle + note
        ctrl = tk.Frame(self.content, bg=BG)
        ctrl.pack(fill="x", padx=4, pady=6)
        self.today_btn = tk.Button(ctrl, text="✅ 今日を達成済みにする",
                                    bg="#238636", fg="white", font=("",12,"bold"),
                                    relief="flat", padx=14, pady=8, cursor="hand2",
                                    command=self._toggle_today)
        self.today_btn.pack(side="left")

        self.today_label = tk.Label(ctrl, text="", font=("",11),
                                     bg=BG, fg=FG2)
        self.today_label.pack(side="left", padx=12)

        # Edit / delete
        edit_frame = tk.Frame(self.content, bg=BG)
        edit_frame.pack(fill="x", padx=4, pady=2)
        ttk.Button(edit_frame, text="✏ 名前を変更", command=self._rename_habit).pack(side="left", padx=(0,4))
        ttk.Button(edit_frame, text="🎨 色を変更", command=self._change_color).pack(side="left", padx=(0,4))
        ttk.Button(edit_frame, text="🗑 削除", command=self._delete_habit).pack(side="left")

        # Weekly calendar
        cal_wrap = tk.LabelFrame(self.content, text="今週", bg=CARD, fg=FG2,
                                  font=("",10), bd=1, relief="solid")
        cal_wrap.pack(fill="x", padx=4, pady=8)
        self.week_frame = tk.Frame(cal_wrap, bg=CARD)
        self.week_frame.pack(pady=8)

        self._refresh_sidebar()

    def _refresh_sidebar(self):
        for w in self.habit_list_frame.winfo_children():
            w.destroy()

        if not self.habits:
            tk.Label(self.habit_list_frame, text="習慣を追加してください",
                     font=("",10), bg="#161b22", fg="#484f58",
                     wraplength=160).pack(padx=10, pady=20)
            return

        for i, h in enumerate(self.habits):
            today = date.today().isoformat()
            done = today in h.get("records", [])
            color = h.get("color", "#3fb950")
            bg = "#1c2128" if i == self.selected_habit_idx else "#161b22"

            btn = tk.Frame(self.habit_list_frame, bg=bg, cursor="hand2")
            btn.pack(fill="x", padx=4, pady=2)

            dot = tk.Label(btn, text="●", font=("",14), bg=bg,
                           fg=color if done else "#30363d")
            dot.pack(side="left", padx=6, pady=6)

            name_lbl = tk.Label(btn, text=h["name"][:20], font=("",11),
                                 bg=bg, fg="#e6edf3" if i==self.selected_habit_idx else "#8b949e",
                                 anchor="w")
            name_lbl.pack(side="left", fill="x", expand=True, pady=6)

            for w in [btn, dot, name_lbl]:
                w.bind("<Button-1>", lambda e, idx=i: self._select_habit(idx))

    def _select_habit(self, idx):
        self.selected_habit_idx = idx
        self._refresh_sidebar()
        self._refresh_content()

    def _refresh_content(self):
        if not self.habits or self.selected_habit_idx >= len(self.habits):
            self.habit_title.config(text="習慣を追加してください")
            return

        h = self.habits[self.selected_habit_idx]
        color = h.get("color", "#3fb950")
        records = set(h.get("records", []))
        today = date.today()
        today_str = today.isoformat()

        self.habit_title.config(text=h["name"], fg=color)

        # Stats
        for w in self.stats_frame.winfo_children(): w.destroy()

        streak = self._calc_streak(records, today)
        total  = len(records)
        best   = self._calc_best_streak(records)

        for label, val in [("🔥 現在の連続", str(streak)+"日"),
                            ("📅 合計記録", str(total)+"日"),
                            ("🏆 最高連続", str(best)+"日")]:
            f = tk.Frame(self.stats_frame, bg="#161b22", bd=1, relief="solid")
            f.pack(side="left", padx=4, pady=2, ipadx=10, ipady=6)
            tk.Label(f, text=label, font=("",9), bg="#161b22", fg="#8b949e").pack()
            tk.Label(f, text=val, font=("",16,"bold"), bg="#161b22", fg=color).pack()

        # Today button
        done_today = today_str in records
        if done_today:
            self.today_btn.config(text="✅ 今日完了！（タップで取消）", bg="#1a3a1a")
        else:
            self.today_btn.config(text="○ 今日を達成済みにする", bg="#238636")
        self.today_label.config(text=f"今日: {today_str}")

        # Heatmap
        self._draw_heatmap(records, color)

        # Weekly calendar
        for w in self.week_frame.winfo_children(): w.destroy()
        monday = today - timedelta(days=today.weekday())
        for i in range(7):
            d = monday + timedelta(days=i)
            ds = d.isoformat()
            done = ds in records
            is_today = d == today
            frame_bg = "#161b22"
            dot_color = color if done else "#21262d"
            border = color if is_today else "#30363d"
            f = tk.Frame(self.week_frame, bg=frame_bg, bd=2,
                         relief="solid", highlightbackground=border)
            f.pack(side="left", padx=3)
            tk.Label(f, text=WEEK_LABELS[i], font=("",9), bg=frame_bg, fg="#8b949e").pack(padx=8, pady=(4,0))
            tk.Label(f, text="●" if done else "○", font=("",16), bg=frame_bg, fg=dot_color).pack(padx=8, pady=(0,4))
            tk.Label(f, text=str(d.day), font=("",9), bg=frame_bg, fg="#484f58").pack(pady=(0,4))

    def _draw_heatmap(self, records, color):
        self.heatmap.update_idletasks()
        self.heatmap.delete("all")
        W = self.heatmap.winfo_width() or 700

        today = date.today()
        start = today - timedelta(days=364)
        start = start - timedelta(days=start.weekday())  # Monday

        CELL = 13; GAP = 2; STEP = CELL + GAP
        LEFT = 28; TOP = 20

        # Month labels
        d = start; col = 0; last_month = -1
        while d <= today:
            if d.month != last_month:
                x = LEFT + col * STEP
                self.heatmap.create_text(x, 6, text=f"{d.month}月",
                                          anchor="w", fill="#8b949e", font=("",8))
                last_month = d.month
            d += timedelta(weeks=1); col += 1

        # Day labels
        for i, lbl in enumerate(["月","水","金"]):
            y = TOP + (i*2) * STEP + CELL//2
            self.heatmap.create_text(14, y, text=lbl, anchor="center",
                                      fill="#8b949e", font=("",8))

        # Cells
        d = start; col = 0
        while d <= today:
            for row in range(7):
                dd = d + timedelta(days=row)
                if dd > today: break
                ds = dd.isoformat()
                x = LEFT + col * STEP
                y = TOP + row * STEP
                done = ds in records
                fill = color if done else "#21262d"
                self.heatmap.create_rectangle(x, y, x+CELL, y+CELL,
                                               fill=fill, outline="", width=0)
            d += timedelta(weeks=1); col += 1

    def _calc_streak(self, records, today):
        streak = 0; d = today
        while d.isoformat() in records:
            streak += 1; d -= timedelta(days=1)
        return streak

    def _calc_best_streak(self, records):
        if not records: return 0
        dates = sorted(date.fromisoformat(r) for r in records)
        best = cur = 1
        for i in range(1, len(dates)):
            if dates[i] - dates[i-1] == timedelta(days=1): cur += 1
            else: cur = 1
            best = max(best, cur)
        return best

    # ── Actions ───────────────────────────────────────
    def _add_habit(self):
        name = simpledialog.askstring("習慣を追加", "習慣の名前:", parent=self)
        if not name or not name.strip(): return
        colors = ["#3fb950","#58a6ff","#f0883e","#a371f7","#f78166","#79c0ff"]
        color = colors[len(self.habits) % len(colors)]
        self.habits.append({"name": name.strip(), "color": color, "records": []})
        self._save()
        self._select_habit(len(self.habits) - 1)
        self._refresh_sidebar()

    def _toggle_today(self):
        if not self.habits: return
        h = self.habits[self.selected_habit_idx]
        today = date.today().isoformat()
        recs = h.setdefault("records", [])
        if today in recs: recs.remove(today)
        else: recs.append(today)
        self._save()
        self._refresh_sidebar()
        self._refresh_content()

    def _rename_habit(self):
        if not self.habits: return
        h = self.habits[self.selected_habit_idx]
        new_name = simpledialog.askstring("名前を変更", "新しい名前:", initialvalue=h["name"], parent=self)
        if new_name and new_name.strip():
            h["name"] = new_name.strip()
            self._save(); self._refresh_sidebar(); self._refresh_content()

    def _change_color(self):
        if not self.habits: return
        h = self.habits[self.selected_habit_idx]
        result = colorchooser.askcolor(color=h.get("color","#3fb950"), parent=self, title="色を選択")
        if result[1]:
            h["color"] = result[1]
            self._save(); self._refresh_sidebar(); self._refresh_content()

    def _delete_habit(self):
        if not self.habits: return
        h = self.habits[self.selected_habit_idx]
        if not messagebox.askyesno("確認", f"「{h['name']}」を削除しますか？"): return
        self.habits.pop(self.selected_habit_idx)
        self.selected_habit_idx = max(0, self.selected_habit_idx - 1)
        self._save(); self._refresh_sidebar()
        if self.habits: self._refresh_content()

    # Redraw heatmap on resize
    def _on_resize(self, e=None):
        self.after(100, self._refresh_content)


if __name__ == "__main__":
    app = HabitTracker()
    app.bind("<Configure>", app._on_resize)
    app.mainloop()
