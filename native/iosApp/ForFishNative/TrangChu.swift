import Shared
import SwiftUI

struct TrangChu: View {
    @EnvironmentObject var tt: TrangThaiApp
    @State private var tinBao: TinBao?
    @State private var dangHoi = true
    @State private var loiDangXuat: String?

    var body: some View {
        let _ = tt.lanVe
        let ung = tt.ung
        let daDangNhap = ung.phien.daDangNhap()
        let vai = ung.vaiHienTai()
        VStack(spacing: 0) {
            ManHeader(tieuDe: "Chào bà con") {
                if daDangNhap {
                    NutPhu(chu: NhanSinh.shared.nhan(khoa: "dangXuat")) { Task { loiDangXuat = try? await ung.dangNhap.dangXuat(); tt.veLai() } }
                } else {
                    NutPhu(chu: NhanSinh.shared.nhan(khoa: "dangNhap"), nen: Mau.navy, mauChu: Mau.the) { tt.man = "dangnhap" }
                }
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(spacing: 8) {
                        TheTinBao(t: tinBao, dangHoi: dangHoi)
                        if ung.phien.biDaLuc() != nil {
                            TheTrangThai(chu: "Tài khoản vừa đăng nhập ở máy khác", phu: "Máy này đã thoát. Dữ liệu đã tải vẫn còn.", icon: "Alert", mau: Mau.nguy, nen: Mau.nguyNen)
                        }
                    }
                    if daDangNhap, let sdt = ung.phien.sdt() {
                        Text("Tài khoản \(sdt) · \(NhanSinh.shared.VAI.first { $0.id == vai }?.ten ?? "chưa chọn vai")").font(Chu.phu).foregroundStyle(Mau.mo)
                    }
                    if let l = loiDangXuat { TheTrangThai(chu: l, icon: "Alert", mau: Mau.warn, nen: Mau.warnNen) }
                    if daDangNhap && vai == nil {
                        Hang(ten: "Bà con làm nghề gì?", phu: "Chọn để app xếp màn hình theo việc của mình") { tt.man = "chonvai" }
                    }
                    Text("Phần còn lại của Trang chủ (biển hôm nay, việc cần làm, thông báo, con nước, tin tuyển, cá đang bán…) chuyển sang bản native theo từng đợt.")
                        .font(Chu.phu).foregroundStyle(Mau.mo)
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, Co.dockRow + Co.dockGap + 16)
            }
        }
        .background(Mau.nen.ignoresSafeArea())
        .task {
            if let b = tt.ung.tinBao.banLuu() { tinBao = TinBao.Moi(ban: b) }
            tinBao = try? await tt.ung.tinBao.hoi()
            dangHoi = false
            ghi("Tin bão: \(String(describing: tinBao))")
        }
    }
}

/// = StormBanner variant "page": yên = hàng viền mảnh; không hỏi được = nền warn; có bão = nền danger.
struct TheTinBao: View {
    let t: TinBao?
    let dangHoi: Bool

    private func gio(_ iso: String?) -> String {
        guard let iso, let d = ISO8601DateFormatter.coPhanGiay.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return "—" }
        let f = DateFormatter(); f.dateFormat = "HH:mm"; return f.string(from: d)
    }

    private func moTa(_ b: BanTinBao) -> String { b.bao.isEmpty ? "không có bão" : b.bao.map { "\($0.kindLabel) \($0.name)" }.joined(separator: ", ") }

    var body: some View {
        if let m = t as? TinBao.Moi, !m.ban.bao.isEmpty {
            TheTrangThai(chu: m.ban.bao.map { "\($0.kindLabel) \($0.name)" }.joined(separator: " · "), phu: "Hỏi lúc \(gio(m.ban.hoiLuc))", icon: "Alert", mau: Mau.nguy, nen: Mau.nguyNen)
        } else if let m = t as? TinBao.Moi {
            HangYen(chu: "Không có tin bão trên Biển Đông", phu: "Hỏi lúc \(gio(m.ban.hoiLuc))", icon: "Check", mauIcon: Mau.ok)
        } else if let k = t as? TinBao.KhongHoiDuoc {
            TheTrangThai(chu: "Chưa hỏi được tin bão", phu: k.cu.map { "Lần cuối hỏi lúc \(gio($0.hoiLuc)): \(moTa($0))" } ?? "Chưa có lần nào hỏi được. Có sóng sẽ hỏi lại.", icon: "Alert", mau: Mau.warn, nen: Mau.warnNen)
        } else {
            HangYen(chu: dangHoi ? "Đang hỏi tin bão…" : "Chưa hỏi được tin bão", icon: "Clock", mauIcon: Mau.mo)
        }
    }
}

extension ISO8601DateFormatter {
    static let coPhanGiay: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
}
