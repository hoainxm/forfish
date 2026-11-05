// NHẮC NHỞ GIÁM SÁT HÀNH TRÌNH — THUẦN (2026-11-05). Anh Long: "cái tình trạng đồng bộ tổng cục quan trọng, vì nếu ko đồng
// bộ, mkn >6h là họ sẽ bị phạt, những cảnh báo loại này sẽ cho sen biển nhắc nhở họ thêm" · "cần tổ chức logic nhắc nhở".
//
// Máy GPU (scripts/stracking-dong-bo.mjs) có ĐỦ dữ liệu để quyết nhắc: hồ sơ máy (hạn, đồng bộ Tổng cục, SĐT chủ tàu +
// thuyền trưởng — kho SQLite) + danh sách MẤT KẾT NỐI đang diễn ra (/getListDeviceDisconnect). Nó gọi `viecNhac`, chống lặp
// bằng `khoa` trong sổ "đã nhắc" của máy nhà, rồi gửi `nhac[]` (một dòng/tàu/người) lên POST /api/stracking/nhap; máy chủ
// gộp với cảnh báo tàu thành MỘT tin/SĐT/lượt vào hộp thư + đẩy lên máy (lib/stracking/thong-bao).
//
// Không viện dẫn điều khoản / mức tiền phạt cụ thể — chỉ mốc 6 giờ anh Long nêu.

import { homNayVn, trangThaiHan } from "./dong-bo.mjs";
import { laMayDaBo } from "./may-da-bo.mjs";

export const MKN_SAP_GIO = 4;
export const MKN_PHAT_GIO = 6;
/** Mốc nhắc hạn cước: còn N ngày (0 = hết hôm nay). */
export const MOC_CON_HAN = [15, 7, 3, 1, 0];
/** Mốc nhắc khi ĐÃ quá hạn: quá N ngày. */
export const MOC_QUA_HAN = [1, 7, 30];
/**
 * MỐC LẮP MÁY THEO NGHỊ ĐỊNH (anh Long 05/11: "rà soát các thuê bao mà thiết bị ko đạt nghị định 41 … thông báo liên hệ
 * sdvico để nâng cấp đáp ứng" → "theo năm, coi các mốc nghị định ấy, 26, 37, 41"). NĐ 37/2024 (sửa NĐ 26/2019) có hiệu lực
 * 19/5/2024; NĐ 41/2026 (thay NĐ 26/2019, ban hành 25/01/2026): tàu đã lắp thiết bị TRƯỚC 19/5/2024 mà chưa đáp ứng yêu cầu
 * kỹ thuật tại khoản 2 Điều 26 phải nâng cấp/thay (nguồn: tin An Giang hỗ trợ nâng cấp, thuysanvietnam.com.vn, 05/2026).
 * Ngày lắp = "Thời gian đăng ký" trên S-Tracking (thiếu thì "Ngày tạo"). Máy lắp trước mốc ⇒ nhắc liên hệ SDVICO kiểm tra,
 * nâng cấp — 1 lần/tuần (anh Long chọn); lần ĐẦU đẩy lên máy, các tuần sau chỉ hộp thư (máy GPU quyết `day`).
 */
export const MOC_LAP_ND37 = "2024-05-19";

const GIO_MS = 3600_000;

function gioPhutVn(ms) {
  const d = new Date(ms + 7 * GIO_MS);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`;
}
function ngayVn(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Một dòng JSON /getListDeviceDisconnect (content.data[].report) ⇒ đợt mất kết nối. Sai ⇒ null. */
export function docMkn(r) {
  const x = r?.report ?? r;
  if (!x || typeof x !== "object") return null;
  const serial = typeof x.serial === "string" ? x.serial.trim() : "";
  const batDau = Number(x.dateTracking);
  if (!serial || !Number.isFinite(batDau) || batDau < 1e12) return null;
  const ketThuc = x.dateOnline == null ? null : Number(x.dateOnline);
  return {
    serial,
    imei: typeof x.imei === "string" ? x.imei.trim() || null : null,
    tenTau: (typeof x.deviceName === "string" && x.deviceName.trim()) || (typeof x.vin === "string" && x.vin.trim()) || null,
    batDau: new Date(batDau).toISOString(),
    dangMat: ketThuc == null || !Number.isFinite(ketThuc),
    // inShore: 1 = trong bờ, 2 = ngoài khơi (khớp bộ lọc "Vị trí" của trang).
    ngoaiKhoi: Number(x.inShore) === 2,
  };
}

function nguoiNhan(t) {
  return [...new Set([t.sdtChuTau, t.sdtThuyenTruong].filter((s) => typeof s === "string" && /^0[1-9]\d{8}$/.test(s)))];
}

/**
 * Việc nhắc của MỘT lượt. `thietBi`: hồ sơ gộp (khoá camelCase như kho máy nhà: serial, tenTau, sdtChuTau, sdtThuyenTruong,
 * hetHan, dongBoTcts, trongBo). `mkn`: kết quả `docMkn` (chỉ đợt đang mất có nghĩa). Trả [{khoa, serial, tau, loai, day,
 * dong, nguoi[]}] — `khoa` cố định cho cùng một sự việc cùng mốc ⇒ máy nhà chống lặp; `day` = đẩy lên máy (còn lại chỉ hộp thư).
 */
export function viecNhac({ thietBi, mkn = [], now = Date.now() }) {
  const homNay = homNayVn(now);
  // Máy ĐÃ HUỶ / THU HỒI (đại lý đổi tên DE…/Thu…, nhóm …DELETE — lib/stracking/may-da-bo) ⇒ không nhắc gì: nhiều máy
  // quá hạn từ 2023, nhắc là sai (báo thật từ nhóm Zalo 05/11).
  // Hồ sơ kho có sẵn capNhatNguon + hetHan ⇒ cũng loại máy BỎ ĐỌNG (>365 ngày không cập nhật và hết/không hạn).
  thietBi = thietBi.filter((t) => !laMayDaBo(t, now));
  const theoSerial = new Map(thietBi.map((t) => [t.serial, t]));
  const out = [];
  const them = (t, x) => {
    const nguoi = nguoiNhan(t);
    if (nguoi.length) out.push({ serial: t.serial, tau: t.tenTau ?? t.serial, nguoi, ...x });
  };

  // 1) MẤT KẾT NỐI đang diễn ra NGOÀI KHƠI — mốc 6 giờ là mốc bị phạt.
  for (const m of mkn) {
    if (!m?.dangMat || !m.ngoaiKhoi) continue;
    const t = theoSerial.get(m.serial);
    if (!t) continue;
    const bd = Date.parse(m.batDau);
    const gio = (now - bd) / GIO_MS;
    if (!(gio >= MKN_SAP_GIO)) continue;
    const tau = t.tenTau ?? m.tenTau ?? t.serial;
    if (gio < MKN_PHAT_GIO) {
      them(t, {
        khoa: `mkn|${t.serial}|${m.batDau}|sap`,
        loai: "mkn-sap-6h",
        day: true,
        dong: `${tau}: mất kết nối giám sát hành trình ${Math.floor(gio)} giờ (từ ${gioPhutVn(bd)}) — sắp quá 6 giờ là bị phạt. Kiểm tra nguồn điện, ăng-ten máy ngay.`,
      });
    } else {
      // Nhắc lại mỗi 6 giờ trong cùng một đợt mất.
      const dot = Math.floor(gio / MKN_PHAT_GIO);
      const gioTron = Math.floor(gio);
      const thoiGian = gioTron >= 48 ? `${Math.floor(gioTron / 24)} ngày` : `${gioTron} giờ`;
      them(t, {
        khoa: `mkn|${t.serial}|${m.batDau}|${dot}`,
        loai: "mkn-qua-6h",
        day: true,
        dong: `${tau}: đã mất kết nối giám sát hành trình ${thoiGian} (từ ${gioPhutVn(bd)}) — quá 6 giờ là bị phạt. Báo vị trí tàu cho cơ quan quản lý và gọi SDVICO kiểm tra máy.`,
      });
    }
  }

  for (const t of thietBi) {
    // 2) KHÔNG ĐỒNG BỘ TỔNG CỤC — dữ liệu không về Tổng cục Thủy sản. Ngoài khơi ⇒ đẩy; trong bờ ⇒ chỉ hộp thư. 1 lần/ngày.
    if (typeof t.dongBoTcts === "string" && /thất bại/i.test(t.dongBoTcts)) {
      const ngoai = t.trongBo === false;
      them(t, {
        khoa: `tcts|${t.serial}|${homNay}`,
        loai: "tcts-that-bai",
        day: ngoai,
        dong: `${t.tenTau ?? t.serial}: máy giám sát hành trình CHƯA đồng bộ dữ liệu về Tổng cục Thủy sản${ngoai ? " trong khi tàu đang ngoài khơi" : ""} — dễ bị tính mất kết nối. Gọi SDVICO kiểm tra.`,
      });
    }
    // 3) HẠN CƯỚC — nhắc đúng các mốc, hết hạn = máy ngừng truyền = mất kết nối.
    const s = trangThaiHan(t.hetHan, homNay);
    if (s.loai === "sap-het" && MOC_CON_HAN.includes(s.soNgay)) {
      them(t, {
        khoa: `han|${t.serial}|${t.hetHan}|con${s.soNgay}`,
        loai: "han-sap-het",
        day: s.soNgay <= 3,
        dong:
          s.soNgay === 0
            ? `${t.tenTau ?? t.serial}: cước giám sát hành trình HẾT HẠN HÔM NAY — hết hạn máy ngừng truyền, tính là mất kết nối. Gia hạn trong app.`
            : `${t.tenTau ?? t.serial}: cước giám sát hành trình còn ${s.soNgay} ngày (hết ${ngayVn(t.hetHan)}). Gia hạn sớm để máy không ngừng truyền.`,
      });
    } else if (s.loai === "het-han" && MOC_QUA_HAN.includes(-s.soNgay)) {
      them(t, {
        khoa: `han|${t.serial}|${t.hetHan}|qua${-s.soNgay}`,
        loai: "han-qua-han",
        day: true,
        dong: `${t.tenTau ?? t.serial}: cước giám sát hành trình đã quá hạn ${-s.soNgay} ngày (từ ${ngayVn(t.hetHan)}) — máy không truyền dữ liệu, ra khơi là bị tính mất kết nối. Gia hạn trong app.`,
      });
    }
    // 4) LẮP TRƯỚC MỐC NĐ 37/2024 ⇒ cần đáp ứng yêu cầu kỹ thuật NĐ 41/2026 — 1 lần/tuần (khoá theo tuần VN).
    const ngayLap = t.dangKyLuc || (typeof t.taoLuc === "string" ? isoNgayVn(t.taoLuc) : null);
    if (ngayLap && /^\d{4}-\d{2}-\d{2}$/.test(ngayLap) && ngayLap < MOC_LAP_ND37) {
      them(t, {
        khoa: `nd41|${t.serial}|tuan${tuanVn(now)}`,
        loai: "nd41-nang-cap",
        day: false,
        dong: `${t.tenTau ?? t.serial}: máy giám sát hành trình lắp từ ${ngayVn(ngayLap)}, trước mốc 19/5/2024 — theo Nghị định 41/2026, máy lắp trước mốc này chưa đáp ứng yêu cầu kỹ thuật mới phải nâng cấp hoặc thay. Liên hệ SDVICO để kiểm tra, nâng cấp.`,
      });
    }
  }
  return out;
}

/** ISO (UTC) ⇒ ngày lịch VN "yyyy-mm-dd". */
function isoNgayVn(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? homNayVn(t) : null;
}

/** Số tuần (tính từ thứ Hai, giờ VN) — khoá "1 lần/tuần". */
export function tuanVn(now = Date.now()) {
  const ngay = Math.floor(Date.parse(`${homNayVn(now)}T00:00:00Z`) / 86_400_000); // 1970-01-01 là thứ Năm
  return Math.floor((ngay + 3) / 7);
}

/** Bung việc nhắc ra từng người nhận — dạng gửi máy chủ `nhac: [{sdt, tau, loai, day, dong}]`. */
export function nhacTheoNguoi(viec) {
  const out = [];
  for (const v of viec) for (const sdt of v.nguoi) out.push({ sdt, tau: v.tau, loai: v.loai, day: v.day, dong: v.dong });
  return out;
}
