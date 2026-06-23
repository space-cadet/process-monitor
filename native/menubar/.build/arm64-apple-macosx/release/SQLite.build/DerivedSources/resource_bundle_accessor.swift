import Foundation

extension Foundation.Bundle {
    static nonisolated let module: Bundle = {
        let mainPath = Bundle.main.bundleURL.appendingPathComponent("SQLite.swift_SQLite.bundle").path
        let buildPath = "/Users/sage/.openclaw/workspace/code/process-monitor/native/menubar/.build/arm64-apple-macosx/release/SQLite.swift_SQLite.bundle"

        let preferredBundle = Bundle(path: mainPath)

        guard let bundle = preferredBundle ?? Bundle(path: buildPath) else {
            // Users can write a function called fatalError themselves, we should be resilient against that.
            Swift.fatalError("could not load resource bundle: from \(mainPath) or \(buildPath)")
        }

        return bundle
    }()
}