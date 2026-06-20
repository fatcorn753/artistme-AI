#!/usr/bin/env python3
"""
Markdown Editor — リアルタイムプレビュー付きMarkdownエディタ
左ペイン: エディタ / 右ペイン: HTMLプレビュー（tkinter + tkinterweb or 代替）
依存: 標準ライブラリのみ（tkinter）
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, font as tkfont
import re
from pathlib import Path
import webbrowser
import tempfile
import os


# ── Minimal Markdown → HTML renderer ──────────────────
def md_to_html(text: str) -> str:
    lines = text.split('\n')
    html_lines = []
    in_code_block = False
    in_ul = False
    in_ol = False

    def close_lists():
        nonlocal in_ul, in_ol
        if in_ul:   html_lines.append('</ul>');  in_ul = False
        if in_ol:   html_lines.append('</ol>');  in_ol = False

    def inline(t):
        t = t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        t = re.sub(r'`(.+?)`', r'<code>\1</code>', t)
        t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
        t = re.sub(r'\*(.+?)\*', r'<em>\1</em>', t)
        t = re.sub(r'~~(.+?)~~', r'<del>\1</del>', t)
        t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', t)
        t = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'<img src="\2" alt="\1" style="max-width:100%">', t)
        return t

    i = 0
    while i < len(lines):
        line = lines[i]

        # Fenced code block
        if line.startswith('```'):
            close_lists()
            lang = line[3:].strip()
            if not in_code_block:
                html_lines.append(f'<pre><code class="language-{lang}">')
                in_code_block = True
            else:
                html_lines.append('</code></pre>')
                in_code_block = False
            i += 1; continue

        if in_code_block:
            html_lines.append(line.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;'))
            i += 1; continue

        # HR
        if re.match(r'^[-*_]{3,}$', line.strip()):
            close_lists(); html_lines.append('<hr>'); i += 1; continue

        # Headings
        m = re.match(r'^(#{1,6})\s+(.*)', line)
        if m:
            close_lists()
            lvl = len(m.group(1))
            html_lines.append(f'<h{lvl}>{inline(m.group(2))}</h{lvl}>')
            i += 1; continue

        # Blockquote
        if line.startswith('> '):
            close_lists()
            html_lines.append(f'<blockquote>{inline(line[2:])}</blockquote>')
            i += 1; continue

        # Unordered list
        m = re.match(r'^[-*+]\s+(.*)', line)
        if m:
            if not in_ul: html_lines.append('<ul>'); in_ul = True
            html_lines.append(f'<li>{inline(m.group(1))}</li>')
            i += 1; continue

        # Ordered list
        m = re.match(r'^\d+\.\s+(.*)', line)
        if m:
            if not in_ol: html_lines.append('<ol>'); in_ol = True
            html_lines.append(f'<li>{inline(m.group(1))}</li>')
            i += 1; continue

        close_lists()

        # Table
        if '|' in line:
            rows = [r.strip() for r in line.strip('|').split('|')]
            # Check if next line is separator
            if i+1 < len(lines) and re.match(r'^[\|\-: ]+$', lines[i+1]):
                html_lines.append('<table><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in rows) + '</tr></thead><tbody>')
                i += 2
                while i < len(lines) and '|' in lines[i]:
                    cells = [c.strip() for c in lines[i].strip('|').split('|')]
                    html_lines.append('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in cells) + '</tr>')
                    i += 1
                html_lines.append('</tbody></table>')
                continue
            else:
                html_lines.append(f'<p>{inline(line)}</p>')
                i += 1; continue

        # Empty line
        if not line.strip():
            html_lines.append('')
        else:
            html_lines.append(f'<p>{inline(line)}</p>')

        i += 1

    close_lists()
    if in_code_block:
        html_lines.append('</code></pre>')

    return '\n'.join(html_lines)


FULL_HTML = """<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: {bg}; color: {fg}; padding: 24px 32px; line-height: 1.7;
          max-width: 760px; margin: 0 auto; }}
  h1,h2,h3,h4,h5,h6 {{ color: {h}; border-bottom: 1px solid {border}; padding-bottom: 4px; margin: 20px 0 10px; }}
  code {{ background: {code_bg}; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }}
  pre {{ background: {code_bg}; padding: 14px; border-radius: 8px; overflow-x: auto; }}
  pre code {{ background: none; padding: 0; }}
  blockquote {{ border-left: 4px solid {acc}; padding-left: 14px; color: {fg2}; margin: 10px 0; }}
  table {{ border-collapse: collapse; width: 100%; margin: 12px 0; }}
  th,td {{ border: 1px solid {border}; padding: 8px 12px; }}
  th {{ background: {code_bg}; }}
  a {{ color: {acc}; }}
  hr {{ border: none; border-top: 1px solid {border}; margin: 16px 0; }}
  img {{ max-width: 100%; border-radius: 6px; }}
  ul,ol {{ padding-left: 24px; }}
  del {{ color: {fg2}; }}
</style></head>
<body>{body}</body></html>"""


# ── Editor ────────────────────────────────────────────
class MarkdownEditor(tk.Tk):
    THEMES = {
        'dark': dict(bg='#1e1e2e', fg='#cdd6f4', h='#89b4fa', fg2='#6c7086',
                     code_bg='#313244', border='#45475a', acc='#89b4fa',
                     ed_bg='#1e1e2e', ed_fg='#cdd6f4', ed_sel='#313244',
                     widget_bg='#181825', toolbar_bg='#181825'),
        'light': dict(bg='#ffffff', fg='#24292e', h='#0066cc', fg2='#6a737d',
                      code_bg='#f6f8fa', border='#e1e4e8', acc='#0366d6',
                      ed_bg='#f8f9fa', ed_fg='#24292e', ed_sel='#d0e8ff',
                      widget_bg='#ffffff', toolbar_bg='#f6f8fa'),
    }

    def __init__(self):
        super().__init__()
        self.title("Markdown Editor")
        self.geometry("1100x700")
        self.minsize(700, 400)

        self.current_file: Path | None = None
        self.modified = False
        self.theme_name = 'dark'
        self.theme = self.THEMES[self.theme_name]
        self._preview_file = tempfile.NamedTemporaryFile(suffix='.html', delete=False, mode='w', encoding='utf-8')
        self._preview_file.close()

        self._build_ui()
        self._apply_theme()
        self._new_file()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── Build UI ──────────────────────────────────────
    def _build_ui(self):
        s = ttk.Style(self)
        s.theme_use('clam')

        # Menu
        menubar = tk.Menu(self)
        file_menu = tk.Menu(menubar, tearoff=False)
        file_menu.add_command(label="新規 (⌘N)", command=self._new_file, accelerator="Command-n")
        file_menu.add_command(label="開く (⌘O)", command=self._open_file, accelerator="Command-o")
        file_menu.add_separator()
        file_menu.add_command(label="保存 (⌘S)", command=self._save_file, accelerator="Command-s")
        file_menu.add_command(label="名前を付けて保存", command=self._save_as)
        file_menu.add_separator()
        file_menu.add_command(label="HTMLとして書き出し", command=self._export_html)
        file_menu.add_command(label="ブラウザで開く", command=self._open_in_browser)
        menubar.add_cascade(label="ファイル", menu=file_menu)

        view_menu = tk.Menu(menubar, tearoff=False)
        view_menu.add_command(label="テーマ切替 (ダーク/ライト)", command=self._toggle_theme)
        self.word_wrap_var = tk.BooleanVar(value=True)
        view_menu.add_checkbutton(label="ワードラップ", variable=self.word_wrap_var, command=self._toggle_wrap)
        menubar.add_cascade(label="表示", menu=view_menu)
        self.configure(menu=menubar)

        # Keyboard shortcuts
        self.bind('<Command-n>', lambda _: self._new_file())
        self.bind('<Command-o>', lambda _: self._open_file())
        self.bind('<Command-s>', lambda _: self._save_file())

        # Toolbar
        self.toolbar = tk.Frame(self, height=36)
        self.toolbar.pack(fill='x')

        self._toolbar_buttons = []
        btn_defs = [
            ("B", self._insert_bold), ("I", self._insert_italic),
            ("H", self._insert_heading), ("—", self._insert_hr),
            ("`", self._insert_code), ("```", self._insert_code_block),
            ("≡", self._insert_list), ("1.", self._insert_ol),
            ("> ", self._insert_quote), ("🔗", self._insert_link),
        ]
        for label, cmd in btn_defs:
            btn = tk.Button(self.toolbar, text=label, command=cmd,
                            relief='flat', padx=8, pady=4, font=('', 11, 'bold'), cursor='hand2')
            btn.pack(side='left', padx=1, pady=3)
            self._toolbar_buttons.append(btn)

        tk.Frame(self.toolbar, width=1).pack(side='left', padx=6)
        self.stats_label = tk.Label(self.toolbar, text="", font=('', 10))
        self.stats_label.pack(side='right', padx=10)

        # Paned window
        self.paned = tk.PanedWindow(self, orient='horizontal', sashwidth=4, relief='flat')
        self.paned.pack(fill='both', expand=True)

        # Editor pane
        editor_frame = tk.Frame(self.paned)
        self.editor = tk.Text(
            editor_frame, wrap='word', undo=True, font=('Menlo', 13),
            relief='flat', borderwidth=0, insertwidth=2,
            selectborderwidth=0, padx=16, pady=12, spacing1=2, spacing3=2,
        )
        ed_vsb = tk.Scrollbar(editor_frame, command=self.editor.yview)
        self.editor.configure(yscrollcommand=ed_vsb.set)
        self.editor.pack(side='left', fill='both', expand=True)
        ed_vsb.pack(side='right', fill='y')
        self.paned.add(editor_frame, minsize=300)

        # Preview pane (simple Text widget for rendered text preview)
        preview_frame = tk.Frame(self.paned)
        self.preview = tk.Text(
            preview_frame, wrap='word', font=('Helvetica Neue', 13),
            relief='flat', borderwidth=0, state='disabled',
            padx=16, pady=12, spacing1=3, spacing3=3, cursor='arrow',
        )
        pv_vsb = tk.Scrollbar(preview_frame, command=self.preview.yview)
        self.preview.configure(yscrollcommand=pv_vsb.set)
        self.preview.pack(side='left', fill='both', expand=True)
        pv_vsb.pack(side='right', fill='y')
        self.paned.add(preview_frame, minsize=200)

        # Status bar
        self.statusbar = tk.Frame(self, height=24)
        self.statusbar.pack(fill='x', side='bottom')
        self.status_var = tk.StringVar(value="新規ファイル")
        tk.Label(self.statusbar, textvariable=self.status_var, font=('', 10), anchor='w').pack(side='left', padx=8)
        self.cursor_label = tk.Label(self.statusbar, text="1:1", font=('', 10), anchor='e')
        self.cursor_label.pack(side='right', padx=8)

        # Syntax highlighting tags
        self._setup_tags()

        self.editor.bind('<KeyRelease>', self._on_edit)
        self.editor.bind('<ButtonRelease>', self._update_cursor)
        self._update_interval()

    def _setup_tags(self):
        self.editor.tag_configure('heading',   font=('Menlo', 14, 'bold'))
        self.editor.tag_configure('bold',      font=('Menlo', 13, 'bold'))
        self.editor.tag_configure('italic',    font=('Menlo', 13, 'italic'))
        self.editor.tag_configure('code',      font=('Menlo', 12), background='#313244')
        self.editor.tag_configure('blockquote',foreground='#6c7086')
        self.editor.tag_configure('link',      foreground='#89b4fa', underline=True)

    # ── Theme ─────────────────────────────────────────
    def _apply_theme(self):
        t = self.theme
        self.configure(bg=t['widget_bg'])
        self.toolbar.configure(bg=t['toolbar_bg'])
        self.statusbar.configure(bg=t['toolbar_bg'])

        for w in self.toolbar.winfo_children():
            if isinstance(w, tk.Button):
                w.configure(bg=t['toolbar_bg'], fg=t['fg'], activebackground=t['widget_bg'])
            elif isinstance(w, tk.Label):
                w.configure(bg=t['toolbar_bg'], fg=t['fg2'])

        self.stats_label.configure(bg=t['toolbar_bg'], fg=t['fg2'])

        for widget in [self.editor, self.preview]:
            widget.configure(bg=t['ed_bg'], fg=t['ed_fg'],
                             insertbackground=t['fg'], selectbackground=t['ed_sel'])

        for child in self.statusbar.winfo_children():
            child.configure(bg=t['toolbar_bg'], fg=t['fg2'])

        self.paned.configure(bg=t['widget_bg'], sashrelief='flat')
        self.editor.tag_configure('code', background=t['code_bg'])
        self.editor.tag_configure('heading', foreground=t['h'])
        self.editor.tag_configure('link', foreground=t['acc'])
        self.editor.tag_configure('blockquote', foreground=t['fg2'])

    def _toggle_theme(self):
        self.theme_name = 'light' if self.theme_name == 'dark' else 'dark'
        self.theme = self.THEMES[self.theme_name]
        self._apply_theme()
        self._update_preview()

    def _toggle_wrap(self):
        self.editor.configure(wrap='word' if self.word_wrap_var.get() else 'none')

    # ── File ops ──────────────────────────────────────
    def _new_file(self):
        if self.modified and not messagebox.askyesno("確認", "変更を破棄しますか？"):
            return
        self.editor.delete('1.0', 'end')
        self.editor.insert('1.0', '# 新しいドキュメント\n\nここに書き始めましょう...\n')
        self.current_file = None
        self.modified = False
        self.title("Markdown Editor — 無題")
        self.status_var.set("新規ファイル")
        self._update_preview()

    def _open_file(self):
        path = filedialog.askopenfilename(
            title="Markdownファイルを開く",
            filetypes=[("Markdown", "*.md *.markdown *.txt"), ("すべて", "*.*")]
        )
        if path:
            self.editor.delete('1.0', 'end')
            self.editor.insert('1.0', Path(path).read_text(encoding='utf-8'))
            self.current_file = Path(path)
            self.modified = False
            self.title(f"Markdown Editor — {self.current_file.name}")
            self.status_var.set(str(self.current_file))
            self._update_preview()

    def _save_file(self):
        if not self.current_file:
            self._save_as(); return
        self.current_file.write_text(self.editor.get('1.0', 'end-1c'), encoding='utf-8')
        self.modified = False
        self.title(f"Markdown Editor — {self.current_file.name}")

    def _save_as(self):
        path = filedialog.asksaveasfilename(
            title="保存先を選択",
            defaultextension=".md",
            filetypes=[("Markdown", "*.md"), ("すべて", "*.*")]
        )
        if path:
            self.current_file = Path(path)
            self._save_file()

    def _export_html(self):
        path = filedialog.asksaveasfilename(
            title="HTMLとして保存", defaultextension=".html",
            filetypes=[("HTML", "*.html")]
        )
        if path:
            body = md_to_html(self.editor.get('1.0', 'end-1c'))
            t = self.theme
            Path(path).write_text(FULL_HTML.format(body=body, **t), encoding='utf-8')
            messagebox.showinfo("完了", f"書き出し完了: {path}")

    def _open_in_browser(self):
        body = md_to_html(self.editor.get('1.0', 'end-1c'))
        t = self.theme
        with open(self._preview_file.name, 'w', encoding='utf-8') as f:
            f.write(FULL_HTML.format(body=body, **t))
        webbrowser.open('file://' + self._preview_file.name)

    # ── Toolbar inserts ───────────────────────────────
    def _insert(self, text, move_back=0):
        try:
            sel_start = self.editor.index('sel.first')
            sel_end   = self.editor.index('sel.last')
            selected  = self.editor.get(sel_start, sel_end)
            self.editor.delete(sel_start, sel_end)
            self.editor.insert(sel_start, text.replace('cursor', selected))
            return
        except tk.TclError:
            pass
        pos = self.editor.index('insert')
        self.editor.insert(pos, text.replace('cursor', ''))
        if move_back:
            self.editor.mark_set('insert', f"insert-{move_back}c")
        self.editor.focus()
        self._on_edit()

    def _insert_bold(self):        self._insert('**cursor**', 2)
    def _insert_italic(self):      self._insert('*cursor*', 1)
    def _insert_heading(self):     self._insert('\n## cursor', 0)
    def _insert_hr(self):          self._insert('\n---\n', 0)
    def _insert_code(self):        self._insert('`cursor`', 1)
    def _insert_code_block(self):  self._insert('\n```\ncursor\n```\n', 5)
    def _insert_list(self):        self._insert('\n- cursor', 0)
    def _insert_ol(self):          self._insert('\n1. cursor', 0)
    def _insert_quote(self):       self._insert('\n> cursor', 0)
    def _insert_link(self):        self._insert('[cursor](https://)', 10)

    # ── Live update ───────────────────────────────────
    def _on_edit(self, event=None):
        self.modified = True
        name = self.current_file.name if self.current_file else "無題"
        self.title(f"Markdown Editor — {name} •")
        self._update_cursor()

    def _update_cursor(self, event=None):
        pos = self.editor.index('insert')
        row, col = pos.split('.')
        self.cursor_label.configure(text=f"{row}:{int(col)+1}")
        text = self.editor.get('1.0', 'end-1c')
        words = len(text.split())
        chars = len(text.replace('\n',''))
        self.stats_label.configure(text=f"{words}語 / {chars}文字")

    def _update_interval(self):
        self._update_preview()
        self._highlight()
        self.after(600, self._update_interval)

    def _update_preview(self):
        text = self.editor.get('1.0', 'end-1c')
        html_body = md_to_html(text)
        t = self.theme

        self.preview.configure(state='normal')
        self.preview.delete('1.0', 'end')

        # Simple text preview (strip HTML tags for display)
        plain = re.sub(r'<[^>]+>', '', html_body)
        plain = plain.replace('&amp;','&').replace('&lt;','<').replace('&gt;','>')
        self.preview.insert('1.0', plain)
        self.preview.configure(state='disabled')

    def _highlight(self):
        for tag in ('heading','bold','italic','code','blockquote','link'):
            self.editor.tag_remove(tag, '1.0', 'end')

        content = self.editor.get('1.0', 'end')
        patterns = [
            ('heading',    r'^#{1,6} .+$',   re.MULTILINE),
            ('bold',       r'\*\*.+?\*\*',    0),
            ('italic',     r'\*.+?\*',        0),
            ('code',       r'`[^`\n]+`',      0),
            ('blockquote', r'^> .+$',         re.MULTILINE),
            ('link',       r'\[.+?\]\(.+?\)', 0),
        ]
        for tag, pattern, flags in patterns:
            for m in re.finditer(pattern, content, flags):
                start = f'1.0+{m.start()}c'
                end   = f'1.0+{m.end()}c'
                self.editor.tag_add(tag, start, end)

    def _on_close(self):
        if self.modified:
            if messagebox.askyesno("確認", "変更を保存しますか？"):
                self._save_file()
        try:
            os.unlink(self._preview_file.name)
        except Exception:
            pass
        self.destroy()


if __name__ == '__main__':
    app = MarkdownEditor()
    app.mainloop()
