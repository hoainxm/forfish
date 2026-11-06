// CẢNG NHÀ TỰ GẮN THEO SỐ TÀU S-TRACKING (2026-11-06, anh Long: "nếu các tàu đã có vị trí từ stracking, có info rồi thì
// gắn cảng luôn cho nó, họ ko thích thì họ đổi thôi, đỡ phải làm cái bước chọn cảng nó rối").
//
// S-Tracking đồng bộ về CHƯA có toạ độ tàu (máy thu chỉ đọc 4 trang trong `DUONG_DOC`, không trang nào có vị trí). Thứ
// có thật là SỐ ĐĂNG KÝ "BĐ-97989-TS": chữ đầu là mã tỉnh nơi tàu đăng ký ⇒ đoán cảng cá CHÍNH của tỉnh (cũ) đó. Anh Long
// chốt "Cả hai": làm theo tỉnh bây giờ; khi máy thu có vị trí cuối lúc Trong bờ thì ưu tiên cảng gần chỗ neo.
//
// LUẬT:
//   · CHỈ gắn khi máy CHƯA có cảng nhà nào (`docCangNha() === null`) — không bao giờ đè lựa chọn của bà con.
//   · Gắn MỘT lần: đã ghi dấu `forfish.cangnha.tudong.v1` thì thôi (bà con đổi/xoá rồi, app không giành lại).
//   · Nhiều tàu khác tỉnh ⇒ lấy tỉnh có NHIỀU tàu nhất (hoà ⇒ tàu đứng trước trong danh sách).
//   · Mã lạ / số rác ("test", "VT64528530_19M9520") ⇒ không đoán.
// Mã tỉnh: mã CŨ trên số đăng ký tàu cá (63 tỉnh) + mã tỉnh MỚI sau sáp nhập 2025 đã thấy trong dữ liệu thật (AG, GL,
// VL, ĐT, LĐ, ĐL, CT, HY). Đếm thật kho máy nhà 2026-11-06 (15.853 máy) — xem docs/app-map/04 › S-Tracking.

import { cangTheoId, datCangNha, docCangNha } from "@/lib/cang-nha";

/** Dấu "app đã tự gắn cảng nhà" — đọc để ghi "tự chọn theo số tàu … · Đổi"; có dấu thì không gắn lại. */
export const CANG_TU_DONG_KEY = "forfish.cangnha.tudong.v1";

/** Mã tỉnh (viết HOA, giữ Đ) ⇒ id cảng cá chính trong FISHING_PORTS. Cảng chọn tay: cảng loại II lớn nhất của tỉnh CŨ. */
export const CANG_THEO_MA_TINH: Readonly<Record<string, string>> = Object.freeze({
  QN: "cai-rong", // Quảng Ninh
  HP: "ngoc-hai", // Hải Phòng
  TB: "tan-son", // Thái Bình (nay Hưng Yên)
  HY: "tan-son",
  NĐ: "ninh-co", // Nam Định (nay Ninh Bình)
  NB: "ninh-co",
  TH: "lach-hoi", // Thanh Hóa
  NA: "cua-hoi", // Nghệ An
  HT: "cua-sot-thach-kim", // Hà Tĩnh
  QB: "nhat-le", // Quảng Bình (nay Quảng Trị)
  QT: "cua-viet",
  TTH: "thuan-an", // Huế
  ĐNA: "tho-quang", // Đà Nẵng
  QNA: "tam-quang", // Quảng Nam (nay Đà Nẵng)
  QNG: "tinh-ky", // Quảng Ngãi
  BĐ: "quy-nhon", // Bình Định (nay Gia Lai)
  GL: "quy-nhon",
  PY: "dong-tac", // Phú Yên (nay Đắk Lắk)
  ĐL: "dong-tac",
  KH: "hon-ro", // Khánh Hòa
  NT: "ninh-chu", // Ninh Thuận (nay Khánh Hòa)
  BTH: "phan-thiet", // Bình Thuận (nay Lâm Đồng)
  LĐ: "phan-thiet",
  BV: "cat-lo", // Bà Rịa – Vũng Tàu (nay TP.HCM)
  VT: "cat-lo",
  SG: "cat-lo",
  TG: "my-tho", // Tiền Giang (nay Đồng Tháp)
  ĐT: "my-tho",
  BT: "binh-dai", // Bến Tre (nay Vĩnh Long)
  VL: "binh-dai",
  TV: "dinh-an", // Trà Vinh (nay Vĩnh Long)
  ST: "tran-de", // Sóc Trăng (nay Cần Thơ)
  CT: "tran-de",
  BL: "ganh-hao", // Bạc Liêu (nay Cà Mau)
  CM: "song-doc", // Cà Mau
  KG: "tac-cau", // Kiên Giang (nay An Giang)
  AG: "tac-cau",
});

/** Mã tỉnh trong số đăng ký ("BĐ-97989-TS", "QNg 90123 TS", "btH-96684-TS") — viết HOA; null nếu không ra mã. */
export function maTinhTuSoTau(soTau: string | null | undefined): string | null {
  const m = /^\s*([A-Za-zĐđ]{1,4})\s*[-. ]?\s*\d{3,6}(?!\d)/.exec(soTau ?? "");
  return m ? m[1].toUpperCase() : null;
}

/** Id cảng cá chính theo số tàu; null = mã lạ hoặc cảng không còn trong danh mục. */
export function cangTheoSoTau(soTau: string | null | undefined): string | null {
  const ma = maTinhTuSoTau(soTau);
  const id = ma ? CANG_THEO_MA_TINH[ma] : undefined;
  return id && cangTheoId(id) ? id : null;
}

/** Từ danh sách số tàu của tài khoản ⇒ cảng của tỉnh nhiều tàu nhất (hoà ⇒ tàu đứng trước). THUẦN. */
export function chonCangTuDanhSachTau(soTau: readonly (string | null | undefined)[]): { portId: string; soTau: string } | null {
  const dem = new Map<string, { n: number; dau: number; soTau: string }>();
  soTau.forEach((s, i) => {
    const id = cangTheoSoTau(s);
    if (!id || !s) return;
    const o = dem.get(id);
    if (o) o.n += 1;
    else dem.set(id, { n: 1, dau: i, soTau: s.trim() });
  });
  let tot: { portId: string; n: number; dau: number; soTau: string } | null = null;
  for (const [portId, o] of dem) if (!tot || o.n > tot.n || (o.n === tot.n && o.dau < tot.dau)) tot = { portId, ...o };
  return tot ? { portId: tot.portId, soTau: tot.soTau } : null;
}

export type DauTuDong = { portId: string; soTau: string; luc: number };

export function docDauTuDong(): DauTuDong | null {
  try {
    const raw = window.localStorage.getItem(CANG_TU_DONG_KEY);
    const d = raw ? (JSON.parse(raw) as DauTuDong) : null;
    return d && typeof d.portId === "string" && typeof d.soTau === "string" ? d : null;
  } catch {
    return null;
  }
}

/**
 * Gắn cảng nhà theo số tàu NẾU máy chưa có cảng nhà và chưa từng tự gắn. Trả cảng đã gắn, null nếu không làm gì.
 * Không bao giờ ném. Ghi kho hỏng (`datCangNha` false) ⇒ không ghi dấu, lần sau thử lại.
 */
export function thuTuGanCangNha(soTau: readonly (string | null | undefined)[]): DauTuDong | null {
  if (typeof window === "undefined") return null;
  try {
    if (docCangNha() !== null) return null;
    if (window.localStorage.getItem(CANG_TU_DONG_KEY) !== null) return null;
    const chon = chonCangTuDanhSachTau(soTau);
    if (!chon) return null;
    // Ghi dấu TRƯỚC: `datCangNha` bắn CANG_NHA_EVENT ngay bên trong, thẻ Biển hôm nay đọc dấu lúc đó để hiện "· Đổi".
    const dau: DauTuDong = { ...chon, luc: Date.now() };
    window.localStorage.setItem(CANG_TU_DONG_KEY, JSON.stringify(dau));
    if (!datCangNha(chon.portId)) {
      window.localStorage.removeItem(CANG_TU_DONG_KEY); // không giữ được cảng ⇒ gỡ dấu, lần sau thử lại
      return null;
    }
    return dau;
  } catch {
    return null;
  }
}
