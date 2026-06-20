#!/usr/bin/env python3
"""
Music Theory Helper — 音楽理論学習ツール
コード・スケール・転回形・ダイアトニックコードを視覚化。
ピアノロール表示、MIDIノート名表示。標準ライブラリのみ。
"""

import tkinter as tk
from tkinter import ttk, messagebox
import math


NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
NOTE_JP = {'C':'ド','C#':'ド#','D':'レ','D#':'レ#','E':'ミ','F':'ファ',
           'F#':'ファ#','G':'ソ','G#':'ソ#','A':'ラ','A#':'ラ#','B':'シ'}

CHORD_TYPES = {
    'メジャー (M)':          [0, 4, 7],
    'マイナー (m)':          [0, 3, 7],
    'ドミナント7th (7)':     [0, 4, 7, 10],
    'メジャー7th (M7)':      [0, 4, 7, 11],
    'マイナー7th (m7)':      [0, 3, 7, 10],
    'ディミニッシュ (dim)':   [0, 3, 6],
    'オーギュメント (aug)':   [0, 4, 8],
    'サス2 (sus2)':          [0, 2, 7],
    'サス4 (sus4)':          [0, 5, 7],
    'ディミニッシュ7th(dim7)':[0, 3, 6, 9],
    'ハーフディミ (m7b5)':    [0, 3, 6, 10],
    'メジャー6th (M6)':      [0, 4, 7, 9],
    'マイナー6th (m6)':      [0, 3, 7, 9],
    'アド9th (add9)':        [0, 4, 7, 14],
    '9th':                   [0, 4, 7, 10, 14],
    '11th':                  [0, 4, 7, 10, 14, 17],
    '13th':                  [0, 4, 7, 10, 14, 17, 21],
}

SCALES = {
    'メジャースケール':        [0,2,4,5,7,9,11],
    'マイナースケール':        [0,2,3,5,7,8,10],
    'ハーモニックマイナー':    [0,2,3,5,7,8,11],
    'メロディックマイナー':    [0,2,3,5,7,9,11],
    'ドリアン':               [0,2,3,5,7,9,10],
    'フリジアン':             [0,1,3,5,7,8,10],
    'リディアン':             [0,2,4,6,7,9,11],
    'ミクソリディアン':       [0,2,4,5,7,9,10],
    'ロクリアン':             [0,1,3,5,6,8,10],
    'ペンタトニック(メジャー)':[0,2,4,7,9],
    'ペンタトニック(マイナー)':[0,3,5,7,10],
    'ブルーススケール':       [0,3,5,6,7,10],
    'クロマティック':         [0,1,2,3,4,5,6,7,8,9,10,11],
    '全音音階':               [0,2,4,6,8,10],
    '日本音階(ヨナ抜き)':     [0,2,5,7,9],
}

DIATONIC_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
DIATONIC_QUALITY  = ['M', 'm', 'm', 'M', 'M', 'm', 'dim']

BLACK_KEYS = {1,3,6,8,10}  # semitones within octave that are black


class MusicTheoryApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Music Theory Helper 🎵")
        self.geometry("900x640")
        self.configure(bg="#0f0f1a")
        self.resizable(True, True)

        self.root_note = tk.StringVar(value='C')
        self.chord_type = tk.StringVar(value='メジャー (M)')
        self.scale_type  = tk.StringVar(value='メジャースケール')
        self.inversion   = tk.IntVar(value=0)
        self.octave      = tk.IntVar(value=4)
        self.active_notes: set[int] = set()

        self._build_ui()
        self._update()

    def _build_ui(self):
        s = ttk.Style(self); s.theme_use("clam")
        BG="#0f0f1a"; FG="#e0e0f0"; FG2="#6b7280"; ACC="#818cf8"
        CARD="#1e1e2e"; BORDER="#2d2d4e"
        s.configure(".", background=BG, foreground=FG)
        s.configure("TFrame", background=BG)
        s.configure("TLabel", background=BG, foreground=FG)
        s.configure("TLabelframe", background=CARD, foreground=FG2)
        s.configure("TLabelframe.Label", background=BG, foreground=FG2, font=("",10))
        s.configure("TButton", background=BORDER, foreground=FG, padding=5)
        s.map("TButton", background=[("active","#3d3d6e")])
        s.configure("TCombobox", fieldbackground=CARD, foreground=FG)
        s.configure("TNotebook", background=BG)
        s.configure("TNotebook.Tab", background=CARD, foreground=FG2, padding=[10,5])
        s.map("TNotebook.Tab", background=[("selected","#1e1a3a")], foreground=[("selected",ACC)])
        s.configure("TRadiobutton", background=BG, foreground=FG)
        s.configure("TSpinbox", fieldbackground=CARD, foreground=FG)

        # Header
        hdr = tk.Frame(self, bg=BG)
        hdr.pack(fill="x", padx=14, pady=(10,6))
        tk.Label(hdr, text="🎵 Music Theory Helper", font=("",15,"bold"), bg=BG, fg=ACC).pack(side="left")
        tk.Label(hdr, text="コード・スケール・転回形を学ぼう", font=("",10), bg=BG, fg=FG2).pack(side="left", padx=12)

        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True, padx=10, pady=4)

        # ── Tab 1: Chord Builder ──
        chord_tab = tk.Frame(nb, bg=BG); nb.add(chord_tab, text="🎸 コードビルダー")
        self._build_chord_tab(chord_tab)

        # ── Tab 2: Scale Explorer ──
        scale_tab = tk.Frame(nb, bg=BG); nb.add(scale_tab, text="🎼 スケール探索")
        self._build_scale_tab(scale_tab)

        # ── Tab 3: Diatonic Chords ──
        dia_tab = tk.Frame(nb, bg=BG); nb.add(dia_tab, text="📊 ダイアトニック")
        self._build_diatonic_tab(dia_tab)

        # ── Tab 4: Chord Progression ──
        prog_tab = tk.Frame(nb, bg=BG); nb.add(prog_tab, text="🔄 コード進行")
        self._build_progression_tab(prog_tab)

        nb.bind("<<NotebookTabChanged>>", lambda e: self._update())
        self._nb = nb

    def _common_controls(self, parent):
        frame = tk.Frame(parent, bg="#0f0f1a")
        frame.pack(fill="x", padx=8, pady=6)

        tk.Label(frame, text="ルート音:", bg="#0f0f1a", fg="#6b7280", font=("",10)).pack(side="left")
        root_cb = ttk.Combobox(frame, textvariable=self.root_note, values=NOTES,
                                state="readonly", width=5)
        root_cb.pack(side="left", padx=6)
        root_cb.bind("<<ComboboxSelected>>", lambda e: self._update())
        return frame

    def _build_chord_tab(self, parent):
        ctrl = self._common_controls(parent)

        tk.Label(ctrl, text="コードタイプ:", bg="#0f0f1a", fg="#6b7280", font=("",10)).pack(side="left", padx=(12,4))
        chord_cb = ttk.Combobox(ctrl, textvariable=self.chord_type,
                                 values=list(CHORD_TYPES.keys()), state="readonly", width=22)
        chord_cb.pack(side="left")
        chord_cb.bind("<<ComboboxSelected>>", lambda e: self._update())

        tk.Label(ctrl, text="転回:", bg="#0f0f1a", fg="#6b7280", font=("",10)).pack(side="left", padx=(12,4))
        for i, lbl in enumerate(["基本形", "第1転回", "第2転回", "第3転回"]):
            rb = ttk.Radiobutton(ctrl, text=lbl, variable=self.inversion, value=i,
                                  command=self._update)
            rb.pack(side="left", padx=3)

        # Info panel
        self.chord_info = tk.LabelFrame(parent, text="コード情報", bg="#1e1e2e", fg="#6b7280",
                                         font=("",10), bd=1, relief="solid")
        self.chord_info.pack(fill="x", padx=8, pady=4)
        self.chord_name_lbl = tk.Label(self.chord_info, text="", font=("",18,"bold"),
                                        bg="#1e1e2e", fg="#818cf8")
        self.chord_name_lbl.pack(side="left", padx=14, pady=8)
        self.chord_notes_lbl = tk.Label(self.chord_info, text="", font=("",12),
                                         bg="#1e1e2e", fg="#c4b5fd")
        self.chord_notes_lbl.pack(side="left", padx=8)
        self.chord_midi_lbl = tk.Label(self.chord_info, text="", font=("",10),
                                        bg="#1e1e2e", fg="#4b5563")
        self.chord_midi_lbl.pack(side="right", padx=14)

        # Piano
        self.chord_piano = tk.Canvas(parent, height=120, bg="#0f0f1a", bd=0, highlightthickness=0)
        self.chord_piano.pack(fill="x", padx=8, pady=4)

        # Chord structure
        struct_frame = tk.Frame(parent, bg="#0f0f1a")
        struct_frame.pack(fill="x", padx=8, pady=4)
        self.interval_canvas = tk.Canvas(struct_frame, height=60, bg="#1e1e2e",
                                          bd=0, highlightthickness=0)
        self.interval_canvas.pack(fill="x")

    def _build_scale_tab(self, parent):
        ctrl = self._common_controls(parent)
        tk.Label(ctrl, text="スケール:", bg="#0f0f1a", fg="#6b7280", font=("",10)).pack(side="left", padx=(12,4))
        scale_cb = ttk.Combobox(ctrl, textvariable=self.scale_type,
                                  values=list(SCALES.keys()), state="readonly", width=24)
        scale_cb.pack(side="left")
        scale_cb.bind("<<ComboboxSelected>>", lambda e: self._update())

        self.scale_info = tk.LabelFrame(parent, text="スケール情報", bg="#1e1e2e", fg="#6b7280",
                                         font=("",10), bd=1, relief="solid")
        self.scale_info.pack(fill="x", padx=8, pady=4)
        self.scale_name_lbl = tk.Label(self.scale_info, text="", font=("",16,"bold"),
                                        bg="#1e1e2e", fg="#34d399")
        self.scale_name_lbl.pack(side="left", padx=14, pady=8)
        self.scale_notes_lbl = tk.Label(self.scale_info, text="", font=("",12),
                                         bg="#1e1e2e", fg="#86efac")
        self.scale_notes_lbl.pack(side="left", padx=8)

        self.scale_piano = tk.Canvas(parent, height=120, bg="#0f0f1a", bd=0, highlightthickness=0)
        self.scale_piano.pack(fill="x", padx=8, pady=4)

        # Degree labels
        self.degree_frame = tk.Frame(parent, bg="#1e1e2e", bd=1, relief="solid")
        self.degree_frame.pack(fill="x", padx=8, pady=4)

        # Circle of fifths mini
        self.circle_canvas = tk.Canvas(parent, height=200, bg="#1e1e2e", bd=0, highlightthickness=0)
        self.circle_canvas.pack(fill="x", padx=8, pady=4)

    def _build_diatonic_tab(self, parent):
        ctrl = self._common_controls(parent)
        tk.Label(ctrl, text="スケール:", bg="#0f0f1a", fg="#6b7280", font=("",10)).pack(side="left", padx=(12,4))
        dia_cb = ttk.Combobox(ctrl, textvariable=self.scale_type,
                               values=list(SCALES.keys()), state="readonly", width=20)
        dia_cb.pack(side="left")
        dia_cb.bind("<<ComboboxSelected>>", lambda e: self._update())

        self.dia_canvas = tk.Canvas(parent, bg="#1e1e2e", bd=1, relief="solid")
        self.dia_canvas.pack(fill="both", expand=True, padx=8, pady=8)

    def _build_progression_tab(self, parent):
        ctrl = tk.Frame(parent, bg="#0f0f1a")
        ctrl.pack(fill="x", padx=8, pady=6)

        tk.Label(ctrl, text="よく使うコード進行", font=("",12,"bold"), bg="#0f0f1a", fg="#818cf8").pack(anchor="w")
        tk.Label(ctrl, text="クリックでルートに合わせて表示", font=("",10), bg="#0f0f1a", fg="#4b5563").pack(anchor="w")

        # Root for progressions
        root_row = tk.Frame(ctrl, bg="#0f0f1a")
        root_row.pack(fill="x", pady=4)
        tk.Label(root_row, text="キー:", bg="#0f0f1a", fg="#6b7280", font=("",10)).pack(side="left")
        root_cb = ttk.Combobox(root_row, textvariable=self.root_note, values=NOTES,
                                state="readonly", width=5)
        root_cb.pack(side="left", padx=6)
        root_cb.bind("<<ComboboxSelected>>", lambda e: self._update())

        PROGRESSIONS = [
            ("I → V → VI → IV (カノン進行)", [0,4,5,3]),
            ("I → IV → V → I (ブルース)", [0,3,4,0]),
            ("II → V → I (ジャズ基本)", [1,4,0]),
            ("I → VI → IV → V (50年代)", [0,5,3,4]),
            ("I → V → IV → I", [0,4,3,0]),
            ("VI → IV → I → V (J-Pop)", [5,3,0,4]),
            ("I → III → IV → V", [0,2,3,4]),
            ("II → IV → I (クローズ)", [1,3,0]),
            ("I → bVII → IV → I (ロック)", [0,-2,3,0]),
            ("I → IV → bVII → IV", [0,3,-2,3]),
        ]

        prog_frame = tk.Frame(parent, bg="#0f0f1a")
        prog_frame.pack(fill="both", expand=True, padx=8, pady=4)

        canvas = tk.Canvas(prog_frame, bg="#1e1e2e", bd=1, relief="solid", highlightthickness=0)
        vsb = ttk.Scrollbar(prog_frame, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=vsb.set)
        canvas.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        inner = tk.Frame(canvas, bg="#1e1e2e")
        canvas.create_window(0, 0, anchor="nw", window=inner)
        inner.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))

        self.prog_inner = inner
        self.prog_canvas = canvas
        self._progressions = PROGRESSIONS

    # ── Update ────────────────────────────────────────
    def _update(self):
        tab = self._nb.index("current")
        root_idx = NOTES.index(self.root_note.get())
        if tab == 0: self._update_chord(root_idx)
        elif tab == 1: self._update_scale(root_idx)
        elif tab == 2: self._update_diatonic(root_idx)
        elif tab == 3: self._update_progression(root_idx)

    def _update_chord(self, root_idx):
        intervals = list(CHORD_TYPES[self.chord_type.get()])
        inv = self.inversion.get()

        # Apply inversion
        inv = min(inv, len(intervals)-1)
        if inv > 0:
            for _ in range(inv):
                intervals[0] += 12
                intervals = sorted(intervals)

        note_indices = [(root_idx + i) % 12 for i in intervals]
        note_names   = [NOTES[i] for i in note_indices]
        note_jp      = [NOTE_JP[n] for n in note_names]

        chord_name = self.root_note.get() + self.chord_type.get().split('(')[1].rstrip(')').strip() if '(' in self.chord_type.get() else self.root_note.get()
        self.chord_name_lbl.config(text=f"{self.root_note.get()}{self.chord_type.get().split('(')[1].rstrip(')') if '(' in self.chord_type.get() else ''}")
        self.chord_notes_lbl.config(text=' - '.join(f"{n}({jp})" for n,jp in zip(note_names, note_jp)))

        midi_notes = [60 + i for i in intervals]
        self.chord_midi_lbl.config(text='MIDI: ' + ', '.join(str(m) for m in midi_notes))

        self.active_notes = set(note_indices)
        self._draw_piano(self.chord_piano, self.active_notes, '#818cf8')
        self._draw_intervals(intervals)

    def _update_scale(self, root_idx):
        intervals = SCALES[self.scale_type.get()]
        note_indices = [(root_idx + i) % 12 for i in intervals]
        note_names   = [NOTES[i] for i in note_indices]

        self.scale_name_lbl.config(text=f"{self.root_note.get()} {self.scale_type.get()}")
        self.scale_notes_lbl.config(text=' '.join(note_names))

        self.active_notes = set(note_indices)
        self._draw_piano(self.scale_piano, self.active_notes, '#34d399')
        self._draw_circle_of_fifths(note_indices)

    def _update_diatonic(self, root_idx):
        scale = SCALES[self.scale_type.get()]
        canvas = self.dia_canvas
        canvas.update_idletasks()
        canvas.delete("all")
        W = canvas.winfo_width() or 860
        H = canvas.winfo_height() or 400
        n = len(scale)
        col_w = W // n

        for i, interval in enumerate(scale):
            note_idx = (root_idx + interval) % 12
            note = NOTES[note_idx]
            quality = 'dim' if i == 6 else ('m' if i in [1,2,5] else 'M')
            # Build triad
            chord_intervals = [0,
                               scale[(i+2) % n] - interval if (i+2)<n else scale[(i+2)%n]+12-interval,
                               scale[(i+4) % n] - interval if (i+4)<n else scale[(i+4)%n]+12-interval]
            chord_notes = [NOTES[(note_idx + ci) % 12] for ci in chord_intervals]
            color = {'M':'#818cf8','m':'#34d399','dim':'#f87171'}.get(quality,'#94a3b8')
            numeral = DIATONIC_NUMERALS[i] if quality == 'M' else DIATONIC_NUMERALS[i].lower()

            x0 = i * col_w + 4; x1 = (i+1)*col_w - 4
            y0 = 20; y1 = H - 20

            canvas.create_rectangle(x0, y0, x1, y1, fill="#1a1a2e", outline=color, width=2)
            canvas.create_text((x0+x1)//2, y0+25, text=numeral, font=("",18,"bold"), fill=color)
            canvas.create_text((x0+x1)//2, y0+50, text=f"{note}{quality}", font=("",12,"bold"), fill="#e0e0f0")
            canvas.create_text((x0+x1)//2, y0+72, text='\n'.join(chord_notes), font=("",10), fill="#818cf8")
            # Mini piano
            self._draw_mini_piano(canvas, x0+4, y1-60, x1-x0-8, 55, set([(note_idx+ci)%12 for ci in chord_intervals]), color)

    def _update_progression(self, root_idx):
        inner = self.prog_inner
        for w in inner.winfo_children(): w.destroy()
        scale = SCALES['メジャースケール']
        for name, degrees in self._progressions:
            frame = tk.Frame(inner, bg="#1e1e2e", bd=1, relief="solid")
            frame.pack(fill="x", padx=6, pady=3)
            tk.Label(frame, text=name, font=("",11,"bold"), bg="#1e1e2e", fg="#818cf8").pack(anchor="w", padx=10, pady=(6,2))
            chord_row = tk.Frame(frame, bg="#1e1e2e")
            chord_row.pack(fill="x", padx=10, pady=(0,6))
            for deg in degrees:
                idx = (root_idx + scale[deg % 7] + (12 if deg < 0 else 0)) % 12
                note = NOTES[idx]
                quality = 'dim' if deg%7 == 6 else ('m' if deg%7 in [1,2,5] else 'M')
                color = {'M':'#818cf8','m':'#34d399','dim':'#f87171'}.get(quality,'#94a3b8')
                box = tk.Label(chord_row, text=f"{note}\n{quality}", font=("",12,"bold"),
                                bg="#2d2d4e", fg=color, width=5, pady=6, relief="solid", bd=1)
                box.pack(side="left", padx=3)

    # ── Piano drawing ─────────────────────────────────
    def _draw_piano(self, canvas, active: set, color: str, octaves: int = 2):
        canvas.update_idletasks()
        canvas.delete("all")
        W = canvas.winfo_width() or 860
        H = 110
        white_keys = [n for n in range(12*octaves) if (n%12) not in BLACK_KEYS]
        kw = W / len(white_keys)
        kh_white = H - 10
        kh_black = kh_white * 0.62
        kw_black = kw * 0.6

        # White keys
        for i, note in enumerate(white_keys):
            x0 = i * kw; x1 = x0 + kw - 1
            is_active = (note % 12) in active
            fill = color if is_active else "#f5f5f5"
            canvas.create_rectangle(x0, 0, x1, kh_white, fill=fill, outline="#ccc", width=1)
            if is_active:
                canvas.create_text((x0+x1)/2, kh_white-12, text=NOTES[note%12], font=("",8,"bold"), fill="#0f0f1a")

        # Black keys
        wi = 0
        for note in range(12*octaves):
            if (note % 12) in BLACK_KEYS:
                x0 = wi * kw - kw_black/2 - 1; x1 = x0 + kw_black
                is_active = (note % 12) in active
                fill = color if is_active else "#1a1a1a"
                canvas.create_rectangle(x0, 0, x1, kh_black, fill=fill, outline="#000", width=1)
                if is_active:
                    canvas.create_text((x0+x1)/2, kh_black-8, text=NOTES[note%12], font=("",7,"bold"),
                                        fill="#f0f0f0" if not is_active else "#0f0f1a")
            else:
                wi += 1

    def _draw_mini_piano(self, canvas, x, y, w, h, active: set, color: str):
        white_notes = [n for n in range(12) if n not in BLACK_KEYS]
        kw = w / len(white_notes); kh = h
        # White keys
        for i, note in enumerate(white_notes):
            x0 = x + i*kw; x1 = x0 + kw - 1
            fill = color if note in active else "#d0d0d0"
            canvas.create_rectangle(x0, y, x1, y+kh, fill=fill, outline="#999", width=1)
        # Black keys
        wi = 0
        for note in range(12):
            if note in BLACK_KEYS:
                bx = x + wi*kw - kw*0.3; bw = kw*0.6
                fill = color if note in active else "#1a1a1a"
                canvas.create_rectangle(bx, y, bx+bw, y+kh*0.62, fill=fill, outline="#000", width=1)
            else:
                wi += 1

    def _draw_intervals(self, intervals):
        canvas = self.interval_canvas
        canvas.update_idletasks()
        canvas.delete("all")
        W = canvas.winfo_width() or 800
        H = 60; n = len(intervals)
        if n == 0: return
        max_i = max(intervals) or 1
        for i, interval in enumerate(intervals):
            x = interval / max_i * (W-40) + 20
            color = ['#818cf8','#4ade80','#f59e0b','#f87171','#34d399','#60a5fa','#a78bfa'][i%7]
            canvas.create_oval(x-8, H/2-8, x+8, H/2+8, fill=color, outline="")
            canvas.create_text(x, H-4, text=str(interval)+'半', font=("",8), fill="#4b5563")
            if i > 0:
                prev_x = intervals[i-1] / max_i * (W-40) + 20
                canvas.create_line(prev_x+8, H/2, x-8, H/2, fill="#2d2d4e", width=2)

    def _draw_circle_of_fifths(self, active_indices: list):
        canvas = self.circle_canvas
        canvas.update_idletasks()
        canvas.delete("all")
        W = canvas.winfo_width() or 860; H = 200
        cx = W//2; cy = H//2; r = min(cx, cy) - 20
        CIRCLE = ['C','G','D','A','E','B','F#','Db','Ab','Eb','Bb','F']
        for i, note in enumerate(CIRCLE):
            angle = -math.pi/2 + i * math.pi * 2 / 12
            x = cx + r * math.cos(angle); y = cy + r * math.sin(angle)
            note_idx = NOTES.index(note) if note in NOTES else -1
            is_active = note_idx in active_indices
            color = '#34d399' if is_active else '#2d2d4e'
            fg_color = '#0f0f1a' if is_active else '#6b7280'
            canvas.create_oval(x-16, y-16, x+16, y+16, fill=color, outline='#1e1e2e', width=2)
            canvas.create_text(x, y, text=note, font=("",10,"bold"), fill=fg_color)


if __name__ == "__main__":
    app = MusicTheoryApp()
    app.mainloop()
