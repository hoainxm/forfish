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
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(NhanSinh.shared.NHAN["dangNhap"] ?? "Đăng nhập").font(.largeTitle.bold())
                Spacer()
                Button(NhanSinh.shared.NHAN["huy"] ?? "Huỷ") { tt.man = "chinh" }
            }
            TextField("Số điện thoại", text: $sdt).keyboardType(.phonePad).textFieldStyle(.roundedBorder)
            SecureField("Mật khẩu", text: $mk).textFieldStyle(.roundedBorder)
            if let loi { Text(loi).foregroundStyle(.red) }
            if let ghiChu { Text(ghiChu) }
            Button {
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
            } label: { Text(dang ? "Đang vào…" : (NhanSinh.shared.NHAN["dangNhap"] ?? "Đăng nhập")).frame(maxWidth: .infinity) }
                .buttonStyle(.borderedProminent).disabled(dang)
            Spacer()
        }.padding()
    }
}

struct ManDoiMatKhau: View {
    @EnvironmentObject var tt: TrangThaiApp
    @State private var mk = ""
    @State private var loi: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Đặt mật khẩu mới").font(.largeTitle.bold())
            Text("Lần đầu đăng nhập, bà con đặt mật khẩu riêng (ít nhất 6 ký tự).")
            SecureField("Mật khẩu mới", text: $mk).textFieldStyle(.roundedBorder)
            if let loi { Text(loi).foregroundStyle(.red) }
            Button {
                Task {
                    guard let p = tt.phienTam else { loi = "Phiên đã hết. Bà con đăng nhập lại nhé."; return }
                    loi = try? await tt.ung.dangNhap.doiMatKhau(phienTam: p, moi: mk)
                    if loi == nil { tt.veLai(); tt.man = "chonvai" }
                }
            } label: { Text(NhanSinh.shared.NHAN["luu"] ?? "Lưu").frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent)
            Spacer()
        }.padding()
    }
}

struct ManChonVai: View {
    @EnvironmentObject var tt: TrangThaiApp
    @State private var loi: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Bà con làm nghề gì?").font(.title.bold())
                Spacer()
                Button("Để sau") { tt.man = "chinh" }
            }
            Text("Chọn một lần — app xếp màn hình theo việc của mình.").font(.caption)
            ForEach(NhanSinh.shared.VAI, id: \.id) { v in
                Button {
                    Task {
                        guard let sdt = tt.ung.phien.sdt() else { return }
                        let ma = try? await tt.ung.vai.chon(sdt: sdt, vai: v.id)
                        ghi("Chọn vai \(v.id): \(ma ?? "xong")")
                        if ma == nil { tt.veLai(); tt.man = "chinh" } else { loi = "Tài khoản đã có vai, không đổi được. Cần sửa thì gọi SDVICO." }
                    }
                } label: {
                    VStack(alignment: .leading) {
                        Text(v.ten).font(.headline)
                        Text(v.phu).font(.caption)
                    }.padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.secondary.opacity(0.1)).clipShape(RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain)
            }
            if let loi { Text(loi).foregroundStyle(.red) }
            Spacer()
        }.padding()
    }
}
