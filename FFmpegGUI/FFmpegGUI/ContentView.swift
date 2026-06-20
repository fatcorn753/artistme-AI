import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @StateObject private var vm = FFmpegViewModel()
    @State private var selectedTab = 0

    var body: some View {
        NavigationSplitView {
            List(selection: $selectedTab) {
                Label("圧縮", systemImage: "arrow.down.circle").tag(0)
                Label("変換", systemImage: "arrow.left.arrow.right").tag(1)
                Label("切り取り", systemImage: "scissors").tag(2)
            }
            .navigationSplitViewColumnWidth(min: 150, ideal: 160)
        } detail: {
            VStack(spacing: 0) {
                switch selectedTab {
                case 0: CompressView(vm: vm)
                case 1: ConvertView(vm: vm)
                case 2: TrimView(vm: vm)
                default: CompressView(vm: vm)
                }

                Divider()
                LogView(vm: vm)
                    .frame(height: 160)
            }
        }
        .navigationTitle("FFmpeg GUI")
        .frame(minWidth: 700, minHeight: 540)
    }
}

// MARK: - Compress

struct CompressView: View {
    @ObservedObject var vm: FFmpegViewModel
    @State private var crf: Double = 28
    @State private var preset = "medium"
    let presets = ["ultrafast","superfast","veryfast","faster","fast","medium","slow","slower","veryslow"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("動画圧縮").font(.title2).bold()

                FilePickerField(label: "入力ファイル", path: $vm.inputPath, allowedTypes: videoTypes)
                FilePickerField(label: "出力ファイル", path: $vm.outputPath, isSave: true, defaultName: "output.mp4", allowedTypes: videoTypes)

                GroupBox("圧縮設定") {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("品質 (CRF): \(Int(crf))")
                            Spacer()
                            Text("低品質").font(.caption).foregroundColor(.secondary)
                            Slider(value: $crf, in: 18...51, step: 1).frame(width: 200)
                            Text("高品質").font(.caption).foregroundColor(.secondary)
                        }
                        HStack {
                            Text("エンコード速度:")
                            Picker("", selection: $preset) {
                                ForEach(presets, id: \.self) { Text($0) }
                            }.frame(width: 160)
                        }
                    }
                    .padding(8)
                }

                RunButton(label: "圧縮を実行") {
                    vm.compress(crf: Int(crf), preset: preset)
                }
                .disabled(vm.inputPath.isEmpty || vm.outputPath.isEmpty || vm.isRunning)
            }
            .padding(24)
        }
    }
}

// MARK: - Convert

struct ConvertView: View {
    @ObservedObject var vm: FFmpegViewModel
    @State private var format = "mp4"
    @State private var videoCodec = "copy"
    @State private var audioCodec = "copy"
    let formats = ["mp4","mov","avi","mkv","webm","gif","mp3","aac","wav","flac"]
    let videoCodecs = ["copy","libx264","libx265","libvpx-vp9","none"]
    let audioCodecs = ["copy","aac","mp3","flac","none"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("フォーマット変換").font(.title2).bold()

                FilePickerField(label: "入力ファイル", path: $vm.inputPath, allowedTypes: allMediaTypes)
                FilePickerField(label: "出力ファイル", path: $vm.outputPath, isSave: true, defaultName: "output.\(format)", allowedTypes: allMediaTypes)

                GroupBox("変換設定") {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("出力形式:")
                            Picker("", selection: $format) {
                                ForEach(formats, id: \.self) { Text($0) }
                            }.frame(width: 120)
                        }
                        HStack {
                            Text("映像コーデック:")
                            Picker("", selection: $videoCodec) {
                                ForEach(videoCodecs, id: \.self) { Text($0) }
                            }.frame(width: 160)
                        }
                        HStack {
                            Text("音声コーデック:")
                            Picker("", selection: $audioCodec) {
                                ForEach(audioCodecs, id: \.self) { Text($0) }
                            }.frame(width: 160)
                        }
                    }
                    .padding(8)
                }

                RunButton(label: "変換を実行") {
                    vm.convert(videoCodec: videoCodec, audioCodec: audioCodec)
                }
                .disabled(vm.inputPath.isEmpty || vm.outputPath.isEmpty || vm.isRunning)
            }
            .padding(24)
        }
    }
}

// MARK: - Trim

struct TrimView: View {
    @ObservedObject var vm: FFmpegViewModel
    @State private var startTime = "00:00:00"
    @State private var endTime = ""
    @State private var duration = ""
    @State private var useEnd = true

    private var outputName: String {
        let ext = URL(fileURLWithPath: vm.inputPath).pathExtension
        return "output.\(ext.isEmpty ? "mp4" : ext)"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("動画切り取り").font(.title2).bold()

                FilePickerField(label: "入力ファイル", path: $vm.inputPath, allowedTypes: videoTypes)
                FilePickerField(label: "出力ファイル", path: $vm.outputPath, isSave: true, defaultName: outputName, allowedTypes: videoTypes)

                GroupBox("切り取り設定") {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("開始時間:")
                            TextField("HH:MM:SS or 秒数", text: $startTime)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 160)
                        }
                        Picker("終了指定方法", selection: $useEnd) {
                            Text("終了時間").tag(true)
                            Text("継続時間").tag(false)
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 260)

                        if useEnd {
                            HStack {
                                Text("終了時間:")
                                TextField("HH:MM:SS or 秒数", text: $endTime)
                                    .textFieldStyle(.roundedBorder)
                                    .frame(width: 160)
                            }
                        } else {
                            HStack {
                                Text("継続時間:")
                                TextField("秒数 (例: 30)", text: $duration)
                                    .textFieldStyle(.roundedBorder)
                                    .frame(width: 160)
                            }
                        }
                    }
                    .padding(8)
                }

                RunButton(label: "切り取りを実行") {
                    vm.trim(start: startTime, end: useEnd ? endTime : nil, duration: useEnd ? nil : duration)
                }
                .disabled(vm.inputPath.isEmpty || vm.outputPath.isEmpty || vm.isRunning)
            }
            .padding(24)
        }
    }
}

// MARK: - Log

struct LogView: View {
    @ObservedObject var vm: FFmpegViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("ログ").font(.caption).foregroundColor(.secondary)
                Spacer()
                if vm.isRunning {
                    ProgressView().scaleEffect(0.6)
                    Text("実行中...").font(.caption).foregroundColor(.secondary)
                }
                Button("クリア") { vm.log = "" }
                    .buttonStyle(.plain)
                    .font(.caption)
                    .foregroundColor(.blue)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color(NSColor.windowBackgroundColor))

            ScrollViewReader { proxy in
                ScrollView {
                    Text(vm.log.isEmpty ? "コマンドを実行するとここにログが表示されます" : vm.log)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(vm.log.isEmpty ? .secondary : .primary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .id("bottom")
                }
                .background(Color(NSColor.textBackgroundColor))
                .onChange(of: vm.log) { _ in
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
        }
    }
}

// MARK: - Shared UI

struct FilePickerField: View {
    let label: String
    @Binding var path: String
    var isSave = false
    var defaultName: String = ""
    var allowedTypes: [UTType] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundColor(.secondary)
            HStack {
                TextField("ファイルを選択してください", text: $path)
                    .textFieldStyle(.roundedBorder)
                Button("選択…") {
                    pickFile()
                }
            }
        }
    }

    private func pickFile() {
        if isSave {
            let panel = NSSavePanel()
            panel.allowedContentTypes = allowedTypes.isEmpty ? [] : allowedTypes
            panel.canCreateDirectories = true
            panel.canSelectHiddenExtension = true
            if !defaultName.isEmpty { panel.nameFieldStringValue = defaultName }
            if panel.runModal() == .OK, let url = panel.url {
                // 拡張子がなければデフォルト名から補完
                var finalURL = url
                if url.pathExtension.isEmpty, let ext = defaultName.split(separator: ".").last {
                    finalURL = url.appendingPathExtension(String(ext))
                }
                path = finalURL.path
            }
        } else {
            let panel = NSOpenPanel()
            panel.allowedContentTypes = allowedTypes.isEmpty ? [] : allowedTypes
            panel.allowsMultipleSelection = false
            panel.canChooseDirectories = false
            if panel.runModal() == .OK, let url = panel.url {
                path = url.path
            }
        }
    }
}

struct RunButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(label, systemImage: "play.fill")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
    }
}

// MARK: - UTTypes

let videoTypes: [UTType] = [.movie, .video, .mpeg4Movie, .quickTimeMovie, .avi]
let allMediaTypes: [UTType] = [.movie, .video, .audio, .mp3, .mpeg4Movie, .quickTimeMovie, .avi, .wav]
