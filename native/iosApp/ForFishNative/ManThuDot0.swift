import MapLibre
import Shared
import SwiftUI

/*
  ĐỢT 0 (app-map 18 §3): màn thử đường ống native — KHÔNG phải UI thật. Giống androidApp/MainActivity:
  bản đồ MapLibre đọc nền pmtiles trong máy, trạm con nước SDF1 tải về giải bằng `shared`, Gemma qua shared.
  Kết quả in lên màn + console (tiền tố "ForFishNative").
*/
@MainActor
final class TrangThaiDot0: ObservableObject {
    @Published var dong: [String] = []
    @Published var kieu: URL?

    func ghi(_ s: String) {
        print("ForFishNative \(s)")
        dong.append(s)
    }

    func chay() async {
        let nen = Bundle.main.path(forResource: "vn-basemap", ofType: "pmtiles", inDirectory: "du-lieu")
        if nen == nil { ghi("Thiếu nền bản đồ trong bản build") }
        var geo: String?
        do {
            let t0 = Date()
            let url = URL(string: "https://sdfish.sdvico.vn" + DuLieuTramTrieu.shared.DUONG_DAN)!
            let (data, res) = try await URLSession.shared.data(from: url)
            guard (res as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let kq = try CauNoiIos.shared.tramTrieu(data: data)
            let dau = String(data: data.prefix(4), encoding: .ascii) ?? "?"
            ghi("Trạm con nước: \(kq.soTram) trạm (\(dau) \(data.count) B, \(Int(Date().timeIntervalSince(t0) * 1000)) ms)")
            geo = kq.geoJson
        } catch {
            ghi("Trạm con nước LỖI: \(error.localizedDescription)")
        }
        let json = CauNoiIos.shared.kieuBanDo(nenPmtiles: nen.map { "pmtiles://file://\($0)" } ?? "", geoJson: geo)
        let f = FileManager.default.temporaryDirectory.appendingPathComponent("kieu-dot0.json")
        try? json.write(to: f, atomically: true, encoding: .utf8)
        kieu = f
        await thuGemma()
    }

    private func thuGemma() async {
        guard let p = Bundle.main.path(forResource: "gemma", ofType: "litertlm", inDirectory: "du-lieu") else {
            return ghi("Gemma: bản build không có mô hình")
        }
        let may = GemmaIos(duongMoHinh: p)
        let t0 = Date()
        do { try await may.nap() } catch { return ghi("Gemma nạp LỖI: \(error)") }
        ghi("Gemma nạp \(Int(Date().timeIntervalSince(t0) * 1000)) ms")
        let yHopLe: Set<String> = ["mo_lop", "hoi_ca", "hoi_o_dau", "dan_duong", "doc_gia_tri", "gia_ca", "hoi_phia_truoc"]
        let ctx = GemmaCtx(xn: false, cang: ["sa huynh", "ly son"], diem: ["hon mu"], tau: [])
        for cau in ["XEM BẢN ĐỒ SÓNG CHIỀU MAI", "tui đang ở mô rứa", "giá cá thu hôm nay"] {
            let t = Date()
            let d = try? await SenBienGemma.shared.hieu(may: may, cau: cau, ctx: ctx, yHopLe: yHopLe)
            ghi("Gemma \(Int(Date().timeIntervalSince(t) * 1000)) ms | \(cau) → \(d?.y ?? "nil") \(d.map { "\($0.s)" } ?? "")")
        }
    }
}

struct BanDoMapLibre: UIViewRepresentable {
    let kieu: URL?

    func makeUIView(context: Context) -> MLNMapView {
        let v = MLNMapView(frame: .zero, styleURL: kieu)
        v.setCenter(CLLocationCoordinate2D(latitude: KieuBanDo.shared.TAM_LAT, longitude: KieuBanDo.shared.TAM_LON),
                    zoomLevel: KieuBanDo.shared.ZOOM_MO, animated: false)
        return v
    }

    func updateUIView(_ v: MLNMapView, context: Context) {
        if let k = kieu, v.styleURL != k { v.styleURL = k }
    }
}

struct ManThuDot0: View {
    @StateObject private var tt = TrangThaiDot0()

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(tt.dong.enumerated()), id: \.offset) { _, d in
                Text(d).font(.caption).frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 12)
            BanDoMapLibre(kieu: tt.kieu)
        }
        .task { await tt.chay() }
    }
}
