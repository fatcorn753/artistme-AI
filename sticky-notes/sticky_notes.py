#!/usr/bin/env python3
"""
Virtual Sticky Notes — デスクトップ付箋アプリ
複数の付箋をデスクトップに貼り付け、ドラッグ移動、カラーカスタマイズ、
テキスト編集、リマインダー機能。JSON永続化。標準ライブラリのみ。
"""

import tkinter as tk
from tkinter import ttk, colorchooser, messagebox, font as tkfont
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
import threading
import uuid


DATA_FILE = Path.home() / ".sticky_notes.json"

COLORS = {
    "イエロー": {"bg": "#fef08a", "fg": "#1c1917", "header": "#fde047"},
    "ピンク":   {"bg": "#fecdd3", "fg": "#1c1917", "header": "#fda4af"},
    "ブルー":   {"bg": "#bae6fd", "fg": "#0c1020", "header": "#7dd3fc"},
    "グリーン": {"bg": "#bbf7d0", "fg": "#0c1a10", "header": "#86efac"},
    "パープル": {"bg": "#e9d5ff", "fg": "#1a0c2e", "header": "#c4b5fd"},
    "オレンジ": {"bg": "#fed7aa", "fg": "#1c0a00", "header": "#fdba74"},
    "ダーク":   {"bg": "#1e1e2e", "fg": "#cdd6f4", "header": "#313244"},
}

DEFAULT_COLOR = "イエロー"
MIN_W, MIN_H = 180, 140


class StickyNote(tk.Toplevel):
    def __init__(self, app, note_data):
        super().__init__()
        self.app = app
        self.note_id = note_data.get("id", str(uuid.uuid4()))
        self.color_name = note_data.get("color", DEFAULT_COLOR)
        self.colors = COLORS[self.color_name]

        self.overrideredirect(True)
        self.attributes("-topmost", note_data.get("topmost", False))
        self.wm_attributes("-alpha", note_data.get("alpha", 0.93))
        self.configure(bg=self.colors["header"])

        # Position & size
        x = note_data.get("x", 100 + len(app.notes) * 30)
        y = note_data.get("y", 100 + len(app.notes) * 30)
        w = note_data.get("w", 240)
        h = note_data.get("h", 200)
        self.geometry(f"{w}x{h}+{x}+{y}")

        self._drag_x = self._drag_y = 0
        self._resize_x = self._resize_y = 0
        self._is_minimized = note_data.get("minimized", False)

        self._build()

        # Set text content
        self.text_widget.insert("1.0", note_data.get("content", ""))

        # Reminder
        self._reminder = note_data.get("reminder", None)
        self._reminder_done = note_data.get("reminder_done", False)

        if self._is_minimized:
            self._toggle_minimize(init=True)

        self._check_reminder()

    # ── Build UI ──────────────────────────────────────
    def _build(self):
        colors = self.colors

        # Header bar (drag handle)
        self.header = tk.Frame(self, bg=colors["header"], height=28, cursor="fleur")
        self.header.pack(fill="x")
        self.header.pack_propagate(False)

        # Color dot
        self.color_btn = tk.Label(self.header, text="⬤", bg=colors["header"],
                                   fg=colors["bg"], cursor="hand2", font=("", 12))
        self.color_btn.pack(side="left", padx=6)
        self.color_btn.bind("<Button-1>", self._show_color_menu)

        # Title
        self.title_var = tk.StringVar(value="付箋")
        self.title_entry = tk.Entry(self.header, textvariable=self.title_var,
                                     bg=colors["header"], fg=colors["fg"],
                                     insertbackground=colors["fg"],
                                     relief="flat", font=("", 10, "bold"), width=14)
        self.title_entry.pack(side="left", fill="x", expand=True, padx=4)

        # Header buttons
        for text, cmd, tip in [
            ("⏰", self._set_reminder, "リマインダー"),
            ("📌", self._toggle_topmost, "最前面固定"),
            ("─", self._toggle_minimize, "最小化"),
            ("✕", self._close_note, "閉じる"),
        ]:
            btn = tk.Label(self.header, text=text, bg=colors["header"], fg=colors["fg"],
                           cursor="hand2", font=("", 11), padx=4)
            btn.pack(side="right")
            btn.bind("<Button-1>", lambda e, c=cmd: c())

        # Body
        self.body = tk.Frame(self, bg=colors["bg"])
        self.body.pack(fill="both", expand=True)

        self.text_widget = tk.Text(
            self.body, bg=colors["bg"], fg=colors["fg"],
            insertbackground=colors["fg"], relief="flat", bd=0,
            font=("", 11), wrap="word", undo=True,
            padx=8, pady=6, spacing1=2, spacing3=2,
        )
        self.text_widget.pack(fill="both", expand=True)
        self.text_widget.bind("<KeyRelease>", lambda e: self.app.schedule_save())
        self.text_widget.bind("<Control-z>", lambda e: self.text_widget.edit_undo())
        self.text_widget.bind("<Control-y>", lambda e: self.text_widget.edit_redo())

        # Resize handle
        self.resize_grip = tk.Label(self.body, text="◢", bg=colors["header"],
                                     fg=colors["bg"], cursor="size_nw_se", font=("", 8))
        self.resize_grip.place(relx=1.0, rely=1.0, anchor="se")

        # ── Bindings ──
        for widget in (self.header, self.color_btn, self.title_entry):
            widget.bind("<ButtonPress-1>",   self._drag_start)
            widget.bind("<B1-Motion>",        self._drag_motion)
            widget.bind("<ButtonRelease-1>", self._drag_end)

        self.resize_grip.bind("<ButtonPress-1>",   self._resize_start)
        self.resize_grip.bind("<B1-Motion>",        self._resize_motion)
        self.resize_grip.bind("<ButtonRelease-1>", self._resize_end)

        self.bind("<FocusIn>", lambda e: self.lift())

    # ── Drag ─────────────────────────────────────────
    def _drag_start(self, e):
        self._drag_x = e.x_root - self.winfo_x()
        self._drag_y = e.y_root - self.winfo_y()

    def _drag_motion(self, e):
        self.geometry(f"+{e.x_root - self._drag_x}+{e.y_root - self._drag_y}")

    def _drag_end(self, e):
        self.app.schedule_save()

    # ── Resize ───────────────────────────────────────
    def _resize_start(self, e):
        self._resize_x = e.x_root
        self._resize_y = e.y_root
        self._start_w = self.winfo_width()
        self._start_h = self.winfo_height()

    def _resize_motion(self, e):
        nw = max(MIN_W, self._start_w + e.x_root - self._resize_x)
        nh = max(MIN_H, self._start_h + e.y_root - self._resize_y)
        self.geometry(f"{nw}x{nh}")

    def _resize_end(self, e):
        self.app.schedule_save()

    # ── Actions ──────────────────────────────────────
    def _toggle_minimize(self, init=False):
        self._is_minimized = not self._is_minimized if not init else True
        if self._is_minimized:
            self._saved_h = self.winfo_height()
            self.body.pack_forget()
            self.geometry(f"{self.winfo_width()}x28")
        else:
            self.body.pack(fill="both", expand=True)
            self.geometry(f"{self.winfo_width()}x{getattr(self,'_saved_h', 200)}")
        if not init: self.app.schedule_save()

    def _toggle_topmost(self):
        current = bool(self.attributes("-topmost"))
        self.attributes("-topmost", not current)
        self.app.schedule_save()

    def _close_note(self):
        if messagebox.askyesno("確認", "この付箋を削除しますか？", parent=self):
            self.app.remove_note(self.note_id)
            self.destroy()

    def _show_color_menu(self, event=None):
        menu = tk.Menu(self, tearoff=False)
        for name in COLORS:
            menu.add_command(label=name, command=lambda n=name: self._change_color(n))
        menu.add_separator()
        menu.add_command(label="透明度...", command=self._set_alpha)
        menu.post(event.x_root, event.y_root)

    def _change_color(self, name):
        self.color_name = name
        self.colors = COLORS[name]
        self._rebuild_colors()
        self.app.schedule_save()

    def _rebuild_colors(self):
        c = self.colors
        self.configure(bg=c["header"])
        self.header.configure(bg=c["header"])
        self.body.configure(bg=c["bg"])
        self.text_widget.configure(bg=c["bg"], fg=c["fg"], insertbackground=c["fg"])
        self.title_entry.configure(bg=c["header"], fg=c["fg"], insertbackground=c["fg"])
        self.color_btn.configure(bg=c["header"], fg=c["bg"])
        self.resize_grip.configure(bg=c["header"], fg=c["bg"])
        for w in self.header.winfo_children():
            if isinstance(w, tk.Label) and w != self.color_btn:
                w.configure(bg=c["header"], fg=c["fg"])

    def _set_alpha(self):
        alpha = float(self.wm_attributes("-alpha"))
        new_alpha = simpledialog_alpha(self, alpha)
        if new_alpha is not None:
            self.wm_attributes("-alpha", new_alpha)
            self.app.schedule_save()

    def _set_reminder(self):
        dlg = tk.Toplevel(self)
        dlg.title("リマインダー設定"); dlg.configure(bg="#1e1e2e"); dlg.grab_set()
        dlg.geometry("260x200")

        tk.Label(dlg, text="リマインダー時刻", bg="#1e1e2e", fg="#cdd6f4", font=("",11,"bold")).pack(pady=(14,6))

        time_var = tk.StringVar(value=(datetime.now() + timedelta(hours=1)).strftime("%H:%M"))
        ttk.Entry(dlg, textvariable=time_var, width=12).pack(pady=4)
        tk.Label(dlg, text="HH:MM形式", bg="#1e1e2e", fg="#585b70", font=("",9)).pack()

        today_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(dlg, text="今日", variable=today_var).pack(pady=6)

        def set_rem():
            try:
                t = datetime.strptime(time_var.get(), "%H:%M")
                now = datetime.now()
                remind_at = now.replace(hour=t.hour, minute=t.minute, second=0)
                if remind_at <= now: remind_at += timedelta(days=1)
                self._reminder = remind_at.isoformat()
                self._reminder_done = False
                self.app.schedule_save()
                dlg.destroy()
                self._check_reminder()
            except: pass

        tk.Button(dlg, text="設定", bg="#238636", fg="white", relief="flat",
                  padx=14, pady=6, command=set_rem).pack(pady=8)

    def _check_reminder(self):
        if self._reminder and not self._reminder_done:
            try:
                remind_at = datetime.fromisoformat(self._reminder)
                delay = int((remind_at - datetime.now()).total_seconds() * 1000)
                if delay > 0:
                    self.after(delay, self._fire_reminder)
                elif delay > -60000:
                    self._fire_reminder()
            except: pass

    def _fire_reminder(self):
        self._reminder_done = True
        self.app.schedule_save()
        self.lift()
        messagebox.showinfo("⏰ リマインダー",
                            f"付箋のリマインダー:\n\n{self.text_widget.get('1.0','end-1c')[:100]}",
                            parent=self)

    # ── Serialize ─────────────────────────────────────
    def to_dict(self):
        return {
            "id": self.note_id,
            "color": self.color_name,
            "title": self.title_var.get(),
            "content": self.text_widget.get("1.0", "end-1c"),
            "x": self.winfo_x(),
            "y": self.winfo_y(),
            "w": self.winfo_width(),
            "h": self.winfo_height(),
            "topmost": bool(self.attributes("-topmost")),
            "alpha": float(self.wm_attributes("-alpha")),
            "minimized": self._is_minimized,
            "reminder": self._reminder,
            "reminder_done": self._reminder_done,
        }


def simpledialog_alpha(parent, current):
    dlg = tk.Toplevel(parent)
    dlg.title("透明度"); dlg.configure(bg="#1e1e2e"); dlg.grab_set()
    dlg.geometry("220x120")
    result = [None]
    var = tk.DoubleVar(value=current)
    tk.Label(dlg, text="透明度 (0.3〜1.0)", bg="#1e1e2e", fg="#cdd6f4", font=("",10)).pack(pady=10)
    s = tk.Scale(dlg, from_=0.3, to=1.0, resolution=0.05, orient="horizontal",
                 variable=var, bg="#1e1e2e", fg="#cdd6f4", troughcolor="#313244",
                 length=180, showvalue=True)
    s.pack()
    def ok():
        result[0] = var.get(); dlg.destroy()
    tk.Button(dlg, text="OK", bg="#238636", fg="white", relief="flat", padx=12, command=ok).pack(pady=8)
    dlg.wait_window()
    return result[0]


# ── Controller ────────────────────────────────────────
class StickyNotesApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Sticky Notes Manager")
        self.geometry("320x420")
        self.configure(bg="#1e1e2e")
        self.resizable(False, True)

        self.notes: list[StickyNote] = []
        self._save_timer = None
        self._build_manager()
        self._load()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_manager(self):
        s = ttk.Style(self); s.theme_use("clam")
        s.configure(".", background="#1e1e2e", foreground="#cdd6f4")
        s.configure("TFrame", background="#1e1e2e")
        s.configure("TLabel", background="#1e1e2e", foreground="#cdd6f4")
        s.configure("TButton", background="#313244", foreground="#cdd6f4", padding=6)
        s.map("TButton", background=[("active","#45475a")])
        s.configure("TScrollbar", background="#313244", troughcolor="#181825")

        hdr = tk.Frame(self, bg="#181825", height=44)
        hdr.pack(fill="x"); hdr.pack_propagate(False)

        tk.Label(hdr, text="🗒 Sticky Notes", font=("",13,"bold"), bg="#181825", fg="#cba6f7").pack(side="left", padx=12)

        for text, cmd, fg in [("＋ 新規", self._new_note, "#4ade80"), ("全表示", self._show_all, "#89b4fa")]:
            tk.Button(hdr, text=text, bg="#313244", fg=fg, relief="flat",
                      padx=8, pady=4, cursor="hand2", command=cmd).pack(side="right", padx=4)

        # Color filter
        filter_frame = tk.Frame(self, bg="#1e1e2e")
        filter_frame.pack(fill="x", padx=10, pady=6)
        tk.Label(filter_frame, text="カラー:", bg="#1e1e2e", fg="#585b70", font=("",9)).pack(side="left")
        self.color_filter = tk.StringVar(value="全て")
        colors_opt = ["全て"] + list(COLORS.keys())
        ttk.Combobox(filter_frame, textvariable=self.color_filter, values=colors_opt,
                     state="readonly", width=10).pack(side="left", padx=6)
        self.color_filter.trace_add("write", lambda *_: self._refresh_list())

        # Note list
        list_frame = tk.Frame(self, bg="#1e1e2e")
        list_frame.pack(fill="both", expand=True, padx=10, pady=4)

        self.listbox = tk.Listbox(list_frame, bg="#181825", fg="#cdd6f4", selectbackground="#45475a",
                                   activestyle="none", font=("",11), relief="flat", bd=0,
                                   highlightthickness=0)
        vsb = tk.Scrollbar(list_frame, orient="vertical", command=self.listbox.yview)
        self.listbox.configure(yscrollcommand=vsb.set)
        self.listbox.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")
        self.listbox.bind("<Double-1>", self._focus_selected)

        # Action bar
        act = tk.Frame(self, bg="#1e1e2e")
        act.pack(fill="x", padx=10, pady=8)
        for text, cmd, fg in [
            ("📝 開く", self._focus_selected, "#89b4fa"),
            ("🗑 削除", self._delete_selected, "#f38ba8"),
            ("📋 複製", self._duplicate_selected, "#a6e3a1"),
        ]:
            tk.Button(act, text=text, bg="#313244", fg=fg, relief="flat",
                      padx=8, pady=5, cursor="hand2", command=cmd).pack(side="left", padx=2)

        # Stats
        self.stats_var = tk.StringVar(value="付箋: 0枚")
        tk.Label(self, textvariable=self.stats_var, bg="#1e1e2e", fg="#45475a", font=("",9)).pack(pady=4)

    def _new_note(self, data=None):
        note_data = data or {
            "id": str(uuid.uuid4()),
            "color": DEFAULT_COLOR,
            "title": f"付箋 {len(self.notes)+1}",
            "content": "",
            "x": 200 + len(self.notes) * 25,
            "y": 150 + len(self.notes) * 25,
            "w": 240, "h": 200,
        }
        note = StickyNote(self, note_data)
        self.notes.append(note)
        self.schedule_save()
        self._refresh_list()

    def _refresh_list(self):
        self.listbox.delete(0, "end")
        filt = self.color_filter.get()
        for note in self.notes:
            if filt != "全て" and note.color_name != filt: continue
            try:
                title = note.title_var.get() or "無題"
                preview = note.text_widget.get("1.0", "1.end").strip()[:30]
                self.listbox.insert("end", f"  {title}: {preview}")
            except: pass
        self.stats_var.set(f"付箋: {len(self.notes)}枚")

    def _focus_selected(self, event=None):
        sel = self.listbox.curselection()
        if not sel: return
        filt = self.color_filter.get()
        visible = [n for n in self.notes if filt == "全て" or n.color_name == filt]
        idx = sel[0]
        if idx < len(visible):
            try: visible[idx].lift(); visible[idx].focus_force()
            except: pass

    def _delete_selected(self):
        sel = self.listbox.curselection()
        if not sel: return
        filt = self.color_filter.get()
        visible = [n for n in self.notes if filt == "全て" or n.color_name == filt]
        idx = sel[0]
        if idx < len(visible):
            note = visible[idx]
            if messagebox.askyesno("確認", "この付箋を削除しますか？"):
                self.remove_note(note.note_id)
                try: note.destroy()
                except: pass

    def _duplicate_selected(self):
        sel = self.listbox.curselection()
        if not sel: return
        filt = self.color_filter.get()
        visible = [n for n in self.notes if filt == "全て" or n.color_name == filt]
        idx = sel[0]
        if idx < len(visible):
            src = visible[idx]
            data = src.to_dict()
            data["id"] = str(uuid.uuid4())
            data["x"] = data["x"] + 20
            data["y"] = data["y"] + 20
            self._new_note(data)

    def _show_all(self):
        for note in self.notes:
            try: note.deiconify(); note.lift()
            except: pass

    def remove_note(self, note_id):
        self.notes = [n for n in self.notes if n.note_id != note_id]
        self.schedule_save()
        self._refresh_list()

    def schedule_save(self):
        if self._save_timer: self.after_cancel(self._save_timer)
        self._save_timer = self.after(800, self._save)

    def _save(self):
        data = []
        for note in self.notes:
            try: data.append(note.to_dict())
            except: pass
        DATA_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        self._refresh_list()

    def _load(self):
        if DATA_FILE.exists():
            try:
                notes_data = json.loads(DATA_FILE.read_text())
                for d in notes_data:
                    self._new_note(d)
            except: pass
        if not self.notes:
            self._new_note({"id": str(uuid.uuid4()), "color": "イエロー",
                            "title": "はじめての付箋",
                            "content": "ここにメモを書けます！\nドラッグで移動\n右下角でリサイズ",
                            "x": 300, "y": 200, "w": 240, "h": 200})

    def _on_close(self):
        self._save()
        for note in self.notes[:]:
            try: note.destroy()
            except: pass
        self.destroy()


if __name__ == "__main__":
    app = StickyNotesApp()
    app.mainloop()
