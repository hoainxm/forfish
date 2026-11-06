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
    @Published var man: String = {
        #if DEBUG
        if let m = ProcessInfo.processInfo.environment["man"] { return m }
        #endif
        return "chinh"
    }()
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

    // Dock nổi tự vẽ như web (.bottom-dock) — TabView của iOS chỉ hiện 5 ô, dock chủ tàu có 6.
    var body: some View {
        let _ = tt.lanVe
        let dock = tt.ung.dock()
        let hien = dock.contains { $0.id == dang } ? dang : "trang-chu"
        ZStack(alignment: .bottom) {
            Group {
                switch hien {
                case "trang-chu": TrangChu()
                case "ban-do": BanDoThu().ignoresSafeArea(edges: .bottom)
                default: ChuaLam(nhan: dock.first { $0.id == hien }?.nhan ?? "", dot: DOT_CUA_O[hien] ?? 7)
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity)
            DockNoi(o: dock, dang: hien) { dang = $0 }
        }
        .background(Mau.nen.ignoresSafeArea())
    }
}

struct ChuaLam: View {
    let nhan: String
    let dot: Int
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ManHeader(nhan)
            HangYen(chu: "Mục này đang chuyển sang bản native", phu: "Đợt \(dot) trong lộ trình", icon: "Clock", mauIcon: Mau.mo).padding(.horizontal, 16)
            Spacer()
        }.background(Mau.nen.ignoresSafeArea())
    }
}
