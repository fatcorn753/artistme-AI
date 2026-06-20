#!/usr/bin/env python3
"""
System Monitor — macOSメニューバー風システムモニター
CPU・メモリ・ディスク・ネットワークをリアルタイム表示。
標準ライブラリ + macOS標準コマンドのみ使用。
"""

import tkinter as tk
from tkinter import ttk
import subprocess
import threading
import time
import re
from pathlib import Path


# ── macOS system info via shell commands ──────────────
def get_cpu_percent():
    """CPU使用率（top コマンド）"""
    try:
        out = subprocess.check_output(
            ['top', '-l', '1', '-n', '0', '-stats', 'cpu'],
            timeout=3, stderr=subprocess.DEVNULL, text=True
        )
        m = re.search(r'(\d+\.\d+)%\s+user', out)
        if m: return float(m.group(1))
        m = re.search(r'CPU usage:\s+([\d.]+)%\s+user,\s+([\d.]+)%\s+sys', out)
        if m: return float(m.group(1)) + float(m.group(2))
    except Exception:
        pass
    return 0.0


def get_memory():
    """メモリ使用状況（vm_stat）"""
    try:
        out = subprocess.check_output(['vm_stat'], timeout=3, text=True)
        page_size = 4096
        stats = {}
        for line in out.splitlines():
            m = re.match(r'(.+?):\s+(\d+)', line)
            if m:
                stats[m.group(1).strip()] = int(m.group(2)) * page_size

        total_out = subprocess.check_output(['sysctl', '-n', 'hw.memsize'], timeout=3, text=True).strip()
        total = int(total_out)

        free   = stats.get('Pages free', 0)
        inactive = stats.get('Pages inactive', 0)
        used   = total - free - inactive
        pct    = used / total * 100 if total > 0 else 0
        return {'total': total, 'used': used, 'free': free + inactive, 'percent': pct}
    except Exception:
        return {'total': 0, 'used': 0, 'free': 0, 'percent': 0.0}


def get_disk():
    """ディスク使用状況（df）"""
    try:
        out = subprocess.check_output(['df', '-k', '/'], timeout=3, text=True)
        lines = out.strip().splitlines()
        if len(lines) >= 2:
            parts = lines[1].split()
            total = int(parts[1]) * 1024
            used  = int(parts[2]) * 1024
            pct   = int(parts[4].strip('%'))
            return {'total': total, 'used': used, 'free': total - used, 'percent': pct}
    except Exception:
        pass
    return {'total': 0, 'used': 0, 'free': 0, 'percent': 0}


def get_network():
    """ネットワーク送受信（netstat -ib）"""
    try:
        out = subprocess.check_output(['netstat', '-ib'], timeout=3, text=True)
        rx_total = tx_total = 0
        for line in out.splitlines()[1:]:
            parts = line.split()
            if len(parts) >= 11 and parts[0] not in ('lo0',) and not parts[0].startswith('lo'):
                try:
                    rx_total += int(parts[6])
                    tx_total += int(parts[9])
                except (ValueError, IndexError):
                    pass
        return {'rx': rx_total, 'tx': tx_total}
    except Exception:
        return {'rx': 0, 'tx': 0}


def get_processes():
    """プロセス一覧（top）"""
    try:
        out = subprocess.check_output(
            ['top', '-l', '1', '-n', '10', '-o', 'cpu', '-stats', 'pid,command,cpu,mem'],
            timeout=5, stderr=subprocess.DEVNULL, text=True
        )
        procs = []
        in_procs = False
        for line in out.splitlines():
            if line.startswith('PID'):
                in_procs = True; continue
            if in_procs and line.strip():
                parts = line.split()
                if len(parts) >= 4:
                    try:
                        procs.append({'pid': parts[0], 'name': parts[1][:20],
                                      'cpu': parts[2], 'mem': parts[3]})
                    except Exception:
                        pass
        return procs[:10]
    except Exception:
        return []


def human_bytes(n):
    for unit in ('B', 'KB', 'MB', 'GB', 'TB'):
        if n < 1024: return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"


# ── UI ────────────────────────────────────────────────
class SystemMonitor(tk.Tk):
    REFRESH_MS = 2000

    def __init__(self):
        super().__init__()
        self.title("System Monitor")
        self.geometry("480x600")
        self.configure(bg="#0d1117")
        self.resizable(True, True)

        self._net_prev = None
        self._net_time = None
        self._history = {'cpu': [], 'mem': []}

        self._build_ui()
        self._refresh()

    def _build_ui(self):
        s = ttk.Style(self)
        s.theme_use("clam")
        BG, FG, FG2 = "#0d1117", "#e6edf3", "#8b949e"
        CARD = "#161b22"; BORDER = "#30363d"; ACC = "#58a6ff"
        s.configure(".", background=BG, foreground=FG)
        s.configure("TFrame", background=BG)
        s.configure("TLabel", background=BG, foreground=FG)
        s.configure("TLabelframe", background=CARD, foreground=FG2)
        s.configure("TLabelframe.Label", background=BG, foreground=FG2, font=("",10))
        s.configure("Treeview", background=CARD, foreground=FG, fieldbackground=CARD, rowheight=20)
        s.configure("Treeview.Heading", background=BORDER, foreground=FG2, font=("",10))
        s.map("Treeview", background=[("selected","#1f6feb")])
        s.configure("TProgressbar", troughcolor=BORDER, background=ACC, thickness=8)

        # Header
        hdr = tk.Frame(self, bg="#0d1117")
        hdr.pack(fill="x", padx=14, pady=(12,8))
        tk.Label(hdr, text="📊 System Monitor", font=("",15,"bold"),
                 bg=BG, fg="#58a6ff").pack(side="left")
        self.refresh_label = tk.Label(hdr, text="", font=("",9), bg=BG, fg=FG2)
        self.refresh_label.pack(side="right")

        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=10, pady=4)

        # ── Overview tab ──
        ov = tk.Frame(notebook, bg=BG)
        notebook.add(ov, text="概要")
        self._build_overview(ov)

        # ── Process tab ──
        pt = tk.Frame(notebook, bg=BG)
        notebook.add(pt, text="プロセス")
        self._build_processes(pt)

    def _build_overview(self, parent):
        scroll_frame = tk.Frame(parent, bg="#0d1117")
        scroll_frame.pack(fill="both", expand=True)

        def card(title):
            f = tk.LabelFrame(scroll_frame, text=title, bg="#161b22", fg="#8b949e",
                              font=("",10), bd=1, relief="solid", padx=10, pady=8)
            f.pack(fill="x", padx=10, pady=5)
            return f

        # CPU
        cpu_card = card("🖥  CPU")
        self.cpu_label  = tk.Label(cpu_card, text="—", font=("",24,"bold"), bg="#161b22", fg="#58a6ff")
        self.cpu_label.pack(anchor="w")
        self.cpu_bar = ttk.Progressbar(cpu_card, length=400, maximum=100)
        self.cpu_bar.pack(fill="x", pady=4)
        self.cpu_canvas = tk.Canvas(cpu_card, height=40, bg="#0d1117", bd=0, highlightthickness=0)
        self.cpu_canvas.pack(fill="x", pady=(4,0))

        # Memory
        mem_card = card("💾  メモリ")
        self.mem_label = tk.Label(mem_card, text="—", font=("",18,"bold"), bg="#161b22", fg="#79c0ff")
        self.mem_label.pack(anchor="w")
        self.mem_bar = ttk.Progressbar(mem_card, length=400, maximum=100,
                                        style="mem.Horizontal.TProgressbar")
        ttk.Style().configure("mem.Horizontal.TProgressbar", background="#79c0ff")
        self.mem_bar.pack(fill="x", pady=4)
        self.mem_detail = tk.Label(mem_card, text="", font=("",10), bg="#161b22", fg="#8b949e")
        self.mem_detail.pack(anchor="w")

        # Disk
        disk_card = card("💽  ディスク (/)")
        self.disk_label = tk.Label(disk_card, text="—", font=("",18,"bold"), bg="#161b22", fg="#56d364")
        self.disk_label.pack(anchor="w")
        self.disk_bar = ttk.Progressbar(disk_card, length=400, maximum=100,
                                         style="disk.Horizontal.TProgressbar")
        ttk.Style().configure("disk.Horizontal.TProgressbar", background="#56d364")
        self.disk_bar.pack(fill="x", pady=4)
        self.disk_detail = tk.Label(disk_card, text="", font=("",10), bg="#161b22", fg="#8b949e")
        self.disk_detail.pack(anchor="w")

        # Network
        net_card = card("🌐  ネットワーク")
        net_row = tk.Frame(net_card, bg="#161b22")
        net_row.pack(fill="x")
        self.net_rx_label = tk.Label(net_row, text="↓ —", font=("",13,"bold"), bg="#161b22", fg="#f0883e")
        self.net_rx_label.pack(side="left", padx=(0,20))
        self.net_tx_label = tk.Label(net_row, text="↑ —", font=("",13,"bold"), bg="#161b22", fg="#d2a8ff")
        self.net_tx_label.pack(side="left")

    def _build_processes(self, parent):
        cols = ("PID", "名前", "CPU%", "メモリ")
        self.proc_tree = ttk.Treeview(parent, columns=cols, show="headings", height=18)
        for col, w in zip(cols, [60, 200, 60, 80]):
            self.proc_tree.heading(col, text=col)
            self.proc_tree.column(col, width=w)
        vsb = ttk.Scrollbar(parent, orient="vertical", command=self.proc_tree.yview)
        self.proc_tree.configure(yscrollcommand=vsb.set)
        self.proc_tree.pack(side="left", fill="both", expand=True, padx=(10,0), pady=10)
        vsb.pack(side="right", fill="y", pady=10, padx=(0,10))

    # ── Data refresh ──────────────────────────────────
    def _refresh(self):
        threading.Thread(target=self._fetch_data, daemon=True).start()

    def _fetch_data(self):
        cpu  = get_cpu_percent()
        mem  = get_memory()
        disk = get_disk()
        net  = get_network()
        procs= get_processes()
        self.after(0, lambda: self._update_ui(cpu, mem, disk, net, procs))
        self.after(self.REFRESH_MS, self._refresh)

    def _update_ui(self, cpu, mem, disk, net, procs):
        # CPU
        self.cpu_label.config(text=f"{cpu:.1f}%")
        self.cpu_bar['value'] = cpu
        self._history['cpu'].append(cpu)
        if len(self._history['cpu']) > 40: self._history['cpu'].pop(0)
        self._draw_sparkline(self.cpu_canvas, self._history['cpu'], "#58a6ff")

        # Memory
        self.mem_label.config(text=f"{mem['percent']:.1f}%")
        self.mem_bar['value'] = mem['percent']
        self.mem_detail.config(text=f"使用: {human_bytes(mem['used'])} / 合計: {human_bytes(mem['total'])}")

        # Disk
        self.disk_label.config(text=f"{disk['percent']}%")
        self.disk_bar['value'] = disk['percent']
        self.disk_detail.config(text=f"使用: {human_bytes(disk['used'])} / 空き: {human_bytes(disk['free'])}")

        # Network speed
        now = time.time()
        if self._net_prev and self._net_time:
            dt = now - self._net_time
            if dt > 0:
                rx_speed = (net['rx'] - self._net_prev['rx']) / dt
                tx_speed = (net['tx'] - self._net_prev['tx']) / dt
                self.net_rx_label.config(text=f"↓ {human_bytes(max(0,rx_speed))}/s")
                self.net_tx_label.config(text=f"↑ {human_bytes(max(0,tx_speed))}/s")
        self._net_prev = net
        self._net_time = now

        # Processes
        self.proc_tree.delete(*self.proc_tree.get_children())
        for p in procs:
            self.proc_tree.insert("", "end", values=(p['pid'], p['name'], p['cpu'], p['mem']))

        self.refresh_label.config(text=f"更新: {time.strftime('%H:%M:%S')}")

    def _draw_sparkline(self, canvas, data, color):
        canvas.delete("all")
        if len(data) < 2: return
        w = canvas.winfo_width() or 400
        h = canvas.winfo_height() or 40
        max_val = max(max(data), 1)
        step = w / (len(data) - 1)
        pts = []
        for i, v in enumerate(data):
            x = i * step
            y = h - (v / max_val) * (h - 4) - 2
            pts.extend([x, y])
        if len(pts) >= 4:
            canvas.create_line(pts, fill=color, width=1.5, smooth=True)


if __name__ == "__main__":
    app = SystemMonitor()
    app.mainloop()
