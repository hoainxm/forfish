import Foundation
import Shared
import WebKit

/// Kho trong máy iOS: UserDefaults riêng của app — tên khoá + định dạng y web (`forfish.*`). Ghi rồi đọc lại.
final class KhoIos: KhoMay {
    private let ud = UserDefaults(suiteName: "forfish") ?? .standard

    func doc(khoa: String) -> String? { ud.string(forKey: khoa) }

    func ghi(khoa: String, giaTri: String) -> Bool {
        ud.set(giaTri, forKey: khoa)
        return ud.string(forKey: khoa) == giaTri
    }

    func xoa(khoa: String) { ud.removeObject(forKey: khoa) }

    func cacKhoa() -> Set<String> { Set(ud.dictionaryRepresentation().keys.filter { $0.hasPrefix("forfish.") }) }
}

/*
  ĐỌC KHO CỦA BẢN CAPACITOR CŨ (ADR 0019): bản Capacitor là WKWebView mở https://sdfish.sdvico.vn/ ⇒ localStorage
  nằm trong kho WebKit mặc định của CHÍNH app này. Nạp trang trống với baseURL đúng origin (không tải gì qua mạng) rồi
  đọc các khoá `forfish.*`. Chỉ có dữ liệu khi bản native cập nhật đè bản Capacitor (cùng bundle id — đợt 7).
*/
@MainActor
final class KhoCuWebView: NSObject, WKNavigationDelegate {
    static let goc = URL(string: "https://sdfish.sdvico.vn/")!
    private var web: WKWebView?
    private var xong: CheckedContinuation<Void, Never>?

    private func mo() async -> WKWebView {
        let w = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        w.navigationDelegate = self
        web = w
        await withCheckedContinuation { c in
            xong = c
            w.loadHTMLString("<html></html>", baseURL: Self.goc)
        }
        return w
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { xong?.resume(); xong = nil }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { xong?.resume(); xong = nil }

    func doc() async -> [String: String] {
        let w = await mo()
        let js = "(function(){var o={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('forfish.')===0)o[k]=localStorage.getItem(k);}return JSON.stringify(o);})()"
        defer { web = nil }
        guard let s = try? await w.evaluateJavaScript(js) as? String,
              let d = s.data(using: .utf8),
              let o = try? JSONSerialization.jsonObject(with: d) as? [String: String] else { return [:] }
        return o
    }

    /// CHỈ bản debug: gieo kho giả ở origin cũ để thử đường chuyển trên simulator.
    func gieoThu(_ du: [String: String]) async {
        let w = await mo()
        let js = du.map { k, v in "localStorage.setItem(\(jsChuoi(k)),\(jsChuoi(v)));" }.joined()
        _ = try? await w.evaluateJavaScript("(function(){\(js)return 1;})()")
        web = nil
    }

    private func jsChuoi(_ s: String) -> String {
        let d = try! JSONSerialization.data(withJSONObject: [s])
        return String(String(data: d, encoding: .utf8)!.dropFirst().dropLast())
    }
}
