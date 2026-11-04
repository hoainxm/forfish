import Shared
import SwiftUI

/*
  APP NATIVE iOS — ĐỢT 1 (app-map 18 §3): vỏ + tài khoản + vai + dock + Trang chủ. Cùng luồng với androidApp.
  Khách dùng được ngay (đăng nhập tuỳ chọn như web); dock theo vai (spec 17); ô chưa làm native ghi rõ đợt nào.
  Sự kiện chính in console tiền tố "ForFishNative".
*/
@main
struct ForFishNativeApp: App {
    @StateObject private var tt = TrangThaiApp()
    var body: some Scene {
        WindowGroup { GocApp().environmentObject(tt) }
    }
}

func ghi(_ s: String) { print("ForFishNative \(s)") }

@MainActor
final class TrangThaiApp: ObservableObject {
    let ung: UngDung = {
        var goc = CauHinh.shared.WEB_GOC
        #if DEBUG
        // giả mất sóng trên simulator: SIMCTL_CHILD_webGoc=https://127.0.0.1:9
        if let g = ProcessInfo.processInfo.environment["webGoc"] { goc = g }
        #endif
        return UngDung(kho: KhoIos(), nen: "ios", webGoc: goc)
    }()
    @Published var lanVe = 0
    @Published var man = "chinh"
    @Published var phienTam: String?

    func veLai() { lanVe += 1 }

    func mo() async {
        let args = ProcessInfo.processInfo.environment
        #if DEBUG
        // Thử trên simulator: SIMCTL_CHILD_gieoKhoCu='<json>' gieo kho giả; SIMCTL_CHILD_chuoi/sdt bơm chuỗi acc test
        if let g = args["gieoKhoCu"], let d = g.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: d) as? [String: String] {
            await KhoCuWebView().gieoThu(o)
            ung.kho.xoa(khoa: KhoaMay.shared.DA_CHUYEN_KHO_CU)
            ghi("Debug: đã gieo kho cũ")
        }
        if let c = args["chuoi"], let s = args["sdt"] {
            ghi("Debug: bơm chuỗi acc test \(ung.phien.luuDangNhap(token: c, tier: args["tier"] ?? "basic", han: nil, sdt: s))")
        }
        #endif
        if ChuyenKhoCu.shared.canChuyen(kho: ung.kho) {
            let dump = await KhoCuWebView().doc()
            let kq = ChuyenKhoCu.shared.chuyen(kho: ung.kho, dump: dump, bayGio: Int64(Date().timeIntervalSince1970 * 1000))
            ghi("Chuyển kho cũ: chép \(kq.daChep), bỏ \(kq.boQua), lỗi \(kq.loi)")
        }
        try? await ung.khiMoApp()
        ghi("Mở app: đăng nhập=\(ung.phien.daDangNhap()) sdt=\(ung.phien.sdt() ?? "nil") vai=\(ung.vaiHienTai() ?? "nil") khoá dữ liệu=\(ung.khoaDuLieu.cacKhoa().count) dock=\(ung.dock().map { $0.id })")
        veLai()
    }
}

struct GocApp: View {
    @EnvironmentObject var tt: TrangThaiApp
    var body: some View {
        Group {
            switch tt.man {
            case "dangnhap": ManDangNhap()
            case "doimk": ManDoiMatKhau()
            case "chonvai": ManChonVai()
            default: KhungChinh()
            }
        }
        .task { await tt.mo() }
    }
}

let DOT_CUA_O: [String: Int] = ["kairos": 6, "viec-lam": 6, "tau-toi": 4, "cho-ca": 5, "vat-tu": 5, "ban-hang": 5]

struct KhungChinh: View {
    @EnvironmentObject var tt: TrangThaiApp
    @State private var dang = "trang-chu"

    // Thanh dock TỰ VẼ: TabView của iOS chỉ hiện 5 ô, ô thứ 6 bị gom vào "More" (chữ tiếng Anh) — dock chủ tàu có 6 ô.
    var body: some View {
        let _ = tt.lanVe
        let dock = tt.ung.dock()
        let hien = dock.contains { $0.id == dang } ? dang : "trang-chu"
        VStack(spacing: 0) {
            Group {
                switch hien {
                case "trang-chu": TrangChu()
                case "ban-do": BanDoThu()
                default: ChuaLam(nhan: dock.first { $0.id == hien }?.nhan ?? "", dot: DOT_CUA_O[hien] ?? 7)
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity)
            Divider()
            HStack(spacing: 0) {
                ForEach(dock, id: \.id) { o in
                    Button { dang = o.id } label: {
                        VStack(spacing: 2) {
                            Image(systemName: bieuTuong(o.id)).font(.system(size: 20))
                            Text(o.nhan).font(.caption2).lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .foregroundStyle(o.id == hien ? Color.accentColor : Color.secondary)
                    }
                    .accessibilityLabel(o.nhan)
                }
            }.padding(.top, 6)
        }
    }

    private func bieuTuong(_ id: String) -> String {
        switch id {
        case "trang-chu": return "house"
        case "kairos": return "newspaper"
        case "ban-do": return "map"
        case "tau-toi": return "ferry"
        case "viec-lam": return "person.2"
        case "cho-ca": return "fish"
        case "ban-hang": return "storefront"
        default: return "cart"
        }
    }
}

struct ChuaLam: View {
    let nhan: String
    let dot: Int
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(nhan).font(.largeTitle.bold())
            Text("Mục này đang chuyển sang bản native (đợt \(dot)).")
            Spacer()
        }.frame(maxWidth: .infinity, alignment: .leading).padding()
    }
}
