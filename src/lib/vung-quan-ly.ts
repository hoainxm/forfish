/**
 * Trục 1 + Trục 4 — LỚP KHU BẢO TỒN BIỂN · VÙNG CẤM KHAI THÁC CÓ THỜI HẠN ·
 * KHU BẢO VỆ NGUỒN LỢI THỦY SẢN.
 *
 * File này giữ TYPE + GIẢI MÃ + LUẬT MÙA CẤM + CÂU MÔ TẢ (thuần, test được)
 * cho dataset tĩnh `public/data/vung-quan-ly.v1.json` (sinh bằng
 * `scripts/build-vung-quan-ly.mjs`). Component vẽ bằng MapLibre — file này
 * KHÔNG vẽ; kho dẫn đường (`nav-context.ts`) đọc nó để nhắc "đang trong khu…".
 *
 * ── VÌ SAO CÓ ─────────────────────────────────────────────────────────────
 * Vào khu bảo tồn biển thả lưới, hay đánh ở vùng cấm đúng mùa cấm, là vi phạm
 * bị phạt theo NĐ 38/2024 — và bà con không có cách nào biết ranh giới ngoài
 * biển. Bản đồ hiện có vùng cấm NEO/cấm VÀO từ hải đồ (OSM), nhưng KHÔNG có
 * ranh giới quản lý nghề cá của nhà nước. Lớp này lấp đúng lỗ đó, MIỄN PHÍ cho
 * mọi tài khoản (bản đồ cho không — CLAUDE.md §nguồn dữ liệu).
 *
 * ── BA LOẠI, BA LUẬT ───────────────────────────────────────────────────────
 *   · `bao-ton` — 27 khu bảo tồn biển theo Quy hoạch 2021–2030. Chỉ khu
 *     "đã thành lập" / "chuyển tiếp" mới ràng buộc hôm nay; khu "thành lập
 *     mới" là QUY HOẠCH → vẽ nhạt, KHÔNG nhắc giọng.
 *   · `cam-thoi-han` — vùng cấm khai thác CÓ THỜI HẠN (TT 19/2018): chỉ cấm
 *     trong các khoảng tháng ở `mua`. Đang mùa cấm thì tô đậm + nhắc giọng;
 *     ngoài mùa thì mờ, không nhắc.
 *   · `bao-ve-nguon-loi` — khu bảo vệ nguồn lợi (bảng quy hoạch 11/9/2023):
 *     chỉ hiện trên bản đồ, KHÔNG nhắc giọng (chưa phải quyết định thành lập).
 *
 * ── NHẮC GIỌNG THEO LUẬT ĐÃ CÓ, KHÔNG ĐẺ NGƯỠNG MỚI ────────────────────────
 * Luật chủ dự án chốt (IUU 10/10/2026): vào khu ĐỂ KHAI THÁC mới vi phạm, chạy
 * ngang qua thì không. `nav-hazards` đã có đúng cơ chế đó cho vùng cấm neo:
 * chỉ nói khi chạy CHẬM (< 3 hải lý/giờ) và đang trong vùng, nhắc lại ≤ 1 lần/
 * 10 phút. Dùng lại y nguyên — KHÔNG chờ 30 phút như ngưỡng đếm vi phạm bên
 * IUU: ở đây là nhắc TRƯỚC khi thành vi phạm, không phải đếm sau.
 *
 * ## Assumptions
 * - `thoiGian` dạng "01/4-30/6; 01/11-30/11" (ngày/tháng, nhiều khoảng cách
 *   nhau bằng ";"). Khoảng có đầu > cuối ("01/11-28/2") là vắt qua năm mới.
 *   Chuỗi không đọc được ⇒ `mua` rỗng ⇒ coi như KHÔNG cấm (thà thiếu một lời
 *   nhắc còn hơn nhắc sai quanh năm) — nhưng thẻ vẫn in nguyên văn chuỗi.
 * - 10 vùng TT 19 có thời gian cấm KHÁC NHAU giữa bảng vùng và bảng toàn quốc
 *   (`thoiGianKhac`): app lấy HỢP của hai bảng để tô/nhắc (an toàn hơn cho bà
 *   con), thẻ in cả hai và nói "cần đối chiếu".
 * - Nhãn "tham khảo" của dataset KHÔNG được gỡ: tên khu cấm/khu bảo vệ ghép
 *   thủ công theo vị trí, chưa đối chiếu văn bản hiện hành.
 */

import { fetchDataJson } from "@/lib/data-fetch";
import { trongKhungBienVN } from "@/lib/den-bien";
import { pointInRing } from "@/lib/spatial-index";

/* ── KIỂU ────────────────────────────────────────────────────────────────── */

export type LoaiVung = "bao-ton" | "cam-thoi-han" | "bao-ve-nguon-loi";
export type TrangThaiKhu = "da_thanh_lap" | "chuyen_tiep" | "thanh_lap_moi";
export type TinCayGhep = "cao" | "vi_tri";

/** Một khoảng cấm trong năm: từ ngày/tháng → đến ngày/tháng (bao gồm hai đầu). */
export type MuaCam = { tuThang: number; tuNgay: number; denThang: number; denNgay: number };

/** Toạ độ MultiPolygon GeoJSON: [polygon][ring][đỉnh][lon, lat]. */
export type VungPolys = number[][][][];

export type VungQuanLy = {
  ma: string;
  loai: LoaiVung;
  /** tên hiển thị — nguồn không có tên thì đã thay bằng mô tả (`tenVung`) */
  ten: string;
  tinh: string;
  /** tỉnh ghi trong nguồn (địa giới trước 2025) — để đối chiếu */
  tinhCu: string | null;
  /** khu bảo tồn: cấp quốc gia / tỉnh */
  cap: "QG" | "T" | null;
  /** khu bảo tồn: "Vườn quốc gia" / "Khu dự trữ thiên nhiên" / "Khu bảo tồn loài - sinh cảnh" */
  phanHang: string | null;
  /** khu bảo tồn: đã thành lập / chuyển tiếp / thành lập mới (quy hoạch) */
  trangThai: TrangThaiKhu | null;
  dienTichHa: number | null;
  /** đối tượng bảo vệ (loài) */
  doiTuong: string | null;
  /** thời gian cấm nguyên văn theo bảng vùng */
  thoiGian: string | null;
  /** thời gian cấm theo bảng toàn quốc khi KHÁC bảng vùng */
  thoiGianKhac: string | null;
  tinCay: TinCayGhep | null;
  /** chỉ có điểm, không có ranh giới */
  diem: boolean;
  lon: number;
  lat: number;
  polys: VungPolys | null;
  /** các khoảng cấm đã đọc từ `thoiGian` ∪ `thoiGianKhac` — rỗng = không theo mùa */
  mua: MuaCam[];
};

/** Dạng thô trong `public/data/vung-quan-ly.v1.json`. */
export type VungQuanLyFile = {
  v: number;
  nguon: string;
  /** nhãn "tham khảo" — KHÔNG được bỏ */
  nhan: string;
  layNgay: string;
  giayPhep: { trangThai: string; giayPhepId: string; ghiChu: string };
  tinChiDan?: Record<string, string>;
  vung: Array<Record<string, unknown>>;
};

/* ── NHÃN TIẾNG VIỆT ─────────────────────────────────────────────────────── */

export const LOAI_LABEL: Record<LoaiVung, string> = {
  "bao-ton": "Khu bảo tồn biển",
  "cam-thoi-han": "Vùng cấm khai thác có thời hạn",
  "bao-ve-nguon-loi": "Khu bảo vệ nguồn lợi thủy sản",
};

export const TRANG_THAI_LABEL: Record<TrangThaiKhu, string> = {
  da_thanh_lap: "đã thành lập",
  chuyen_tiep: "đã có, chuyển tiếp theo quy hoạch",
  thanh_lap_moi: "quy hoạch thành lập mới — chưa có hiệu lực",
};

/**
 * Nhãn TRẠNG THÁI để tô màu + quyết nhắc giọng (một chỗ, hai người dùng):
 *   · `hieu-luc` — ràng buộc hôm nay (khu bảo tồn đã thành lập/chuyển tiếp)
 *   · `dang-cam` — vùng cấm có thời hạn, ĐANG trong mùa cấm
 *   · `ngoai-mua` — vùng cấm có thời hạn, ngoài mùa cấm
 *   · `quy-hoach` — mới là quy hoạch/bảng tham khảo, chưa ràng buộc
 */
export type DangVung = "hieu-luc" | "dang-cam" | "ngoai-mua" | "quy-hoach";

export function dangVung(v: Pick<VungQuanLy, "loai" | "trangThai" | "mua">, d: Date): DangVung {
  if (v.loai === "cam-thoi-han") return v.mua.length && dangCam(v.mua, d) ? "dang-cam" : "ngoai-mua";
  if (v.loai === "bao-ton") return v.trangThai === "thanh_lap_moi" ? "quy-hoach" : "hieu-luc";
  return "quy-hoach";
}

/** Có đưa vào kho dẫn đường để nhắc "đang trong khu…" không (mùa cấm xét lúc chạy). */
export function canhBaoDanDuong(v: Pick<VungQuanLy, "loai" | "trangThai" | "polys" | "mua">): boolean {
  if (!v.polys?.length) return false;
  if (v.loai === "bao-ton") return v.trangThai !== "thanh_lap_moi";
  if (v.loai === "cam-thoi-han") return v.mua.length > 0;
  return false;
}

/* ── MÙA CẤM ─────────────────────────────────────────────────────────────── */

const ngayHopLe = (ng: number, th: number): boolean =>
  Number.isInteger(ng) && Number.isInteger(th) && th >= 1 && th <= 12 && ng >= 1 && ng <= 31;

/**
 * "01/4-30/6; 01/11-30/11" → hai khoảng. Phần không đọc được thì BỎ phần đó
 * (không bịa khoảng). Dấu gạch nối chấp nhận "-", "–", "—".
 */
export function parseMuaCam(s: string | null | undefined): MuaCam[] {
  if (!s) return [];
  const out: MuaCam[] = [];
  for (const phan of s.split(/[;,]/)) {
    const m = /(\d{1,2})\s*\/\s*(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*\/\s*(\d{1,2})/.exec(phan);
    if (!m) continue;
    const [tuNgay, tuThang, denNgay, denThang] = [m[1], m[2], m[3], m[4]].map(Number);
    if (!ngayHopLe(tuNgay, tuThang) || !ngayHopLe(denNgay, denThang)) continue;
    out.push({ tuThang, tuNgay, denThang, denNgay });
  }
  return out;
}

/** Hợp hai chuỗi thời gian (bảng vùng ∪ bảng toàn quốc), bỏ khoảng trùng. */
export function hopMuaCam(a: string | null | undefined, b: string | null | undefined): MuaCam[] {
  const out: MuaCam[] = [];
  const key = (m: MuaCam) => `${m.tuThang}/${m.tuNgay}-${m.denThang}/${m.denNgay}`;
  const seen = new Set<string>();
  for (const m of [...parseMuaCam(a), ...parseMuaCam(b)]) {
    if (seen.has(key(m))) continue;
    seen.add(key(m));
    out.push(m);
  }
  // Theo thứ tự trong năm để câu đọc "1/4–30/6 và 1/8–31/8 và 1/11–30/11" xuôi tai.
  return out.sort((x, y) => x.tuThang * 100 + x.tuNgay - (y.tuThang * 100 + y.tuNgay));
}

/** Ngày `d` có nằm trong một khoảng cấm không (khoảng vắt năm: đầu > cuối). */
export function dangCam(mua: readonly MuaCam[], d: Date): boolean {
  const now = (d.getMonth() + 1) * 100 + d.getDate();
  for (const m of mua) {
    const tu = m.tuThang * 100 + m.tuNgay;
    const den = m.denThang * 100 + m.denNgay;
    if (tu <= den ? now >= tu && now <= den : now >= tu || now <= den) return true;
  }
  return false;
}

/** "01/4-30/6; 01/11-30/11" → "1/4–30/6 và 1/11–30/11" cho thẻ/câu đọc. */
export function muaCamText(mua: readonly MuaCam[]): string {
  return mua.map((m) => `${m.tuNgay}/${m.tuThang}–${m.denNgay}/${m.denThang}`).join(" và ");
}

/* ── HÌNH HỌC ────────────────────────────────────────────────────────────── */

/**
 * Điểm (kinh/vĩ) có nằm trong vùng không — luật CHẴN-LẺ trên MỌI vòng (vòng
 * ngoài + lỗ của mọi mảnh): nằm trong số lẻ vòng là trong. Cùng luật
 * `fill-rule: evenodd`, nên không cần phân biệt vòng ngoài và lỗ.
 */
export function trongVung(v: Pick<VungQuanLy, "polys">, lon: number, lat: number): boolean {
  if (!v.polys || !Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  let n = 0;
  const p = { lat, lon };
  for (const poly of v.polys) for (const ring of poly) if (pointInRing(p, ring)) n++;
  return n % 2 === 1;
}

/* ── CÂU CHO BÀ CON ĐỌC ──────────────────────────────────────────────────── */

const HOP_LE_LOAI = new Set<LoaiVung>(["bao-ton", "cam-thoi-han", "bao-ve-nguon-loi"]);
const HOP_LE_TRANG_THAI = new Set<TrangThaiKhu>(["da_thanh_lap", "chuyen_tiep", "thanh_lap_moi"]);

/** Tên hiển thị khi nguồn không có tên — không bao giờ lộ mã thô. */
function tenThay(loai: LoaiVung, doiTuong: string | null, ma: string): string {
  if (loai === "bao-ve-nguon-loi") {
    const dt = doiTuong?.replace(/\s*\(.*$/, "").trim();
    return dt ? `Khu bảo vệ ${dt.toLocaleLowerCase("vi-VN")}` : "Khu bảo vệ nguồn lợi (chưa rõ tên)";
  }
  if (loai === "cam-thoi-han") return `Vùng cấm khai thác có thời hạn (chưa rõ tên, mã ${ma})`;
  return `Khu bảo tồn biển (chưa rõ tên, mã ${ma})`;
}

const hoaDau = (s: string) => (s ? s.charAt(0).toLocaleUpperCase("vi-VN") + s.slice(1) : s);
const thuongDau = (s: string) => (s ? s.charAt(0).toLocaleLowerCase("vi-VN") + s.slice(1) : s);

/**
 * Tên để GHÉP VÀO CÂU của dẫn đường ("Đang trong … — đừng neo, đừng thả lưới").
 *   bao-ton: "khu bảo tồn biển Cù Lao Chàm"
 *   cam-thoi-han: "vùng cấm khai thác theo mùa (vùng biển Long Châu - Hạ Mai)"
 */
export function tenNoi(v: Pick<VungQuanLy, "loai" | "ten">): string {
  if (v.loai === "cam-thoi-han") return `vùng cấm khai thác theo mùa (${thuongDau(v.ten)})`;
  if (v.loai === "bao-ton") return /^khu bảo tồn/i.test(v.ten) ? thuongDau(v.ten) : `khu bảo tồn biển ${v.ten}`;
  return /^khu bảo vệ/i.test(v.ten) ? thuongDau(v.ten) : `khu bảo vệ nguồn lợi ${v.ten}`;
}

/** Dòng trạng thái cho thẻ chạm: nói thẳng hôm nay có cấm không. */
export function trangThaiText(v: VungQuanLy, d: Date): string {
  const dang = dangVung(v, d);
  if (v.loai === "cam-thoi-han") {
    const mua = v.mua.length ? `cấm khai thác ${muaCamText(v.mua)}` : `thời gian cấm: ${v.thoiGian ?? "chưa rõ"}`;
    return dang === "dang-cam" ? `ĐANG MÙA CẤM — ${mua}` : `ngoài mùa cấm hôm nay — ${mua}`;
  }
  if (v.loai === "bao-ton") return v.trangThai ? TRANG_THAI_LABEL[v.trangThai] : "chưa rõ trạng thái";
  return "theo bảng quy hoạch — chưa phải quyết định thành lập";
}

/**
 * Một câu mô tả cho ô "chạm xem" / dòng tin:
 *   "Khu bảo tồn biển Cù Lao Chàm · Đà Nẵng · 23.488 ha · đã có, chuyển tiếp theo quy hoạch"
 * Thiếu phần nào BỎ phần đó — không ước chừng diện tích, không bịa thời gian.
 */
export function moTaVung(v: VungQuanLy, d: Date): string {
  const bits = [hoaDau(v.ten)];
  if (v.loai !== "bao-ton" || !/^khu bảo tồn/i.test(v.ten)) bits.unshift(LOAI_LABEL[v.loai]);
  if (v.tinh) bits.push(v.tinh);
  if (v.dienTichHa) bits.push(`${soViet(v.dienTichHa)} ha`);
  bits.push(trangThaiText(v, d));
  if (v.doiTuong) bits.push(`bảo vệ: ${v.doiTuong}`);
  return [...new Set(bits)].join(" · ");
}

/** "23488" → "23.488" — số kiểu Việt. */
const soViet = (v: number): string => Math.round(v).toLocaleString("vi-VN").replace(/ /g, ".");

/* ── GIẢI MÃ DATASET ─────────────────────────────────────────────────────── */

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/** Vòng hợp lệ: ≥ 4 đỉnh, mọi đỉnh là [lon, lat] hữu hạn. */
function vongHopLe(r: unknown): r is number[][] {
  return (
    Array.isArray(r) &&
    r.length >= 4 &&
    r.every((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
  );
}

function docPolys(raw: unknown): VungPolys | null {
  if (!Array.isArray(raw)) return null;
  const out: VungPolys = [];
  for (const poly of raw) {
    if (!Array.isArray(poly) || !vongHopLe(poly[0])) continue; // mất vòng ngoài = bỏ mảnh
    out.push(poly.filter(vongHopLe) as number[][][]);
  }
  return out.length ? out : null;
}

/**
 * Danh sách vùng, đã lọc.
 *
 * BỎ QUA hàng hỏng thay vì ném: một dòng lỗi không được làm mất cả lớp ranh
 * giới của chuyến biển. Hàng bị bỏ khi thiếu mã, loại lạ, tâm ngoài khung biển
 * VN, hoặc vừa không có điểm vừa không có vòng nào.
 */
export function decodeVungQuanLy(raw: unknown): VungQuanLy[] {
  const f = raw as Partial<VungQuanLyFile> | null;
  if (!f || !Array.isArray(f.vung)) return [];
  const out: VungQuanLy[] = [];
  for (const r of f.vung) {
    if (!r || typeof r !== "object") continue;
    const ma = str(r.ma);
    const loai = r.loai as LoaiVung;
    if (!ma || !HOP_LE_LOAI.has(loai)) continue;
    const lon = r.lon as number;
    const lat = r.lat as number;
    if (!trongKhungBienVN(lon, lat)) continue;
    const polys = docPolys(r.polys);
    const diem = r.diem === true || !polys;
    const doiTuong = str(r.doiTuong);
    const thoiGian = str(r.thoiGian);
    const thoiGianKhac = str(r.thoiGianKhac);
    const trangThai = HOP_LE_TRANG_THAI.has(r.trangThai as TrangThaiKhu) ? (r.trangThai as TrangThaiKhu) : null;
    out.push({
      ma,
      loai,
      ten: str(r.ten) ?? tenThay(loai, doiTuong, ma),
      tinh: str(r.tinh) ?? "",
      tinhCu: str(r.tinhCu),
      cap: r.cap === "QG" || r.cap === "T" ? r.cap : null,
      phanHang: str(r.phanHang),
      trangThai,
      dienTichHa: num(r.dienTichHa),
      doiTuong,
      thoiGian,
      thoiGianKhac,
      tinCay: r.tinCay === "cao" || r.tinCay === "vi_tri" ? r.tinCay : null,
      diem,
      lon,
      lat,
      polys,
      mua: loai === "cam-thoi-han" ? hopMuaCam(thoiGian, thoiGianKhac) : [],
    });
  }
  return out;
}

/* ── TẢI ASSET TĨNH ──────────────────────────────────────────────────────── */

let cached: Promise<VungQuanLy[]> | null = null;

/**
 * Tải lớp vùng quản lý (~150 KB, CÙNG ORIGIN nên service worker giữ được) —
 * cache cho cả phiên. `async` là lá chắn thứ hai (cùng lý do `fetchKhuTruBao`):
 * cú ném đồng bộ trong thân hàm không được bay qua `.catch` của chỗ gọi.
 * Hỏng thì XOÁ bộ nhớ đệm để lần sóng về sau thử lại.
 */
export async function fetchVungQuanLy(): Promise<VungQuanLy[]> {
  if (!cached) {
    cached = fetchDataJson("/data/vung-quan-ly.v1.json", 20000, "vung-quan-ly")
      .then(decodeVungQuanLy)
      .catch((e) => {
        cached = null; // lần sau thử lại (mất sóng không khoá vĩnh viễn)
        throw e;
      });
  }
  return cached;
}
