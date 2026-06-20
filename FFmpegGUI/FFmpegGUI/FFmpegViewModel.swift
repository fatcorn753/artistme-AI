import Foundation
import Combine

@MainActor
class FFmpegViewModel: ObservableObject {
    @Published var inputPath = ""
    @Published var outputPath = ""
    @Published var log = ""
    @Published var isRunning = false

    private let ffmpegPath = "/opt/homebrew/bin/ffmpeg"

    func compress(crf: Int, preset: String) {
        let args = ["-i", inputPath, "-c:v", "libx264", "-crf", "\(crf)", "-preset", preset, "-c:a", "aac", "-y", outputPath]
        run(args: args)
    }

    func convert(videoCodec: String, audioCodec: String) {
        var args = ["-i", inputPath]
        if videoCodec == "none" {
            args += ["-vn"]
        } else {
            args += ["-c:v", videoCodec]
        }
        if audioCodec == "none" {
            args += ["-an"]
        } else {
            args += ["-c:a", audioCodec]
        }
        args += ["-y", outputPath]
        run(args: args)
    }

    func trim(start: String, end: String?, duration: String?) {
        var args = ["-i", inputPath, "-ss", start]
        if let end = end, !end.isEmpty {
            args += ["-to", end]
        } else if let dur = duration, !dur.isEmpty {
            args += ["-t", dur]
        }
        args += ["-c", "copy", "-y", outputPath]
        run(args: args)
    }

    private func run(args: [String]) {
        isRunning = true
        let cmdStr = ([ffmpegPath] + args).joined(separator: " ")
        appendLog("$ \(cmdStr)\n")

        Task {
            await runProcess(args: args)
        }
    }

    private func runProcess(args: [String]) async {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: ffmpegPath)
        process.arguments = args

        let outPipe = Pipe()
        let errPipe = Pipe()
        process.standardOutput = outPipe
        process.standardError = errPipe

        do {
            try process.run()
        } catch {
            appendLog("起動エラー: \(error.localizedDescription)\n")
            isRunning = false
            return
        }

        // stderr (ffmpegの進捗・エラー) をリアルタイムで読む
        errPipe.fileHandleForReading.readabilityHandler = { fh in
            let data = fh.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            Task { @MainActor in self.appendLog(text) }
        }

        // stdout も念のため読む
        outPipe.fileHandleForReading.readabilityHandler = { fh in
            let data = fh.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            Task { @MainActor in self.appendLog(text) }
        }

        await withCheckedContinuation { cont in
            process.terminationHandler = { proc in
                // readabilityHandler を nil にする前に残りデータを読み切る
                errPipe.fileHandleForReading.readabilityHandler = nil
                outPipe.fileHandleForReading.readabilityHandler = nil

                let leftover = errPipe.fileHandleForReading.readDataToEndOfFile()
                if !leftover.isEmpty, let text = String(data: leftover, encoding: .utf8) {
                    Task { @MainActor in self.appendLog(text) }
                }

                let exitCode = proc.terminationStatus
                let status = exitCode == 0 ? "✓ 完了 (終了コード: 0)" : "✗ エラー (終了コード: \(exitCode))"
                Task { @MainActor in
                    self.appendLog("\n\(status)\n")
                    self.isRunning = false
                }
                cont.resume()
            }
        }
    }

    private func appendLog(_ text: String) {
        log += text
    }
}
