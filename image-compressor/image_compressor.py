#!/usr/bin/env python3
"""
Image Compressor — バッチ画像圧縮ツール
JPEG/PNG/WebP に対応。品質・リサイズ・フォーマット変換を一括処理。
依存: Pillow  (pip install Pillow)
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
from PIL import Image, ImageTk
import threading
import os


# ─────────────────────────────────────────────────────
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff"}

def human_size(n):
    for unit in ("B","KB","MB","GB"):
        if n < 1024: return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


class ImageCompressor(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Image Compressor")
        self.geometry("860x580")
        self.configure(bg="#1e1e2e")
        self.resizable(True, True)
        self.files: list[Path] = []
        self._build_ui()

    def _build_ui(self):
        s = ttk.Style(self)
        s.theme_use("clam")
        BG, FG, FG2, ACC = "#1e1e2e", "#cdd6f4", "#a6adc8", "#89b4fa"
        ENT, BTN = "#313244", "#45475a"
        s.configure(".", background=BG, foreground=FG, fieldbackground=ENT)
        s.configure("TFrame", background=BG)
        s.configure("TLabel", background=BG, foreground=FG)
        s.configure("TButton", background=BTN, foreground=FG, padding=6)
        s.map("TButton", background=[("active","#585b70")])
        s.configure("Accent.TButton", background="#7c3aed", foreground="white")
        s.map("Accent.TButton", background=[("active","#6d28d9")])
        s.configure("TEntry", fieldbackground=ENT, foreground=FG, insertcolor=FG)
        s.configure("TCombobox", fieldbackground=ENT, foreground=FG, selectbackground=ACC)
        s.configure("TScale", background=BG, troughcolor=ENT)
        s.configure("Treeview", background=ENT, foreground=FG, fieldbackground=ENT, rowheight=22)
        s.configure("Treeview.Heading", background=BTN, foreground=FG)
        s.map("Treeview", background=[("selected", "#7c3aed")])
        s.configure("TProgressbar", troughcolor=ENT, background=ACC)
        s.configure("TLabelframe", background=BG, foreground=FG2)
        s.configure("TLabelframe.Label", background=BG, foreground=FG2)
        s.configure("TCheckbutton", background=BG, foreground=FG)
        s.configure("TRadiobutton", background=BG, foreground=FG)

        # ── Top toolbar ──
        top = ttk.Frame(self)
        top.pack(fill="x", padx=12, pady=(10,0))
        ttk.Label(top, text="🖼 Image Compressor", font=("",14,"bold")).pack(side="left")
        ttk.Button(top, text="ファイルを追加", command=self._add_files).pack(side="right", padx=2)
        ttk.Button(top, text="フォルダを追加", command=self._add_folder).pack(side="right", padx=2)
        ttk.Button(top, text="クリア", command=self._clear).pack(side="right", padx=2)

        # ── Main panes ──
        main = ttk.Frame(self)
        main.pack(fill="both", expand=True, padx=12, pady=8)

        # File list (left)
        left = ttk.Frame(main)
        left.pack(side="left", fill="both", expand=True)

        cols = ("ファイル名","サイズ","解像度","状態")
        self.tree = ttk.Treeview(left, columns=cols, show="headings", selectmode="extended")
        for col, w in zip(cols, [220,70,100,80]):
            self.tree.heading(col, text=col)
            self.tree.column(col, width=w)
        vsb = ttk.Scrollbar(left, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        # Settings (right)
        right = ttk.Frame(main, width=200)
        right.pack(side="right", fill="y", padx=(10,0))
        right.pack_propagate(False)

        # Output format
        fmt_fr = ttk.LabelFrame(right, text="出力フォーマット", padding=8)
        fmt_fr.pack(fill="x", pady=(0,8))
        self.fmt_var = tk.StringVar(value="元のまま")
        for f in ["元のまま","JPEG","PNG","WebP"]:
            ttk.Radiobutton(fmt_fr, text=f, variable=self.fmt_var, value=f).pack(anchor="w")

        # Quality
        q_fr = ttk.LabelFrame(right, text="品質 (JPEG/WebP)", padding=8)
        q_fr.pack(fill="x", pady=(0,8))
        self.quality_var = tk.IntVar(value=82)
        ttk.Label(q_fr, textvariable=self.quality_var).pack(anchor="e")
        ttk.Scale(q_fr, from_=10, to=100, variable=self.quality_var, orient="horizontal").pack(fill="x")

        # Resize
        rs_fr = ttk.LabelFrame(right, text="リサイズ", padding=8)
        rs_fr.pack(fill="x", pady=(0,8))
        self.resize_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(rs_fr, text="リサイズする", variable=self.resize_var).pack(anchor="w")
        mode_fr = ttk.Frame(rs_fr)
        mode_fr.pack(fill="x", pady=4)
        self.resize_mode = tk.StringVar(value="percent")
        ttk.Radiobutton(mode_fr, text="% で指定", variable=self.resize_mode, value="percent").pack(side="left")
        ttk.Radiobutton(mode_fr, text="px で指定", variable=self.resize_mode, value="pixels").pack(side="left", padx=4)
        dim_fr = ttk.Frame(rs_fr)
        dim_fr.pack(fill="x")
        ttk.Label(dim_fr, text="幅:").pack(side="left")
        self.width_var = tk.StringVar(value="80")
        ttk.Entry(dim_fr, textvariable=self.width_var, width=6).pack(side="left", padx=2)
        ttk.Label(dim_fr, text="高さ:").pack(side="left", padx=(4,0))
        self.height_var = tk.StringVar(value="80")
        ttk.Entry(dim_fr, textvariable=self.height_var, width=6).pack(side="left", padx=2)
        ttk.Label(rs_fr, text="（%モード時は縦横比を維持）", foreground="#585b70", font=("",9)).pack(anchor="w")

        # Output dir
        od_fr = ttk.LabelFrame(right, text="保存先", padding=8)
        od_fr.pack(fill="x", pady=(0,8))
        self.outdir_var = tk.StringVar(value="元のフォルダ/compressed/")
        ttk.Entry(od_fr, textvariable=self.outdir_var, width=22).pack(fill="x")
        ttk.Button(od_fr, text="参照...", command=self._pick_outdir).pack(anchor="e", pady=(4,0))

        # Progress
        self.progress_var = tk.DoubleVar(value=0)
        self.progress = ttk.Progressbar(right, variable=self.progress_var, maximum=100)
        self.progress.pack(fill="x", pady=(0,6))

        ttk.Button(right, text="⚡ 圧縮開始", style="Accent.TButton",
                   command=self._start_compress).pack(fill="x")

        # Status bar
        self.status_var = tk.StringVar(value="ファイルを追加してください")
        ttk.Label(self, textvariable=self.status_var, foreground="#585b70", font=("",10)).pack(pady=4)

    # ── File management ──
    def _add_files(self):
        types = [("画像ファイル", "*.jpg *.jpeg *.png *.webp *.bmp *.gif *.tiff"), ("すべて", "*.*")]
        paths = filedialog.askopenfilenames(title="ファイルを選択", filetypes=types)
        for p in paths:
            path = Path(p)
            if path.suffix.lower() in SUPPORTED and path not in self.files:
                self.files.append(path)
        self._refresh_list()

    def _add_folder(self):
        folder = filedialog.askdirectory(title="フォルダを選択")
        if folder:
            for p in sorted(Path(folder).iterdir()):
                if p.is_file() and p.suffix.lower() in SUPPORTED and p not in self.files:
                    self.files.append(p)
        self._refresh_list()

    def _clear(self):
        self.files.clear()
        self.tree.delete(*self.tree.get_children())
        self.status_var.set("ファイルを追加してください")

    def _pick_outdir(self):
        d = filedialog.askdirectory(title="保存先フォルダ")
        if d: self.outdir_var.set(d)

    def _refresh_list(self):
        self.tree.delete(*self.tree.get_children())
        for path in self.files:
            try:
                size = human_size(path.stat().st_size)
                with Image.open(path) as im:
                    res = f"{im.width}×{im.height}"
            except Exception:
                size, res = "?", "?"
            self.tree.insert("", "end", values=(path.name, size, res, "待機中"))
        self.status_var.set(f"{len(self.files)} ファイル")

    # ── Compression ──
    def _start_compress(self):
        if not self.files:
            messagebox.showinfo("情報", "ファイルを追加してください")
            return
        threading.Thread(target=self._compress_all, daemon=True).start()

    def _compress_all(self):
        total = len(self.files)
        saved_total = 0
        errors = []

        for idx, path in enumerate(self.files):
            self._set_status(path.name, idx, total, "処理中...")
            try:
                orig_size = path.stat().st_size
                new_path = self._get_output_path(path)
                new_path.parent.mkdir(parents=True, exist_ok=True)

                with Image.open(path) as img:
                    img = img.convert("RGBA") if img.mode in ("P","PA") else img

                    # Resize
                    if self.resize_var.get():
                        img = self._resize(img)

                    # Format
                    out_fmt = self.fmt_var.get()
                    if out_fmt == "元のまま":
                        out_fmt = path.suffix.lstrip(".").upper()
                        if out_fmt == "JPG": out_fmt = "JPEG"
                    else:
                        new_path = new_path.with_suffix("." + out_fmt.lower())

                    # Convert RGBA for JPEG
                    if out_fmt == "JPEG" and img.mode == "RGBA":
                        bg = Image.new("RGB", img.size, (255,255,255))
                        bg.paste(img, mask=img.split()[3])
                        img = bg
                    elif out_fmt == "PNG" and img.mode not in ("RGB","RGBA","L","P"):
                        img = img.convert("RGBA")

                    save_kwargs = {}
                    if out_fmt in ("JPEG", "WEBP"):
                        save_kwargs["quality"] = self.quality_var.get()
                        save_kwargs["optimize"] = True
                    elif out_fmt == "PNG":
                        save_kwargs["optimize"] = True

                    img.save(new_path, format=out_fmt, **save_kwargs)

                new_size = new_path.stat().st_size
                saved = orig_size - new_size
                saved_total += saved
                pct = (saved / orig_size * 100) if orig_size > 0 else 0
                status = f"✓ {pct:+.0f}% ({human_size(new_size)})"
                self.tree.item(self.tree.get_children()[idx], values=(path.name, human_size(orig_size), "", status))

            except Exception as e:
                errors.append(f"{path.name}: {e}")
                if idx < len(self.tree.get_children()):
                    self.tree.item(self.tree.get_children()[idx], values=(path.name, "?", "?", "❌ エラー"))

            self.progress_var.set((idx + 1) / total * 100)

        msg = f"完了！ {total}枚 | 合計削減: {human_size(abs(saved_total))}"
        if errors: msg += f"\nエラー {len(errors)}件"
        self.status_var.set(msg)
        self.progress_var.set(0)
        if errors:
            self.after(100, lambda: messagebox.showerror("エラー", "\n".join(errors[:5])))

    def _resize(self, img: Image.Image) -> Image.Image:
        mode = self.resize_mode.get()
        try:
            w_val = float(self.width_var.get())
            h_val = float(self.height_var.get())
        except ValueError:
            return img

        if mode == "percent":
            new_w = int(img.width * w_val / 100)
            new_h = int(img.height * w_val / 100)
        else:
            new_w = int(w_val) if w_val > 0 else img.width
            new_h = int(h_val) if h_val > 0 else img.height

        return img.resize((max(1,new_w), max(1,new_h)), Image.LANCZOS)

    def _get_output_path(self, path: Path) -> Path:
        outdir = self.outdir_var.get().strip()
        if outdir == "元のフォルダ/compressed/":
            base = path.parent / "compressed"
        else:
            base = Path(outdir)
        return base / path.name

    def _set_status(self, name, idx, total, msg):
        self.status_var.set(f"[{idx+1}/{total}] {name} — {msg}")


if __name__ == "__main__":
    app = ImageCompressor()
    app.mainloop()
