import Shared
import SwiftUI

struct ManDangNhap: View {
    @EnvironmentObject var tt: TrangThaiApp
    @State private var sdt = ""
    @State private var mk = ""
    @State private var loi: String?
    @State private var ghiChu: String?
    @State private var dang = false

    var body: some View {
        VStack(spacing: 0) {
            ManHeader(tieuDe: NhanSinh.shared.nhan(khoa: "dangNhap")) { NutPhu(chu: NhanSinh.shared.nhan(khoa: "huy")) { tt.man = "chinh" } }
            The {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        NhanO(chu: "Số điện thoại")
                        ONhap(goiY: "Ví dụ: 0901234567", giaTri: $sdt, soDienThoai: true)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        NhanO(chu: "Mật khẩu")
                        ONhap(goiY: "Mật khẩu", giaTri: $mk, matKhau: true)
                    }
                    if let loi { TheTrangThai(chu: loi, icon: "Alert", mau: Mau.nguy, nen: Mau.nguyNen) }
                    if let ghiChu { TheTrangThai(chu: ghiChu, icon: "Check", mau: Mau.ok, nen: Mau.okNen) }
                    NutChinh(chu: dang ? "Đang vào…" : NhanSinh.shared.nhan(khoa: "dangNhap"), bat: !dang) { dangNhap() }
                }
            }.padding(.horizontal, 16)
            Spacer()
        }.background(Mau.nen.ignoresSafeArea())
    }

    private func dangNhap() {
        dang = true; loi = nil
        Task {
            let kq = try? await tt.ung.dangNhap.dangNhap(sdtNhap: sdt, matKhauNhap: mk)
            if let l = kq as? KetQuaDangNhap.Loi { loi = l.cau; dang = false; ghi("Đăng nhập lỗi: \(l.cau)"); return }
            guard let x = kq as? KetQuaDangNhap.Xong else { loi = CauLoi.shared.MANG_YEU; dang = false; return }
            ghi("Đăng nhập xong: bị đá máy khác=\(x.biDaMayKhac)")
            try? await tt.ung.khiMoApp()
            if x.biDaMayKhac { ghiChu = "Máy đăng nhập trước đó đã được đăng xuất."; try? await Task.sleep(nanoseconds: 1_500_000_000) }
            tt.veLai()
            if x.phaiDoiMatKhau { tt.phienTam = x.phienTam; tt.man = "doimk" }
            else { tt.man = tt.ung.vaiHienTai() == nil ? "chonvai" : "chinh" }
        }
    }
}

struct ManDoiMatKhau: View {
    @EnvironmentObject var tt: TrangThaiApp
    @State private var mk = ""
    @State private var loi: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ManHeader("Đặt mật khẩu mới")
            Group {
                Text("Lần đầu đăng nhập, bà con đặt mật khẩu riêng (ít nhất 6 ký tự).").font(Chu.noiDung).foregroundStyle(Mau.chu)
                ONhap(goiY: "Mật khẩu mới", giaTri: $mk, matKhau: true)
                if let loi { TheTrangThai(chu: loi, icon: "Alert", mau: Mau.nguy, nen: Mau.nguyNen) }
                NutChinh(chu: NhanSinh.shared.nhan(khoa: "luu")) {
                    Task {
                        guard let p = tt.phienTam else { loi = "Phiên đã hết. Bà con đăng nhập lại nhé."; return }
                        loi = try? await tt.ung.dangNhap.doiMatKhau(phienTam: p, moi: mk)
                        if loi == nil { tt.veLai(); tt.man = "chonvai" }
                    }
                }
            }.padding(.horizontal, 16)
            Spacer()
        }.background(Mau.nen.ignoresSafeArea())
    }
}

struct ManChonVai: View {
    @EnvironmentObject var tt: TrangThaiApp
    @State private var loi: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ManHeader(tieuDe: "Bà con làm nghề gì?") { NutPhu(chu: "Để sau") { tt.man = "chinh" } }
            Group {
                Text("Chọn một lần — app xếp màn hình theo việc của mình.").font(Chu.phu).foregroundStyle(Mau.mo).padding(.bottom, 4)
                ForEach(NhanSinh.shared.VAI, id: \.id) { v in
                    Hang(ten: v.ten, phu: v.phu) {
                        Task {
                            guard let sdt = tt.ung.phien.sdt() else { return }
                            let ma = try? await tt.ung.vai.chon(sdt: sdt, vai: v.id)
                            ghi("Chọn vai \(v.id): \(ma ?? "xong")")
                            if ma == nil { tt.veLai(); tt.man = "chinh" } else { loi = "Tài khoản đã có vai, không đổi được. Cần sửa thì gọi SDVICO." }
                        }
                    }
                }
                if let loi { TheTrangThai(chu: loi, icon: "Alert", mau: Mau.nguy, nen: Mau.nguyNen) }
            }.padding(.horizontal, 16)
            Spacer()
        }.background(Mau.nen.ignoresSafeArea())
    }
}
