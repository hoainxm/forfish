/**
 * Trục 1 — LỚP XÁC TÀU + CHƯỚNG NGẠI VẬT.
 *
 * File này giữ TYPE + GIẢI MÃ + CÂU MÔ TẢ (thuần, test được) cho dataset tĩnh
 * `public/data/xac-tau.v1.json` (sinh bởi `scripts/generate-xac-tau.mjs`).
 * Component render bằng lớp symbol của MapLibre — file này KHÔNG vẽ.
 *
 * ── VÌ SAO CÓ ─────────────────────────────────────────────────────────────
 * Với tàu cá, một xác tàu dưới đáy là thông tin tính mạng: lưới quét qua là
 * mất lưới, đêm tối chạy qua xác cạn là thủng vỏ. Lớp `reef-hazard` hiện chỉ
 * có chấm wreck từ OSM — mà OSM chưa từng theo dõi biển VN (42/42 điểm nằm ở
 * Hồng Kông – Trung Quốc – Malaysia). Lớp này đọc từ nguồn thật sự quản lý:
 * Thông báo hàng hải + Thông báo người đi biển của Cảng vụ / Tổng công ty
 * Bảo đảm an toàn hàng hải — mỗi mục mang SỐ HIỆU thông báo tra ngược được.
 *
 * ── XÁC TÀU LÀ SỰ KIỆN ────────────────────────────────────────────────────
 * Tin sau có thể "đã trục vớt/thanh thải" — script sinh dữ liệu xếp LẬP/GỠ
 * theo thời gian và bản GỠ xoá mục, nên file chỉ chứa vật CÒN theo hồ sơ
 * công bố. Kho thông báo không kín tuyệt đối, vì vậy nhãn "tham khảo" của
 * dataset KHÔNG được gỡ: một vật đã vớt mà tin gỡ chưa về tới kho sẽ vẫn
 * hiện — chiều sai an toàn (bà con tránh một chỗ trống), nhưng vẫn là sai.
 *
 * ## Assumptions
 * - `doSauVuotQua` tính bằng MÉT về "số 0 hải đồ", CHỈ có khi nguồn nói thẳng
 *   ("điểm cạn nhất trên xác tàu … có độ sâu 6,8 m"). `-1` trong file nghĩa
 *   là NGUỒN KHÔNG CÔNG BỐ — không phải "0 m", càng không được đoán.
 * - Nhiều tin cùng một vật mà khác độ sâu (khảo sát nhiều đợt): file giữ số
 *   CẠN NHẤT — hứa nhiều nước hơn thực tế là kiểu sai nguy hiểm nhất.
 */

import { timeoutSignal } from "@/lib/abort";
import { trongKhungBienVN } from "@/lib/den-bien";
import type { Provenance } from "@/lib/provenance";

/* ── KIỂU ────────────────────────────────────────────────────────────────── */

/** Ba loại của khuôn dữ liệu — PHẢI khớp `loais` của file. */
export type XacTauLoai = "xac-tau" | "chuong-ngai" | "vat-chim";

export type XacTau = {
  lon: number;
  lat: number;
  loai: XacTauLoai;
  /** tên/số hiệu phương tiện do nhà nước công bố ("MINH KHÁNH 01") — định
   *  danh để tra ngược, KHÔNG bịa khi nguồn không ghi */
  ten?: string;
  /** mét nước trên vật, quy về số 0 hải đồ — hiếm, chỉ khi nguồn ghi thẳng */
  doSauVuotQua?: number;
  /** bán kính cấm/tránh quanh vật, mét — chỉ khi nguồn ghi */
  banKinhCamM?: number;
  /** số hiệu thông báo hàng hải gốc ("993/TBHH-CVHHHP") */
  soThongBao?: string;
  /** năm + tháng của thông báo — để bà con biết tin cũ hay mới */
  nam?: number;
  thang?: number;
  /** ghi chú nguồn gốc vị trí (vd "Vị trí theo Phao 5 luồng Cửa Gianh …") */
  ghi?: string;
  prov: Provenance;
};

/** Một thông báo gốc trong file — nhiều mục có thể trỏ chung một tin. */
export type XacTauNotice = {
  so: string;
  nam: number | null;
  thang: number | null;
  url?: string;
  ghi?: string;
  /** bản chữ đến từ đường nào: "ocr" | "lop-chu" */
  duong: string;
};

/** Dạng thô trong `public/data/xac-tau.v1.json` — bảng tra + hàng số. */
export type XacTauFile = {
  v: number;
  nguon: string;
  /** nhãn "tham khảo, đối chiếu Thông báo hàng hải" — KHÔNG được bỏ */
  nhan: string;
  layNgay: string;
  giayPhep: { trangThai: string; giayPhepId: string; ghiChu: string };
  loais: string[];
  names: string[];
  notices: XacTauNotice[];
  /** [lon, lat, loai, ten, doSauVuotQua, banKinhM, notice, osmGan] */
  items: number[][];
};

/* ── NHÃN TIẾNG VIỆT ─────────────────────────────────────────────────────── */

/** Loại → câu bà con đọc được — không jargon, không tiếng Anh. */
export const XAC_TAU_LABEL: Record<XacTauLoai, string> = {
  "xac-tau": "Xác tàu chìm",
  "chuong-ngai": "Chướng ngại vật",
  "vat-chim": "Vật thể chìm",
};

/** Nhãn loại; loại lạ rơi về "Chướng ngại vật" — vẫn là thứ phải tránh,
 *  KHÔNG bao giờ lộ chuỗi mã thô ra màn hình. */
export function xacTauLabel(loai: string | undefined): string {
  return XAC_TAU_LABEL[(loai ?? "") as XacTauLoai] ?? XAC_TAU_LABEL["chuong-ngai"];
}

/* ── GIẢI MÃ DATASET ─────────────────────────────────────────────────────── */

/** Vị trí cột trong `items` — khớp script sinh dữ liệu. */
const COT = {
  lon: 0, lat: 1, loai: 2, ten: 3, doSau: 4, banKinh: 5, notice: 6,
} as const;

const LOAI_HOP_LE = new Set<XacTauLoai>(["xac-tau", "chuong-ngai", "vat-chim"]);

const tra = (bang: string[] | undefined, i: number | undefined): string | undefined =>
  Array.isArray(bang) && typeof i === "number" && i >= 0 && i < bang.length
    ? bang[i] || undefined
    : undefined;

/** Số dương thật sự; `-1` của file (= nguồn không công bố) trả `undefined`. */
const soDuong = (v: number | undefined): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;

/**
 * Bảng tra + hàng số → danh sách xác tàu/chướng ngại.
 *
 * BỎ QUA hàng hỏng thay vì ném: một dòng lỗi không được làm mất cả lớp hiểm
 * hoạ của chuyến biển. Cổng khung biển VN chặn đúng lớp lỗi nguy hiểm nhất
 * của nguồn này — toạ độ OCR tách chữ (xem `trongKhungBienVN`).
 */
export function decodeXacTau(raw: unknown): XacTau[] {
  const f = raw as Partial<XacTauFile> | null;
  if (!f || !Array.isArray(f.items)) return [];

  const out: XacTau[] = [];
  for (const row of f.items) {
    if (!Array.isArray(row) || row.length < 7) continue;
    const lon = row[COT.lon];
    const lat = row[COT.lat];
    if (!trongKhungBienVN(lon, lat)) continue;

    const loaiRaw = tra(f.loais, row[COT.loai]);
    const loai: XacTauLoai = LOAI_HOP_LE.has(loaiRaw as XacTauLoai)
      ? (loaiRaw as XacTauLoai)
      : "chuong-ngai"; // loại lạ vẫn là thứ phải tránh — giữ điểm, hạ về chung

    const n = Array.isArray(f.notices) ? f.notices[row[COT.notice]] : undefined;
    const x: XacTau = {
      lon,
      lat,
      loai,
      // Không tra được tin gốc thì vẫn giữ vật (vị trí là thứ cứu người) nhưng
      // ghi nguồn "sdfish" — validateProvenance/cleanPackage tự xử phần còn lại.
      prov: n?.so || n?.url
        ? {
            origin: {
              source: "tbhh",
              at: f.layNgay ?? "",
              ...(n.so ? { version: n.so } : {}),
              ...(n.url ? { url: n.url } : {}),
            },
          }
        : { origin: { source: "sdfish", at: f.layNgay ?? "" } },
    };

    const ten = tra(f.names, row[COT.ten]);
    if (ten) x.ten = ten;
    const doSau = soDuong(row[COT.doSau]);
    if (doSau) x.doSauVuotQua = doSau;
    const banKinh = soDuong(row[COT.banKinh]);
    if (banKinh) x.banKinhCamM = banKinh;
    if (n?.so) x.soThongBao = n.so;
    if (typeof n?.nam === "number") x.nam = n.nam;
    if (typeof n?.thang === "number") x.thang = n.thang;
    if (n?.ghi) x.ghi = n.ghi;

    out.push(x);
  }
  return out;
}

/* ── CÂU CHO BÀ CON ĐỌC ──────────────────────────────────────────────────── */

/** "1.1" → "1,1" — số kiểu Việt cho màn hình. */
const soViet = (v: number): string => String(v).replace(".", ",");

/**
 * Một dòng cho ô "chạm xem":
 *
 *   "Xác tàu chìm MINH KHÁNH 01 · nước trên vật chỉ còn 1,1 m (mức triều
 *    thấp nhất) · tin tháng 2/2026 · Vị trí theo Phao 5 luồng Cửa Gianh …"
 *
 * Thiếu phần nào BỎ phần đó — nguồn không ghi độ sâu thì không nói gì về độ
 * sâu, tuyệt đối không "ước chừng". Hứa mức chính xác nguồn không bảo đảm là
 * điều dự án cấm.
 *
 * SỐ HIỆU thông báo (`soThongBao`) KHÔNG nằm trong câu này: thẻ chạm đã in
 * riêng dòng "Thông báo hàng hải …" bên dưới (review 2026-09-03 bắt lỗi in
 * hai lần). Câu chỉ giữ THÁNG/NĂM để bà con biết tin cũ hay mới.
 */
export function moTaXacTau(x: XacTau): string {
  const bits = [x.ten ? `${xacTauLabel(x.loai)} ${x.ten}` : xacTauLabel(x.loai)];
  if (x.doSauVuotQua) {
    // "số 0 hải đồ" là jargon — nói bằng lời người đi biển: mức triều thấp nhất.
    bits.push(`nước trên vật chỉ còn ${soViet(x.doSauVuotQua)} m (mức triều thấp nhất)`);
  }
  if (x.banKinhCamM) bits.push(`tránh xa trong vòng ${x.banKinhCamM} m`);
  if (x.nam) {
    bits.push(x.thang ? `tin tháng ${x.thang}/${x.nam}` : `tin năm ${x.nam}`);
  }
  if (x.ghi) bits.push(x.ghi);
  return bits.join(" · ");
}

/* ── TẢI ASSET TĨNH ──────────────────────────────────────────────────────── */

let cached: Promise<XacTau[]> | null = null;

/**
 * Tải lớp xác tàu (~8 KB, CÙNG ORIGIN nên service worker giữ được) — cache
 * cho cả phiên.
 *
 * `async` LÀ LÁ CHẮN THỨ HAI (cùng lý do đã ghi ở `fetchSeamarks` /
 * `fetchDenBien`): hàm không `async` mà trả Promise thì cú ném ĐỒNG BỘ trong
 * thân hàm bay ra trước khi promise kịp tồn tại ⇒ `.catch` của chỗ gọi không
 * với tới ⇒ bản đồ trắng cả chuyến. Lá chắn thứ nhất là `timeoutSignal`
 * (không bao giờ ném).
 *
 * Hỏng thì XOÁ bộ nhớ đệm để lần sóng về sau thử lại — mất sóng ngoài khơi
 * không được khoá vĩnh viễn một lớp bản đồ.
 */
export async function fetchXacTau(): Promise<XacTau[]> {
  if (!cached) {
    cached = fetch("/data/xac-tau.v1.json", { signal: timeoutSignal(20000) })
      .then((r) => {
        if (!r.ok) throw new Error(`xac-tau ${r.status}`);
        return r.json();
      })
      .then(decodeXacTau)
      .catch((e) => {
        cached = null; // lần sau thử lại (mất sóng không khoá vĩnh viễn)
        throw e;
      });
  }
  return cached;
}
