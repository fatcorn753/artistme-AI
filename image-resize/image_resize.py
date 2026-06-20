#!/usr/bin/env python3
"""
Image Resize Tool — 画像一括リサイズ・変換
SNS別プリセット（Twitter/Instagram/YouTube等）、カスタムサイズ、
フォーマット変換、品質設定。ドラッグ&ドロップUI付き。
依存: Pillow (pip install Pillow)
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
from PIL import Image
import threading


PRESETS = {
    "Twitter ヘッダー":      (1500, 500),
    "Twitter アイコン":      (400, 400),
    "Instagram 正方形":      (1080, 1080),
    "Instagram ストーリー":   (1080, 1920),
    "Facebook カバー":       (1640, 624),
    "YouTube サムネイル":     (1280, 720),
    "YouTube チャンネルアート":(2560, 1440),
    "LINE アイコン":          (200, 200),
    "OGP画像":               (1200, 630),
    "Favicon (32px)":        (32, 32),
    "Favicon (64px)":        (64, 64),
    "HD (1280×720)":         (1280, 720),
    "Full HD (1920×1080)":   (1920, 1080),
    "4K (3840×2160)":        (3840, 2160),
}


def human_size(n):
    for u in ('B','KB','MB','GB'):
        if n < 1024: return f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} GB"


class ImageResizeTool(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Image Resize Tool 🖼")
        self.geometry("820x580")
        self.configure(bg="#0f172a")
        self.resizable(True, True)
        self.files: list[Path] = []
        self._build_ui()

    def _build_ui(self):
        s = ttk.Style(self); s.theme_use("clam")
        BG="#0f172a"; CARD="#1e293b"; FG="#e2e8f0"; FG2="#94a3b8"; BORDER="#334155"; ACC="#38bdf8"
        s.configure(".", background=BG, foreground=FG, fieldbackground=CARD)
        s.configure("TFrame", background=BG)
        s.configure("TLabel", background=BG, foreground=FG)
        s.configure("TButton", background="#334155", foreground=FG, padding=6)
        s.map("TButton", background=[("active","#475569")])
        s.configure("Accent.TButton", background="#0369a1", foreground="white")
        s.map("Accent.TButton", background=[("active","#0284c7")])
        s.configure("TEntry", fieldbackground=CARD, foreground=FG, insertcolor=FG)
        s.configure("TCombobox", fieldbackground=CARD, foreground=FG)
        s.configure("TRadiobutton", background=BG, foreground=FG)
        s.configure("TCheckbutton", background=BG, foreground=FG)
        s.configure("TLabelframe", background=CARD, foreground=FG2)
        s.configure("TLabelframe.Label", background=BG, foreground=FG2, font=("",10))
        s.configure("Treeview", background=CARD, foreground=FG, fieldbackground=CARD, rowheight=22)
        s.configure("Treeview.Heading", background=BORDER, foreground=FG2, font=("",10))
        s.map("Treeview", background=[("selected","#1e3a5f")])
        s.configure("TProgressbar", troughcolor=BORDER, background=ACC)
        s.configure("TScale", background=BG, troughcolor=BORDER)

        # Header
        hdr = tk.Frame(self, bg=BG)
        hdr.pack(fill="x", padx=14, pady=(10,6))
        tk.Label(hdr, text="🖼 Image Resize Tool", font=("",14,"bold"), bg=BG, fg=ACC).pack(side="left")
        ttk.Button(hdr, text="画像を追加", command=self._add_files).pack(side="right", padx=2)
        ttk.Button(hdr, text="フォルダ追加", command=self._add_folder).pack(side="right", padx=2)
        ttk.Button(hdr, text="クリア", command=self._clear).pack(side="right", padx=2)

        # Main layout
        main = tk.Frame(self, bg=BG)
        main.pack(fill="both", expand=True, padx=10, pady=4)

        # Left: File list
        left = tk.Frame(main, bg=BG)
        left.pack(side="left", fill="both", expand=True, padx=(0,8))

        cols = ("ファイル名","サイズ","解像度")
        self.tree = ttk.Treeview(left, columns=cols, show="headings", height=14)
        for col, w in zip(cols, [200,70,100]):
            self.tree.heading(col, text=col)
            self.tree.column(col, width=w)
        vsb = ttk.Scrollbar(left, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        # Right: Settings
        right = tk.Frame(main, bg=BG, width=240)
        right.pack(side="right", fill="y")
        right.pack_propagate(False)

        # Resize mode
        mode_fr = tk.LabelFrame(right, text="リサイズ設定", bg=CARD, fg=FG2,
                                 font=("",10), bd=1, relief="solid", padx=8, pady=8)
        mode_fr.pack(fill="x", pady=(0,8))

        self.resize_mode = tk.StringVar(value="preset")
        ttk.Radiobutton(mode_fr, text="プリセット", variable=self.resize_mode,
                        value="preset", command=self._on_mode_change).pack(anchor="w")
        self.preset_var = tk.StringVar(value=list(PRESETS.keys())[0])
        self.preset_combo = ttk.Combobox(mode_fr, textvariable=self.preset_var,
                                          values=list(PRESETS.keys()), state="readonly", width=22)
        self.preset_combo.pack(fill="x", pady=3)
        self.preset_combo.bind("<<ComboboxSelected>>", self._on_preset_change)

        ttk.Radiobutton(mode_fr, text="カスタムサイズ", variable=self.resize_mode,
                        value="custom", command=self._on_mode_change).pack(anchor="w", pady=(6,0))
        custom_row = tk.Frame(mode_fr, bg=CARD)
        custom_row.pack(fill="x", pady=3)
        self.cw_var = tk.StringVar(value="800")
        self.ch_var = tk.StringVar(value="600")
        ttk.Entry(custom_row, textvariable=self.cw_var, width=7).pack(side="left")
        tk.Label(custom_row, text="×", bg=CARD, fg=FG2).pack(side="left", padx=4)
        ttk.Entry(custom_row, textvariable=self.ch_var, width=7).pack(side="left")
        tk.Label(custom_row, text="px", bg=CARD, fg=FG2).pack(side="left", padx=4)

        ttk.Radiobutton(mode_fr, text="パーセント", variable=self.resize_mode,
                        value="percent", command=self._on_mode_change).pack(anchor="w", pady=(6,0))
        pct_row = tk.Frame(mode_fr, bg=CARD)
        pct_row.pack(fill="x", pady=3)
        self.pct_var = tk.IntVar(value=50)
        tk.Label(pct_row, textvariable=self.pct_var, bg=CARD, fg=ACC, font=("",11,"bold"), width=4).pack(side="left")
        tk.Label(pct_row, text="%", bg=CARD, fg=FG2).pack(side="left", padx=2)
        ttk.Scale(pct_row, from_=1, to=200, variable=self.pct_var, orient="horizontal").pack(side="left", fill="x", expand=True)

        self.keep_ratio = tk.BooleanVar(value=True)
        ttk.Checkbutton(mode_fr, text="アスペクト比を維持", variable=self.keep_ratio).pack(anchor="w", pady=(6,0))

        # Format
        fmt_fr = tk.LabelFrame(right, text="出力フォーマット", bg=CARD, fg=FG2,
                                font=("",10), bd=1, relief="solid", padx=8, pady=8)
        fmt_fr.pack(fill="x", pady=(0,8))
        self.fmt_var = tk.StringVar(value="元のまま")
        for fmt in ["元のまま","JPEG","PNG","WebP"]:
            ttk.Radiobutton(fmt_fr, text=fmt, variable=self.fmt_var, value=fmt).pack(anchor="w")

        # Quality
        q_fr = tk.LabelFrame(right, text="品質 (JPEG/WebP)", bg=CARD, fg=FG2,
                              font=("",10), bd=1, relief="solid", padx=8, pady=6)
        q_fr.pack(fill="x", pady=(0,8))
        self.quality_var = tk.IntVar(value=85)
        q_row = tk.Frame(q_fr, bg=CARD)
        q_row.pack(fill="x")
        tk.Label(q_row, textvariable=self.quality_var, bg=CARD, fg=ACC, font=("",11,"bold"), width=4).pack(side="left")
        ttk.Scale(q_row, from_=10, to=100, variable=self.quality_var, orient="horizontal").pack(side="left", fill="x", expand=True)

        # Output
        out_fr = tk.LabelFrame(right, text="保存先", bg=CARD, fg=FG2,
                               font=("",10), bd=1, relief="solid", padx=8, pady=6)
        out_fr.pack(fill="x", pady=(0,8))
        self.outdir_var = tk.StringVar(value="resized/")
        ttk.Entry(out_fr, textvariable=self.outdir_var, width=22).pack(fill="x")
        ttk.Button(out_fr, text="参照...", command=self._pick_out).pack(anchor="e", pady=(4,0))

        # Progress
        self.prog_var = tk.DoubleVar()
        ttk.Progressbar(right, variable=self.prog_var, maximum=100).pack(fill="x", pady=(0,6))

        ttk.Button(right, text="⚡ リサイズ実行", style="Accent.TButton",
                   command=self._start).pack(fill="x")

        # Status
        self.status_var = tk.StringVar(value="画像を追加してください")
        ttk.Label(self, textvariable=self.status_var, foreground="#475569", font=("",10)).pack(pady=4)

        self._on_mode_change()

    def _on_mode_change(self):
        mode = self.resize_mode.get()
        self.preset_combo.configure(state="readonly" if mode == "preset" else "disabled")

    def _on_preset_change(self, event=None):
        self.resize_mode.set("preset")

    def _add_files(self):
        types = [("画像", "*.jpg *.jpeg *.png *.webp *.bmp *.gif *.tiff"), ("全て","*.*")]
        paths = filedialog.askopenfilenames(filetypes=types)
        for p in paths:
            path = Path(p)
            if path not in self.files:
                self.files.append(path)
        self._refresh()

    def _add_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            exts = {'.jpg','.jpeg','.png','.webp','.bmp','.gif','.tiff'}
            for p in sorted(Path(folder).iterdir()):
                if p.is_file() and p.suffix.lower() in exts and p not in self.files:
                    self.files.append(p)
        self._refresh()

    def _clear(self):
        self.files.clear()
        self.tree.delete(*self.tree.get_children())
        self.status_var.set("画像を追加してください")

    def _pick_out(self):
        d = filedialog.askdirectory()
        if d: self.outdir_var.set(d)

    def _refresh(self):
        self.tree.delete(*self.tree.get_children())
        for path in self.files:
            try:
                size = human_size(path.stat().st_size)
                with Image.open(path) as im: res = f"{im.width}×{im.height}"
            except: size, res = "?","?"
            self.tree.insert("", "end", values=(path.name, size, res))
        self.status_var.set(f"{len(self.files)} ファイル")

    def _get_new_size(self, img):
        mode = self.resize_mode.get()
        w, h = img.size
        if mode == "preset":
            pw, ph = PRESETS.get(self.preset_var.get(), (w, h))
            if self.keep_ratio.get():
                ratio = min(pw/w, ph/h)
                return int(w*ratio), int(h*ratio)
            return pw, ph
        elif mode == "custom":
            nw = int(self.cw_var.get() or w)
            nh = int(self.ch_var.get() or h)
            if self.keep_ratio.get():
                ratio = min(nw/w, nh/h)
                return int(w*ratio), int(h*ratio)
            return nw, nh
        else:  # percent
            pct = self.pct_var.get() / 100
            return int(w*pct), int(h*pct)

    def _start(self):
        if not self.files: return
        threading.Thread(target=self._process, daemon=True).start()

    def _process(self):
        total = len(self.files)
        out_base = self.outdir_var.get().strip()
        errors = []

        for i, path in enumerate(self.files):
            self.status_var.set(f"[{i+1}/{total}] {path.name}")
            try:
                with Image.open(path) as img:
                    nw, nh = self._get_new_size(img)
                    resized = img.resize((max(1,nw), max(1,nh)), Image.LANCZOS)

                    fmt = self.fmt_var.get()
                    if fmt == "元のまま":
                        suffix = path.suffix
                        out_fmt = suffix.lstrip('.').upper()
                        if out_fmt == "JPG": out_fmt = "JPEG"
                    else:
                        suffix = '.'+fmt.lower()
                        out_fmt = fmt

                    # RGBA→RGB for JPEG
                    if out_fmt == "JPEG" and resized.mode in ("RGBA","P","PA"):
                        bg = Image.new("RGB", resized.size, (255,255,255))
                        if resized.mode == "RGBA": bg.paste(resized, mask=resized.split()[3])
                        else: bg.paste(resized.convert("RGBA"), mask=resized.convert("RGBA").split()[3])
                        resized = bg

                    out_dir = Path(path.parent / out_base) if not Path(out_base).is_absolute() else Path(out_base)
                    out_dir.mkdir(parents=True, exist_ok=True)
                    out_path = out_dir / (path.stem + suffix)

                    kw = {}
                    if out_fmt in ("JPEG","WEBP"): kw["quality"] = self.quality_var.get()
                    if out_fmt == "PNG": kw["optimize"] = True
                    resized.save(out_path, format=out_fmt, **kw)

            except Exception as e:
                errors.append(f"{path.name}: {e}")

            self.prog_var.set((i+1)/total*100)

        msg = f"完了！ {total}件"
        if errors: msg += f" (エラー {len(errors)}件)"
        self.status_var.set(msg)
        self.prog_var.set(0)
        if errors:
            self.after(50, lambda: messagebox.showerror("エラー", "\n".join(errors[:5])))
        else:
            self.after(50, lambda: messagebox.showinfo("完了", msg))


if __name__ == "__main__":
    app = ImageResizeTool()
    app.mainloop()
