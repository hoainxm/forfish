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
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Chào bà con").font(.largeTitle.bold())
                    Spacer()
                    if daDangNhap {
                        Button(NhanSinh.shared.NHAN["dangXuat"] ?? "Đăng xuất") {
                            Task { loiDangXuat = try? await ung.dangNhap.dangXuat(); tt.veLai() }
                        }
                    } else {
                        Button(NhanSinh.shared.NHAN["dangNhap"] ?? "Đăng nhập") { tt.man = "dangnhap" }.buttonStyle(.borderedProminent)
                    }
                }
                if daDangNhap, let sdt = ung.phien.sdt() {
                    Text("Tài khoản \(sdt) · \(NhanSinh.shared.VAI.first { $0.id == vai }?.ten ?? "chưa chọn vai")").font(.subheadline)
                }
                if let l = loiDangXuat { Text(l).foregroundStyle(.red) }
                TheTinBao(t: tinBao, dangHoi: dangHoi)
                if ung.phien.biDaLuc() != nil {
                    Text("Tài khoản vừa đăng nhập ở máy khác nên máy này đã thoát. Dữ liệu đã tải vẫn còn. Bà con đăng nhập lại nếu cần.")
                        .padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.red.opacity(0.12)).clipShape(RoundedRectangle(cornerRadius: 12))
                }
                if daDangNhap && vai == nil {
                    Button { tt.man = "chonvai" } label: {
                        VStack(alignment: .leading) {
                            Text("Bà con làm nghề gì?").font(.headline)
                            Text("Chọn để app xếp màn hình theo việc của mình").font(.caption)
                        }.padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.secondary.opacity(0.1)).clipShape(RoundedRectangle(cornerRadius: 12))
                    }.buttonStyle(.plain)
                }
                Text("Phần còn lại của Trang chủ (biển hôm nay, việc cần làm, thông báo, con nước, tin tuyển, cá đang bán…) chuyển sang bản native theo từng đợt.")
                    .font(.caption).foregroundStyle(.secondary)
            }.padding()
        }
        .task {
            if let b = tt.ung.tinBao.banLuu() { tinBao = TinBao.Moi(ban: b) }
            tinBao = try? await tt.ung.tinBao.hoi()
            dangHoi = false
            ghi("Tin bão: \(String(describing: tinBao))")
        }
    }
}

struct TheTinBao: View {
    let t: TinBao?
    let dangHoi: Bool

    private func gio(_ iso: String?) -> String {
        guard let iso, let d = ISO8601DateFormatter.coPhanGiay.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return "—" }
        let f = DateFormatter(); f.dateFormat = "HH:mm"; return f.string(from: d)
    }

    private func moTa(_ b: BanTinBao) -> String { b.bao.isEmpty ? "không có bão" : b.bao.map { "\($0.kindLabel) \($0.name)" }.joined(separator: ", ") }

    var body: some View {
        let (d1, d2, nguy): (String, String, Bool) = {
            if let m = t as? TinBao.Moi {
                if !m.ban.bao.isEmpty { return (m.ban.bao.map { "\($0.kindLabel) \($0.name)" }.joined(separator: " · "), "Hỏi lúc \(gio(m.ban.hoiLuc))", true) }
                return ("Không có tin bão trên Biển Đông", "Hỏi lúc \(gio(m.ban.hoiLuc))", false)
            }
            if let k = t as? TinBao.KhongHoiDuoc {
                return ("Chưa hỏi được tin bão", k.cu.map { "Lần cuối hỏi lúc \(gio($0.hoiLuc)): \(moTa($0))" } ?? "Chưa có lần nào hỏi được. Có sóng sẽ hỏi lại.", false)
            }
            return (dangHoi ? "Đang hỏi tin bão…" : "Chưa hỏi được tin bão", "", false)
        }()
        VStack(alignment: .leading, spacing: 2) {
            Text(d1).font(.headline)
            if !d2.isEmpty { Text(d2).font(.caption) }
        }
        .padding().frame(maxWidth: .infinity, alignment: .leading)
        .background(nguy ? Color.red.opacity(0.15) : Color.secondary.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

extension ISO8601DateFormatter {
    static let coPhanGiay: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
}
