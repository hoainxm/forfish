import MapLibre
import Shared
import SwiftUI

/// Ô Bản đồ: vẫn là màn thử đợt 0 (nền pmtiles + trạm con nước) tới đợt 2.
struct BanDoThu: View {
    @EnvironmentObject var tt: TrangThaiApp
    @State private var kieu: URL?

    var body: some View {
        BanDoMapLibre(kieu: kieu).task {
            let nen = Bundle.main.path(forResource: "vn-basemap", ofType: "pmtiles", inDirectory: "du-lieu")
            let json = CauNoiIos.shared.kieuBanDo(webGoc: tt.ung.mayChuGoc(), tep: KieuBanDo.Tep(nen: nen, dao: nil, doSau: nil, duongDoSau: nil, denBien: nil, xacTau: nil))
            let f = FileManager.default.temporaryDirectory.appendingPathComponent("kieu-ban-do.json")
            try? json.write(to: f, atomically: true, encoding: .utf8)
            kieu = f
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
