import SwiftUI

struct TimeZoneEntry: Identifiable, Codable {
    let id: UUID
    var label: String
    var identifier: String

    init(id: UUID = UUID(), label: String, identifier: String) {
        self.id = id
        self.label = label
        self.identifier = identifier
    }
}

class ClockStore: ObservableObject {
    @Published var entries: [TimeZoneEntry] = []
    private let key = "worldClockEntries"

    init() {
        load()
        if entries.isEmpty {
            entries = [
                TimeZoneEntry(label: "東京", identifier: "Asia/Tokyo"),
                TimeZoneEntry(label: "ロンドン", identifier: "Europe/London"),
                TimeZoneEntry(label: "ニューヨーク", identifier: "America/New_York"),
                TimeZoneEntry(label: "ロサンゼルス", identifier: "America/Los_Angeles"),
            ]
            save()
        }
    }

    func save() {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([TimeZoneEntry].self, from: data) else { return }
        entries = decoded
    }

    func remove(at offsets: IndexSet) {
        entries.remove(atOffsets: offsets)
        save()
    }

    func add(_ entry: TimeZoneEntry) {
        entries.append(entry)
        save()
    }
}

struct ClockView: View {
    @StateObject private var store = ClockStore()
    @State private var now = Date()
    @State private var showAdd = false
    let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("🌍 World Clock")
                    .font(.headline)
                    .foregroundColor(.primary)
                Spacer()
                Button(action: { showAdd = true }) {
                    Image(systemName: "plus.circle.fill")
                        .foregroundColor(.accentColor)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 8)

            Divider()

            ScrollView {
                VStack(spacing: 2) {
                    ForEach(store.entries) { entry in
                        ClockRow(entry: entry, now: now)
                    }
                    .onDelete { store.remove(at: $0) }
                }
                .padding(.vertical, 6)
            }

            Divider()

            Button("終了") { NSApp.terminate(nil) }
                .buttonStyle(.plain)
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(10)
        }
        .frame(width: 280)
        .onReceive(timer) { now = $0 }
        .sheet(isPresented: $showAdd) {
            AddClockView { entry in
                store.add(entry)
                showAdd = false
            } onCancel: {
                showAdd = false
            }
        }
    }
}

struct ClockRow: View {
    let entry: TimeZoneEntry
    let now: Date

    var timeString: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "HH:mm:ss"
        fmt.timeZone = TimeZone(identifier: entry.identifier)
        return fmt.string(from: now)
    }

    var dateString: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "M/d (EEE)"
        fmt.locale = Locale(identifier: "ja_JP")
        fmt.timeZone = TimeZone(identifier: entry.identifier)
        return fmt.string(from: now)
    }

    var offsetString: String {
        guard let tz = TimeZone(identifier: entry.identifier) else { return "" }
        let seconds = tz.secondsFromGMT(for: now)
        let h = seconds / 3600
        let m = abs(seconds % 3600) / 60
        return String(format: "UTC%+d:%02d", h, m)
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.label)
                    .font(.system(size: 13, weight: .semibold))
                Text(dateString + "  " + offsetString)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            Spacer()
            Text(timeString)
                .font(.system(size: 20, weight: .bold, design: .monospaced))
                .foregroundColor(.accentColor)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 7)
        .background(Color(NSColor.controlBackgroundColor).opacity(0.5))
        .cornerRadius(8)
        .padding(.horizontal, 8)
    }
}

struct AddClockView: View {
    @State private var label = ""
    @State private var search = ""
    var onAdd: (TimeZoneEntry) -> Void
    var onCancel: () -> Void

    var filteredZones: [String] {
        let all = TimeZone.knownTimeZoneIdentifiers
        if search.isEmpty { return all }
        return all.filter { $0.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        VStack(spacing: 12) {
            Text("タイムゾーンを追加")
                .font(.headline)

            TextField("表示名（例: パリ）", text: $label)
                .textFieldStyle(.roundedBorder)

            TextField("タイムゾーンを検索...", text: $search)
                .textFieldStyle(.roundedBorder)

            List(filteredZones.prefix(100), id: \.self) { tz in
                Button(action: {
                    let entry = TimeZoneEntry(label: label.isEmpty ? tz : label, identifier: tz)
                    onAdd(entry)
                }) {
                    Text(tz).font(.system(size: 12))
                }
                .buttonStyle(.plain)
            }
            .frame(height: 200)

            HStack {
                Button("キャンセル", action: onCancel)
                    .buttonStyle(.bordered)
            }
        }
        .padding()
        .frame(width: 300)
    }
}
