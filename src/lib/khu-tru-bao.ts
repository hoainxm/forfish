/**
 * Trục 1 — LỚP KHU NEO ĐẬU TRÁNH TRÚ BÃO cho tàu cá.
 *
 * File này giữ TYPE + GIẢI MÃ + CÂU MÔ TẢ (thuần, test được) cho dataset tĩnh
 * `public/data/khu-tru-bao.v1.json`. Component render bằng lớp symbol của
 * MapLibre — file này KHÔNG vẽ.
 *
 * ── VÌ SAO CÓ ─────────────────────────────────────────────────────────────
 * App đã có tin bão Biển Đông + cron đẩy cảnh báo bão. Báo bão mà không chỉ
 * được chỗ trú là mới làm nửa việc: bà con biết bão tới nhưng không biết chạy
 * vào đâu. Lớp này là danh mục CHÍNH THỨC các khu neo đậu tránh trú bão do
 * Thủ tướng phê duyệt — Quyết định 582/QĐ-TTg ngày 03/7/2024 (thay QĐ
 * 1976/QĐ-TTg 2015): 160 khu (30 cấp vùng, 130 cấp tỉnh) trên 28 tỉnh ven biển.
 *
 * ── TOẠ ĐỘ Ở ĐÂU RA ───────────────────────────────────────────────────────
 * Văn bản quy hoạch chỉ ghi TÊN khu + xã/huyện + cấp + sức chứa, KHÔNG ghi
 * lat/lon. Toạ độ trong dataset được đối chiếu từ nguồn khác: đèn biển Việt
 * Nam, phao luồng hàng hải (Cục Hàng hải VN / Thông báo hàng hải), và một số
 * ít từ OpenStreetMap. Mỗi khu mang cờ tin cậy `tin`:
 *   - "cao": toạ độ đặt tại chính đối tượng (đảo/cảng/đèn cửa) — lệch nhỏ.
 *   - "vua": suy từ đèn/phao luồng gần cửa hoặc giữa vịnh — có thể lệch vài km.
 * Khu nào KHÔNG đối chiếu được toạ độ đáng tin thì BỎ khỏi dataset (nói thẳng
 * trong `docs/research/khu-tru-bao-2026-09.md`) chứ không đoán bừa một điểm
 * giữa biển — điểm trú bão sai chỗ nguy hiểm hơn không có điểm.
 *
 * ── ĐIỂM KHÔNG PHẢI VÙNG ───────────────────────────────────────────────────
 * Toạ độ chỉ ĐÁNH DẤU cửa/cảng/đảo của khu, KHÔNG phải ranh giới vùng nước
 * neo đậu. Nhãn "tham khảo" của dataset KHÔNG được gỡ: trước khi vào tránh trú
 * bà con phải nghe hướng dẫn địa phương và Thông báo hàng hải.
 *
 * ## Assumptions
 * - `sucChua` là SỐ TÀU tối đa theo quy hoạch; `coTauM` là chiều dài tàu lớn
 *   nhất (mét) có thể vào — đúng đơn vị Phụ lục QĐ 582. Nguồn để trống thì hai
 *   trường này là `null`, KHÔNG phải 0.
 */

import { fetchDataJson } from "@/lib/data-fetch";
import { trongKhungBienVN } from "@/lib/den-bien";

/* ── KIỂU ────────────────────────────────────────────────────────────────── */

/** Cấp khu: cấp vùng (lớn, ưu tiên quốc gia) hay cấp tỉnh. */
export type KhuCap = "vung" | "tinh";

/** Mức tin cậy của TOẠ ĐỘ (không phải của việc khu có tồn tại hay không). */
export type KhuTin = "cao" | "vua";

export type KhuTruBao = {
  lon: number;
  lat: number;
  /** tên khu theo quy hoạch ("Lạch Hới", "Đảo Nam Du") */
  ten: string;
  /** tỉnh/thành ("QUẢNG NINH") */
  tinh: string;
  cap: KhuCap;
  /** số tàu tối đa theo quy hoạch — `null` khi nguồn không ghi */
  sucChua: number | null;
  /** chiều dài tàu lớn nhất vào được, mét — `null` khi nguồn không ghi */
  coTauM: number | null;
  /** ghi chú quy hoạch (thường "Kết hợp cảng cá …") — có thể `null` */
  ghiChu: string | null;
  tin: KhuTin;
  /** nói rõ toạ độ lấy từ đâu ("đèn biển Cửa Gianh", "luồng Sông Dinh …") */
  nguonToaDo: string;
};

/** Dạng thô trong `public/data/khu-tru-bao.v1.json`. */
export type KhuTruBaoFile = {
  v: number;
  nguon: string;
  /** nhãn "tham khảo" — KHÔNG được bỏ */
  nhan: string;
  layNgay: string;
  giayPhep: { trangThai: string; giayPhepId: string; ghiChu: string };
  tinChiDan?: Record<string, string>;
  khu: Array<Partial<KhuTruBao>>;
};

/* ── NHÃN TIẾNG VIỆT ─────────────────────────────────────────────────────── */

/**
 * "Cấp vùng / cấp tỉnh" là chữ của văn bản quy hoạch — bà con không biết "cấp
 * vùng" nghĩa là khu to hay nhỏ, có nhận tàu tỉnh khác không. Nói thẳng điều
 * đó (review 2026-09-03).
 */
const CAP_LABEL: Record<KhuCap, string> = {
  vung: "khu lớn (đón tàu nhiều tỉnh)",
  tinh: "khu tỉnh",
};

/** Nhãn cấp; cấp lạ rơi về "khu tỉnh" — không bao giờ lộ mã thô ra màn hình. */
export function capLabel(cap: string | undefined): string {
  return CAP_LABEL[(cap ?? "") as KhuCap] ?? CAP_LABEL.tinh;
}

const CAP_HOP_LE = new Set<KhuCap>(["vung", "tinh"]);
const TIN_HOP_LE = new Set<KhuTin>(["cao", "vua"]);

/* ── GIẢI MÃ DATASET ─────────────────────────────────────────────────────── */

/** Số nguyên dương thật sự; ngược lại `null` (nguồn không công bố). */
const soNguyenDuong = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;

/**
 * Danh sách khu neo đậu, đã lọc.
 *
 * BỎ QUA hàng hỏng thay vì ném: một dòng lỗi không được làm mất cả lớp trú bão
 * của chuyến biển. Hàng bị bỏ khi thiếu toạ độ, RA NGOÀI KHUNG BIỂN VN (cổng
 * `trongKhungBienVN` bắt toạ độ OCR tách chữ), hoặc thiếu tên.
 */
export function decodeKhuTruBao(raw: unknown): KhuTruBao[] {
  const f = raw as Partial<KhuTruBaoFile> | null;
  if (!f || !Array.isArray(f.khu)) return [];

  const out: KhuTruBao[] = [];
  for (const k of f.khu) {
    if (!k || typeof k !== "object") continue;
    const lon = (k as KhuTruBao).lon;
    const lat = (k as KhuTruBao).lat;
    if (!trongKhungBienVN(lon, lat)) continue;

    const ten = typeof k.ten === "string" ? k.ten.trim() : "";
    if (!ten) continue;

    const tinh = typeof k.tinh === "string" ? k.tinh.trim() : "";
    const cap: KhuCap = CAP_HOP_LE.has(k.cap as KhuCap)
      ? (k.cap as KhuCap)
      : "tinh"; // cấp lạ vẫn là khu trú — giữ điểm, hạ về cấp tỉnh
    const tin: KhuTin = TIN_HOP_LE.has(k.tin as KhuTin)
      ? (k.tin as KhuTin)
      : "vua"; // thiếu/cờ lạ → coi như tin cậy vừa (an toàn hơn "cao")

    out.push({
      lon,
      lat,
      ten,
      tinh,
      cap,
      sucChua: soNguyenDuong(k.sucChua),
      coTauM: soNguyenDuong(k.coTauM),
      ghiChu:
        typeof k.ghiChu === "string" && k.ghiChu.trim() ? k.ghiChu.trim() : null,
      tin,
      nguonToaDo:
        typeof k.nguonToaDo === "string" ? k.nguonToaDo.trim() : "",
    });
  }
  return out;
}

/* ── CÂU CHO BÀ CON ĐỌC ──────────────────────────────────────────────────── */

/**
 * Một dòng cho ô "chạm xem":
 *
 *   "Khu neo đậu tránh trú bão Lạch Hới · khu lớn (đón tàu nhiều tỉnh) ·
 *    Thanh Hóa · chứa ~1.000 tàu, tàu dài tới 40 m · Kết hợp cảng cá Lạch Hới"
 *
 * Thiếu phần nào BỎ phần đó — nguồn không ghi sức chứa thì không nói gì về sức
 * chứa, tuyệt đối không ước chừng.
 */
export function moTaKhuTruBao(k: KhuTruBao): string {
  const bits = [`Khu neo đậu tránh trú bão ${k.ten}`, capLabel(k.cap)];
  if (k.tinh) bits.push(tenTinhDep(k.tinh));

  const quyMo: string[] = [];
  if (k.sucChua) quyMo.push(`chứa ~${soViet(k.sucChua)} tàu`);
  if (k.coTauM) quyMo.push(`tàu dài tới ${k.coTauM} m`);
  if (quyMo.length) bits.push(quyMo.join(", "));

  if (k.ghiChu) bits.push(k.ghiChu);
  return bits.join(" · ");
}

/** "1000" → "1.000" — số kiểu Việt (dấu chấm ngăn nghìn) cho màn hình. */
const soViet = (v: number): string =>
  v.toLocaleString("vi-VN").replace(/ /g, ".");

/** "QUẢNG NINH" → "Quảng Ninh" — nguồn viết HOA, màn hình đọc dễ hơn kiểu tên riêng. */
export function tenTinhDep(tinh: string): string {
  return tinh
    .toLocaleLowerCase("vi-VN")
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("vi-VN"));
}

/* ── TẢI ASSET TĨNH ──────────────────────────────────────────────────────── */

let cached: Promise<KhuTruBao[]> | null = null;

/**
 * Tải lớp khu trú bão (~12 KB, CÙNG ORIGIN nên service worker giữ được) —
 * cache cho cả phiên.
 *
 * `async` LÀ LÁ CHẮN THỨ HAI (cùng lý do đã ghi ở `fetchDenBien` /
 * `fetchXacTau`): hàm không `async` mà trả Promise thì cú ném ĐỒNG BỘ trong
 * thân hàm (máy cũ thiếu `AbortSignal.timeout`) bay ra trước khi promise kịp
 * tồn tại ⇒ `.catch` của chỗ gọi không với tới ⇒ bản đồ trắng cả chuyến. Lá
 * chắn thứ nhất là `timeoutSignal` (không bao giờ ném).
 *
 * Hỏng thì XOÁ bộ nhớ đệm để lần sóng về sau thử lại — mất sóng ngoài khơi
 * không được khoá vĩnh viễn một lớp bản đồ.
 */
export async function fetchKhuTruBao(): Promise<KhuTruBao[]> {
  if (!cached) {
    cached = fetchDataJson("/data/khu-tru-bao.v1.json", 20000, "khu-tru-bao")
      .then(decodeKhuTruBao)
      .catch((e) => {
        cached = null; // lần sau thử lại (mất sóng không khoá vĩnh viễn)
        throw e;
      });
  }
  return cached;
}
