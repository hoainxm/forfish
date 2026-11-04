import Foundation
import LiteRTLM
import Shared

/// Bộ chạy Gemma iOS cho `shared` (= phần engine của SenBienGemmaPlugin.swift bản Capacitor). CPU, tham lam.
/// Kotlin không gọi thẳng API Swift được ⇒ Swift cài interface `MayGemma` của shared (ADR 0019).
final class GemmaIos: MayGemma {
    private let may: MayGemmaActor

    init(duongMoHinh: String) { may = MayGemmaActor(duongMoHinh: duongMoHinh) }

    func nap() async throws { try await may.nap() }

    func hoi(he: String, nguoi: String) async throws -> String { try await may.hoi(he: he, nguoi: nguoi) }
}

/// Giữ engine, mỗi lệnh chạy lần lượt (engine dùng chung).
actor MayGemmaActor {
    private let duong: String
    private var engine: Engine?

    init(duongMoHinh: String) { duong = duongMoHinh }

    private func napNeuCan() async throws -> Engine {
        if let e = engine { return e }
        let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].path
        let e = Engine(engineConfig: try EngineConfig(modelPath: duong, backend: .cpu(), cacheDir: cache))
        try await e.initialize()
        engine = e
        return e
    }

    func nap() async throws { _ = try await napNeuCan() }

    func hoi(he: String, nguoi: String) async throws -> String {
        let e = try await napNeuCan()
        let cfg = ConversationConfig(
            systemMessage: Message(he, role: .system),
            samplerConfig: try SamplerConfig(topK: 1, topP: 1.0, temperature: 0.0)
        )
        let c = try await e.createConversation(with: cfg)
        return try await c.sendMessage(Message(nguoi), maxOutputTokens: 80).toString
    }
}
