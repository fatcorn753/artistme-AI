#!/usr/bin/env python3
"""
File Renamer - バッチファイルリネームツール
ドラッグ&ドロップでファイルを追加し、プレフィックス/サフィックス/連番/正規表現置換などで一括リネーム。
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import re
from pathlib import Path


class FileRenamer(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("File Renamer")
        self.geometry("800x600")
        self.configure(bg="#1e1e2e")
        self.resizable(True, True)

        self.files: list[Path] = []
        self._build_ui()
        self._bind_drop()

    # ──────────────────────────────────────────
    def _build_ui(self):
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure(".", background="#1e1e2e", foreground="#cdd6f4", fieldbackground="#313244")
        style.configure("TFrame", background="#1e1e2e")
        style.configure("TLabel", background="#1e1e2e", foreground="#cdd6f4")
        style.configure("TButton", background="#45475a", foreground="#cdd6f4", padding=6)
        style.map("TButton", background=[("active", "#585b70")])
        style.configure("Accent.TButton", background="#7c3aed", foreground="white")
        style.map("Accent.TButton", background=[("active", "#6d28d9")])
        style.configure("TEntry", fieldbackground="#313244", foreground="#cdd6f4", insertcolor="#cdd6f4")
        style.configure("TNotebook", background="#1e1e2e", tabmargins=[0, 0, 0, 0])
        style.configure("TNotebook.Tab", background="#313244", foreground="#888", padding=[12, 4])
        style.map("TNotebook.Tab", background=[("selected", "#45475a")], foreground=[("selected", "#cdd6f4")])
        style.configure("Treeview", background="#313244", foreground="#cdd6f4",
                         fieldbackground="#313244", rowheight=24)
        style.configure("Treeview.Heading", background="#45475a", foreground="#cdd6f4")
        style.map("Treeview", background=[("selected", "#7c3aed")])

        # Top bar
        top = ttk.Frame(self)
        top.pack(fill="x", padx=12, pady=(10, 0))

        ttk.Label(top, text="📝 File Renamer", font=("", 14, "bold")).pack(side="left")

        btn_frame = ttk.Frame(top)
        btn_frame.pack(side="right")
        ttk.Button(btn_frame, text="ファイルを追加", command=self._add_files).pack(side="left", padx=2)
        ttk.Button(btn_frame, text="フォルダを追加", command=self._add_folder).pack(side="left", padx=2)
        ttk.Button(btn_frame, text="リストをクリア", command=self._clear).pack(side="left", padx=2)

        # File list
        list_frame = ttk.Frame(self)
        list_frame.pack(fill="both", expand=True, padx=12, pady=8)

        cols = ("元のファイル名", "変更後のファイル名", "状態")
        self.tree = ttk.Treeview(list_frame, columns=cols, show="headings", selectmode="extended")
        for col in cols:
            self.tree.heading(col, text=col)
        self.tree.column("元のファイル名", width=260)
        self.tree.column("変更後のファイル名", width=260)
        self.tree.column("状態", width=80)

        vsb = ttk.Scrollbar(list_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        # Drop zone hint
        self.drop_label = ttk.Label(
            self, text="ここにファイルをドロップ（またはボタンで追加）",
            foreground="#585b70", font=("", 10)
        )
        self.drop_label.pack()

        # Rules notebook
        nb = ttk.Notebook(self)
        nb.pack(fill="x", padx=12, pady=6)

        self._build_tab_basic(nb)
        self._build_tab_regex(nb)
        self._build_tab_case(nb)
        self._build_tab_number(nb)

        nb.bind("<<NotebookTabChanged>>", lambda _: self._preview())

        # Bottom
        bottom = ttk.Frame(self)
        bottom.pack(fill="x", padx=12, pady=(0, 10))

        self.status_var = tk.StringVar(value="ファイルを追加してください")
        ttk.Label(bottom, textvariable=self.status_var, foreground="#585b70").pack(side="left")

        ttk.Button(bottom, text="プレビュー更新", command=self._preview).pack(side="right", padx=4)
        ttk.Button(bottom, text="✅ リネーム実行", style="Accent.TButton",
                   command=self._rename).pack(side="right")

        self._nb = nb

    def _build_tab_basic(self, nb):
        f = ttk.Frame(nb)
        nb.add(f, text="基本")

        grid = ttk.Frame(f)
        grid.pack(fill="x", padx=10, pady=8)

        fields = [
            ("プレフィックス (前に追加)", "prefix_var"),
            ("サフィックス (後に追加)", "suffix_var"),
            ("検索テキスト", "find_var"),
            ("置換テキスト", "replace_var"),
        ]
        for row, (label, attr) in enumerate(fields):
            setattr(self, attr, tk.StringVar())
            ttk.Label(grid, text=label).grid(row=row, column=0, sticky="w", padx=4, pady=2)
            e = ttk.Entry(grid, textvariable=getattr(self, attr), width=40)
            e.grid(row=row, column=1, sticky="ew", padx=4, pady=2)
            getattr(self, attr).trace_add("write", lambda *_: self._preview())

        grid.columnconfigure(1, weight=1)

        self.ext_var = tk.StringVar()
        ttk.Label(grid, text="拡張子を変更 (例: .jpg)").grid(row=4, column=0, sticky="w", padx=4, pady=2)
        ttk.Entry(grid, textvariable=self.ext_var, width=40).grid(row=4, column=1, sticky="ew", padx=4, pady=2)
        self.ext_var.trace_add("write", lambda *_: self._preview())

    def _build_tab_regex(self, nb):
        f = ttk.Frame(nb)
        nb.add(f, text="正規表現")

        grid = ttk.Frame(f)
        grid.pack(fill="x", padx=10, pady=8)

        self.re_pattern_var = tk.StringVar()
        self.re_replace_var = tk.StringVar()
        self.re_error_var   = tk.StringVar()

        ttk.Label(grid, text="正規表現パターン").grid(row=0, column=0, sticky="w", padx=4, pady=2)
        ttk.Entry(grid, textvariable=self.re_pattern_var, width=40).grid(row=0, column=1, sticky="ew", padx=4, pady=2)
        ttk.Label(grid, text="置換文字列 (\\1, \\2 など)").grid(row=1, column=0, sticky="w", padx=4, pady=2)
        ttk.Entry(grid, textvariable=self.re_replace_var, width=40).grid(row=1, column=1, sticky="ew", padx=4, pady=2)
        ttk.Label(grid, textvariable=self.re_error_var, foreground="#f38ba8").grid(row=2, column=1, sticky="w", padx=4)

        grid.columnconfigure(1, weight=1)
        self.re_pattern_var.trace_add("write", lambda *_: self._preview())
        self.re_replace_var.trace_add("write", lambda *_: self._preview())

    def _build_tab_case(self, nb):
        f = ttk.Frame(nb)
        nb.add(f, text="大文字/小文字")

        self.case_var = tk.StringVar(value="none")
        options = [
            ("変更なし", "none"),
            ("すべて大文字", "upper"),
            ("すべて小文字", "lower"),
            ("タイトルケース", "title"),
        ]
        for i, (label, value) in enumerate(options):
            ttk.Radiobutton(f, text=label, variable=self.case_var, value=value,
                            command=self._preview).pack(anchor="w", padx=14, pady=3)

    def _build_tab_number(self, nb):
        f = ttk.Frame(nb)
        nb.add(f, text="連番")

        self.num_enabled = tk.BooleanVar(value=False)
        self.num_start   = tk.IntVar(value=1)
        self.num_step    = tk.IntVar(value=1)
        self.num_digits  = tk.IntVar(value=2)
        self.num_pos_var = tk.StringVar(value="suffix")

        ttk.Checkbutton(f, text="連番を付ける", variable=self.num_enabled,
                        command=self._preview).pack(anchor="w", padx=14, pady=6)

        grid = ttk.Frame(f)
        grid.pack(fill="x", padx=14, pady=4)

        for row, (label, var, width) in enumerate([
            ("開始番号", self.num_start, 8),
            ("ステップ", self.num_step, 8),
            ("桁数 (ゼロ埋め)", self.num_digits, 8),
        ]):
            ttk.Label(grid, text=label).grid(row=row, column=0, sticky="w", padx=4, pady=2)
            ttk.Spinbox(grid, textvariable=var, from_=0, to=9999, width=width,
                        command=self._preview).grid(row=row, column=1, sticky="w", padx=4, pady=2)

        ttk.Label(grid, text="位置").grid(row=3, column=0, sticky="w", padx=4, pady=2)
        pos_frame = ttk.Frame(grid)
        pos_frame.grid(row=3, column=1, sticky="w", padx=4)
        ttk.Radiobutton(pos_frame, text="前", variable=self.num_pos_var, value="prefix",
                        command=self._preview).pack(side="left")
        ttk.Radiobutton(pos_frame, text="後", variable=self.num_pos_var, value="suffix",
                        command=self._preview).pack(side="left", padx=6)

    # ──────────────────────────────────────────
    def _bind_drop(self):
        # macOS drag-and-drop via tkinterdnd2 if available; fallback silently
        try:
            from tkinterdnd2 import DND_FILES
            self.drop_target_register(DND_FILES)
            self.dnd_bind('<<Drop>>', self._on_drop)
        except Exception:
            pass

    def _on_drop(self, event):
        raw = event.data
        paths = self.tk.splitlist(raw)
        for p in paths:
            path = Path(p)
            if path.is_file() and path not in self.files:
                self.files.append(path)
        self._preview()

    def _add_files(self):
        paths = filedialog.askopenfilenames(title="ファイルを選択")
        for p in paths:
            path = Path(p)
            if path not in self.files:
                self.files.append(path)
        self._preview()

    def _add_folder(self):
        folder = filedialog.askdirectory(title="フォルダを選択")
        if folder:
            for p in sorted(Path(folder).iterdir()):
                if p.is_file() and p not in self.files:
                    self.files.append(p)
        self._preview()

    def _clear(self):
        self.files.clear()
        self.tree.delete(*self.tree.get_children())
        self.status_var.set("ファイルを追加してください")

    # ──────────────────────────────────────────
    def _apply_rules(self, path: Path, index: int) -> str:
        stem = path.stem
        ext  = path.suffix

        # Basic tab
        tab = self._nb.index("current")

        if tab == 0:  # Basic
            if self.find_var.get():
                stem = stem.replace(self.find_var.get(), self.replace_var.get())
            stem = self.prefix_var.get() + stem + self.suffix_var.get()
            if self.ext_var.get():
                ext = self.ext_var.get() if self.ext_var.get().startswith(".") else "." + self.ext_var.get()

        elif tab == 1:  # Regex
            pattern = self.re_pattern_var.get()
            if pattern:
                try:
                    stem = re.sub(pattern, self.re_replace_var.get(), stem)
                    self.re_error_var.set("")
                except re.error as e:
                    self.re_error_var.set(f"❌ {e}")

        elif tab == 2:  # Case
            case = self.case_var.get()
            if case == "upper":   stem = stem.upper()
            elif case == "lower": stem = stem.lower()
            elif case == "title": stem = stem.title()

        elif tab == 3:  # Number
            if self.num_enabled.get():
                n = self.num_start.get() + index * self.num_step.get()
                num_str = str(n).zfill(self.num_digits.get())
                if self.num_pos_var.get() == "prefix":
                    stem = num_str + "_" + stem
                else:
                    stem = stem + "_" + num_str

        return stem + ext

    def _preview(self):
        self.tree.delete(*self.tree.get_children())
        if not self.files:
            self.status_var.set("ファイルを追加してください")
            return

        for i, path in enumerate(self.files):
            new_name = self._apply_rules(path, i)
            conflict = "⚠ 重複" if new_name == path.name else ""
            self.tree.insert("", "end", values=(path.name, new_name, conflict), iid=str(i))

        self.status_var.set(f"{len(self.files)} ファイル")

    def _rename(self):
        if not self.files:
            messagebox.showinfo("情報", "ファイルを追加してください")
            return

        success, errors = 0, []
        for i, path in enumerate(self.files):
            new_name = self._apply_rules(path, i)
            new_path = path.parent / new_name
            if new_path == path:
                continue
            try:
                path.rename(new_path)
                self.files[i] = new_path
                success += 1
            except Exception as e:
                errors.append(f"{path.name}: {e}")

        if errors:
            messagebox.showerror("エラー", "\n".join(errors[:10]))
        else:
            messagebox.showinfo("完了", f"{success} 件のファイルをリネームしました")

        self._preview()


if __name__ == "__main__":
    app = FileRenamer()
    app.mainloop()
