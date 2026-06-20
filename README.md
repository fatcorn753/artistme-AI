# AI App Collection 🤖

Claude Code が自動で作成したアプリ集。Chrome拡張機能とMacアプリを合わせて **45個以上** を収録。

---

## 📦 Chrome 拡張機能

| フォルダ | アプリ名 | 説明 |
|---|---|---|
| `pomodoro-timer` | Pomodoro Timer | 25分集中/5分休憩サイクル、通知付き |
| `color-picker` | Color Picker | HEX/RGB/HSL変換、パレット保存 |
| `json-formatter` | JSON Formatter | シンタックスハイライト、折りたたみツリー |
| `focus-mode` | Focus Mode | サイトブロッカー、集中タイマー |
| `clipboard-history` | Clipboard History | コピー履歴50件、検索・再コピー |
| `password-generator` | Password Generator | 暗号学的乱数、強度メーター |
| `tab-manager` | Tab Manager | タブ一覧、重複削除、セッション保存 |
| `regex-tester` | Regex Tester | リアルタイム正規表現テスター |
| `reading-time` | Reading Time | ページ読了時間推定 |
| `unit-converter` | Unit Converter | 長さ/重さ/温度/面積/速度など7カテゴリ |
| `quick-notes` | Quick Notes | マルチノート、Markdownプレビュー |
| `base64-tool` | Base64 & Hash Tool | Base64/URL/SHA-256〜512ハッシュ |
| `dark-mode-toggler` | Dark Mode Toggler | 任意ページにダークモード適用 |
| `yt-timestamps` | YouTube Timestamp Saver | タイムスタンプ保存・メモ付き |
| `font-preview` | Font Preview | システム+Google Fonts 50種プレビュー |
| `http-tester` | HTTP Tester | GET/POST等HTTPリクエストテスター |
| `csv-viewer` | CSV Viewer | CSV表表示、ソート、統計 |
| `gradient-generator` | Gradient Generator | CSSグラデーション生成・コード出力 |
| `qr-generator` | QR Code Generator | QRコード生成（純JS実装、WiFi/vCard対応） |
| `word-counter` | Word Counter | 文字数/語数/読了時間、SNS文字数制限バー |
| `base-converter` | Number Base Converter | 2/8/10/16進変換、ビット演算、ASCII表 |
| `dns-lookup` | DNS Lookup | Cloudflare DoH、A/MX/TXT/NSなど8レコード |
| `weather-widget` | Weather Widget | Open-Meteo API、5日間予報、現在地取得 |
| `currency-converter` | Currency Converter | Frankfurter API、35通貨リアルタイム変換 |
| `calculator` | Calculator | 関数電卓（sin/cos/log等）、履歴50件 |
| `kanban-board` | Kanban Board | 3列カンバン、ドラッグ移動、複数ボード |
| `typing-test` | Typing Speed Test | WPM計測、英語/日本語/Code 3モード |
| `snake-game` | Snake Game | 壁抜け型スネーク、難易度3段階 |
| `memory-match` | Memory Match | 絵文字神経衰弱、3難易度 |
| `ip-lookup` | IP Address Info | IP位置情報、国/ISP/座標取得 |
| `minesweeper` | Minesweeper | マインスイーパー、3難易度、安全な初手 |
| `md-to-html` | Markdown to HTML | リアルタイムMD変換、3テーマ |
| `screenshot-annotator` | Screenshot Annotator | スクリーンショット+矢印/テキスト注釈 |
| `stopwatch-timer` | Stopwatch & Timer | ストップウォッチ+カウントダウン |
| `todo-list` | Todo List | 優先度/タグ/期限、フィルタ |
| `text-diff` | Text Diff | Myersアルゴリズム差分表示 |

---

## 🖥 Mac アプリ（Python/Swift）

| フォルダ | アプリ名 | 実行方法 |
|---|---|---|
| `world-clock-menubar` | World Clock | Xcodeでビルド（SwiftUI） |
| `file-renamer` | File Renamer | `python3 file_renamer.py` |
| `image-compressor` | Image Compressor | `python3 image_compressor.py`（要Pillow） |
| `markdown-editor` | Markdown Editor | `python3 markdown_editor.py` |
| `system-monitor` | System Monitor | `python3 system_monitor.py` |
| `expense-tracker` | Expense Tracker | `python3 expense_tracker.py` |
| `habit-tracker` | Habit Tracker | `python3 habit_tracker.py` |
| `flashcard-quiz` | Flashcard Quiz | `python3 flashcard_quiz.py` |
| `whiteboard` | Whiteboard | `python3 whiteboard.py` |

---

## 🔧 Chrome拡張機能のインストール方法

1. `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. 使いたい拡張機能のフォルダを選択

## 🐍 Pythonアプリの依存ライブラリ

```bash
# Image Compressor のみ Pillow が必要
pip install Pillow
```

その他はすべて Python 3 標準ライブラリのみで動作します。

---

*Generated automatically by [Claude Code](https://claude.ai/code)*
