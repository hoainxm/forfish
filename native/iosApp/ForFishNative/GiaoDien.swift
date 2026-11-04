import Shared
import SwiftUI

/*
  HỆ GIAO DIỆN iOS = HỆ CỦA WEB (03-design-system §0/§0b), cùng khuôn với androidApp/giaodien. Màu + cỡ + icon SINH từ
  globals.css / icons.tsx (native/scripts/sinh-giao-dien.mjs) — không gõ hex ở đây. Font Archivo + Plus Jakarta Sans.
*/
extension Color {
    /// ARGB (Long của MauSinh) → Color
    init(argb v: Int64) {
        self.init(.sRGB, red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255,
                  blue: Double(v & 0xFF) / 255, opacity: Double((v >> 24) & 0xFF) / 255)
    }
}

enum Mau {
    static let m = MauSinh.shared
    static let nen = Color(argb: m.Background), chu = Color(argb: m.Foreground), mo = Color(argb: m.Muted)
    static let the = Color(argb: m.Card), vien = Color(argb: m.Line), o = Color(argb: m.Field)
    static let navy = Color(argb: m.Navy), sea = Color(argb: m.Sea), trim = Color(argb: m.Trim)
    static let ok = Color(argb: m.Ok), okNen = Color(argb: m.OkBg), warn = Color(argb: m.Warn), warnNen = Color(argb: m.WarnBg)
    static let nguy = Color(argb: m.Danger), nguyNen = Color(argb: m.DangerBg), muc = Color(argb: m.InkRgb)
}

enum Co {
    static let c = CoSinh.shared
    static let hCta = CGFloat(c.HCta), hCtl = CGFloat(c.HCtl), hRow = CGFloat(c.HRow)
    static let rThe = CGFloat(c.RCard), rCtl = CGFloat(c.RCtl), dockRow = CGFloat(c.DockRow), dockGap = CGFloat(c.DockGap)
}

/// Thang chữ (03 §0), gốc 16pt.
enum Chu {
    static let h1 = Font.custom("Archivo-Bold", fixedSize: 24)
    static let h2 = Font.custom("Archivo-SemiBold", fixedSize: 18)
    static let ten = Font.custom("PlusJakartaSans-SemiBold", fixedSize: 16)
    static let noiDung = Font.custom("PlusJakartaSans-Regular", fixedSize: 16)
    static let phu = Font.custom("PlusJakartaSans-Regular", fixedSize: 13)
    static let nut = Font.custom("PlusJakartaSans-SemiBold", fixedSize: 16)
    static let nutPhu = Font.custom("PlusJakartaSans-SemiBold", fixedSize: 14)
}

/// Icon nét của web (icons.tsx): viewBox 24, nét 2.2, đầu + góc tròn. Lệnh vẽ do `DuongVe` (shared) đọc từ path SVG.
struct BieuTuong: View {
    let ten: String
    var mau: Color = Mau.chu
    var co: CGFloat = 20

    var body: some View {
        Canvas { ctx, size in
            let k = size.width / CGFloat(BieuTuongSinh.shared.VIEWBOX)
            for d in BieuTuongSinh.shared.ICON[ten] ?? [] {
                let dac = d.hasPrefix("F:")
                let p = Self.path(String(dac ? d.dropFirst(2) : Substring(d)), k)
                if dac { ctx.fill(p, with: .color(mau)) }
                else { ctx.stroke(p, with: .color(mau), style: StrokeStyle(lineWidth: CGFloat(BieuTuongSinh.shared.NET) * k, lineCap: .round, lineJoin: .round)) }
            }
        }
        .frame(width: co, height: co)
        .accessibilityHidden(true)
    }

    static func path(_ d: String, _ k: CGFloat) -> Path {
        var p = Path()
        for l in DuongVe.shared.phanTich(d: d) {
            switch l {
            case let x as LenhVe.Den: p.move(to: CGPoint(x: CGFloat(x.x) * k, y: CGFloat(x.y) * k))
            case let x as LenhVe.Ke: p.addLine(to: CGPoint(x: CGFloat(x.x) * k, y: CGFloat(x.y) * k))
            case let x as LenhVe.Cong:
                p.addCurve(to: CGPoint(x: CGFloat(x.x) * k, y: CGFloat(x.y) * k),
                           control1: CGPoint(x: CGFloat(x.x1) * k, y: CGFloat(x.y1) * k),
                           control2: CGPoint(x: CGFloat(x.x2) * k, y: CGFloat(x.y2) * k))
            default: p.closeSubpath()
            }
        }
        return p
    }
}

/// Tiêu đề màn (ManHeader): h1 navy + MỘT nút ngắn bên phải.
struct ManHeader<Phai: View>: View {
    let tieuDe: String
    @ViewBuilder var phai: () -> Phai
    var body: some View {
        HStack(spacing: 12) {
            Text(tieuDe).font(Chu.h1).foregroundStyle(Mau.navy).frame(maxWidth: .infinity, alignment: .leading)
            phai()
        }
        .frame(minHeight: 56).padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 4)
    }
}

extension ManHeader where Phai == EmptyView {
    init(_ tieuDe: String) { self.init(tieuDe: tieuDe) { EmptyView() } }
}

/// Thẻ (.surface): nền trắng, viền 1pt line, bo 1rem, không bóng.
struct The<NoiDung: View>: View {
    @ViewBuilder var noiDung: () -> NoiDung
    var body: some View {
        VStack(alignment: .leading, spacing: 0, content: noiDung).padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(Mau.the).clipShape(RoundedRectangle(cornerRadius: Co.rThe))
            .overlay(RoundedRectangle(cornerRadius: Co.rThe).stroke(Mau.vien, lineWidth: 1))
    }
}

/// Hàng danh sách: cao ≥ --h-row, tên 1rem 600 + dòng phụ mờ + chevron; chạm cả hàng.
struct Hang: View {
    let ten: String
    var phu: String?
    let bam: () -> Void
    var body: some View {
        Button(action: bam) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(ten).font(Chu.ten).foregroundStyle(Mau.navy)
                    if let phu { Text(phu).font(Chu.phu).foregroundStyle(Mau.mo) }
                }.frame(maxWidth: .infinity, alignment: .leading)
                BieuTuong(ten: "ChevronRight", mau: Mau.chu.opacity(0.4))
            }
            .padding(.horizontal, 16).padding(.vertical, 8).frame(minHeight: Co.hRow)
            .background(Mau.the).clipShape(RoundedRectangle(cornerRadius: Co.rThe))
            .overlay(RoundedRectangle(cornerRadius: Co.rThe).stroke(Mau.vien, lineWidth: 1))
        }.buttonStyle(NhanCo())
    }
}

/// Nhấn co 0.97 như web (:active scale).
struct NhanCo: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed ? 0.97 : 1).animation(.easeOut(duration: 0.16), value: configuration.isPressed)
    }
}

/// Nút chính (PrimaryButton): cam --trim, chữ trắng 1rem 600, cao --h-cta, bo 0.75rem.
struct NutChinh: View {
    let chu: String
    var bat = true
    let bam: () -> Void
    var body: some View {
        Button(action: bam) {
            Text(chu).font(Chu.nut).foregroundStyle(.white).frame(maxWidth: .infinity).frame(height: Co.hCta)
                .background(Mau.trim).clipShape(RoundedRectangle(cornerRadius: Co.rCtl)).opacity(bat ? 1 : 0.5)
        }.buttonStyle(NhanCo()).disabled(!bat)
    }
}

/// Nút phụ chữ gọn (.sq-btn): cao --h-ctl, bo tròn, rộng ≥ 5.5rem, 0.875rem 600.
struct NutPhu: View {
    let chu: String
    var icon: String?
    var nen: Color = Mau.o
    var mauChu: Color = Mau.navy
    let bam: () -> Void
    var body: some View {
        Button(action: bam) {
            HStack(spacing: 6) {
                if let icon { BieuTuong(ten: icon, mau: mauChu, co: 16) }
                Text(chu).font(Chu.nutPhu).foregroundStyle(mauChu)
            }.padding(.horizontal, 16).frame(minWidth: 88).frame(height: Co.hCtl).background(nen).clipShape(Capsule())
        }.buttonStyle(NhanCo())
    }
}

/// Ô nhập (inputClass): nền --field, bo 0.75rem, cao --h-ctl, không viền; đang gõ có vòng sea.
struct ONhap: View {
    let goiY: String
    @Binding var giaTri: String
    var matKhau = false
    var soDienThoai = false
    @FocusState private var dangGo: Bool
    var body: some View {
        Group {
            if matKhau { SecureField("", text: $giaTri, prompt: Text(goiY).foregroundColor(Mau.mo)) }
            else { TextField("", text: $giaTri, prompt: Text(goiY).foregroundColor(Mau.mo)).keyboardType(soDienThoai ? .phonePad : .default) }
        }
        .focused($dangGo).font(Chu.noiDung).foregroundStyle(Mau.chu).tint(Mau.sea)
        .padding(.horizontal, 12).frame(height: Co.hCtl).background(Mau.o).clipShape(RoundedRectangle(cornerRadius: Co.rCtl))
        .overlay(RoundedRectangle(cornerRadius: Co.rCtl).stroke(Mau.sea, lineWidth: dangGo ? 2 : 0))
    }
}

struct NhanO: View {
    let chu: String
    var body: some View { Text(chu).font(Chu.nutPhu).foregroundStyle(Mau.navy) }
}

/// Dòng trạng thái có nền (ok/warn/danger) — chỉ khi có việc cần biết (03 §0b).
struct TheTrangThai: View {
    let chu: String
    var phu: String?
    let icon: String
    let mau: Color
    let nen: Color
    var body: some View {
        HStack(spacing: 12) {
            BieuTuong(ten: icon, mau: mau)
            VStack(alignment: .leading, spacing: 2) {
                Text(chu).font(Chu.ten).foregroundStyle(mau)
                if let phu { Text(phu).font(Chu.phu).foregroundStyle(mau) }
            }
            Spacer(minLength: 0)
        }.padding(.horizontal, 12).padding(.vertical, 10).background(nen).clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

/// Trạng thái "yên" (StormBanner không bão): hàng viền mảnh, icon màu, chữ thường — không phủ nền.
struct HangYen: View {
    let chu: String
    var phu: String?
    let icon: String
    let mauIcon: Color
    var body: some View {
        HStack(spacing: 12) {
            BieuTuong(ten: icon, mau: mauIcon)
            VStack(alignment: .leading, spacing: 2) {
                Text(chu).font(Chu.noiDung).foregroundStyle(Mau.navy)
                if let phu { Text(phu).font(Chu.phu).foregroundStyle(Mau.mo) }
            }
            Spacer(minLength: 0)
        }.padding(.horizontal, 12).padding(.vertical, 10).frame(minHeight: 64)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Mau.vien, lineWidth: 1))
    }
}

/// = ICON của bottom-nav.tsx
let ICON_DOCK = ["trang-chu": "Home", "ban-do": "Pin", "tau-toi": "Anchor", "viec-lam": "Briefcase", "cho-ca": "Fish", "vat-tu": "Cart", "ban-hang": "Store"]

/// Dock nổi kiểu Facebook (.bottom-dock): thanh trắng bo tròn, lề 0.75rem, viền line + bóng nổi; CHỈ icon 1.5rem,
/// ô đang chọn = pill sea/12 + icon sea; tên ô qua trợ năng. Ô Kairos = ảnh cá Kairos.
struct DockNoi: View {
    let o: [OTaiDock]
    let dang: String
    let chon: (String) -> Void
    var body: some View {
        HStack(spacing: 0) {
            ForEach(o, id: \.id) { x in
                let bat = x.id == dang
                Button { chon(x.id) } label: {
                    ZStack {
                        Capsule().fill(bat ? Mau.sea.opacity(0.12) : .clear).frame(width: 52, height: 40)
                        if let icon = ICON_DOCK[x.id] { BieuTuong(ten: icon, mau: bat ? Mau.sea : Mau.chu.opacity(0.7), co: 24) }
                        else { Image(uiImage: UIImage(named: "kairos_fish_dock") ?? UIImage()).resizable().scaledToFit().frame(width: 44, height: 18).opacity(bat ? 1 : 0.7) }
                    }.frame(maxWidth: .infinity, maxHeight: .infinity).contentShape(Rectangle())
                }.buttonStyle(NhanCo()).accessibilityLabel(x.nhan)
            }
        }
        .padding(.horizontal, 6).frame(height: Co.dockRow).background(Mau.the).clipShape(Capsule())
        .overlay(Capsule().stroke(Mau.vien, lineWidth: 1))
        .shadow(color: Mau.muc.opacity(0.12), radius: 8, y: 4)
        .padding(.horizontal, 12).padding(.bottom, Co.dockGap)
    }
}
