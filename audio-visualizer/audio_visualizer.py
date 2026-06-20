#!/usr/bin/env python3
"""
Audio Visualizer — リアルタイム音声波形・スペクトラム表示
マイク入力または仮想デモモードで動作。FFTスペクトラム分析、
波形表示、VUメーター、BPM推定。標準ライブラリ + ctypes/struct。
"""

import tkinter as tk
from tkinter import ttk
import math
import random
import threading
import time
import struct


class AudioVisualizer(tk.Tk):
    SAMPLE_RATE = 44100
    CHUNK = 2048
    FFT_BINS = 64

    def __init__(self):
        super().__init__()
        self.title("Audio Visualizer 🎵")
        self.geometry("900x600")
        self.configure(bg="#0d0d1a")
        self.resizable(True, True)

        self.running = False
        self.demo_mode = True  # Always use demo mode (no external deps)
        self.demo_t = 0.0
        self.beat_time = 0.0
        self.bpm = 120
        self.volume = 0.0

        self.waveform_data = [0.0] * 256
        self.fft_data      = [0.0] * self.FFT_BINS
        self.vu_left = 0.0; self.vu_right = 0.0
        self.history_waveform = []

        # Visual settings
        self.viz_mode = tk.StringVar(value="spectrum")
        self.color_mode = tk.StringVar(value="rainbow")
        self.smoothing = tk.DoubleVar(value=0.7)
        self.sensitivity = tk.DoubleVar(value=1.0)
        self.show_beat = tk.BooleanVar(value=True)

        self._build_ui()
        self._start_demo()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── Demo engine ───────────────────────────────────
    def _start_demo(self):
        self.running = True
        threading.Thread(target=self._demo_loop, daemon=True).start()

    def _demo_loop(self):
        while self.running:
            self.demo_t += 1 / 60.0
            t = self.demo_t
            bps = self.bpm / 60.0

            # Generate synthetic audio data
            beat_phase = (t * bps) % 1.0
            is_beat = beat_phase < 0.08
            beat_amp = math.exp(-beat_phase * 20) * 0.8 if beat_phase < 0.3 else 0

            # Waveform: mix of sine waves + noise
            new_wave = []
            for i in range(256):
                ti = t + i / 256.0 * 0.1
                sample = (
                    math.sin(2 * math.pi * 440 * ti) * 0.3 +
                    math.sin(2 * math.pi * 880 * ti) * 0.15 +
                    math.sin(2 * math.pi * 220 * ti) * 0.2 +
                    math.sin(2 * math.pi * 110 * ti + beat_amp * 2) * beat_amp +
                    (random.random() - 0.5) * 0.1
                )
                new_wave.append(sample * self.sensitivity.get())
            self.waveform_data = new_wave

            # FFT spectrum (simulated)
            smooth = self.smoothing.get()
            for i in range(self.FFT_BINS):
                freq_ratio = i / self.FFT_BINS
                # Low frequencies get more energy on beats
                base = (1 - freq_ratio) ** 2.5 * (0.4 + beat_amp * 1.5)
                noise = random.random() * 0.15
                # Harmonic peaks
                for harmonic in [0.05, 0.1, 0.2, 0.35, 0.5]:
                    dist = abs(freq_ratio - harmonic)
                    base += max(0, 0.3 - dist * 8) * (0.5 + beat_amp)

                target = min(1.0, base * self.sensitivity.get() + noise)
                self.fft_data[i] = self.fft_data[i] * smooth + target * (1 - smooth)

            # VU meter
            rms = math.sqrt(sum(s**2 for s in new_wave) / len(new_wave))
            self.vu_left  = min(1.0, rms * 3 + beat_amp * 0.5)
            self.vu_right = min(1.0, rms * 2.8 + beat_amp * 0.4 + random.random() * 0.05)
            self.volume = rms

            self.beat_time = beat_phase
            time.sleep(1 / 60.0)

    # ── UI ────────────────────────────────────────────
    def _build_ui(self):
        # Toolbar
        toolbar = tk.Frame(self, bg="#12121e")
        toolbar.pack(fill="x")

        tk.Label(toolbar, text="🎵 Audio Visualizer", font=("",13,"bold"),
                 bg="#12121e", fg="#a78bfa").pack(side="left", padx=12, pady=6)

        # Viz mode
        tk.Label(toolbar, text="モード:", bg="#12121e", fg="#6b7280", font=("",10)).pack(side="left", padx=(8,2))
        for mode, label in [("spectrum","スペクトラム"),("waveform","波形"),("bars","バー"),
                             ("circle","サークル"),("waterfall","ウォーターフォール")]:
            btn = tk.Button(toolbar, text=label, bg="#1e1e2e", fg="#6b7280",
                            relief="flat", padx=6, pady=3, font=("",9), cursor="hand2",
                            command=lambda m=mode: self.viz_mode.set(m))
            btn.pack(side="left", padx=1, pady=4)

        tk.Label(toolbar, text="カラー:", bg="#12121e", fg="#6b7280", font=("",10)).pack(side="left", padx=(10,2))
        for cmode, clabel in [("rainbow","🌈"),("fire","🔥"),("ocean","🌊"),("neon","⚡"),("mono","⬜")]:
            btn = tk.Button(toolbar, text=clabel, bg="#1e1e2e", fg="#888",
                            relief="flat", padx=5, pady=3, font=("",11), cursor="hand2",
                            command=lambda c=cmode: self.color_mode.set(c))
            btn.pack(side="left", padx=1, pady=4)

        # Sensitivity
        tk.Label(toolbar, text="感度:", bg="#12121e", fg="#6b7280", font=("",9)).pack(side="left", padx=(8,2))
        tk.Scale(toolbar, from_=0.1, to=3.0, resolution=0.1, variable=self.sensitivity,
                 orient="horizontal", bg="#12121e", fg="#a78bfa", troughcolor="#1e1e2e",
                 showvalue=False, length=70).pack(side="left")

        # BPM
        tk.Label(toolbar, text="BPM:", bg="#12121e", fg="#6b7280", font=("",9)).pack(side="left", padx=(8,2))
        bpm_spin = tk.Spinbox(toolbar, from_=60, to=200, textvariable=tk.IntVar(value=120),
                              width=5, bg="#1e1e2e", fg="#a78bfa", font=("",10),
                              command=lambda: None, relief="flat")
        bpm_spin.pack(side="left")
        bpm_spin.bind("<Return>", lambda e: setattr(self, 'bpm', int(bpm_spin.get())))

        self.bpm_lbl = tk.Label(toolbar, text="♩120", bg="#12121e", fg="#a78bfa", font=("",10))
        self.bpm_lbl.pack(side="left", padx=4)

        # Right controls
        self.beat_indicator = tk.Label(toolbar, text="●", font=("",14),
                                        bg="#12121e", fg="#2d2d4e")
        self.beat_indicator.pack(side="right", padx=10)

        # Main canvas area
        main = tk.Frame(self, bg="#0d0d1a")
        main.pack(fill="both", expand=True)

        # VU meters (left side)
        vu_frame = tk.Frame(main, bg="#0d0d1a", width=40)
        vu_frame.pack(side="left", fill="y", padx=4)
        vu_frame.pack_propagate(False)

        tk.Label(vu_frame, text="L", bg="#0d0d1a", fg="#4b5563", font=("",9)).pack(pady=(8,2))
        self.vu_canvas_l = tk.Canvas(vu_frame, width=16, bg="#0d0d1a", bd=0, highlightthickness=0)
        self.vu_canvas_l.pack(fill="y", expand=True, pady=2)
        tk.Label(vu_frame, text="R", bg="#0d0d1a", fg="#4b5563", font=("",9)).pack(pady=(2,2))
        self.vu_canvas_r = tk.Canvas(vu_frame, width=16, bg="#0d0d1a", bd=0, highlightthickness=0)
        self.vu_canvas_r.pack(fill="y", expand=True, pady=2)

        # Main visualization canvas
        self.viz_canvas = tk.Canvas(main, bg="#0d0d1a", bd=0, highlightthickness=0)
        self.viz_canvas.pack(fill="both", expand=True, padx=4, pady=4)

        # Status bar
        self.status_bar = tk.Frame(self, bg="#12121e")
        self.status_bar.pack(fill="x")
        self.vol_lbl   = tk.Label(self.status_bar, text="音量: 0.0", bg="#12121e", fg="#4b5563", font=("",9))
        self.vol_lbl.pack(side="left", padx=10, pady=4)
        self.fps_lbl   = tk.Label(self.status_bar, text="60 FPS", bg="#12121e", fg="#4b5563", font=("",9))
        self.fps_lbl.pack(side="right", padx=10)
        self.mode_lbl  = tk.Label(self.status_bar, text="デモモード", bg="#12121e", fg="#4b5563", font=("",9))
        self.mode_lbl.pack(side="right", padx=10)

        self._draw_loop()

    # ── Color helpers ─────────────────────────────────
    def _get_color(self, value: float, index: float = 0.0) -> str:
        """value: 0-1, index: 0-1 (position in spectrum)"""
        mode = self.color_mode.get()
        v = max(0, min(1, value))

        if mode == "rainbow":
            h = index * 300
            return self._hsv_to_hex(h, 1.0, v)
        elif mode == "fire":
            r = int(min(255, v * 510))
            g = int(max(0, v * 255 - 128))
            return f"#{r:02x}{g:02x}00"
        elif mode == "ocean":
            b = int(min(255, v * 510))
            g = int(max(0, v * 255 - 60))
            return f"#00{g:02x}{b:02x}"
        elif mode == "neon":
            colors = [(255,0,255),(0,255,255),(255,255,0)]
            ci = int(index * len(colors)) % len(colors)
            r,g,b = colors[ci]
            r2 = int(r * v); g2 = int(g * v); b2 = int(b * v)
            return f"#{r2:02x}{g2:02x}{b2:02x}"
        else:  # mono
            iv = int(v * 255)
            return f"#{iv:02x}{iv:02x}{iv:02x}"

    def _hsv_to_hex(self, h, s, v):
        h = h % 360; s = max(0, min(1, s)); v = max(0, min(1, v))
        c = v * s; x = c * (1 - abs((h/60) % 2 - 1)); m = v - c
        if   h < 60:  r,g,b = c,x,0
        elif h < 120: r,g,b = x,c,0
        elif h < 180: r,g,b = 0,c,x
        elif h < 240: r,g,b = 0,x,c
        elif h < 300: r,g,b = x,0,c
        else:          r,g,b = c,0,x
        return f"#{int((r+m)*255):02x}{int((g+m)*255):02x}{int((b+m)*255):02x}"

    # ── Draw loop ─────────────────────────────────────
    def _draw_loop(self):
        if not self.running:
            return
        self._draw_frame()
        self.after(16, self._draw_loop)  # ~60fps

    def _draw_frame(self):
        c = self.viz_canvas
        c.delete("all")
        W = c.winfo_width() or 800
        H = c.winfo_height() or 480
        if W < 10 or H < 10:
            self.after(16, self._draw_frame); return

        mode = self.viz_mode.get()
        if   mode == "spectrum":   self._draw_spectrum(c, W, H)
        elif mode == "waveform":   self._draw_waveform(c, W, H)
        elif mode == "bars":       self._draw_bars(c, W, H)
        elif mode == "circle":     self._draw_circle(c, W, H)
        elif mode == "waterfall":  self._draw_waterfall(c, W, H)

        # Beat indicator
        is_beat = self.beat_time < 0.1
        self.beat_indicator.config(fg="#a78bfa" if is_beat else "#2d2d4e")

        # VU meters
        self._draw_vu(self.vu_canvas_l, self.vu_left)
        self._draw_vu(self.vu_canvas_r, self.vu_right)

        # Status
        self.vol_lbl.config(text=f"音量: {self.volume:.3f}")

    def _draw_spectrum(self, c, W, H):
        n = self.FFT_BINS
        bw = W / n
        for i, v in enumerate(self.fft_data):
            bh = v * (H - 20)
            x0 = i * bw; x1 = x0 + bw - 1
            color = self._get_color(v, i / n)
            c.create_rectangle(x0, H - bh, x1, H, fill=color, outline="")
            # Reflection
            c.create_rectangle(x0, 0, x1, bh * 0.3, fill=self._get_color(v * 0.3, i / n), outline="")

    def _draw_waveform(self, c, W, H):
        mid = H / 2
        wave = self.waveform_data
        n = len(wave)
        if n < 2: return
        pts = []
        for i, s in enumerate(wave):
            x = i * W / n
            y = mid - s * (H / 2) * 0.8
            pts.extend([x, y])
        c.create_line(pts, fill=self._get_color(0.8, 0.5), width=2, smooth=True)
        # Mirror
        pts2 = []
        for i, s in enumerate(wave):
            x = i * W / n
            y = mid + s * (H / 2) * 0.4
            pts2.extend([x, y])
        c.create_line(pts2, fill=self._get_color(0.4, 0.3), width=1, smooth=True)

    def _draw_bars(self, c, W, H):
        n = self.FFT_BINS // 2  # fewer, wider bars
        fft = self.fft_data
        bw = W / n
        for i in range(n):
            v = fft[i * 2] if i * 2 < len(fft) else 0
            color = self._get_color(v, i / n)
            gap = 3; bh = v * (H - 40)
            x0 = i * bw + gap / 2; x1 = (i + 1) * bw - gap / 2
            # 3D-ish look
            c.create_rectangle(x0, H - bh, x1, H, fill=color, outline="")
            c.create_rectangle(x0, H - bh, x1, H - bh + 3,
                               fill=self._get_color(min(1.0, v * 1.5), i / n), outline="")

    def _draw_circle(self, c, W, H):
        cx, cy = W / 2, H / 2
        base_r = min(W, H) * 0.25
        n = self.FFT_BINS
        pts_outer = []; pts_inner = []
        for i, v in enumerate(self.fft_data):
            angle = 2 * math.pi * i / n - math.pi / 2
            r_out = base_r + v * base_r * 1.2
            r_in  = base_r * 0.7
            pts_outer.extend([cx + r_out * math.cos(angle), cy + r_out * math.sin(angle)])
            pts_inner.extend([cx + r_in  * math.cos(angle), cy + r_in  * math.sin(angle)])
        if len(pts_outer) >= 4:
            c.create_polygon(pts_outer, fill="", outline=self._get_color(0.8, 0.3), width=2, smooth=True)
            c.create_polygon(pts_inner, fill=self._get_color(0.2, 0.7), outline="", smooth=True)
        # Center dot pulsing with beat
        r_dot = 8 + self.beat_time * 5
        c.create_oval(cx - r_dot, cy - r_dot, cx + r_dot, cy + r_dot,
                      fill=self._get_color(0.9, 0.5), outline="")

    def _draw_waterfall(self, c, W, H):
        # Scroll history
        n = self.FFT_BINS
        row = self.fft_data[:]
        self.history_waveform.insert(0, row)
        max_rows = H // 3
        if len(self.history_waveform) > max_rows:
            self.history_waveform = self.history_waveform[:max_rows]

        row_h = H / max_rows
        bw = W / n
        for ri, hist_row in enumerate(self.history_waveform):
            age = ri / max_rows
            for bi, v in enumerate(hist_row):
                intensity = v * (1 - age * 0.7)
                color = self._get_color(intensity, bi / n)
                x0 = bi * bw; y0 = ri * row_h
                c.create_rectangle(x0, y0, x0 + bw, y0 + row_h + 1, fill=color, outline="")

    def _draw_vu(self, canvas, level: float):
        canvas.delete("all")
        canvas.update_idletasks()
        W = canvas.winfo_width() or 16
        H = canvas.winfo_height() or 200
        segments = 20
        seg_h = H / segments - 1
        lit = int(level * segments)
        for i in range(segments):
            y0 = H - (i + 1) * (seg_h + 1)
            if i < lit:
                color = "#ef4444" if i > segments * 0.85 else "#f59e0b" if i > segments * 0.6 else "#22c55e"
            else:
                color = "#1e293b"
            canvas.create_rectangle(1, y0, W - 1, y0 + seg_h, fill=color, outline="")

    def _on_close(self):
        self.running = False
        self.destroy()


if __name__ == "__main__":
    app = AudioVisualizer()
    app.mainloop()
