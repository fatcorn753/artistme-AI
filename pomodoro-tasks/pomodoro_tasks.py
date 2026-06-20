#!/usr/bin/env python3
"""
Pomodoro + Task Manager — タスク連携ポモドーロアプリ
タスクリスト管理 + ポモドーロタイマーを統合。
完了したポモドーロ数を各タスクに記録し、生産性を可視化。
標準ライブラリのみ。
"""

import tkinter as tk
from tkinter import ttk, messagebox
import json
from pathlib import Path
from datetime import date, datetime
import math


DATA_FILE = Path.home() / ".pomodoro_tasks.json"
WORK_MIN   = 25
SHORT_MIN  = 5
LONG_MIN   = 15
LONG_EVERY = 4


class PomodoroTasks(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Pomodoro + Tasks 🍅")
        self.geometry("760x560")
        self.configure(bg="#0d1117")
        self.resizable(True, True)

        self.tasks = []
        self.selected_task_idx = None
        self.pomodoro_count = 0
        self.mode = "work"      # work | short | long
        self.running = False
        self.time_left = WORK_MIN * 60
        self.timer_job = None
        self.total_pomodoros_today = 0

        self._load()
        self._build_ui()
        self._refresh_tasks()
        self._update_display()

    # ── Persistence ───────────────────────────────────
    def _load(self):
        if DATA_FILE.exists():
            try: d = json.loads(DATA_FILE.read_text()); self.tasks = d.get("tasks", [])
            except: pass

    def _save(self):
        DATA_FILE.write_text(json.dumps({"tasks": self.tasks}, ensure_ascii=False, indent=2))

    # ── UI ────────────────────────────────────────────
    def _build_ui(self):
        s = ttk.Style(self); s.theme_use("clam")
        BG="#0d1117"; CARD="#161b22"; FG="#e6edf3"; FG2="#8b949e"; BORDER="#30363d"
        s.configure(".", background=BG, foreground=FG)
        s.configure("TFrame", background=BG)
        s.configure("TLabel", background=BG, foreground=FG)
        s.configure("TButton", background="#21262d", foreground=FG, padding=5)
        s.map("TButton", background=[("active","#30363d")])
        s.configure("Red.TButton", background="#b91c1c", foreground="white")
        s.map("Red.TButton", background=[("active","#dc2626")])
        s.configure("TEntry", fieldbackground=CARD, foreground=FG, insertcolor=FG)
        s.configure("Treeview", background=CARD, foreground=FG, fieldbackground=CARD, rowheight=28)
        s.configure("Treeview.Heading", background=BORDER, foreground=FG2, font=("",10))
        s.map("Treeview", background=[("selected","#1f6feb")])

        main = tk.Frame(self, bg=BG)
        main.pack(fill="both", expand=True, padx=10, pady=10)

        # ── LEFT: Timer ──
        left = tk.Frame(main, bg=BG, width=280)
        left.pack(side="left", fill="y", padx=(0,10))
        left.pack_propagate(False)

        # Mode tabs
        mode_row = tk.Frame(left, bg=BG)
        mode_row.pack(fill="x", pady=(0,6))
        self.mode_btns = {}
        for m, label in [("work","🍅 集中"), ("short","☕ 小休憩"), ("long","🛌 長休憩")]:
            btn = tk.Button(mode_row, text=label, bg="#21262d", fg="#8b949e",
                            relief="flat", padx=6, pady=4, font=("",10), cursor="hand2",
                            command=lambda mm=m: self._set_mode(mm))
            btn.pack(side="left", padx=2)
            self.mode_btns[m] = btn

        # Ring canvas
        self.ring_canvas = tk.Canvas(left, width=240, height=240, bg=BG, bd=0, highlightthickness=0)
        self.ring_canvas.pack(pady=4)

        # Controls
        ctrl = tk.Frame(left, bg=BG)
        ctrl.pack(fill="x", pady=6)
        self.start_btn = tk.Button(ctrl, text="▶ スタート", bg="#238636", fg="white",
                                    relief="flat", padx=16, pady=8, font=("",12,"bold"),
                                    cursor="hand2", command=self._toggle_timer)
        self.start_btn.pack(side="left", padx=4)
        tk.Button(ctrl, text="↺ リセット", bg="#21262d", fg="#8b949e",
                  relief="flat", padx=10, pady=8, font=("",11),
                  cursor="hand2", command=self._reset_timer).pack(side="left", padx=4)
        tk.Button(ctrl, text="⏭ スキップ", bg="#21262d", fg="#8b949e",
                  relief="flat", padx=10, pady=8, font=("",11),
                  cursor="hand2", command=self._skip).pack(side="left", padx=4)

        # Stats
        stats_frame = tk.LabelFrame(left, text="今日の実績", bg="#161b22", fg="#8b949e",
                                     font=("",10), bd=1, relief="solid")
        stats_frame.pack(fill="x", pady=6)
        self.stats_labels = {}
        for key, label in [("pomodoros","完了ポモドーロ"), ("focus_time","集中時間"), ("tasks_done","完了タスク")]:
            row = tk.Frame(stats_frame, bg="#161b22")
            row.pack(fill="x", padx=10, pady=3)
            tk.Label(row, text=label, font=("",9), bg="#161b22", fg="#8b949e").pack(side="left")
            lbl = tk.Label(row, text="0", font=("",11,"bold"), bg="#161b22", fg="#e6edf3")
            lbl.pack(side="right")
            self.stats_labels[key] = lbl

        # ── RIGHT: Tasks ──
        right = tk.Frame(main, bg=BG)
        right.pack(side="left", fill="both", expand=True)

        task_hdr = tk.Frame(right, bg=BG)
        task_hdr.pack(fill="x", pady=(0,6))
        tk.Label(task_hdr, text="📋 タスク", font=("",13,"bold"), bg=BG, fg="#e6edf3").pack(side="left")
        tk.Button(task_hdr, text="＋ 追加", bg="#238636", fg="white",
                  relief="flat", padx=8, pady=4, cursor="hand2",
                  command=self._add_task).pack(side="right")

        # Task input
        input_row = tk.Frame(right, bg=BG)
        input_row.pack(fill="x", pady=(0,6))
        self.task_input = ttk.Entry(input_row, font=("",12))
        self.task_input.pack(side="left", fill="x", expand=True, padx=(0,6))
        self.task_input.bind("<Return>", lambda _: self._add_task())
        self._est_var = tk.IntVar(value=2)
        ttk.Spinbox(input_row, from_=1, to=20, width=4,
                    textvariable=self._est_var).pack(side="left")
        tk.Label(input_row, text="🍅予定", bg=BG, fg="#8b949e", font=("",10)).pack(side="left", padx=4)

        # Task list
        cols = ("","タスク名","🍅予定","🍅完了","状態")
        self.task_tree = ttk.Treeview(right, columns=cols, show="headings", height=14)
        widths = [30, 200, 60, 60, 80]
        for col, w in zip(cols, widths):
            self.task_tree.heading(col, text=col)
            self.task_tree.column(col, width=w)
        vsb = ttk.Scrollbar(right, orient="vertical", command=self.task_tree.yview)
        self.task_tree.configure(yscrollcommand=vsb.set)

        tr_frame = tk.Frame(right, bg=BG)
        tr_frame.pack(fill="both", expand=True)
        self.task_tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        self.task_tree.bind("<ButtonRelease-1>", self._on_task_click)
        self.task_tree.bind("<Double-1>", self._toggle_task_done)

        # Task actions
        act_row = tk.Frame(right, bg=BG)
        act_row.pack(fill="x", pady=6)
        for label, cmd in [("✅ 完了", self._toggle_task_done), ("🗑 削除", self._delete_task),
                           ("▲ 上へ", lambda: self._move_task(-1)), ("▼ 下へ", lambda: self._move_task(1))]:
            tk.Button(act_row, text=label, bg="#21262d", fg="#8b949e",
                      relief="flat", padx=8, pady=4, cursor="hand2", command=cmd).pack(side="left", padx=2)

        tk.Label(act_row, text="選択タスクでポモドーロを開始 →", bg=BG, fg="#484f58", font=("",9)).pack(side="right", padx=4)

        self.bind("<space>", lambda _: self._toggle_timer())

    # ── Timer ─────────────────────────────────────────
    def _set_mode(self, mode):
        if self.running: self._toggle_timer()
        self.mode = mode
        self.time_left = {"work": WORK_MIN, "short": SHORT_MIN, "long": LONG_MIN}[mode] * 60
        for m, btn in self.mode_btns.items():
            btn.config(bg="#1f6feb" if m == mode else "#21262d",
                       fg="white" if m == mode else "#8b949e")
        self._update_display()

    def _toggle_timer(self):
        if self.running:
            self.running = False
            if self.timer_job: self.after_cancel(self.timer_job); self.timer_job = None
            self.start_btn.config(text="▶ スタート", bg="#238636")
        else:
            self.running = True
            self.start_btn.config(text="⏸ 一時停止", bg="#b45309")
            self._tick()

    def _tick(self):
        if not self.running: return
        self.time_left -= 1
        self._update_display()
        if self.time_left <= 0:
            self._on_timer_done()
        else:
            self.timer_job = self.after(1000, self._tick)

    def _on_timer_done(self):
        self.running = False
        self.start_btn.config(text="▶ スタート", bg="#238636")

        if self.mode == "work":
            self.pomodoro_count += 1
            self.total_pomodoros_today += 1
            # Record pomodoro on selected task
            if self.selected_task_idx is not None and self.selected_task_idx < len(self.tasks):
                self.tasks[self.selected_task_idx]["done_pomodoros"] = \
                    self.tasks[self.selected_task_idx].get("done_pomodoros", 0) + 1
                self._save(); self._refresh_tasks()

            self._update_stats()
            # Auto switch to break
            if self.pomodoro_count % LONG_EVERY == 0:
                self._set_mode("long")
                messagebox.showinfo("🛌 長休憩！", f"{LONG_EVERY}ポモドーロ完了！{LONG_MIN}分休憩しましょう。")
            else:
                self._set_mode("short")
                messagebox.showinfo("☕ 短休憩！", f"ポモドーロ完了！{SHORT_MIN}分休憩しましょう。")
        else:
            self._set_mode("work")
            messagebox.showinfo("🍅 集中！", f"休憩終了！次のポモドーロを始めましょう。")

    def _reset_timer(self):
        if self.running: self._toggle_timer()
        self.time_left = {"work": WORK_MIN, "short": SHORT_MIN, "long": LONG_MIN}[self.mode] * 60
        self._update_display()

    def _skip(self):
        self._on_timer_done()

    def _update_display(self):
        m = self.time_left // 60; s = self.time_left % 60
        total = {"work": WORK_MIN, "short": SHORT_MIN, "long": LONG_MIN}[self.mode] * 60
        pct = 1 - self.time_left / total if total > 0 else 1

        C = self.ring_canvas; C.delete("all")
        W = H = 240; cx = cy = 120; R = 100; lw = 12
        CIRC = 2 * math.pi * R

        # Background ring
        C.create_arc(cx-R, cy-R, cx+R, cy+R, start=90, extent=360,
                     style="arc", outline="#21262d", width=lw)
        # Progress ring
        colors = {"work": "#f87171", "short": "#4ade80", "long": "#60a5fa"}
        extent = -360 * pct
        if abs(extent) > 1:
            C.create_arc(cx-R, cy-R, cx+R, cy+R, start=90, extent=extent,
                         style="arc", outline=colors[self.mode], width=lw)

        # Time text
        C.create_text(cx, cy - 12, text=f"{m:02d}:{s:02d}",
                      font=("Menlo", 36, "bold"), fill="#e6edf3")
        labels = {"work": "集中", "short": "短休憩", "long": "長休憩"}
        C.create_text(cx, cy + 26, text=labels[self.mode],
                      font=("", 14), fill="#8b949e")

        # Pomodoro dots
        dot_r = 6; dots_y = cy + 60
        total_dots = min(LONG_EVERY, 8)
        start_x = cx - (total_dots * (dot_r*2+4)) // 2
        for i in range(total_dots):
            color = colors["work"] if i < (self.pomodoro_count % LONG_EVERY) else "#21262d"
            dx = start_x + i * (dot_r*2+4) + dot_r
            C.create_oval(dx-dot_r, dots_y-dot_r, dx+dot_r, dots_y+dot_r, fill=color, outline="")

        # Task name
        if self.selected_task_idx is not None and self.selected_task_idx < len(self.tasks):
            name = self.tasks[self.selected_task_idx]["name"][:28]
            C.create_text(cx, cy + 88, text=f"📋 {name}", font=("",10), fill="#8b949e")

    def _update_stats(self):
        self.stats_labels["pomodoros"].config(text=str(self.total_pomodoros_today))
        mins = self.total_pomodoros_today * WORK_MIN
        self.stats_labels["focus_time"].config(text=f"{mins}分")
        done = sum(1 for t in self.tasks if t.get("completed"))
        self.stats_labels["tasks_done"].config(text=str(done))

    # ── Tasks ─────────────────────────────────────────
    def _refresh_tasks(self):
        self.task_tree.delete(*self.task_tree.get_children())
        today = date.today().isoformat()
        for i, t in enumerate(self.tasks):
            est   = t.get("estimated_pomodoros", 1)
            done  = t.get("done_pomodoros", 0)
            comp  = t.get("completed", False)
            status = "✅ 完了" if comp else ("🍅" * min(done, est)) or "—"
            mark  = "✅" if comp else ("🎯" if i == self.selected_task_idx else "")
            iid = str(i)
            self.task_tree.insert("", "end", iid=iid,
                                   values=(mark, t["name"], est, done, status))
            if comp:
                self.task_tree.item(iid, tags=("done",))
        self.task_tree.tag_configure("done", foreground="#484f58")
        self._update_stats()

    def _add_task(self):
        name = self.task_input.get().strip()
        if not name: return
        self.tasks.append({"name": name, "estimated_pomodoros": self._est_var.get(),
                           "done_pomodoros": 0, "completed": False,
                           "created": date.today().isoformat()})
        self.task_input.delete(0, "end")
        self._save(); self._refresh_tasks()

    def _on_task_click(self, event=None):
        sel = self.task_tree.selection()
        if sel:
            self.selected_task_idx = int(sel[0])
            self._update_display()

    def _toggle_task_done(self, event=None):
        sel = self.task_tree.selection()
        if not sel: return
        idx = int(sel[0])
        self.tasks[idx]["completed"] = not self.tasks[idx].get("completed", False)
        self._save(); self._refresh_tasks()

    def _delete_task(self):
        sel = self.task_tree.selection()
        if not sel: return
        idx = int(sel[0])
        if not messagebox.askyesno("確認", f"「{self.tasks[idx]['name']}」を削除しますか？"): return
        self.tasks.pop(idx)
        if self.selected_task_idx == idx: self.selected_task_idx = None
        self._save(); self._refresh_tasks(); self._update_display()

    def _move_task(self, delta):
        sel = self.task_tree.selection()
        if not sel: return
        idx = int(sel[0]); new_idx = idx + delta
        if 0 <= new_idx < len(self.tasks):
            self.tasks[idx], self.tasks[new_idx] = self.tasks[new_idx], self.tasks[idx]
            if self.selected_task_idx == idx: self.selected_task_idx = new_idx
            self._save(); self._refresh_tasks()
            self.task_tree.selection_set(str(new_idx))


if __name__ == "__main__":
    # Remove bad import line that was placeholder
    app = PomodoroTasks()
    app.mainloop()
