import Capacitor
import Foundation
import LiteRTLM

/*
 * SEN BIỂN — Gemma 3 270M chạy TRONG MÁY, bản iOS (ADR 0012, doc 15 §25).
 *
 * CÙNG giao diện với plugin Kotlin (SenBienGemmaPlugin.kt): trangThai · taiVe · nap ·
 * hoi · dong, cùng tên trường trả về. Phía TS (src/lib/sen-bien/gemma.ts) không
 * phân biệt hai nền.
 *
 * Mô hình: CÙNG file gemma.litertlm 62 MB với Android (release sen-bien-gemma-v2,
 * kiểm SHA-256 android/sen-bien-gemma/gemma.sha256), nằm SẴN trong gói app ở
 * sen-bien/gemma.litertlm — bước build "Sen Biển Gemma" chép vào nếu máy build có
 * file (ios/App/sen-bien-gemma/, gitignore). Không có file ⇒ "chua_co", Sen Biển
 * chạy n-gram + luật như cũ. Không tải gì qua mạng: taiVe chỉ báo lại trạng thái.
 *
 * Chạy CPU: GPU Metal ra toàn <pad> với bản xuất này (đo 2026-10-18, §25).
 */
@objc(SenBienGemmaPlugin)
public class SenBienGemmaPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SenBienGemmaPlugin"
    public let jsName = "SenBienGemma"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "trangThai", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "taiVe", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "nap", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hoi", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dong", returnType: CAPPluginReturnPromise),
    ]

    private let may = MayGemma()

    /// Đường file mô hình nếu bản cài có, không thì nil.
    private func duongMoHinh() -> String? {
        Bundle.main.path(forResource: "gemma", ofType: "litertlm", inDirectory: "sen-bien")
    }

    private func jsTrangThai(daNap: Bool) -> [String: Any] {
        ["trangThai": duongMoHinh() != nil ? "co" : "chua_co", "daNap": daNap]
    }

    @objc func trangThai(_ call: CAPPluginCall) {
        Task { call.resolve(jsTrangThai(daNap: await may.daNap)) }
    }

    /// iOS: mô hình đi theo bản cài, không có gì để tải — trả trạng thái như trangThai.
    @objc func taiVe(_ call: CAPPluginCall) {
        trangThai(call)
    }

    /// Nạp trước (lúc mở bản đồ) để câu đầu khỏi chờ.
    @objc func nap(_ call: CAPPluginCall) {
        guard let p = duongMoHinh() else { return call.reject("Máy chưa có mô hình", "chua_co") }
        Task {
            do {
                try await may.nap(p)
                call.resolve(jsTrangThai(daNap: true))
            } catch {
                call.reject("Nạp mô hình lỗi: \(error)", "nap")
            }
        }
    }

    /// { he: system, nguoi: user } → { txt, ms } — giải mã tham lam, một hội thoại mới mỗi câu (như lúc chấm).
    @objc func hoi(_ call: CAPPluginCall) {
        guard let he = call.getString("he") else { return call.reject("thiếu he", "tham_so") }
        guard let nguoi = call.getString("nguoi") else { return call.reject("thiếu nguoi", "tham_so") }
        guard let p = duongMoHinh() else { return call.reject("Máy chưa có mô hình", "chua_co") }
        Task {
            do {
                let (txt, ms) = try await may.hoi(p, he: he, nguoi: nguoi)
                call.resolve(["txt": txt, "ms": ms])
            } catch {
                call.reject("Gemma lỗi: \(error)", "chay")
            }
        }
    }

    /// Nhả RAM khi rời bản đồ.
    @objc func dong(_ call: CAPPluginCall) {
        Task {
            await may.dong()
            call.resolve()
        }
    }
}

/// Giữ engine và xếp hàng MỌI lệnh: một câu chạy xong mới tới câu sau (engine dùng chung).
actor MayGemma {
    private var engine: Engine?
    private var duoi: Task<Void, Never>?

    var daNap: Bool { engine != nil }

    /// Chạy f sau mọi lệnh đã xếp trước (actor tự vào lại ở mỗi await nên phải xếp tay).
    private func xep<T>(_ f: @escaping () async throws -> T) async throws -> T {
        let truoc = duoi
        let t = Task { () async throws -> T in
            await truoc?.value
            return try await f()
        }
        duoi = Task { _ = try? await t.value }
        return try await t.value
    }

    private func napNeuCan(_ p: String) async throws -> Engine {
        if let e = engine { return e }
        let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].path
        let e = Engine(engineConfig: try EngineConfig(modelPath: p, backend: .cpu(), cacheDir: cache))
        try await e.initialize()
        engine = e
        return e
    }

    func nap(_ p: String) async throws {
        _ = try await xep { try await self.napNeuCan(p) }
    }

    func hoi(_ p: String, he: String, nguoi: String) async throws -> (String, Int) {
        try await xep {
            let e = try await self.napNeuCan(p)
            let t0 = DispatchTime.now().uptimeNanoseconds
            let cfg = ConversationConfig(
                systemMessage: Message(he, role: .system),
                samplerConfig: try SamplerConfig(topK: 1, topP: 1.0, temperature: 0.0)
            )
            let c = try await e.createConversation(with: cfg)
            // 80 token: JSON dài nhất ~40 token; chặn câu chạy dài khi mô hình lạc (trần lai 2,5 s phía TS)
            let txt = try await c.sendMessage(Message(nguoi), maxOutputTokens: 80).toString
            return (txt, Int((DispatchTime.now().uptimeNanoseconds - t0) / 1_000_000))
        }
    }

    private func boEngine() { engine = nil }

    func dong() async {
        _ = try? await xep { await self.boEngine() }
    }
}
